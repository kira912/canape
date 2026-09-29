import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { resolveLanguage, type AppLanguage } from "@canape/shared";

/**
 * App language: the `lang` query parameter first (part of the URL, hence of the
 * CDN cache key), then `Accept-Language`.
 */
export const Language = createParamDecorator((_: unknown, ctx: ExecutionContext): AppLanguage => {
  const request = ctx.switchToHttp().getRequest();
  const fromQuery = typeof request.query?.lang === "string" ? request.query.lang : undefined;
  return resolveLanguage(fromQuery ?? request.headers["accept-language"]);
});
