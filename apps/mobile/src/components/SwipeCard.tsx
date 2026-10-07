import Ionicons from "@expo/vector-icons/Ionicons";
import { watchableOffers, type Provider, type TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, colors, fonts, motion, radius, spacing } from "../constants/theme";
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
  // Arrives from the "next card" slot behind it (scaled down), so the deck feels continuous.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, ...motion.spring, useNativeDriver: false }).start();
  }, [enter]);
  const gone = useRef(false);
  // The pan responder is created once per card: read the latest callback through a ref.
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;

  const flyOut = (liked: boolean, dy = 0) => {
    if (gone.current) return;
    gone.current = true;
    Animated.timing(position, {
      toValue: { x: (liked ? 1 : -1) * width * 1.6, y: dy },
      duration: 260,
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
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [NEXT_CARD_SCALE, 1] });

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
        { width, height, transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }, { scale }] },
      ]}
    >
      {title.posterUrl ? (
        // Not interactive: on the web an <img> would start a native drag and steal the mouse swipe.
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={title.posterUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ) : null}

      <LinearGradient
        colors={[alpha(colors.backgroundDeep, 0), alpha(colors.backgroundDeep, 0.75), colors.backgroundDeep]}
        locations={[0.35, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* The whole card takes the colour of the answer as it's dragged. */}
      <Animated.View pointerEvents="none" style={[styles.wash, styles.likeWash, { opacity: likeOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.wash, styles.nopeWash, { opacity: nopeOpacity }]} />

      <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={[styles.stampText, { color: colors.success }]}>{t("match.likeStamp")}</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={[styles.stampText, { color: colors.danger }]}>{t("match.nopeStamp")}</Text>
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

/** Scale of the card waiting behind the top one (the parent draws it the same way). */
export const NEXT_CARD_SCALE = 0.93;

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  wash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  likeWash: { backgroundColor: alpha(colors.success, 0.22) },
  nopeWash: { backgroundColor: alpha(colors.danger, 0.22) },
  info: { padding: spacing.xl, gap: 6 },
  title: { color: colors.text, fontSize: 28, lineHeight: 33, fontFamily: fonts.display, letterSpacing: -0.3 },
  meta: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.semibold },
  providers: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  overview: { color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, marginTop: spacing.xs, opacity: 0.9 },
  details: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.backgroundDeep, 0.72),
  },
  detailsLabel: { color: colors.text, fontSize: 12, fontFamily: fonts.bold },
  stamp: {
    position: "absolute",
    top: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 3,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.backgroundDeep, 0.55),
  },
  likeStamp: { left: spacing.lg, borderColor: colors.success, transform: [{ rotate: "-12deg" }] },
  nopeStamp: { right: spacing.lg, borderColor: colors.danger, transform: [{ rotate: "12deg" }] },
  stampText: { fontSize: 30, fontFamily: fonts.extrabold, letterSpacing: 3 },
});
