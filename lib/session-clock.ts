/** Seconds of open discussion before questions unlock on each inject. */
export const DISCUSS_SECONDS = 120;

/** ADR-002: remaining = duration − (now − startedAt). */
export function remainingSeconds(
  startedAt: string | Date | null | undefined,
  durationSeconds: number,
  nowMs: number = Date.now(),
): number {
  if (durationSeconds <= 0) return 0;
  if (!startedAt) return durationSeconds;
  const startMs =
    typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  if (Number.isNaN(startMs)) return durationSeconds;
  const elapsed = Math.floor((nowMs - startMs) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const SESSION_PHASES = ["idle", "discuss", "answering", "debrief"] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

export function isSessionPhase(value: unknown): value is SessionPhase {
  return (
    typeof value === "string" &&
    (SESSION_PHASES as readonly string[]).includes(value)
  );
}

export const RUN_KINDS = ["draft", "engagement"] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export function isRunKind(value: unknown): value is RunKind {
  return (
    typeof value === "string" &&
    (RUN_KINDS as readonly string[]).includes(value)
  );
}

/** Live discuss window has elapsed — answers should unlock on the server. */
export function shouldOpenAnswersFromDiscuss(
  session: {
    status: string;
    phase: string;
    currentInjectStartedAt?: string | Date | null;
  },
  nowMs: number = Date.now(),
): boolean {
  if (session.status !== "live" || session.phase !== "discuss") return false;
  if (!session.currentInjectStartedAt) return false;
  return remainingSeconds(session.currentInjectStartedAt, DISCUSS_SECONDS, nowMs) <= 0;
}

/**
 * Conditional write that opens answering only while the row is still in the
 * expired discuss window. Callers apply this with `updateMany` so two polls
 * cannot both reset the inject clock.
 */
export function discussExpiryWrite(
  session: {
    id: string;
    status: string;
    phase: string;
    currentInjectStartedAt?: string | Date | null;
  },
  nowMs: number = Date.now(),
): {
  where: {
    id: string;
    status: "live";
    phase: "discuss";
    currentInjectStartedAt: Date;
  };
  data: { phase: "answering"; currentInjectStartedAt: Date };
} | null {
  if (!shouldOpenAnswersFromDiscuss(session, nowMs)) return null;
  const startedAt =
    typeof session.currentInjectStartedAt === "string"
      ? new Date(session.currentInjectStartedAt)
      : session.currentInjectStartedAt;
  if (!startedAt || Number.isNaN(startedAt.getTime())) return null;
  return {
    where: {
      id: session.id,
      status: "live",
      phase: "discuss",
      currentInjectStartedAt: startedAt,
    },
    data: {
      phase: "answering",
      currentInjectStartedAt: new Date(nowMs),
    },
  };
}

export function runKindLabel(kind: string | null | undefined) {
  return kind === "draft" ? "Draft run" : "Engagement";
}
