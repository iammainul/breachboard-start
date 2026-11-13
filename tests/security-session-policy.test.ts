import { describe, expect, it } from "vitest";
import {
  answerDenied,
  claimSelfModeratorDenied,
  guestActivityDenied,
  joinDenied,
  mayRevealAnswerKeys,
  maySeeOthersAnswers,
  maySeeRosterPii,
  participantMaySeeInjectBody,
  seatDeleteTarget,
  sessionWriteDenied,
  stripAnswerKeys,
} from "@/lib/security/session-policy";
import { participantQuestion } from "@/lib/participant-view";

describe("joinDenied", () => {
  it("rejects closed and archived codes", () => {
    expect(joinDenied("closed")?.status).toBe(409);
    expect(joinDenied("archived")?.code).toBe("ARCHIVED");
    expect(joinDenied("live")).toBeNull();
    expect(joinDenied("draft")).toBeNull();
  });
});

describe("sessionWriteDenied", () => {
  it("allows restore archived → closed and archive closed → archived only", () => {
    expect(sessionWriteDenied("archived", "status", "closed")).toBeNull();
    expect(sessionWriteDenied("closed", "status", "archived")).toBeNull();
    expect(sessionWriteDenied("archived", "control")?.code).toBe("ARCHIVED");
    expect(sessionWriteDenied("closed", "roster")?.code).toBe("CLOSED");
    expect(sessionWriteDenied("closed", "score")?.code).toBe("CLOSED");
    expect(sessionWriteDenied("live", "control")).toBeNull();
  });
});

describe("answer keys", () => {
  it("hides expectedAction from participant payloads", () => {
    const visible = participantQuestion({
      roleId: "soc",
      roleIds: ["soc"],
      common: false,
      prompt: "Contain?",
      expectedAction: "Isolate the VLAN",
      points: 50,
    });
    expect(visible).not.toHaveProperty("expectedAction");
    expect(JSON.stringify(visible)).not.toContain("Isolate");
  });

  it("reveals keys only to facilitators and unseated admins", () => {
    expect(
      mayRevealAnswerKeys({ seatKind: "MODERATOR", adminUnseated: false }),
    ).toBe(true);
    expect(
      mayRevealAnswerKeys({ seatKind: "OBSERVER", adminUnseated: false }),
    ).toBe(false);
    expect(
      mayRevealAnswerKeys({ seatKind: "PARTICIPANT", adminUnseated: false }),
    ).toBe(false);
    expect(
      mayRevealAnswerKeys({ seatKind: null, adminUnseated: true }),
    ).toBe(true);
  });

  it("keeps observer answers off until debrief or close", () => {
    expect(
      maySeeOthersAnswers({
        seatKind: "OBSERVER",
        adminUnseated: false,
        phase: "answering",
        status: "live",
      }),
    ).toBe(false);
    expect(
      maySeeOthersAnswers({
        seatKind: "OBSERVER",
        adminUnseated: false,
        phase: "debrief",
        status: "live",
      }),
    ).toBe(true);
    expect(
      maySeeRosterPii({ seatKind: "OBSERVER", adminUnseated: false }),
    ).toBe(false);
  });

  it("omits future inject bodies for players", () => {
    expect(participantMaySeeInjectBody(2, 1)).toBe(false);
    expect(participantMaySeeInjectBody(1, 1)).toBe(true);
    expect(participantMaySeeInjectBody(1, null)).toBe(false);
  });
});

describe("answerDenied", () => {
  const base = {
    isAdmin: false,
    seatKind: "PARTICIPANT" as const,
    playbookRoleId: "soc",
    sessionStatus: "live",
    phase: "answering",
    injectId: "inj-1",
    currentInjectId: "inj-1",
    participationState: "active",
    canSeeInject: true,
  };

  it("rejects observers, admins, closed runs, and discuss phase", () => {
    expect(answerDenied({ ...base, seatKind: "OBSERVER" })?.code).toBe(
      "FORBIDDEN",
    );
    expect(answerDenied({ ...base, isAdmin: true })?.code).toBe("FORBIDDEN");
    expect(answerDenied({ ...base, sessionStatus: "closed" })?.code).toBe(
      "CLOSED",
    );
    expect(answerDenied({ ...base, sessionStatus: "archived" })?.code).toBe(
      "ARCHIVED",
    );
    expect(answerDenied({ ...base, phase: "discuss" })?.code).toBe("PHASE");
    expect(answerDenied({ ...base, participationState: "inactive" })?.code).toBe(
      "INACTIVE",
    );
  });

  it("allows an active participant during answering", () => {
    expect(answerDenied(base)).toBeNull();
  });
});

describe("seatDeleteTarget", () => {
  it("refuses deleting a seat that is not on this session", () => {
    expect(seatDeleteTarget(["seat-a"], "seat-b")?.status).toBe(404);
    expect(seatDeleteTarget(["seat-a"], "seat-a")).toBeNull();
  });
});

describe("claimSelfModeratorDenied", () => {
  it("requires facilitator flag and org access", () => {
    expect(
      claimSelfModeratorDenied({ canFacilitate: true, orgAccess: true }),
    ).toBeNull();
    expect(
      claimSelfModeratorDenied({ canFacilitate: true, orgAccess: false })?.code,
    ).toBe("FORBIDDEN");
    expect(
      claimSelfModeratorDenied({ canFacilitate: false, orgAccess: true })?.code,
    ).toBe("FORBIDDEN");
  });
});

describe("guestActivityDenied", () => {
  it("locks guest JWTs to one run and ignores unbound operators", () => {
    expect(guestActivityDenied(undefined, "sess-a")).toBeNull();
    expect(guestActivityDenied("sess-a", "sess-a")).toBeNull();
    expect(guestActivityDenied("sess-a", "sess-b")?.code).toBe("ACTIVITY_LOCK");
    expect(guestActivityDenied("sess-a", "sess-b")?.status).toBe(403);
  });
});

describe("stripAnswerKeys", () => {
  it("removes aiNotes and override comments from participant payloads", () => {
    const raw = {
      id: "ans-1",
      body: "Isolated the VLAN",
      autoPoints: 40,
      pointsAwarded: 40,
      needsReview: true,
      aiNotes: "Matches expectedAction isolate",
      overrideComment: "full credit",
    };
    const player = stripAnswerKeys(raw, false);
    expect(player.aiNotes).toBeNull();
    expect(player.overrideComment).toBeNull();
    expect(player.needsReview).toBe(false);
    expect(player.body).toBe("Isolated the VLAN");
    expect(JSON.stringify(player)).not.toContain("expectedAction");
    expect(stripAnswerKeys(raw, true).aiNotes).toContain("expectedAction");
  });
});
