import type { MediaType, TitleSummary } from "./catalog";

export type ResultSort = "relevance" | "rating" | "shortest" | "recent";

export interface ResultFilters {
  mediaType?: MediaType;
  /** Minutes. Only constrains movies: a series' runtime is per episode. */
  maxRuntime?: number;
  minRating?: number;
  /** Keeps titles having at least one of these genres. */
  genreIds?: readonly number[];
}

/** Below this many votes a TMDB rating is too noisy to rank "best rated". */
export const MIN_VOTES_FOR_RATING_SORT = 50;

export function filterTitles<T extends TitleSummary>(items: readonly T[], filters: ResultFilters): T[] {
  return items.filter((item) => {
    if (filters.mediaType && item.mediaType !== filters.mediaType) return false;
    if (filters.maxRuntime && item.mediaType === "movie" && (item.runtime === null || item.runtime > filters.maxRuntime)) {
      return false;
    }
    if (filters.minRating && (item.rating === null || item.rating < filters.minRating)) return false;
    if (filters.genreIds?.length && !item.genreIds.some((id) => filters.genreIds!.includes(id))) return false;
    return true;
  });
}

/** Stable sort; titles missing the sorted field go last, in relevance order. */
export function sortTitles<T extends TitleSummary>(items: readonly T[], sort: ResultSort): T[] {
  if (sort === "relevance") return [...items];
  const key = (item: T): number | null => {
    switch (sort) {
      case "rating":
        // Reliable ratings first, then noisy ones, each group by rating.
        return item.rating === null ? null : item.rating + (item.voteCount >= MIN_VOTES_FOR_RATING_SORT ? 100 : 0);
      case "shortest":
        return item.runtime === null ? null : -item.runtime;
      case "recent":
        return item.year;
    }
  };
  return items
    .map((item, index) => ({ item, index, value: key(item) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
      }
      return b.value - a.value || a.index - b.index;
    })
    .map(({ item }) => item);
}
