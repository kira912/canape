import { generateInviteCode, generateRecoveryCode, generateSessionToken, hashRecoveryCode, hashToken } from "./tokens";

describe("tokens", () => {
  it("generates readable 6-character invite codes", () => {
    for (let i = 0; i < 200; i++) expect(generateInviteCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });

  it("hashes session tokens deterministically without storing them", () => {
    const token = generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });

  it("generates grouped recovery codes that hash the same however they are typed", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
    expect(hashRecoveryCode(code.toLowerCase().replace(/-/g, " "))).toBe(hashRecoveryCode(code));
    expect(generateRecoveryCode()).not.toBe(code);
  });
});
