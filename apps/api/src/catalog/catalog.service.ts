import { Injectable } from "@nestjs/common";
import {
  REGION,
  TMDB_LOCALES,
  type AppLanguage,
  partitionByAvailability,
  type DiscoverQuery,
  type DiscoverResponse,
  type Genre,
  type MediaType,
  type Provider,
  type SearchResponse,
  type SeasonAvailability,
  type TitleDetail,
  type TitleSummary,
} from "@canape/shared";
import { HOUR, TtlCache } from "../common/ttl-cache";
import { LinksService } from "../links/links.service";
import { TmdbClient } from "../tmdb/tmdb.client";
import {
  imageUrl,
  trailerCandidates,
  toCast,
  type Trailer,
  providersIn,
  toOffers,
  toProvider,
  toTitleSummary,
  yearOf,
} from "../tmdb/tmdb.mapper";
import type {
  TmdbDetail,
  TmdbListItem,
  TmdbPage,
  TmdbProviderEntry,
  TmdbRegionProviders,
  TmdbWatchProviders,
} from "../tmdb/tmdb.types";

/** TMDB returns 20 results per page; one page is plenty for a title search. */
const SEARCH_MAX_RESULTS = 20;
/** Filters out obscure entries so "best rated" isn't topped by 3 votes at 10/10. */
const DISCOVER_MIN_VOTES = 100;

const SORT_BY: Record<DiscoverQuery["sort"], Record<MediaType, string>> = {
  popularity: { movie: "popularity.desc", tv: "popularity.desc" },
  rating: { movie: "vote_average.desc", tv: "vote_average.desc" },
  recent: { movie: "primary_release_date.desc", tv: "first_air_date.desc" },
};

@Injectable()
export class CatalogService {
  private readonly cache = new TtlCache();

  constructor(
    private readonly tmdb: TmdbClient,
    private readonly links: LinksService,
  ) {}

  /** Every platform available in the region, in TMDB's regional display order. */
  listProviders(language: AppLanguage): Promise<Provider[]> {
    return this.cache.getOrLoad(`providers/${language}`, 24 * HOUR, async () => {
      const lists = await Promise.all(
        (["movie", "tv"] as const).map((type) =>
          this.tmdb.get<{ results: TmdbProviderEntry[] }>(`/watch/providers/${type}`, {
            watch_region: REGION,
            language: TMDB_LOCALES[language],
          }),
        ),
      );
      const byId = new Map<number, TmdbProviderEntry>();
      for (const entry of lists.flatMap((l) => l.results)) byId.set(entry.provider_id, entry);
      const priority = (e: TmdbProviderEntry) => e.display_priorities?.[REGION] ?? e.display_priority ?? 999;
      return [...byId.values()].sort((a, b) => priority(a) - priority(b)).map(toProvider);
    });
  }

  listGenres(mediaType: MediaType, language: AppLanguage): Promise<Genre[]> {
    return this.cache.getOrLoad(`genres/${mediaType}/${language}`, 24 * HOUR, async () => {
      const { genres } = await this.tmdb.get<{ genres: Genre[] }>(`/genre/${mediaType}/list`, {
        language: TMDB_LOCALES[language],
      });
      return genres;
    });
  }

  /**
   * TMDB's text search can't filter by platform, so each hit is enriched with
   * its regional offers (cached) and then split available / elsewhere.
   */
  async search(query: string, householdProviderIds: number[], language: AppLanguage): Promise<SearchResponse> {
    const page = await this.cache.getOrLoad(`search/${language}/${query.toLowerCase()}`, HOUR, () =>
      this.tmdb.get<TmdbPage<TmdbListItem>>("/search/multi", {
        query,
        language: TMDB_LOCALES[language],
        region: REGION,
        include_adult: false,
      }),
    );
    const hits = page.results
      .filter((r): r is TmdbListItem & { media_type: MediaType } => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, SEARCH_MAX_RESULTS);
    const items = await this.withOffers(
      hits.map((hit) => ({ item: hit, mediaType: hit.media_type })),
      language,
    );
    return partitionByAvailability(items, householdProviderIds);
  }

