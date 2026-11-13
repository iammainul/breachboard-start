import { describe, expect, it } from "vitest";
import {
  clampAwardedPoints,
  earnedPoints,
  injectProgress,
  leaderboardRows,
  overrideScoreError,
  pointsForRole,
  rankLabel,
} from "@/lib/game-score";

const injects = [
  {
    id: "i1",
    questions: [
      { roleId: "soc", points: 40 },
      { roleId: "ciso", points: 60 },
    ],
  },
  {
    id: "i2",
    questions: [{ roleId: "soc", points: 50 }],
  },
];

describe("game-score", () => {
  it("sums available points for a playbook role", () => {
    expect(pointsForRole(injects, "soc")).toBe(90);
    expect(pointsForRole(injects, "ciso")).toBe(60);
    expect(pointsForRole(injects, null)).toBe(0);
  });

  it("ignores future injects that omit questions (participant redaction)", () => {
    const partial = [
      injects[0]!,
      { id: "i-future", sequence: 2 },
    ];
    expect(pointsForRole(partial, "ciso")).toBe(60);
    expect(
      earnedPoints(
        partial,
        [{ injectId: "i1", userId: "u1", pointsAwarded: 10 }],
        "u1",
        "ciso",
      ),
    ).toBe(10);
  });

  it("awards points only for injects the user answered", () => {
    const answers = [
      { injectId: "i1", userId: "u1" },
      { injectId: "i2", userId: "u2" },
    ];
    expect(earnedPoints(injects, answers, "u1", "soc")).toBe(40);
    expect(earnedPoints(injects, answers, "u1", "ciso")).toBe(60);
    expect(earnedPoints(injects, answers, "u2", "soc")).toBe(50);
    expect(earnedPoints(injects, answers, "u1", null)).toBe(0);
  });

  it("computes inject progress percent from current id", () => {
    expect(injectProgress(injects, "i1")).toBe(50);
    expect(injectProgress(injects, "i2")).toBe(100);
    expect(injectProgress(injects, "missing")).toBe(0);
    expect(injectProgress([], "i1")).toBe(0);
  });

  it("prefers stored pointsAwarded when present", () => {
    const answers = [
      { injectId: "i1", userId: "u1", pointsAwarded: 25 },
      { injectId: "i2", userId: "u1", pointsAwarded: 10 },
    ];
    expect(earnedPoints(injects, answers, "u1", "soc")).toBe(35);
  });

  it("does not count needs-review answers as earned points", () => {
    const answers = [
      { injectId: "i1", userId: "u1", pointsAwarded: 40, needsReview: true },
      { injectId: "i2", userId: "u1", pointsAwarded: 10, needsReview: false },
    ];
    expect(earnedPoints(injects, answers, "u1", "soc")).toBe(10);
    expect(
      earnedPoints(
        injects,
        [{ injectId: "i1", userId: "u1", pointsAwarded: 0, needsReview: true }],
        "u1",
        "soc",
      ),
    ).toBe(0);
  });

  it("rejects or clamps overrides above the inject max", () => {
    expect(overrideScoreError(8, 8)).toBeNull();
    expect(overrideScoreError(0, 8)).toBeNull();
    expect(overrideScoreError(36, 8)).toMatch(/cannot exceed 8/);
    expect(overrideScoreError(-1, 8)).toMatch(/non-negative/);
    expect(clampAwardedPoints(36, 8)).toBe(8);
    expect(clampAwardedPoints(-4, 8)).toBe(0);
    expect(clampAwardedPoints(3.7, 8)).toBe(4);
  });

  it("caps stored overrides so earned never exceeds campaign max", () => {
    const answers = [
      { injectId: "i1", userId: "u1", pointsAwarded: 100 },
      { injectId: "i2", userId: "u1", pointsAwarded: 100 },
    ];
    expect(earnedPoints(injects, answers, "u1", "soc")).toBe(90);
    const [row] = leaderboardRows(injects, answers, [
      { userId: "u1", name: "Arjun", playbookRoleId: "soc" },
    ]);
    expect(row?.earned).toBe(90);
    expect(row?.total).toBe(90);
    expect(row?.earned).toBeLessThanOrEqual(row?.total ?? 0);
  });

  it("maps earned ratio to rank labels", () => {
    expect(rankLabel(0, 0)).toBe("Rookie");
    expect(rankLabel(0, 100)).toBe("Rookie");
    expect(rankLabel(10, 100)).toBe("Recruit");
    expect(rankLabel(40, 100)).toBe("Operator");
    expect(rankLabel(70, 100)).toBe("Veteran");
    expect(rankLabel(90, 100)).toBe("Elite");
  });
});
