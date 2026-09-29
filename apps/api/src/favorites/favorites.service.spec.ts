import type { TitleSummary } from "@canape/shared";
import type { CatalogService } from "../catalog/catalog.service";
import type { PrismaService } from "../prisma/prisma.service";
import { FavoritesService } from "./favorites.service";

const member = { memberId: "m1", householdId: "h1" };

const summary = (tmdbId: number): TitleSummary => ({
  tmdbId,
  mediaType: "movie",
  title: `T${tmdbId}`,
  year: 2020,
  posterUrl: null,
  rating: 7,
  voteCount: 100,
  genreIds: [],
  runtime: 100,
  overview: "",
  offers: [],
});

function setup(rows: object[] = [], titles: TitleSummary[] = []) {
  const prisma = {
    favorite: { findMany: jest.fn(async (_args: { where: unknown }) => rows), upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const catalog = { getSummaries: jest.fn(async () => titles) };
  const service = new FavoritesService(prisma as unknown as PrismaService, catalog as unknown as CatalogService);
  return { service, prisma, catalog };
}

describe("FavoritesService", () => {
  it("stores personal favorites under the member's own list key", async () => {
    const { service, prisma } = setup();

    await service.add(member, { list: "me", mediaType: "movie", tmdbId: 42 });
    await service.add(member, { list: "household", mediaType: "tv", tmdbId: 7 });

    expect(prisma.favorite.upsert.mock.calls[0][0].create).toMatchObject({ listKey: "m1", ownerId: "m1", addedById: "m1" });
    expect(prisma.favorite.upsert.mock.calls[1][0].create).toMatchObject({ listKey: "household", ownerId: null });
  });

  it("only removes from the requested list", async () => {
    const { service, prisma } = setup();

    await service.remove(member, { list: "me", mediaType: "movie", tmdbId: 42 });

    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { householdId: "h1", listKey: "m1", mediaType: "movie", tmdbId: 42 },
    });
  });

  it("splits both lists and skips titles TMDB could not resolve", async () => {
    const createdAt = new Date("2026-09-29T10:00:00Z");
    const { service, prisma } = setup(
      [
        { listKey: "household", mediaType: "movie", tmdbId: 1, addedById: "m2", createdAt },
        { listKey: "m1", mediaType: "movie", tmdbId: 2, addedById: "m1", createdAt },
        { listKey: "household", mediaType: "movie", tmdbId: 3, addedById: "m1", createdAt },
      ],
      [summary(1), summary(2)],
    );

    const favorites = await service.list(member, "fr");

    expect(prisma.favorite.findMany.mock.calls[0][0].where).toEqual({
      householdId: "h1",
      listKey: { in: ["household", "m1"] },
    });
    expect(favorites.household).toEqual([{ title: summary(1), addedBy: "m2", addedAt: createdAt.toISOString() }]);
    expect(favorites.mine.map((f) => f.title.tmdbId)).toEqual([2]);
  });
});
