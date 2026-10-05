import { NotFoundException } from "@nestjs/common";
import type { TitleSummary } from "@canape/shared";
import type { CatalogService } from "../catalog/catalog.service";
import type { PrismaService } from "../prisma/prisma.service";
import { DECK_PAGES, DECK_SIZE, MatchService } from "./match.service";

const me = { memberId: "me", householdId: "h1" };
const keys = (ids: number[]) => ids.map((id) => `movie/${id}`);
const session = {
  id: "s1",
  householdId: "h1",
  filters: { mediaType: "movie", genres: [35] },
  createdById: "me",
  createdAt: new Date(),
  deck: keys([1, 2, 3, 4, 5]) as unknown,
};

const title = (tmdbId: number): TitleSummary => ({
  tmdbId,
  mediaType: "movie",
  title: `T${tmdbId}`,
  year: 2020,
  posterUrl: null,
  rating: 7,
  voteCount: 100,
  genreIds: [35],
  runtime: 100,
  overview: "",
  offers: [],
});

function setup({
  active = session as typeof session | null,
  votes = [] as { memberId: string; mediaType: string; tmdbId: number; liked: boolean }[],
  watched = [] as { mediaType: string; tmdbId: number }[],
  memberCount = 2,
  likeCount = 0,
  drawn = [1, 2, 3, 4, 5],
} = {}) {
  const prisma = {
    matchSession: {
      findFirst: jest.fn(async (_args: unknown) => active),
      updateMany: jest.fn((_args: unknown) => "close"),
      create: jest.fn((_args: unknown) => "create"),
      update: jest.fn(async (_args: unknown) => undefined),
    },
    matchVote: {
      findMany: jest.fn(async (_args: unknown) => votes),
      upsert: jest.fn(async (_args: unknown) => undefined),
      count: jest.fn(async (_args: unknown) => likeCount),
      groupBy: jest.fn(async (_args: unknown) => []),
    },
    member: { count: jest.fn(async (_args: unknown) => memberCount) },
    household: { findUniqueOrThrow: jest.fn(async (_args: unknown) => ({ providerIds: [8] })) },
    watched: { findMany: jest.fn(async (_args: unknown) => watched) },
    $transaction: jest.fn(async (_ops: unknown[]) => [undefined, { ...session, id: "s2" }]),
  };
  const catalog = {
    discoverRefs: jest.fn(async (_query: unknown, _language: string, _pages: number) =>
      drawn.map((tmdbId) => ({ mediaType: "movie", tmdbId })),
    ),
    getSummaries: jest.fn(async (refs: { tmdbId: number }[]) => refs.map((r) => title(r.tmdbId))),
  };
  const service = new MatchService(prisma as unknown as PrismaService, catalog as unknown as CatalogService);
  return { service, prisma, catalog };
}

describe("MatchService.deck", () => {
  it("puts titles the partner liked first, then the evening's deck order", async () => {
    const { service, catalog } = setup({
      votes: [
        { memberId: "partner", mediaType: "movie", tmdbId: 4, liked: true },
        { memberId: "partner", mediaType: "movie", tmdbId: 2, liked: false },
      ],
    });

    const deck = await service.deck(me, "fr");

    expect(deck.items.map((t) => t.tmdbId)).toEqual([4, 1, 2, 3, 5]);
    // The stored deck is served as is: no discover scan per request.
    expect(catalog.discoverRefs).not.toHaveBeenCalled();
    expect(catalog.getSummaries).toHaveBeenCalledTimes(1);
  });

  it("skips titles I already voted on and titles anyone has seen", async () => {
    const { service } = setup({
      votes: [{ memberId: "me", mediaType: "movie", tmdbId: 1, liked: false }],
      watched: [{ mediaType: "movie", tmdbId: 3 }],
    });

    const deck = await service.deck(me, "fr");

    expect(deck.items.map((t) => t.tmdbId)).toEqual([2, 4, 5]);
  });

  it("serves DECK_SIZE cards at a time, further down the deck once voted", async () => {
    const ids = Array.from({ length: 40 }, (_, i) => i + 1);
    const { service } = setup({
      active: { ...session, deck: keys(ids) },
      votes: ids.slice(0, 20).map((tmdbId) => ({ memberId: "me", mediaType: "movie", tmdbId, liked: false })),
    });

    const deck = await service.deck(me, "fr");

    expect(deck.items.map((t) => t.tmdbId)).toEqual(ids.slice(20, 20 + DECK_SIZE));
  });

  it("draws and stores the deck of an evening started before decks were stored", async () => {
    const { service, prisma, catalog } = setup({ active: { ...session, deck: [] }, drawn: [7, 8] });

    const deck = await service.deck(me, "fr");

    expect(catalog.discoverRefs).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "movie", genres: [35], providers: [8], sort: "popularity" }),
      "fr",
      DECK_PAGES,
    );
    expect(prisma.matchSession.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { deck: keys([7, 8]) } });
    expect(deck.items.map((t) => t.tmdbId)).toEqual([7, 8]);
  });

  it("requires an active evening", async () => {
    const { service } = setup({ active: null });
    await expect(service.deck(me, "fr")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("MatchService.vote", () => {
  const like = { mediaType: "movie" as const, tmdbId: 42, liked: true };

  it("reports a match when every member liked the title", async () => {
    const { service, prisma } = setup({ likeCount: 2, memberCount: 2 });

    const result = await service.vote(me, like, "fr");

    expect(result.match?.tmdbId).toBe(42);
    expect(prisma.matchVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sessionId: "s1", memberId: "me", liked: true }) }),
    );
  });

  it("is not a match while someone hasn't liked it yet", async () => {
    const { service } = setup({ likeCount: 1, memberCount: 2 });
    expect((await service.vote(me, like, "fr")).match).toBeNull();
  });

  it("never matches alone", async () => {
    const { service } = setup({ likeCount: 1, memberCount: 1 });
    expect((await service.vote(me, like, "fr")).match).toBeNull();
  });

  it("does not look for a match on a dislike", async () => {
    const { service, prisma } = setup({ likeCount: 2 });
    expect((await service.vote(me, { ...like, liked: false }, "fr")).match).toBeNull();
    expect(prisma.matchVote.count).not.toHaveBeenCalled();
  });
});

describe("MatchService.start", () => {
  it("closes the previous evening and opens a new one atomically", async () => {
    const { service, prisma } = setup();

    const started = await service.start(me, { mediaType: "tv", genres: [] });

    expect(prisma.matchSession.updateMany).toHaveBeenCalledWith({
      where: { householdId: "h1", closedAt: null },
      data: { closedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(["close", "create"]);
    expect(started.id).toBe("s2");
  });

  it("draws the deck once, with the household's platforms", async () => {
    const { service, prisma, catalog } = setup({ drawn: [10, 11] });

    await service.start(me, { mediaType: "tv", genres: [18] });

    expect(catalog.discoverRefs).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "tv", genres: [18], providers: [8], sort: "popularity" }),
      "fr",
      DECK_PAGES,
    );
    expect(prisma.matchSession.create.mock.calls[0][0]).toMatchObject({ data: { deck: keys([10, 11]) } });
  });
});

describe("MatchService.end", () => {
  it("closes the household's open evening", async () => {
    const { service, prisma } = setup();

    await service.end(me);

    expect(prisma.matchSession.updateMany).toHaveBeenCalledWith({
      where: { householdId: "h1", closedAt: null },
      data: { closedAt: expect.any(Date) },
    });
  });
});
