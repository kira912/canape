import Ionicons from "@expo/vector-icons/Ionicons";
import { SUPPORTED_LANGUAGES, type Household } from "@canape/shared";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { LegalLinks } from "../../components/LegalLinks";
import { PageTitle } from "../../components/PageTitle";
import { MemberDot } from "../../components/MemberDot";
import { ProviderLogo } from "../../components/ProviderLogo";
import { Seo } from "../../components/Seo";
import { TextField } from "../../components/TextField";
import { TvSection } from "../../components/TvSection";
import { colors, radius, spacing, fonts } from "../../constants/theme";
import { LANGUAGE_NAMES, type LanguagePreference } from "../../i18n";
import { ApiError } from "../../lib/api-client";
import { errorMessage } from "../../lib/error-message";
import { useSession } from "../../lib/household-store";
import { centered, useIsWide } from "../../lib/layout";
import {
  useDeleteMyData,
  useHouseholdProviderIds,
  useIsSolo,
  useLeaveHousehold,
  useMe,
  useProviders,
  useRegenerateInviteCode,
  useRegenerateRecoveryCode,
  useSignOutOtherDevices,
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
            <Seo
              title={solo ? t("tabs.profileHeader") : t("tabs.householdHeader")}
              description={t("welcome.tagline")}
              noindex
            />
            <PageTitle style={styles.flushTitle}>
              {solo ? t("tabs.profileHeader") : t("tabs.householdHeader")}
            </PageTitle>
            <HouseholdCard household={me.data.household} memberId={me.data.memberId} />
            <OtherDeviceCard />
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
            <SignOutOtherDevices />
            <DeleteMyData lastMember={me.data.household.members.length <= 1} />
            {/* TMDB's terms require its logo, less prominent than ours. */}
            <Image
              source={require("../../assets/tmdb-logo.png")}
              style={styles.tmdbLogo}
              contentFit="contain"
              accessibilityLabel="TMDB"
            />
            <Text style={styles.attribution}>{t("household.attribution")}</Text>
            <LegalLinks />
          </View>
        }
      />
    </View>
  );
}

/** Two steps: the first tap only explains what will be deleted. */
function DeleteMyData({ lastMember }: { lastMember: boolean }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteMyData();
  const isWide = useIsWide();

  if (!confirming) {
    return (
      <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" style={styles.deleteLink}>
        <Text style={styles.deleteLabel}>{t("household.deleteData")}</Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.deleteCard, isWide && styles.deleteCardWide]}>
      <Text style={styles.deleteText}>{t("household.deleteWarning")}</Text>
      {lastMember ? <Text style={styles.deleteText}>{t("household.deleteWarningLast")}</Text> : null}
      {remove.error ? <Text style={styles.error}>{errorMessage(t, remove.error)}</Text> : null}
      <View style={styles.deleteActions}>
        <Button label={t("household.cancel")} variant="ghost" onPress={() => setConfirming(false)} />
        <Pressable
          onPress={() => !remove.isPending && remove.mutate()}
          accessibilityRole="button"
          style={styles.deleteButton}
        >
          {remove.isPending ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.deleteButtonLabel}>{t("household.deleteConfirm")}</Text>
          )}
        </Pressable>
      </View>
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
      <InviteCodeRotation />
    </View>
  );
}

/** Two steps: replacing the code locks out whoever only has the old one (a guest, a leaked message…). */
function InviteCodeRotation() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const rotate = useRegenerateInviteCode();

  if (!confirming) {
    return (
      <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" style={styles.textLink}>
        <Text style={styles.textLinkLabel}>{t("household.inviteRotate")}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.confirmBox}>
      <Text style={styles.soloIntro}>{t("household.inviteRotateWarning")}</Text>
      {rotate.error ? <Text style={styles.error}>{errorMessage(t, rotate.error)}</Text> : null}
      <View style={styles.confirmActions}>
        <Button label={t("household.cancel")} variant="ghost" onPress={() => setConfirming(false)} />
        <Button
          label={rotate.isPending ? "…" : t("household.inviteRotateConfirm")}
          onPress={() => !rotate.isPending && rotate.mutate(undefined, { onSuccess: () => setConfirming(false) })}
        />
      </View>
    </View>
  );
}

/**
 * There is no account. Another device signs in by scanning a QR code from this
 * one, or — when no signed-in device is at hand — with the member's personal
 * recovery code, generated here and shown once (see HouseholdService.recover).
 */
