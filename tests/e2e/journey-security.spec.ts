import { test, expect } from "@playwright/test";

test.describe("Security headers and health", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("HTML responses carry CSP and the static hardening headers", async ({
    request,
  }) => {
    const res = await request.get("/login");
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    expect(headers["content-security-policy"] ?? "").toMatch(/script-src/);
    expect(headers["content-security-policy"] ?? "").toMatch(/frame-ancestors 'none'/);
    expect(headers["x-frame-options"]?.toLowerCase()).toBe("deny");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"] ?? "").toMatch(/camera=\(\)/);
    // HTTP e2e / Docker must not pin HSTS or upgrade to https://localhost.
    expect(headers["strict-transport-security"] ?? "").toBe("");
    expect(headers["content-security-policy"] ?? "").not.toMatch(
      /upgrade-insecure-requests/,
    );
  });

  test("/api/health?ready=1 returns 200 against live Postgres", async ({ request }) => {
    const live = await request.get("/api/health");
    expect(live.status()).toBe(200);
    expect(live.headers()["content-type"] ?? "").toMatch(/json/);
    expect(await live.json()).toEqual({ status: "ok", live: true });
    const ready = await request.get("/api/health?ready=1");
    expect(ready.status()).toBe(200);
    expect(ready.headers()["content-type"] ?? "").toMatch(/json/);
    expect(await ready.json()).toEqual({ status: "ok", live: true, ready: true });
  });
});
