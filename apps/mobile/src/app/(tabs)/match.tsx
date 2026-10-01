import Ionicons from "@expo/vector-icons/Ionicons";
import type { Household, MatchFilters, MatchSession, MediaType, TitleSummary } from "@canape/shared";
import { useIsMutating } from "@tanstack/react-query";
import { router, useIsFocused } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { ChipRow, ChipSeparator } from "../../components/ChipRow";
import { EmptyState } from "../../components/EmptyState";
import { MatchModal } from "../../components/MatchModal";
import { PageTitle } from "../../components/PageTitle";
import { SwipeCard, type SwipeCardHandle } from "../../components/SwipeCard";
import { TextField } from "../../components/TextField";
import { TitleRow } from "../../components/TitleRow";
import { colors, spacing } from "../../constants/theme";
import { errorMessage } from "../../lib/error-message";
import { RATING_OPTIONS, RUNTIME_OPTIONS } from "../../lib/filter-options";
import { formatRuntime } from "../../lib/labels";
import { centered } from "../../lib/layout";
import {
  MATCH_VOTE_KEY,
  useAiMatchCriteria,
  useEndMatch,
  useGenres,
  useHouseholdProviderIds,
  useMatchDeck,
  useMatchState,
  useMatchVote,
  useMe,
  useProvidersById,
  useStartMatch,
} from "../../lib/queries";

const titleKey = (t: Pick<TitleSummary, "mediaType" | "tmdbId">) => `${t.mediaType}/${t.tmdbId}`;

