import { describe, expect, it } from "vitest";
import { csrfDenied, isSameOriginMutation } from "@/lib/security/csrf";

function req(
  method: string,
  headers: Record<string, string>,
  url = "http://localhost:3000/api/join",
) {
  return {
    url,
    method,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

describe("CSRF same-origin guard", () => {
  it("allows GET and same-origin POST", () => {
    expect(csrfDenied(req("GET", {}))).toBe(false);
    expect(
      isSameOriginMutation(
        req("POST", { origin: "http://localhost:3000" }),
        "http://localhost:3000",
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        req("POST", { "sec-fetch-site": "same-origin" }),
        "http://localhost:3000",
      ),
    ).toBe(true);
  });

  it("rejects cross-site POST", () => {
    expect(
      csrfDenied(
        req("POST", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        req("POST", { origin: "https://evil.example" }),
        "http://localhost:3000",
      ),
    ).toBe(false);
  });

  it("allows missing Origin (Playwright APIRequestContext / curl)", () => {
    expect(csrfDenied(req("POST", {}))).toBe(false);
  });
});
