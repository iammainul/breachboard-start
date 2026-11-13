import { describe, expect, it } from "vitest";
import { debriefEmptyCopy, debriefHighlights } from "@/lib/debrief-notes";

const questions = [
  { roleId: "soc", points: 40 },
  { roleId: "ciso", points: 60 },
];

describe("debrief-notes", () => {
  it("splits scored answers into strengths and gaps", () => {
    const { strengths, gaps, emptyReason } = debriefHighlights(
      [
        {
          userName: "Asha",
          playbookRoleId: "soc",
          pointsAwarded: 36,
          aiNotes: "Clear containment call and timely escalation.",
        },
        {
          userName: "Priya",
          playbookRoleId: "ciso",
          pointsAwarded: 20,
          aiNotes: "Missed regulator notification window.",
          overrideComment: "Need the 60-minute rule.",
        },
      ],
      questions,
    );
    expect(emptyReason).toBeNull();
    expect(strengths).toHaveLength(1);
    expect(strengths[0]?.userName).toBe("Asha");
    expect(strengths[0]?.note).toContain("containment");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.note).toContain("regulator");
    expect(gaps[0]?.note).toContain("60-minute");
  });

  it("skips ungraded answers and reports a pending-review empty state", () => {
    const result = debriefHighlights(
      [
        {
          userName: "Asha",
          playbookRoleId: "soc",
          pointsAwarded: 0,
          needsReview: true,
          aiNotes: "Needs facilitator review — AI grading unavailable.",
        },
      ],
      questions,
    );
    expect(result.strengths).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.emptyReason).toBe("pending_review");
    expect(debriefEmptyCopy(result.emptyReason)).toMatch(/facilitator scores/);
  });

  it("uses a quiet empty state when nothing is scored", () => {
    expect(debriefHighlights([], questions).emptyReason).toBe("no_answers");
    expect(debriefEmptyCopy("no_scores")).toMatch(/scoring notes/);
  });
});
