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
import { EmptyState } from "../../components/EmptyState";
import { FilterGroup, FiltersPanel, FiltersToggle, Segmented } from "../../components/Filters";
import { PressableScale } from "../../components/motion";
import { PageTitle } from "../../components/PageTitle";
import { ProviderLogo } from "../../components/ProviderLogo";
import { TitleRow } from "../../components/TitleRow";
import { alpha, colors, fonts, radius, spacing } from "../../constants/theme";
import { errorMessage } from "../../lib/error-message";
import { RATING_OPTIONS, RUNTIME_OPTIONS } from "../../lib/filter-options";
import { formatRuntime } from "../../lib/labels";
import { centered } from "../../lib/layout";
import {
  useAiSearch,
  useAllGenres,
  useHouseholdProviderIds,
  useMe,
  useProvidersById,
  useSearch,
} from "../../lib/queries";

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
  const [searchFocused, setSearchFocused] = useState(false);
  const query = useDebounced(input, 350);
  // AI mode: Claude interprets a description, submitted explicitly (each call costs money).
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showElsewhere, setShowElsewhere] = useState(false);
  const [sort, setSort] = useState<ResultSort>("relevance");
  const [filters, setFilters] = useState<ResultFilters>({});
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const genres = useAllGenres();
  const search = useSearch(aiMode ? "" : query, providerIds);
  const ai = useAiSearch(aiMode ? aiQuery : "", providerIds);
  const active = aiMode ? ai : search;
  // AI results are already restricted to the household's platforms: nothing "elsewhere".
  const source = aiMode ? (ai.data ? { available: ai.data.items, elsewhere: [] } : undefined) : search.data;
  const hasFilters = Boolean(filters.mediaType || filters.maxRuntime || filters.minRating || genreNames.length);
  // Counted on the "Filters" button (the film/series switch is visible on its own).
  const activeFilters =
    (sort !== "relevance" ? 1 : 0) + (filters.maxRuntime ? 1 : 0) + (filters.minRating ? 1 : 0) + genreNames.length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const genreIds = useMemo(
    () => genres.filter((g) => genreNames.includes(g.name)).flatMap((g) => g.ids),
    [genres, genreNames],
  );

  // Sorting/filtering is client-side: a search returns at most 20 titles, already fully loaded.
  const results = useMemo(() => {
    if (!source) return undefined;
    const refine = (items: TitleSummary[]) => sortTitles(filterTitles(items, { ...filters, genreIds }), sort);
    return { available: refine(source.available), elsewhere: refine(source.elsewhere) };
  }, [source, filters, genreIds, sort]);

  const toggleFilter = <K extends keyof ResultFilters>(key: K, value: ResultFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
  const toggleGenre = (name: string) =>
    setGenreNames((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));
  const clearFilters = () => {
    setFilters({});
    setSort("relevance");
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
              data: available.filter((t) =>
                t.offers.some((o) => o.providerId === id && isWatchableOffer(o, providerIds)),
              ),
            }))
            .filter((section) => section.data.length > 0);
    if (showElsewhere && elsewhere.length) {
      result.push({ key: "elsewhere", title: t("search.elsewhere"), variant: "elsewhere", data: elsewhere });
    }
    return result;
  }, [results, viewMode, showElsewhere, providerIds, providersById, t]);

  if (me.isSuccess && providerIds.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <EmptyState icon="tv-outline" title={t("common.choosePlatformsFirst")} message={t("search.noPlatformsMessage")}>
          <Button label={t("common.choosePlatforms")} onPress={() => router.navigate("/settings")} />
        </EmptyState>
      </View>
    );
  }

  const elsewhereCount = results?.elsewhere.length ?? 0;
  const availableCount = results?.available.length ?? 0;
  const unfilteredCount = (source?.available.length ?? 0) + (source?.elsewhere.length ?? 0);
  const submitAi = () => aiMode && setAiQuery(input);
  const toggleAi = () => {
    setAiMode((on) => !on);
    setAiQuery("");
  };

  return (
    <View style={styles.screen}>
      <View style={[centered(), styles.header]}>
        <PageTitle>{t("tabs.searchHeader")}</PageTitle>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused, aiMode && styles.searchBarAi]}>
          <Ionicons
            name={aiMode ? "sparkles" : "search"}
            size={19}
            color={aiMode || searchFocused ? colors.primary : colors.textFaint}
          />
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submitAi}
            placeholder={aiMode ? t("ai.placeholder") : t("search.placeholder")}
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            style={styles.input}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {active.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
          {aiMode && input.trim() ? (
            <Pressable onPress={submitAi} accessibilityRole="button" accessibilityLabel={t("ai.send")} hitSlop={8}>
              <Ionicons name="arrow-up-circle" size={30} color={colors.primary} />
            </Pressable>
          ) : null}
          <AiSwitch on={aiMode} onPress={toggleAi} />
        </View>

        <View style={styles.controls}>
          <View style={styles.segmented}>
            <Segmented
              value={filters.mediaType ?? "all"}
              onChange={(value) => setFilters((f) => ({ ...f, mediaType: value === "all" ? undefined : value }))}
              options={[
                { value: "all", label: t("common.all") },
                ...MEDIA_TYPES.map((m) => ({ value: m, label: t(`mediaTypePlural.${m}`) })),
              ]}
            />
          </View>
          <FiltersToggle open={filtersOpen} count={activeFilters} onPress={() => setFiltersOpen((o) => !o)} />
        </View>

        <FiltersPanel open={filtersOpen}>
          <FilterGroup label={t("filters.sort")}>
            {SORTS.map((s) => (
              <Chip key={s} label={t(`search.sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
            ))}
          </FilterGroup>
          <FilterGroup label={t("filters.duration")}>
            {RUNTIME_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={t("common.underDuration", { duration: formatRuntime(t, r) })}
                selected={filters.maxRuntime === r}
                onPress={() => toggleFilter("maxRuntime", r)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label={t("filters.rating")}>
            {RATING_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={t("common.rating", { value: r })}
                selected={filters.minRating === r}
                onPress={() => toggleFilter("minRating", r)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label={t("filters.genres")}>
            {genres.map((g) => (
              <Chip
                key={g.name}
                label={g.name}
                selected={genreNames.includes(g.name)}
                onPress={() => toggleGenre(g.name)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label={t("filters.display")}>
            <Chip
              icon="list"
              label={t("search.showAsList")}
              selected={viewMode === "list"}
              onPress={() => setViewMode("list")}
            />
            <Chip
              icon="albums-outline"
              label={t("search.groupByPlatform")}
              selected={viewMode === "byPlatform"}
              onPress={() => setViewMode("byPlatform")}
            />
            {activeFilters ? <Chip icon="refresh" label={t("common.clearFilters")} onPress={clearFilters} /> : null}
          </FilterGroup>
        </FiltersPanel>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.mediaType}-${item.tmdbId}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, centered()]}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          aiMode && ai.data ? (
            <View style={styles.aiSummary}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={styles.aiSummaryText}>
                {t("ai.understood")} → {ai.data.summary}
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.sectionHeader}>
              {section.provider ? <ProviderLogo provider={section.provider} size={22} /> : null}
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, section, index }) => (
          <TitleRow
            index={index}
            title={item}
            householdProviderIds={providerIds}
            providersById={providersById}
            variant={section.variant}
          />
        )}
        ListEmptyComponent={
          active.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("search.error")}
              message={errorMessage(t, active.error)}
            />
          ) : aiMode && !ai.data ? (
            ai.isFetching ? null : (
              <EmptyState icon="sparkles-outline" title={t("ai.promptTitle")} message={t("ai.promptMessage")} />
            )
          ) : aiMode && ai.data && unfilteredCount === 0 ? (
            <EmptyState icon="sad-outline" title={t("ai.noResults")} />
          ) : source && hasFilters && availableCount + elsewhereCount === 0 && unfilteredCount > 0 ? (
            <EmptyState icon="funnel-outline" title={t("search.noFilterResults")}>
              <Button label={t("common.clearFilters")} variant="ghost" onPress={clearFilters} />
            </EmptyState>
          ) : source && availableCount === 0 ? (
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

/** Switches between title search and the AI "describe your mood" search: labelled, so it's discoverable. */
function AiSwitch({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="switch"
      aria-checked={on}
      accessibilityLabel={on ? t("ai.disable") : t("ai.enable")}
      hitSlop={6}
      pressedScale={0.9}
      style={[styles.aiSwitch, on && styles.aiSwitchOn]}
    >
      <Ionicons name="sparkles" size={13} color={on ? colors.primaryText : colors.primary} />
      <Text style={[styles.aiSwitchLabel, on && styles.aiSwitchLabelOn]}>{t("search.aiBadge")}</Text>
    </PressableScale>
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
  center: { justifyContent: "center" },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchBarFocused: { borderColor: colors.primary },
  searchBarAi: { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.6) },
  input: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.semibold, paddingVertical: spacing.md },
  aiSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.primary, 0.14),
  },
  aiSwitchOn: { backgroundColor: colors.primary },
  aiSwitchLabel: { color: colors.primary, fontSize: 13, fontFamily: fonts.extrabold },
  aiSwitchLabelOn: { color: colors.primaryText },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  segmented: { flex: 1, maxWidth: 320 },
  aiSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.1),
  },
  aiSummaryText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fonts.displayItalic },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display, flex: 1 },
  sectionCount: { color: colors.textFaint, fontSize: 13, fontFamily: fonts.bold },
  elsewhereButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elsewhereLabel: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bold },
});
