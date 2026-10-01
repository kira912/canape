import { describe, expect, it } from "vitest";
import { pairingPath, parsePairingQr } from "./pairing";

const ID = "3f1c2b9e-8a4d-4c7f-9b2e-1d5a6c7e8f90";

describe("parsePairingQr", () => {
  it("reads the id from a web URL, whatever the origin", () => {
    expect(parsePairingQr(`https://canape.app${pairingPath(ID)}`)).toBe(ID);
    expect(parsePairingQr(`http://192.168.1.10:3333/pair/${ID.toUpperCase()}`)).toBe(ID);
  });

  it("reads the app scheme", () => {
    expect(parsePairingQr(`canape://pair/${ID}`)).toBe(ID);
  });

  it("rejects anything else", () => {
    expect(parsePairingQr("https://example.com/")).toBeNull();
    expect(parsePairingQr(`https://evil.com/pair/${ID}/extra`)).toBeNull();
    expect(parsePairingQr("https://canape.app/pair/not-a-uuid")).toBeNull();
  });
});
