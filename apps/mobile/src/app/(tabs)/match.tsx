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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { FilterGroup, Segmented } from "../../components/Filters";
import { MatchModal } from "../../components/MatchModal";
import { FadeIn, PressableScale, Reveal } from "../../components/motion";
import { PageTitle } from "../../components/PageTitle";
import { NEXT_CARD_SCALE, SwipeCard, type SwipeCardHandle } from "../../components/SwipeCard";
import { TextField } from "../../components/TextField";
import { TitleRow } from "../../components/TitleRow";
import { alpha, colors, fonts, gradients, radius, spacing } from "../../constants/theme";
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
  const [moodsOpen, setMoodsOpen] = useState(false);
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
      <FadeIn>
        <Text style={styles.sectionTitle}>{t("match.setupTitle")}</Text>
        <Text style={styles.intro}>{t("match.setupIntro")}</Text>
      </FadeIn>

      {/* Optional: the AI turns everyone's mood into criteria. Folded away so the main path stays short. */}
      <FadeIn index={1} style={styles.moods}>
        <LinearGradient colors={gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Pressable
          style={styles.moodsHeader}
          onPress={() => setMoodsOpen((open) => !open)}
          accessibilityRole="button"
          aria-expanded={moodsOpen}
        >
          <View style={styles.moodsHeaderText}>
            <Text style={styles.moodsTitle}>{t("ai.moodsTitle")}</Text>
            <Text style={styles.moodsIntro}>{t("ai.moodsIntro")}</Text>
          </View>
          <Ionicons name={moodsOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
        </Pressable>
        <Reveal open={moodsOpen}>
          <View style={styles.moodsBody}>
            {members.map((member) => (
              <TextField
                key={member.id}
                value={moods[member.id] ?? ""}
                onChangeText={(text) => setMoods((current) => ({ ...current, [member.id]: text }))}
                placeholder={t("ai.moodPlaceholder", { name: member.name })}
                maxLength={200}
              />
            ))}
            <Button
              label={t("ai.propose")}
              icon="sparkles"
              variant="ghost"
              loading={suggest.isPending}
              onPress={propose}
            />
            {suggest.isError ? <Text style={styles.error}>{errorMessage(t, suggest.error)}</Text> : null}
          </View>
        </Reveal>
        {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      </FadeIn>

      <FadeIn index={2} style={styles.filters}>
        <View style={styles.segmented}>
          <Segmented
            value={mediaType}
            onChange={switchMediaType}
            options={[
              { value: "movie", label: t("mediaTypePlural.movie") },
              { value: "tv", label: t("mediaTypePlural.tv") },
            ]}
          />
        </View>
        <FilterGroup label={t("filters.genres")}>
          {(genreList.data ?? []).map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={genres.includes(g.id)}
              onPress={() => setGenres((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
            />
          ))}
        </FilterGroup>
        {mediaType === "movie" ? (
          <FilterGroup label={t("filters.duration")}>
            {runtimeOptions.map((r) => (
              <Chip
                key={r}
                label={t("common.underDuration", { duration: formatRuntime(t, r) })}
                selected={maxRuntime === r}
                onPress={() => setMaxRuntime(maxRuntime === r ? undefined : r)}
              />
            ))}
          </FilterGroup>
        ) : null}
        <FilterGroup label={t("filters.rating")}>
          {RATING_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={t("common.rating", { value: r })}
              selected={minRating === r}
              onPress={() => setMinRating(minRating === r ? undefined : r)}
            />
          ))}
        </FilterGroup>
      </FadeIn>
      {start.isError ? <Text style={styles.error}>{errorMessage(t, start.error)}</Text> : null}
      <View style={styles.setupActions}>
        <Button
          label={t("match.start")}
          icon="flame"
          loading={start.isPending}
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
    const key = titleKey(title);
    setVoted((prev) => new Set(prev).add(key));
    vote.mutate(
      { mediaType: title.mediaType, tmdbId: title.tmdbId, liked },
      {
        onSuccess: (result) => result.match && onMatch(result.match),
        // Not recorded (network…): the card comes back rather than silently missing a match.
        onError: () =>
          setVoted((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
      },
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
              <View
                style={[styles.nextCard, { width: cardWidth, height: cardHeight, transform: [{ scale: NEXT_CARD_SCALE }] }]}
                pointerEvents="none"
              >
                {next.posterUrl ? (
                  <Image source={next.posterUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : null}
                <View style={styles.nextCardShade} />
              </View>
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
            <RoundButton icon="close" label={t("match.nope")} onPress={() => cardRef.current?.swipe(false)} />
            <RoundButton icon="heart" label={t("match.like")} onPress={() => cardRef.current?.swipe(true)} />
          </View>
          <Text style={styles.hint}>{t("match.hint")}</Text>
        </>
      ) : null}

      <View style={styles.matches}>
        <Text style={styles.sectionTitle}>{t("match.matchesTitle", { count: matches.length })}</Text>
        {matches.length === 0 ? <Text style={styles.intro}>{t("match.noMatches")}</Text> : null}
        {matches.map((title, index) => (
          <View key={titleKey(title)} style={styles.matchRow}>
            <TitleRow
              index={index}
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
        <Button
          label={t("match.endConfirm")}
          variant="danger"
          loading={end.isPending}
          onPress={() => end.mutate()}
        />
      </View>
    </View>
  );
}

/** Big vote buttons: a quiet "no", a warm "yes" in the brand gradient. */
function RoundButton({ icon, label, onPress }: { icon: "close" | "heart"; label: string; onPress: () => void }) {
  const like = icon === "heart";
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.88}
      style={[styles.round, like ? styles.roundLike : styles.roundNope]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {like ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <Ionicons name={icon} size={like ? 34 : 30} color={like ? colors.primaryText : colors.danger} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl * 2 },
  loader: { marginVertical: spacing.xl },
  setup: { gap: spacing.lg, paddingTop: spacing.xs },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.display,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, paddingHorizontal: spacing.lg },
  filters: { gap: spacing.lg },
  segmented: { paddingHorizontal: spacing.lg, maxWidth: 360 + spacing.lg * 2 },
  moods: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.35),
  },
  moodsHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  moodsHeaderText: { flex: 1, gap: 2 },
  moodsTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extrabold },
  moodsIntro: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  moodsBody: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  explanation: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.displayItalic,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  setupActions: { gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold, paddingHorizontal: spacing.lg },
  evening: { gap: spacing.md, paddingTop: spacing.xs },
  eveningHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  summary: { flex: 1, color: colors.textMuted, fontSize: 13, fontFamily: fonts.semibold },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  headerActionLabel: { color: colors.text, fontSize: 13, fontFamily: fonts.bold },
  endCard: {
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.5),
  },
  endText: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  endError: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold },
  endActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  deck: { alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  nextCard: {
    position: "absolute",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  nextCardShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.backgroundDeep, 0.55),
  },
  voteButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  roundNope: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: alpha(colors.danger, 0.5) },
  roundLike: { width: 78, height: 78, borderRadius: 39 },
  hint: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.semibold, textAlign: "center" },
  matches: { gap: spacing.xs, marginTop: spacing.xl },
  matchRow: { paddingHorizontal: spacing.lg },
});
