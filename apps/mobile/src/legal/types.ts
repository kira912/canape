export const LEGAL_DOCS = ["legal-notice", "privacy", "terms"] as const;
export type LegalDocId = (typeof LEGAL_DOCS)[number];

/** A paragraph, or a bullet list. */
export type LegalBlock = string | readonly string[];

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** Meta description of the page (search engines). */
  description: string;
  sections: readonly LegalSection[];
}

export type LegalTexts = Record<LegalDocId, LegalDoc>;

export function isLegalDoc(value: unknown): value is LegalDocId {
  return typeof value === "string" && (LEGAL_DOCS as readonly string[]).includes(value);
}
