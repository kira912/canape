import { describe, expect, it } from "vitest";
import { isWatchableOffer, partitionByAvailability, seasonCoverage } from "./availability";
import { searchQuerySchema } from "./catalog";
import { resolveLanguage } from "./i18n";

const NETFLIX = 8;
const PRIME = 119;
const DISNEY = 337;

describe("isWatchableOffer", () => {
  it("accepts subscription/free/ads offers on an owned platform", () => {
    expect(isWatchableOffer({ providerId: NETFLIX, type: "subscription" }, [NETFLIX])).toBe(true);
    expect(isWatchableOffer({ providerId: NETFLIX, type: "ads" }, [NETFLIX])).toBe(true);
  });

  it("rejects platforms the household does not own", () => {
    expect(isWatchableOffer({ providerId: DISNEY, type: "subscription" }, [NETFLIX])).toBe(false);
  });

  it("rejects rent and buy even on an owned platform", () => {
    expect(isWatchableOffer({ providerId: PRIME, type: "rent" }, [PRIME])).toBe(false);
    expect(isWatchableOffer({ providerId: PRIME, type: "buy" }, [PRIME])).toBe(false);
  });
});

describe("partitionByAvailability", () => {
  it("keeps relevance order and sends everything else to elsewhere", () => {
    const items = [
      { id: "a", offers: [{ providerId: DISNEY, type: "subscription" as const }] },
      { id: "b", offers: [{ providerId: NETFLIX, type: "subscription" as const }] },
      { id: "c", offers: [] },
      { id: "d", offers: [{ providerId: PRIME, type: "subscription" as const }] },
    ];
    const { available, elsewhere } = partitionByAvailability(items, [NETFLIX, PRIME]);
    expect(available.map((i) => i.id)).toEqual(["b", "d"]);
    expect(elsewhere.map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("seasonCoverage", () => {
  const s = (providerId: number) => ({ offers: [{ providerId, type: "subscription" as const }] });

  it("detects partially available series", () => {
    expect(seasonCoverage([s(NETFLIX), s(NETFLIX), s(DISNEY)], [NETFLIX])).toBe("partial");
    expect(seasonCoverage([s(NETFLIX), s(PRIME)], [NETFLIX, PRIME])).toBe("all");
    expect(seasonCoverage([s(DISNEY)], [NETFLIX])).toBe("none");
    expect(seasonCoverage([], [NETFLIX])).toBe("none");
  });
});

describe("searchQuerySchema", () => {
  it("parses the comma-separated provider list from a query string", () => {
    expect(searchQuerySchema.parse({ q: " dune ", providers: "8, 119,,abc" })).toEqual({
      q: "dune",
      providers: [8, 119],
    });
    expect(searchQuerySchema.parse({ q: "dune" }).providers).toEqual([]);
  });
});

describe("resolveLanguage", () => {
  it("picks the first supported language of a tag or Accept-Language header", () => {
    expect(resolveLanguage("en-GB,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(resolveLanguage("de-DE,en;q=0.5")).toBe("en");
    expect(resolveLanguage("es")).toBe("fr");
    expect(resolveLanguage(undefined)).toBe("fr");
  });
});
