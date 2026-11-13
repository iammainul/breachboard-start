import { describe, expect, it } from "vitest";
import {
  SECTORS,
  defaultRegulatorTags,
  feedSourcesForSector,
  sectorLabel,
  sectorPrompt,
  sectorSchema,
} from "@/lib/sectors";

describe("sectors catalog", () => {
  it("keeps legacy ids and adds extra industries", () => {
    const ids = SECTORS.map((s) => s.id);
    expect(ids).toContain("bfsi_in");
    expect(ids).toContain("gov");
    expect(ids).toEqual(
      expect.arrayContaining([
        "energy",
        "healthcare",
        "telecom",
        "manufacturing",
        "retail",
        "technology",
        "transport",
        "education",
      ]),
    );
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });

  it("parses every catalog id", () => {
    for (const sector of SECTORS) {
      expect(sectorSchema.parse(sector.id)).toBe(sector.id);
    }
  });

  it("labels unknown sectors as BFSI", () => {
    expect(sectorLabel("gov")).toBe("Government");
    expect(sectorLabel("energy")).toBe("Energy & utilities");
    expect(sectorLabel("not-a-sector")).toBe("BFSI");
  });

  it("routes feeds and regulators by vertical", () => {
    expect(feedSourcesForSector("bfsi_in")).toEqual(["RBI", "SEBI", "CERT_IN"]);
    expect(feedSourcesForSector("gov")).toEqual(["CERT_IN", "CISA", "FBI"]);
    expect(feedSourcesForSector("healthcare")).toEqual(["CISA", "CERT_IN"]);
    expect(defaultRegulatorTags("bfsi_in")).toEqual(["RBI", "CERT-In", "SEBI"]);
    expect(defaultRegulatorTags("energy")).toEqual(["CISA", "CERT-In"]);
    expect(sectorPrompt("telecom")).toMatch(/Telecom/i);
  });
});
