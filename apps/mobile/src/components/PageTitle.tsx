import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors, spacing } from "../constants/theme";
import { useIsWide } from "../lib/layout";

/**
 * Page title inside the content column on wide screens, where the navigation
 * header is hidden (side navigation). Phones keep the regular header.
 */
export function PageTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  if (!useIsWide()) return null;
  return (
    <Text style={[styles.title, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
});
