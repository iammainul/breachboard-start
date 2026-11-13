import { describe, expect, it } from "vitest";
import {
  isActivityLockExemptPath,
  isUnauthenticatedPath,
} from "@/lib/security/public-paths";

describe("isUnauthenticatedPath", () => {
  it("keeps probes, join, and auth public", () => {
    expect(isUnauthenticatedPath("/api/health")).toBe(true);
    expect(isUnauthenticatedPath("/login")).toBe(true);
    expect(isUnauthenticatedPath("/api/auth/session")).toBe(true);
    expect(isUnauthenticatedPath("/join")).toBe(true);
    expect(isUnauthenticatedPath("/api/join")).toBe(true);
    expect(isUnauthenticatedPath("/invite/abc")).toBe(true);
    expect(isUnauthenticatedPath("/brand/mark.svg")).toBe(true);
  });

  it("still gates the rest of the app", () => {
    expect(isUnauthenticatedPath("/")).toBe(false);
    expect(isUnauthenticatedPath("/sessions/x")).toBe(false);
    expect(isUnauthenticatedPath("/api/sessions")).toBe(false);
    expect(isUnauthenticatedPath("/generate")).toBe(false);
  });
});

describe("isActivityLockExemptPath", () => {
  it("lets a locked guest hit health and media", () => {
    expect(isActivityLockExemptPath("/api/health")).toBe(true);
    expect(isActivityLockExemptPath("/api/media/orgs/x/file.pdf")).toBe(true);
    expect(isActivityLockExemptPath("/api/sessions/other")).toBe(false);
  });
});
