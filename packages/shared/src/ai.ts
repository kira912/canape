import { z } from "zod";
import { mediaTypeSchema, titleSummarySchema } from "./catalog";
import { matchFiltersSchema } from "./match";

/**
 * AI features: the model only interprets what people write; titles and
 * availability always come from TMDB, filtered on the household's platforms.
 */

export const AI_QUERY_MAX_LENGTH = 200;

export const aiSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(AI_QUERY_MAX_LENGTH),
  providers: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) =>
      (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
        .split(",")
        .map((p) => Number.parseInt(p.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
});
export type AiSearchQuery = z.infer<typeof aiSearchQuerySchema>;

/** What the model understood, shown back to the user ("Compris : …"). */
export const aiSearchCriteriaSchema = z.object({
  mediaType: mediaTypeSchema.nullable(),
  genreIds: z.array(z.number().int()),
  maxRuntime: z.number().int().nullable(),
  minRating: z.number().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  keywords: z.array(z.string()),
  /** ISO 3166-1 codes ("nordique" → SE, DK, NO, FI, IS). */
  originCountries: z.array(z.string()).default([]),
  similarTo: z.string().nullable(),
});
export type AiSearchCriteria = z.infer<typeof aiSearchCriteriaSchema>;

export const aiSearchResponseSchema = z.object({
  summary: z.string(),
  criteria: aiSearchCriteriaSchema,
  /** Only titles watchable on the household's platforms, best matches first. */
  items: z.array(titleSummarySchema),
});
export type AiSearchResponse = z.infer<typeof aiSearchResponseSchema>;

export const aiMatchCriteriaRequestSchema = z.object({
  /** One free-text mood per member ("plutôt un truc léger"). */
  moods: z.array(z.string().trim().min(1).max(AI_QUERY_MAX_LENGTH)).min(1).max(6),
});
export type AiMatchCriteriaRequest = z.infer<typeof aiMatchCriteriaRequestSchema>;

export const aiMatchCriteriaResponseSchema = z.object({
  filters: matchFiltersSchema,
  explanation: z.string(),
});
export type AiMatchCriteriaResponse = z.infer<typeof aiMatchCriteriaResponseSchema>;
