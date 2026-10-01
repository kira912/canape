import type { WatchOption } from "@canape/shared";
import { dialAllowed, lanAccessSupported } from "./lan-access";

/**
 * Samsung Tizen TVs on the local network, without pairing:
 * - DIAL (`:8080/ws/app/<App>`) opens Netflix / YouTube on a precise title;
 * - the TV's REST API (`:8001/api/v2/applications/<id>`) opens any installed app.
 * Plain HTTP to a LAN address: works from the native app (Expo Go included), and
 * from Chrome/Edge once the user allows local network access (see lan-access.web.ts),
 * where DIAL is refused: a browser only opens the app.
 * Tested on a 2025 QLED (TQ55Q7FAAUXXC).
 */

export interface SavedTv {
  ip: string;
  name: string;
  model: string | null;
}

export const tvControlAvailable = lanAccessSupported;

/** Tizen app ids per platform (several: ids change between app generations). */
const SAMSUNG_APP_IDS: Record<string, string[]> = {
  netflix: ["3201907018807", "11101200001"],
  prime: ["3201910019365", "3201512006785"],
  disney: ["3201901017640"],
  apple: ["3201807016597"],
  youtube: ["111299001912"],
};

/** Apps whose DIAL launch accepts a precise title. */
const DIAL_APPS: Record<string, string> = { netflix: "Netflix", youtube: "YouTube" };

export type TvLaunchResult = "title" | "app";

export class TvError extends Error {
  constructor(readonly reason: "unreachable" | "unsupported") {
    super(reason);
  }
}

export function canOpenOnTv(platform: string | null): boolean {
  return Boolean(platform && (DIAL_APPS[platform] || SAMSUNG_APP_IDS[platform]));
}

/** Can this option land on the exact title (not just the app)? */
export function opensTitleOnTv(option: Pick<WatchOption, "platform" | "link" | "linkKind">): boolean {
  return dialBody(option) !== "";
}

/** Netflix's launch handler format (same over DIAL and webOS): opens and plays the title. */
export function netflixDialBody(link: string): string {
  const id = /netflix\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:title|watch)\/(\d+)/i.exec(link)?.[1];
  return id ? `m=https://www.netflix.com/watch/${id}&source_type=4` : "";
}

export function youtubeDialBody(link: string): string {
  const id = /(?:[?&]v=|youtu\.be\/)([\w-]{11})/.exec(link)?.[1];
  return id ? `v=${id}` : "";
}

function dialBody(option: Pick<WatchOption, "platform" | "link" | "linkKind">): string {
  if (!dialAllowed || option.linkKind !== "direct") return "";
  if (option.platform === "netflix") return netflixDialBody(option.link);
  if (option.platform === "youtube") return youtubeDialBody(option.link);
  return "";
}

/** fetch with a timeout (AbortSignal.timeout isn't available on every JS engine). */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** A Samsung Tizen TV answers `GET :8001/api/v2/` with its name and model. */
export async function probeSamsungTv(ip: string, timeoutMs = 1500): Promise<SavedTv | null> {
  try {
    const response = await fetchWithTimeout(`http://${ip}:8001/api/v2/`, {}, timeoutMs);
    if (!response.ok) return null;
    const info = (await response.json()) as {
      name?: string;
      device?: { name?: string; modelName?: string; OS?: string };
    };
    if (info.device?.OS && info.device.OS !== "Tizen") return null;
    return {
      ip,
      name: decodeEntities(info.device?.name ?? info.name ?? "Samsung TV"),
      model: info.device?.modelName ?? null,
    };
  } catch {
    return null;
  }
}

/** Probes every address of the phone's /24 network (e.g. 192.168.1.1–254), a few dozen at a time. */
export async function scanForTvs(phoneIp: string, onProgress?: (done: number) => void): Promise<SavedTv[]> {
  const prefix = /^(\d+\.\d+\.\d+)\.\d+$/.exec(phoneIp)?.[1];
  if (!prefix) return [];
  const found: SavedTv[] = [];
  const BATCH = 32;
  for (let start = 1; start <= 254; start += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, 255 - start) }, (_, i) => `${prefix}.${start + i}`);
    const results = await Promise.all(batch.map((ip) => probeSamsungTv(ip)));
    found.push(...results.filter((tv): tv is SavedTv => tv !== null));
    onProgress?.(Math.min(start + BATCH - 1, 254));
  }
  return found;
}

/**
 * Opens the option's platform on the TV: on the exact title through DIAL when
 * possible (Netflix, YouTube), otherwise the app itself through the TV's API.
 */
export async function openOnTv(tv: SavedTv, option: WatchOption): Promise<TvLaunchResult> {
  const platform = option.platform;
  if (!platform || !canOpenOnTv(platform)) throw new TvError("unsupported");

  let reached = false;
  const dialApp = dialAllowed ? DIAL_APPS[platform] : undefined;
  if (dialApp) {
    const body = dialBody(option);
    try {
      const response = await fetchWithTimeout(`http://${tv.ip}:8080/ws/app/${dialApp}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body,
      });
      reached = true;
      if (response.ok) return body ? "title" : "app";
    } catch {
      // Fall through to the TV's own API.
    }
  }

  for (const appId of SAMSUNG_APP_IDS[platform] ?? []) {
    try {
      const response = await fetchWithTimeout(`http://${tv.ip}:8001/api/v2/applications/${appId}`, {
        method: "POST",
      });
      reached = true;
      if (response.ok) return "app";
    } catch {
      // Try the next id / report below.
    }
  }
  throw new TvError(reached ? "unsupported" : "unreachable");
}