  /**
   * Browsing without a title. TMDB's discover endpoint filters by platform
   * natively, so every result is watchable on at least one household platform.
   */
  async discover(query: DiscoverQuery, language: AppLanguage): Promise<DiscoverResponse> {
    if (query.providers.length === 0) return { items: [], page: 1, totalPages: 0 };
    const isMovie = query.mediaType === "movie";
    const dateField = isMovie ? "primary_release_date" : "first_air_date";
    const params = {
      language: TMDB_LOCALES[language],
      watch_region: REGION,
      with_watch_providers: query.providers.join("|"),
      with_watch_monetization_types: "flatrate|free|ads",
      with_genres: query.genres.length ? query.genres.join("|") : undefined,
      with_keywords: query.keywords?.length ? query.keywords.join("|") : undefined,
      with_origin_country: query.originCountries?.length ? query.originCountries.join("|") : undefined,
      "with_runtime.lte": isMovie ? query.maxRuntime : undefined,
      "vote_average.gte": query.minRating,
      "vote_count.gte": DISCOVER_MIN_VOTES,
      [`${dateField}.gte`]: query.yearFrom ? `${query.yearFrom}-01-01` : undefined,
      [`${dateField}.lte`]: query.yearTo ? `${query.yearTo}-12-31` : today(),
      sort_by: SORT_BY[query.sort][query.mediaType],
      include_adult: false,
      page: query.page,
    };
    const page = await this.cache.getOrLoad(`discover/${query.mediaType}/${JSON.stringify(params)}`, HOUR, () =>
      this.tmdb.get<TmdbPage<TmdbListItem>>(`/discover/${query.mediaType}`, params),
    );
    const items = await this.withOffers(
      page.results.map((item) => ({ item, mediaType: query.mediaType })),
      language,
    );
    return { items, page: page.page, totalPages: Math.min(page.total_pages, 500) };
  }

  async getTitle(mediaType: MediaType, tmdbId: number, language: AppLanguage): Promise<TitleDetail> {
    const detail = await this.cache.getOrLoad(`detail/${mediaType}/${tmdbId}/${language}`, 6 * HOUR, () =>
      this.tmdb.get<TmdbDetail>(`/${mediaType}/${tmdbId}`, {
        language: TMDB_LOCALES[language],
        append_to_response: "videos,watch/providers,credits",
        include_video_language: language === "en" ? "en" : `${language},en`,
      }),
    );
    const region = detail["watch/providers"]?.results[REGION];
    const offers = toOffers(region);
    const summary = toTitleSummary(detail, mediaType, offers);

    const [watchOptions, seasons] = await Promise.all([
      this.links.buildWatchOptions({
        mediaType,
        tmdbId,
        title: summary.title,
        region: REGION,
        offers,
        providers: providersIn(region),
        fallbackLink: region?.link ?? `https://www.themoviedb.org/${mediaType}/${tmdbId}/watch?locale=${REGION}`,
      }),
      mediaType === "tv" ? this.seasonAvailability(tmdbId, detail) : Promise.resolve(null),
    ]);

    const trailer = await this.firstAvailableTrailer(trailerCandidates(detail.videos?.results, language));
    return {
      ...summary,
      backdropUrl: imageUrl(detail.backdrop_path, "w780"),
      genres: detail.genres.map((g) => g.name),
      numberOfSeasons: detail.number_of_seasons ?? null,
      trailerUrl: trailer?.url ?? null,
      trailerThumbnailUrl: trailer?.thumbnailUrl ?? null,
      cast: toCast(detail.credits?.cast),
      watchOptions,
      seasons,
    };
  }

  /**
   * First trailer still online: a deleted YouTube video answers 404 on its
   * thumbnail. At most 3 checks, cached for a day. A network error keeps the
   * candidate rather than hiding a trailer on a transient failure.
   */
  private async firstAvailableTrailer(candidates: Trailer[]): Promise<Trailer | null> {
    for (const candidate of candidates.slice(0, 3)) {
      const online = await this.cache.getOrLoad(`yt/${candidate.thumbnailUrl}`, 24 * HOUR, () =>
        fetch(candidate.thumbnailUrl, { method: "HEAD" })
          .then((r) => r.ok)
          .catch(() => true),
      );
      if (online) return candidate;
    }
    return null;
  }

