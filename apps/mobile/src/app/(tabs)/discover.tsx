import type { DiscoverSort, MediaType } from "@canape/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { ChipRow, ChipSeparator } from "../../components/ChipRow";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { TitleRow } from "../../components/TitleRow";
import { colors, spacing } from "../../constants/theme";
import { errorMessage } from "../../lib/error-message";
import { RATING_OPTIONS, RUNTIME_OPTIONS } from "../../lib/filter-options";
import { formatRuntime } from "../../lib/labels";
import { centered } from "../../lib/layout";
import {
  useDiscover,
  useGenres,
  useHouseholdProviderIds,
  useMe,
  useProvidersById,
  type DiscoverFilters,
} from "../../lib/queries";

const SORTS: readonly DiscoverSort[] = ["popularity", "rating", "recent"];

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const providerIds = useHouseholdProviderIds();
  const providersById = useProvidersById();

  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [sort, setSort] = useState<DiscoverSort>("popularity");
  const [genres, setGenres] = useState<number[]>([]);
  const [maxRuntime, setMaxRuntime] = useState<number | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();

  const genreList = useGenres(mediaType);
  const filters = useMemo<DiscoverFilters>(
    () => ({ mediaType, sort, genres, maxRuntime: mediaType === "movie" ? maxRuntime : undefined, minRating }),
    [mediaType, sort, genres, maxRuntime, minRating],
  );
  const discover = useDiscover(filters, providerIds);
  const items = useMemo(() => discover.data?.pages.flatMap((p) => p.items) ?? [], [discover.data]);

  if (me.isSuccess && providerIds.length === 0) {
    return (
      <View style={styles.screen}>
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

  const header = (
    <View style={[styles.filters, centered()]}>
      <PageTitle>{t("tabs.discoverHeader")}</PageTitle>
      <ChipRow>
        <Chip
          label={t("mediaTypePlural.movie")}
          selected={mediaType === "movie"}
          onPress={() => switchMediaType("movie")}
        />
        <Chip label={t("mediaTypePlural.tv")} selected={mediaType === "tv"} onPress={() => switchMediaType("tv")} />
        <ChipSeparator />
        {SORTS.map((s) => (
          <Chip key={s} label={t(`discover.sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </ChipRow>
      <ChipRow>
        {mediaType === "movie"
          ? RUNTIME_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={t("common.underDuration", { duration: formatRuntime(t, r) })}
                selected={maxRuntime === r}
                onPress={() => setMaxRuntime(maxRuntime === r ? undefined : r)}
              />
            ))
          : null}
        {RATING_OPTIONS.map((r) => (
          <Chip
            key={r}
            label={t("common.rating", { value: r })}
            selected={minRating === r}
            onPress={() => setMinRating(minRating === r ? undefined : r)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {(genreList.data ?? []).map((g) => (
          <Chip key={g.id} label={g.name} selected={genres.includes(g.id)} onPress={() => toggleGenre(g.id)} />
        ))}
      </ChipRow>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Outside the list so the filters stay visible while scrolling, like on the search tab. */}
      {header}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
        contentContainerStyle={[styles.list, centered()]}
        renderItem={({ item }) => (
          <TitleRow title={item} householdProviderIds={providerIds} providersById={providersById} />
        )}
        onEndReached={() => {
          if (discover.hasNextPage && !discover.isFetchingNextPage) discover.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          discover.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
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
          discover.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filters: { gap: spacing.sm, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  loader: { marginVertical: spacing.xl },
});
