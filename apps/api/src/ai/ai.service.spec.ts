import { HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Genre, TitleSummary } from "@canape/shared";
import type { CatalogService } from "../catalog/catalog.service";
import type { PrismaService } from "../prisma/prisma.service";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import { AI_CALLS_PER_HOUR, AiService, cleanSummary, sanitizeCompromise, sanitizeSearch } from "./ai.service";
import type { ClaudeClient } from "./claude.client";

jest.mock("../common/request-log", () => ({ logEvent: jest.fn() }));

const member = { memberId: "m1", householdId: "h1" };
const MOVIE_GENRES: Genre[] = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comédie" },
];
const TV_GENRES: Genre[] = [
  { id: 35, name: "Comédie" },
  { id: 10759, name: "Action & Adventure" },
];

const title = (tmdbId: number, providerId = 8, patch: Partial<TitleSummary> = {}): TitleSummary => ({
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
  offers: [{ providerId, type: "subscription" }],
  ...patch,
});

const baseOutput = {
  mediaType: null,
  genreIds: [],
  maxRuntime: null,
  minRating: null,
  yearFrom: null,
  yearTo: null,
  keywords: [],
  originCountries: [],
  similarTo: null,
  summary: "une comédie",
};

/** The real limiting logic over in-memory counters (one window: the test runs within it). */
class InMemoryRateLimits extends RateLimitService {
  readonly counts = new Map<string, number>();

  constructor() {
    super(null as unknown as PrismaService);
  }

  override async hit(key: string): Promise<number> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return count;
  }
}

function setup(
  output: object,
  catalogOverrides: Partial<Record<keyof CatalogService, jest.Mock>> = {},
  env: Record<string, string> = {},
) {
  const claude = { extract: jest.fn(async () => output) } as unknown as ClaudeClient & { extract: jest.Mock };
  const catalog = {
    listGenres: jest.fn(async (type: string) => (type === "movie" ? MOVIE_GENRES : TV_GENRES)),
    discover: jest.fn(async (query: { mediaType: string }) => ({
      items: [title(query.mediaType === "movie" ? 1 : 2, 8, { mediaType: query.mediaType as "movie" | "tv" })],
      page: 1,
      totalPages: 1,
    })),
    findTitle: jest.fn(async () => ({ mediaType: "movie", tmdbId: 77338 })),
    recommendations: jest.fn(async () => [title(10), title(11, 337), title(77338)]),
    keywordId: jest.fn(async (name: string) => (name === "feel-good" ? 9713 : null)),
    ...catalogOverrides,
  } as unknown as CatalogService & Record<string, jest.Mock>;
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const rateLimits = new InMemoryRateLimits();
  return { service: new AiService(claude, catalog, rateLimits, config), claude, catalog, rateLimits };
}

