import Ionicons from "@expo/vector-icons/Ionicons";
import type { TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { alpha, colors, fonts, frappe, gradients, motion, radius, spacing } from "../constants/theme";
import { Button } from "./Button";
import { useReducedMotion } from "./motion";

interface Props {
  title: TitleSummary | null;
  onOpen: (title: TitleSummary) => void;
  onClose: () => void;
}

const HEART_COLORS = [frappe.mauve, frappe.pink, frappe.peach, frappe.flamingo, frappe.red, frappe.lavender];
/** Directions of the hearts bursting out of the poster (evenly spread, slightly jittered). */
const HEARTS = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12),
  distance: 120 + (i % 3) * 34,
  size: 16 + (i % 4) * 5,
  color: HEART_COLORS[i % HEART_COLORS.length],
}));

/** "It's a match!" — shown when the household agrees on a title (after my vote or the other's). */
export function MatchModal({ title, onOpen, onClose }: Props) {
  const { t } = useTranslation();
  // Keeps the last title while the modal fades out.
  const [shown, setShown] = useState<TitleSummary | null>(title);
  const progress = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (title) {
      setShown(title);
      progress.setValue(0);
      burst.setValue(0);
      Animated.parallel([
        Animated.spring(progress, { toValue: 1, damping: 11, stiffness: 140, useNativeDriver: motion.native }),
        Animated.timing(burst, {
          toValue: 1,
          duration: reduced ? 0 : 1100,
          delay: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: motion.native,
        }),
      ]).start();
    } else if (shown) {
      Animated.timing(progress, { toValue: 0, duration: motion.fast, useNativeDriver: motion.native }).start(() =>
        setShown(null),
      );
    }
    // Reacts to the title only: `shown` is the state this effect drives.
  }, [title]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "0deg"] });

  return (
    <Modal visible={shown !== null} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        {shown ? (
          <Animated.View
            style={[styles.card, { transform: [{ scale }, { rotate }] }]}
            accessibilityViewIsModal
            aria-live="polite"
          >
            <View style={styles.posterStage}>
              {reduced
                ? null
                : HEARTS.map((heart, i) => (
                    <Animated.View
                      key={i}
                      pointerEvents="none"
                      style={[
                        styles.heart,
                        {
                          opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
                          transform: [
                            {
                              translateX: burst.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, Math.cos(heart.angle) * heart.distance],
                              }),
                            },
                            {
                              translateY: burst.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, Math.sin(heart.angle) * heart.distance - 30],
                              }),
                            },
                            { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.2, 0.8] }) },
                          ],
                        },
                      ]}
                    >
                      <Ionicons name="heart" size={heart.size} color={heart.color} />
                    </Animated.View>
                  ))}
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.posterFrame}>
                {shown.posterUrl ? (
                  <Image source={shown.posterUrl} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={styles.poster} />
                )}
              </LinearGradient>
            </View>
            <Text style={styles.heading}>{t("match.itsAMatch")}</Text>
            <Text style={styles.message}>{t("match.itsAMatchMessage", { title: shown.title })}</Text>
            <View style={styles.actions}>
              <Button label={t("match.seeTitle")} icon="play" onPress={() => onOpen(shown)} />
              <Button label={t("match.keepSwiping")} variant="ghost" onPress={onClose} />
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: alpha(colors.backgroundDeep, 0.92),
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: { width: "100%", maxWidth: 360, alignItems: "center", gap: spacing.md },
  posterStage: { alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  heart: { position: "absolute" },
  posterFrame: { padding: 4, borderRadius: radius.lg + 4, transform: [{ rotate: "-3deg" }] },
  poster: { width: 168, height: 252, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  heading: {
    color: colors.primary,
    fontSize: 38,
    lineHeight: 44,
    fontFamily: fonts.displayItalic,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  message: { color: colors.text, fontSize: 16, lineHeight: 23, fontFamily: fonts.regular, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
});
