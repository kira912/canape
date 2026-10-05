import {
  favoritesSchema,
  householdSchema,
  meSchema,
  sessionSchema,
  aiMatchCriteriaResponseSchema,
  aiSearchResponseSchema,
  matchDeckSchema,
  matchSessionSchema,
  matchStateSchema,
  matchVoteResultSchema,
  pairingInfoSchema,
  pairingSchema,
  pairingStatusSchema,
  recoveryCodeSchema,
  watchedSchema,
  discoverResponseSchema,
  partitionByAvailability,
  genreSchema,
  providerSchema,
  searchResponseSchema,
  titleDetailSchema,
  type CreateHouseholdInput,
  type DiscoverQuery,
  type FavoriteRef,
  type Favorites,
  type JoinHouseholdInput,
  type RecoverInput,
  type UpdateMemberInput,
  type MediaType,
  type Me,
  type MatchFiltersInput,
  type MatchVote,
  type Member,
  type Pairing,
  type Watched,
  type WatchedRef,
  type Provider,
  type SearchResponse,
} from "@canape/shared";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ApiError, apiGet, apiRequest } from "./api-client";
import { useSession } from "./household-store";

const HOUR = 60 * 60 * 1000;

/** Catalog responses are translated by the API: the language is part of every catalog query key. */
function useLanguageKey(): string {
  return useTranslation().i18n.language;
}

export function useProviders() {
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["providers", lang],
    queryFn: () => apiGet("/providers", z.array(providerSchema)),
    staleTime: 24 * HOUR,
  });
}

export function useProvidersById(): Map<number, Provider> {
  const { data } = useProviders();
  return useMemo(() => new Map((data ?? []).map((p) => [p.id, p])), [data]);
}

export function useGenres(mediaType: MediaType) {
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["genres", mediaType, lang],
    queryFn: () => apiGet(`/genres/${mediaType}`, z.array(genreSchema)),
    staleTime: 24 * HOUR,
  });
}

export interface MergedGenre {
  name: string;
  /** Movie and TV lists use different ids for some genres; a chip matches all of them. */
  ids: number[];
}

/** Movie + TV genres merged by name, for screens mixing both (search results). */
export function useAllGenres(): MergedGenre[] {
  const movie = useGenres("movie");
  const tv = useGenres("tv");
  return useMemo(() => {
    const byName = new Map<string, MergedGenre>();
    for (const genre of [...(movie.data ?? []), ...(tv.data ?? [])]) {
      const entry = byName.get(genre.name) ?? { name: genre.name, ids: [] };
      entry.ids.push(genre.id);
      byName.set(genre.name, entry);
    }
    return [...byName.values()];
  }, [movie.data, tv.data]);
}

export function useSearch(query: string, providerIds: number[]) {
  // TMDB search is case-insensitive and the response doesn't depend on the household:
  // one URL per query and language, shared by everyone in the CDN cache.
  const q = query.trim().toLowerCase();
  const lang = useLanguageKey();
  const split = useCallback(
    (response: SearchResponse) => partitionByAvailability(response.items, providerIds),
    [providerIds],
  );
  return useQuery({
    queryKey: ["search", q, lang],
    queryFn: () => apiGet("/search", searchResponseSchema, { q }),
    select: split,
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: HOUR,
  });
}

export type DiscoverFilters = Omit<DiscoverQuery, "page" | "providers" | "keywords" | "originCountries">;

export function useDiscover(filters: DiscoverFilters, providerIds: number[]) {
  const lang = useLanguageKey();
  return useInfiniteQuery({
    queryKey: ["discover", filters, providerIds, lang],
    queryFn: ({ pageParam }) =>
      apiGet("/discover", discoverResponseSchema, { ...filters, providers: providerIds, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: providerIds.length > 0,
    staleTime: HOUR,
  });
}

export function useTitle(mediaType: MediaType, tmdbId: number) {
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["title", mediaType, tmdbId, lang],
    queryFn: () => apiGet(`/titles/${mediaType}/${tmdbId}`, titleDetailSchema),
    staleTime: HOUR,
  });
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export function useMe() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: ["me", token],
    queryFn: () => apiGet("/household", meSchema),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}

/** The household's platforms (shared by every member). */
export function useHouseholdProviderIds(): number[] {
  const { data } = useMe();
  return data?.household.providerIds ?? EMPTY_IDS;
}
const EMPTY_IDS: number[] = [];

/**
 * Solo = a household of one (the "Commencer" start). Shared features (shared
 * list, "who has seen it", Match) stay out of the way until someone joins.
 */
export function useIsSolo(): boolean {
  const { data } = useMe();
  return (data?.household.members.length ?? 1) <= 1;
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  return useMutation({
    mutationFn: (changes: UpdateMemberInput) => apiRequest("PUT", "/household/member", householdSchema, changes),
    onSuccess: (household) => {
      const key = ["me", token];
      const previous = queryClient.getQueryData<Me>(key);
      if (previous) queryClient.setQueryData<Me>(key, { ...previous, household });
    },
  });
}

