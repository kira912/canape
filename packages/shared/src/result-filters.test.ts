import { describe, expect, it } from "vitest";
import type { TitleSummary } from "./catalog";
import { filterTitles, sortTitles } from "./result-filters";

const title = (id: number, patch: Partial<TitleSummary>): TitleSummary => ({
  tmdbId: id,
  mediaType: "movie",
  title: `T${id}`,
  year: 2000,
  posterUrl: null,
  rating: 7,
  voteCount: 1000,
  genreIds: [],
  runtime: 100,
  overview: "",
  offers: [],
  ...patch,
});

const ids = (items: TitleSummary[]) => items.map((i) => i.tmdbId);

describe("sortTitles", () => {
  it("ranks well-voted ratings above noisy ones", () => {
    const items = [
      title(1, { rating: 6.5 }),
      title(2, { rating: 9.8, voteCount: 3 }),
      title(3, { rating: 8.1 }),
      title(4, { rating: null }),
    ];
    expect(ids(sortTitles(items, "rating"))).toEqual([3, 1, 2, 4]);
  });

  it("sorts by shortest runtime, unknown runtimes last", () => {
    const items = [title(1, { runtime: 150 }), title(2, { runtime: null }), title(3, { runtime: 85 })];
    expect(ids(sortTitles(items, "shortest"))).toEqual([3, 1, 2]);
  });

  it("sorts by most recent and keeps relevance order on ties", () => {
    const items = [title(1, { year: 2010 }), title(2, { year: 2024 }), title(3, { year: 2010 })];
    expect(ids(sortTitles(items, "recent"))).toEqual([2, 1, 3]);
    expect(ids(sortTitles(items, "relevance"))).toEqual([1, 2, 3]);
  });
});

describe("filterTitles", () => {
  it("applies the runtime cap to movies only", () => {
    const items = [
      title(1, { runtime: 150 }),
      title(2, { runtime: 95 }),
      title(3, { mediaType: "tv", runtime: 45 }),
      title(4, { runtime: null }),
    ];
    expect(ids(filterTitles(items, { maxRuntime: 120 }))).toEqual([2, 3]);
  });

  it("filters by type and minimum rating", () => {
    const items = [title(1, { rating: 8 }), title(2, { mediaType: "tv", rating: 8 }), title(3, { rating: 6 })];
    expect(ids(filterTitles(items, { mediaType: "movie", minRating: 7 }))).toEqual([1]);
  });

  it("keeps titles matching any selected genre", () => {
    const items = [title(1, { genreIds: [35, 18] }), title(2, { genreIds: [28] }), title(3, { genreIds: [] })];
    expect(ids(filterTitles(items, { genreIds: [18, 99] }))).toEqual([1]);
    expect(ids(filterTitles(items, { genreIds: [] }))).toEqual([1, 2, 3]);
  });
});
