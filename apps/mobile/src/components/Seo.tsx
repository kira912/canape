import Head from "expo-router/head";
import { usePathname } from "expo-router";
import { Platform } from "react-native";
import { SITE } from "../constants/site";

interface Props {
  /** Page title, without the app name. Omit for the home page. */
  title?: string;
  description: string;
  /** Pages that only make sense signed in, or personal: kept out of search engines. */
  noindex?: boolean;
}

/**
 * Web only: per-page <title>, description, canonical URL and social preview.
 * The defaults (shared preview image, JSON-LD) live in public/index.html.
 */
export function Seo({ title, description, noindex }: Props) {
  const pathname = usePathname();
  if (Platform.OS !== "web") return null;
  const fullTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${description}`;
  const url = SITE.url ? `${SITE.url}${pathname === "/" ? "" : pathname}` : undefined;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {url ? <link rel="canonical" href={url} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {noindex ? <meta name="robots" content="noindex" /> : null}
    </Head>
  );
}
