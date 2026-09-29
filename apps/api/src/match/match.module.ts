import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { MemberGuard } from "../household/member.guard";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";

@Module({
  imports: [CatalogModule],
  controllers: [MatchController],
  providers: [MatchService, MemberGuard],
})
export class MatchModule {}
