import type { PrismaService } from "../prisma/prisma.service";
import { INACTIVITY_DAYS, RetentionService } from "./retention.service";

describe("RetentionService.purgeInactive", () => {
  it("deletes stale sessions, then old households left without any session", async () => {
    const prisma = {
      session: { deleteMany: jest.fn(async (_args: unknown) => ({ count: 3 })) },
      household: { deleteMany: jest.fn(async (_args: unknown) => ({ count: 1 })) },
      devicePairing: { deleteMany: jest.fn(async (_args: unknown) => ({ count: 2 })) },
    };
    const service = new RetentionService(prisma as unknown as PrismaService);
    const now = new Date("2026-10-01T00:00:00Z");

    const result = await service.purgeInactive(now);

    const cutoff = new Date(now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { lastUsedAt: { lt: cutoff } } });
    expect(prisma.household.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff }, members: { none: { sessions: { some: {} } } } },
    });
    expect(prisma.session.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.household.deleteMany.mock.invocationCallOrder[0],
    );
    expect(prisma.devicePairing.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    expect(result).toEqual({ sessions: 3, households: 1, pairings: 2 });
  });
});
