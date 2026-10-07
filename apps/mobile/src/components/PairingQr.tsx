import { pairingPath } from "@canape/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SITE } from "../constants/site";
import { colors, spacing, fonts } from "../constants/theme";
import { ApiError } from "../lib/api-client";
import { useCreatePairing, usePairingClaim } from "../lib/queries";
import { Button } from "./Button";
import { QrCode } from "./QrCode";

/** Where the QR points: this site on the web, the app's scheme otherwise (the scanner only reads the id). */
function qrBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return SITE.url || "canape:/";
}

/**
 * New, signed-out device: shows a QR for a signed-in device to scan and waits.
 * Once approved the session is stored, and the welcome screen redirects to the app.
 */
export function PairingQr() {
  const { t } = useTranslation();
  const create = useCreatePairing();
  const pairing = create.data;
  const claim = usePairingClaim(pairing);
  const { mutate } = create;

  useEffect(() => mutate(), [mutate]);

  // Renew before it expires (and when the server says it did), so the QR on screen always works.
  useEffect(() => {
    if (!pairing) return;
    const timer = setTimeout(() => mutate(), Math.max(0, Date.parse(pairing.expiresAt) - Date.now() - 5000));
    return () => clearTimeout(timer);
  }, [pairing, mutate]);
  useEffect(() => {
    if (claim.error instanceof ApiError && claim.error.status === 410) mutate();
  }, [claim.error, mutate]);

  if (create.isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{t("pairing.qrError")}</Text>
        <Button label={t("pairing.retry")} variant="ghost" onPress={() => mutate()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("pairing.qrTitle")}</Text>
      <Text style={styles.text}>{t("pairing.qrSteps")}</Text>
      <View style={styles.qr}>
        {pairing ? (
          <QrCode value={`${qrBaseUrl()}${pairingPath(pairing.id)}`} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
      {pairing ? (
        <View style={styles.codeBox}>
          <Text style={styles.text}>{t("pairing.codeLabel")}</Text>
          <Text style={styles.code} accessibilityLabel={pairing.verificationCode.split("").join(" ")}>
            {pairing.verificationCode}
          </Text>
        </View>
      ) : null}
      <View style={styles.waiting}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.text}>{t("pairing.qrWaiting")}</Text>
      </View>
      <Text style={styles.hint}>{t("pairing.qrRenew")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.display, textAlign: "center" },
  text: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, textAlign: "center" },
  qr: { width: 220, height: 220, alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  codeBox: { alignItems: "center", gap: spacing.xs },
  code: { color: colors.text, fontSize: 40, fontFamily: fonts.extrabold, letterSpacing: 8 },
  waiting: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, textAlign: "center" },
  error: { color: colors.danger, fontSize: 14, fontFamily: fonts.regular, textAlign: "center" },
});
