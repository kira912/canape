import type { Member } from "@canape/shared";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";
import { MemberDot } from "./MemberDot";

/** "✓" followed by the colour dot of each member who has seen the title. */
export function WatchedBadge({ watchers }: { watchers: Member[] }) {
  const { t } = useTranslation();
  if (watchers.length === 0) return null;
  return (
    <View
      style={styles.badge}
      accessibilityLabel={t("watched.seenBy", { names: watchers.map((m) => m.name).join(", ") })}
    >
      <Text style={styles.check}>✓</Text>
      {watchers.map((m) => (
        <MemberDot key={m.id} member={m} size={16} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  check: { color: colors.success, fontSize: 14, fontWeight: "800" },
});
