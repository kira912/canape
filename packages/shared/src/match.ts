import { z } from "zod";
import { mediaTypeSchema, titleSummarySchema } from "./catalog";

/**
 * "Match": one member starts an evening with criteria, every member swipes the
 * same deck (same order → more overlap), a title liked by the whole household
 * is a match. Starting a new evening closes the previous one.
 */
export const matchFiltersSchema = z.object({
  mediaType: mediaTypeSchema,
  genres: z.array(z.number().int().positive()).max(20).default([]),
  /** Minutes, movies only. */
  maxRuntime: z.number().int().positive().optional(),
  minRating: z.number().min(0).max(10).optional(),
});
export type MatchFilters = z.infer<typeof matchFiltersSchema>;
export type MatchFiltersInput = z.input<typeof matchFiltersSchema>;

export const matchSessionSchema = z.object({
  id: z.string(),
  filters: matchFiltersSchema,
  createdBy: z.string(),
  createdAt: z.string(),
});
export type MatchSession = z.infer<typeof matchSessionSchema>;

export const matchStateSchema = z.object({
  session: matchSessionSchema.nullable(),
  /** Liked by every member, most recent first. */
  matches: z.array(titleSummarySchema),
  /** A match needs at least two members in the household. */
  canMatch: z.boolean(),
});
export type MatchState = z.infer<typeof matchStateSchema>;

export const matchDeckSchema = z.object({ items: z.array(titleSummarySchema) });
export type MatchDeck = z.infer<typeof matchDeckSchema>;

export const matchVoteSchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int().positive(),
  liked: z.boolean(),
});
export type MatchVote = z.infer<typeof matchVoteSchema>;

export const matchVoteResultSchema = z.object({
  /** Set when this vote completed a match. */
  match: titleSummarySchema.nullable(),
});
export type MatchVoteResult = z.infer<typeof matchVoteResultSchema>;
