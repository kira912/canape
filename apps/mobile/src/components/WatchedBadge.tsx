import type { Member } from "@canape/shared";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, fonts } from "../constants/theme";
import { MemberDot } from "./MemberDot";

/** "✓" followed by the colour dot of each member who has seen the title (no dots when alone). */
export function WatchedBadge({ watchers, showMembers = true }: { watchers: Member[]; showMembers?: boolean }) {
  const { t } = useTranslation();
  if (watchers.length === 0) return null;
  return (
    <View
      style={styles.badge}
      accessibilityLabel={t("watched.seenBy", { names: watchers.map((m) => m.name).join(", ") })}
    >
      <Text style={styles.check}>✓</Text>
      {showMembers ? watchers.map((m) => <MemberDot key={m.id} member={m} size={16} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  check: { color: colors.success, fontSize: 14, fontFamily: fonts.extrabold },
});
