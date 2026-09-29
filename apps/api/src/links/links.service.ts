import { Injectable } from "@nestjs/common";
import type { MediaType, Offer, OfferType, Provider, WatchOption } from "@canape/shared";
import { platformForStreamingAvailabilityId, platformForTmdbName, platformSearchUrl } from "./platforms";
import { StreamingAvailabilityClient, type StreamingOption } from "./streaming-availability.client";

/** Streaming Availability option types that can stand in for one of our offer types. */
const COMPATIBLE_TYPES: Record<OfferType, readonly string[]> = {
  subscription: ["subscription", "addon"],
  free: ["free"],
  ads: ["free", "subscription"],
  rent: ["rent"],
  buy: ["buy"],
};

export interface WatchOptionsInput {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  region: string;
  offers: readonly Offer[];
  providers: ReadonlyMap<number, Provider>;
  /** TMDB "where to watch" page for the title. */
  fallbackLink: string;
}

@Injectable()
export class LinksService {
  constructor(private readonly streamingAvailability: StreamingAvailabilityClient) {}

  /**
   * One watch option per offer, each with the best link we can get:
   * direct title link (→ opens the native app) > platform search > TMDB page.
   */
  async buildWatchOptions(input: WatchOptionsInput): Promise<WatchOption[]> {
    const directOptions =
      input.offers.length > 0
        ? await this.streamingAvailability.getOptions(input.mediaType, input.tmdbId, input.region)
        : [];

    const options: WatchOption[] = [];
    console.log(directOptions)
    for (const offer of input.offers) {
      const provider = input.providers.get(offer.providerId);
      if (!provider) continue;
      const platform = platformForTmdbName(provider.name)?.key ?? null;

      const direct = findDirectLink(directOptions, provider, offer.type);
      if (direct) {
        options.push({ provider, type: offer.type, link: direct, linkKind: "direct", platform });
        continue;
      }
      const search = platformSearchUrl(provider.name, input.title);
      options.push(
        search
          ? { provider, type: offer.type, link: search, linkKind: "search", platform }
          : { provider, type: offer.type, link: input.fallbackLink, linkKind: "fallback", platform },
      );
    }
    return options;
  }
}

function findDirectLink(options: readonly StreamingOption[], provider: Provider, type: OfferType): string | null {
  const platform = platformForTmdbName(provider.name);
  if (!platform) return null;
  const samePlatform = options.filter((o) => platformForStreamingAvailabilityId(o.serviceId)?.key === platform.key);
  // Any link of the same platform still lands on the title page; prefer the matching offer type.
  const best = samePlatform.find((o) => COMPATIBLE_TYPES[type].includes(o.type)) ?? samePlatform[0];
  return best?.link ?? null;
}
