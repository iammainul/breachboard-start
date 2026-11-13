import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireApiUserForSession } from "@/lib/access";
import { canAnswerQuestion, parseExerciseDocument } from "@/lib/schema/exercise";
import { computeParticipation, type TeamInfo } from "@/lib/participation";
import {
  parseInjectTeamPlan,
  withSessionActiveTeams,
} from "@/lib/inject-team-plan";
import {
  gradeAnswerWithRubric,
  maxPointsForRoleQuestions,
} from "@/lib/ai/grade-answer";
import { orgPlanContext } from "@/lib/org-docs";
import { applyDiscussExpiry } from "@/lib/session-phase";
import { answerDenied, stripAnswerKeys } from "@/lib/security/session-policy";
import { denyCrossSiteMutation, enforceRateLimit } from "@/lib/security/api-guard";

const bodySchema = z.object({
  injectId: z.string().min(1),
  text: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const limited = enforceRateLimit(request, "answer", actor.user.id);
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Answer required" }, { status: 400 });
  }
  const loaded = await prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      seats: true,
      exercise: true,
      teams: { include: { members: true } },
      organization: {
        select: {
          id: true,
          crisisDocPath: true,
          crisisDocName: true,
          ircDocPath: true,
          ircDocName: true,
        },
      },
    },
  });
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await applyDiscussExpiry(loaded);
  const seat = session.seats.find((s) => s.userId === actor.user.id);
  const doc = parseExerciseDocument(session.exercise.document);
  if (!doc.success) {
    return NextResponse.json({ error: "Scenario unreadable" }, { status: 500 });
  }
  const injectRaw = doc.data.injects.find((i) => i.id === parsed.data.injectId);
  if (!injectRaw) {
    return NextResponse.json({ error: "Unknown inject" }, { status: 400 });
  }
  const inject = withSessionActiveTeams(
    injectRaw,
    parseInjectTeamPlan(session.injectTeamPlan),
  );

  const teams: TeamInfo[] = session.teams.map((t) => ({
    id: t.id,
    name: t.name,
    memberUserIds: t.members.map((m) => m.userId),
  }));
  const participation = computeParticipation({
    userId: actor.user.id,
    seatKind: seat?.kind,
    playbookRoleId: seat?.playbookRoleId,
    teams,
    inject,
  });
  const denied = answerDenied({
    isAdmin: isAdmin(actor.user),
    seatKind: seat?.kind,
    playbookRoleId: seat?.playbookRoleId,
    sessionStatus: session.status,
    phase: session.phase,
    injectId: parsed.data.injectId,
    currentInjectId: session.currentInjectId,
    participationState: participation.state,
    canSeeInject: participation.canSeeInject,
  });
  if (denied) {
    return NextResponse.json(
      { error: denied.error, code: denied.code },
      { status: denied.status },
    );
  }
  if (!seat?.playbookRoleId) {
    return NextResponse.json({ error: "Only seated participants answer" }, { status: 403 });
  }
  const answerable = inject.questions.filter((q) =>
    canAnswerQuestion(q, seat.playbookRoleId),
  );
  if (answerable.length === 0) {
    return NextResponse.json(
      { error: "No answerable question for your role on this inject" },
      { status: 400 },
    );
  }

  const maxPoints = maxPointsForRoleQuestions(
    inject.questions,
    seat.playbookRoleId,
  );
  const roleName =
    doc.data.roles.find((r) => r.id === seat.playbookRoleId)?.name ??
    seat.playbookRoleId;
  const bodyText = parsed.data.text.trim();
  const planContext = await orgPlanContext(session.organization, session.id);
  const grade = await gradeAnswerWithRubric({
    maxPoints,
    questionPrompts: answerable.map((q) => q.prompt),
    expectedActions: answerable.map((q) => q.expectedAction),
    rubric: inject.aiGradeRubric ?? "",
    answerBody: bodyText,
    roleLabel: roleName,
    orgPlanContext: planContext || null,
  });

  const answer = await prisma.injectAnswer.upsert({
    where: {
      sessionId_injectId_userId: {
        sessionId: id,
        injectId: inject.id,
        userId: actor.user.id,
      },
    },
    update: {
      body: bodyText,
      autoPoints: grade.autoPoints,
      pointsAwarded: grade.needsReview ? 0 : grade.autoPoints,
      needsReview: grade.needsReview,
      aiNotes: grade.aiNotes,
      gradedAt: grade.needsReview ? null : new Date(),
      overrideComment: null,
      overriddenById: null,
    },
    create: {
      sessionId: id,
      injectId: inject.id,
      userId: actor.user.id,
      playbookRoleId: seat.playbookRoleId,
      body: bodyText,
      autoPoints: grade.autoPoints,
      pointsAwarded: grade.needsReview ? 0 : grade.autoPoints,
      needsReview: grade.needsReview,
      aiNotes: grade.aiNotes,
      gradedAt: grade.needsReview ? null : new Date(),
    },
  });
  return NextResponse.json(
    stripAnswerKeys(
      {
        id: answer.id,
        sessionId: answer.sessionId,
        injectId: answer.injectId,
        userId: answer.userId,
        playbookRoleId: answer.playbookRoleId,
        body: answer.body,
        autoPoints: answer.autoPoints,
        pointsAwarded: answer.pointsAwarded,
        needsReview: answer.needsReview,
        aiNotes: answer.aiNotes,
        overrideComment: answer.overrideComment,
        createdAt: answer.createdAt,
      },
      false,
    ),
  );
}
