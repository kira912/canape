import { partitionByAvailability, type FavoriteItem, type FavoriteList } from "@canape/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Segmented } from "../../components/Filters";
import { PageTitle } from "../../components/PageTitle";
import { MemberDot } from "../../components/MemberDot";
import { TitleRow } from "../../components/TitleRow";
import { colors, fonts, spacing } from "../../constants/theme";
import { centered } from "../../lib/layout";
import { errorMessage } from "../../lib/error-message";
import { useFavorites, useHouseholdProviderIds, useIsSolo, useMe, useProvidersById } from "../../lib/queries";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const [selectedList, setList] = useState<FavoriteList>("household");
  // Solo: only the personal list exists (the shared one appears once someone joins).
  const solo = useIsSolo();
  const list: FavoriteList = solo ? "me" : selectedList;
  const favorites = useFavorites();
  const me = useMe();
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const membersById = useMemo(() => new Map((me.data?.household.members ?? []).map((m) => [m.id, m])), [me.data]);

  const items = list === "household" ? favorites.data?.household : favorites.data?.mine;
  // What we can watch tonight first; the rest stays in the list for later.
  const sections = useMemo(() => {
    if (!items) return [];
    const byTitle = partitionByAvailability(
      items.map((item) => ({ ...item, offers: item.title.offers })),
      providerIds,
    );
    return [
      { key: "available", title: t("favorites.available"), variant: "available" as const, data: byTitle.available },
      { key: "elsewhere", title: t("favorites.elsewhere"), variant: "elsewhere" as const, data: byTitle.elsewhere },
    ].filter((s) => s.data.length > 0);
  }, [items, providerIds, t]);

  return (
    <View style={styles.screen}>
      <View style={centered()}>
        <PageTitle>{solo ? t("tabs.favoritesHeaderSolo") : t("tabs.favoritesHeader")}</PageTitle>
      </View>
      {solo ? null : (
        <View style={[styles.tabs, centered()]}>
          <Segmented
            value={selectedList}
            onChange={setList}
            options={[
              {
                value: "household",
                label: t("favorites.householdTab", { count: favorites.data?.household.length ?? 0 }),
              },
              { value: "me", label: t("favorites.mineTab", { count: favorites.data?.mine.length ?? 0 }) },
            ]}
          />
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item: FavoriteItem) => `${item.title.mediaType}-${item.title.tmdbId}`}
        contentContainerStyle={[styles.list, centered()]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item, section, index }) => (
          <TitleRow
            index={index}
            title={item.title}
            householdProviderIds={providerIds}
            providersById={providersById}
            variant={section.variant}
            accessory={list === "household" ? <MemberDot member={membersById.get(item.addedBy)} size={20} /> : null}
          />
        )}
        ListEmptyComponent={
          favorites.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : favorites.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("common.loadingError")}
              message={errorMessage(t, favorites.error)}
            />
          ) : (
            <EmptyState
              icon={list === "household" ? "heart-outline" : "bookmark-outline"}
              title={list === "household" ? t("favorites.emptyHouseholdTitle") : t("favorites.emptyMineTitle")}
              message={list === "household" ? t("favorites.emptyHouseholdMessage") : t("favorites.emptyMineMessage")}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.display,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: { marginVertical: spacing.xl },
});
