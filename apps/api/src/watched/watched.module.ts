import { Module } from "@nestjs/common";
import { MemberGuard } from "../household/member.guard";
import { WatchedController } from "./watched.controller";
import { WatchedService } from "./watched.service";

@Module({
  controllers: [WatchedController],
  providers: [WatchedService, MemberGuard],
})
export class WatchedModule {}
