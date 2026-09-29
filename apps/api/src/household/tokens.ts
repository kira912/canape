import { createHash, randomBytes, randomInt } from "node:crypto";
import { INVITE_CODE_LENGTH } from "@canape/shared";

/** No 0/O, 1/I/L: codes are read aloud and typed on a phone. */
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are high-entropy random values, so a plain SHA-256 is enough (no need for a slow hash). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
