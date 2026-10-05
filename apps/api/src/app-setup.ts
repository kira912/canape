import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { CacheControlInterceptor, noStoreByDefault } from "./common/cache-control";
import { requestLog } from "./common/request-log";

/** Shared by the local server (`main.ts`) and the Vercel function (`serverless.ts`). */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: config.get("CORS_ORIGIN") ?? "*" });
  app.use("/api", requestLog);
  app.use("/api", noStoreByDefault);
  app.useGlobalInterceptors(new CacheControlInterceptor(app.get(Reflector)));
  // Vercel's proxy sets X-Forwarded-* itself. Elsewhere only a local proxy (cloudflared/ngrok
  // tunnel) is trusted, so a client can't pick its own IP and dodge the rate limits.
  app.set("trust proxy", process.env.VERCEL ? true : "loopback");
}
