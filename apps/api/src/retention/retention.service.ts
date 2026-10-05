import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RateLimitService } from "../rate-limit/rate-limit.service";

/** Personal data is kept while it's used: a session (device) unused for this long is deleted. */
export const INACTIVITY_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimits: RateLimitService,
  ) {}

  /**
   * Deletes sessions unused for `INACTIVITY_DAYS`, then the households left
   * without any session (members, lists, votes go with them by cascade).
   * A recent household is spared: its devices may simply be signed out for now.
   * Also drops expired QR pairings and past rate-limit windows.
   */
  async purgeInactive(
    now = new Date(),
  ): Promise<{ sessions: number; households: number; pairings: number; rateLimits: number }> {
    const cutoff = new Date(now.getTime() - INACTIVITY_DAYS * DAY_MS);
    const sessions = await this.prisma.session.deleteMany({ where: { lastUsedAt: { lt: cutoff } } });
    const households = await this.prisma.household.deleteMany({
      where: { createdAt: { lt: cutoff }, members: { none: { sessions: { some: {} } } } },
    });
    // QR pairings live 5 minutes; keep a day for debugging.
    const pairings = await this.prisma.devicePairing.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - DAY_MS) } },
    });
    const rateLimits = await this.rateLimits.purge(now);
    return { sessions: sessions.count, households: households.count, pairings: pairings.count, rateLimits };
  }
}
