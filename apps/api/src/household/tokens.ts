import { createHash, randomBytes, randomInt } from "node:crypto";
import { INVITE_CODE_LENGTH, RECOVERY_CODE_LENGTH } from "@canape/shared";

/** No 0/O, 1/I/L: codes are read aloud and typed on a phone. */
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

export function generateInviteCode(): string {
  return randomCode(INVITE_CODE_LENGTH);
}

/** 16 characters of a 31-letter alphabet (~79 bits): out of reach of guessing, even without rate limits. */
export function generateRecoveryCode(): string {
  return randomCode(RECOVERY_CODE_LENGTH).match(/.{4}/g)!.join("-");
}

/** Same normalisation as `recoverSchema`, so a generated code and a typed one hash alike. */
export function hashRecoveryCode(code: string): string {
  return hashToken(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are high-entropy random values, so a plain SHA-256 is enough (no need for a slow hash). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
