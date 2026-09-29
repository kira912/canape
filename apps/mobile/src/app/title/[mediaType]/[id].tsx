import Ionicons from "@expo/vector-icons/Ionicons";
import {
  isWatchableOffer,
  mediaTypeSchema,
  seasonCoverage,
  watchableOffers,
  type CastMember,
  type FavoriteList,
  type MediaType,
  type Provider,
  type SeasonAvailability,
  type WatchOption,
} from "@canape/shared";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/EmptyState";
import { MemberDot } from "../../../components/MemberDot";
import { ProviderLogo } from "../../../components/ProviderLogo";
import { WatchedBadge } from "../../../components/WatchedBadge";
import { colors, radius, spacing } from "../../../constants/theme";
import { errorMessage } from "../../../lib/error-message";
import { useSession } from "../../../lib/household-store";
import { formatRuntime } from "../../../lib/labels";
import { centered, useIsWide } from "../../../lib/layout";
import {
  canOpenOnTv,
  openOnTv,
  opensTitleOnTv,
  TvError,
  tvControlAvailable,
  type SavedTv,
} from "../../../lib/tv/samsung";
import {
  isInFavorites,
  useFavorites,
  useHouseholdProviderIds,
  useProvidersById,
  useTitle,
  useToggleFavorite,
  useIsSolo,
  useToggleWatched,
  useWatchers,
} from "../../../lib/queries";

/** Overviews longer than this start collapsed behind "Read more". */
const LONG_OVERVIEW = 240;

