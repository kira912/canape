import Ionicons from "@expo/vector-icons/Ionicons";
import { watchableOffers, type Provider, type TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { alpha, colors, fonts, radius, spacing } from "../constants/theme";
import { useWatchers } from "../lib/queries";
import { FadeIn, PressableScale } from "./motion";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  title: TitleSummary;
  width: number;
  householdProviderIds: number[];
  providersById: Map<number, Provider>;
  index?: number;
}

/** A poster tile for browsing: the image does the talking, the essentials sit on it. */
export function PosterCard({ title, width, householdProviderIds, providersById, index = 0 }: Props) {
  const { watchers, members } = useWatchers(title.mediaType, title.tmdbId);
  const seenByAll = members.length > 0 && watchers.length === members.length;
  const providers = [...new Set(watchableOffers(title.offers, householdProviderIds).map((o) => o.providerId))];

  return (
    <FadeIn index={index} style={{ width }}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={title.title}
        pressedScale={0.95}
        onPress={() =>
          router.push({ pathname: "/title/[mediaType]/[id]", params: { mediaType: title.mediaType, id: title.tmdbId } })
        }
        style={[styles.poster, { height: width * 1.5 }, seenByAll && styles.seen]}
      >
        {title.posterUrl ? (
          <Image source={title.posterUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.noPoster}>
            <Text style={styles.noPosterTitle} numberOfLines={4}>
              {title.title}
            </Text>
          </View>
        )}
        <LinearGradient
          colors={[alpha(colors.backgroundDeep, 0), alpha(colors.backgroundDeep, 0.85)]}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {title.rating ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={10} color={colors.warning} />
            <Text style={styles.ratingLabel}>{title.rating}</Text>
          </View>
        ) : null}
        {watchers.length ? (
          <View style={styles.seenBadge}>
            <Ionicons name="checkmark" size={12} color={colors.primaryText} />
          </View>
        ) : null}
        <View style={styles.providers}>
          {providers.slice(0, 3).map((id) => (
            <ProviderLogo key={id} provider={providersById.get(id)} size={22} />
          ))}
        </View>
      </PressableScale>
      <Text style={styles.title} numberOfLines={1}>
        {title.title}
      </Text>
      {title.year ? <Text style={styles.year}>{title.year}</Text> : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  seen: { opacity: 0.6 },
  noPoster: { flex: 1, padding: spacing.md, justifyContent: "center" },
  noPosterTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.display, textAlign: "center" },
  rating: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.backgroundDeep, 0.78),
  },
  ratingLabel: { color: colors.text, fontSize: 11, fontFamily: fonts.extrabold },
  seenBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
  },
  providers: { position: "absolute", left: spacing.sm, bottom: spacing.sm, flexDirection: "row", gap: 4 },
  title: { color: colors.text, fontSize: 13, fontFamily: fonts.bold, marginTop: spacing.sm },
  year: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.semibold },
});
