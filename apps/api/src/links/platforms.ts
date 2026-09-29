/**
 * Known streaming platforms, used to bridge TMDB provider names with
 * Streaming Availability service ids, and to build a "search on the platform"
 * link when no direct title link is known.
 *
 * TMDB lists several providers per platform (e.g. "Netflix" and "Netflix basic
 * with Ads", or "X Amazon Channel"), hence matching on name prefixes.
 * Search URL formats are not officially documented: to verify on devices.
 */
interface Platform {
  key: string;
  tmdbNamePrefixes: string[];
  streamingAvailabilityIds: string[];
  searchUrl?: (query: string) => string;
}

const PLATFORMS: readonly Platform[] = [
  {
    key: "netflix",
    tmdbNamePrefixes: ["netflix"],
    streamingAvailabilityIds: ["netflix"],
    searchUrl: (q) => `https://www.netflix.com/search?q=${q}`,
  },
  {
    key: "prime",
    tmdbNamePrefixes: ["amazonprimevideo", "primevideo", "amazonvideo"],
    streamingAvailabilityIds: ["prime"],
    searchUrl: (q) => `https://www.primevideo.com/search/?phrase=${q}`,
  },
  {
    key: "disney",
    tmdbNamePrefixes: ["disneyplus"],
    streamingAvailabilityIds: ["disney"],
    searchUrl: (q) => `https://www.disneyplus.com/search?q=${q}`,
  },
  {
    key: "apple",
    tmdbNamePrefixes: ["appletv"],
    streamingAvailabilityIds: ["apple"],
    searchUrl: (q) => `https://tv.apple.com/fr/search?term=${q}`,
  },
  { key: "max", tmdbNamePrefixes: ["max", "hbomax"], streamingAvailabilityIds: ["hbo"] },
  { key: "canal", tmdbNamePrefixes: ["canalplus", "canal"], streamingAvailabilityIds: ["canal"] },
  { key: "paramount", tmdbNamePrefixes: ["paramountplus"], streamingAvailabilityIds: ["paramount"] },
  { key: "mubi", tmdbNamePrefixes: ["mubi"], streamingAvailabilityIds: ["mubi"] },
  { key: "crunchyroll", tmdbNamePrefixes: ["crunchyroll"], streamingAvailabilityIds: ["crunchyroll"] },
  {
    key: "youtube",
    tmdbNamePrefixes: ["youtube"],
    streamingAvailabilityIds: [],
    searchUrl: (q) => `https://www.youtube.com/results?search_query=${q}`,
  },
];

/** "Disney Plus" / "Disney+" → "disneyplus", "Apple TV+" → "appletvplus". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]/g, "");
}

export function platformForTmdbName(providerName: string): Platform | undefined {
  const normalized = normalizeName(providerName);
  return PLATFORMS.find((p) => p.tmdbNamePrefixes.some((prefix) => normalized.startsWith(prefix)));
}

export function platformForStreamingAvailabilityId(serviceId: string): Platform | undefined {
  return PLATFORMS.find((p) => p.streamingAvailabilityIds.includes(serviceId));
}

export function platformSearchUrl(providerName: string, title: string): string | null {
  const platform = platformForTmdbName(providerName);
  return platform?.searchUrl ? platform.searchUrl(encodeURIComponent(title)) : null;
}