export function useCreateHousehold() {
  const setSession = useSession((s) => s.setSession);
  return useMutation({
    mutationFn: (input: CreateHouseholdInput) => apiRequest("POST", "/households", sessionSchema, input),
    onSuccess: (session) => setSession(session),
  });
}

export function useJoinHousehold() {
  const setSession = useSession((s) => s.setSession);
  return useMutation({
    mutationFn: (input: JoinHouseholdInput) => apiRequest("POST", "/households/join", sessionSchema, input),
    onSuccess: (session) => setSession(session),
  });
}

/** New device: signs back in with the member's personal recovery code. */
export function useRecoverProfile() {
  const setSession = useSession((s) => s.setSession);
  return useMutation({
    mutationFn: (input: RecoverInput) => apiRequest("POST", "/households/recover", sessionSchema, input),
    onSuccess: (session) => setSession(session),
  });
}

/** A new personal recovery code (shown once); the previous one stops working. */
export function useRegenerateRecoveryCode() {
  return useMutation({
    mutationFn: () => apiRequest("POST", "/household/member/recovery-code", recoveryCodeSchema),
  });
}

/** A new invite code for the household; the previous one stops working. */
export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  return useMutation({
    mutationFn: () => apiRequest("POST", "/household/invite-code", householdSchema),
    onSuccess: (household) => {
      const key = ["me", token];
      const previous = queryClient.getQueryData<Me>(key);
      if (previous) queryClient.setQueryData<Me>(key, { ...previous, household });
    },
  });
}

/** Signs this member out of every other device. */
export function useSignOutOtherDevices() {
  return useMutation({ mutationFn: () => apiRequest("DELETE", "/household/sessions/others", null) });
}

// --- QR sign-in (see packages/shared/src/pairing.ts) ---------------------------

/** New device: starts a pairing whose id goes in the QR. */
export function useCreatePairing() {
  return useMutation({ mutationFn: () => apiRequest("POST", "/pairings", pairingSchema) });
}

/** New device: polls until a signed-in device approves, then keeps the session it receives. */
export function usePairingClaim(pairing: Pairing | undefined) {
  const setSession = useSession((s) => s.setSession);
  return useQuery({
    queryKey: ["pairing-claim", pairing?.id],
    enabled: !!pairing,
    queryFn: async () => {
      const status = await apiRequest("POST", `/pairings/${pairing!.id}/claim`, pairingStatusSchema, {
        secret: pairing!.secret,
      });
      if (status.status === "approved") setSession(status.session);
      return status;
    },
    refetchInterval: (query) => (query.state.data?.status === "approved" || query.state.error ? false : 2000),
    retry: false,
    gcTime: 0,
  });
}

/** Signed-in device: what it is about to connect. */
export function usePairingInfo(id: string) {
  return useQuery({
    queryKey: ["pairing-info", id],
    queryFn: () => apiRequest("GET", `/pairings/${id}`, pairingInfoSchema),
    retry: false,
    gcTime: 0,
  });
}

export function useApprovePairing(id: string) {
  return useMutation({
    mutationFn: (verificationCode: string) =>
      apiRequest("POST", `/pairings/${id}/approve`, null, { verificationCode }),
  });
}

