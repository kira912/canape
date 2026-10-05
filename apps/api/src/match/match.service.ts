import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import {
  DEFAULT_LANGUAGE,
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
/** Discover pages drawn when an evening starts (20 titles each): enough cards for a long evening. */
export const DECK_PAGES = 15;

const deckSchema = z.array(z.string().regex(/^(movie|tv)\/\d+$/)).catch([]);

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

  /**
   * Starts a new evening; the previous one is closed (its votes and matches stay in the database).
   * The deck is drawn now, once: every member gets the same order for the whole evening.
   */
  async start(member: AuthenticatedMember, filters: MatchFilters): Promise<MatchSession> {
    const deck = await this.drawDeck(member.householdId, filters);
    const [, session] = await this.prisma.$transaction([
      this.prisma.matchSession.updateMany({
        where: { householdId: member.householdId, closedAt: null },
        data: { closedAt: new Date() },
      }),
      this.prisma.matchSession.create({
        data: { householdId: member.householdId, filters, createdById: member.memberId, deck },
      }),
    ]);
    return toSession(session);
  }

  /** Closes the current evening, if any (its votes and matches stay in the database). */
  async end(member: AuthenticatedMember): Promise<void> {
    await this.prisma.matchSession.updateMany({
      where: { householdId: member.householdId, closedAt: null },
      data: { closedAt: new Date() },
    });
  }

  /**
   * Next cards for this member. Excludes titles they already voted on and titles
   * seen by anyone in the household. Titles the others liked come first (without
   * saying so), then the evening's deck in its stored order, shared by every member.
   */
  async deck(member: AuthenticatedMember, language: AppLanguage): Promise<MatchDeck> {
    const session = await this.requireActiveSession(member.householdId);
    const [deck, votes, watched] = await Promise.all([
      this.sessionDeck(session),
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
    const likedByOthers = votes
      .filter((v) => v.liked && v.memberId !== member.memberId)
      .map((v) => titleKey(v.mediaType, v.tmdbId));
    const next: string[] = [];
    for (const key of [...likedByOthers, ...deck]) {
      if (next.length >= DECK_SIZE) break;
      if (excluded.has(key)) continue;
      excluded.add(key);
      next.push(key);
    }
    // Titles TMDB can't resolve anymore are dropped by getSummaries: the app asks for more when it runs low.
    return { items: next.length ? await this.catalog.getSummaries(next.map(parseKey), language) : [] };
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

  /** The household's discover results for these filters, as "movie/550" keys (one list call per page). */
  private async drawDeck(householdId: string, filters: MatchFilters): Promise<string[]> {
    const { providerIds } = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { providerIds: true },
    });
    const refs = await this.catalog.discoverRefs(
      { ...filters, keywords: [], providers: providerIds, sort: "popularity" },
      DEFAULT_LANGUAGE, // the order doesn't depend on the language; titles are fetched per request
      DECK_PAGES,
    );
    return refs.map((ref) => titleKey(ref.mediaType, ref.tmdbId));
  }

  /** Evenings started before decks were stored get theirs on first use. */
  private async sessionDeck(session: { id: string; householdId: string; filters: unknown; deck: unknown }) {
    const stored = deckSchema.parse(session.deck);
    if (stored.length) return stored;
    const deck = await this.drawDeck(session.householdId, matchFiltersSchema.parse(session.filters));
    if (deck.length) await this.prisma.matchSession.update({ where: { id: session.id }, data: { deck } });
    return deck;
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

function parseKey(key: string): { mediaType: MediaType; tmdbId: number } {
  const [mediaType, tmdbId] = key.split("/");
  return { mediaType: mediaType as MediaType, tmdbId: Number(tmdbId) };
}
