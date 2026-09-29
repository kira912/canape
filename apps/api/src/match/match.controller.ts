import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  matchFiltersSchema,
  matchVoteSchema,
  type AppLanguage,
  type MatchFilters,
  type MatchVote,
} from "@canape/shared";
import { Language } from "../common/language.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "../household/current-member";
import { MemberGuard } from "../household/member.guard";
import { MatchService } from "./match.service";

/** Household data: never cached (no @CacheFor → `private, no-store`). */
@Controller("match")
@UseGuards(MemberGuard)
export class MatchController {
  constructor(private readonly match: MatchService) {}

  @Get()
  state(@CurrentMember() member: AuthenticatedMember, @Language() language: AppLanguage) {
    return this.match.state(member, language);
  }

  @Post("sessions")
  start(
    @CurrentMember() member: AuthenticatedMember,
    @Body(new ZodValidationPipe(matchFiltersSchema)) filters: MatchFilters,
  ) {
    return this.match.start(member, filters);
  }

  @Get("deck")
  deck(@CurrentMember() member: AuthenticatedMember, @Language() language: AppLanguage) {
    return this.match.deck(member, language);
  }

  @Post("votes")
  @HttpCode(200)
  vote(
    @CurrentMember() member: AuthenticatedMember,
    @Body(new ZodValidationPipe(matchVoteSchema)) vote: MatchVote,
    @Language() language: AppLanguage,
  ) {
    return this.match.vote(member, vote, language);
  }
}
