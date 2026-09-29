import i18n from "../i18n";
import { formatRuntime } from "./labels";

describe("formatRuntime", () => {
  afterAll(() => i18n.changeLanguage("fr"));

  it("formats durations in French", async () => {
    await i18n.changeLanguage("fr");
    expect(formatRuntime(i18n.t, 155)).toBe("2 h 35");
    expect(formatRuntime(i18n.t, 120)).toBe("2 h");
    expect(formatRuntime(i18n.t, 45)).toBe("45 min");
    expect(formatRuntime(i18n.t, null)).toBeNull();
  });

  it("formats durations in English", async () => {
    await i18n.changeLanguage("en");
    expect(formatRuntime(i18n.t, 155)).toBe("2h 35m");
    expect(formatRuntime(i18n.t, 120)).toBe("2h");
  });

  it("uses plural forms", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("title.seasonCount", { count: 1 })).toBe("1 season");
    expect(i18n.t("title.seasonCount", { count: 9 })).toBe("9 seasons");
  });
});
