import { describe, expect, it } from "vitest";
import {
  computeParticipation,
  expectedAnswerCount,
  resolveActiveTeamIds,
  teamIdForUser,
} from "@/lib/participation";
import type { ExerciseDocument } from "@/lib/schema/exercise";

const inject = {
  id: "inj-1",
  sequence: 1,
  title: "Phishing spike",
  body: "Mailbox alerts fire.",
  timerSeconds: 300,
  targetRoleIds: ["soc", "ciso"],
  techniqueIds: [],
  activeTeamIds: ["alpha"],
  questions: [
    {
      roleId: "soc",
      roleIds: ["soc"],
      common: false,
      prompt: "Contain?",
      expectedAction: "Isolate",
      points: 50,
    },
    {
      roleId: "ciso",
      roleIds: ["ciso"],
      common: false,
      prompt: "Brief execs?",
      expectedAction: "Call bridge",
      points: 40,
    },
  ],
  aiGradeRubric: "Containment first",
  consequences: [],
  mediaPrompts: [],
} satisfies ExerciseDocument["injects"][number];

const teams = [
  { id: "alpha", name: "Alpha", memberUserIds: ["u-soc"] },
  { id: "bravo", name: "Bravo", memberUserIds: ["u-ciso"] },
];

describe("participation", () => {
  it("resolves active teams or all when unset", () => {
    expect(resolveActiveTeamIds({ activeTeamIds: ["alpha"] }, teams)).toEqual([
      "alpha",
    ]);
    expect(resolveActiveTeamIds({ activeTeamIds: [] }, teams)).toBe("all");
    expect(resolveActiveTeamIds({}, [])).toBe("all");
    expect(resolveActiveTeamIds({ activeTeamIds: ["blue"] }, teams)).toBe("all");
  });

  it("maps users to their squad", () => {
    expect(teamIdForUser(teams, "u-soc")).toBe("alpha");
    expect(teamIdForUser(teams, "nobody")).toBeNull();
  });

  it("lets facilitators and observers see injects without answering", () => {
    const facilitator = computeParticipation({
      userId: "mod",
      seatKind: "MODERATOR",
      playbookRoleId: null,
      teams,
      inject,
    });
    expect(facilitator.state).toBe("facilitator");
    expect(facilitator.canSeeInject).toBe(true);
    expect(facilitator.answerableQuestionKeys).toEqual([]);

    const observer = computeParticipation({
      userId: "obs",
      seatKind: "OBSERVER",
      playbookRoleId: null,
      teams,
      inject,
    });
    expect(observer.state).toBe("observer");
    expect(observer.answerableQuestionKeys).toEqual([]);
  });

  it("activates only matching roles on the active team", () => {
    const active = computeParticipation({
      userId: "u-soc",
      seatKind: "PARTICIPANT",
      playbookRoleId: "soc",
      teams,
      inject,
    });
    expect(active.state).toBe("active");
    expect(active.answerableQuestionKeys).toHaveLength(1);

    const standby = computeParticipation({
      userId: "u-ciso",
      seatKind: "PARTICIPANT",
      playbookRoleId: "ciso",
      teams,
      inject,
    });
    expect(standby.state).toBe("inactive");
    expect(standby.canSeeInject).toBe(false);
  });

  it("counts expected answers for active seated participants only", () => {
    const seats = [
      { kind: "PARTICIPANT", playbookRoleId: "soc", userId: "u-soc" },
      { kind: "PARTICIPANT", playbookRoleId: "ciso", userId: "u-ciso" },
      { kind: "OBSERVER", playbookRoleId: null, userId: "obs" },
    ];
    expect(expectedAnswerCount(inject, seats, teams)).toBe(1);
  });
});
