import Ionicons from "@expo/vector-icons/Ionicons";
import { watchableOffers, type Offer, type Provider, type TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../constants/theme";
import { formatRuntime } from "../lib/labels";
import { useWatchers } from "../lib/queries";
import { FadeIn, PressableScale } from "./motion";
import { ProviderLogo } from "./ProviderLogo";
import { WatchedBadge } from "./WatchedBadge";

interface Props {
  title: TitleSummary;
  householdProviderIds: number[];
  providersById: Map<number, Provider>;
  /** "elsewhere" rows are dimmed and list every offer instead of the watchable ones. */
  variant?: "available" | "elsewhere";
  /** Rendered on the right edge (e.g. who added a favorite). */
  accessory?: ReactNode;
  /** Position in the list, for the staggered entrance. */
  index?: number;
}

export function TitleRow({
  title,
  householdProviderIds,
  providersById,
  variant = "available",
  accessory,
  index = 0,
}: Props) {
  const { t } = useTranslation();
  const { watchers, members } = useWatchers(title.mediaType, title.tmdbId);
  const [overviewOpen, setOverviewOpen] = useState(false);
  // Seen by the whole household: still listed (never hidden), just toned down.
  const seenByAll = members.length > 0 && watchers.length === members.length;
  const offers = variant === "available" ? watchableOffers(title.offers, householdProviderIds) : title.offers;
  const runtime =
    title.mediaType === "movie"
      ? formatRuntime(t, title.runtime)
      : title.runtime
        ? t("duration.perEpisode", { m: title.runtime })
        : null;
  const meta = [t(`mediaType.${title.mediaType}`), title.year, runtime].filter(Boolean).join(" · ");

  const openTitle = () =>
    router.push({ pathname: "/title/[mediaType]/[id]", params: { mediaType: title.mediaType, id: title.tmdbId } });

  // The overview toggle sits beside the link, not inside it: on the web the row
  // renders as an <a>, and a button nested in a link is invalid and unreachable.
  return (
    <FadeIn index={index} style={[styles.card, seenByAll && styles.seen, variant === "elsewhere" && styles.dimmed]}>
      <View style={styles.row}>
        <PressableScale style={styles.main} accessibilityRole="link" onPress={openTitle} pressedScale={0.98}>
          {title.posterUrl ? (
            <Image source={title.posterUrl} style={styles.poster} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]} />
          )}
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {title.title}
            </Text>
            <View style={styles.metaRow}>
              {title.rating ? (
                <View style={styles.rating}>
                  <Ionicons name="star" size={11} color={colors.warning} />
                  <Text style={styles.ratingLabel}>{title.rating}</Text>
                </View>
              ) : null}
              <Text style={styles.meta}>{meta}</Text>
              <WatchedBadge watchers={watchers} showMembers={members.length > 1} />
            </View>
            <OfferStrip offers={offers} providersById={providersById} showTypes={variant === "elsewhere"} />
          </View>
        </PressableScale>
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      {title.overview ? (
        <Pressable
          style={styles.overviewToggle}
          onPress={() => setOverviewOpen((open) => !open)}
          hitSlop={8}
          accessibilityRole="button"
          aria-expanded={overviewOpen}
          accessibilityLabel={t(overviewOpen ? "titleRow.hideOverview" : "titleRow.showOverview", {
            title: title.title,
          })}
        >
          <Text style={styles.overviewToggleText}>{t("title.overview")}</Text>
          <Ionicons name={overviewOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
        </Pressable>
      ) : null}
      {overviewOpen ? (
        <View style={styles.overview}>
          <Text style={styles.overviewText} numberOfLines={6}>
            {title.overview}
          </Text>
          <Pressable style={styles.openTitle} onPress={openTitle} hitSlop={8} accessibilityRole="link">
            <Text style={styles.openTitleText}>{t("titleRow.openTitle")}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}
    </FadeIn>
  );
}

function OfferStrip({
  offers,
  providersById,
  showTypes,
}: {
  offers: Offer[];
  providersById: Map<number, Provider>;
  showTypes: boolean;
}) {
  const { t } = useTranslation();
  if (offers.length === 0) {
    return <Text style={styles.unavailable}>{t("titleRow.notStreamable")}</Text>;
  }
  // One logo per platform (a platform can both include and rent a title).
  const byProvider = new Map<number, Offer>();
  for (const offer of offers) if (!byProvider.has(offer.providerId)) byProvider.set(offer.providerId, offer);

  return (
    <View style={styles.offers}>
      {[...byProvider.values()].slice(0, 6).map((offer) => (
        <View key={offer.providerId} style={styles.offer}>
          <ProviderLogo provider={providersById.get(offer.providerId)} size={22} />
          {showTypes ? <Text style={styles.offerType}>{t(`offerType.${offer.type}`)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const POSTER_WIDTH = 68;

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", gap: spacing.md },
  main: { flex: 1, flexDirection: "row", gap: spacing.md },
  dimmed: { opacity: 0.6 },
  seen: { opacity: 0.7 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  poster: { width: POSTER_WIDTH, height: POSTER_WIDTH * 1.5, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  posterPlaceholder: { borderWidth: 1, borderColor: colors.border },
  body: { flex: 1, gap: 6, justifyContent: "center", paddingVertical: spacing.xs },
  accessory: { justifyContent: "center", paddingRight: spacing.xs },
  title: { color: colors.text, fontSize: 16, lineHeight: 21, fontFamily: fonts.bold },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingLabel: { color: colors.warning, fontSize: 12, fontFamily: fonts.extrabold },
  meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold },
  offers: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  offer: { flexDirection: "row", alignItems: "center", gap: 4 },
  offerType: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.semibold },
  // Lined up under the text column: poster width + row gap.
  overviewToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    marginLeft: POSTER_WIDTH + spacing.md,
    marginTop: spacing.xs,
  },
  overviewToggleText: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold },
  overview: {
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  overviewText: { color: colors.text, fontSize: 14, lineHeight: 21, fontFamily: fonts.regular },
  openTitle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 4 },
  openTitleText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
  unavailable: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.regular, fontStyle: "italic", marginTop: 2 },
});
