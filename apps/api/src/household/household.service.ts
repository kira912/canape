import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Household, Me, Session } from "@canape/shared";
import { PrismaService } from "../prisma/prisma.service";
import { generateInviteCode, generateSessionToken, hashToken } from "./tokens";

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
   * Joins with the invite code. Joining again with an existing name (e.g. a
   * new phone, or the app was reinstalled) signs in as that member.
   */
  async join(input: { inviteCode: string; memberName: string; color: string }): Promise<Session> {
    const household = await this.prisma.household.findUnique({ where: { inviteCode: input.inviteCode } });
    if (!household) throw new NotFoundException("Code d'invitation inconnu");

    const existing = await this.prisma.member.findFirst({
      where: { householdId: household.id, name: { equals: input.memberName, mode: "insensitive" } },
    });
    const member =
      existing ??
      (await this.prisma.member.create({
        data: { householdId: household.id, name: input.memberName, color: input.color },
      }));
    return this.openSession(member.id, household.id);
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
    if (changes.name) {
      const taken = await this.prisma.member.findFirst({
        where: { householdId, id: { not: memberId }, name: { equals: changes.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (taken) throw new ConflictException("Ce prénom est déjà utilisé dans le foyer");
    }
    await this.prisma.member.update({ where: { id: memberId }, data: changes });
    return this.getHousehold(householdId);
  }

  /**
   * Right to erasure: deletes the member with their sessions, lists, "already
   * watched" and votes (cascades), including the shared-list titles they added.
   * The household goes with its last member.
   */
  async deleteMember(memberId: string, householdId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.member.delete({ where: { id: memberId } });
      if ((await tx.member.count({ where: { householdId } })) === 0) {
        await tx.household.delete({ where: { id: householdId } });
      }
    });
  }

  async closeSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  /** A new device session for the member (sign-up, join, QR pairing). */
  async openSession(memberId: string, householdId: string): Promise<Session> {
    const token = generateSessionToken();
    await this.prisma.session.create({ data: { memberId, tokenHash: hashToken(token) } });
    return { token, ...(await this.me(memberId, householdId)) };
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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