export default function MatchScreen() {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const me = useMe();
  const state = useMatchState({ poll: focused });
  const [editing, setEditing] = useState(false);
  const [shownMatch, setShownMatch] = useState<TitleSummary | null>(null);
  // Matches already on screen, per evening: a match completed by the other member
  // arrives through polling and is announced once; the first load of an evening is not.
  const knownMatches = useRef<{ sessionId: string; keys: Set<string> } | null>(null);

  useEffect(() => {
    const sessionId = state.data?.session?.id;
    const matches = state.data?.matches;
    if (!sessionId || !matches) return;
    const known = knownMatches.current;
    if (known?.sessionId === sessionId) {
      const fresh = matches.find((m) => !known.keys.has(titleKey(m)));
      if (fresh) setShownMatch(fresh);
    }
    knownMatches.current = { sessionId, keys: new Set(matches.map(titleKey)) };
  }, [state.data?.session?.id, state.data?.matches]);

  const announce = (title: TitleSummary) => {
    knownMatches.current?.keys.add(titleKey(title));
    setShownMatch(title);
  };

  let content: ReactNode;
  if (state.isPending || me.isPending) {
    content = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  } else if (state.isError) {
    content = (
      <EmptyState
        icon="cloud-offline-outline"
        title={t("common.loadingError")}
        message={errorMessage(t, state.error)}
      />
    );
  } else if (!state.data.canMatch) {
    content = (
      <EmptyState
        icon="people-outline"
        title={t("match.needPartnerTitle")}
        message={t("match.needPartnerMessage", { code: me.data?.household.inviteCode ?? "" })}
      >
        <Button label={t("tabs.household")} onPress={() => router.navigate("/settings")} />
      </EmptyState>
    );
  } else if (!state.data.session || editing) {
    content = (
      <MatchSetup
        initial={state.data.session?.filters}
        onStarted={() => setEditing(false)}
        onCancel={state.data.session ? () => setEditing(false) : undefined}
      />
    );
  } else {
    content = (
      <Evening
        session={state.data.session}
        matches={state.data.matches}
        household={me.data?.household}
        onNewEvening={() => setEditing(true)}
        onMatch={announce}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, centered()]}>
        <PageTitle>{t("tabs.matchHeader")}</PageTitle>
        {content}
      </ScrollView>
      <MatchModal
        title={shownMatch}
        onClose={() => setShownMatch(null)}
        onOpen={(title) => {
          setShownMatch(null);
          router.push({
            pathname: "/title/[mediaType]/[id]",
            params: { mediaType: title.mediaType, id: title.tmdbId },
          });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Setup: criteria of the evening
// ---------------------------------------------------------------------------

function MatchSetup({
  initial,
  onStarted,
  onCancel,
}: {
  initial?: MatchFilters;
  onStarted: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [mediaType, setMediaType] = useState<MediaType>(initial?.mediaType ?? "movie");
  const [genres, setGenres] = useState<number[]>(initial?.genres ?? []);
  const [maxRuntime, setMaxRuntime] = useState<number | undefined>(initial?.maxRuntime);
  const [minRating, setMinRating] = useState<number | undefined>(initial?.minRating);
  const genreList = useGenres(mediaType);
  const start = useStartMatch();
  const me = useMe();
  const members = me.data?.household.members ?? [];
  const [moods, setMoods] = useState<Record<string, string>>({});
  const [explanation, setExplanation] = useState<string | null>(null);
  const suggest = useAiMatchCriteria();
  // The AI may pick a runtime that isn't one of the chips (e.g. 110 min): show it as an extra chip.
  const runtimeOptions: number[] =
    maxRuntime && !(RUNTIME_OPTIONS as readonly number[]).includes(maxRuntime)
      ? [...RUNTIME_OPTIONS, maxRuntime].sort((a, b) => a - b)
      : [...RUNTIME_OPTIONS];

  const switchMediaType = (next: MediaType) => {
    setMediaType(next);
    setGenres([]); // movie and TV genre ids differ
  };

  const propose = () => {
    const texts = members.map((m) => moods[m.id]?.trim()).filter((m): m is string => Boolean(m));
    if (!texts.length) return;
    suggest.mutate(texts, {
      onSuccess: ({ filters, explanation: why }) => {
        setMediaType(filters.mediaType);
        setGenres(filters.genres);
        setMaxRuntime(filters.maxRuntime);
        setMinRating(filters.minRating);
        setExplanation(why);
      },
    });
  };

  return (
    <View style={styles.setup}>
      <Text style={styles.sectionTitle}>{t("match.setupTitle")}</Text>
      <Text style={styles.intro}>{t("match.setupIntro")}</Text>

      <View style={styles.moods}>
        <Text style={styles.moodsTitle}>{t("ai.moodsTitle")}</Text>
        <Text style={styles.moodsIntro}>{t("ai.moodsIntro")}</Text>
        {members.map((member) => (
          <TextField
            key={member.id}
            value={moods[member.id] ?? ""}
            onChangeText={(text) => setMoods((current) => ({ ...current, [member.id]: text }))}
            placeholder={t("ai.moodPlaceholder", { name: member.name })}
            maxLength={200}
          />
        ))}
        <Button label={suggest.isPending ? t("ai.proposing") : t("ai.propose")} variant="ghost" onPress={propose} />
        {suggest.isError ? <Text style={styles.error}>{errorMessage(t, suggest.error)}</Text> : null}
        {explanation ? <Text style={styles.explanation}>✨ {explanation}</Text> : null}
      </View>

      <View style={styles.filters}>
        <ChipRow>
          <Chip
            label={t("mediaTypePlural.movie")}
            selected={mediaType === "movie"}
            onPress={() => switchMediaType("movie")}
          />
          <Chip label={t("mediaTypePlural.tv")} selected={mediaType === "tv"} onPress={() => switchMediaType("tv")} />
          <ChipSeparator />
          {mediaType === "movie"
            ? runtimeOptions.map((r) => (
                <Chip
                  key={r}
                  label={t("common.underDuration", { duration: formatRuntime(t, r) })}
                  selected={maxRuntime === r}
                  onPress={() => setMaxRuntime(maxRuntime === r ? undefined : r)}
                />
              ))
            : null}
          {RATING_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={t("common.rating", { value: r })}
              selected={minRating === r}
              onPress={() => setMinRating(minRating === r ? undefined : r)}
            />
          ))}
        </ChipRow>
        <ChipRow>
          {(genreList.data ?? []).map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={genres.includes(g.id)}
              onPress={() => setGenres((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
            />
          ))}
        </ChipRow>
      </View>
      {start.isError ? <Text style={styles.error}>{errorMessage(t, start.error)}</Text> : null}
      <View style={styles.setupActions}>
        <Button
          label={start.isPending ? "…" : t("match.start")}
          onPress={() =>
            start.mutate(
              { mediaType, genres, maxRuntime: mediaType === "movie" ? maxRuntime : undefined, minRating },
              { onSuccess: onStarted },
            )
          }
        />
        {onCancel ? <Button label={t("match.cancel")} variant="ghost" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Evening: the deck + the matches so far
// ---------------------------------------------------------------------------

function Evening({
  session,
  matches,
  household,
  onNewEvening,
  onMatch,
}: {
  session: MatchSession;
  matches: TitleSummary[];
  household: Household | undefined;
  onNewEvening: () => void;
  onMatch: (title: TitleSummary) => void;
}) {
  const { t } = useTranslation();
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const genres = useGenres(session.filters.mediaType);
  const deck = useMatchDeck(session.id);
  const vote = useMatchVote();
  const votesInFlight = useIsMutating({ mutationKey: MATCH_VOTE_KEY });
  const [voted, setVoted] = useState<Set<string>>(() => new Set());
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const cardRef = useRef<SwipeCardHandle>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 380);
  const cardHeight = Math.min(cardWidth * 1.5, windowHeight * 0.58);
  const cards = useMemo(() => (deck.data?.items ?? []).filter((c) => !voted.has(titleKey(c))), [deck.data, voted]);

  // Running low → fetch more (the API skips what I voted). Wait for pending votes so they aren't served again.
  const serverHadCards = (deck.data?.items.length ?? 0) > 0;
  useEffect(() => {
    if (cards.length <= 3 && serverHadCards && !deck.isFetching && votesInFlight === 0) void deck.refetch();
  }, [cards.length, serverHadCards, deck.isFetching, votesInFlight, deck]);

  const onSwiped = (title: TitleSummary, liked: boolean) => {
    setVoted((prev) => new Set(prev).add(titleKey(title)));
    vote.mutate(
      { mediaType: title.mediaType, tmdbId: title.tmdbId, liked },
      { onSuccess: (result) => result.match && onMatch(result.match) },
    );
  };

  // Web: ← / → keys vote on the top card.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") cardRef.current?.swipe(true);
      if (event.key === "ArrowLeft") cardRef.current?.swipe(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const summary = [
    t(`mediaTypePlural.${session.filters.mediaType}`),
    session.filters.maxRuntime
      ? t("common.underDuration", { duration: formatRuntime(t, session.filters.maxRuntime) })
      : null,
    session.filters.minRating ? t("common.rating", { value: session.filters.minRating }) : null,
    ...(genres.data ?? []).filter((g) => session.filters.genres.includes(g.id)).map((g) => g.name),
  ]
    .filter(Boolean)
    .join(" · ");

  const [top, next] = cards;

  return (
    <View style={styles.evening}>
      <View style={styles.eveningHeader}>
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
        <Pressable onPress={onNewEvening} style={styles.headerAction} accessibilityRole="button">
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={styles.headerActionLabel}>{t("match.newEvening")}</Text>
        </Pressable>
        <Pressable onPress={() => setConfirmingEnd(true)} style={styles.headerAction} accessibilityRole="button">
          <Ionicons name="stop-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.headerActionLabel}>{t("match.end")}</Text>
        </Pressable>
      </View>
      {confirmingEnd ? <EndEvening onCancel={() => setConfirmingEnd(false)} /> : null}

      <View style={[styles.deck, { height: cardHeight }]}>
        {deck.isPending || (!top && deck.isFetching) ? (
          <ActivityIndicator color={colors.primary} />
        ) : deck.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t("common.loadingError")}
            message={errorMessage(t, deck.error)}
          />
        ) : !top ? (
          <EmptyState icon="checkmark-done-outline" title={t("match.emptyTitle")} message={t("match.emptyMessage")}>
            <Button label={t("match.newEvening")} onPress={onNewEvening} />
          </EmptyState>
        ) : (
          <>
            {next ? (
              <View style={[styles.nextCard, { width: cardWidth, height: cardHeight }]} pointerEvents="none" />
            ) : null}
            <SwipeCard
              key={titleKey(top)}
              ref={cardRef}
              title={top}
              width={cardWidth}
              height={cardHeight}
              householdProviderIds={providerIds}
              providersById={providersById}
              onSwiped={(liked) => onSwiped(top, liked)}
              onOpenDetails={() =>
                router.push({
                  pathname: "/title/[mediaType]/[id]",
                  params: { mediaType: top.mediaType, id: top.tmdbId },
                })
              }
            />
          </>
        )}
      </View>

      {top ? (
        <>
          <View style={styles.voteButtons}>
            <RoundButton
              icon="close"
              color="#EB5757"
              label={t("match.nope")}
              onPress={() => cardRef.current?.swipe(false)}
            />
            <RoundButton
              icon="heart"
              color={colors.success}
              label={t("match.like")}
              onPress={() => cardRef.current?.swipe(true)}
            />
          </View>
          <Text style={styles.hint}>{t("match.hint")}</Text>
        </>
      ) : null}

      <View style={styles.matches}>
        <Text style={styles.sectionTitle}>{t("match.matchesTitle", { count: matches.length })}</Text>
        {matches.length === 0 ? <Text style={styles.intro}>{t("match.noMatches")}</Text> : null}
        {matches.map((title) => (
          <View key={titleKey(title)} style={styles.matchRow}>
            <TitleRow
              title={title}
              householdProviderIds={household?.providerIds ?? providerIds}
              providersById={providersById}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ends the evening for everyone: asks first. The screen then goes back to the setup. */
function EndEvening({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const end = useEndMatch();
  return (
    <View style={styles.endCard}>
      <Text style={styles.endText}>{t("match.endWarning")}</Text>
      {end.isError ? <Text style={styles.endError}>{errorMessage(t, end.error)}</Text> : null}
      <View style={styles.endActions}>
        <Button label={t("match.cancel")} variant="ghost" onPress={onCancel} />
        <Button label={end.isPending ? "…" : t("match.endConfirm")} onPress={() => !end.isPending && end.mutate()} />
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: "close" | "heart";
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.round, { borderColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={30} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl * 2 },
  loader: { marginVertical: spacing.xl },
  setup: { gap: spacing.md, paddingTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700", paddingHorizontal: spacing.lg },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, paddingHorizontal: spacing.lg },
  filters: { gap: spacing.sm },
  moods: {
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodsTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  moodsIntro: { color: colors.textMuted, fontSize: 13 },
  explanation: { color: colors.text, fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  setupActions: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  error: { color: "#EB5757", fontSize: 14, paddingHorizontal: spacing.lg },
  evening: { gap: spacing.md, paddingTop: spacing.sm },
  eveningHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  summary: { flex: 1, color: colors.textMuted, fontSize: 14 },
  headerAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerActionLabel: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  endCard: {
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  endText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  endError: { color: "#EB5757", fontSize: 14 },
  endActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  deck: { alignItems: "center", justifyContent: "center" },
  nextCard: {
    position: "absolute",
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    transform: [{ scale: 0.95 }, { translateY: 12 }],
  },
  voteButtons: { flexDirection: "row", justifyContent: "center", gap: spacing.xl * 2, marginTop: spacing.sm },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  matches: { gap: spacing.xs, marginTop: spacing.lg },
  matchRow: { paddingHorizontal: spacing.lg },
});
