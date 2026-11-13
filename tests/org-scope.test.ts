import { describe, expect, test } from "vitest";
import { isDeskOperator, pickWorkspaceOrgId } from "@/lib/roles";

describe("isDeskOperator", () => {
  test("admins and facilitators get the ops desk", () => {
    expect(isDeskOperator({ platformRole: "ADMIN", canFacilitate: false })).toBe(true);
    expect(isDeskOperator({ platformRole: "USER", canFacilitate: true })).toBe(true);
    expect(isDeskOperator({ platformRole: "USER", canFacilitate: false })).toBe(false);
  });
});

describe("pickWorkspaceOrgId", () => {
  test("keeps a cookie that is still visible", () => {
    expect(pickWorkspaceOrgId("b", ["a", "b", "c"])).toBe("b");
  });

  test("drops a cookie for a client the operator cannot see", () => {
    expect(pickWorkspaceOrgId("secret-org", ["a", "b"])).toBe(null);
  });

  test("auto-selects when exactly one client is visible", () => {
    expect(pickWorkspaceOrgId(null, ["only"])).toBe("only");
    expect(pickWorkspaceOrgId("stale", ["only"])).toBe("only");
  });
});
