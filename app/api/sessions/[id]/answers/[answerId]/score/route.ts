import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageLiveSession, requireApiUserForSession } from "@/lib/access";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { forbidTerminalSessionWrite } from "@/lib/session-access";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import {
  maxPointsForRoleQuestions,
  overrideScoreError,
} from "@/lib/game-score";

const bodySchema = z.object({
  pointsAwarded: z.number().int().min(0).max(10_000),
  overrideComment: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; answerId: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id, answerId } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid score body" }, { status: 400 });
  }

  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true, exercise: { select: { document: true } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const frozen = forbidTerminalSessionWrite(session.status, "score");
  if (frozen) return frozen;
  const seat = session.seats.find((s) => s.userId === actor.user.id);
  if (!canManageLiveSession(actor.user, seat)) {
    return NextResponse.json({ error: "Facilitators only" }, { status: 403 });
  }

  const existing = await prisma.injectAnswer.findFirst({
    where: { id: answerId, sessionId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Answer not found" }, { status: 404 });
  }

  const document = parseExerciseDocument(session.exercise.document);
  const inject = document.success
    ? document.data.injects.find((item) => item.id === existing.injectId)
    : undefined;
  const maxPoints = inject
    ? maxPointsForRoleQuestions(inject.questions, existing.playbookRoleId)
    : 0;
  const capError = overrideScoreError(parsed.data.pointsAwarded, maxPoints);
  if (capError) {
    return NextResponse.json(
      { error: capError, code: "SCORE_CAP", maxPoints },
      { status: 400 },
    );
  }

  const updated = await prisma.injectAnswer.update({
    where: { id: answerId },
    data: {
      pointsAwarded: parsed.data.pointsAwarded,
      overrideComment: parsed.data.overrideComment?.trim() || null,
      overriddenById: actor.user.id,
      needsReview: false,
      gradedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