function OtherDeviceCard() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const generate = useRegenerateRecoveryCode();
  const code = generate.data?.recoveryCode;
  // Web: clipboard. Native: the share sheet (notes, messages to oneself…).
  const canCopy = Platform.OS === "web" && typeof navigator !== "undefined" && !!navigator.clipboard;

  const keep = () => {
    if (!code) return;
    const message = t("household.otherDeviceMessage", { code });
    if (canCopy) {
      navigator.clipboard
        .writeText(message)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => undefined);
    } else {
      Share.share({ message }).catch(() => undefined);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("household.otherDeviceTitle")}</Text>
      <Text style={styles.soloIntro}>{t("household.otherDeviceIntro")}</Text>
      <Pressable
        style={[styles.shareButton, styles.scanButton]}
        onPress={() => router.push("/scan")}
        accessibilityRole="button"
      >
        <Ionicons name="qr-code-outline" size={18} color={colors.primaryText} />
        <Text style={styles.shareLabel}>{t("household.otherDeviceScan")}</Text>
      </Pressable>
      <Text style={styles.soloIntro}>{t("household.otherDeviceManual")}</Text>
      {code ? (
        <>
          <View style={styles.credential}>
            <Text style={styles.inviteLabel}>{t("household.recoveryCode")}</Text>
            <Text style={styles.credentialValue} selectable>
              {code}
            </Text>
          </View>
          <Text style={styles.inviteLabel}>{t("household.recoveryKeep")}</Text>
          <Pressable style={styles.secondaryButton} onPress={keep} accessibilityRole="button">
            <Ionicons
              name={copied ? "checkmark" : canCopy ? "copy-outline" : "paper-plane-outline"}
              size={16}
              color={colors.text}
            />
            <Text style={styles.secondaryLabel}>
              {copied
                ? t("household.otherDeviceCopied")
                : canCopy
                  ? t("household.otherDeviceCopy")
                  : t("household.otherDeviceSend")}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => !generate.isPending && generate.mutate()}
            accessibilityRole="button"
          >
            <Ionicons name="key-outline" size={16} color={colors.text} />
            <Text style={styles.secondaryLabel}>{generate.isPending ? "…" : t("household.recoveryCreate")}</Text>
          </Pressable>
          <Text style={styles.inviteLabel}>{t("household.recoveryReplaces")}</Text>
        </>
      )}
      {generate.error ? <Text style={styles.error}>{errorMessage(t, generate.error)}</Text> : null}
    </View>
  );
}

/** Lost phone, or a session opened by someone else: keeps only this device signed in. */
function SignOutOtherDevices() {
  const { t } = useTranslation();
  const signOut = useSignOutOtherDevices();
  const isWide = useIsWide();
  return (
    <View style={styles.signOutOthers}>
      <Button
        label={signOut.isPending ? "…" : t("household.signOutOthers")}
        variant="ghost"
        onPress={() => !signOut.isPending && signOut.mutate()}
        style={isWide ? styles.signOutWide : undefined}
      />
      {signOut.isSuccess ? <Text style={styles.success}>{t("household.signOutOthersDone")}</Text> : null}
      {signOut.error ? <Text style={styles.error}>{errorMessage(t, signOut.error)}</Text> : null}
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
  cardTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  members: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  member: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberName: { color: colors.text, fontSize: 15, fontFamily: fonts.regular },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  inviteText: { flex: 1 },
  inviteLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  inviteCode: { color: colors.text, fontSize: 24, fontFamily: fonts.extrabold, letterSpacing: 4 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareLabel: { color: colors.primaryText, fontFamily: fonts.semibold },
  scanButton: { alignSelf: "flex-start" },
  credential: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  credentialValue: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryLabel: { color: colors.text, fontFamily: fonts.semibold },
  soloInvite: { gap: spacing.xs, marginTop: spacing.sm },
  soloIntro: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  nameEditor: { gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameInput: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.regular },
  success: { color: colors.success, fontSize: 13, fontFamily: fonts.regular, textAlign: "center" },
  textLink: { alignSelf: "flex-start" },
  textLinkLabel: { color: colors.primary, fontSize: 13, fontFamily: fonts.semibold },
  confirmBox: { gap: spacing.sm },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  signOutOthers: { gap: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.display, marginTop: spacing.md },
  languages: { gap: spacing.sm },
  languageChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  intro: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
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
  name: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.regular },
  footer: { gap: spacing.lg, marginTop: spacing.xl },
  signOutWide: { alignSelf: "center" },
  /** The list already has horizontal padding. */
  flushTitle: { paddingHorizontal: 0 },
  deleteLink: { alignSelf: "center", padding: spacing.sm },
  deleteLabel: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold },
  deleteCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  deleteCardWide: { alignSelf: "center", maxWidth: 480 },
  deleteText: { color: colors.text, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  deleteActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonLabel: { color: colors.primaryText, fontSize: 15, fontFamily: fonts.bold },
  tmdbLogo: { width: 91, height: 12, alignSelf: "center" },
  attribution: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, textAlign: "center", lineHeight: 16 },
});
