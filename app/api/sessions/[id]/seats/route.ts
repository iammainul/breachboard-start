import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canBeSeatedAsFacilitator,
  canManageLiveSession,
  requireApiUserForSession,
} from "@/lib/access";
import { canAccessOrganization } from "@/lib/org-scope";
import { seatKindSchema, parseExerciseDocument } from "@/lib/schema/exercise";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { forbidTerminalSessionWrite } from "@/lib/session-access";
import {
  claimSelfModeratorDenied,
  seatDeleteTarget,
} from "@/lib/security/session-policy";

const createSchema = z.object({
  userId: z.string().min(1).optional(),
  kind: seatKindSchema,
  playbookRoleId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  claimSelf: z.boolean().optional(),
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
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true, exercise: true, teams: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const frozen = forbidTerminalSessionWrite(session.status, "roster");
  if (frozen) return frozen;
  const mySeat = session.seats.find((s) => s.userId === actor.user.id);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid seat" }, { status: 400 });
  }

  const claimingSelf =
    parsed.data.claimSelf === true && parsed.data.kind === "MODERATOR";

  if (claimingSelf) {
    const orgAccess = await canAccessOrganization(
      actor.user,
      session.organizationId,
    );
    const denied = claimSelfModeratorDenied({
      canFacilitate: canBeSeatedAsFacilitator(actor.user),
      orgAccess,
    });
    if (denied) {
      return NextResponse.json(
        { error: denied.error, code: denied.code },
        { status: denied.status },
      );
    }
  } else if (!canManageLiveSession(actor.user, mySeat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUserId = claimingSelf
    ? actor.user.id
    : parsed.data.userId;
  if (!targetUserId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (parsed.data.kind === "MODERATOR" && !canBeSeatedAsFacilitator(user)) {
    return NextResponse.json(
      {
        error:
          "That person is not marked as a facilitator. Enable “Can facilitate” on their account first.",
      },
      { status: 400 },
    );
  }
  if (parsed.data.kind === "PARTICIPANT" && parsed.data.playbookRoleId === undefined) {
    // null/omitted playbook role = squad member without a specific role — allowed
  }
  if (parsed.data.playbookRoleId) {
    const doc = parseExerciseDocument(session.exercise.document);
    if (
      doc.success &&
      !doc.data.roles.some((role) => role.id === parsed.data.playbookRoleId)
    ) {
      return NextResponse.json({ error: "Unknown playbook role" }, { status: 400 });
    }
    const roleTaken = session.seats.some(
      (seat) =>
        seat.userId !== targetUserId &&
        seat.kind === "PARTICIPANT" &&
        seat.playbookRoleId === parsed.data.playbookRoleId,
    );
    if (roleTaken) {
      return NextResponse.json(
        { error: "That playbook role is already seated. Revoke the seat first." },
        { status: 409 },
      );
    }
  }
  const teamId =
    parsed.data.kind === "PARTICIPANT" ? parsed.data.teamId || null : null;
  if (teamId && !session.teams.some((t) => t.id === teamId)) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }

  const seat = await prisma.$transaction(async (tx) => {
    const next = await tx.sessionSeat.upsert({
      where: { sessionId_userId: { sessionId: id, userId: user.id } },
      update: {
        kind: parsed.data.kind,
        playbookRoleId:
          parsed.data.kind === "PARTICIPANT"
            ? parsed.data.playbookRoleId ?? null
            : null,
        teamId,
      },
      create: {
        sessionId: id,
        userId: user.id,
        kind: parsed.data.kind,
        playbookRoleId:
          parsed.data.kind === "PARTICIPANT"
            ? parsed.data.playbookRoleId ?? null
            : null,
        teamId,
      },
    });
    if (teamId && parsed.data.kind === "PARTICIPANT") {
      const otherTeams = session.teams.filter((t) => t.id !== teamId);
      for (const other of otherTeams) {
        await tx.sessionTeamMember.deleteMany({
          where: { teamId: other.id, userId: user.id },
        });
      }
      await tx.sessionTeamMember.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        update: {},
        create: { teamId, userId: user.id },
      });
    }
    return next;
  });
  return NextResponse.json(seat);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const seatId = new URL(request.url).searchParams.get("seatId");
  if (!seatId) {
    return NextResponse.json({ error: "seatId required" }, { status: 400 });
  }
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const frozen = forbidTerminalSessionWrite(session.status, "roster");
  if (frozen) return frozen;
  const mySeat = session.seats.find((s) => s.userId === actor.user.id);
  if (!canManageLiveSession(actor.user, mySeat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const missing = seatDeleteTarget(
    session.seats.map((s) => s.id),
    seatId,
  );
  if (missing) {
    return NextResponse.json({ error: missing.error }, { status: missing.status });
  }
  const target = session.seats.find((s) => s.id === seatId);
  if (target) {
    await prisma.sessionTeamMember.deleteMany({
      where: {
        userId: target.userId,
        team: { sessionId: id },
      },
    });
  }
  await prisma.sessionSeat.delete({ where: { id: seatId } });
  return NextResponse.json({ ok: true });
}
