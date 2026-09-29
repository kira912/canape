import { Injectable, NotFoundException } from "@nestjs/common";
import type { MediaType, Watched, WatchedRef } from "@canape/shared";
import type { AuthenticatedMember } from "../household/current-member";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WatchedService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every title seen by at least one member of the household, grouped by title. */
  async list(member: AuthenticatedMember): Promise<Watched> {
    const rows = await this.prisma.watched.findMany({
      where: { householdId: member.householdId },
      orderBy: { createdAt: "asc" },
      select: { mediaType: true, tmdbId: true, memberId: true },
    });
    const byTitle = new Map<string, Watched["items"][number]>();
    for (const row of rows) {
      const key = `${row.mediaType}/${row.tmdbId}`;
      const entry = byTitle.get(key) ?? { mediaType: row.mediaType as MediaType, tmdbId: row.tmdbId, memberIds: [] };
      entry.memberIds.push(row.memberId);
      byTitle.set(key, entry);
    }
    return { items: [...byTitle.values()] };
  }

  /** Any member may tick for another one ("elle l'a vu"), but only within their own household. */
  async mark(member: AuthenticatedMember, ref: WatchedRef): Promise<void> {
    await this.assertSameHousehold(member, ref.memberId);
    await this.prisma.watched.upsert({
      where: { memberId_mediaType_tmdbId: { memberId: ref.memberId, mediaType: ref.mediaType, tmdbId: ref.tmdbId } },
      create: { householdId: member.householdId, memberId: ref.memberId, mediaType: ref.mediaType, tmdbId: ref.tmdbId },
      update: {},
    });
  }

  async unmark(member: AuthenticatedMember, ref: WatchedRef): Promise<void> {
    await this.prisma.watched.deleteMany({
      where: { householdId: member.householdId, memberId: ref.memberId, mediaType: ref.mediaType, tmdbId: ref.tmdbId },
    });
  }

  private async assertSameHousehold(member: AuthenticatedMember, memberId: string) {
    const target = await this.prisma.member.findFirst({
      where: { id: memberId, householdId: member.householdId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("Membre inconnu dans ce foyer");
  }
}
