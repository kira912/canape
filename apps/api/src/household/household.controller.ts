import { Body, Controller, Delete, Get, HttpCode, Post, Put, Req, UseGuards } from "@nestjs/common";
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  updateProvidersSchema,
} from "@canape/shared";
import type { Request } from "express";
import type { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "./current-member";
import { HouseholdService } from "./household.service";
import { MemberGuard } from "./member.guard";

@Controller()
export class HouseholdController {
  constructor(private readonly households: HouseholdService) {}

  @Post("households")
  create(@Body(new ZodValidationPipe(createHouseholdSchema)) body: z.output<typeof createHouseholdSchema>) {
    return this.households.create(body);
  }

  @Post("households/join")
  @HttpCode(200)
  join(@Body(new ZodValidationPipe(joinHouseholdSchema)) body: z.output<typeof joinHouseholdSchema>) {
    return this.households.join(body);
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

  /** Signs this device out (the member and their data stay). */
  @Delete("household/session")
  @UseGuards(MemberGuard)
  @HttpCode(204)
  async leave(@Req() request: Request) {
    await this.households.closeSession(request.headers.authorization!.slice(7).trim());
  }
}
