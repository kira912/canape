// Vercel Web Analytics: cookieless, aggregated page views (see the privacy policy).
// The `react` entry, not `next`: this is an Expo Router export, and the script
// picks up client-side navigations through the History API on its own.
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

/**
 * Right to object (CNIL's consent exemption requires one): a browser sending
 * Global Privacy Control or Do Not Track never loads the script.
 */
function objects(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function Analytics() {
  return objects() ? null : <VercelAnalytics />;
}
