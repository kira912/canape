import type { DiscoverSort, MediaType } from "@canape/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { ChipRow } from "../../components/ChipRow";
import { EmptyState } from "../../components/EmptyState";
import { FilterGroup, FiltersPanel, FiltersToggle, Segmented } from "../../components/Filters";
import { Skeleton } from "../../components/motion";
import { PageTitle } from "../../components/PageTitle";
import { PosterCard } from "../../components/PosterCard";
import { colors, radius, spacing } from "../../constants/theme";
import { errorMessage } from "../../lib/error-message";
import { RATING_OPTIONS, RUNTIME_OPTIONS } from "../../lib/filter-options";
import { formatRuntime } from "../../lib/labels";
import { centered, useIsWide } from "../../lib/layout";
import {
  useDiscover,
  useGenres,
  useHouseholdProviderIds,
  useMe,
  useProvidersById,
  type DiscoverFilters,
} from "../../lib/queries";

const SORTS: readonly DiscoverSort[] = ["popularity", "rating", "recent"];
/** The grid gets more room than text columns: posters read well wide. */
const GRID_MAX_WIDTH = 1080;
const GAP = spacing.md;
/** Width of the navigation rail on wide screens (see TabDock). */
const RAIL_WIDTH = 240;

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();
  const isWide = useIsWide();
  const { width: windowWidth } = useWindowDimensions();

  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [sort, setSort] = useState<DiscoverSort>("popularity");
  const [genres, setGenres] = useState<number[]>([]);
  const [maxRuntime, setMaxRuntime] = useState<number | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const genreList = useGenres(mediaType);
  const filters = useMemo<DiscoverFilters>(
    () => ({ mediaType, sort, genres, maxRuntime: mediaType === "movie" ? maxRuntime : undefined, minRating }),
    [mediaType, sort, genres, maxRuntime, minRating],
  );
  const discover = useDiscover(filters, providerIds);
  const items = useMemo(() => discover.data?.pages.flatMap((p) => p.items) ?? [], [discover.data]);

  const gridWidth = Math.min(windowWidth - (isWide ? RAIL_WIDTH : 0), GRID_MAX_WIDTH) - spacing.lg * 2;
  const columns = gridWidth < 480 ? 2 : Math.max(3, Math.floor(gridWidth / 170));
  const cardWidth = (gridWidth - GAP * (columns - 1)) / columns;

  if (me.isSuccess && providerIds.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <EmptyState icon="tv-outline" title={t("common.choosePlatformsFirst")}>
          <Button label={t("common.choosePlatforms")} onPress={() => router.navigate("/settings")} />
        </EmptyState>
      </View>
    );
  }

  const switchMediaType = (next: MediaType) => {
    setMediaType(next);
    setGenres([]); // movie and TV genre ids differ
  };
  const toggleGenre = (id: number) =>
    setGenres((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]));
  const activeFilters =
    (sort !== "popularity" ? 1 : 0) +
    (mediaType === "movie" && maxRuntime ? 1 : 0) +
    (minRating ? 1 : 0) +
    genres.length;

  return (
    <View style={styles.screen}>
      {/* Outside the list so the filters stay at hand while scrolling. */}
      <View style={[styles.header, centered(GRID_MAX_WIDTH)]}>
        <PageTitle>{t("tabs.discoverHeader")}</PageTitle>
        <View style={styles.controls}>
          <View style={styles.segmented}>
            <Segmented
              value={mediaType}
              onChange={switchMediaType}
              options={[
                { value: "movie", label: t("mediaTypePlural.movie") },
                { value: "tv", label: t("mediaTypePlural.tv") },
              ]}
            />
          </View>
          <FiltersToggle open={filtersOpen} count={activeFilters} onPress={() => setFiltersOpen((o) => !o)} />
        </View>
        <FiltersPanel open={filtersOpen}>
          <FilterGroup label={t("filters.sort")}>
            {SORTS.map((s) => (
              <Chip key={s} label={t(`discover.sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
            ))}
          </FilterGroup>
          {mediaType === "movie" ? (
            <FilterGroup label={t("filters.duration")}>
              {RUNTIME_OPTIONS.map((r) => (
                <Chip
                  key={r}
                  label={t("common.underDuration", { duration: formatRuntime(t, r) })}
                  selected={maxRuntime === r}
                  onPress={() => setMaxRuntime(maxRuntime === r ? undefined : r)}
                />
              ))}
            </FilterGroup>
          ) : null}
          <FilterGroup label={t("filters.rating")}>
            {RATING_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={t("common.rating", { value: r })}
                selected={minRating === r}
                onPress={() => setMinRating(minRating === r ? undefined : r)}
              />
            ))}
          </FilterGroup>
        </FiltersPanel>
        {/* Genres stay visible: they're the quickest way to change the mood. */}
        <ChipRow>
          {(genreList.data ?? []).map((g) => (
            <Chip key={g.id} label={g.name} selected={genres.includes(g.id)} onPress={() => toggleGenre(g.id)} />
          ))}
        </ChipRow>
      </View>
      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
        contentContainerStyle={[styles.list, centered(GRID_MAX_WIDTH)]}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        renderItem={({ item, index }) => (
          <PosterCard
            title={item}
            width={cardWidth}
            index={index % 20}
            householdProviderIds={providerIds}
            providersById={providersById}
          />
        )}
        onEndReached={() => {
          if (discover.hasNextPage && !discover.isFetchingNextPage) discover.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          discover.isPending ? (
            <PosterSkeletons columns={columns} width={cardWidth} />
          ) : discover.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("common.loadingError")}
              message={errorMessage(t, discover.error)}
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title={t("discover.noMatchTitle")}
              message={t("discover.noMatchMessage")}
            />
          )
        }
        ListFooterComponent={
          discover.isFetchingNextPage ? <PosterSkeletons columns={columns} width={cardWidth} /> : null
        }
      />
    </View>
  );
}

function PosterSkeletons({ columns, width }: { columns: number; width: number }) {
  return (
    <View style={[styles.row, styles.skeletons]}>
      {Array.from({ length: columns * 2 }, (_, i) => (
        <Skeleton key={i} style={[styles.skeleton, { width, height: width * 1.5 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: "center" },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  segmented: { flex: 1, maxWidth: 280 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: GAP, marginBottom: spacing.lg },
  skeletons: { flexDirection: "row", flexWrap: "wrap" },
  skeleton: { borderRadius: radius.md, backgroundColor: colors.surface },
});
