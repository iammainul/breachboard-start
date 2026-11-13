import { describe, expect, test } from "vitest";
import {
  describeInjectSeverity,
  inferInjectSeverity,
} from "@/lib/media/inject-severity";
import { fallbackImagePrompt } from "@/lib/media/ensure-inject-media";
import { composeMediaPrompt, orgVisualStyleGuide } from "@/lib/media/org-style-prompt";
import { TTX_STAGE_IMAGE_PROMPT_RULES } from "@/lib/ai/prompts/ttx-designer";

describe("inferInjectSeverity", () => {
  test("treats the opening inject as watch when wording is an intel receipt", () => {
    expect(
      inferInjectSeverity({
        sequence: 1,
        title: "CERT-In advisory lands",
        body: "SOC receives a threat-intel notification.",
      }),
    ).toBe("watch");
  });

  test("upgrades a mid-exercise inject when the body is a ransom demand", () => {
    expect(
      inferInjectSeverity({
        sequence: 3,
        title: "Note arrives",
        body: "Actors demand 400 BTC or they leak KYC.",
      }),
    ).toBe("critical");
  });

  test("marks a containment inject as high", () => {
    expect(
      inferInjectSeverity({
        sequence: 3,
        title: "Isolate the VLAN",
        body: "Contain the jump host before restore.",
      }),
    ).toBe("high");
  });
});

describe("orgVisualStyleGuide", () => {
  test("asks for a tabletop briefing board instead of cinematic drama", () => {
    const guide = orgVisualStyleGuide({ name: "Northline Bank", sector: "bfsi_in" });

    expect(guide).toContain("facilitator inject board");
    expect(guide).toContain("#E8EEF2");
    expect(guide).not.toContain("hacker-brutalist");
    expect(guide).not.toContain("toxic phosphor");
    expect(guide).toContain(TTX_STAGE_IMAGE_PROMPT_RULES.split("\n")[0]);
  });

  test("pins severity color to the inject callout", () => {
    const guide = orgVisualStyleGuide(
      { name: "Northline Bank", sector: "bfsi_in" },
      {
        inject: {
          sequence: 5,
          title: "Ransom note",
          body: "Customer KYC leak unless BTC is paid.",
        },
      },
    );

    expect(guide).toContain(describeInjectSeverity("critical"));
    expect(guide).toContain("#B42318");
  });
});

describe("composeMediaPrompt", () => {
  test("wraps the scene as an inject board with house style", () => {
    const prompt = composeMediaPrompt(
      "Show the SWIFT jump host alert.",
      { name: "Northline Bank", sector: "bfsi_in" },
      { inject: { sequence: 1, title: "SWIFT alert", body: "Encryption on jump host." } },
    );

    expect(prompt).toContain("INJECT BOARD:");
    expect(prompt).toContain("Show the SWIFT jump host alert.");
    expect(prompt).toContain("HOUSE STYLE");
  });
});

describe("fallbackImagePrompt", () => {
  test("describes a neutral tabletop board with a severity accent", () => {
    const prompt = fallbackImagePrompt({
      id: "inj-02",
      sequence: 2,
      title: "Lateral",
      body: "Admin share used for investigation.",
      timerSeconds: 300,
      targetRoleIds: [],
      techniqueIds: [],
      activeTeamIds: [],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "What do you pull?",
          expectedAction: "Logs",
          points: 1,
        },
      ],
      aiGradeRubric: "Reward isolation.",
      consequences: [],
      mediaPrompts: [],
    });

    expect(prompt).toContain("tabletop inject board");
    expect(prompt).toContain("Lateral");
    expect(prompt).toContain("No cinematic lighting");
    expect(prompt).toMatch(/#C4A35A|#C45C3E/);
  });
});
