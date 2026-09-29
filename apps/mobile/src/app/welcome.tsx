import { MEMBER_COLORS } from "@canape/shared";
import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { colors, radius, spacing } from "../constants/theme";
import { ApiError } from "../lib/api-client";
import { errorMessage } from "../lib/error-message";
import { useSession } from "../lib/household-store";
import { useCreateHousehold, useJoinHousehold } from "../lib/queries";

type Mode = "create" | "join";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const token = useSession((s) => s.token);
  const legacyProviderIds = useSession((s) => s.providerIds);
  const [mode, setMode] = useState<Mode>("create");
  const [memberName, setMemberName] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const create = useCreateHousehold();
  const join = useJoinHousehold();

  if (token) return <Redirect href="/" />;

  const pending = create.isPending || join.isPending;
  const failure = mode === "create" ? create.error : join.error;
  const error = !failure
    ? null
    : failure instanceof ApiError && failure.status === 404 && mode === "join"
      ? t("errors.invalidInviteCode")
      : errorMessage(t, failure);
  const canSubmit = memberName.trim().length > 0 && (mode === "create" || inviteCode.trim().length === 6) && !pending;

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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Canapé</Text>
          <Text style={styles.tagline}>{t("welcome.tagline")}</Text>

          <View style={styles.modes}>
            <Chip label={t("welcome.create")} selected={mode === "create"} onPress={() => setMode("create")} />
            <Chip label={t("welcome.join")} selected={mode === "join"} onPress={() => setMode("join")} />
          </View>

          {mode === "join" ? (
            <Field label={t("welcome.inviteCode")}>
              <TextInput
                value={inviteCode}
                onChangeText={(v) => setInviteCode(v.toUpperCase())}
                placeholder="ABC234"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={[styles.input, styles.codeInput]}
              />
            </Field>
          ) : null}

          <Field label={t("welcome.firstName")}>
            <TextInput
              value={memberName}
              onChangeText={setMemberName}
              placeholder={t("welcome.firstNamePlaceholder")}
              placeholderTextColor={colors.textMuted}
              maxLength={30}
              style={styles.input}
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
                  accessibilityState={{ selected: color === c }}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                />
              ))}
            </View>
          </Field>

          {mode === "create" ? (
            <Field label={t("welcome.householdName")}>
              <TextInput
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder={t("welcome.defaultHouseholdName")}
                placeholderTextColor={colors.textMuted}
                maxLength={40}
                style={styles.input}
              />
            </Field>
          ) : (
            <Text style={styles.hint}>{t("welcome.rejoinHint")}</Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={pending ? t("welcome.pending") : mode === "create" ? t("welcome.submitCreate") : t("welcome.submitJoin")}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  codeInput: { fontSize: 22, fontWeight: "700", letterSpacing: 6, textAlign: "center" },
  colors: { flexDirection: "row", gap: spacing.md },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.text },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: "#EB5757", fontSize: 14, textAlign: "center" },
});
