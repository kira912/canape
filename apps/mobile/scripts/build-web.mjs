// Web export (PWA) + SEO files. Run by `pnpm build` locally and by `vercel-build` on Vercel.
//
// - The site URL comes from SITE_URL, or on Vercel from the production domain (production)
//   or the deployment URL (previews). It feeds canonical URLs (EXPO_PUBLIC_SITE_URL),
//   the absolute URLs of index.html (%SITE_URL%), robots.txt and sitemap.xml.
// - Only production is indexable: previews and local builds get a robots.txt that disallows everything.
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const env = process.env;

const production = env.VERCEL_ENV ? env.VERCEL_ENV === "production" : env.SITE_URL !== undefined;
const vercelHost = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL;
const siteUrl = (env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : "http://localhost:3333")).replace(/\/$/, "");

/** Public pages worth indexing (the rest needs a household or is personal). */
const PUBLIC_PATHS = ["/welcome", "/legal/legal-notice", "/legal/privacy", "/legal/terms"];

execFileSync("npx", ["expo", "export", "-p", "web"], {
  cwd: root,
  stdio: "inherit",
  env: { ...env, EXPO_PUBLIC_API_URL: "/api", EXPO_PUBLIC_SITE_URL: siteUrl },
});

// QR scanner fallback decoder, self-hosted (see src/lib/scanner-setup.web.ts).
copyFileSync(
  createRequire(import.meta.url).resolve("zxing-wasm/reader/zxing_reader.wasm"),
  join(dist, "zxing_reader.wasm"),
);

const indexPath = join(dist, "index.html");
writeFileSync(indexPath, readFileSync(indexPath, "utf8").replaceAll("%SITE_URL%", siteUrl));

writeFileSync(
  join(dist, "robots.txt"),
  production
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);

writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PATHS.map(
    (path) => `  <url><loc>${siteUrl}${path}</loc></url>`,
  ).join("\n")}\n</urlset>\n`,
);

console.log(`SEO: ${siteUrl} (${production ? "indexable" : "noindex"})`);

const site = readFileSync(join(root, "src/constants/site.ts"), "utf8");
if (!env.EXPO_PUBLIC_CONTACT_EMAIL && site.includes("contact@example.com")) {
  console.warn(
    "\n⚠️  Legal pages: no contact email. Set EXPO_PUBLIC_CONTACT_EMAIL (or edit src/constants/site.ts) before going live.\n",
  );
}
