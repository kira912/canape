import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import { useSession } from "../lib/household-store";
import { networksToScan, requestLanAccess } from "../lib/tv/lan-access";
import { probeSamsungTv, scanForTvs, tvControlAvailable, type SavedTv } from "../lib/tv/samsung";
import { Button } from "./Button";
import { TextField } from "./TextField";

/** Profile / household screen: find the Samsung TV on the Wi-Fi and remember it on this device. */
export function TvSection() {
  const { t } = useTranslation();
  const tv = useSession((s) => s.tv);
  const setTv = useSession((s) => s.setTv);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState<SavedTv[] | null>(null);
  const [manualIp, setManualIp] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!tvControlAvailable) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{t("tv.title")}</Text>
        <Text style={styles.muted}>{t("tv.browserUnsupported")}</Text>
      </View>
    );
  }

  const scan = async () => {
    setScanning(true);
    setMessage(null);
    setFound(null);
    setProgress(0);
    try {
      if (!(await requestLanAccess())) {
        setMessage(t("tv.lanDenied"));
        return;
      }
      let tvs: SavedTv[] = [];
      for (const address of await networksToScan()) {
        tvs = await scanForTvs(address, setProgress);
        if (tvs.length > 0) break;
      }
      setFound(tvs);
      if (tvs.length === 0) setMessage(t("tv.none"));
      // A single TV on the network: pick it straight away.
      if (tvs.length === 1) setTv(tvs[0]);
    } catch {
      setMessage(t("tv.none"));
    } finally {
      setScanning(false);
    }
  };

  const addManually = async () => {
    const ip = manualIp.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return;
    setMessage(null);
    if (!(await requestLanAccess())) {
      setMessage(t("tv.lanDenied"));
      return;
    }
    const probed = await probeSamsungTv(ip, 4000);
    if (probed) {
      setTv(probed);
      setManualIp("");
    } else {
      setMessage(t("tv.notFoundAt"));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t("tv.title")}</Text>
      <Text style={styles.muted}>{t("tv.intro")}</Text>
      {Platform.OS === "web" && !tv ? <Text style={styles.muted}>{t("tv.lanPrompt")}</Text> : null}

      {tv ? (
        <View style={styles.card}>
          <Ionicons name="tv" size={28} color={colors.primary} />
          <View style={styles.cardText}>
            <Text style={styles.tvName}>{tv.name}</Text>
            <Text style={styles.muted}>{[tv.model, tv.ip].filter(Boolean).join(" · ")}</Text>
          </View>
          <Pressable
            onPress={() => setTv(null)}
            accessibilityRole="button"
            accessibilityLabel={t("tv.forget")}
            hitSlop={8}
          >
            <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <>
          <Button
            label={scanning ? t("tv.searching", { done: progress }) : t("tv.search")}
            variant="ghost"
            onPress={() => !scanning && void scan()}
          />
          {scanning ? <ActivityIndicator color={colors.primary} /> : null}
          {found && found.length > 1
            ? found.map((candidate) => (
                <Pressable key={candidate.ip} style={styles.card} onPress={() => setTv(candidate)}>
                  <Ionicons name="tv-outline" size={24} color={colors.text} />
                  <View style={styles.cardText}>
                    <Text style={styles.tvName}>{candidate.name}</Text>
                    <Text style={styles.muted}>{[candidate.model, candidate.ip].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Text style={styles.use}>{t("tv.use")}</Text>
                </Pressable>
              ))
            : null}
          <View style={styles.manualRow}>
            <TextField
              value={manualIp}
              onChangeText={setManualIp}
              placeholder={t("tv.manualIp")}
              keyboardType="numeric"
              autoCorrect={false}
              style={styles.manualInput}
              onSubmitEditing={() => void addManually()}
            />
            <Button label={t("tv.add")} variant="ghost" onPress={() => void addManually()} />
          </View>
        </>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.md },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: { flex: 1, gap: 2 },
  tvName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  use: { color: colors.primary, fontWeight: "700" },
  manualRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  manualInput: { flex: 1 },
  message: { color: colors.warning, fontSize: 13 },
});
