import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { CacheControlInterceptor, noStoreByDefault } from "./common/cache-control";

/** Shared by the local server (`main.ts`) and the Vercel function (`serverless.ts`). */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: config.get("CORS_ORIGIN") ?? "*" });
  app.use("/api", noStoreByDefault);
  app.useGlobalInterceptors(new CacheControlInterceptor(app.get(Reflector)));
  // The API sits behind Vercel's proxy / a tunnel: trust X-Forwarded-* for req.ip / protocol.
  app.set("trust proxy", true);
}
