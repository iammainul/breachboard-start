import { describe, expect, it } from "vitest";
import {
  flattenScenarioRows,
  groupScenarioPacks,
  isScenarioVisibleToWorkspaceOrg,
  packIdentity,
  resolvedClientIds,
  scenarioLineageKey,
  scenariosHref,
  transferredLineageKey,
  type ScenarioPackItem,
} from "@/lib/scenario-packs";

function item(partial: Partial<ScenarioPackItem> & Pick<ScenarioPackItem, "id" | "title" | "status">): ScenarioPackItem {
  return {
    sector: "bfsi_in",
    lineageKey: null,
    organizationId: "org-1",
    orgName: "Northline Bank",
    updatedAt: "2026-09-01T00:00:00.000Z",
    injectCount: 5,
    roleCount: 4,
    regulatorTags: [],
    clients: [],
    ...partial,
  };
}

describe("scenario packs", () => {
  it("derives a stable lineage key from the title", () => {
    expect(scenarioLineageKey("SWIFT ransomware desk")).toBe("swift-ransomware-desk");
  });

  it("moves the accepted pack slug onto the new version", () => {
    expect(
      transferredLineageKey(
        { lineageKey: "legacy-swift-pack" },
        { lineageKey: "swift-ransomware-desk", title: "SWIFT ransomware desk" },
      ),
    ).toBe("legacy-swift-pack");
  });

  it("falls back to the draft key when there is no previous accepted pack", () => {
    expect(
      transferredLineageKey(null, {
        lineageKey: "new-pack",
        title: "New pack",
      }),
    ).toBe("new-pack");
  });

  it("groups draft and accepted versions of the same org pack", () => {
    const packs = groupScenarioPacks([
      item({
        id: "accepted",
        title: "SWIFT ransomware",
        status: "accepted",
        lineageKey: "swift-ransomware",
        updatedAt: "2026-09-02T00:00:00.000Z",
      }),
      item({
        id: "draft",
        title: "SWIFT ransomware",
        status: "draft",
        lineageKey: "swift-ransomware",
        updatedAt: "2026-09-03T00:00:00.000Z",
      }),
      item({
        id: "retired",
        title: "SWIFT ransomware",
        status: "retired",
        lineageKey: "swift-ransomware",
        updatedAt: "2026-08-01T00:00:00.000Z",
      }),
    ]);

    expect(packs).toHaveLength(1);
    expect(packs[0]?.accepted?.id).toBe("accepted");
    expect(packs[0]?.drafts.map((d) => d.id)).toEqual(["draft"]);
    expect(packs[0]?.retired.map((d) => d.id)).toEqual(["retired"]);
    expect(packIdentity(packs[0]!.accepted!)).toBe("org-1:swift-ransomware");
  });

  it("resolves linked clients, falling back to the home org", () => {
    expect(resolvedClientIds(null, [])).toEqual([]);
    expect(resolvedClientIds("org-1", [])).toEqual(["org-1"]);
    expect(resolvedClientIds("org-1", ["org-2", "org-3"])).toEqual(["org-2", "org-3"]);
  });

  it("flattens the desk list and hides retired unless filtered", () => {
    const rows = flattenScenarioRows([
      item({ id: "a", title: "A", status: "accepted", updatedAt: "2026-09-03T00:00:00.000Z" }),
      item({ id: "d", title: "D", status: "draft", updatedAt: "2026-09-02T00:00:00.000Z" }),
      item({ id: "r", title: "R", status: "retired", updatedAt: "2026-09-04T00:00:00.000Z" }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a", "d"]);
    expect(flattenScenarioRows(rows.concat(item({ id: "r2", title: "R2", status: "retired" })), "draft").map((row) => row.id)).toEqual(["d"]);
    expect(
      flattenScenarioRows(
        [
          item({ id: "a", title: "A", status: "accepted" }),
          item({ id: "r", title: "R", status: "retired" }),
        ],
        "retired",
      ).map((row) => row.id),
    ).toEqual(["r"]);
  });

  it("keeps status and sector in the scenarios query string", () => {
    expect(scenariosHref({})).toBe("/scenarios");
    expect(scenariosHref({ status: "draft", sector: "bfsi_in" })).toBe(
      "/scenarios?status=draft&sector=bfsi_in",
    );
    expect(scenariosHref({ status: "all", tag: "RBI" })).toBe("/scenarios?tag=RBI");
  });

  it("scopes a workspace to that org’s accepted packs and drafts", () => {
    const org1Draft = item({ id: "d1", title: "D1", status: "draft", organizationId: "org-1" });
    const unassignedDraft = item({
      id: "d0",
      title: "D0",
      status: "draft",
      organizationId: null,
      orgName: null,
    });
    const otherDraft = item({
      id: "d2",
      title: "D2",
      status: "draft",
      organizationId: "org-2",
      orgName: "Other",
    });
    const org1Accepted = item({ id: "a1", title: "A1", status: "accepted", organizationId: "org-1" });
    const linkedAccepted = item({
      id: "a-link",
      title: "Linked",
      status: "accepted",
      organizationId: "org-2",
      orgName: "Other",
      clients: [{ id: "org-1", name: "Northline Bank" }],
    });
    const otherAccepted = item({
      id: "a2",
      title: "A2",
      status: "accepted",
      organizationId: "org-2",
      orgName: "Other",
    });
    const unassignedAccepted = item({
      id: "a0",
      title: "A0",
      status: "accepted",
      organizationId: null,
      orgName: null,
    });
    const retired = item({ id: "r1", title: "R1", status: "retired", organizationId: "org-1" });

    const visible = [
      org1Draft,
      unassignedDraft,
      otherDraft,
      org1Accepted,
      linkedAccepted,
      otherAccepted,
      unassignedAccepted,
      retired,
    ].filter((row) => isScenarioVisibleToWorkspaceOrg(row, "org-1"));

    expect(visible.map((row) => row.id).sort()).toEqual(["a-link", "a1", "d0", "d1"]);
  });
});
