import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

/**
 * Per-IP limits of the public routes. Generous for a person using the app,
 * tight enough that guessing invite/recovery codes or draining the upstream
 * quotas (TMDB, Streaming Availability) is not practical.
 */
export const RATE_LIMITS = {
  householdCreate: { limit: 10, windowSeconds: 60 * 60 },
  householdJoin: { limit: 10, windowSeconds: 15 * 60 },
  recover: { limit: 10, windowSeconds: 15 * 60 },
  pairingCreate: { limit: 20, windowSeconds: 10 * 60 },
  /** Polled every 2 s by the new device. */
  pairingClaim: { limit: 120, windowSeconds: 60 },
  catalog: { limit: 300, windowSeconds: 60 },
  title: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Fixed-window counters in Postgres: the API runs as many short-lived
 * serverless instances, so an in-memory counter would be per instance and
 * reset on every cold start.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Counts one hit; returns the number of hits in the current window, this one included. */
  async hit(key: string, policy: RateLimitPolicy, now = new Date()): Promise<number> {
    const windowMs = policy.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" = EXCLUDED."windowStart" THEN "RateLimit"."count" + 1 ELSE 1 END,
        "windowStart" = EXCLUDED."windowStart"
      RETURNING "count"`;
    return Number(row.count);
  }

  /** Throws 429 once `key` went over the policy in the current window. */
  async consume(key: string, policy: RateLimitPolicy, message = "Trop de demandes, réessayez plus tard"): Promise<void> {
    if ((await this.hit(key, policy)) > policy.limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Same, but lets the request through when the counter itself is unavailable:
   * for routes that don't otherwise need the database (catalog), an outage of
   * the limiter must not take the catalog down with it.
   */
  async consumeOrAllow(key: string, policy: RateLimitPolicy): Promise<void> {
    let count: number;
    try {
      count = await this.hit(key, policy);
    } catch (error) {
      this.logger.warn(`Rate limiter unavailable, request allowed: ${String(error)}`);
      return;
    }
    if (count > policy.limit) throw new HttpException("Trop de demandes, réessayez plus tard", HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Drops windows older than a day (the longest policy). */
  async purge(now = new Date()): Promise<number> {
    const { count } = await this.prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    return count;
  }
}
