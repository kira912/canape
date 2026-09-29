import type { Provider } from "@canape/shared";
import { LinksService } from "./links.service";
import { normalizeName, platformForTmdbName } from "./platforms";
import type { StreamingAvailabilityClient, StreamingOption } from "./streaming-availability.client";

const netflix: Provider = { id: 8, name: "Netflix", logoUrl: null };
const canal: Provider = { id: 381, name: "Canal+", logoUrl: null };
const arte: Provider = { id: 234, name: "Arte", logoUrl: null };

function serviceWith(options: StreamingOption[]) {
  const client = { getOptions: jest.fn(async () => options) } as unknown as StreamingAvailabilityClient;
  return new LinksService(client);
}

const baseInput = {
  mediaType: "movie" as const,
  tmdbId: 1,
  title: "La Haine",
  region: "FR",
  providers: new Map([netflix, canal, arte].map((p) => [p.id, p])),
  fallbackLink: "https://tmdb/watch",
};

describe("LinksService.buildWatchOptions", () => {
  it("uses the direct title link when Streaming Availability knows it", async () => {
    const service = serviceWith([
      { serviceId: "netflix", type: "subscription", link: "https://www.netflix.com/title/123" },
    ]);

    const options = await service.buildWatchOptions({
      ...baseInput,
      offers: [{ providerId: 8, type: "subscription" }],
    });

    expect(options).toEqual([
      { provider: netflix, type: "subscription", link: "https://www.netflix.com/title/123", linkKind: "direct" },
    ]);
  });

  it("falls back to platform search, then to the TMDB page", async () => {
    const service = serviceWith([]);

    const options = await service.buildWatchOptions({
      ...baseInput,
      offers: [
        { providerId: 8, type: "subscription" },
        { providerId: 234, type: "free" },
      ],
    });

    expect(options.map((o) => [o.linkKind, o.link])).toEqual([
      ["search", "https://www.netflix.com/search?q=La%20Haine"],
      ["fallback", "https://tmdb/watch"],
    ]);
  });
});

describe("platforms", () => {
  it("normalizes provider names and matches TMDB variants", () => {
    expect(normalizeName("Apple TV+")).toBe("appletvplus");
    expect(platformForTmdbName("Netflix basic with Ads")?.key).toBe("netflix");
    expect(platformForTmdbName("Canal+")?.key).toBe("canal");
    expect(platformForTmdbName("Disney Plus")?.key).toBe("disney");
    expect(platformForTmdbName("Arte")).toBeUndefined();
  });
});
