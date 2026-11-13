import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  cspHeader,
  requestIsHttps,
} from "@/lib/security/headers";

describe("cspHeader", () => {
  it("is nonce-based for scripts and forbids framing", () => {
    const value = cspHeader("abc123", false);
    expect(value).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).not.toContain("unsafe-eval");
    expect(value).toContain("object-src 'none'");
    expect(value).not.toContain("upgrade-insecure-requests");
  });

  it("adds unsafe-eval only in development", () => {
    expect(cspHeader("n", true)).toContain("unsafe-eval");
  });

  it("upgrades insecure requests only on HTTPS", () => {
    expect(cspHeader("n", false, true)).toContain("upgrade-insecure-requests");
    expect(cspHeader("n", false, false)).not.toContain("upgrade-insecure-requests");
  });
});

describe("requestIsHttps", () => {
  it("trusts x-forwarded-proto over AUTH_URL", () => {
    expect(
      requestIsHttps({
        headers: new Headers({ "x-forwarded-proto": "https" }),
        protocol: "http:",
      }),
    ).toBe(true);
    expect(
      requestIsHttps({
        headers: new Headers({ "x-forwarded-proto": "http" }),
        protocol: "https:",
      }),
    ).toBe(false);
  });
});

describe("applySecurityHeaders", () => {
  it("omits HSTS on HTTP so Chromium will not pin https://localhost", () => {
    const httpHeaders = new Headers();
    applySecurityHeaders(httpHeaders, "n", false, false);
    expect(httpHeaders.get("Strict-Transport-Security")).toBeNull();
    expect(httpHeaders.get("Content-Security-Policy") ?? "").not.toMatch(
      /upgrade-insecure-requests/,
    );

    const httpsHeaders = new Headers();
    applySecurityHeaders(httpsHeaders, "n", false, true);
    expect(httpsHeaders.get("Strict-Transport-Security") ?? "").toMatch(/max-age=/);
    expect(httpsHeaders.get("Content-Security-Policy") ?? "").toMatch(
      /upgrade-insecure-requests/,
    );
  });
});
