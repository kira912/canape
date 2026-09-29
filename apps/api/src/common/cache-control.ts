import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { tap, type Observable } from "rxjs";

/**
 * HTTP cache profiles. On Vercel the in-memory TtlCache only lives as long as
 * one function instance, so shared caching relies on the CDN honouring
 * `s-maxage` / `stale-while-revalidate`.
 *
 * - `max-age`: the browser (short, React Query already caches in memory).
 * - `s-maxage`: the CDN, shared by every user — only for responses that don't
 *   depend on who is asking. The language is part of the URL (`?lang=`), so
 *   the CDN key never mixes languages.
 */
export const CACHE_PROFILES = {
  /** Platforms and genres lists: change a few times a year. */
  reference: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  /** Search / discover: catalogues and availability move daily. */
  catalog: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  /** Title page (incl. Streaming Availability links, a paid quota). */
  title: "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
  /** Household-specific data (session, favorites) and every mutation or error. */
  private: "private, no-store",
} as const;

export type CacheProfile = keyof typeof CACHE_PROFILES;

const CACHE_PROFILE_KEY = "cacheProfile";

/** Marks a GET route as cacheable. Routes without it stay `private, no-store`. */
export const CacheFor = (profile: Exclude<CacheProfile, "private">) => SetMetadata(CACHE_PROFILE_KEY, profile);

/**
 * Sets the profile only once the handler succeeded: errors (TMDB down, 404…)
 * keep the `private, no-store` default applied by `noStoreByDefault`, so a
 * failure is never cached by the CDN.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const profile = this.reflector.get<CacheProfile | undefined>(CACHE_PROFILE_KEY, context.getHandler());
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (profile && request.method === "GET") response.setHeader("Cache-Control", CACHE_PROFILES[profile]);
      }),
    );
  }
}

/** Express middleware: every API response is uncacheable unless a route opts in. */
export function noStoreByDefault(_req: unknown, res: Response, next: () => void) {
  res.setHeader("Cache-Control", CACHE_PROFILES.private);
  next();
}
