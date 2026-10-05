import "reflect-metadata";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { configureApp } from "./app-setup";
import { AppModule } from "./app.module";

/**
 * Local server. On Vercel the PWA is served by the CDN and the API runs as a
 * function (`serverless.ts`); here the API also serves the PWA build
 * (`pnpm --filter @canape/mobile build`) so a single tunnel is enough to test on phones.
 */
const WEB_DIST = resolve(__dirname, "../../mobile/dist");
const VERCEL_CONFIG = resolve(__dirname, "../../../vercel.json");

/** The site-wide headers of vercel.json (CSP, HSTS…), so the local PWA behaves like production. */
function siteHeaders(): [string, string][] {
  if (!existsSync(VERCEL_CONFIG)) return [];
  const config = JSON.parse(readFileSync(VERCEL_CONFIG, "utf8")) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[];
  };
  return (config.headers?.find((rule) => rule.source === "/(.*)")?.headers ?? []).map((h) => [h.key, h.value]);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);

  if (existsSync(WEB_DIST)) {
    const headers = siteHeaders();
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith("/api")) for (const [key, value] of headers) res.setHeader(key, value);
      next();
    });
    app.useStaticAssets(WEB_DIST, { index: false });
    // SPA fallback: any non-API GET renders the app shell (expo-router handles the route).
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(join(WEB_DIST, "index.html"));
    });
  }

  const port = config.get("PORT") ?? 3333;
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`canape-api listening on :${port}${existsSync(WEB_DIST) ? " (+ PWA)" : ""}`);
}

bootstrap();
