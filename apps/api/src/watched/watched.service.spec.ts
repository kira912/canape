import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { WatchedService } from "./watched.service";

const me = { memberId: "11111111-1111-4111-8111-111111111111", householdId: "h1" };
const partner = "22222222-2222-4222-8222-222222222222";

function setup({ memberInHousehold = true, rows = [] as object[] } = {}) {
  const prisma = {
    watched: {
      findMany: jest.fn(async (_args: unknown) => rows),
      upsert: jest.fn(async (_args: unknown) => undefined),
      deleteMany: jest.fn(async (_args: unknown) => undefined),
    },
    member: { findFirst: jest.fn(async (_args: unknown) => (memberInHousehold ? { id: partner } : null)) },
  };
  return { service: new WatchedService(prisma as unknown as PrismaService), prisma };
}

describe("WatchedService", () => {
  it("lets a member tick a title for their partner", async () => {
    const { service, prisma } = setup();

    await service.mark(me, { mediaType: "movie", tmdbId: 42, memberId: partner });

    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { id: partner, householdId: "h1" },
      select: { id: true },
    });
    expect(prisma.watched.upsert.mock.calls[0][0]).toMatchObject({
      create: { householdId: "h1", memberId: partner, mediaType: "movie", tmdbId: 42 },
    });
  });

  it("refuses members of another household", async () => {
    const { service, prisma } = setup({ memberInHousehold: false });

    await expect(service.mark(me, { mediaType: "movie", tmdbId: 42, memberId: partner })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.watched.upsert).not.toHaveBeenCalled();
  });

  it("only unmarks inside the caller's household", async () => {
    const { service, prisma } = setup();

    await service.unmark(me, { mediaType: "tv", tmdbId: 7, memberId: partner });

    expect(prisma.watched.deleteMany).toHaveBeenCalledWith({
      where: { householdId: "h1", memberId: partner, mediaType: "tv", tmdbId: 7 },
    });
  });

  it("groups watchers by title", async () => {
    const { service } = setup({
      rows: [
        { mediaType: "movie", tmdbId: 1, memberId: me.memberId },
        { mediaType: "tv", tmdbId: 2, memberId: partner },
        { mediaType: "movie", tmdbId: 1, memberId: partner },
      ],
    });

    expect(await service.list(me)).toEqual({
      items: [
        { mediaType: "movie", tmdbId: 1, memberIds: [me.memberId, partner] },
        { mediaType: "tv", tmdbId: 2, memberIds: [partner] },
      ],
    });
  });
});
