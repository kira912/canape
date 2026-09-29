import { ConflictException } from "@nestjs/common";
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
