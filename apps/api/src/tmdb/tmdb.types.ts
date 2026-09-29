/** Subset of the TMDB v3 payloads we actually read. */

export interface TmdbProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
  display_priorities?: Record<string, number>;
}

export interface TmdbRegionProviders {
  link?: string;
  flatrate?: TmdbProviderEntry[];
  free?: TmdbProviderEntry[];
  ads?: TmdbProviderEntry[];
  rent?: TmdbProviderEntry[];
  buy?: TmdbProviderEntry[];
}

export interface TmdbWatchProviders {
  results: Record<string, TmdbRegionProviders | undefined>;
}

export interface TmdbListItem {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  overview?: string;
}

export interface TmdbPage<T> {
  page: number;
  total_pages: number;
  results: T[];
}

export interface TmdbVideo {
  site: string;
  type: string;
  key: string;
  official?: boolean;
  iso_639_1?: string;
}

export interface TmdbCastEntry {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
}

export interface TmdbSeason {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
}

export interface TmdbDetail extends TmdbListItem {
  genres: { id: number; name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime: number | null } | null;
  number_of_seasons?: number;
  seasons?: TmdbSeason[];
  videos?: { results: TmdbVideo[] };
  credits?: { cast: TmdbCastEntry[] };
  "watch/providers"?: TmdbWatchProviders;
}
