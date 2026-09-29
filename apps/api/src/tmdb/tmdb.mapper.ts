import type { AppLanguage, MediaType, Offer, OfferType, Provider, TitleSummary } from "@canape/shared";
import type { TmdbDetail, TmdbListItem, TmdbProviderEntry, TmdbRegionProviders, TmdbVideo } from "./tmdb.types";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export function imageUrl(path: string | null | undefined, size: "w92" | "w342" | "w780"): string | null {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

export function yearOf(date: string | null | undefined): number | null {
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isInteger(year) ? year : null;
}

export function toProvider(entry: TmdbProviderEntry): Provider {
  return { id: entry.provider_id, name: entry.provider_name, logoUrl: imageUrl(entry.logo_path, "w92") };
}

/** TMDB bucket name → our offer type. */
const BUCKETS: readonly [keyof TmdbRegionProviders, OfferType][] = [
  ["flatrate", "subscription"],
  ["free", "free"],
  ["ads", "ads"],
  ["rent", "rent"],
  ["buy", "buy"],
];

/** Flattens TMDB's per-bucket provider lists, keeping the per-bucket order. */
export function toOffers(region: TmdbRegionProviders | undefined): Offer[] {
  if (!region) return [];
  const offers: Offer[] = [];
  const seen = new Set<string>();
  for (const [bucket, type] of BUCKETS) {
    for (const entry of (region[bucket] as TmdbProviderEntry[] | undefined) ?? []) {
      const key = `${entry.provider_id}:${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push({ providerId: entry.provider_id, type });
    }
  }
  return offers;
}

/** Every provider mentioned in a region payload, by id. */
export function providersIn(region: TmdbRegionProviders | undefined): Map<number, Provider> {
  const byId = new Map<number, Provider>();
  if (!region) return byId;
  for (const [bucket] of BUCKETS) {
    for (const entry of (region[bucket] as TmdbProviderEntry[] | undefined) ?? []) {
      if (!byId.has(entry.provider_id)) byId.set(entry.provider_id, toProvider(entry));
    }
  }
  return byId;
}

/** Movie length, or typical episode length for a series (`episode_run_time` is often empty on recent shows). */
export function runtimeOf(detail: Partial<TmdbDetail>): number | null {
  return detail.runtime || detail.episode_run_time?.[0] || detail.last_episode_to_air?.runtime || null;
}

export function toTitleSummary(item: TmdbListItem | TmdbDetail, mediaType: MediaType, offers: Offer[]): TitleSummary {
  return {
    tmdbId: item.id,
    mediaType,
    title: (mediaType === "movie" ? item.title : item.name) ?? item.title ?? item.name ?? "Sans titre",
    year: yearOf(mediaType === "movie" ? item.release_date : item.first_air_date),
    posterUrl: imageUrl(item.poster_path, "w342"),
    rating: item.vote_count ? Math.round((item.vote_average ?? 0) * 10) / 10 : null,
    voteCount: item.vote_count ?? 0,
    genreIds: "genres" in item && item.genres ? item.genres.map((g) => g.id) : (item.genre_ids ?? []),
    runtime: runtimeOf(item),
    overview: item.overview ?? "",
    offers,
  };
}

/** Prefers an official YouTube trailer in the app language, then any YouTube trailer/teaser. */
export function pickTrailerUrl(videos: readonly TmdbVideo[] | undefined, language: AppLanguage): string | null {
  const youtube = (videos ?? []).filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  const score = (v: TmdbVideo) =>
    (v.type === "Trailer" ? 4 : 0) + (v.iso_639_1 === language ? 2 : 0) + (v.official ? 1 : 0);
  const best = [...youtube].sort((a, b) => score(b) - score(a))[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}
