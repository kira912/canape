import Constants from "expo-constants";
import { Platform } from "react-native";
import type { ZodType, ZodTypeDef } from "zod";

/** Output type of a schema, even when it has defaults (input ≠ output). */
type Schema<T> = ZodType<T, ZodTypeDef, unknown>;
import { currentLanguage } from "../i18n";
import { useSession } from "./household-store";

const API_PORT = 3333;

/**
 * Where the API lives:
 *  - `EXPO_PUBLIC_API_URL` when set — the PWA build uses `/api` because the
 *    API serves it from the same origin;
 *  - on web in dev, same host as the page (localhost or LAN IP) on the API port;
 *  - on a device, the LAN IP of the Metro server (so a phone reaches the API without config).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:${API_PORT}/api`;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type QueryValue = string | number | undefined | readonly number[];

/** Builds query strings by hand: Hermes' URLSearchParams is unreliable. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    const encoded = Array.isArray(value) ? value.join(",") : String(value);
    if (encoded === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export function apiGet<T>(path: string, schema: Schema<T>, params: Record<string, QueryValue> = {}): Promise<T> {
  // The language goes in the URL (not only Accept-Language): the CDN caches catalog responses by URL.
  return apiRequest("GET", `${path}${buildQuery({ ...params, lang: currentLanguage() })}`, schema);
}

/** Authenticated request; a 401 means this device's session is gone → back to onboarding. */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  schema: Schema<T> | null,
  body?: unknown,
): Promise<T> {
  const token = useSession.getState().token;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        // TMDB content (titles, overviews, genres) follows the app language.
        "Accept-Language": currentLanguage(),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `API injoignable (${API_BASE_URL})`);
  }
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) useSession.getState().clearSession();
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Erreur ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return schema ? schema.parse(payload) : (undefined as T);
}
