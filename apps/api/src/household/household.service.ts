import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Household, Me, RecoveryCode, Session } from "@canape/shared";
import { PrismaService } from "../prisma/prisma.service";
import { generateInviteCode, generateRecoveryCode, generateSessionToken, hashRecoveryCode, hashToken } from "./tokens";

const householdInclude = {
  members: { select: { id: true, name: true, color: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.HouseholdInclude;

type HouseholdRow = Prisma.HouseholdGetPayload<{ include: typeof householdInclude }>;

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    householdName: string;
    memberName: string;
    color: string;
    providerIds: number[];
  }): Promise<Session> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const household = await this.prisma.household.create({
          data: {
            name: input.householdName,
            inviteCode: generateInviteCode(),
            providerIds: input.providerIds,
            members: { create: { name: input.memberName, color: input.color } },
          },
          include: { members: true },
        });
        return this.openSession(household.members[0].id, household.id);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error; // invite code collision → retry with a new code
      }
    }
    throw new ConflictException("Impossible de générer un code d'invitation, réessayez");
  }

  /**
   * Joins with the invite code as a new member. The code is shared with guests
   * and is short, so it never gives access to an existing profile: getting a
   * profile back on another device goes through a QR pairing or the member's
   * recovery code.
   */
  async join(input: { inviteCode: string; memberName: string; color: string }): Promise<Session> {
    const household = await this.prisma.household.findUnique({ where: { inviteCode: input.inviteCode } });
    if (!household) throw new NotFoundException("Code d'invitation inconnu");
    await this.assertNameFree(household.id, input.memberName);
    try {
      const member = await this.prisma.member.create({
        data: { householdId: household.id, name: input.memberName, color: input.color },
      });
      return await this.openSession(member.id, household.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken(); // same name joined concurrently
      throw error;
    }
  }

  /** Signs in on a new device with the member's personal recovery code. */
  async recover(recoveryCode: string): Promise<Session> {
    const member = await this.prisma.member.findUnique({
      where: { recoveryCodeHash: hashRecoveryCode(recoveryCode) },
      select: { id: true, householdId: true },
    });
    if (!member) throw new NotFoundException("Code de secours inconnu");
    return this.openSession(member.id, member.householdId);
  }

  /** A new recovery code, shown once (only its hash is kept); the previous one stops working. */
  async regenerateRecoveryCode(memberId: string): Promise<RecoveryCode> {
    const recoveryCode = generateRecoveryCode();
    await this.prisma.member.update({ where: { id: memberId }, data: { recoveryCodeHash: hashRecoveryCode(recoveryCode) } });
    return { recoveryCode };
  }

  /** A new invite code for the household (e.g. after sharing it too widely); the old one stops working. */
  async regenerateInviteCode(householdId: string): Promise<Household> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const household = await this.prisma.household.update({
          where: { id: householdId },
          data: { inviteCode: generateInviteCode() },
          include: householdInclude,
        });
        return toHousehold(household);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new ConflictException("Impossible de générer un code d'invitation, réessayez");
  }

  async me(memberId: string, householdId: string): Promise<Me> {
    return { memberId, household: await this.getHousehold(householdId) };
  }

  async updateProviders(householdId: string, providerIds: number[]): Promise<Household> {
    const household = await this.prisma.household.update({
      where: { id: householdId },
      data: { providerIds: [...new Set(providerIds)].sort((a, b) => a - b) },
      include: householdInclude,
    });
    return toHousehold(household);
  }

  /** Renames the member (names are unique per household, case-insensitive) and/or changes their colour. */
  async updateMember(
    memberId: string,
    householdId: string,
    changes: { name?: string; color?: string },
  ): Promise<Household> {
    if (changes.name) await this.assertNameFree(householdId, changes.name, memberId);
    try {
      await this.prisma.member.update({ where: { id: memberId }, data: changes });
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    return this.getHousehold(householdId);
  }

  /**
   * Right to erasure: deletes the member with their sessions, lists, "already
   * watched" and votes (cascades), including the shared-list titles they added.
   * The household goes with its last member.
   */
  async deleteMember(memberId: string, householdId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Serialises deletions within the household: the last two members leaving at once
      // must not both see the other one remaining and leave an empty household behind.
      await tx.$queryRaw`SELECT 1 FROM "Household" WHERE "id" = ${householdId} FOR UPDATE`;
      await tx.member.delete({ where: { id: memberId } });
      if ((await tx.member.count({ where: { householdId } })) === 0) {
        await tx.household.delete({ where: { id: householdId } });
      }
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /** Signs the member out everywhere but on this device (lost phone, a session opened by someone else…). */
  async closeOtherSessions(memberId: string, sessionId: string): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { memberId, id: { not: sessionId } } });
    return count;
  }

  /** A new device session for the member (sign-up, join, QR pairing). */
  async openSession(memberId: string, householdId: string): Promise<Session> {
    const token = generateSessionToken();
    await this.prisma.session.create({ data: { memberId, tokenHash: hashToken(token) } });
    return { token, ...(await this.me(memberId, householdId)) };
  }

  /** Names are unique per household, case-insensitively (the database index alone is case-sensitive). */
  private async assertNameFree(householdId: string, name: string, exceptMemberId?: string) {
    const taken = await this.prisma.member.findFirst({
      where: {
        householdId,
        ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}),
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (taken) throw nameTaken();
  }

  private async getHousehold(householdId: string): Promise<Household> {
    const household = await this.prisma.household.findUnique({ where: { id: householdId }, include: householdInclude });
    if (!household) throw new NotFoundException("Foyer introuvable");
    return toHousehold(household);
  }
}

function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    providerIds: row.providerIds,
    members: row.members,
  };
}

function nameTaken() {
  return new ConflictException("Ce prénom est déjà utilisé dans le foyer");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