export function useLeaveHousehold() {
  const clearSession = useSession((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("DELETE", "/household/session", null).catch(() => undefined),
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

/** Right to erasure: deletes this member and their data server-side, then forgets the session. */
export function useDeleteMyData() {
  const clearSession = useSession((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("DELETE", "/household/member", null),
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

/** Optimistic: the checkbox flips immediately, rolled back if the API refuses. */
export function useUpdateProviders() {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  const key = ["me", token];
  return useMutation({
    mutationFn: (providerIds: number[]) => apiRequest("PUT", "/household/providers", householdSchema, { providerIds }),
    onMutate: async (providerIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Me>(key);
      if (previous)
        queryClient.setQueryData<Me>(key, { ...previous, household: { ...previous.household, providerIds } });
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function useFavorites() {
  const token = useSession((s) => s.token);
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["favorites", token, lang],
    queryFn: () => apiGet("/favorites", favoritesSchema),
    enabled: Boolean(token),
    staleTime: 60 * 1000,
  });
}

export function isInFavorites(favorites: Favorites | undefined, ref: Omit<FavoriteRef, "list">) {
  const has = (items: Favorites["household"]) =>
    items.some((f) => f.title.tmdbId === ref.tmdbId && f.title.mediaType === ref.mediaType);
  return { household: has(favorites?.household ?? []), mine: has(favorites?.mine ?? []) };
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  return useMutation({
    mutationFn: ({ ref, add }: { ref: FavoriteRef; add: boolean }) =>
      apiRequest(add ? "PUT" : "DELETE", `/favorites/${ref.list}/${ref.mediaType}/${ref.tmdbId}`, null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites", token] }),
  });
}

// ---------------------------------------------------------------------------
// "Déjà vu" (household-private: fetched separately from CDN-cached catalog data)
// ---------------------------------------------------------------------------

export function useWatched() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: ["watched", token],
    queryFn: () => apiGet("/watched", watchedSchema),
    enabled: Boolean(token),
    staleTime: 60 * 1000,
  });
}

/** Members who have seen a title, in household order. */
export function useWatchers(mediaType: MediaType, tmdbId: number): { watchers: Member[]; members: Member[] } {
  const { data: watched } = useWatched();
  const { data: me } = useMe();
  return useMemo(() => {
    const members = me?.household.members ?? [];
    const entry = watched?.items.find((i) => i.mediaType === mediaType && i.tmdbId === tmdbId);
    return { members, watchers: members.filter((m) => entry?.memberIds.includes(m.id)) };
  }, [watched, me, mediaType, tmdbId]);
}

/** Optimistic: the member chip flips at once, rolled back if the API refuses. */
export function useToggleWatched() {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  const key = ["watched", token];
  return useMutation({
    mutationFn: ({ ref, seen }: { ref: WatchedRef; seen: boolean }) =>
      apiRequest(seen ? "PUT" : "DELETE", `/watched/${ref.mediaType}/${ref.tmdbId}/${ref.memberId}`, null),
    onMutate: async ({ ref, seen }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Watched>(key);
      queryClient.setQueryData<Watched>(key, toggleLocally(previous ?? { items: [] }, ref, seen));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function toggleLocally(watched: Watched, ref: WatchedRef, seen: boolean): Watched {
  const same = (i: Watched["items"][number]) => i.mediaType === ref.mediaType && i.tmdbId === ref.tmdbId;
  const current = watched.items.find(same)?.memberIds ?? [];
  const memberIds = seen ? [...new Set([...current, ref.memberId])] : current.filter((id) => id !== ref.memberId);
  const others = watched.items.filter((i) => !same(i));
  return {
    items: memberIds.length ? [...others, { mediaType: ref.mediaType, tmdbId: ref.tmdbId, memberIds }] : others,
  };
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/** Polled while the Match tab is open, so a match completed by the other member shows up. */
export function useMatchState({ poll }: { poll: boolean }) {
  const token = useSession((s) => s.token);
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["match", token, lang],
    queryFn: () => apiGet("/match", matchStateSchema),
    enabled: Boolean(token),
    refetchInterval: poll ? 10_000 : false,
  });
}

export function useStartMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filters: MatchFiltersInput) => apiRequest("POST", "/match/sessions", matchSessionSchema, filters),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["match"] });
      void queryClient.removeQueries({ queryKey: ["match-deck"] });
    },
  });
}

export function useEndMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("DELETE", "/match/sessions/current", null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["match"] });
      void queryClient.removeQueries({ queryKey: ["match-deck"] });
    },
  });
}

/** Cards are consumed locally; the screen refetches when it runs low. */
export function useMatchDeck(sessionId: string | undefined) {
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["match-deck", sessionId, lang],
    queryFn: () => apiGet("/match/deck", matchDeckSchema),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });
}

export const MATCH_VOTE_KEY = ["match-vote"];

export function useMatchVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MATCH_VOTE_KEY,
    mutationFn: (vote: MatchVote) => apiRequest("POST", "/match/votes", matchVoteResultSchema, vote),
    // A vote is an upsert server-side: safe to resend after a network or server error.
    retry: (failures, error) => failures < 2 && error instanceof ApiError && (error.status === 0 || error.status >= 500),
    // My vote completed a match: refresh the list now rather than at the next poll.
    onSuccess: (result) => {
      if (result.match) void queryClient.invalidateQueries({ queryKey: ["match"] });
    },
  });
}

// ---------------------------------------------------------------------------
// AI (Claude interprets the text; titles still come from TMDB)
// ---------------------------------------------------------------------------

/** Runs only for a submitted query (not on each keystroke): every call costs money. */
export function useAiSearch(query: string, providerIds: number[]) {
  const lang = useLanguageKey();
  const q = query.trim();
  return useQuery({
    queryKey: ["ai-search", q.toLowerCase(), providerIds, lang],
    queryFn: () => apiGet("/ai/search", aiSearchResponseSchema, { q, providers: providerIds }),
    enabled: q.length >= 3,
    staleTime: HOUR,
    retry: false,
  });
}

export function useAiMatchCriteria() {
  return useMutation({
    mutationFn: (moods: string[]) => apiRequest("POST", "/ai/match-criteria", aiMatchCriteriaResponseSchema, { moods }),
  });
}
