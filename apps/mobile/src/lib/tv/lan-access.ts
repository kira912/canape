import { getIpAddressAsync } from "expo-network";

// Native: the app reaches the local network freely. See lan-access.web.ts.

export const lanAccessSupported = true;

/** DIAL (opening Netflix / YouTube on a precise title) only answers native apps. */
export const dialAllowed = true;

/** Resolves to false when the user refused local network access. */
export async function requestLanAccess(): Promise<boolean> {
  return true;
}

/** An address on each /24 network to scan for a TV: the phone's own. */
export async function networksToScan(): Promise<string[]> {
  return [await getIpAddressAsync()];
}
