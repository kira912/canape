import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { HouseholdService } from "./household.service";

function setup(nameTaken: boolean) {
  const prisma = {
    member: {
      findFirst: jest.fn(async (_args: unknown) => (nameTaken ? { id: "other" } : null)),
      update: jest.fn(async (_args: unknown) => undefined),
    },
    household: {
      findUnique: jest.fn(async (_args: unknown) => ({
        id: "h1",
        name: "Notre canapé",
        inviteCode: "ABC234",
        providerIds: [],
        members: [{ id: "m1", name: "Valentin", color: "#B57EDC" }],
      })),
    },
  };
  return { service: new HouseholdService(prisma as unknown as PrismaService), prisma };
}

describe("HouseholdService.updateMember", () => {
  it("renames the member after checking the name is free in the household", async () => {
    const { service, prisma } = setup(false);

    const household = await service.updateMember("m1", "h1", { name: "Valentin" });

    expect(prisma.member.findFirst.mock.calls[0][0]).toMatchObject({
      where: { householdId: "h1", id: { not: "m1" }, name: { equals: "Valentin", mode: "insensitive" } },
    });
    expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { name: "Valentin" } });
    expect(household.members[0].name).toBe("Valentin");
  });

  it("refuses a name another member already uses", async () => {
    const { service, prisma } = setup(true);
    await expect(service.updateMember("m1", "h1", { name: "camille" })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("changes only the colour without a name check", async () => {
    const { service, prisma } = setup(true);
    await service.updateMember("m1", "h1", { color: "#6FCF97" });
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });
});

describe("HouseholdService.deleteMember", () => {
  function setupDelete(remaining: number) {
    const tx = {
      $queryRaw: jest.fn(async () => []),
      member: {
        delete: jest.fn(async (_args: unknown) => undefined),
        count: jest.fn(async (_args: unknown) => remaining),
      },
      household: { delete: jest.fn(async (_args: unknown) => undefined) },
    };
    const prisma = { $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)) };
    return { service: new HouseholdService(prisma as unknown as PrismaService), tx };
  }

  it("deletes the member and keeps a household that still has members", async () => {
    const { service, tx } = setupDelete(1);
    await service.deleteMember("m1", "h1");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.member.delete.mock.invocationCallOrder[0]);
    expect(tx.member.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(tx.household.delete).not.toHaveBeenCalled();
  });

  it("deletes the household with its last member", async () => {
    const { service, tx } = setupDelete(0);
    await service.deleteMember("m1", "h1");
    expect(tx.household.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });
});

describe("HouseholdService.join", () => {
  function setupJoin(existingName: boolean) {
    const prisma = {
      household: {
        findUnique: jest.fn(async (args: { where: { inviteCode?: string; id?: string } }) =>
          args.where.inviteCode === "ABC234" || args.where.id === "h1"
            ? { id: "h1", name: "Notre canapé", inviteCode: "ABC234", providerIds: [], members: [] }
            : null,
        ),
      },
      member: {
        findFirst: jest.fn(async (_args: unknown) => (existingName ? { id: "m1" } : null)),
        create: jest.fn(async (_args: unknown) => ({ id: "m2" })),
      },
      session: { create: jest.fn(async (_args: unknown) => undefined) },
    };
    return { service: new HouseholdService(prisma as unknown as PrismaService), prisma };
  }

  it("never signs in as an existing member: the invite code is shared and short", async () => {
    const { service, prisma } = setupJoin(true);

    await expect(
      service.join({ inviteCode: "ABC234", memberName: "valentin", color: "#6FCF97" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.member.findFirst.mock.calls[0][0]).toMatchObject({
      where: { householdId: "h1", name: { equals: "valentin", mode: "insensitive" } },
    });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("creates a new member with a fresh session", async () => {
    const { service, prisma } = setupJoin(false);

    const session = await service.join({ inviteCode: "ABC234", memberName: "Camille", color: "#6FCF97" });

    expect(prisma.member.create).toHaveBeenCalledWith({
      data: { householdId: "h1", name: "Camille", color: "#6FCF97" },
    });
    expect(session.memberId).toBe("m2");
    expect(session.token.length).toBeGreaterThanOrEqual(43);
  });

  it("answers 404 for an unknown code", async () => {
    const { service } = setupJoin(false);

    await expect(service.join({ inviteCode: "ZZZ999", memberName: "Camille", color: "#6FCF97" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("HouseholdService recovery code", () => {
  function setupRecovery() {
    const hashes = new Map<string, { id: string; householdId: string }>();
    const prisma = {
      member: {
        update: jest.fn(async (args: { where: { id: string }; data: { recoveryCodeHash: string } }) => {
          hashes.set(args.data.recoveryCodeHash, { id: args.where.id, householdId: "h1" });
        }),
        findUnique: jest.fn(async (args: { where: { recoveryCodeHash: string } }) => hashes.get(args.where.recoveryCodeHash) ?? null),
      },
      household: {
        findUnique: jest.fn(async (_args: unknown) => ({
          id: "h1",
          name: "Notre canapé",
          inviteCode: "ABC234",
          providerIds: [],
          members: [],
        })),
      },
      session: { create: jest.fn(async (_args: unknown) => undefined) },
    };
    return { service: new HouseholdService(prisma as unknown as PrismaService), prisma };
  }

  it("signs in with the generated code, typed in any case and grouping", async () => {
    const { service, prisma } = setupRecovery();
    const { recoveryCode } = await service.regenerateRecoveryCode("m1");

    expect(recoveryCode).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
    // Only the hash is stored.
    expect(JSON.stringify(prisma.member.update.mock.calls)).not.toContain(recoveryCode);

    const session = await service.recover(recoveryCode.toLowerCase().replace(/-/g, " "));
    expect(session.memberId).toBe("m1");
  });

  it("refuses an unknown code", async () => {
    const { service } = setupRecovery();

    await expect(service.recover("ABCDEFGHJKMNPQRS")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("HouseholdService sessions and invite code", () => {
  it("signs out every other device of the member, never another member's", async () => {
    const prisma = { session: { deleteMany: jest.fn(async (_args: unknown) => ({ count: 2 })) } };
    const service = new HouseholdService(prisma as unknown as PrismaService);

    expect(await service.closeOtherSessions("m1", "s1")).toBe(2);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { memberId: "m1", id: { not: "s1" } } });
  });

  it("replaces the invite code", async () => {
    const prisma = {
      household: {
        update: jest.fn(async (args: { data: { inviteCode: string } }) => ({
          id: "h1",
          name: "Notre canapé",
          inviteCode: args.data.inviteCode,
          providerIds: [],
          members: [],
        })),
      },
    };
    const service = new HouseholdService(prisma as unknown as PrismaService);

    const household = await service.regenerateInviteCode("h1");

    expect(prisma.household.update.mock.calls[0][0]).toMatchObject({ where: { id: "h1" } });
    expect(household.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});
