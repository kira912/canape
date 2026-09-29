import { Module } from "@nestjs/common";
import { HouseholdController } from "./household.controller";
import { HouseholdService } from "./household.service";
import { MemberGuard } from "./member.guard";

@Module({
  controllers: [HouseholdController],
  providers: [HouseholdService, MemberGuard],
})
export class HouseholdModule {}
