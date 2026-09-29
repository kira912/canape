import { Injectable } from "@nestjs/common";
import type { AppLanguage, FavoriteItem, FavoriteRef, Favorites, MediaType } from "@canape/shared";
import { CatalogService } from "../catalog/catalog.service";
import type { AuthenticatedMember } from "../household/current-member";
import { PrismaService } from "../prisma/prisma.service";

export const HOUSEHOLD_LIST_KEY = "household";

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /** Both lists, newest first, each title enriched with its current offers (cached TMDB calls). */
  async list(member: AuthenticatedMember, language: AppLanguage): Promise<Favorites> {
    const rows = await this.prisma.favorite.findMany({
      where: { householdId: member.householdId, listKey: { in: [HOUSEHOLD_LIST_KEY, member.memberId] } },
      orderBy: { createdAt: "desc" },
    });
    const titles = await this.catalog.getSummaries(
      rows.map((row) => ({ mediaType: row.mediaType as MediaType, tmdbId: row.tmdbId })),
      language,
    );
    const byKey = new Map(titles.map((t) => [`${t.mediaType}/${t.tmdbId}`, t]));

    const toItems = (listKey: string): FavoriteItem[] =>
      rows
        .filter((row) => row.listKey === listKey)
        .flatMap((row) => {
          const title = byKey.get(`${row.mediaType}/${row.tmdbId}`);
          // A title TMDB can't resolve anymore is skipped rather than failing the whole list.
          return title ? [{ title, addedBy: row.addedById, addedAt: row.createdAt.toISOString() }] : [];
        });

    return { household: toItems(HOUSEHOLD_LIST_KEY), mine: toItems(member.memberId) };
  }

  async add(member: AuthenticatedMember, ref: FavoriteRef): Promise<void> {
    const listKey = listKeyFor(member, ref);
    await this.prisma.favorite.upsert({
      where: {
        householdId_listKey_mediaType_tmdbId: {
          householdId: member.householdId,
          listKey,
          mediaType: ref.mediaType,
          tmdbId: ref.tmdbId,
        },
      },
      create: {
        householdId: member.householdId,
        listKey,
        ownerId: ref.list === "me" ? member.memberId : null,
        addedById: member.memberId,
        mediaType: ref.mediaType,
        tmdbId: ref.tmdbId,
      },
      update: {},
    });
  }

  async remove(member: AuthenticatedMember, ref: FavoriteRef): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: {
        householdId: member.householdId,
        listKey: listKeyFor(member, ref),
        mediaType: ref.mediaType,
        tmdbId: ref.tmdbId,
      },
    });
  }
}

function listKeyFor(member: AuthenticatedMember, ref: FavoriteRef): string {
  return ref.list === "household" ? HOUSEHOLD_LIST_KEY : member.memberId;
}
