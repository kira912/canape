/** Languages the app is translated into. Adding one: a locale file in the app + an entry here. */
export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = "fr";

/** Language sent to TMDB for titles, overviews and genres. Availability stays per country (REGION). */
export const TMDB_LOCALES: Record<AppLanguage, string> = { fr: "fr-FR", en: "en-US" };

/** Best supported language for a tag or an Accept-Language header ("en-GB,en;q=0.9,fr;q=0.8"). */
export function resolveLanguage(input: string | null | undefined): AppLanguage {
  for (const part of (input ?? "").split(",")) {
    const base = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) return base as AppLanguage;
  }
  return DEFAULT_LANGUAGE;
}
