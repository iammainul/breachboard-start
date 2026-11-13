import "server-only";

import { prisma } from "@/lib/prisma";
import { discussExpiryWrite } from "@/lib/session-clock";

type PhaseClock = {
  id: string;
  status: string;
  phase: string;
  currentInjectStartedAt: Date | null;
};

/**
 * Authoritative discuss → answering flip. Any seated client poll (or answer
 * POST) can apply it, so the room does not stall if the facilitator tab is gone.
 */
export async function applyDiscussExpiry<T extends PhaseClock>(
  session: T,
  nowMs: number = Date.now(),
): Promise<T> {
  const write = discussExpiryWrite(session, nowMs);
  if (!write) return session;

  const updated = await prisma.exerciseSession.updateMany({
    where: write.where,
    data: write.data,
  });

  if (updated.count === 1) {
    return {
      ...session,
      phase: write.data.phase,
      currentInjectStartedAt: write.data.currentInjectStartedAt,
    };
  }

  const latest = await prisma.exerciseSession.findUnique({
    where: { id: session.id },
    select: {
      status: true,
      phase: true,
      currentInjectStartedAt: true,
    },
  });
  if (!latest) return session;
  return {
    ...session,
    status: latest.status,
    phase: latest.phase,
    currentInjectStartedAt: latest.currentInjectStartedAt,
  };
}
