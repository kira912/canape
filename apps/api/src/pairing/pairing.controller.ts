import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { claimPairingSchema } from "@canape/shared";
import type { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "../household/current-member";
import { MemberGuard } from "../household/member.guard";
import { PairingService } from "./pairing.service";

@Controller("pairings")
export class PairingController {
  constructor(private readonly pairings: PairingService) {}

  /** New device, signed out: starts a pairing and shows its id as a QR. */
  @Post()
  create(@Headers("user-agent") userAgent: string | undefined) {
    return this.pairings.create(userAgent);
  }

  @Get(":id")
  @UseGuards(MemberGuard)
  info(@Param("id") id: string) {
    return this.pairings.info(id);
  }

  @Post(":id/approve")
  @UseGuards(MemberGuard)
  @HttpCode(204)
  async approve(@Param("id") id: string, @CurrentMember() member: AuthenticatedMember) {
    await this.pairings.approve(id, member.memberId);
  }

  @Post(":id/claim")
  @HttpCode(200)
  claim(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(claimPairingSchema)) body: z.output<typeof claimPairingSchema>,
  ) {
    return this.pairings.claim(id, body.secret);
  }
}
