import { resolveLanguage, type AppLanguage } from "@canape/shared";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { fr } from "./locales/fr";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof fr };
  }
}

export type LanguagePreference = AppLanguage | "system";

export function deviceLanguage(): AppLanguage {
  return resolveLanguage(getLocales()[0]?.languageTag);
}

export function resolvePreference(preference: LanguagePreference): AppLanguage {
  return preference === "system" ? deviceLanguage() : preference;
}

/** Native names: a language is always listed in its own language. */
export const LANGUAGE_NAMES: Record<AppLanguage, string> = { fr: "Français", en: "English" };

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: deviceLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false }, // React already escapes
  showSupportNotice: false,
});

/** Current app language, for API calls (Accept-Language) and query keys. */
export function currentLanguage(): AppLanguage {
  return resolveLanguage(i18n.language);
}

export default i18n;
