import { WATCHABLE_OFFER_TYPES, type Offer, type TitleSummary } from "./catalog";

/** An offer the household can watch right now, at no extra cost. */
export function isWatchableOffer(offer: Offer, householdProviderIds: readonly number[]): boolean {
  return WATCHABLE_OFFER_TYPES.includes(offer.type) && householdProviderIds.includes(offer.providerId);
}

export function watchableOffers(offers: readonly Offer[], householdProviderIds: readonly number[]): Offer[] {
  return offers.filter((offer) => isWatchableOffer(offer, householdProviderIds));
}

/**
 * Splits results into what the household can watch now and the rest
 * (other platforms, rent/buy, not streamable in the region), keeping the
 * original relevance order inside each group.
 */
export function partitionByAvailability<T extends Pick<TitleSummary, "offers">>(
  items: readonly T[],
  householdProviderIds: readonly number[],
): { available: T[]; elsewhere: T[] } {
  const available: T[] = [];
  const elsewhere: T[] = [];
  for (const item of items) {
    (watchableOffers(item.offers, householdProviderIds).length > 0 ? available : elsewhere).push(item);
  }
  return { available, elsewhere };
}

export type SeasonCoverage = "all" | "partial" | "none";

/** For a series: can the household watch every season, only some, or none? */
export function seasonCoverage(
  seasons: readonly { offers: readonly Offer[] }[],
  householdProviderIds: readonly number[],
): SeasonCoverage {
  if (seasons.length === 0) return "none";
  const watchable = seasons.filter((s) => watchableOffers(s.offers, householdProviderIds).length > 0).length;
  if (watchable === 0) return "none";
  return watchable === seasons.length ? "all" : "partial";
}
