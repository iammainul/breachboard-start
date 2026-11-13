import { describe, expect, it } from "vitest";
import {
  applyPlaceholders,
  applyPlaceholdersInInject,
  generalizeInject,
  generalizePlaceholders,
} from "@/lib/scenario-placeholders";

const ctx = {
  orgName: "Northline Bank",
  sector: "bfsi_in",
  teams: [{ id: "team-1", name: "Blue Cell" }, { id: "team-2", name: "Crisis Comms" }],
};

describe("scenario placeholders", () => {
  it("fills org, sector, and team tokens at run time", () => {
    expect(
      applyPlaceholders(
        "{{org}} ({{sector}}) — {{team}} leads; {{teams}} are seated.",
        ctx,
      ),
    ).toBe("Northline Bank (BFSI) — Blue Cell leads; Blue Cell and Crisis Comms are seated.");
  });

  it("turns hardcoded source names into portable tokens", () => {
    expect(
      generalizePlaceholders(
        "Northline Bank SOC alerts Blue Cell. BFSI duty manager pages Crisis Comms.",
        ctx,
      ),
    ).toBe("{{org}} SOC alerts {{team}}. {{sector}} duty manager pages {{team}}.");
  });

  it("generalizes an inject so it can drop into another client pack", () => {
    const inject = generalizeInject(
      {
        id: "inj-01",
        sequence: 1,
        title: "Northline Bank mailbox spike",
        body: "Northline Bank SOC pages Blue Cell.",
        timerSeconds: 300,
        targetRoleIds: ["soc"],
        techniqueIds: ["T1566"],
        activeTeamIds: [],
        questions: [
          {
            roleId: "soc",
            roleIds: ["soc"],
            common: false,
            prompt: "What does Northline Bank do first?",
            expectedAction: "Blue Cell isolates the mailbox",
            points: 5,
          },
        ],
        aiGradeRubric: "Credit timely Northline Bank coordination.",
        consequences: [
          {
            id: "c1",
            label: "Contain",
            scoreDelta: 1,
            worldState: "Blue Cell holds the line",
          },
        ],
        mediaPrompts: [],
      },
      ctx,
    );
    expect(inject.body).toBe("{{org}} SOC pages {{team}}.");
    expect(applyPlaceholdersInInject(inject, ctx).body).toBe(
      "Northline Bank SOC pages Blue Cell.",
    );
  });
});
