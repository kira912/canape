import { Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from "@nestjs/common";
import { watchedRefSchema, type WatchedRef } from "@canape/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "../household/current-member";
import { MemberGuard } from "../household/member.guard";
import { WatchedService } from "./watched.service";

/** Household data: never cached (no @CacheFor → `private, no-store`). */
@Controller("watched")
@UseGuards(MemberGuard)
export class WatchedController {
  constructor(private readonly watched: WatchedService) {}

  @Get()
  list(@CurrentMember() member: AuthenticatedMember) {
    return this.watched.list(member);
  }

  @Put(":mediaType/:tmdbId/:memberId")
  @HttpCode(204)
  mark(@CurrentMember() member: AuthenticatedMember, @Param(new ZodValidationPipe(watchedRefSchema)) ref: WatchedRef) {
    return this.watched.mark(member, ref);
  }

  @Delete(":mediaType/:tmdbId/:memberId")
  @HttpCode(204)
  unmark(
    @CurrentMember() member: AuthenticatedMember,
    @Param(new ZodValidationPipe(watchedRefSchema)) ref: WatchedRef,
  ) {
    return this.watched.unmark(member, ref);
  }
}
