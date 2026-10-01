import { Controller, Get, Headers, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { RetentionService } from "./retention.service";

/** Called daily by Vercel Cron (`crons` in vercel.json), which sends `Authorization: Bearer $CRON_SECRET`. */
@Controller("cron")
export class RetentionController {
  constructor(
    private readonly retention: RetentionService,
    private readonly config: ConfigService,
  ) {}

  @Get("purge")
  purge(@Headers("authorization") authorization: string | undefined) {
    const secret = this.config.get<string>("CRON_SECRET");
    if (!secret) throw new NotFoundException();
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(authorization ?? "");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException();
    }
    return this.retention.purgeInactive();
  }
}
