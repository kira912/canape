import Ionicons from "@expo/vector-icons/Ionicons";
import { MEMBER_COLORS, RECOVERY_CODE_LENGTH } from "@canape/shared";
import { Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { LegalLinks } from "../components/LegalLinks";
import { FadeIn, PressableScale, Reveal, useReducedMotion } from "../components/motion";
import { PairingQr } from "../components/PairingQr";
import { Seo } from "../components/Seo";
import { TextField } from "../components/TextField";
import { alpha, colors, fonts, frappe, motion, radius, spacing } from "../constants/theme";
import { ApiError } from "../lib/api-client";
import { errorMessage } from "../lib/error-message";
import { useSession } from "../lib/household-store";
import { centered, FORM_MAX_WIDTH } from "../lib/layout";
import { useCreateHousehold, useJoinHousehold, useRecoverProfile } from "../lib/queries";

const FEATURES = [
  { icon: "tv-outline", key: "platforms", tint: frappe.blue },
  { icon: "open-outline", key: "open", tint: frappe.green },
  { icon: "flame-outline", key: "match", tint: frappe.peach },
  { icon: "sparkles-outline", key: "ai", tint: frappe.mauve },
] as const satisfies readonly { icon: ComponentProps<typeof Ionicons>["name"]; key: string; tint: string }[];

/**
 * "start": solo in one tap (a household of one, invite later); "create"/"join": shared household forms;
 * "pair": sign in by QR code from an already signed-in device; "recover": with the member's recovery code.
 */
type Mode = "start" | "create" | "join" | "pair" | "recover";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const token = useSession((s) => s.token);
  const legacyProviderIds = useSession((s) => s.providerIds);
  const [mode, setMode] = useState<Mode>("start");
  const [memberName, setMemberName] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const create = useCreateHousehold();
  const join = useJoinHousehold();
  const recover = useRecoverProfile();

  if (token) return <Redirect href="/" />;

  const pending = create.isPending || join.isPending || recover.isPending;
  const failure = mode === "join" ? join.error : mode === "recover" ? recover.error : create.error;
  const status = failure instanceof ApiError ? failure.status : null;
  const error = !failure
    ? null
    : mode === "join" && status === 404
      ? t("errors.invalidInviteCode")
      : mode === "join" && status === 409
        ? t("welcome.nameTaken")
        : mode === "recover" && (status === 404 || status === 400)
          ? t("welcome.invalidRecoveryCode")
          : errorMessage(t, failure);
  const canRecover = recoveryCode.replace(/[^a-z0-9]/gi, "").length === RECOVERY_CODE_LENGTH && !pending;
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
      <Ambience />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, centered(FORM_MAX_WIDTH)]}
          keyboardShouldPersistTaps="handled"
        >
          <Seo title={t("welcome.seoTitle")} description={t("welcome.seoDescription")} />
          <FadeIn from={20}>
            <Text style={styles.logo} accessibilityRole="header" aria-level={1}>
              Canap<Text style={styles.logoAccent}>é</Text>
            </Text>
            <Text style={styles.tagline}>{t("welcome.tagline")}</Text>
          </FadeIn>

          {mode === "start" ? (
            <>
              {/* Three choices, the most common first; the rarer ways in are folded away. */}
              <FadeIn index={2} style={styles.choices}>
                <Button label={t("welcome.start")} icon="arrow-forward" loading={pending} onPress={startSolo} />
                <Text style={styles.hint}>{t("welcome.startHint")}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label={t("welcome.together")} icon="people-outline" variant="ghost" onPress={() => setMode("create")} />
                <Pressable
                  style={styles.more}
                  onPress={() => setMoreOpen((open) => !open)}
                  accessibilityRole="button"
                  aria-expanded={moreOpen}
                >
                  <Text style={styles.moreLabel}>{t("welcome.haveAccount")}</Text>
                  <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                </Pressable>
                <Reveal open={moreOpen}>
                  <View style={styles.moreOptions}>
                    <OptionRow icon="key-outline" label={t("welcome.join")} onPress={() => setMode("join")} />
                    <OptionRow icon="qr-code-outline" label={t("pairing.welcomeButton")} onPress={() => setMode("pair")} />
                    <OptionRow icon="refresh-outline" label={t("welcome.recover")} onPress={() => setMode("recover")} />
                  </View>
                </Reveal>
              </FadeIn>
              <Features />
            </>
          ) : mode === "pair" ? (
            <>
              <BackLink onPress={() => setMode("start")} />
              <PairingQr />
            </>
          ) : mode === "recover" ? (
            <>
              <BackLink onPress={() => setMode("start")} />
              <Field label={t("welcome.recoveryCode")}>
                <TextField
                  value={recoveryCode}
                  onChangeText={(v) => setRecoveryCode(v.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={24}
                  style={styles.recoveryInput}
                  onSubmitEditing={() => canRecover && recover.mutate({ recoveryCode })}
                />
              </Field>
              <Text style={styles.hint}>{t("welcome.recoveryCodeHint")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label={t("welcome.submitRecover")}
                loading={pending}
                onPress={() => canRecover && recover.mutate({ recoveryCode })}
              />
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
                    <PressableScale
                      key={c}
                      onPress={() => setColor(c)}
                      accessibilityRole="radio"
                      aria-checked={color === c}
                      pressedScale={0.85}
                      style={[styles.swatch, color === c && styles.swatchSelected]}
                    >
                      <View style={[styles.swatchFill, { backgroundColor: c }]} />
                    </PressableScale>
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
                label={mode === "create" ? t("welcome.submitCreate") : t("welcome.submitJoin")}
                loading={pending}
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
      <View style={styles.featureGrid}>
        {FEATURES.map(({ icon, key, tint }, index) => (
          <FadeIn key={key} index={index + 4} style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: alpha(tint, 0.16) }]}>
              <Ionicons name={icon} size={20} color={tint} />
            </View>
            <Text style={styles.featureTitle} accessibilityRole="header" aria-level={3}>
              {t(`welcome.features.${key}Title`)}
            </Text>
            <Text style={styles.featureBody}>{t(`welcome.features.${key}Text`)}</Text>
          </FadeIn>
        ))}
      </View>
    </View>
  );
}

