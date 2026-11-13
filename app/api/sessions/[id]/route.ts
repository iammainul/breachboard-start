import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageLiveSession,
  isAdmin,
  requireApiOperator,
  requireApiUserForSession,
  sessionActorDenied,
} from "@/lib/access";
import { canAccessOrganization } from "@/lib/org-scope";
import { draftRunDeleteError } from "@/lib/session-delete";
import { redactSeatsForViewer } from "@/lib/session-access";
import { seatPresence } from "@/lib/presence";
import {
  canAnswerQuestion,
  parseExerciseDocument,
  type ExerciseDocument,
} from "@/lib/schema/exercise";
import { participantQuestion } from "@/lib/participant-view";
import {
  computeParticipation,
  expectedAnswerCount,
  type TeamInfo,
} from "@/lib/participation";
import {
  applyTeamPlanToInjects,
  parseInjectTeamPlan,
} from "@/lib/inject-team-plan";
import { isSessionPhase, type SessionPhase, DISCUSS_SECONDS } from "@/lib/session-clock";
import { applyDiscussExpiry } from "@/lib/session-phase";
import { requiredRolesCoverage } from "@/lib/claim-role-invite";
import { persistSessionReport } from "@/lib/session-report";
import {
  applyPlaceholdersInInject,
  type PlaceholderContext,
} from "@/lib/scenario-placeholders";
import {
  mayRevealAnswerKeys,
  maySeeOthersAnswers,
  maySeeRosterPii,
  participantMaySeeInjectBody,
  sessionWriteDenied,
} from "@/lib/security/session-policy";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";

