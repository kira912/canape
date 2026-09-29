import Ionicons from "@expo/vector-icons/Ionicons";
import {
  filterTitles,
  isWatchableOffer,
  sortTitles,
  type MediaType,
  type Provider,
  type ResultFilters,
  type ResultSort,
  type TitleSummary,
} from "@canape/shared";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { ChipRow, ChipSeparator } from "../../components/ChipRow";
import { EmptyState } from "../../components/EmptyState";
import { ProviderLogo } from "../../components/ProviderLogo";
import { TitleRow } from "../../components/TitleRow";
import { colors, radius, spacing } from "../../constants/theme";
import { errorMessage } from "../../lib/error-message";
import { RATING_OPTIONS, RUNTIME_OPTIONS } from "../../lib/filter-options";
import { formatRuntime } from "../../lib/labels";
import { useAllGenres, useHouseholdProviderIds, useMe, useProvidersById, useSearch } from "../../lib/queries";

type ViewMode = "list" | "byPlatform";

const SORTS: readonly ResultSort[] = ["relevance", "rating", "shortest", "recent"];
const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv"];

interface ResultSection {
  key: string;
  title?: string;
  provider?: Provider;
  variant: "available" | "elsewhere";
  data: TitleSummary[];
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const [input, setInput] = useState("");
  const query = useDebounced(input, 350);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showElsewhere, setShowElsewhere] = useState(false);
  const [sort, setSort] = useState<ResultSort>("relevance");
  const [filters, setFilters] = useState<ResultFilters>({});
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const genres = useAllGenres();
  const search = useSearch(query, providerIds);
  const hasFilters = Boolean(filters.mediaType || filters.maxRuntime || filters.minRating || genreNames.length);
  const genreIds = useMemo(
    () => genres.filter((g) => genreNames.includes(g.name)).flatMap((g) => g.ids),
    [genres, genreNames],
  );

  // Sorting/filtering is client-side: a search returns at most 20 titles, already fully loaded.
  const results = useMemo(() => {
    if (!search.data) return undefined;
    const refine = (items: TitleSummary[]) => sortTitles(filterTitles(items, { ...filters, genreIds }), sort);
    return { available: refine(search.data.available), elsewhere: refine(search.data.elsewhere) };
  }, [search.data, filters, genreIds, sort]);

  const toggleFilter = <K extends keyof ResultFilters>(key: K, value: ResultFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
  const toggleGenre = (name: string) =>
    setGenreNames((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));
  const clearFilters = () => {
    setFilters({});
    setGenreNames([]);
  };

  // A new search starts with only what we can watch.
  useEffect(() => setShowElsewhere(false), [query]);

  const sections = useMemo<ResultSection[]>(() => {
    if (!results) return [];
    const { available, elsewhere } = results;
    const result: ResultSection[] =
      viewMode === "list"
        ? available.length
          ? [{ key: "available", variant: "available", data: available }]
          : []
        : providerIds
            .map((id) => ({
              key: `provider-${id}`,
              provider: providersById.get(id),
              title: providersById.get(id)?.name ?? t("search.platformFallback", { id }),
              variant: "available" as const,
              data: available.filter((t) => t.offers.some((o) => o.providerId === id && isWatchableOffer(o, providerIds))),
            }))
            .filter((section) => section.data.length > 0);
    if (showElsewhere && elsewhere.length) {
      result.push({ key: "elsewhere", title: t("search.elsewhere"), variant: "elsewhere", data: elsewhere });
    }
    return result;
  }, [results, viewMode, showElsewhere, providerIds, providersById, t]);

  if (me.isSuccess && providerIds.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="tv-outline"
          title={t("common.choosePlatformsFirst")}
          message={t("search.noPlatformsMessage")}
        >
          <Button label={t("common.choosePlatforms")} onPress={() => router.navigate("/settings")} />
        </EmptyState>
      </View>
    );
  }

  const elsewhereCount = results?.elsewhere.length ?? 0;
  const availableCount = results?.available.length ?? 0;
  const unfilteredCount = (search.data?.available.length ?? 0) + (search.data?.elsewhere.length ?? 0);

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t("search.placeholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
        <Pressable
          onPress={() => setViewMode(viewMode === "list" ? "byPlatform" : "list")}
          accessibilityRole="button"
          accessibilityLabel={viewMode === "list" ? t("search.groupByPlatform") : t("search.showAsList")}
          hitSlop={8}
        >
          <Ionicons name={viewMode === "list" ? "albums-outline" : "list"} size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <ChipRow>
          {SORTS.map((s) => (
            <Chip key={s} label={t(`search.sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </ChipRow>
        <ChipRow>
          {MEDIA_TYPES.map((m) => (
            <Chip
              key={m}
              label={t(`mediaTypePlural.${m}`)}
              selected={filters.mediaType === m}
              onPress={() => toggleFilter("mediaType", m)}
            />
          ))}
          <ChipSeparator />
          {RUNTIME_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={t("common.underDuration", { duration: formatRuntime(t, r) })}
              selected={filters.maxRuntime === r}
              onPress={() => toggleFilter("maxRuntime", r)}
            />
          ))}
          {RATING_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={t("common.rating", { value: r })}
              selected={filters.minRating === r}
              onPress={() => toggleFilter("minRating", r)}
            />
          ))}
          {hasFilters ? <Chip label={t("common.clear")} onPress={clearFilters} /> : null}
        </ChipRow>
        <ChipRow>
          {genres.map((g) => (
            <Chip key={g.name} label={g.name} selected={genreNames.includes(g.name)} onPress={() => toggleGenre(g.name)} />
          ))}
        </ChipRow>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.mediaType}-${item.tmdbId}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.sectionHeader}>
              {section.provider ? <ProviderLogo provider={section.provider} size={22} /> : null}
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, section }) => (
          <TitleRow
            title={item}
            householdProviderIds={providerIds}
            providersById={providersById}
            variant={section.variant}
          />
        )}
        ListEmptyComponent={
          search.isError ? (
            <EmptyState icon="cloud-offline-outline" title={t("search.error")} message={errorMessage(t, search.error)} />
          ) : search.data && hasFilters && availableCount + elsewhereCount === 0 && unfilteredCount > 0 ? (
            <EmptyState icon="funnel-outline" title={t("search.noFilterResults")}>
              <Button label={t("common.clearFilters")} variant="ghost" onPress={clearFilters} />
            </EmptyState>
          ) : search.data && availableCount === 0 ? (
            <EmptyState
              icon="sad-outline"
              title={t("search.nothingOnPlatforms")}
              message={elsewhereCount ? undefined : t("search.noResults")}
            />
          ) : query.trim().length < 2 ? (
            <EmptyState icon="film-outline" title={t("search.promptTitle")} message={t("search.promptMessage")} />
          ) : null
        }
        ListFooterComponent={
          elsewhereCount > 0 ? (
            <Pressable style={styles.elsewhereButton} onPress={() => setShowElsewhere((v) => !v)}>
              <Text style={styles.elsewhereLabel}>
                {showElsewhere ? t("search.hideElsewhere") : t("search.showElsewhere", { count: elsewhereCount })}
              </Text>
              <Ionicons name={showElsewhere ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing.md },
  toolbar: { gap: spacing.sm, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  sectionCount: { color: colors.textMuted, fontSize: 13 },
  elsewhereButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elsewhereLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
});