function OptionRow({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.option} onPress={onPress} accessibilityRole="button" pressedScale={0.98}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.optionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </PressableScale>
  );
}

/** Slowly drifting coloured glows behind the page: the "lights dimmed, screen on" mood of an evening in. */
function Ambience() {
  const drift = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: motion.native }),
        Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: motion.native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduced]);
  const move = (x: number, y: number) => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
    ],
  });
  return (
    <View style={styles.ambience} pointerEvents="none">
      <Animated.View style={[styles.glow, styles.glowMauve, move(40, 30)]} />
      <Animated.View style={[styles.glow, styles.glowPeach, move(-50, -20)]} />
      <Animated.View style={[styles.glow, styles.glowBlue, move(30, -40)]} />
      <LinearGradient
        colors={[alpha(colors.background, 0), colors.background]}
        locations={[0.2, 0.75]}
        style={StyleSheet.absoluteFill}
      />
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

const GLOW = 360;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: "center" },
  ambience: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  glow: {
    position: "absolute",
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
    // Web: a real blur. Native platforms keep a soft, low-opacity disc.
    ...(Platform.OS === "web" ? ({ filter: "blur(70px)" } as object) : null),
  },
  glowMauve: { top: -140, left: -100, backgroundColor: alpha(frappe.mauve, Platform.OS === "web" ? 0.45 : 0.14) },
  glowPeach: { top: -60, right: -160, backgroundColor: alpha(frappe.peach, Platform.OS === "web" ? 0.3 : 0.1) },
  glowBlue: { top: 160, left: 40, backgroundColor: alpha(frappe.blue, Platform.OS === "web" ? 0.22 : 0.08) },
  logo: {
    color: colors.primary,
    fontSize: 64,
    lineHeight: 72,
    fontFamily: fonts.displayItalic,
    textAlign: "center",
    letterSpacing: -1.5,
    marginTop: spacing.xl,
  },
  logoAccent: { color: colors.accent },
  tagline: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: fonts.regular,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  choices: { gap: spacing.md },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
  },
  moreLabel: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  moreOptions: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionLabel: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
  modes: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  field: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold },
  codeInput: { fontSize: 24, fontFamily: fonts.extrabold, letterSpacing: 8, textAlign: "center" },
  recoveryInput: { fontSize: 18, fontFamily: fonts.extrabold, letterSpacing: 2, textAlign: "center" },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchFill: { flex: 1, borderRadius: 18 },
  swatchSelected: { borderColor: colors.text },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, textAlign: "center" },
  back: { alignSelf: "flex-start" },
  backLabel: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  error: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold, textAlign: "center" },
  features: { gap: spacing.lg, marginTop: spacing.xxl },
  featuresTitle: { color: colors.text, fontSize: 24, fontFamily: fonts.display, textAlign: "center" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  feature: {
    flexGrow: 1,
    flexBasis: 160,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontFamily: fonts.bold },
  featureBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular },
  legal: { gap: spacing.sm, marginTop: spacing.xl },
  consent: { color: colors.textFaint, fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, textAlign: "center" },
});
