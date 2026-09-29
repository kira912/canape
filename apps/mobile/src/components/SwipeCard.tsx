import Ionicons from "@expo/vector-icons/Ionicons";
import { watchableOffers, type Provider, type TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import { formatRuntime } from "../lib/labels";
import { ProviderLogo } from "./ProviderLogo";

/** Horizontal drag (px) past which releasing the card counts as a vote. */
const SWIPE_THRESHOLD = 110;

export interface SwipeCardHandle {
  swipe: (liked: boolean) => void;
}

interface Props {
  title: TitleSummary;
  width: number;
  height: number;
  householdProviderIds: number[];
  providersById: Map<number, Provider>;
  onSwiped: (liked: boolean) => void;
  onOpenDetails: () => void;
}

/**
 * Tinder-style card built on RN's PanResponder + Animated: works with a finger
 * on phones and with the mouse on the web, without extra native modules.
 * The parent keys it by title, so every card starts from a fresh position.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { title, width, height, householdProviderIds, providersById, onSwiped, onOpenDetails },
  ref,
) {
  const { t } = useTranslation();
  const position = useRef(new Animated.ValueXY()).current;
  const gone = useRef(false);
  // The pan responder is created once per card: read the latest callback through a ref.
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;

  const flyOut = (liked: boolean, dy = 0) => {
    if (gone.current) return;
    gone.current = true;
    Animated.timing(position, {
      toValue: { x: (liked ? 1 : -1) * width * 1.6, y: dy },
      duration: 220,
      useNativeDriver: false,
    }).start(() => onSwipedRef.current(liked));
  };

  useImperativeHandle(ref, () => ({ swipe: (liked) => flyOut(liked) }));

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly horizontal drags, so vertical scrolling keeps working.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) flyOut(true, g.dy);
          else if (g.dx < -SWIPE_THRESHOLD) flyOut(false, g.dy);
          else Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(),
      }),
    [width],
  );

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-14deg", "0deg", "14deg"],
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const providers = [...new Set(watchableOffers(title.offers, householdProviderIds).map((o) => o.providerId))];
  const runtime = title.mediaType === "movie" ? formatRuntime(t, title.runtime) : null;
  const meta = [t(`mediaType.${title.mediaType}`), title.year, runtime, title.rating ? `★ ${title.rating}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.card,
        { width, height, transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
      ]}
    >
      {title.posterUrl ? (
        // Not interactive: on the web an <img> would start a native drag and steal the mouse swipe.
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={title.posterUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ) : null}

      <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={[styles.stampText, { color: colors.success }]}>{t("match.likeStamp")}</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={[styles.stampText, { color: "#EB5757" }]}>{t("match.nopeStamp")}</Text>
      </Animated.View>

      <Pressable style={styles.details} onPress={onOpenDetails} accessibilityRole="button" hitSlop={8}>
        <Ionicons name="information-circle" size={18} color={colors.text} />
        <Text style={styles.detailsLabel}>{t("match.details")}</Text>
      </Pressable>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title.title}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
        {providers.length ? (
          <View style={styles.providers}>
            {providers.map((id) => (
              <ProviderLogo key={id} provider={providersById.get(id)} size={24} />
            ))}
          </View>
        ) : null}
        {title.overview ? (
          <Text style={styles.overview} numberOfLines={3}>
            {title.overview}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "flex-end",
  },
  info: { padding: spacing.lg, gap: spacing.xs, backgroundColor: "rgba(20, 17, 26, 0.86)" },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 14 },
  providers: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  overview: { color: colors.text, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  details: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(20, 17, 26, 0.7)",
  },
  detailsLabel: { color: colors.text, fontSize: 12, fontWeight: "600" },
  stamp: {
    position: "absolute",
    top: spacing.xl * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 3,
    borderRadius: radius.md,
    backgroundColor: "rgba(20, 17, 26, 0.55)",
  },
  likeStamp: { left: spacing.lg, borderColor: colors.success, transform: [{ rotate: "-14deg" }] },
  nopeStamp: { right: spacing.lg, borderColor: "#EB5757", transform: [{ rotate: "14deg" }] },
  stampText: { fontSize: 28, fontWeight: "900", letterSpacing: 2 },
});
