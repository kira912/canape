import Head from "expo-router/head";
import { usePathname } from "expo-router";
import { Platform } from "react-native";
import { SITE } from "../constants/site";

export interface SeoProps {
  /** Page title, without the app name. Omit for the home page. */
  title?: string;
  description: string;
  /** Pages that only make sense signed in, or personal: kept out of search engines. */
  noindex?: boolean;
  /** Custom Open Graph and Twitter card image URL. */
  image?: string;
  /** Open Graph type: defaults to "website". */
  type?: "website" | "video.movie" | "video.tv_show" | "article";
  /** Schema.org structured data (JSON-LD). */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  /** Canonical URL override. */
  canonical?: string;
}

/**
 * Web only: per-page <title>, description, canonical URL, social preview and structured data.
 * The defaults live in public/index.html.
 */
export function Seo({ title, description, noindex, image, type = "website", jsonLd, canonical }: SeoProps) {
  const pathname = usePathname();
  if (Platform.OS !== "web") return null;

  const fullTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${description}`;
  const url = canonical ?? (SITE.url ? `${SITE.url}${pathname === "/" ? "" : pathname}` : undefined);
  const imageUrl = image ?? (SITE.url ? `${SITE.url}/og-image.png` : undefined);

  const structuredData = jsonLd
    ? Array.isArray(jsonLd)
      ? { "@context": "https://schema.org", "@graph": jsonLd }
      : { "@context": "https://schema.org", ...jsonLd }
    : null;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}
      {url ? <link rel="canonical" href={url} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {noindex ? (
        <meta name="robots" content="noindex, follow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}
      {structuredData ? (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      ) : null}
    </Head>
  );
}
