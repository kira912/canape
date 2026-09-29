import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import {
  aiMatchCriteriaRequestSchema,
  aiSearchQuerySchema,
  type AiMatchCriteriaRequest,
  type AiSearchQuery,
  type AppLanguage,
} from "@canape/shared";
import { Language } from "../common/language.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "../household/current-member";
import { MemberGuard } from "../household/member.guard";
import { AiService } from "./ai.service";

/** Members only (AI calls cost money), never CDN-cached (no @CacheFor). */
@Controller("ai")
@UseGuards(MemberGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("search")
  search(
    @CurrentMember() member: AuthenticatedMember,
    @Query(new ZodValidationPipe(aiSearchQuerySchema)) query: AiSearchQuery,
    @Language() language: AppLanguage,
  ) {
    return this.ai.search(member, query.q, query.providers, language);
  }

  @Post("match-criteria")
  @HttpCode(200)
  matchCriteria(
    @CurrentMember() member: AuthenticatedMember,
    @Body(new ZodValidationPipe(aiMatchCriteriaRequestSchema)) body: AiMatchCriteriaRequest,
    @Language() language: AppLanguage,
  ) {
    return this.ai.matchCriteria(member, body.moods, language);
  }
}
