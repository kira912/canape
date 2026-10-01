/** "Chrome · macOS": enough for someone to recognise their own device. Not for anything security-related. */
export function describeUserAgent(userAgent: string | undefined): string {
  const ua = userAgent ?? "";
  return [browserName(ua), osName(ua)].filter(Boolean).join(" · ") || "Appareil inconnu";
}

function browserName(ua: string): string | null {
  if (/Expo|okhttp|CFNetwork|Darwin/i.test(ua) && !/Mozilla/.test(ua)) return "App Canapé";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS/.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function osName(ua: string): string | null {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}
