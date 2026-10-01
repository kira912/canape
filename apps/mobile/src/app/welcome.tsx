import Ionicons from "@expo/vector-icons/Ionicons";
import { MEMBER_COLORS } from "@canape/shared";
import { Redirect } from "expo-router";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { LegalLinks } from "../components/LegalLinks";
import { PairingQr } from "../components/PairingQr";
import { Seo } from "../components/Seo";
import { TextField } from "../components/TextField";
import { colors, radius, spacing } from "../constants/theme";
import { ApiError } from "../lib/api-client";
import { errorMessage } from "../lib/error-message";
import { useSession } from "../lib/household-store";
import { centered, FORM_MAX_WIDTH } from "../lib/layout";
import { useCreateHousehold, useJoinHousehold } from "../lib/queries";

const FEATURES = [
  { icon: "tv-outline", key: "platforms" },
  { icon: "open-outline", key: "open" },
  { icon: "flame-outline", key: "match" },
  { icon: "sparkles-outline", key: "ai" },
] as const satisfies readonly { icon: ComponentProps<typeof Ionicons>["name"]; key: string }[];

/**
 * "start": solo in one tap (a household of one, invite later); "create"/"join": shared household forms;
 * "pair": sign in by QR code from an already signed-in device.
 */
type Mode = "start" | "create" | "join" | "pair";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const token = useSession((s) => s.token);
  const legacyProviderIds = useSession((s) => s.providerIds);
  const [mode, setMode] = useState<Mode>("start");
  const [memberName, setMemberName] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const create = useCreateHousehold();
  const join = useJoinHousehold();

  if (token) return <Redirect href="/" />;

  const pending = create.isPending || join.isPending;
  const failure = mode === "join" ? join.error : create.error;
  const error = !failure
    ? null
    : failure instanceof ApiError && failure.status === 404 && mode === "join"
      ? t("errors.invalidInviteCode")
      : errorMessage(t, failure);
  const canSubmit = memberName.trim().length > 0 && (mode === "create" || inviteCode.trim().length === 6) && !pending;

  const startSolo = () =>
    create.mutate({
      memberName: t("welcome.soloName"),
      color: MEMBER_COLORS[0],
      householdName: t("welcome.defaultHouseholdName"),
      providerIds: legacyProviderIds,
    });

  const submit = () => {
    if (!canSubmit) return;
    if (mode === "create") {
      create.mutate({
        memberName,
        color,
        householdName: householdName.trim() || t("welcome.defaultHouseholdName"),
        providerIds: legacyProviderIds,
      });
    } else {
      join.mutate({ inviteCode, memberName, color });
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, centered(FORM_MAX_WIDTH)]}
          keyboardShouldPersistTaps="handled"
        >
          <Seo title={t("welcome.seoTitle")} description={t("welcome.seoDescription")} />
          <Text style={styles.logo} accessibilityRole="header" aria-level={1}>
            Canapé
          </Text>
          <Text style={styles.tagline}>{t("welcome.tagline")}</Text>

          {mode === "start" ? (
            <>
              <Button label={pending ? t("welcome.pending") : t("welcome.start")} onPress={startSolo} />
              <Text style={styles.hint}>{t("welcome.startHint")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.divider} />
              <Button label={t("welcome.together")} variant="ghost" onPress={() => setMode("create")} />
              <Button label={t("welcome.join")} variant="ghost" onPress={() => setMode("join")} />
              <Button label={t("pairing.welcomeButton")} variant="ghost" onPress={() => setMode("pair")} />
              <Features />
            </>
          ) : mode === "pair" ? (
            <>
              <BackLink onPress={() => setMode("start")} />
              <PairingQr />
            </>
          ) : (
            <>
              <BackLink onPress={() => setMode("start")} />
              <View style={styles.modes}>
                <Chip label={t("welcome.create")} selected={mode === "create"} onPress={() => setMode("create")} />
                <Chip label={t("welcome.join")} selected={mode === "join"} onPress={() => setMode("join")} />
              </View>

              {mode === "join" ? (
                <Field label={t("welcome.inviteCode")}>
                  <TextField
                    value={inviteCode}
                    onChangeText={(v) => setInviteCode(v.toUpperCase())}
                    placeholder="ABC234"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    style={styles.codeInput}
                  />
                </Field>
              ) : null}

              <Field label={t("welcome.firstName")}>
                <TextField
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholder={t("welcome.firstNamePlaceholder")}
                  maxLength={30}
                  onSubmitEditing={submit}
                />
              </Field>

              <Field label={t("welcome.color")}>
                <View style={styles.colors}>
                  {MEMBER_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      accessibilityRole="radio"
                      aria-checked={color === c}
                      style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                    />
                  ))}
                </View>
              </Field>

              {mode === "create" ? (
                <Field label={t("welcome.householdName")}>
                  <TextField
                    value={householdName}
                    onChangeText={setHouseholdName}
                    placeholder={t("welcome.defaultHouseholdName")}
                    maxLength={40}
                  />
                </Field>
              ) : (
                <Text style={styles.hint}>{t("welcome.rejoinHint")}</Text>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label={
                  pending
                    ? t("welcome.pending")
                    : mode === "create"
                      ? t("welcome.submitCreate")
                      : t("welcome.submitJoin")
                }
                onPress={submit}
              />
            </>
          )}
          <View style={styles.legal}>
            <Text style={styles.consent}>{t("welcome.legalConsent")}</Text>
            <LegalLinks />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={styles.back} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.backLabel}>← {t("welcome.back")}</Text>
    </Pressable>
  );
}

/** What the app does, for first-time visitors (this screen is also the landing page on the web). */
function Features() {
  const { t } = useTranslation();
  return (
    <View style={styles.features}>
      <Text style={styles.featuresTitle} accessibilityRole="header" aria-level={2}>
        {t("welcome.featuresTitle")}
      </Text>
      {FEATURES.map(({ icon, key }) => (
        <View key={key} style={styles.feature}>
          <View style={styles.featureIcon}>
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle} accessibilityRole="header" aria-level={3}>
              {t(`welcome.features.${key}Title`)}
            </Text>
            <Text style={styles.featureBody}>{t(`welcome.features.${key}Text`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: "center" },
  logo: { color: colors.primary, fontSize: 40, fontWeight: "800", textAlign: "center" },
  tagline: { color: colors.textMuted, fontSize: 15, textAlign: "center", marginBottom: spacing.md },
  modes: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  field: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: "600" },
  codeInput: { fontSize: 22, fontWeight: "700", letterSpacing: 6, textAlign: "center" },
  colors: { flexDirection: "row", gap: spacing.md },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.text },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  back: { alignSelf: "flex-start" },
  backLabel: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  error: { color: "#EB5757", fontSize: 14, textAlign: "center" },
  features: { gap: spacing.lg, marginTop: spacing.xl },
  featuresTitle: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
  feature: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  featureBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  legal: { gap: spacing.sm, marginTop: spacing.xl },
  consent: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
