import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", style }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.base, styles[variant], style]}>
      <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  primary: { backgroundColor: colors.primary },
  ghost: { borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: "600" },
  primaryLabel: { color: colors.primaryText },
  ghostLabel: { color: colors.text },
});
