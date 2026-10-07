import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fonts, gradients, motion, spacing } from "../constants/theme";
import { FadeIn, useReducedMotion } from "./motion";

interface Props {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  message?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, message, children }: Props) {
  const float = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: motion.native }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: motion.native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, reduced]);

  return (
    <FadeIn style={styles.container}>
      <Animated.View
        style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}
      >
        <LinearGradient colors={gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.halo}>
          <Ionicons name={icon} size={32} color={colors.primary} />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, gap: spacing.sm },
  halo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: 21, fontFamily: fonts.display, textAlign: "center", lineHeight: 27 },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 340,
  },
  actions: { marginTop: spacing.md, alignSelf: "stretch", alignItems: "center", gap: spacing.sm },
});