  /** Per-season offers (TMDB exposes watch providers at season level). Specials (season 0) are skipped. */
  private async seasonAvailability(tmdbId: number, detail: TmdbDetail): Promise<SeasonAvailability[]> {
    const seasons = (detail.seasons ?? []).filter((s) => s.season_number > 0);
    return Promise.all(
      seasons.map(async (season) => ({
        seasonNumber: season.season_number,
        name: season.name,
        episodeCount: season.episode_count,
        year: yearOf(season.air_date),
        offers: toOffers(await this.regionProviders(`/tv/${tmdbId}/season/${season.season_number}/watch/providers`)),
      })),
    );
  }

  /** TMDB keyword id for an (English) keyword, e.g. "feel-good" → 9713. */
  keywordId(name: string): Promise<number | null> {
    return this.cache.getOrLoad(`keyword/${name.toLowerCase()}`, 24 * HOUR, async () => {
      const page = await this.tmdb.get<TmdbPage<{ id: number; name: string }>>("/search/keyword", { query: name });
      const exact = page.results.find((k) => k.name.toLowerCase() === name.toLowerCase());
      return (exact ?? page.results[0])?.id ?? null;
    });
  }

  /** Best TMDB match for a title name ("Intouchables"), movie or series. */
  async findTitle(name: string, language: AppLanguage): Promise<{ mediaType: MediaType; tmdbId: number } | null> {
    const page = await this.cache.getOrLoad(`find/${language}/${name.toLowerCase()}`, 24 * HOUR, () =>
      this.tmdb.get<TmdbPage<TmdbListItem>>("/search/multi", {
        query: name,
        language: TMDB_LOCALES[language],
        include_adult: false,
      }),
    );
    const hit = page.results.find((r) => r.media_type === "movie" || r.media_type === "tv");
    return hit ? { mediaType: hit.media_type as MediaType, tmdbId: hit.id } : null;
  }

  /** TMDB recommendations for a title, with regional offers. */
  async recommendations(mediaType: MediaType, tmdbId: number, language: AppLanguage): Promise<TitleSummary[]> {
    const page = await this.cache.getOrLoad(`reco/${mediaType}/${tmdbId}/${language}`, 6 * HOUR, () =>
      this.tmdb.get<TmdbPage<TmdbListItem>>(`/${mediaType}/${tmdbId}/recommendations`, {
        language: TMDB_LOCALES[language],
      }),
    );
    return this.withOffers(
      page.results.map((item) => ({ item, mediaType })),
      language,
    );
  }

  /**
   * Summaries for stored references (favorites). Titles TMDB fails to resolve
   * are dropped instead of failing the whole batch.
   */
  async getSummaries(refs: { mediaType: MediaType; tmdbId: number }[], language: AppLanguage): Promise<TitleSummary[]> {
    const results = await Promise.allSettled(
      refs.map((ref) => this.withOffers([{ item: { id: ref.tmdbId }, mediaType: ref.mediaType }], language)),
    );
    const firstFailure = results.find((r) => r.status === "rejected");
    // Everything failing means TMDB itself is unavailable: surface it instead of an empty list.
    if (firstFailure && results.every((r) => r.status === "rejected")) throw firstFailure.reason;
    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  /**
   * Result lists don't carry runtime or regional offers: fetch both per title
   * in a single cached call (detail + appended watch providers).
   */
  private async withOffers(
    entries: { item: TmdbListItem; mediaType: MediaType }[],
    language: AppLanguage,
  ): Promise<TitleSummary[]> {
    return Promise.all(
      entries.map(async ({ item, mediaType }) => {
        const detail = await this.cache.getOrLoad(`summary/${mediaType}/${item.id}/${language}`, 6 * HOUR, () =>
          this.tmdb.get<TmdbDetail>(`/${mediaType}/${item.id}`, {
            language: TMDB_LOCALES[language],
            append_to_response: "watch/providers",
          }),
        );
        return toTitleSummary(
          { ...item, ...detail, overview: detail.overview || item.overview },
          mediaType,
          toOffers(detail["watch/providers"]?.results[REGION]),
        );
      }),
    );
  }

  private regionProviders(path: string): Promise<TmdbRegionProviders | undefined> {
    return this.cache.getOrLoad(path, 6 * HOUR, async () => {
      const payload = await this.tmdb.get<TmdbWatchProviders>(path);
      return payload.results[REGION];
    });
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
