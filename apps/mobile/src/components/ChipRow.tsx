import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../constants/theme";
import { useIsWide } from "../lib/layout";

/**
 * Row of chips: horizontally scrollable on phones (edge to edge), wrapped on
 * wide screens where horizontal scrolling with a mouse is awkward.
 */
export function ChipRow({ children }: { children: ReactNode }) {
  if (useIsWide()) return <View style={[styles.row, styles.wrap]}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

export function ChipSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  wrap: { flexWrap: "wrap" },
  separator: { width: 1, height: 20, backgroundColor: colors.border },
});
