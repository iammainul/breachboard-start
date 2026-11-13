import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageLiveSession, requireApiUserForSession } from "@/lib/access";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { forbidTerminalSessionWrite, loadSessionForActor } from "@/lib/session-access";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const membersSchema = z.object({
  userIds: z.array(z.string().min(1)),
});

async function loadSession(id: string) {
  return prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      seats: true,
      teams: { include: { members: true } },
    },
  });
}

function forbidUnlessFacilitator(
  user: { id: string; platformRole: string; canFacilitate: boolean },
  seats: { userId: string; kind: string }[],
  status?: string,
) {
  const frozen = status
    ? forbidTerminalSessionWrite(status, "roster")
    : null;
  if (frozen) return frozen;
  const seat = seats.find((s) => s.userId === user.id);
  if (!canManageLiveSession(user, seat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const loaded = await loadSessionForActor(id, actor.user);
  if ("error" in loaded) return loaded.error;
  return NextResponse.json({
    teams: loaded.session.teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberUserIds: t.members.map((m) => m.userId),
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = forbidUnlessFacilitator(actor.user, session.seats, session.status);
  if (denied) return denied;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  try {
    const team = await prisma.sessionTeam.create({
      data: { sessionId: id, name: parsed.data.name },
    });
    return NextResponse.json(team);
  } catch {
    return NextResponse.json({ error: "Team name already used" }, { status: 409 });
  }
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
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = forbidUnlessFacilitator(actor.user, session.seats, session.status);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as {
    teamId?: string;
    name?: string;
    userIds?: string[];
  } | null;

  if (!body?.teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }
  const team = session.teams.find((t) => t.id === body.teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (typeof body.name === "string" && body.name.trim()) {
    await prisma.sessionTeam.update({
      where: { id: team.id },
      data: { name: body.name.trim() },
    });
  }

  if (Array.isArray(body.userIds)) {
    const members = membersSchema.safeParse({ userIds: body.userIds });
    if (!members.success) {
      return NextResponse.json({ error: "Invalid members" }, { status: 400 });
    }
    const seatedIds = new Set(
      session.seats.filter((s) => s.kind === "PARTICIPANT").map((s) => s.userId),
    );
    const userIds = members.data.userIds.filter((uid) => seatedIds.has(uid));

    await prisma.$transaction(async (tx) => {
      // One team per user per session: remove from other teams on this session
      const otherTeams = session.teams.filter((t) => t.id !== team.id);
      for (const other of otherTeams) {
        await tx.sessionTeamMember.deleteMany({
          where: { teamId: other.id, userId: { in: userIds } },
        });
      }
      await tx.sessionTeamMember.deleteMany({ where: { teamId: team.id } });
      if (userIds.length) {
        await tx.sessionTeamMember.createMany({
          data: userIds.map((userId) => ({ teamId: team.id, userId })),
        });
      }
      await tx.sessionSeat.updateMany({
        where: { sessionId: id, userId: { in: userIds } },
        data: { teamId: team.id },
      });
      // Clear teamId for participants removed from this team and not in userIds
      const previous = team.members.map((m) => m.userId);
      const removed = previous.filter((uid) => !userIds.includes(uid));
      if (removed.length) {
        await tx.sessionSeat.updateMany({
          where: { sessionId: id, userId: { in: removed }, teamId: team.id },
          data: { teamId: null },
        });
      }
    });
  }

  const refreshed = await loadSession(id);
  return NextResponse.json({
    teams: refreshed?.teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberUserIds: t.members.map((m) => m.userId),
    })),
  });
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
  const teamId = new URL(request.url).searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = forbidUnlessFacilitator(actor.user, session.seats, session.status);
  if (denied) return denied;
  if (!session.teams.some((t) => t.id === teamId)) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  await prisma.$transaction([
    prisma.sessionSeat.updateMany({
      where: { sessionId: id, teamId },
      data: { teamId: null },
    }),
    prisma.sessionTeam.delete({ where: { id: teamId } }),
  ]);
  return NextResponse.json({ ok: true });
}