const sessionInclude = {
  organization: { select: { id: true, name: true } },
  exercise: {
    select: {
      id: true,
      title: true,
      durationMin: true,
      document: true,
      updatedAt: true,
      sector: true,
    },
  },
  seats: { include: { user: { select: { id: true, name: true, email: true } } } },
  teams: { include: { members: { select: { userId: true } } } },
  answers: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

function teamsPayload(
  teams: { id: string; name: string; members: { userId: string }[] }[],
): TeamInfo[] {
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    memberUserIds: t.members.map((m) => m.userId),
  }));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const poll =
    new URL(request.url).searchParams.get("poll") === "1" ||
    request.headers.get("x-poll") === "1";
  const loaded = await prisma.exerciseSession.findUnique({
    where: { id },
    include: sessionInclude,
  });
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await applyDiscussExpiry(loaded);
  const seat = session.seats.find((s) => s.userId === actor.user.id);
  if (!seat && !isAdmin(actor.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Presence heartbeat — seated clients poll this route; bump lastSeenAt.
  if (seat) {
    void prisma.sessionSeat
      .update({
        where: { id: seat.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});
  }

  const parsed = parseExerciseDocument(session.exercise.document);
  const document = parsed.success ? parsed.data : null;
  const teamPlan = parseInjectTeamPlan(session.injectTeamPlan);
  const injects = applyTeamPlanToInjects(
    document?.injects.slice().sort((a, b) => a.sequence - b.sequence) ?? [],
    teamPlan,
  );
  const current =
    injects.find((i) => i.id === session.currentInjectId) ??
    (session.status === "live" ? injects[0] : undefined);

  const teams = teamsPayload(session.teams);
  const placeholderCtx: PlaceholderContext = {
    orgName: session.organization.name,
    sector: session.exercise.sector,
    teams,
  };
  const canManage = canManageLiveSession(actor.user, seat);
  const adminUnseated = isAdmin(actor.user) && !seat;
  const revealKeys = mayRevealAnswerKeys({
    seatKind: seat?.kind,
    adminUnseated,
  });
  const canSeeRosterPii = maySeeRosterPii({
    seatKind: seat?.kind,
    adminUnseated,
  });
  const canSeeOthersAnswers = maySeeOthersAnswers({
    seatKind: seat?.kind,
    adminUnseated,
    phase: session.phase,
    status: session.status,
  });

  const participation = computeParticipation({
    userId: actor.user.id,
    seatKind: seat?.kind,
    playbookRoleId: seat?.playbookRoleId,
    teams,
    inject: current,
    isAdminViewer: isAdmin(actor.user) && !seat,
  });

  // People roster is only needed for seating UI — skip on poll to cut DB + JSON size.
  const people =
    canManage && !poll
      ? await prisma.user.findMany({
          where: {
            OR: [
              { organizationId: session.organization.id },
              {
                assignments: {
                  some: { organizationId: session.organization.id },
                },
              },
              { id: actor.user.id },
            ],
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            canFacilitate: true,
            organization: { select: { name: true } },
          },
        })
      : [];

  const visibleInject = (() => {
    if (!current) return null;
    const filled = applyPlaceholdersInInject(current, placeholderCtx);
    if (revealKeys) return summarizeInject(filled, true);
    if (!participation.canSeeInject) return null;
    return summarizeInjectForParticipant(filled, seat?.playbookRoleId);
  })();

  const answers = canSeeOthersAnswers
    ? session.answers
    : session.answers.filter((a) => a.userId === actor.user.id);

  const expected = current
    ? expectedAnswerCount(
        current,
        session.seats.map((s) => ({
          kind: s.kind,
          playbookRoleId: s.playbookRoleId,
          userId: s.user.id,
        })),
        teams,
      )
    : 0;
  const answeredOnInject = current
    ? new Set(
        session.answers.filter((a) => a.injectId === current.id).map((a) => a.userId),
      ).size
    : 0;

  const pendingSeats = current
    ? session.seats.filter((s) => {
        if (s.kind !== "PARTICIPANT") return false;
        const p = computeParticipation({
          userId: s.user.id,
          seatKind: s.kind,
          playbookRoleId: s.playbookRoleId,
          teams,
          inject: current,
        });
        return (
          p.state === "active" &&
          p.answerableQuestionKeys.length > 0 &&
          !session.answers.some(
            (a) => a.injectId === current.id && a.userId === s.user.id,
          )
        );
      })
    : [];

  const answeredSeats = current
    ? session.seats.filter(
        (s) =>
          s.kind === "PARTICIPANT" &&
          session.answers.some(
            (a) => a.injectId === current.id && a.userId === s.user.id,
          ),
      )
    : [];

  const exerciseRevision = session.exercise.updatedAt.toISOString();
  const filledRoleIds = new Set(
    session.seats
      .filter((s) => s.kind === "PARTICIPANT" && s.playbookRoleId)
      .map((s) => s.playbookRoleId as string),
  );
  const missingRoles =
    canManage && document
      ? document.roles
          .filter((role) => !filledRoleIds.has(role.id))
          .map((role) => ({ roleId: role.id, roleName: role.name }))
      : [];
  const payload = {
    id: session.id,
    joinCode: session.joinCode,
    status: session.status,
    runKind: session.runKind === "draft" ? "draft" : "engagement",
    phase: (session.phase as SessionPhase) || "idle",
    discussSeconds: DISCUSS_SECONDS,
    createdAt: session.createdAt.toISOString(),
    scheduledAt: session.scheduledAt?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    closedAt: session.closedAt?.toISOString() ?? null,
    currentInjectId: current?.id ?? session.currentInjectId,
    currentInjectStartedAt: session.currentInjectStartedAt?.toISOString() ?? null,
    organization: session.organization,
    exercise: {
      id: session.exercise.id,
      title: session.exercise.title,
      durationMin: session.exercise.durationMin,
    },
    exerciseRevision,
    roles: document?.roles ?? [],
    teams,
    // Full inject list is large; poll clients can reuse cached injects when revision matches.
    injects: poll
      ? undefined
      : revealKeys
        ? injects.map((inject) =>
            summarizeInject(applyPlaceholdersInInject(inject, placeholderCtx), true),
          )
        : injects.map((inject) => {
            const filled = applyPlaceholdersInInject(inject, placeholderCtx);
            const currentSeq = current?.sequence ?? null;
            const showBody =
              participantMaySeeInjectBody(filled.sequence, currentSeq) &&
              (filled.id !== current?.id || participation.canSeeInject);
            if (!showBody) {
              return { id: filled.id, sequence: filled.sequence };
            }
            return summarizeInjectForParticipant(filled, seat?.playbookRoleId);
          }),
    currentInject: visibleInject,
    seats: redactSeatsForViewer(
      session.seats.map((s) => {
        const lastSeenAt = s.lastSeenAt?.toISOString() ?? null;
        const isSelf = s.userId === actor.user.id;
        return {
          id: s.id,
          kind: s.kind,
          playbookRoleId: s.playbookRoleId,
          teamId: s.teamId,
          user: s.user,
          lastSeenAt,
          // Self is online if they are hitting this endpoint right now.
          presence: isSelf ? ("online" as const) : seatPresence(s.lastSeenAt),
        };
      }),
      canSeeRosterPii,
      actor.user.id,
    ),
    answers: answers.map((a) => ({
      id: a.id,
      injectId: a.injectId,
      userId: a.userId,
      userName: a.user.name,
      playbookRoleId: a.playbookRoleId,
      body: a.body,
      autoPoints: revealKeys ? a.autoPoints : a.userId === actor.user.id ? a.autoPoints : 0,
      pointsAwarded: a.pointsAwarded,
      needsReview: revealKeys ? a.needsReview : false,
      aiNotes: revealKeys ? a.aiNotes : null,
      overrideComment: revealKeys ? a.overrideComment : null,
      createdAt: a.createdAt,
    })),
    mySeat: seat
      ? {
          id: seat.id,
          kind: seat.kind,
          playbookRoleId: seat.playbookRoleId,
          teamId: seat.teamId,
        }
      : null,
    myParticipation: {
      state: participation.state,
      teamId: participation.teamId,
      canSeeInject: participation.canSeeInject,
      answerableQuestionKeys: isAdmin(actor.user)
        ? []
        : participation.answerableQuestionKeys,
    },
    injectTeamPlan: teamPlan,
    completion: current
      ? {
          answered: answeredOnInject,
          expected,
          pendingUserIds: canManage
            ? pendingSeats.map((s) => s.user.id)
            : undefined,
          pending: canManage
            ? pendingSeats.map((s) => ({
                userId: s.user.id,
                name: s.user.name,
                roleId: s.playbookRoleId,
              }))
            : undefined,
          answeredPeople: canManage
            ? answeredSeats.map((s) => ({
                userId: s.user.id,
                name: s.user.name,
                roleId: s.playbookRoleId,
              }))
            : undefined,
        }
      : null,
    isAdmin: isAdmin(actor.user),
    canManage,
    canFacilitate: Boolean(actor.user.canFacilitate),
    people,
    missingRoles,
    poll,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true, exercise: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const seat = session.seats.find((s) => s.userId === actor.user.id);
  if (!canManageLiveSession(actor.user, seat)) {
    return NextResponse.json(
      {
        error:
          "Only a seated facilitator can control this run. Admin-only accounts cannot go live.",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    status?: string;
    currentInjectId?: string | null;
    injectId?: string;
    activeTeamIds?: string[];
    phase?: string;
    scheduledAt?: string | null;
  } | null;
  const statusIntent = Boolean(body?.status);
  const terminal = sessionWriteDenied(
    session.status,
    statusIntent ? "status" : "control",
    body?.status,
  );
  if (terminal) {
    return NextResponse.json(
      { error: terminal.error, code: terminal.code },
      { status: terminal.status },
    );
  }
  const sessionWithTeams = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { teams: true, exercise: true },
  });
  if (!sessionWithTeams) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = parseExerciseDocument(sessionWithTeams.exercise.document);
  const injects = parsed.success
    ? parsed.data.injects.slice().sort((a, b) => a.sequence - b.sequence)
    : [];

  let status = session.status;
  let currentInjectId = session.currentInjectId;
  let startedAt = session.startedAt;
  let closedAt = session.closedAt;
  let phase = session.phase;
  let currentInjectStartedAt = session.currentInjectStartedAt;
  let injectTeamPlan = parseInjectTeamPlan(sessionWithTeams.injectTeamPlan);
  let scheduledAt = session.scheduledAt;

  if (body && "scheduledAt" in body) {
    if (body.scheduledAt === null || body.scheduledAt === "") {
      scheduledAt = null;
    } else if (typeof body.scheduledAt === "string") {
      const d = new Date(body.scheduledAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduledAt", code: "VALIDATION" },
          { status: 400 },
        );
      }
      scheduledAt = d;
    }
  }

  const bumpInjectClock = (injectChanged: boolean) => {
    // Each inject opens with a fixed discuss window before answers unlock.
    phase = "discuss";
    if (injectChanged || !currentInjectStartedAt) {
      currentInjectStartedAt = new Date();
    }
  };

  if (body?.status === "live") {
    if (session.status === "archived") {
      return NextResponse.json(
        { error: "Restore the engagement from Archived before going live", code: "ARCHIVED" },
        { status: 409 },
      );
    }
    status = "live";
    startedAt = startedAt ?? new Date();
    const nextInject = currentInjectId ?? injects[0]?.id ?? null;
    const injectChanged = nextInject !== currentInjectId;
    currentInjectId = nextInject;
    if (currentInjectId) bumpInjectClock(injectChanged || !session.currentInjectStartedAt);
  } else if (body?.status === "closed") {
    status = "closed";
    closedAt = closedAt ?? new Date();
    phase = "idle";
    currentInjectStartedAt = null;
  } else if (body?.status === "archived") {
    status = "archived";
    closedAt = closedAt ?? new Date();
    phase = "idle";
    currentInjectStartedAt = null;
  } else if (body?.status === "draft") {
    status = "draft";
    phase = "idle";
    currentInjectStartedAt = null;
  }

  if (body?.currentInjectId === "next") {
    const idx = injects.findIndex((i) => i.id === currentInjectId);
    const nextId = injects[idx + 1]?.id ?? currentInjectId;
    const changed = nextId !== currentInjectId;
    currentInjectId = nextId;
    status = "live";
    startedAt = startedAt ?? new Date();
    bumpInjectClock(changed);
  } else if (body?.currentInjectId) {
    if (injects.some((i) => i.id === body.currentInjectId)) {
      const changed = body.currentInjectId !== currentInjectId;
      currentInjectId = body.currentInjectId;
      // Draft runs can inspect each inject without starting clocks or
      // triggering role-readiness gates.
      if (session.status === "live") {
        status = "live";
        startedAt = startedAt ?? new Date();
        bumpInjectClock(changed);
      } else {
        status = session.status;
        phase = "idle";
        currentInjectStartedAt = null;
      }
    }
  }

  if (status === "live" && session.status !== "live") {
    // Engagements require playbook roles seated. Draft/rehearsal runs do not.
    if (session.runKind !== "draft") {
      const coverage = await requiredRolesCoverage(id);
      if (!coverage.ok) {
        return NextResponse.json(
          {
            error: `Seat required roles before going live: ${coverage.missing
              .map((m) => m.roleName)
              .join(", ")}`,
            code: "ROLES_INCOMPLETE",
            missingRoles: coverage.missing,
          },
          { status: 409 },
        );
      }
    }
  }

  if (body?.phase !== undefined) {
    if (!isSessionPhase(body.phase)) {
      return NextResponse.json(
        { error: "Invalid phase", code: "VALIDATION" },
        { status: 400 },
      );
    }
    phase = body.phase;
    if (phase === "answering") {
      // Reset the inject answer clock when discuss ends.
      currentInjectStartedAt = new Date();
    }
    if (phase === "discuss") {
      currentInjectStartedAt = new Date();
    }
    if (phase === "idle") {
      currentInjectStartedAt = null;
    }
  }

  if (body?.injectId && Array.isArray(body.activeTeamIds)) {
    if (!injects.some((i) => i.id === body.injectId)) {
      return NextResponse.json({ error: "Unknown inject" }, { status: 400 });
    }
    const teamIds = new Set(sessionWithTeams.teams.map((t) => t.id));
    injectTeamPlan = {
      ...injectTeamPlan,
      [body.injectId]: body.activeTeamIds.filter((tid) => teamIds.has(tid)),
    };
  }

  const updated = await prisma.exerciseSession.update({
    where: { id },
    data: {
      status,
      currentInjectId,
      startedAt,
      closedAt,
      phase,
      currentInjectStartedAt,
      injectTeamPlan,
      scheduledAt,
    },
  });

  const closing = status === "closed" && session.status !== "closed";
  const archivingBare =
    status === "archived" && session.status !== "archived" && !session.reportSnapshot;
  if (closing || archivingBare) {
    try {
      await persistSessionReport(id);
    } catch {
      // Run is already closed; report can be generated from the after-action page.
    }
    try {
      const { softDeleteForClosedSession } = await import(
        "@/lib/documents/lifecycle"
      );
      await softDeleteForClosedSession({
        sessionId: id,
        organizationId: session.organizationId,
        runKind: session.runKind,
        actorId: actor.user.id,
      });
    } catch {
      // Close still succeeds; admin uploads page can soft-delete manually.
    }
  }

  return NextResponse.json(updated);
}

function summarizeInject(
  inject: ExerciseDocument["injects"][number],
  revealKey: boolean,
) {
  return {
    id: inject.id,
    sequence: inject.sequence,
    title: inject.title,
    body: inject.body,
    timerSeconds: inject.timerSeconds,
    techniqueIds: inject.techniqueIds,
    activeTeamIds: inject.activeTeamIds ?? [],
    mediaPrompts: inject.mediaPrompts ?? [],
    /** Facilitator-only CISA scoring criteria for this inject. */
    aiGradeRubric: revealKey ? inject.aiGradeRubric : undefined,
    questions: revealKey
      ? inject.questions
      : inject.questions.map((q) => participantQuestion(q)),
  };
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiOperator();
  if ("error" in actor) return actor.error;
  const locked = sessionActorDenied(actor.user, id);
  if (locked) return locked;
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    select: { id: true, runKind: true, organizationId: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const blocked = draftRunDeleteError(session);
  if (blocked) {
    return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  }
  if (!(await canAccessOrganization(actor.user, session.organizationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.exerciseSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function summarizeInjectForParticipant(
  inject: ExerciseDocument["injects"][number],
  playbookRoleId?: string | null,
) {
  return {
    id: inject.id,
    sequence: inject.sequence,
    title: inject.title,
    body: inject.body,
    timerSeconds: inject.timerSeconds,
    techniqueIds: inject.techniqueIds,
    activeTeamIds: inject.activeTeamIds ?? [],
    mediaPrompts: (inject.mediaPrompts ?? []).filter((m) => m.assetPath),
    questions: inject.questions.map((q) => ({
      ...participantQuestion(q),
      canAnswer: canAnswerQuestion(q, playbookRoleId),
    })),
  };
}

