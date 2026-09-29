import { toggleLocally } from "./queries";

const ref = (memberId: string) => ({ mediaType: "movie" as const, tmdbId: 1, memberId });

describe("toggleLocally (optimistic « déjà vu »)", () => {
  it("adds a watcher without duplicating", () => {
    let watched = toggleLocally({ items: [] }, ref("a"), true);
    watched = toggleLocally(watched, ref("b"), true);
    watched = toggleLocally(watched, ref("b"), true);
    expect(watched.items).toEqual([{ mediaType: "movie", tmdbId: 1, memberIds: ["a", "b"] }]);
  });

  it("drops the title once nobody has seen it", () => {
    const watched = toggleLocally({ items: [{ mediaType: "movie", tmdbId: 1, memberIds: ["a"] }] }, ref("a"), false);
    expect(watched.items).toEqual([]);
  });

  it("leaves other titles untouched", () => {
    const other = { mediaType: "tv" as const, tmdbId: 1, memberIds: ["a"] };
    const watched = toggleLocally({ items: [other] }, ref("a"), true);
    expect(watched.items).toContainEqual(other);
    expect(watched.items).toHaveLength(2);
  });
});
