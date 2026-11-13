import { describe, expect, it } from "vitest";
import { redactSessionReport } from "@/lib/security/report-redact";

const snapshot = {
  answers: [
    {
      injectId: "i1",
      userId: "u-self",
      userName: "Ada",
      body: "I isolated the host",
      autoPoints: 40,
      pointsAwarded: 40,
      aiNotes: "Matches expectedAction isolate",
      overrideComment: "good",
    },
    {
      injectId: "i1",
      userId: "u-other",
      userName: "Bob",
      body: "I called the CEO",
      autoPoints: 10,
      pointsAwarded: 10,
      aiNotes: "Missed regulator notify",
      overrideComment: null,
    },
  ],
};

describe("redactSessionReport", () => {
  it("keeps facilitator notes and strips them for participants", () => {
    const fac = redactSessionReport(snapshot, {
      userId: "mod",
      seatKind: "MODERATOR",
      isAdmin: false,
    });
    expect(fac.answers[0]?.aiNotes).toContain("expectedAction");

    const player = redactSessionReport(snapshot, {
      userId: "u-self",
      seatKind: "PARTICIPANT",
      isAdmin: false,
    });
    expect(player.answers).toHaveLength(1);
    expect(player.answers[0]?.aiNotes).toBeNull();
    expect(JSON.stringify(player)).not.toContain("expectedAction");
    expect(JSON.stringify(player)).not.toContain("I called the CEO");
  });
});
