/**
 * Pure session authorization policy. Route handlers call these helpers so
 * denials stay consistent and unit-testable without a database.
 */

export type SessionStatus = "draft" | "live" | "closed" | "archived" | string;
export type SessionPhase = "idle" | "discuss" | "answering" | "debrief" | string;
export type SeatKind = "MODERATOR" | "OBSERVER" | "PARTICIPANT" | string | null | undefined;

export type Denial = {
  error: string;
  status: number;
  code?: string;
};

export function isTerminalSessionStatus(status: SessionStatus) {
  return status === "closed" || status === "archived";
}

export function joinDenied(status: SessionStatus): Denial | null {
  if (status === "archived") {
    return { error: "This run is archived", status: 409, code: "ARCHIVED" };
  }
  if (status === "closed") {
    return { error: "This run has ended", status: 409, code: "CLOSED" };
  }
  return null;
}

/**
 * Writes against a run: seating, invites, inject control, scoring.
 * Restore (archived → closed) and archive (closed → archived) are the
 * only status-only mutations allowed on terminal runs.
 */
export function sessionWriteDenied(
  status: SessionStatus,
  intent: "control" | "roster" | "answer" | "score" | "invite" | "status",
  nextStatus?: string,
): Denial | null {
  if (status === "archived") {
    if (intent === "status" && nextStatus === "closed") return null;
    return {
      error: "Restore the engagement from Archived before changing this run",
      status: 409,
      code: "ARCHIVED",
    };
  }
  if (status === "closed") {
    if (intent === "status" && nextStatus === "archived") return null;
    return {
      error: "This run has ended",
      status: 409,
      code: "CLOSED",
    };
  }
  return null;
}

/** Facilitator / unseated admin may see expectedAction, rubric, AI notes. */
export function mayRevealAnswerKeys(input: {
  seatKind: SeatKind;
  adminUnseated: boolean;
}) {
  return input.seatKind === "MODERATOR" || input.adminUnseated;
}

/** Observers watch; they do not get scoring keys or other players' live answers. */
export function maySeeOthersAnswers(input: {
  seatKind: SeatKind;
  adminUnseated: boolean;
  phase: SessionPhase;
  status: SessionStatus;
}) {
  if (mayRevealAnswerKeys(input)) return true;
  if (input.seatKind !== "OBSERVER") return false;
  return (
    input.phase === "debrief" ||
    input.status === "closed" ||
    input.status === "archived"
  );
}

export function maySeeRosterPii(input: {
  seatKind: SeatKind;
  adminUnseated: boolean;
}) {
  return mayRevealAnswerKeys(input);
}

/** Future injects must not leak narrative/questions to players. */
export function participantMaySeeInjectBody(
  injectSequence: number,
  currentSequence: number | null,
) {
  if (currentSequence == null) return false;
  return injectSequence <= currentSequence;
}

export function answerDenied(input: {
  isAdmin: boolean;
  seatKind: SeatKind;
  playbookRoleId: string | null | undefined;
  sessionStatus: SessionStatus;
  phase: SessionPhase;
  injectId: string;
  currentInjectId: string | null;
  participationState: string;
  canSeeInject: boolean;
}): Denial | null {
  if (input.isAdmin) {
    return {
      error: "Operator accounts cannot submit participant answers",
      status: 403,
      code: "FORBIDDEN",
    };
  }
  if (input.seatKind === "OBSERVER") {
    return {
      error: "Observers cannot submit answers",
      status: 403,
      code: "FORBIDDEN",
    };
  }
  if (input.seatKind !== "PARTICIPANT" || !input.playbookRoleId) {
    return {
      error: "Only seated participants answer",
      status: 403,
      code: "FORBIDDEN",
    };
  }
  const terminal = sessionWriteDenied(input.sessionStatus, "answer");
  if (terminal) return terminal;
  if (input.sessionStatus !== "live") {
    return { error: "Run is not live", status: 409, code: "PHASE" };
  }
  if (input.phase === "debrief") {
    return {
      error: "Inject is in debrief — answers are closed",
      status: 409,
      code: "PHASE",
    };
  }
  if (input.phase === "discuss" || input.phase === "idle") {
    return {
      error: "Discussion is still open — answers unlock after the discuss window",
      status: 409,
      code: "PHASE",
    };
  }
  if (input.phase !== "answering") {
    return {
      error: "Answers are not open right now",
      status: 409,
      code: "PHASE",
    };
  }
  if (input.currentInjectId && input.currentInjectId !== input.injectId) {
    return { error: "That inject is not active", status: 409, code: "PHASE" };
  }
  if (input.participationState !== "active" || !input.canSeeInject) {
    return {
      error: "Your team is not active on this inject",
      status: 403,
      code: "INACTIVE",
    };
  }
  return null;
}

export function seatDeleteTarget(
  sessionSeatIds: string[],
  seatId: string,
): Denial | null {
  if (!sessionSeatIds.includes(seatId)) {
    return { error: "Seat not found", status: 404, code: "NOT_FOUND" };
  }
  return null;
}

/**
 * Guest join JWTs are bound to one run (`activitySessionId`). Proxy already
 * redirects other URLs; this is the object-level check for handlers/RSC.
 */
export function guestActivityDenied(
  activitySessionId: string | null | undefined,
  requestedSessionId: string,
): Denial | null {
  if (!activitySessionId) return null;
  if (activitySessionId === requestedSessionId) return null;
  return { error: "Forbidden", status: 403, code: "ACTIVITY_LOCK" };
}

/**
 * `claimSelf` MODERATOR bypasses an existing facilitator seat. The actor must
 * still be a platform facilitator AND have org access to that client run.
 */
export function claimSelfModeratorDenied(input: {
  canFacilitate: boolean;
  orgAccess: boolean;
}): Denial | null {
  if (!input.canFacilitate) {
    return { error: "Forbidden", status: 403, code: "FORBIDDEN" };
  }
  if (!input.orgAccess) {
    return { error: "Forbidden", status: 403, code: "FORBIDDEN" };
  }
  return null;
}

/** Strip scoring keys that must not round-trip to participants. */
export function stripAnswerKeys<
  T extends {
    aiNotes?: string | null;
    overrideComment?: string | null;
    needsReview?: boolean;
  },
>(answer: T, revealKeys: boolean): T {
  if (revealKeys) return answer;
  return {
    ...answer,
    aiNotes: null,
    overrideComment: null,
    needsReview: false,
  };
}
