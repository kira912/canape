// Browsers: an HTTPS page may call a LAN address (http://192.168.x.x) only through
// Chrome's Local Network Access (Chrome/Edge 142+), once the user has accepted its
// "access devices on your local network" prompt. Safari and Firefox have no such
// thing and block it outright. The TV answers with CORS headers, so once allowed,
// samsung.ts works as in the native app.

const LAN_PERMISSION = "local-network-access" as PermissionName;
const MIN_CHROMIUM = 142;

type UaData = { brands: { brand: string; version: string }[] };

function chromiumVersion(): number {
  const brands = (navigator as Navigator & { userAgentData?: UaData }).userAgentData?.brands ?? [];
  return Number(brands.find((b) => b.brand === "Chromium")?.version ?? 0);
}

/**
 * The TV's DIAL server refuses (403) any request carrying an Origin header other
 * than the platform's own (e.g. https://www.netflix.com), and browsers always send
 * one: a page can open the platform's app, never a precise title.
 */
export const dialAllowed = false;

export const lanAccessSupported = typeof navigator !== "undefined" && chromiumVersion() >= MIN_CHROMIUM;

/**
 * Makes Chrome ask for local network access if it hasn't yet, and waits for the
 * answer. Resolves to false only on a refusal: a dismissed prompt or a page that
 * needs no permission (local dev server) lets the requests themselves tell.
 */
export async function requestLanAccess(): Promise<boolean> {
  let status: PermissionStatus;
  try {
    status = await navigator.permissions.query({ name: LAN_PERMISSION });
  } catch {
    return true;
  }
  if (status.state !== "prompt") return status.state === "granted";
  await new Promise<void>((resolve) => {
    status.addEventListener("change", () => resolve(), { once: true });
    // The first request to a LAN address is what shows the prompt; Chrome holds
    // it until the user answers, so it settling also means "answered".
    fetch("http://192.168.1.1/", { mode: "no-cors", targetAddressSpace: "local" } as RequestInit).then(
      () => resolve(),
      () => resolve(),
    );
  });
  // `state` changed meanwhile: TS still narrows it to "prompt".
  return (status.state as PermissionState) !== "denied";
}

/**
 * A browser can't read the device's own IP address: scan the networks home
 * routers use by default instead (manual entry covers the others).
 */
export async function networksToScan(): Promise<string[]> {
  return ["192.168.1.1", "192.168.0.1"];
}
