import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { CatalogModule } from "./catalog/catalog.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { HouseholdModule } from "./household/household.module";
import { MatchModule } from "./match/match.module";
import { PrismaModule } from "./prisma/prisma.module";
import { WatchedModule } from "./watched/watched.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CatalogModule,
    HouseholdModule,
    FavoritesModule,
    WatchedModule,
    MatchModule,
    AiModule,
  ],
})
export class AppModule {}
