import type { Member } from "@canape/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

/** Coloured initial identifying a household member. */
export function MemberDot({ member, size = 18 }: { member: Member | undefined; size?: number }) {
  return (
    <View
      style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: member?.color ?? colors.border }]}
      accessibilityLabel={member?.name}
    >
      <Text style={[styles.initial, { fontSize: size * 0.5 }]}>{member?.name.charAt(0).toUpperCase() ?? "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { alignItems: "center", justifyContent: "center" },
  initial: { color: colors.primaryText, fontWeight: "800" },
});
