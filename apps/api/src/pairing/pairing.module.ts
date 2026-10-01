import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { MemberGuard } from "../household/member.guard";
import { PairingController } from "./pairing.controller";
import { PairingService } from "./pairing.service";

@Module({
  imports: [HouseholdModule],
  controllers: [PairingController],
  providers: [PairingService, MemberGuard],
})
export class PairingModule {}
