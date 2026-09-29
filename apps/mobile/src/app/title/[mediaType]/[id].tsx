import Ionicons from "@expo/vector-icons/Ionicons";
import {
  isWatchableOffer,
  mediaTypeSchema,
  seasonCoverage,
  watchableOffers,
  type FavoriteList,
  type MediaType,
  type Provider,
  type SeasonAvailability,
  type WatchOption,
} from "@canape/shared";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { MemberDot } from "../../../components/MemberDot";
import { ProviderLogo } from "../../../components/ProviderLogo";
import { colors, radius, spacing } from "../../../constants/theme";
import { errorMessage } from "../../../lib/error-message";
import { formatRuntime } from "../../../lib/labels";
import { centered, useIsWide } from "../../../lib/layout";
import {
  isInFavorites,
  useFavorites,
  useHouseholdProviderIds,
  useProvidersById,
  useTitle,
  useToggleFavorite,
  useToggleWatched,
  useWatchers,
} from "../../../lib/queries";

export default function TitleScreen() {
  const { t: translate } = useTranslation();
  const params = useLocalSearchParams<{ mediaType: string; id: string }>();
  const mediaType = mediaTypeSchema.catch("movie").parse(params.mediaType);
  const title = useTitle(mediaType, Number(params.id));
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const [showOthers, setShowOthers] = useState(false);
  const isWide = useIsWide();

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
  const mine = t.watchOptions.filter(isMine);
  const others = t.watchOptions.filter((o) => !isMine(o));
  const coverage = t.seasons ? seasonCoverage(t.seasons, providerIds) : null;
  const meta = [
    translate(`mediaType.${t.mediaType}`),
    t.year,
    t.numberOfSeasons
      ? translate("title.seasonCount", { count: t.numberOfSeasons })
      : formatRuntime(translate, t.runtime),
    t.rating ? `★ ${t.rating}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {t.backdropUrl ? (
        <Image source={t.backdropUrl} style={isWide ? styles.backdropWide : styles.backdrop} contentFit="cover" />
      ) : (
        <View style={styles.backdropSpacer} />
      )}

      <View style={centered()}>
        <View style={styles.header}>
          {t.posterUrl ? <Image source={t.posterUrl} style={[styles.poster, isWide && styles.posterWide]} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.meta}>{meta}</Text>
            {t.genres.length ? <Text style={styles.meta}>{t.genres.join(", ")}</Text> : null}
            {coverage === "partial" ? <Badge color={colors.warning} label={translate("title.partial")} /> : null}
          </View>
        </View>

        <FavoriteButtons mediaType={t.mediaType} tmdbId={t.tmdbId} />
        <WatchedToggles mediaType={t.mediaType} tmdbId={t.tmdbId} />

        <Section title={translate("title.watch")}>
          {mine.length ? (
            mine.map((option) => <WatchButton key={`${option.provider.id}-${option.type}`} option={option} primary />)
          ) : (
            <Text style={styles.muted}>{translate("title.notOnYourPlatforms")}</Text>
          )}
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
            ? others.map((option) => <WatchButton key={`${option.provider.id}-${option.type}`} option={option} />)
            : null}
        </Section>

        {t.overview ? (
          <Section title={translate("title.overview")}>
            <Text style={styles.overview}>{t.overview}</Text>
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

        {t.trailerUrl ? (
          <Pressable style={styles.trailer} onPress={() => Linking.openURL(t.trailerUrl!)}>
            <Ionicons name="play-circle" size={20} color={colors.text} />
            <Text style={styles.trailerLabel}>{translate("title.trailer")}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.attribution}>{translate("title.attribution")}</Text>
      </View>
    </ScrollView>
  );
}

function FavoriteButtons({ mediaType, tmdbId }: { mediaType: MediaType; tmdbId: number }) {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const { t } = useTranslation();
  const isWide = useIsWide();
  const state = isInFavorites(favorites.data, { mediaType, tmdbId });

  const button = (list: FavoriteList, active: boolean, icon: "heart" | "bookmark", label: string) => (
    <Pressable
      style={[styles.favoriteButton, isWide && styles.favoriteButtonWide, active && styles.favoriteButtonActive]}
      onPress={() => toggle.mutate({ ref: { list, mediaType, tmdbId }, add: !active })}
      disabled={favorites.isPending || toggle.isPending}
      accessibilityRole="button"
      aria-pressed={active}
    >
      <Ionicons name={active ? icon : `${icon}-outline`} size={18} color={active ? colors.primaryText : colors.text} />
      <Text style={[styles.favoriteLabel, active && styles.favoriteLabelActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.favorites}>
      {button("household", state.household, "heart", t("title.addToHousehold"))}
      {button("me", state.mine, "bookmark", t("title.addToMine"))}
    </View>
  );
}

/** One toggle per household member: anyone can tick for the other ("elle l'a vu"). */
function WatchedToggles({ mediaType, tmdbId }: { mediaType: MediaType; tmdbId: number }) {
  const { t } = useTranslation();
  const { watchers, members } = useWatchers(mediaType, tmdbId);
  const toggle = useToggleWatched();
  if (members.length === 0) return null;
  return (
    <View style={styles.watched}>
      <Text style={styles.watchedLabel}>{t("watched.title")}</Text>
      {members.map((member) => {
        const seen = watchers.some((w) => w.id === member.id);
        return (
          <Pressable
            key={member.id}
            style={[styles.watchedChip, seen && styles.watchedChipOn]}
            onPress={() => toggle.mutate({ ref: { mediaType, tmdbId, memberId: member.id }, seen: !seen })}
            accessibilityRole="checkbox"
            aria-checked={seen}
            accessibilityLabel={t("watched.toggle", { name: member.name })}
          >
            <MemberDot member={member} size={18} />
            <Text style={styles.watchedName}>{member.name}</Text>
            {seen ? <Ionicons name="checkmark" size={16} color={colors.success} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function WatchButton({ option, primary = false }: { option: WatchOption; primary?: boolean }) {
  const { t } = useTranslation();
  const isWide = useIsWide();
  return (
    <Pressable
      style={[styles.watchButton, isWide && styles.watchButtonWide, primary && styles.watchButtonPrimary]}
      onPress={() => Linking.openURL(option.link)}
      accessibilityRole="link"
    >
      <ProviderLogo provider={option.provider} size={36} />
      <View style={styles.watchText}>
        <Text style={styles.watchTitle}>
          {primary ? t("title.watchOn", { provider: option.provider.name }) : option.provider.name}
        </Text>
        <Text style={styles.watchHint}>
          {t(`offerType.${option.type}`)} · {t(`linkKind.${option.linkKind}`)}
        </Text>
      </View>
      <Ionicons name="open-outline" size={18} color={primary ? colors.primary : colors.textMuted} />
    </Pressable>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: spacing.xl * 2 },
  backdrop: { width: "100%", aspectRatio: 16 / 9, opacity: 0.55 },
  /** 16:9 on a desktop window would be ~800px tall. */
  backdropWide: { width: "100%", height: 380, opacity: 0.55 },
  backdropSpacer: { height: 100 },
  header: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.lg, marginTop: -56 },
  poster: { width: 100, height: 150, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  posterWide: { width: 140, height: 210 },
  headerText: { flex: 1, justifyContent: "flex-end", gap: 4 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 13 },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeLabel: { fontSize: 12, fontWeight: "600" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  favorites: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  favoriteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /** Sized to the label on wide screens instead of splitting the column in two. */
  favoriteButtonWide: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", paddingHorizontal: spacing.xl },
  favoriteButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  watched: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  watchedLabel: { color: colors.textMuted, fontSize: 14, marginRight: spacing.xs },
  watchedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchedChipOn: { borderColor: colors.success, backgroundColor: colors.surface },
  watchedName: { color: colors.text, fontSize: 14 },
  favoriteLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  favoriteLabelActive: { color: colors.primaryText },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 14 },
  overview: { color: colors.text, fontSize: 15, lineHeight: 22 },
  watchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchButtonWide: { maxWidth: 560 },
  watchButtonPrimary: { borderColor: colors.primary },
  watchText: { flex: 1, gap: 2 },
  watchTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  watchHint: { color: colors.textMuted, fontSize: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  toggleLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
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
  trailer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  trailerLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  attribution: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.xl },
});
