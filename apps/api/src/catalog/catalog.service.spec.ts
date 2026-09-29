import type { TmdbClient } from "../tmdb/tmdb.client";
import type { LinksService } from "../links/links.service";
import { CatalogService } from "./catalog.service";

const NETFLIX = { provider_id: 8, provider_name: "Netflix", logo_path: "/n.png" };
const PRIME = { provider_id: 119, provider_name: "Amazon Prime Video", logo_path: "/p.png" };
const DISNEY = { provider_id: 337, provider_name: "Disney Plus", logo_path: "/d.png" };

function fakeTmdb(routes: Record<string, unknown>) {
  const get = jest.fn(async (path: string) => {
    if (!(path in routes)) throw new Error(`unexpected TMDB call ${path}`);
    return routes[path];
  });
  return { get } as unknown as TmdbClient & { get: jest.Mock };
}

const links = { buildWatchOptions: jest.fn(async () => []) } as unknown as LinksService;

describe("CatalogService.search", () => {
  const routes = {
    "/search/multi": {
      page: 1,
      total_pages: 1,
      results: [
        { id: 1, media_type: "movie", title: "Dune", release_date: "2021-09-15", vote_average: 7.8, vote_count: 9000 },
        { id: 2, media_type: "person", name: "Denis Villeneuve" },
        { id: 3, media_type: "tv", name: "Dune: Prophecy", first_air_date: "2024-11-17" },
        { id: 4, media_type: "movie", title: "Dune (1984)", release_date: "1984-12-14" },
      ],
    },
    "/movie/1": { id: 1, runtime: 155, genres: [{ id: 878, name: "Science-Fiction" }], "watch/providers": { results: { FR: { flatrate: [NETFLIX], rent: [PRIME] } } } },
    "/tv/3": {
      id: 3,
      episode_run_time: [],
      last_episode_to_air: { runtime: 58 },
      "watch/providers": { results: { FR: { flatrate: [DISNEY] } } },
    },
    "/movie/4": { id: 4, "watch/providers": { results: { US: { flatrate: [NETFLIX] } } } },
  };

  it("keeps only household-watchable titles in `available` and drops people", async () => {
    const service = new CatalogService(fakeTmdb(routes), links);

    const result = await service.search("dune", [8, 119], "fr");

    expect(result.available.map((t) => t.tmdbId)).toEqual([1]);
    expect(result.available[0]).toMatchObject({
      title: "Dune",
      year: 2021,
      mediaType: "movie",
      runtime: 155,
      genreIds: [878],
      offers: [
        { providerId: 8, type: "subscription" },
        { providerId: 119, type: "rent" },
      ],
    });
    // Disney not owned; the 1984 movie isn't streamable in France at all.
    expect(result.elsewhere.map((t) => t.tmdbId)).toEqual([3, 4]);
    expect(result.elsewhere[0].runtime).toBe(58); // series: episode length
  });

  it("does not treat a rent-only offer on an owned platform as available", async () => {
    const service = new CatalogService(fakeTmdb(routes), links);

    const result = await service.search("dune", [119], "fr");

    expect(result.available).toEqual([]);
  });

  it("caches per-title details across searches", async () => {
    const tmdb = fakeTmdb(routes);
    const service = new CatalogService(tmdb, links);

    await service.search("dune", [8], "fr");
    await service.search("Dune", [119], "fr");

    const providerCalls = tmdb.get.mock.calls.filter(([path]) => path === "/movie/1");
    expect(providerCalls).toHaveLength(1);
  });
});

describe("CatalogService.getTitle", () => {
  it("returns per-season availability for series, skipping specials", async () => {
    const tmdb = fakeTmdb({
      "/tv/10": {
        id: 10,
        name: "The Office",
        first_air_date: "2005-03-24",
        genres: [{ id: 35, name: "Comédie" }],
        number_of_seasons: 2,
        episode_run_time: [22],
        seasons: [
          { season_number: 0, name: "Bonus", episode_count: 3, air_date: null },
          { season_number: 1, name: "Saison 1", episode_count: 6, air_date: "2005-03-24" },
          { season_number: 2, name: "Saison 2", episode_count: 22, air_date: "2005-09-20" },
        ],
        videos: { results: [{ site: "YouTube", type: "Trailer", key: "abc", iso_639_1: "en" }] },
        "watch/providers": { results: { FR: { link: "https://tmdb/watch", flatrate: [PRIME] } } },
      },
      "/tv/10/season/1/watch/providers": { results: { FR: { flatrate: [PRIME] } } },
      "/tv/10/season/2/watch/providers": { results: { FR: { buy: [PRIME] } } },
    });
    const service = new CatalogService(tmdb, links);

    const title = await service.getTitle("tv", 10, "fr");

    expect(title.runtime).toBe(22);
    expect(title.trailerUrl).toBe("https://www.youtube.com/watch?v=abc");
    expect(title.seasons).toEqual([
      { seasonNumber: 1, name: "Saison 1", episodeCount: 6, year: 2005, offers: [{ providerId: 119, type: "subscription" }] },
      { seasonNumber: 2, name: "Saison 2", episodeCount: 22, year: 2005, offers: [{ providerId: 119, type: "buy" }] },
    ]);
    expect(links.buildWatchOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "The Office", fallbackLink: "https://tmdb/watch" }),
    );
  });
});

describe("CatalogService.discover", () => {
  it("returns nothing without platforms instead of querying all of TMDB", async () => {
    const tmdb = fakeTmdb({});
    const service = new CatalogService(tmdb, links);

    const result = await service.discover(
      { mediaType: "movie", providers: [], genres: [], sort: "popularity", page: 1 },
      "fr",
    );

    expect(result.items).toEqual([]);
    expect(tmdb.get).not.toHaveBeenCalled();
  });

  it("passes platform, genre and runtime filters to TMDB discover", async () => {
    const tmdb = fakeTmdb({
      "/discover/movie": { page: 1, total_pages: 3, results: [{ id: 1, title: "Dune" }] },
      "/movie/1": { id: 1, "watch/providers": { results: { FR: { flatrate: [NETFLIX] } } } },
    });
    const service = new CatalogService(tmdb, links);

    const result = await service.discover({
      mediaType: "movie",
      providers: [8, 119],
      genres: [35, 18],
      maxRuntime: 120,
      sort: "rating",
      page: 1,
    }, "en");

    expect(result).toMatchObject({ page: 1, totalPages: 3, items: [{ tmdbId: 1 }] });
    expect(tmdb.get).toHaveBeenCalledWith(
      "/discover/movie",
      expect.objectContaining({
        with_watch_providers: "8|119",
        with_watch_monetization_types: "flatrate|free|ads",
        with_genres: "35|18",
        "with_runtime.lte": 120,
        sort_by: "vote_average.desc",
        watch_region: "FR",
        language: "en-US",
      }),
    );
  });
});
