import Ionicons from "@expo/vector-icons/Ionicons";
import { watchableOffers, type Offer, type Provider, type TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import { formatRuntime } from "../lib/labels";
import { useWatchers } from "../lib/queries";
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
}

export function TitleRow({ title, householdProviderIds, providersById, variant = "available", accessory }: Props) {
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
  const meta = [t(`mediaType.${title.mediaType}`), title.year, runtime, title.rating ? `★ ${title.rating}` : null]
    .filter(Boolean)
    .join(" · ");

  const openTitle = () =>
    router.push({ pathname: "/title/[mediaType]/[id]", params: { mediaType: title.mediaType, id: title.tmdbId } });

  // The overview toggle sits beside the link, not inside it: on the web the row
  // renders as an <a>, and a button nested in a link is invalid and unreachable.
  return (
    <View style={[seenByAll && styles.seen, variant === "elsewhere" && styles.dimmed]}>
      <View style={styles.row}>
        <Pressable style={styles.main} accessibilityRole="link" onPress={openTitle}>
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
              <Text style={styles.meta}>{meta}</Text>
              <WatchedBadge watchers={watchers} showMembers={members.length > 1} />
            </View>
            <OfferStrip offers={offers} providersById={providersById} showTypes={variant === "elsewhere"} />
          </View>
        </Pressable>
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
    </View>
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
  main: { flex: 1, flexDirection: "row", gap: spacing.md },
  dimmed: { opacity: 0.6 },
  seen: { opacity: 0.75 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  poster: { width: 64, height: 96, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  posterPlaceholder: { borderWidth: 1, borderColor: colors.border },
  body: { flex: 1, gap: 4, justifyContent: "center" },
  accessory: { justifyContent: "center" },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 13 },
  offers: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  offer: { flexDirection: "row", alignItems: "center", gap: 4 },
  offerType: { color: colors.textMuted, fontSize: 11 },
  // Lined up under the text column: poster width + row gap.
  overviewToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    marginLeft: 64 + spacing.md,
    marginBottom: spacing.sm,
  },
  overviewToggleText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  overview: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  overviewText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  openTitle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 4 },
  openTitleText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  unavailable: { color: colors.textMuted, fontSize: 12, fontStyle: "italic", marginTop: 4 },
});
