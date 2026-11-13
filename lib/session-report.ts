import "server-only";

import { prisma } from "@/lib/prisma";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { leaderboardRows } from "@/lib/game-score";

export type SessionReportSnapshot = {
  generatedAt: string;
  sessionId: string;
  joinCode: string;
  runKind: string;
  organization: { id: string; name: string };
  exercise: { id: string; title: string };
  startedAt: string | null;
  closedAt: string | null;
  injects: { id: string; sequence: number; title: string }[];
  leaderboard: {
    userId: string;
    name: string;
    role: string;
    earned: number;
    total: number;
    rank: string;
  }[];
  answers: {
    injectId: string;
    injectTitle: string;
    userId?: string;
    userName: string;
    role: string;
    body: string;
    autoPoints: number;
    pointsAwarded: number;
    needsReview?: boolean;
    aiNotes: string | null;
    overrideComment: string | null;
  }[];
};

export async function buildSessionReport(
  sessionId: string,
): Promise<SessionReportSnapshot | null> {
  const session = await prisma.exerciseSession.findUnique({
    where: { id: sessionId },
    include: {
      organization: { select: { id: true, name: true } },
      exercise: { select: { id: true, title: true, document: true } },
      seats: {
        include: { user: { select: { id: true, name: true } } },
      },
      answers: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) return null;
  const parsed = parseExerciseDocument(session.exercise.document);
  const injects = parsed.success
    ? parsed.data.injects.slice().sort((a, b) => a.sequence - b.sequence)
    : [];
  const roles = parsed.success ? parsed.data.roles : [];
  const roleName = (id: string | null | undefined) =>
    id ? roles.find((r) => r.id === id)?.name ?? id : "—";

  const people = session.seats
    .filter((s) => s.kind === "PARTICIPANT")
    .map((s) => ({
      userId: s.user.id,
      name: s.user.name,
      playbookRoleId: s.playbookRoleId,
    }));

  const board = leaderboardRows(
    injects,
    session.answers.map((a) => ({
      injectId: a.injectId,
      userId: a.userId,
      pointsAwarded: a.pointsAwarded,
      needsReview: a.needsReview,
    })),
    people,
  );

  return {
    generatedAt: new Date().toISOString(),
    sessionId: session.id,
    joinCode: session.joinCode,
    runKind: session.runKind,
    organization: session.organization,
    exercise: { id: session.exercise.id, title: session.exercise.title },
    startedAt: session.startedAt?.toISOString() ?? null,
    closedAt: session.closedAt?.toISOString() ?? null,
    injects: injects.map((i) => ({
      id: i.id,
      sequence: i.sequence,
      title: i.title,
    })),
    leaderboard: board.map((row) => ({
      userId: row.userId,
      name: row.name,
      role: roleName(row.playbookRoleId),
      earned: row.earned,
      total: row.total,
      rank: row.rank,
    })),
    answers: session.answers.map((a) => ({
      injectId: a.injectId,
      injectTitle:
        injects.find((i) => i.id === a.injectId)?.title ?? a.injectId,
      userId: a.userId,
      userName: a.user.name,
      role: roleName(a.playbookRoleId),
      body: a.body,
      autoPoints: a.autoPoints,
      pointsAwarded: a.pointsAwarded,
      needsReview: a.needsReview,
      aiNotes: a.aiNotes,
      overrideComment: a.overrideComment,
    })),
  };
}

export { redactSessionReport } from "@/lib/security/report-redact";

export async function persistSessionReport(sessionId: string) {
  const snapshot = await buildSessionReport(sessionId);
  if (!snapshot) return null;
  await prisma.exerciseSession.update({
    where: { id: sessionId },
    data: {
      reportSnapshot: snapshot,
      reportGeneratedAt: new Date(),
    },
  });
  return snapshot;
}
