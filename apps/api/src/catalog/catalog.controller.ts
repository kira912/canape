import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import {
  discoverQuerySchema,
  mediaTypeSchema,
  searchQuerySchema,
  type AppLanguage,
  type DiscoverQuery,
  type MediaType,
  type SearchQuery,
} from "@canape/shared";
import { CacheFor } from "../common/cache-control";
import { Language } from "../common/language.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit } from "../rate-limit/rate-limit.guard";
import { CatalogService } from "./catalog.service";

/** Public and CDN-cached; each miss fans out to TMDB, hence a per-IP limit (only misses reach the API). */
@Controller()
@RateLimit("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("providers")
  @CacheFor("reference")
  providers(@Language() language: AppLanguage) {
    return this.catalog.listProviders(language);
  }

  @Get("genres/:mediaType")
  @CacheFor("reference")
  genres(
    @Param("mediaType", new ZodValidationPipe(mediaTypeSchema)) mediaType: MediaType,
    @Language() language: AppLanguage,
  ) {
    return this.catalog.listGenres(mediaType, language);
  }

  @Get("search")
  @CacheFor("catalog")
  search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery, @Language() language: AppLanguage) {
    return this.catalog.search(query.q, query.providers, language);
  }

  @Get("discover")
  @CacheFor("catalog")
  discover(@Query(new ZodValidationPipe(discoverQuerySchema)) query: DiscoverQuery, @Language() language: AppLanguage) {
    return this.catalog.discover(query, language);
  }

  @Get("titles/:mediaType/:id")
  @CacheFor("title")
  @RateLimit("title")
  title(
    @Param("mediaType", new ZodValidationPipe(mediaTypeSchema)) mediaType: MediaType,
    @Param("id", ParseIntPipe) id: number,
    @Language() language: AppLanguage,
  ) {
    return this.catalog.getTitle(mediaType, id, language);
  }
}
