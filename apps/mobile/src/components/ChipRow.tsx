import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../constants/theme";

/** Horizontally scrollable row of chips, bleeding to the screen edges. */
export function ChipRow({ children }: { children: ReactNode }) {
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
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  separator: { width: 1, height: 20, backgroundColor: colors.border },
});
