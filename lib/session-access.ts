import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageLiveSession,
  isAdmin,
  type Actor,
} from "@/lib/access";
import {
  guestActivityDenied,
  sessionWriteDenied,
  type SessionStatus,
} from "@/lib/security/session-policy";

type SeatRow = { userId: string; kind: string };

export function denialJson(denied: {
  error: string;
  status: number;
  code?: string;
}) {
  return NextResponse.json(
    { error: denied.error, code: denied.code },
    { status: denied.status },
  );
}

/**
 * Load a live run and enforce object-level access (IDOR / BOLA / LOBA).
 * Callers must already have passed requireApiUser() / requireApiUserForSession().
 */
export async function loadSessionForActor(
  sessionId: string,
  actor: Actor,
  opts?: { includeExerciseDoc?: boolean },
) {
  const locked = guestActivityDenied(actor.activitySessionId, sessionId);
  if (locked) {
    return { error: denialJson(locked) } as const;
  }
  const session = await prisma.exerciseSession.findUnique({
    where: { id: sessionId },
    include: {
      seats: true,
      teams: { include: { members: true } },
      ...(opts?.includeExerciseDoc
        ? { exercise: { select: { document: true, title: true, id: true } } }
        : {}),
    },
  });
  if (!session) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    } as const;
  }
  const seat = session.seats.find((s) => s.userId === actor.id) ?? null;
  if (!seat && !isAdmin(actor)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { session, seat } as const;
}

export function requireFacilitatorSeat(
  actor: Actor,
  seats: SeatRow[],
) {
  const seat = seats.find((s) => s.userId === actor.id);
  if (!canManageLiveSession(actor, seat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function forbidTerminalSessionWrite(
  status: SessionStatus,
  intent: "control" | "roster" | "answer" | "score" | "invite" | "status",
  nextStatus?: string,
) {
  const denied = sessionWriteDenied(status, intent, nextStatus);
  if (!denied) return null;
  return NextResponse.json(
    { error: denied.error, code: denied.code },
    { status: denied.status },
  );
}

/** Strip emails from roster when the viewer is a participant (PII / LOBA). */
export function redactSeatsForViewer<
  T extends {
    kind: string;
    user: { id: string; name: string; email: string };
  },
>(seats: T[], canSeePii: boolean, viewerId: string): T[] {
  if (canSeePii) return seats;
  return seats.map((s) => ({
    ...s,
    user: {
      ...s.user,
      email: s.user.id === viewerId ? s.user.email : "",
    },
  }));
}
