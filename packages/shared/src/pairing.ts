import { z } from "zod";
import { sessionSchema } from "./household";

/**
 * Signing in a new device by QR code (like Discord): the new device shows a QR
 * with the pairing id, a signed-in device scans it and approves, the new device
 * (polling with its secret) then receives its own session.
 */
export const PAIRING_TTL_SECONDS = 5 * 60;

/** Created by the new device: `secret` never leaves it (only the id goes in the QR). */
export const pairingSchema = z.object({
  id: z.string(),
  secret: z.string(),
  expiresAt: z.string(),
});
export type Pairing = z.infer<typeof pairingSchema>;

/** What the approving device is shown. */
export const pairingInfoSchema = z.object({
  /** Browser / OS of the new device, e.g. "Chrome · macOS". */
  device: z.string(),
  expiresAt: z.string(),
});
export type PairingInfo = z.infer<typeof pairingInfoSchema>;

export const claimPairingSchema = z.object({ secret: z.string().min(1).max(200) });

export const pairingStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("approved"), session: sessionSchema }),
]);
export type PairingStatus = z.infer<typeof pairingStatusSchema>;

/** Path of the approval page; the QR holds `<origin>/pair/<id>`. */
export function pairingPath(id: string): string {
  return `/pair/${id}`;
}

/** Extracts the pairing id from a scanned QR (any origin, or the app's own scheme). */
export function parsePairingQr(data: string): string | null {
  const match = /(?:^|\/)pair\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#]|$)/i.exec(
    data.trim(),
  );
  return match ? match[1].toLowerCase() : null;
}
