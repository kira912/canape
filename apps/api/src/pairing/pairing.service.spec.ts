import { ConflictException, GoneException, NotFoundException } from "@nestjs/common";
import type { HouseholdService } from "../household/household.service";
import { hashToken } from "../household/tokens";
import type { PrismaService } from "../prisma/prisma.service";
import { PairingService } from "./pairing.service";

const NOW = new Date("2026-10-01T10:00:00Z");
const LATER = new Date("2026-10-01T10:05:00Z");

type Row = {
  id: string;
  secretHash: string;
  device: string;
  memberId: string | null;
  member: { householdId: string } | null;
  approvedAt: Date | null;
  claimedAt: Date | null;
  expiresAt: Date;
};

function setup(row: Partial<Row> | null, updated = 1) {
  const pairing: Row | null = row && {
    id: "p1",
    secretHash: hashToken("secret"),
    device: "Chrome · macOS",
    memberId: null,
    member: null,
    approvedAt: null,
    claimedAt: null,
    expiresAt: LATER,
    ...row,
  };
  const prisma = {
    devicePairing: {
      create: jest.fn(async ({ data }: { data: Partial<Row> }) => ({ id: "p1", ...data })),
      findUnique: jest.fn(async (_args: unknown) => pairing),
      updateMany: jest.fn(async (_args: unknown) => ({ count: updated })),
    },
  };
  const households = {
    openSession: jest.fn(async (memberId: string) => ({ token: "t", memberId, household: {} })),
  };
  const service = new PairingService(prisma as unknown as PrismaService, households as unknown as HouseholdService);
  return { service, prisma, households };
}

describe("PairingService", () => {
  it("creates a 5-minute pairing and keeps only the secret's hash", async () => {
    const { service, prisma } = setup(null);
    const pairing = await service.create("Mozilla/5.0 (Macintosh) Chrome/129.0 Safari/537.36", NOW);
    const data = prisma.devicePairing.create.mock.calls[0][0].data;
    expect(data.secretHash).toBe(hashToken(pairing.secret));
    expect(data.device).toBe("Chrome · macOS");
    expect(pairing.expiresAt).toBe(LATER.toISOString());
  });

  it("approves an open pairing for the signed-in member", async () => {
    const { service, prisma } = setup({});
    await service.approve("p1", "m1", NOW);
    expect(prisma.devicePairing.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", approvedAt: null, expiresAt: { gt: NOW } },
      data: { memberId: "m1", approvedAt: NOW },
    });
  });

  it("refuses to approve an expired or already approved pairing", async () => {
    await expect(setup({ expiresAt: NOW }).service.approve("p1", "m1", NOW)).rejects.toBeInstanceOf(GoneException);
    await expect(setup({ approvedAt: NOW }).service.approve("p1", "m1", NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({}, 0).service.approve("p1", "m1", NOW)).rejects.toBeInstanceOf(ConflictException);
  });

  it("keeps the new device waiting until approval", async () => {
    const { service } = setup({});
    await expect(service.claim("p1", "secret", NOW)).resolves.toEqual({ status: "pending" });
  });

  it("hands the session over once, to the holder of the secret only", async () => {
    const approved = { approvedAt: NOW, memberId: "m1", member: { householdId: "h1" } };
    await expect(setup(approved).service.claim("p1", "wrong", NOW)).rejects.toBeInstanceOf(NotFoundException);

    const { service, households } = setup(approved);
    const status = await service.claim("p1", "secret", NOW);
    expect(status.status).toBe("approved");
    expect(households.openSession).toHaveBeenCalledWith("m1", "h1");

    await expect(setup({ ...approved, claimedAt: NOW }).service.claim("p1", "secret", NOW)).rejects.toBeInstanceOf(
      GoneException,
    );
    await expect(setup(approved, 0).service.claim("p1", "secret", NOW)).rejects.toBeInstanceOf(GoneException);
  });

  it("tells the new device when its QR expired unapproved", async () => {
    await expect(setup({ expiresAt: NOW }).service.claim("p1", "secret", NOW)).rejects.toBeInstanceOf(GoneException);
  });
});
