import type { TitleSummary } from "@canape/shared";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import { Button } from "./Button";

interface Props {
  title: TitleSummary | null;
  onOpen: (title: TitleSummary) => void;
  onClose: () => void;
}

/** "It's a match!" — shown when the household agrees on a title (after my vote or the other's). */
export function MatchModal({ title, onOpen, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={title !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {title ? (
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.heading}>{t("match.itsAMatch")} 🎉</Text>
            {title.posterUrl ? <Image source={title.posterUrl} style={styles.poster} contentFit="cover" /> : null}
            <Text style={styles.message}>{t("match.itsAMatchMessage", { title: title.title })}</Text>
            <View style={styles.actions}>
              <Button label={t("match.seeTitle")} onPress={() => onOpen(title)} />
              <Button label={t("match.keepSwiping")} variant="ghost" onPress={onClose} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 8, 14, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  heading: { color: colors.primary, fontSize: 28, fontWeight: "900", textAlign: "center" },
  poster: { width: 150, height: 225, borderRadius: radius.md },
  message: { color: colors.text, fontSize: 16, textAlign: "center", lineHeight: 22 },
  actions: { alignSelf: "stretch", gap: spacing.sm },
});
