import { describe, expect, it } from "vitest";
import { draftRunDeleteError } from "@/lib/session-delete";

describe("draftRunDeleteError", () => {
  it("blocks missing sessions", () => {
    expect(draftRunDeleteError(null)).toEqual({
      error: "Not found",
      status: 404,
    });
  });

  it("allows draft rehearsal rooms", () => {
    expect(draftRunDeleteError({ runKind: "draft" })).toBeNull();
  });

  it("refuses to delete engagements", () => {
    expect(draftRunDeleteError({ runKind: "engagement" })).toEqual({
      error: "Engagements cannot be deleted. Archive them from Closed instead.",
      status: 409,
    });
  });
});