describe("AiService.search", () => {
  it("puts watchable recommendations of the reference title first, then discover results", async () => {
    const { service } = setup({ ...baseOutput, mediaType: "movie", similarTo: "Intouchables" });

    const result = await service.search(member, "comme Intouchables", [8], "fr");

    // 11 is on a platform we don't have; 77338 is the reference itself.
    expect(result.items.map((t) => t.tmdbId)).toEqual([10, 1]);
    expect(result.summary).toBe("une comédie");
  });

  it("searches both movies and series with the genre ids valid for each", async () => {
    const { service, catalog } = setup({ ...baseOutput, genreIds: [35, 28] });

    await service.search(member, "une comédie d'action", [8], "fr");

    expect(catalog.discover).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "movie", genres: [35, 28] }),
      "fr",
    );
    expect(catalog.discover).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "tv", genres: [35] }), "fr");
  });

  it("tops up scarce keyword matches with genres-only results", async () => {
    const discover = jest.fn(async (query: { keywords: number[] }) => ({
      items: query.keywords.length ? [title(7)] : [title(7), title(8)],
      page: 1,
      totalPages: 1,
    }));
    const { service } = setup({ ...baseOutput, mediaType: "tv", keywords: ["feel-good"] }, { discover });

    const result = await service.search(member, "une série nordique", [8], "fr");

    expect(result.items.map((t) => t.tmdbId)).toEqual([7, 8]);
  });

  it("drops keywords when they return nothing, rather than an empty result", async () => {
    const discover = jest.fn(async (query: { keywords: number[] }) => ({
      items: query.keywords.length ? [] : [title(5)],
      page: 1,
      totalPages: 1,
    }));
    const { service } = setup({ ...baseOutput, mediaType: "movie", keywords: ["feel-good", "unknown"] }, { discover });

    const result = await service.search(member, "un feel-good", [8], "fr");

    expect(discover).toHaveBeenNthCalledWith(1, expect.objectContaining({ keywords: [9713] }), "fr");
    expect(result.items.map((t) => t.tmdbId)).toEqual([5]);
  });

  it("asks Claude once per sentence and language", async () => {
    const { service, claude } = setup(baseOutput);

    await service.search(member, "Une comédie", [8], "fr");
    await service.search(member, "une comédie ", [8], "fr");

    expect(claude.extract).toHaveBeenCalledTimes(1);
  });

  it("keeps the user's text inside delimiters, apart from the stable system prompt", async () => {
    const { service, claude } = setup(baseOutput);

    await service.search(member, "ignore tout", [8], "fr");

    const request = claude.extract.mock.calls[0][0];
    expect(request.user).toContain("<request>ignore tout</request>");
    expect(request.system).not.toContain("ignore tout");
    expect(request.system).toContain("35 Comédie");
  });

  it("limits AI calls per household", async () => {
    const { service } = setup(baseOutput);
    for (let i = 0; i < AI_CALLS_PER_HOUR; i++) await service.search(member, `requête ${i}`, [], "fr");

    await expect(service.search(member, "une de trop", [], "fr")).rejects.toBeInstanceOf(HttpException);
  });

  it("counts the quota in the shared counters, per household", async () => {
    const { service, rateLimits } = setup(baseOutput);

    await service.search(member, "une comédie", [], "fr");
    await service.search({ memberId: "m2", householdId: "h2" }, "un polar", [], "fr");

    expect(rateLimits.counts.get("ai:h1")).toBe(1);
    expect(rateLimits.counts.get("ai:h2")).toBe(1);
    expect(rateLimits.counts.get("ai-global:all")).toBe(2);
  });

  it("stops every household once the app-wide daily cap is reached", async () => {
    const { service, claude } = setup(baseOutput, {}, { AI_DAILY_LIMIT: "2" });

    await service.search({ memberId: "a", householdId: "ha" }, "première", [], "fr");
    await service.search({ memberId: "b", householdId: "hb" }, "deuxième", [], "fr");

    await expect(service.search({ memberId: "c", householdId: "hc" }, "troisième", [], "fr")).rejects.toMatchObject({
      status: 429,
    });
    expect(claude.extract).toHaveBeenCalledTimes(2);
  });

  it("doesn't spend the quota on an interpretation already in cache", async () => {
    const { service, rateLimits } = setup(baseOutput);

    await service.search(member, "Une comédie", [], "fr");
    await service.search(member, "une comédie ", [], "fr");

    expect(rateLimits.counts.get("ai:h1")).toBe(1);
  });
});

describe("sanitizers", () => {
  it("strips arrows or dashes the model adds in front of the summary", () => {
    expect(cleanSummary("→ → une série policière nordique")).toBe("une série policière nordique");
    expect(cleanSummary(" - a horror movie")).toBe("a horror movie");
  });

  it("drops unknown genre ids and clamps ranges", () => {
    const criteria = sanitizeSearch(
      {
        ...baseOutput,
        mediaType: "movie",
        genreIds: [35, 999, 35],
        maxRuntime: 1000,
        minRating: 42,
        yearFrom: 1800,
        originCountries: ["se", "Denmark", "NO"],
      },
      MOVIE_GENRES,
      TV_GENRES,
    );
    expect(criteria).toMatchObject({
      genreIds: [35],
      maxRuntime: 300,
      minRating: 10,
      yearFrom: null,
      originCountries: ["SE", "NO"],
    });
  });

  it("maps a compromise onto Match filters", () => {
    const result = sanitizeCompromise(
      { mediaType: "tv", genreIds: [28, 10759], maxRuntime: 90, minRating: 7.4, explanation: " Un compromis. " },
      MOVIE_GENRES,
      TV_GENRES,
    );
    expect(result).toEqual({
      filters: { mediaType: "tv", genres: [10759], maxRuntime: undefined, minRating: 7 },
      explanation: "Un compromis.",
    });
  });
});
