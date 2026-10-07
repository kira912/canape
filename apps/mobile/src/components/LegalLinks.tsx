import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, fonts } from "../constants/theme";
import { LEGAL_DOCS } from "../legal/types";

/** Footer links to the legal pages (welcome screen, settings, each legal page). */
export function LegalLinks() {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessibilityRole="list">
      {LEGAL_DOCS.map((doc) => (
        <Link key={doc} href={`/legal/${doc}`} style={styles.link}>
          {t(`legal.links.${doc}`)}
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg, rowGap: spacing.xs },
  link: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, textDecorationLine: "underline" },
});
