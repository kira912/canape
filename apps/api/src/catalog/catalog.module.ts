import { Module } from "@nestjs/common";
import { LinksService } from "../links/links.service";
import { StreamingAvailabilityClient } from "../links/streaming-availability.client";
import { TmdbClient } from "../tmdb/tmdb.client";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, TmdbClient, LinksService, StreamingAvailabilityClient],
  exports: [CatalogService],
})
export class CatalogModule {}
