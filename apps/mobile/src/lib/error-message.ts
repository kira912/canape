import type { TFunction } from "i18next";
import { ApiError } from "./api-client";

/** User-facing, translated message for a failed request (API messages are developer-facing French). */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t("errors.network");
    if (error.status === 502 || error.status === 503) return t("errors.unavailable");
    return t("errors.generic", { status: error.status });
  }
  return t("errors.generic", { status: "?" });
}
