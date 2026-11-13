import { describe, expect, it } from "vitest";
import { isRscNavigationRequest } from "@/lib/security/rsc-request";

describe("isRscNavigationRequest", () => {
  it("treats document loads as HTML", () => {
    expect(isRscNavigationRequest(new Headers())).toBe(false);
    expect(
      isRscNavigationRequest(new Headers({ accept: "text/html" })),
    ).toBe(false);
  });

  it("detects App Router flights and prefetches", () => {
    expect(isRscNavigationRequest(new Headers({ rsc: "1" }))).toBe(true);
    expect(
      isRscNavigationRequest(new Headers({ "next-router-prefetch": "1" })),
    ).toBe(true);
    expect(
      isRscNavigationRequest(
        new Headers({ "next-router-state-tree": "%5B%22%22%5D" }),
      ),
    ).toBe(true);
    expect(
      isRscNavigationRequest(
        new Headers({ "next-router-segment-prefetch": "/_tree" }),
      ),
    ).toBe(true);
  });
});
