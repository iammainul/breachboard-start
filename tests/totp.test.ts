import { describe, expect, test } from "vitest";
import { generateTotpSecret, otpauthUrl, totp, verifyTotp } from "@/lib/totp";

describe("totp", () => {
  test("round-trips a generated secret at the current timestep", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    const code = totp(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  test("accepts codes from the previous and next 30s window", () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 0, 1, 12, 0, 5);
    const previous = totp(secret, now - 30_000);
    expect(verifyTotp(secret, previous, now)).toBe(true);
  });

  test("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "abc")).toBe(false);
  });

  test("builds an otpauth URL for authenticator apps", () => {
    const url = otpauthUrl("ops@example.com", "MFRGGZDFMZTWQ2LK");
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("Breachboard");
    expect(url).toContain("ops%40example.com");
    expect(url).toContain("secret=MFRGGZDFMZTWQ2LK");
  });
});
