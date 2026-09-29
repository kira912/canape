import type { TFunction } from "i18next";

/** "2 h 35" / "2h 35m", "1 h" / "1h", "45 min". */
export function formatRuntime(t: TFunction, minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return t("duration.minutes", { m });
  return m ? t("duration.hoursMinutes", { h, mm: m.toString().padStart(2, "0") }) : t("duration.hours", { h });
}
