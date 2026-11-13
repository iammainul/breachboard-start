import { describe, expect, it } from "vitest";
import {
  authPostLimitKind,
  normalizeJoinCode,
  normalizeLoginAccount,
  peekCredentialField,
} from "@/lib/security/auth-rate-limit";

describe("authPostLimitKind", () => {
  it("does not treat guest-join as login", () => {
    expect(authPostLimitKind("/api/auth/callback/guest-join")).toBeNull();
    expect(authPostLimitKind("/api/auth/callback/credentials")).toBe("login");
    expect(authPostLimitKind("/api/auth/callback/invite-token")).toBe("invite");
    expect(authPostLimitKind("/api/auth/session")).toBeNull();
    expect(authPostLimitKind("/api/auth/signout")).toBeNull();
  });
});

describe("normalize keys", () => {
  it("keys login by mailbox and join by code", () => {
    expect(normalizeLoginAccount(" Operator@Local ")).toBe("operator@local");
    expect(normalizeLoginAccount("not-an-email")).toBe("unknown");
    expect(normalizeJoinCode(" demo01 ")).toBe("DEMO01");
    expect(normalizeJoinCode("ab")).toBe("unknown");
  });
});

describe("peekCredentialField", () => {
  it("reads email from a cloned urlencoded body", async () => {
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "csrfToken=abc&email=Priya%40demo.local&password=secret",
    });
    await expect(peekCredentialField(request, "email")).resolves.toBe(
      "Priya@demo.local",
    );
    const again = await request.text();
    expect(again).toContain("Priya%40demo.local");
  });
});
