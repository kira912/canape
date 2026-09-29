import {
  favoritesSchema,
  householdSchema,
  meSchema,
  sessionSchema,
  watchedSchema,
  discoverResponseSchema,
  genreSchema,
  providerSchema,
  searchResponseSchema,
  titleDetailSchema,
  type CreateHouseholdInput,
  type DiscoverQuery,
  type FavoriteRef,
  type Favorites,
  type JoinHouseholdInput,
  type MediaType,
  type Me,
  type Member,
  type Watched,
  type WatchedRef,
  type Provider,
} from "@canape/shared";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { apiGet, apiRequest } from "./api-client";
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
  // TMDB search is case-insensitive: one URL per query keeps the CDN cache hit rate up.
  const q = query.trim().toLowerCase();
  const lang = useLanguageKey();
  return useQuery({
    queryKey: ["search", q, providerIds, lang],
    queryFn: () => apiGet("/search", searchResponseSchema, { q, providers: providerIds }),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: HOUR,
  });
}

export type DiscoverFilters = Omit<DiscoverQuery, "page" | "providers">;

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
