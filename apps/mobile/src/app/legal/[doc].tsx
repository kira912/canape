import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalLinks } from "../../components/LegalLinks";
import { Seo } from "../../components/Seo";
import { SITE } from "../../constants/site";
import { colors, spacing } from "../../constants/theme";
import { currentLanguage } from "../../i18n";
import { en } from "../../legal/en";
import { fr } from "../../legal/fr";
import { isLegalDoc, type LegalBlock } from "../../legal/types";
import { centered } from "../../lib/layout";

const TEXTS = { fr, en };

/** Legal notice, privacy policy, terms: public pages, reachable signed out (welcome screen) and from the settings. */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc: param } = useLocalSearchParams<{ doc: string }>();
  if (!isLegalDoc(param)) return <Redirect href="/" />;

  const language = currentLanguage();
  const doc = TEXTS[language][param];
  const updated = new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date(SITE.legalUpdatedAt));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, centered()]}>
        <Seo title={doc.title} description={doc.description} />
        {/* Opened from a link (search engine, shared URL) there is no history: go to the app instead. */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="link"
          style={styles.back}
          hitSlop={8}
        >
          <Text style={styles.backLabel}>← {SITE.name}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" aria-level={1}>
          {doc.title}
        </Text>
        <Text style={styles.meta}>{t("legal.updated", { date: updated })}</Text>
        {language === "fr" ? null : <Text style={styles.meta}>{t("legal.frenchPrevails")}</Text>}

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header" aria-level={2}>
              {section.heading}
            </Text>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <LegalLinks />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <Text style={styles.paragraph} selectable>
        {block}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {block.map((item) => (
        <View key={item} style={styles.item}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.paragraph, styles.itemText]} selectable>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md },
  back: { alignSelf: "flex-start" },
  backLabel: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 13 },
  section: { gap: spacing.sm, marginTop: spacing.md },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  paragraph: { color: colors.text, fontSize: 15, lineHeight: 23, opacity: 0.9 },
  list: { gap: spacing.xs },
  item: { flexDirection: "row", gap: spacing.sm },
  bullet: { color: colors.primary, fontSize: 15, lineHeight: 23 },
  itemText: { flex: 1 },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
