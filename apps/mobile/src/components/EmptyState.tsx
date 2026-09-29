import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";

interface Props {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  message?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, message, children }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: "600", textAlign: "center" },
  message: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
