import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, isDeskOperator, requireApiOperator, requireApiUser } from "@/lib/access";
import { makeJoinCode } from "@/lib/join-code";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { resolveAssignmentHint } from "@/lib/role-assignment";
import { canAccessOrganization, listVisibleOrganizations } from "@/lib/org-scope";

const createSchema = z.object({
  organizationId: z.string().min(1),
  exerciseId: z.string().min(1),
  /** draft = rehearsal / QA · engagement = real facilitated run */
  runKind: z.enum(["draft", "engagement"]).optional().default("engagement"),
  /** Planned facilitation datetime (from datetime-local or ISO). */
  scheduledAt: z.string().min(1).optional(),
});

export async function GET() {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const orgFilter = actor.user.activitySessionId
    ? {
        id: actor.user.activitySessionId,
        seats: { some: { userId: actor.user.id } },
      }
    : isAdmin(actor.user)
    ? undefined
    : isDeskOperator(actor.user)
      ? {
          organizationId: {
            in: (await listVisibleOrganizations(actor.user)).map((org) => org.id),
          },
        }
      : { seats: { some: { userId: actor.user.id } } };
  const sessions = await prisma.exerciseSession.findMany({
    where: orgFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      organization: true,
      exercise: { select: { id: true, title: true, durationMin: true } },
      _count: { select: { seats: true } },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const actor = await requireApiOperator();
  if ("error" in actor) return actor.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid run" }, { status: 400 });
  }
  if (!(await canAccessOrganization(actor.user, parsed.data.organizationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [org, exercise, activityPlayers] = await Promise.all([
    prisma.organization.findUnique({ where: { id: parsed.data.organizationId } }),
    prisma.exercise.findUnique({
      where: { id: parsed.data.exerciseId },
      include: { clients: { select: { organizationId: true } } },
    }),
    prisma.user.findMany({
      where: {
        organizationId: parsed.data.organizationId,
        platformRole: "USER",
        canFacilitate: false,
        passwordHash: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        preferredRole: true,
        preferredTeam: true,
      },
    }),
  ]);
  if (!org || !exercise) {
    return NextResponse.json({ error: "Org or scenario not found" }, { status: 404 });
  }
  if (exercise.isTemplate || exercise.status === "retired") {
    return NextResponse.json(
      { error: "That scenario is not available to run" },
      { status: 400 },
    );
  }
  if (parsed.data.runKind === "engagement" && exercise.status !== "accepted") {
    return NextResponse.json(
      {
        error:
          "Engagements launch from an accepted scenario. Accept the pack for this organization first.",
        code: "SCENARIO_NOT_ACCEPTED",
      },
      { status: 400 },
    );
  }
  if (parsed.data.runKind === "engagement") {
    const linked =
      exercise.organizationId === org.id ||
      exercise.clients.some((row) => row.organizationId === org.id);
    if (!linked) {
      return NextResponse.json(
        {
          error: "Link this accepted pack to the client before launching an engagement.",
          code: "SCENARIO_NOT_LINKED",
        },
        { status: 400 },
      );
    }
  }
  let joinCode = makeJoinCode();
  for (let i = 0; i < 6; i += 1) {
    const clash = await prisma.exerciseSession.findUnique({ where: { joinCode } });
    if (!clash) break;
    joinCode = makeJoinCode();
  }

  const doc = parseExerciseDocument(exercise.document);
  const teamDefs =
    doc.success && Array.isArray(doc.data.teamDefinitions)
      ? doc.data.teamDefinitions.slice(0, 8)
      : [];

  const scheduledAt = (() => {
    if (!parsed.data.scheduledAt) return null;
    const d = new Date(parsed.data.scheduledAt);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  const session = await prisma.exerciseSession.create({
    data: {
      joinCode,
      organizationId: org.id,
      exerciseId: exercise.id,
      status: "draft",
      runKind: parsed.data.runKind,
      scheduledAt,
      ...(actor.user.canFacilitate
        ? {
            seats: {
              create: {
                userId: actor.user.id,
                kind: "MODERATOR",
              },
            },
          }
        : {}),
      ...(teamDefs.length > 0
        ? {
            teams: {
              create: teamDefs.map((team) => ({
                name: team.name.slice(0, 64),
              })),
            },
          }
        : {}),
    },
    include: { teams: true },
  });

  if (doc.success) {
    const roles = doc.data.roles;
    const takenRoleIds = new Set<string>();

    if (activityPlayers.length > 0) {
      await prisma.sessionRoleInvite.createMany({
        data: activityPlayers.map((player) => {
          const role = resolveAssignmentHint(player.preferredRole, roles);
          if (role) takenRoleIds.add(role.id);
          const team = resolveAssignmentHint(player.preferredTeam, session.teams);
          const ready = Boolean(
            role && (session.teams.length === 0 || team),
          );
          return {
            sessionId: session.id,
            recipientEmail: player.email.trim().toLowerCase(),
            recipientName: player.name,
            playbookRoleId: role?.id ?? null,
            teamId: team?.id ?? null,
            status: ready ? "READY" : "ALLOCATED",
            createdByUserId: actor.user.id,
          };
        }),
      });
    }

    // Pre-populate remaining scenario roles as empty invite slots so the
    // Invites dock is ready without requiring a full seated squad.
    const missingRoles = roles.filter((role) => !takenRoleIds.has(role.id));
    if (missingRoles.length > 0) {
      await prisma.sessionRoleInvite.createMany({
        data: missingRoles.map((role) => ({
          sessionId: session.id,
          playbookRoleId: role.id,
          status: "ALLOCATED",
          createdByUserId: actor.user.id,
        })),
      });
    }
  }
  return NextResponse.json(session);
}
