import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { MemberGuard } from "../household/member.guard";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [CatalogModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, MemberGuard],
})
export class FavoritesModule {}
