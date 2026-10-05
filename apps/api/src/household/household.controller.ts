import { Body, Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from "@nestjs/common";
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  recoverSchema,
  updateMemberSchema,
  updateProvidersSchema,
} from "@canape/shared";
import type { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit } from "../rate-limit/rate-limit.guard";
import { CurrentMember, CurrentSessionId, type AuthenticatedMember } from "./current-member";
import { HouseholdService } from "./household.service";
import { MemberGuard } from "./member.guard";

@Controller()
export class HouseholdController {
  constructor(private readonly households: HouseholdService) {}

  @Post("households")
  @RateLimit("householdCreate")
  create(@Body(new ZodValidationPipe(createHouseholdSchema)) body: z.output<typeof createHouseholdSchema>) {
    return this.households.create(body);
  }

  @Post("households/join")
  @RateLimit("householdJoin")
  @HttpCode(200)
  join(@Body(new ZodValidationPipe(joinHouseholdSchema)) body: z.output<typeof joinHouseholdSchema>) {
    return this.households.join(body);
  }

  @Post("households/recover")
  @RateLimit("recover")
  @HttpCode(200)
  recover(@Body(new ZodValidationPipe(recoverSchema)) body: z.output<typeof recoverSchema>) {
    return this.households.recover(body.recoveryCode);
  }

  @Get("household")
  @UseGuards(MemberGuard)
  me(@CurrentMember() member: AuthenticatedMember) {
    return this.households.me(member.memberId, member.householdId);
  }

  @Put("household/providers")
  @UseGuards(MemberGuard)
  updateProviders(
    @CurrentMember() member: AuthenticatedMember,
    @Body(new ZodValidationPipe(updateProvidersSchema)) body: z.output<typeof updateProvidersSchema>,
  ) {
    return this.households.updateProviders(member.householdId, body.providerIds);
  }

  /** Replaces the invite code; the previous one stops working. */
  @Post("household/invite-code")
  @UseGuards(MemberGuard)
  @HttpCode(200)
  regenerateInviteCode(@CurrentMember() member: AuthenticatedMember) {
    return this.households.regenerateInviteCode(member.householdId);
  }

  @Put("household/member")
  @UseGuards(MemberGuard)
  updateMember(
    @CurrentMember() member: AuthenticatedMember,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: z.output<typeof updateMemberSchema>,
  ) {
    return this.households.updateMember(member.memberId, member.householdId, body);
  }

  /** A new personal recovery code, returned once; the previous one stops working. */
  @Post("household/member/recovery-code")
  @UseGuards(MemberGuard)
  @HttpCode(200)
  regenerateRecoveryCode(@CurrentMember() member: AuthenticatedMember) {
    return this.households.regenerateRecoveryCode(member.memberId);
  }

  /** Deletes the member and all their data (every device is signed out). */
  @Delete("household/member")
  @UseGuards(MemberGuard)
  @HttpCode(204)
  async deleteMember(@CurrentMember() member: AuthenticatedMember) {
    await this.households.deleteMember(member.memberId, member.householdId);
  }

  /** Signs this device out (the member and their data stay). */
  @Delete("household/session")
  @UseGuards(MemberGuard)
  @HttpCode(204)
  async leave(@CurrentSessionId() sessionId: string) {
    await this.households.closeSession(sessionId);
  }

  /** Signs the member out of every other device. */
  @Delete("household/sessions/others")
  @UseGuards(MemberGuard)
  @HttpCode(204)
  async leaveOthers(@CurrentMember() member: AuthenticatedMember, @CurrentSessionId() sessionId: string) {
    await this.households.closeOtherSessions(member.memberId, sessionId);
  }
}
