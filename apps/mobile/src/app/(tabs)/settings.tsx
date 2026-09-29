import Ionicons from "@expo/vector-icons/Ionicons";
import { SUPPORTED_LANGUAGES, type Household } from "@canape/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { MemberDot } from "../../components/MemberDot";
import { ProviderLogo } from "../../components/ProviderLogo";
import { TextField } from "../../components/TextField";
import { TvSection } from "../../components/TvSection";
import { colors, radius, spacing } from "../../constants/theme";
import { LANGUAGE_NAMES, type LanguagePreference } from "../../i18n";
import { ApiError } from "../../lib/api-client";
import { errorMessage } from "../../lib/error-message";
import { useSession } from "../../lib/household-store";
import { centered, useIsWide } from "../../lib/layout";
import {
  useHouseholdProviderIds,
  useIsSolo,
  useLeaveHousehold,
  useMe,
  useProviders,
  useUpdateMember,
  useUpdateProviders,
} from "../../lib/queries";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const providers = useProviders();
  const me = useMe();
  const providerIds = useHouseholdProviderIds();
  const updateProviders = useUpdateProviders();
  const leave = useLeaveHousehold();
  const [filter, setFilter] = useState("");
  const isWide = useIsWide();
  const solo = useIsSolo();

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (providers.data ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle));
  }, [providers.data, filter]);

  if (providers.isPending || me.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (providers.isError || me.isError) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.loadingError")}
          message={errorMessage(t, providers.error ?? me.error)}
        />
      </View>
    );
  }

  const toggle = (id: number) =>
    updateProviders.mutate(providerIds.includes(id) ? providerIds.filter((p) => p !== id) : [...providerIds, id]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={[styles.list, centered()]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <PageTitle style={styles.flushTitle}>
              {solo ? t("tabs.profileHeader") : t("tabs.householdHeader")}
            </PageTitle>
            <HouseholdCard household={me.data.household} memberId={me.data.memberId} />
            <LanguagePicker />
            <TvSection />
            <Text style={styles.sectionTitle}>{t("household.platforms")}</Text>
            <Text style={styles.intro}>{t("household.platformsIntro")}</Text>
            <TextField
              value={filter}
              onChangeText={setFilter}
              placeholder={t("household.filter", { count: providerIds.length })}
              autoCorrect={false}
            />
          </View>
        }
        renderItem={({ item }) => {
          const selected = providerIds.includes(item.id);
          return (
            <Pressable
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              aria-checked={selected}
            >
              <ProviderLogo provider={item} size={36} />
              <Text style={styles.name}>{item.name}</Text>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={selected ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              label={t("household.signOut")}
              variant="ghost"
              onPress={() => leave.mutate()}
              style={isWide ? styles.signOutWide : undefined}
            />
            <Text style={styles.attribution}>{t("household.attribution")}</Text>
          </View>
        }
      />
    </View>
  );
}

const LANGUAGE_OPTIONS: readonly LanguagePreference[] = ["system", ...SUPPORTED_LANGUAGES];

function LanguagePicker() {
  const { t } = useTranslation();
  const preference = useSession((s) => s.language);
  const setLanguage = useSession((s) => s.setLanguage);
  return (
    <View style={styles.languages}>
      <Text style={styles.sectionTitle}>{t("household.language")}</Text>
      <View style={styles.languageChips}>
        {LANGUAGE_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option === "system" ? t("household.languageSystem") : LANGUAGE_NAMES[option]}
            selected={preference === option}
            onPress={() => setLanguage(option)}
          />
        ))}
      </View>
    </View>
  );
}

function HouseholdCard({ household, memberId }: { household: Household; memberId: string }) {
  const { t } = useTranslation();
  const solo = household.members.length <= 1;
  const share = () =>
    Share.share({ message: t("household.shareMessage", { code: household.inviteCode }) }).catch(() => undefined);

  return (
    <View style={styles.card}>
      {solo ? null : (
        <>
          <Text style={styles.cardTitle}>{household.name}</Text>
          <View style={styles.members}>
            {household.members.map((m) => (
              <View key={m.id} style={styles.member}>
                <MemberDot member={m} size={22} />
                <Text style={styles.memberName}>
                  {m.id === memberId ? t("household.you", { name: m.name }) : m.name}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <NameEditor current={household.members.find((m) => m.id === memberId)?.name ?? ""} />
      {solo ? (
        <View style={styles.soloInvite}>
          <Text style={styles.cardTitle}>{t("household.soloTitle")}</Text>
          <Text style={styles.soloIntro}>{t("household.soloIntro")}</Text>
        </View>
      ) : null}
      <View style={styles.inviteRow}>
        <View style={styles.inviteText}>
          <Text style={styles.inviteLabel}>{t("household.inviteCode")}</Text>
          <Text style={styles.inviteCode} selectable>
            {household.inviteCode}
          </Text>
        </View>
        <Pressable style={styles.shareButton} onPress={share} accessibilityRole="button">
          <Ionicons name="share-outline" size={18} color={colors.primaryText} />
          <Text style={styles.shareLabel}>{t("household.share")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Rename yourself, e.g. the default "Moi" of a solo start, before inviting someone. */
function NameEditor({ current }: { current: string }) {
  const { t } = useTranslation();
  const [name, setName] = useState(current);
  const update = useUpdateMember();
  useEffect(() => setName(current), [current]);
  const dirty = name.trim().length > 0 && name.trim() !== current;
  const failure = update.error;

  return (
    <View style={styles.nameEditor}>
      <Text style={styles.inviteLabel}>{t("household.yourName")}</Text>
      <View style={styles.nameRow}>
        <TextField
          value={name}
          onChangeText={setName}
          maxLength={30}
          style={styles.nameInput}
          onSubmitEditing={() => dirty && update.mutate({ name: name.trim() })}
        />
        {dirty ? <Button label={t("household.save")} onPress={() => update.mutate({ name: name.trim() })} /> : null}
      </View>
      {failure ? (
        <Text style={styles.error}>
          {failure instanceof ApiError && failure.status === 409 ? t("household.nameTaken") : errorMessage(t, failure)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  header: { gap: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  members: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  member: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberName: { color: colors.text, fontSize: 15 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  inviteText: { flex: 1 },
  inviteLabel: { color: colors.textMuted, fontSize: 12 },
  inviteCode: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: 4 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareLabel: { color: colors.primaryText, fontWeight: "600" },
  soloInvite: { gap: spacing.xs, marginTop: spacing.sm },
  soloIntro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  nameEditor: { gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameInput: { flex: 1 },
  error: { color: "#EB5757", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: spacing.md },
  languages: { gap: spacing.sm },
  languageChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: { borderColor: colors.primary },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  footer: { gap: spacing.lg, marginTop: spacing.xl },
  signOutWide: { alignSelf: "center" },
  /** The list already has horizontal padding. */
  flushTitle: { paddingHorizontal: 0 },
  attribution: { color: colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
