/**
 * Who publishes the app and how to reach them: shown in the legal pages
 * (mentions légales, privacy policy, terms). Fill in before going live —
 * `scripts/seo.mjs` warns at build time while a placeholder is left.
 */
export const SITE = {
  name: "Canapé",
  /** Production origin, no trailing slash (canonical URLs). Set by `scripts/seo.mjs` at build time on Vercel. */
  url: (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  /** Publisher (« éditeur ») and publication director: a natural person publishing as a private individual. */
  publisher: "Valentin Perot",
  /** Contact for legal requests and data-protection rights. */
  contactEmail: process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? "contact@example.com",
  /** Date of the current legal texts (ISO). Bump it whenever they change. */
  legalUpdatedAt: "2026-10-05",
} as const;

export const HOST = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723",
  website: "https://vercel.com",
  /**
   * Required by the LCEN (art. 6 III) alongside name and address, but Vercel
   * publishes none: ask their support, then fill it in (the build warns meanwhile).
   */
  phone: null as string | null,
} as const;
