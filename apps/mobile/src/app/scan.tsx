import Ionicons from "@expo/vector-icons/Ionicons";
import { pairingPath, parsePairingQr } from "@canape/shared";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Seo } from "../components/Seo";
import { colors, radius, spacing, fonts } from "../constants/theme";
import { useSession } from "../lib/household-store";
import "../lib/scanner-setup";

/** Signed-in device: scans the QR shown by a new device, then asks to approve it (/pair/[id]). */
export default function ScanScreen() {
  const { t } = useTranslation();
  const token = useSession((s) => s.token);
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const handled = useRef(false);

  if (!token) return <Redirect href="/welcome" />;

  const close = () => (router.canGoBack() ? router.back() : router.replace("/settings"));

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const id = parsePairingQr(data);
    if (!id) {
      setInvalid(true);
      return;
    }
    handled.current = true;
    router.replace(pairingPath(id) as `/pair/${string}`);
  };

  let body;
  if (!permission) {
    body = <ActivityIndicator color={colors.primary} />;
  } else if (cameraError) {
    body = <Text style={styles.message}>{t("pairing.cameraUnavailable")}</Text>;
  } else if (!permission.granted) {
    body = (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
        <Text style={styles.message}>
          {permission.canAskAgain ? t("pairing.cameraPermission") : t("pairing.cameraDenied")}
        </Text>
        {permission.canAskAgain ? (
          <Button label={t("pairing.cameraAllow")} onPress={() => void requestPermission()} />
        ) : null}
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.cameraFrame}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScanned}
            onMountError={() => setCameraError(true)}
          />
        </View>
        <Text style={[styles.message, invalid && styles.invalid]}>
          {invalid ? t("pairing.scanInvalid") : t("pairing.scanHint")}
        </Text>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Seo title={t("pairing.scanTitle")} description={t("pairing.scanHint")} noindex />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t("pairing.scanTitle")}
        </Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t("pairing.close")} hitSlop={8}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.content}>{body}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  cameraFrame: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "#000",
  },
  permission: { alignItems: "center", gap: spacing.lg, maxWidth: 360 },
  message: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.regular, lineHeight: 21, textAlign: "center" },
  invalid: { color: colors.warning },
});
