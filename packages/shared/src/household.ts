import { z } from "zod";
import { mediaTypeSchema, titleSummarySchema } from "./catalog";

/** Member colours offered at sign-up (distinct on the dark theme). */
export const MEMBER_COLORS = ["#FF7A59", "#6FCF97", "#56CCF2", "#BB6BD9", "#F2C94C", "#EB5757"] as const;

export const INVITE_CODE_LENGTH = 6;

const memberNameSchema = z.string().trim().min(1).max(30);
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const providerIdsSchema = z.array(z.number().int().positive()).max(100);

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const householdSchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  providerIds: z.array(z.number().int()),
  members: z.array(memberSchema),
});
export type Household = z.infer<typeof householdSchema>;

/** Current member + their household. */
export const meSchema = z.object({
  memberId: z.string(),
  household: householdSchema,
});
export type Me = z.infer<typeof meSchema>;

/** Returned when creating/joining: the bearer token identifies this device's member. */
export const sessionSchema = meSchema.extend({ token: z.string() });
export type Session = z.infer<typeof sessionSchema>;

export const createHouseholdSchema = z.object({
  householdName: z.string().trim().min(1).max(40).default("Notre canapé"),
  memberName: memberNameSchema,
  color: colorSchema,
  providerIds: providerIdsSchema.default([]),
});
export type CreateHouseholdInput = z.input<typeof createHouseholdSchema>;

export const joinHouseholdSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(INVITE_CODE_LENGTH),
  memberName: memberNameSchema,
  color: colorSchema,
});
export type JoinHouseholdInput = z.input<typeof joinHouseholdSchema>;

export const updateProvidersSchema = z.object({ providerIds: providerIdsSchema });

// ---------------------------------------------------------------------------
// Favorites: one list shared by the household + one personal list per member.
// ---------------------------------------------------------------------------

export const favoriteListSchema = z.enum(["household", "me"]);
export type FavoriteList = z.infer<typeof favoriteListSchema>;

export const favoriteRefSchema = z.object({
  list: favoriteListSchema,
  mediaType: mediaTypeSchema,
  tmdbId: z.coerce.number().int().positive(),
});
export type FavoriteRef = z.infer<typeof favoriteRefSchema>;

export const favoriteItemSchema = z.object({
  title: titleSummarySchema,
  addedBy: z.string(),
  addedAt: z.string(),
});
export type FavoriteItem = z.infer<typeof favoriteItemSchema>;

export const favoritesSchema = z.object({
  household: z.array(favoriteItemSchema),
  mine: z.array(favoriteItemSchema),
});
export type Favorites = z.infer<typeof favoritesSchema>;

// ---------------------------------------------------------------------------
// "Déjà vu": per member, binary (a series is seen or not), never hides a title.
// Kept out of catalog responses on purpose: those are cached publicly by the CDN.
// ---------------------------------------------------------------------------

export const watchedRefSchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.coerce.number().int().positive(),
  memberId: z.string().uuid(),
});
export type WatchedRef = z.infer<typeof watchedRefSchema>;

export const watchedEntrySchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int(),
  /** Members of the household who have seen it, oldest first. */
  memberIds: z.array(z.string()),
});
export type WatchedEntry = z.infer<typeof watchedEntrySchema>;

export const watchedSchema = z.object({ items: z.array(watchedEntrySchema) });
export type Watched = z.infer<typeof watchedSchema>;