export default function TitleScreen() {
  const { t: translate } = useTranslation();
  const params = useLocalSearchParams<{ mediaType: string; id: string }>();
  const mediaType = mediaTypeSchema.catch("movie").parse(params.mediaType);
  const title = useTitle(mediaType, Number(params.id));
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const [showOthers, setShowOthers] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [watchedSheet, setWatchedSheet] = useState(false);
  // "Where to watch?": this phone, or the saved smart TV when the platform can be opened on it.
  const tv = useSession((s) => s.tv);
  const [target, setTarget] = useState<WatchOption | null>(null);
  const watch = (option: WatchOption) =>
    tv && tvControlAvailable && canOpenOnTv(option.platform) ? setTarget(option) : void Linking.openURL(option.link);
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();

  if (title.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (title.isError) {
    return (
      <View style={[styles.screen, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title={translate("title.unavailable")}
          message={errorMessage(translate, title.error)}
        />
      </View>
    );
  }

  const t = title.data;
  const isMine = (o: WatchOption) => isWatchableOffer({ providerId: o.provider.id, type: o.type }, providerIds);
  const [primary, ...moreMine] = t.watchOptions.filter(isMine);
  const others = t.watchOptions.filter((o) => !isMine(o));
  const coverage = t.seasons ? seasonCoverage(t.seasons, providerIds) : null;
  const meta = [
    t.year,
    t.numberOfSeasons
      ? translate("title.seasonCount", { count: t.numberOfSeasons })
      : formatRuntime(translate, t.runtime),
    t.mediaType === "tv" && t.runtime ? translate("duration.perEpisode", { m: t.runtime }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Phones: the main action sits in a bar pinned to the bottom; wide screens: inline under the header.
  const stickyCta = Boolean(primary) && !isWide;
  const longOverview = t.overview.length > LONG_OVERVIEW;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: stickyCta ? 110 + insets.bottom : spacing.xl * 2 }}>
        <Hero backdropUrl={t.backdropUrl} wide={isWide} />

        <View style={centered()}>
          <View style={styles.header}>
            {t.posterUrl ? <Image source={t.posterUrl} style={[styles.poster, isWide && styles.posterWide]} /> : null}
            <View style={styles.headerText}>
              <Text style={[styles.title, isWide && styles.titleWide]}>{t.title}</Text>
              {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              <View style={styles.badges}>
                {t.rating ? <RatingBadge rating={t.rating} /> : null}
                <Pill label={translate(`mediaType.${t.mediaType}`)} />
                {t.genres.slice(0, 3).map((g) => (
                  <Pill key={g} label={g} />
                ))}
              </View>
              {coverage === "partial" ? <Pill label={translate("title.partial")} color={colors.warning} /> : null}
            </View>
          </View>

          {primary && !stickyCta ? (
            <View style={styles.inlineCta}>
              <PrimaryWatchButton option={primary} onWatch={watch} />
            </View>
          ) : null}

          <ActionRow mediaType={t.mediaType} tmdbId={t.tmdbId} onOpenWatched={() => setWatchedSheet(true)} />

          {moreMine.length || !primary || others.length ? (
            <Section title={translate("title.watch")}>
              {!primary ? <Text style={styles.muted}>{translate("title.notOnYourPlatforms")}</Text> : null}
              {moreMine.map((option) => (
                <WatchRow key={`${option.provider.id}-${option.type}`} option={option} onWatch={watch} highlighted />
              ))}
              {others.length ? (
                <Pressable style={styles.toggle} onPress={() => setShowOthers((v) => !v)}>
                  <Text style={styles.toggleLabel}>
                    {showOthers
                      ? translate("title.hideOtherOptions")
                      : translate("title.otherOptions", { count: others.length })}
                  </Text>
                  <Ionicons name={showOthers ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
              {showOthers
                ? others.map((option) => (
                    <WatchRow key={`${option.provider.id}-${option.type}`} option={option} onWatch={watch} />
                  ))
                : null}
            </Section>
          ) : null}

          {/* Platform availability comes from JustWatch (through TMDB), which requires crediting it where shown. */}
          {t.watchOptions.length || t.seasons?.length ? (
            <Text style={styles.source}>{translate("title.availabilitySource")}</Text>
          ) : null}

          {t.overview ? (
            <Section title={translate("title.overview")}>
              <Text style={styles.overview} numberOfLines={longOverview && !overviewOpen ? 4 : undefined}>
                {t.overview}
              </Text>
              {longOverview ? (
                <Pressable onPress={() => setOverviewOpen((v) => !v)} hitSlop={8}>
                  <Text style={styles.readMore}>
                    {overviewOpen ? translate("title.readLess") : translate("title.readMore")}
                  </Text>
                </Pressable>
              ) : null}
            </Section>
          ) : null}

          {t.trailerUrl ? (
            <Section title={translate("title.trailer")}>
              <TrailerCard url={t.trailerUrl} thumbnailUrl={t.trailerThumbnailUrl} wide={isWide} />
            </Section>
          ) : null}

          {t.cast.length ? (
            <Section title={translate("title.cast")} flush>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castRow}>
                {t.cast.map((person) => (
                  <CastCard key={person.id} person={person} />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {t.seasons?.length ? (
            <Section title={translate("title.seasons")}>
              {t.seasons.map((season) => (
                <SeasonRow
                  key={season.seasonNumber}
                  season={season}
                  providerIds={providerIds}
                  providersById={providersById}
                />
              ))}
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {stickyCta && primary ? (
        <View style={[styles.stickyBar, { paddingBottom: spacing.md + insets.bottom }]}>
          <PrimaryWatchButton option={primary} onWatch={watch} />
        </View>
      ) : null}

      {tv ? <WatchTargetSheet option={target} tv={tv} onClose={() => setTarget(null)} /> : null}

      <WatchedSheet
        visible={watchedSheet}
        mediaType={t.mediaType}
        tmdbId={t.tmdbId}
        onClose={() => setWatchedSheet(false)}
      />
    </View>
  );
}

/** Backdrop fading into the page, with a light scrim on top so the back arrow stays readable. */
function Hero({ backdropUrl, wide }: { backdropUrl: string | null; wide: boolean }) {
  if (!backdropUrl) return <View style={styles.heroSpacer} />;
  return (
    <View style={wide ? styles.heroWide : styles.hero}>
      <Image source={backdropUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient
        colors={["rgba(20, 17, 26, 0.65)", "rgba(20, 17, 26, 0)"]}
        style={styles.heroTopScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(20, 17, 26, 0)", "rgba(20, 17, 26, 0.6)", colors.background]}
        locations={[0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <View style={styles.rating}>
      <Ionicons name="star" size={12} color={colors.warning} />
      <Text style={styles.ratingLabel}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.pill, color ? { borderColor: color } : null]}>
      <Text style={[styles.pillLabel, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

function PrimaryWatchButton({ option, onWatch }: { option: WatchOption; onWatch: (option: WatchOption) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.cta} onPress={() => onWatch(option)} accessibilityRole="button">
      <Ionicons name="play" size={20} color={colors.primaryText} />
      <View style={styles.ctaText}>
        <Text style={styles.ctaTitle} numberOfLines={1}>
          {t("title.watchOn", { provider: option.provider.name })}
        </Text>
        <Text style={styles.ctaHint} numberOfLines={1}>
          {t(`offerType.${option.type}`)} · {t(`linkKind.${option.linkKind}`)}
        </Text>
      </View>
      <ProviderLogo provider={option.provider} size={32} />
    </Pressable>
  );
}

/** Secondary actions as compact icon buttons: shared list, my list, seen. */
function ActionRow({
  mediaType,
  tmdbId,
  onOpenWatched,
}: {
  mediaType: MediaType;
  tmdbId: number;
  onOpenWatched: () => void;
}) {
  const { t } = useTranslation();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const memberId = useSession((s) => s.memberId);
  const { watchers } = useWatchers(mediaType, tmdbId);
  const toggleWatched = useToggleWatched();
  const solo = useIsSolo();
  const state = isInFavorites(favorites.data, { mediaType, tmdbId });
  const seenByMe = watchers.some((w) => w.id === memberId);
  const isWide = useIsWide();
  const toggleList = (list: FavoriteList, active: boolean) =>
    toggle.mutate({ ref: { list, mediaType, tmdbId }, add: !active });

  return (
    <View style={[styles.actions, isWide && styles.actionsWide]}>
      {solo ? null : (
        <IconAction
          icon="heart"
          label={t("title.addToHousehold")}
          active={state.household}
          disabled={favorites.isPending || toggle.isPending}
          onPress={() => toggleList("household", state.household)}
        />
      )}
      <IconAction
        icon="bookmark"
        label={t("title.addToMine")}
        active={state.mine}
        disabled={favorites.isPending || toggle.isPending}
        onPress={() => toggleList("me", state.mine)}
      />
      <IconAction
        icon="checkmark-circle"
        label={t("title.seenAction")}
        active={seenByMe}
        // Solo: nobody else to tick for, toggle directly instead of opening the sheet.
        onPress={() =>
          solo && memberId
            ? toggleWatched.mutate({ ref: { mediaType, tmdbId, memberId }, seen: !seenByMe })
            : onOpenWatched()
        }
      >
        {solo ? null : <WatchedBadge watchers={watchers} />}
      </IconAction>
    </View>
  );
}

function IconAction({
  icon,
  label,
  active,
  disabled,
  onPress,
  children,
}: {
  icon: "heart" | "bookmark" | "checkmark-circle";
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const name: ComponentProps<typeof Ionicons>["name"] = active ? icon : `${icon}-outline`;
  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      aria-pressed={active}
    >
      <View style={[styles.actionIcon, active && styles.actionIconActive]}>
        <Ionicons name={name} size={22} color={active ? colors.primaryText : colors.text} />
      </View>
      <Text style={[styles.actionLabel, active && styles.actionLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </Pressable>
  );
}

/** "Who has seen it?": one toggle per member; anyone can tick for the other. */
/** "Where to watch?": open the platform on this phone, or on the smart TV (same Wi-Fi). */
function WatchTargetSheet({ option, tv, onClose }: { option: WatchOption | null; tv: SavedTv; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setStatus(null), [option]);
  if (!option) return null;
  const provider = option.provider.name;

  const onPhone = () => {
    onClose();
    void Linking.openURL(option.link);
  };
  const onTv = async () => {
    setSending(true);
    setStatus(null);
    try {
      const result = await openOnTv(tv, option);
      setStatus({ ok: true, text: result === "title" ? t("tv.sentTitle") : t("tv.sentApp", { provider }) });
      setTimeout(onClose, 1800);
    } catch (error) {
      const reason = error instanceof TvError ? error.reason : "unreachable";
      setStatus({
        ok: false,
        text: reason === "unsupported" ? t("tv.unsupported", { provider }) : t("tv.unreachable"),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel={t("title.close")} />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{t("tv.where")}</Text>
        <Pressable style={styles.sheetRow} onPress={onPhone} accessibilityRole="button">
          <Ionicons name="phone-portrait-outline" size={26} color={colors.text} />
          <View style={styles.targetText}>
            <Text style={styles.sheetName}>{t("tv.onPhone")}</Text>
            <Text style={styles.watchHint}>{t("tv.onPhoneHint", { provider })}</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.sheetRow, styles.sheetRowOn]}
          onPress={() => !sending && void onTv()}
          accessibilityRole="button"
        >
          <Ionicons name="tv-outline" size={26} color={colors.primary} />
          <View style={styles.targetText}>
            <Text style={styles.sheetName}>{t("tv.onTv", { name: tv.name })}</Text>
            <Text style={styles.watchHint}>
              {opensTitleOnTv(option) ? t("tv.opensTitle") : t("tv.opensApp", { provider })}
            </Text>
          </View>
          {sending ? <ActivityIndicator color={colors.primary} /> : null}
        </Pressable>
        {status ? (
          <Text style={[styles.targetStatus, { color: status.ok ? colors.success : colors.warning }]}>
            {status.text}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

function WatchedSheet({
  visible,
  mediaType,
  tmdbId,
  onClose,
}: {
  visible: boolean;
  mediaType: MediaType;
  tmdbId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { watchers, members } = useWatchers(mediaType, tmdbId);
  const toggle = useToggleWatched();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel={t("title.close")} />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{t("title.whoSaw")}</Text>
        {members.map((member) => {
          const seen = watchers.some((w) => w.id === member.id);
          return (
            <Pressable
              key={member.id}
              style={[styles.sheetRow, seen && styles.sheetRowOn]}
              onPress={() => toggle.mutate({ ref: { mediaType, tmdbId, memberId: member.id }, seen: !seen })}
              accessibilityRole="checkbox"
              aria-checked={seen}
              accessibilityLabel={t("watched.toggle", { name: member.name })}
            >
              <MemberDot member={member} size={28} />
              <Text style={styles.sheetName}>{member.name}</Text>
              <Ionicons
                name={seen ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={seen ? colors.success : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

function WatchRow({
  option,
  onWatch,
  highlighted = false,
}: {
  option: WatchOption;
  onWatch: (option: WatchOption) => void;
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const isWide = useIsWide();
  return (
    <Pressable
      style={[styles.watchRow, isWide && styles.watchRowWide, highlighted && styles.watchRowHighlighted]}
      onPress={() => onWatch(option)}
      accessibilityRole="button"
    >
      <ProviderLogo provider={option.provider} size={36} />
      <View style={styles.watchText}>
        <Text style={styles.watchTitle}>
          {highlighted ? t("title.watchOn", { provider: option.provider.name }) : option.provider.name}
        </Text>
        <Text style={styles.watchHint}>
          {t(`offerType.${option.type}`)} · {t(`linkKind.${option.linkKind}`)}
        </Text>
      </View>
      <Ionicons name="open-outline" size={18} color={highlighted ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

function TrailerCard({ url, thumbnailUrl, wide }: { url: string; thumbnailUrl: string | null; wide: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={[styles.trailer, wide && styles.trailerWide]}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={t("title.trailer")}
    >
      {thumbnailUrl ? <Image source={thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.trailerShade} />
      <View style={styles.playButton}>
        <Ionicons name="play" size={28} color={colors.primaryText} />
      </View>
    </Pressable>
  );
}

function CastCard({ person }: { person: CastMember }) {
  return (
    <View style={styles.castCard}>
      {person.photoUrl ? (
        <Image source={person.photoUrl} style={styles.castPhoto} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.castPhoto, styles.castPlaceholder]}>
          <Ionicons name="person" size={28} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.castName} numberOfLines={2}>
        {person.name}
      </Text>
      {person.character ? (
        <Text style={styles.castCharacter} numberOfLines={2}>
          {person.character}
        </Text>
      ) : null}
    </View>
  );
}

function SeasonRow({
  season,
  providerIds,
  providersById,
}: {
  season: SeasonAvailability;
  providerIds: number[];
  providersById: Map<number, Provider>;
}) {
  const { t } = useTranslation();
  const mine = [...new Set(watchableOffers(season.offers, providerIds).map((o) => o.providerId))];
  const details = [season.year, t("title.episodes", { count: season.episodeCount })].filter(Boolean).join(" · ");
  return (
    <View style={styles.seasonRow}>
      <View style={styles.seasonText}>
        <Text style={styles.seasonName}>{season.name}</Text>
        <Text style={styles.watchHint}>{details}</Text>
      </View>
      {mine.length ? (
        <View style={styles.seasonLogos}>
          {mine.map((id) => (
            <ProviderLogo key={id} provider={providersById.get(id)} size={24} />
          ))}
        </View>
      ) : (
        <Text style={styles.seasonMissing}>
          {season.offers.length ? t("title.notYours") : t("title.seasonUnavailable")}
        </Text>
      )}
    </View>
  );
}

/** `flush`: content handles its own horizontal padding (e.g. an edge-to-edge carousel). */
function Section({ title, children, flush = false }: { title: string; children: ReactNode; flush?: boolean }) {
  return (
    <View style={[styles.section, flush && styles.sectionFlush]}>
      <Text style={[styles.sectionTitle, flush && styles.sectionTitleFlush]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },

  hero: { width: "100%", aspectRatio: 16 / 10 },
  /** 16:9 on a desktop window would be ~800px tall. */
  heroWide: { width: "100%", height: 420 },
  heroSpacer: { height: 100 },
  heroTopScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 110 },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: -90,
  },
  poster: {
    width: 110,
    height: 165,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  posterWide: { width: 160, height: 240 },
  headerText: { flex: 1, gap: spacing.sm, paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: "800", lineHeight: 31 },
  titleWide: { fontSize: 34, lineHeight: 40 },
  meta: { color: colors.textMuted, fontSize: 14 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(242, 201, 76, 0.15)",
  },
  ratingLabel: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  inlineCta: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, maxWidth: 480 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  ctaText: { flex: 1 },
  ctaTitle: { color: colors.primaryText, fontSize: 16, fontWeight: "800" },
  ctaHint: { color: colors.primaryText, fontSize: 12, opacity: 0.75 },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(20, 17, 26, 0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  /** Wide screens: grouped under the main button instead of spread across the column. */
  actionsWide: { justifyContent: "flex-start", gap: spacing.xl },
  action: { alignItems: "center", gap: 6, minWidth: 88 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  actionLabelActive: { color: colors.text },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  sectionFlush: { paddingHorizontal: 0 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sectionTitleFlush: { paddingHorizontal: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 14 },
  overview: { color: colors.text, fontSize: 15, lineHeight: 23 },
  readMore: { color: colors.primary, fontSize: 14, fontWeight: "700" },

  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchRowWide: { maxWidth: 560 },
  watchRowHighlighted: { borderColor: colors.primary },
  watchText: { flex: 1, gap: 2 },
  watchTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  watchHint: { color: colors.textMuted, fontSize: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  toggleLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },

  trailer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  trailerWide: { maxWidth: 560 },
  trailerShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20, 17, 26, 0.25)" },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
    backgroundColor: colors.primary,
  },

  castRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  castCard: { width: 88, gap: 4 },
  castPhoto: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceRaised },
  castPlaceholder: { alignItems: "center", justifyContent: "center" },
  castName: { color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
  castCharacter: { color: colors.textMuted, fontSize: 12, textAlign: "center" },

  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  seasonText: { flex: 1, gap: 2 },
  seasonName: { color: colors.text, fontSize: 15 },
  seasonLogos: { flexDirection: "row", gap: spacing.xs },
  seasonMissing: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(10, 8, 14, 0.6)" },
  sheet: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.xs },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetRowOn: { borderColor: colors.success },
  sheetName: { flex: 1, color: colors.text, fontSize: 16 },
  targetText: { flex: 1, gap: 2 },
  targetStatus: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: spacing.xs },

  /** Small, discreet credit right below the availability it refers to. */
  source: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.lg, marginTop: spacing.sm, opacity: 0.8 },
});
