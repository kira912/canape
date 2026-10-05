import { Linking } from "react-native";

/**
 * Opens a platform / trailer link from the API. Only web links: on the web,
 * `Linking.openURL` is a plain `window.open`, which would run a `javascript:`
 * URL; natively, other schemes could open arbitrary apps.
 * (A regex rather than `new URL()`: React Native's URL polyfill lacks `protocol`.)
 */
export function openExternal(url: string): Promise<void> {
  return isWebLink(url) ? Linking.openURL(url) : Promise.resolve();
}

export function isWebLink(url: string): boolean {
  return /^https:\/\/[^\s/]+/i.test(url.trim());
}
