import { describe, expect, it } from "vitest";
import { makeJoinCode, slugify } from "@/lib/join-code";
import {
  canAnswerQuestion,
  questionKey,
  questionRoleIds,
} from "@/lib/schema/exercise";
import {
  parseInjectTeamPlan,
  withSessionActiveTeams,
} from "@/lib/inject-team-plan";

describe("join-code", () => {
  it("generates codes from the ambiguous-safe alphabet", () => {
    const code = makeJoinCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it("slugifies org names", () => {
    expect(slugify("Acme Bank!")).toBe("acme-bank");
    expect(slugify("!!!")).toMatch(/^org-/);
  });
});

describe("question targeting", () => {
  const roleQ = {
    roleId: "soc",
    roleIds: ["soc", "irt"],
    common: false,
    prompt: "Escalate?",
    expectedAction: "Open ticket",
    points: 10,
  };
  const commonQ = {
    roleId: "",
    roleIds: [],
    common: true,
    prompt: "What did you notice?",
    expectedAction: "Share observation",
    points: 5,
  };

  it("resolves role ids and answer eligibility", () => {
    expect(questionRoleIds(roleQ)).toEqual(["soc", "irt"]);
    expect(canAnswerQuestion(roleQ, "soc")).toBe(true);
    expect(canAnswerQuestion(roleQ, "ciso")).toBe(false);
    expect(canAnswerQuestion(commonQ, null)).toBe(true);
    expect(questionKey(roleQ)).toContain("Escalate?");
  });
});

describe("inject team plan", () => {
  it("parses session plans and overlays active teams", () => {
    expect(parseInjectTeamPlan(null)).toEqual({});
    expect(parseInjectTeamPlan({ a: ["t1"], b: "bad" })).toEqual({ a: ["t1"] });

    const inject = {
      id: "a",
      sequence: 1,
      title: "T",
      body: "N",
      timerSeconds: 60,
      targetRoleIds: [],
      techniqueIds: [],
      activeTeamIds: ["doc"],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "Q?",
          expectedAction: "A",
          points: 1,
        },
      ],
      aiGradeRubric: "r",
      consequences: [],
      mediaPrompts: [],
    };
    expect(withSessionActiveTeams(inject, { a: ["session"] }).activeTeamIds).toEqual([
      "session",
    ]);
    expect(withSessionActiveTeams(inject, {}).activeTeamIds).toEqual(["doc"]);
  });
});
