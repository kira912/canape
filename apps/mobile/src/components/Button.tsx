import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, gradients, radius, spacing } from "../constants/theme";
import { PressableScale } from "./motion";

interface Props {
  label: string;
  onPress: () => void;
  /** primary: the one main action of a screen; ghost: everything else; danger: destructive confirmations. */
  variant?: "primary" | "ghost" | "danger";
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", icon, loading = false, style }: Props) {
  const foreground = variant === "ghost" ? colors.text : colors.primaryText;
  return (
    <PressableScale
      onPress={loading ? undefined : onPress}
      accessibilityRole="button"
      aria-busy={loading}
      style={[styles.base, variant === "ghost" && styles.ghost, variant === "danger" && styles.danger, style]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  label: { fontSize: 15, fontFamily: fonts.bold, letterSpacing: 0.2 },
});
