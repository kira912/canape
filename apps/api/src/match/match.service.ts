import { Injectable, NotFoundException } from "@nestjs/common";
import {
  matchFiltersSchema,
  type AppLanguage,
  type MatchDeck,
  type MatchFilters,
  type MatchSession,
  type MatchState,
  type MatchVote,
  type MatchVoteResult,
  type MediaType,
  type TitleSummary,
} from "@canape/shared";
import { CatalogService } from "../catalog/catalog.service";
import type { AuthenticatedMember } from "../household/current-member";
import { PrismaService } from "../prisma/prisma.service";

/** Cards returned per deck request; the app asks for more when it runs low. */
export const DECK_SIZE = 10;
/** Discover pages scanned per request (20 titles each), to bound latency once many titles are voted. */
const MAX_PAGES_SCANNED = 8;

const titleKey = (mediaType: string, tmdbId: number) => `${mediaType}/${tmdbId}`;

@Injectable()
export class MatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async state(member: AuthenticatedMember, language: AppLanguage): Promise<MatchState> {
    const [session, memberCount] = await Promise.all([
      this.activeSession(member.householdId),
      this.prisma.member.count({ where: { householdId: member.householdId } }),
    ]);
    const matches = session ? await this.matches(session.id, memberCount, language) : [];
    return { session: session ? toSession(session) : null, matches, canMatch: memberCount >= 2 };
  }

  /** Starts a new evening; the previous one is closed (its votes and matches stay in the database). */
  async start(member: AuthenticatedMember, filters: MatchFilters): Promise<MatchSession> {
    const [, session] = await this.prisma.$transaction([
      this.prisma.matchSession.updateMany({
        where: { householdId: member.householdId, closedAt: null },
        data: { closedAt: new Date() },
      }),
      this.prisma.matchSession.create({
        data: { householdId: member.householdId, filters, createdById: member.memberId },
      }),
    ]);
    return toSession(session);
  }

  /**
   * Next cards for this member. Excludes titles they already voted on and titles
   * seen by anyone in the household. Titles the others liked come first (without
   * saying so), then the evening's discover results in a stable order shared by
   * every member.
   */
  async deck(member: AuthenticatedMember, language: AppLanguage): Promise<MatchDeck> {
    const session = await this.requireActiveSession(member.householdId);
    const filters = matchFiltersSchema.parse(session.filters);

    const [household, votes, watched] = await Promise.all([
      this.prisma.household.findUniqueOrThrow({ where: { id: member.householdId }, select: { providerIds: true } }),
      this.prisma.matchVote.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { memberId: true, mediaType: true, tmdbId: true, liked: true },
      }),
      this.prisma.watched.findMany({
        where: { householdId: member.householdId },
        select: { mediaType: true, tmdbId: true },
      }),
    ]);

    const excluded = new Set([
      ...votes.filter((v) => v.memberId === member.memberId).map((v) => titleKey(v.mediaType, v.tmdbId)),
      ...watched.map((w) => titleKey(w.mediaType, w.tmdbId)),
    ]);
    const picked: TitleSummary[] = [];
    const take = (title: TitleSummary) => {
      const key = titleKey(title.mediaType, title.tmdbId);
      if (excluded.has(key) || picked.length >= DECK_SIZE) return;
      excluded.add(key);
      picked.push(title);
    };

    const likedByOthers = votes
      .filter((v) => v.liked && v.memberId !== member.memberId)
      .map((v) => ({ mediaType: v.mediaType as MediaType, tmdbId: v.tmdbId }))
      .filter((ref) => !excluded.has(titleKey(ref.mediaType, ref.tmdbId)));
    if (likedByOthers.length) {
      (await this.catalog.getSummaries(dedupe(likedByOthers).slice(0, DECK_SIZE), language)).forEach(take);
    }

    for (let page = 1; page <= MAX_PAGES_SCANNED && picked.length < DECK_SIZE; page++) {
      const results = await this.catalog.discover(
        { ...filters, keywords: [], providers: household.providerIds, sort: "popularity", page },
        language,
      );
      results.items.forEach(take);
      if (page >= results.totalPages) break;
    }
    return { items: picked };
  }

  /** Records (or changes) a vote; returns the title when it completes a match. */
  async vote(member: AuthenticatedMember, vote: MatchVote, language: AppLanguage): Promise<MatchVoteResult> {
    const session = await this.requireActiveSession(member.householdId);
    const ref = { sessionId: session.id, memberId: member.memberId, mediaType: vote.mediaType, tmdbId: vote.tmdbId };
    await this.prisma.matchVote.upsert({
      where: { sessionId_memberId_mediaType_tmdbId: ref },
      create: { ...ref, liked: vote.liked },
      update: { liked: vote.liked },
    });
    if (!vote.liked) return { match: null };

    const [likes, memberCount] = await Promise.all([
      this.prisma.matchVote.count({
        where: { sessionId: session.id, mediaType: vote.mediaType, tmdbId: vote.tmdbId, liked: true },
      }),
      this.prisma.member.count({ where: { householdId: member.householdId } }),
    ]);
    if (memberCount < 2 || likes < memberCount) return { match: null };
    const [title] = await this.catalog.getSummaries([{ mediaType: vote.mediaType, tmdbId: vote.tmdbId }], language);
    return { match: title ?? null };
  }

  /** Titles liked by every member of the household during this evening, most recent first. */
  private async matches(sessionId: string, memberCount: number, language: AppLanguage): Promise<TitleSummary[]> {
    if (memberCount < 2) return [];
    const groups = await this.prisma.matchVote.groupBy({
      by: ["mediaType", "tmdbId"],
      where: { sessionId, liked: true },
      _count: { memberId: true },
      _max: { createdAt: true },
    });
    const refs = groups
      .filter((g) => g._count.memberId >= memberCount)
      .sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0))
      .map((g) => ({ mediaType: g.mediaType as MediaType, tmdbId: g.tmdbId }));
    return refs.length ? this.catalog.getSummaries(refs, language) : [];
  }

  private activeSession(householdId: string) {
    return this.prisma.matchSession.findFirst({
      where: { householdId, closedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  private async requireActiveSession(householdId: string) {
    const session = await this.activeSession(householdId);
    if (!session) throw new NotFoundException("Aucune soirée Match en cours");
    return session;
  }
}

function toSession(row: { id: string; filters: unknown; createdById: string; createdAt: Date }): MatchSession {
  return {
    id: row.id,
    filters: matchFiltersSchema.parse(row.filters),
    createdBy: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}

function dedupe(refs: { mediaType: MediaType; tmdbId: number }[]) {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = titleKey(r.mediaType, r.tmdbId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
