import { afterEach, describe, expect, it } from "vitest";
import {
  hashRoleToken,
  makeRoleToken,
  roleTokenHint,
  verifyRoleToken,
} from "@/lib/role-invite-token";
import { resolveAssignmentHint } from "@/lib/role-assignment";
import { participantQuestion } from "@/lib/participant-view";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

describe("invitation security", () => {
  it("creates high-entropy tokens that are hashed and case-sensitive", () => {
    const first = makeRoleToken();
    const second = makeRoleToken();
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(first).not.toEqual(second);
    expect(hashRoleToken(first)).not.toEqual(first);
    expect(verifyRoleToken(first, hashRoleToken(first))).toBe(true);
    expect(verifyRoleToken(first.toUpperCase(), hashRoleToken(first))).toBe(false);
    expect(roleTokenHint(first)).toBe(first.slice(-6));
  });

  it("resolves onboarding hints from ids and display names", () => {
    const roles = [
      { id: "soc-lead", name: "SOC Lead" },
      { id: "legal", name: "Legal Counsel" },
    ];
    expect(resolveAssignmentHint("SOC LEAD", roles)?.id).toBe("soc-lead");
    expect(resolveAssignmentHint("legal", roles)?.name).toBe("Legal Counsel");
    expect(resolveAssignmentHint("unknown", roles)).toBeNull();
    expect(resolveAssignmentHint(null, roles)).toBeNull();
  });

  it("keeps points for the score UI and hides expected actions", () => {
    const visible = participantQuestion({
      roleId: "soc-lead",
      roleIds: [],
      common: false,
      prompt: "What is your first containment decision?",
      expectedAction: "Isolate the affected segment",
      points: 100,
    });
    expect(visible.prompt).toBe("What is your first containment decision?");
    expect(visible.points).toBe(100);
    expect(visible).not.toHaveProperty("expectedAction");
  });

  it("encrypts portal SMTP passwords at rest", () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-only-secret-that-is-long-enough";
    try {
      const encrypted = encryptSecret("smtp-password");
      expect(encrypted).not.toEqual("smtp-password");
      expect(encrypted.includes("smtp-password")).toBe(false);
      expect(decryptSecret(encrypted)).toBe("smtp-password");

      const [version, iv, tag, cipher] = encrypted.split(".");
      const flippedTag = `${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`;
      expect(() => decryptSecret([version, iv, flippedTag, cipher].join("."))).toThrow();

      const last = encrypted.endsWith("x") ? "y" : "x";
      expect(() => decryptSecret(`${encrypted.slice(0, -1)}${last}`)).toThrow();
    } finally {
      if (original === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = original;
    }
  });
});

afterEach(() => {
  // Keep env clean between suites that touch AUTH_SECRET.
});
