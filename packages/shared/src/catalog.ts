import { z } from "zod";

export const REGION = "FR";

export const mediaTypeSchema = z.enum(["movie", "tv"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

/**
 * How a title is offered on a platform. Only `subscription`, `free` and `ads`
 * count as "watchable right now" for a household that owns that platform;
 * `rent`/`buy` always cost extra and are shown behind "Voir aussi ailleurs".
 */
export const offerTypeSchema = z.enum(["subscription", "free", "ads", "rent", "buy"]);
export type OfferType = z.infer<typeof offerTypeSchema>;

export const WATCHABLE_OFFER_TYPES: readonly OfferType[] = ["subscription", "free", "ads"];

export const offerSchema = z.object({
  providerId: z.number().int(),
  type: offerTypeSchema,
});
export type Offer = z.infer<typeof offerSchema>;

export const providerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});
export type Provider = z.infer<typeof providerSchema>;

export const titleSummarySchema = z.object({
  tmdbId: z.number().int(),
  mediaType: mediaTypeSchema,
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  rating: z.number().nullable(),
  voteCount: z.number().int(),
  /** TMDB genre ids — movie and TV lists differ for some genres (e.g. Action vs Action & Adventure). */
  genreIds: z.array(z.number().int()),
  /** Minutes: full length for a movie, typical episode length for a series. */
  runtime: z.number().int().nullable(),
  overview: z.string(),
  offers: z.array(offerSchema),
});
export type TitleSummary = z.infer<typeof titleSummarySchema>;

/**
 * TMDB relevance order, independent of the household (one CDN entry per query):
 * the app splits it with `partitionByAvailability`.
 */
export const searchResponseSchema = z.object({
  items: z.array(titleSummarySchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const discoverResponseSchema = z.object({
  items: z.array(titleSummarySchema),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;

export const genreSchema = z.object({ id: z.number().int(), name: z.string() });
export type Genre = z.infer<typeof genreSchema>;

export const linkKindSchema = z.enum([
  /** Opens the title itself (universal/app link → native app if installed). */
  "direct",
  /** Opens the platform's own search pre-filled with the title. */
  "search",
  /** TMDB "where to watch" page, last resort. */
  "fallback",
]);
export type LinkKind = z.infer<typeof linkKindSchema>;

export const watchOptionSchema = z.object({
  provider: providerSchema,
  type: offerTypeSchema,
  link: z.string(),
  linkKind: linkKindSchema,
  /**
   * Known platform ("netflix", "prime", "disney"…), used to open it on a smart TV.
   * Defaults to null for title pages cached by the CDN before the field existed.
   */
  platform: z.string().nullable().default(null),
});
export type WatchOption = z.infer<typeof watchOptionSchema>;

export const seasonAvailabilitySchema = z.object({
  seasonNumber: z.number().int(),
  name: z.string(),
  episodeCount: z.number().int(),
  year: z.number().int().nullable(),
  offers: z.array(offerSchema),
});
export type SeasonAvailability = z.infer<typeof seasonAvailabilitySchema>;

export const castMemberSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  character: z.string(),
  photoUrl: z.string().nullable(),
});
export type CastMember = z.infer<typeof castMemberSchema>;

export const titleDetailSchema = titleSummarySchema.extend({
  backdropUrl: z.string().nullable(),
  genres: z.array(z.string()),
  numberOfSeasons: z.number().int().nullable(),
  trailerUrl: z.string().nullable(),
  // Defaults: title pages cached by the CDN before these fields existed must still parse.
  trailerThumbnailUrl: z.string().nullable().default(null),
  /** Main cast, billing order. */
  cast: z.array(castMemberSchema).default([]),
  watchOptions: z.array(watchOptionSchema),
  /** Only for series; `null` for movies. */
  seasons: z.array(seasonAvailabilitySchema).nullable(),
});
export type TitleDetail = z.infer<typeof titleDetailSchema>;

// ---------------------------------------------------------------------------
// Query contracts (HTTP query strings are always strings → coerce).
// ---------------------------------------------------------------------------

/** Bounds every id list of a query string: they become upstream filters and CDN cache keys. */
export const MAX_IDS_PER_QUERY = 50;

/** `"8,119,337"` → `[8, 119, 337]`; empty/missing → `[]`; more than MAX_IDS_PER_QUERY ids → invalid. */
export const idListSchema = z
  .union([z.string().max(1000), z.array(z.string().max(20)).max(MAX_IDS_PER_QUERY)])
  .optional()
  .transform((raw) => {
    const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
    return joined
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
  })
  .pipe(z.array(z.number()).max(MAX_IDS_PER_QUERY));

const yearSchema = z.coerce.number().int().min(1900).max(2100);

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  providers: idListSchema,
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const discoverSortSchema = z.enum(["popularity", "rating", "recent"]);
export type DiscoverSort = z.infer<typeof discoverSortSchema>;

export const discoverQuerySchema = z.object({
  mediaType: mediaTypeSchema.default("movie"),
  providers: idListSchema,
  genres: idListSchema,
  /** TMDB keyword ids (any of them). Used by the AI search. */
  keywords: idListSchema,
  /** ISO 3166-1 alpha-2 production countries (any of them). Used by the AI search. */
  originCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(10).optional(),
  maxRuntime: z.coerce.number().int().positive().max(1000).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  yearFrom: yearSchema.optional(),
  yearTo: yearSchema.optional(),
  sort: discoverSortSchema.default("popularity"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
