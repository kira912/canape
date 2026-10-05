import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Seo } from "../../components/Seo";
import { colors, radius, spacing } from "../../constants/theme";
import { ApiError } from "../../lib/api-client";
import { errorMessage } from "../../lib/error-message";
import { useSession } from "../../lib/household-store";
import { centered, FORM_MAX_WIDTH } from "../../lib/layout";
import { useApprovePairing, useMe, usePairingInfo } from "../../lib/queries";

/**
 * Approval of a QR sign-in, on the signed-in device. Reached from the in-app
 * scanner, or by opening the QR's URL directly (system camera).
 */
export default function PairScreen() {
  const { t } = useTranslation();
  const token = useSession((s) => s.token);

  return (
    <SafeAreaView style={styles.screen}>
      <Seo title={t("pairing.approveTitle")} description={t("pairing.qrSteps")} noindex />
      <View style={[styles.content, centered(FORM_MAX_WIDTH)]}>
        {token ? <Approval /> : <Message icon="qr-code-outline" text={t("pairing.signedOut")} />}
      </View>
    </SafeAreaView>
  );
}

function Approval() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const info = usePairingInfo(id);
  const approve = useApprovePairing(id);
  const me = useMe();
  const done = () => router.replace("/settings");

  if (approve.isSuccess) {
    return (
      <Message
        icon="checkmark-circle"
        iconColor={colors.success}
        title={t("pairing.approved")}
        text={t("pairing.approvedHint")}
      />
    );
  }
  // A wrong pick cancelled the pairing server-side: nothing left to approve here.
  if (approve.error instanceof ApiError && approve.error.status === 403) {
    return <Message icon="close-circle-outline" iconColor={colors.danger} text={t("pairing.wrongCode")} />;
  }
  if (info.isPending) return <ActivityIndicator color={colors.primary} />;
  if (info.isError) {
    const status = info.error instanceof ApiError ? info.error.status : 0;
    const text =
      status === 410
        ? t("pairing.expired")
        : status === 409
          ? t("pairing.already")
          : status === 404
            ? t("pairing.unknown")
            : errorMessage(t, info.error);
    return <Message icon="alert-circle-outline" text={text} />;
  }

  const name = me.data?.household.members.find((m) => m.id === me.data?.memberId)?.name ?? "";
  return (
    <View style={styles.card}>
      <Ionicons
        name={/iPhone|Android|App Canapé/.test(info.data.device) ? "phone-portrait-outline" : "desktop-outline"}
        size={36}
        color={colors.primary}
      />
      <Text style={styles.title}>{t("pairing.approveTitle")}</Text>
      <Text style={styles.device}>{info.data.device}</Text>
      <Text style={styles.text}>{t("pairing.approveAs", { name })}</Text>
      <View style={styles.warning}>
        <Ionicons name="warning-outline" size={18} color={colors.warning} />
        <Text style={styles.warningText}>{t("pairing.approveWarning")}</Text>
      </View>
      <Text style={styles.pickTitle}>{t("pairing.pickCode")}</Text>
      <View style={styles.choices}>
        {info.data.choices.map((choice) => (
          <Pressable
            key={choice}
            style={styles.choice}
            onPress={() => !approve.isPending && approve.mutate(choice)}
            accessibilityRole="button"
            accessibilityLabel={choice.split("").join(" ")}
          >
            <Text style={styles.choiceLabel}>{choice}</Text>
          </Pressable>
        ))}
      </View>
      {approve.error ? <Text style={styles.error}>{errorMessage(t, approve.error)}</Text> : null}
      {approve.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      <Button label={t("household.cancel")} variant="ghost" onPress={done} />
    </View>
  );
}

function Message({
  icon,
  iconColor = colors.textMuted,
  title,
  text,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  title?: string;
  text: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={40} color={iconColor} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{text}</Text>
      <Button label={t("pairing.back")} variant="ghost" onPress={() => router.replace("/")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  card: {
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  device: { color: colors.text, fontSize: 17, fontWeight: "600", textAlign: "center" },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  warning: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  pickTitle: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  choices: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  choice: {
    minWidth: 72,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
  },
  choiceLabel: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: 4 },
});
