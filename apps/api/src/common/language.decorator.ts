import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { DEFAULT_LANGUAGE, resolveLanguage, type AppLanguage } from "@canape/shared";
import { CACHE_PROFILE_KEY } from "./cache-control";

/**
 * App language: the `lang` query parameter first (part of the URL, hence of the
 * CDN cache key), then `Accept-Language` — except on CDN-cached routes, where a
 * header the cache key doesn't see would let the first visitor's language be
 * served to everyone requesting that URL.
 */
export const Language = createParamDecorator((_: unknown, ctx: ExecutionContext): AppLanguage => {
  const request = ctx.switchToHttp().getRequest();
  const fromQuery = typeof request.query?.lang === "string" ? request.query.lang : undefined;
  if (fromQuery) return resolveLanguage(fromQuery);
  const cached = Reflect.getMetadata(CACHE_PROFILE_KEY, ctx.getHandler()) !== undefined;
  return cached ? DEFAULT_LANGUAGE : resolveLanguage(request.headers["accept-language"]);
});
