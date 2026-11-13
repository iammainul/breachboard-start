import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageLiveSession, requireApiUserForSession } from "@/lib/access";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import {
  hashRoleToken,
  makeRoleToken,
  roleTokenHint,
} from "@/lib/role-invite-token";
import { roleInviteLink } from "@/lib/role-invite";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { forbidTerminalSessionWrite } from "@/lib/session-access";

const ACTIVE_STATES = ["ALLOCATED", "READY", "SENT"];
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

const createSchema = z.object({
  playbookRoleId: z.string().min(1).nullable().optional(),
  teamId: z.string().optional().nullable(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(120).optional(),
  ensureAll: z.boolean().optional(),
});

const updateSchema = z.object({
  inviteId: z.string().min(1),
  action: z.enum(["update", "issue"]).default("update"),
  playbookRoleId: z.string().min(1).nullable().optional(),
  teamId: z.string().nullable().optional(),
  recipientEmail: z.string().email().nullable().optional(),
  recipientName: z.string().max(120).nullable().optional(),
});

async function manageableSession(id: string, user: { id: string; platformRole: string }) {
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      seats: true,
      teams: true,
      exercise: { select: { document: true, title: true } },
      roleInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) return { error: "Not found", status: 404 } as const;
  const mySeat = session.seats.find((seat) => seat.userId === user.id);
  if (!canManageLiveSession(user, mySeat)) {
    return { error: "Forbidden", status: 403 } as const;
  }
  const document = parseExerciseDocument(session.exercise.document);
  if (!document.success) {
    return { error: "Scenario unreadable", status: 500 } as const;
  }
  return { session, roles: document.data.roles } as const;
}

function normalizedEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function readyForToken(
  invite: {
    recipientEmail: string | null;
    playbookRoleId: string | null;
    teamId: string | null;
  },
  hasTeams: boolean,
) {
  return Boolean(
    invite.recipientEmail && invite.playbookRoleId && (!hasTeams || invite.teamId),
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const result = await manageableSession(id, actor.user);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { session, roles } = result;

  // Existing short plaintext tokens are invalidated instead of being exposed again.
  await prisma.sessionRoleInvite.updateMany({
    where: {
      sessionId: id,
      token: { not: null },
      tokenHash: null,
      claimedAt: null,
      status: { notIn: ["REVOKED", "EXPIRED"] },
    },
    data: { token: null, status: "ALLOCATED" },
  });

  const claimers = session.roleInvites
    .map((invite) => invite.claimedByUserId)
    .filter((userId): userId is string => Boolean(userId));
  const users = claimers.length
    ? await prisma.user.findMany({
        where: { id: { in: claimers } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const teamById = new Map(session.teams.map((team) => [team.id, team.name]));

  const invites = session.roleInvites.map((invite) => ({
    id: invite.id,
    playbookRoleId: invite.playbookRoleId,
    roleName:
      roles.find((role) => role.id === invite.playbookRoleId)?.name ??
      "Role not assigned",
    teamId: invite.teamId,
    teamName: invite.teamId ? teamById.get(invite.teamId) ?? null : null,
    recipientEmail: invite.recipientEmail,
    recipientName: invite.recipientName,
    status:
      invite.expiresAt && invite.expiresAt < new Date() && !invite.claimedAt
        ? "EXPIRED"
        : invite.status,
    tokenHint: invite.tokenHint,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    sentAt: invite.sentAt?.toISOString() ?? null,
    lastSentAt: invite.lastSentAt?.toISOString() ?? null,
    deliveryError: invite.deliveryError,
    claimedAt: invite.claimedAt?.toISOString() ?? null,
    claimedBy: invite.claimedByUserId
      ? userById.get(invite.claimedByUserId) ?? null
      : null,
    ready: readyForToken(invite, session.teams.length > 0),
    createdAt: invite.createdAt.toISOString(),
  }));

  const filledRoleIds = new Set(
    session.seats
      .filter((seat) => seat.kind === "PARTICIPANT" && seat.playbookRoleId)
      .map((seat) => seat.playbookRoleId as string),
  );
  const coverage = roles.map((role) => ({
    roleId: role.id,
    roleName: role.name,
    filled: filledRoleIds.has(role.id),
    configured: invites.some(
      (invite) =>
        invite.playbookRoleId === role.id &&
        ACTIVE_STATES.includes(invite.status),
    ),
  }));

  return NextResponse.json({
    invites,
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
    teams: session.teams.map((team) => ({ id: team.id, name: team.name })),
    coverage,
    allRolesFilled: coverage.length > 0 && coverage.every((item) => item.filled),
    allRolesConfigured:
      coverage.length > 0 &&
      coverage.every((item) => item.filled || item.configured),
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
  const result = await manageableSession(id, actor.user);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const frozen = forbidTerminalSessionWrite(result.session.status, "invite");
  if (frozen) return frozen;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation slot" }, { status: 400 });
  }
  const { session, roles } = result;
  const teamId = parsed.data.teamId || null;
  if (teamId && !session.teams.some((team) => team.id === teamId)) {
    return NextResponse.json({ error: "Unknown squad" }, { status: 400 });
  }

  const roleIds = parsed.data.ensureAll
    ? roles
        .filter(
          (role) =>
            !session.seats.some(
              (seat) =>
                seat.kind === "PARTICIPANT" &&
                seat.playbookRoleId === role.id,
            ) &&
            !session.roleInvites.some(
              (invite) =>
                invite.playbookRoleId === role.id &&
                ACTIVE_STATES.includes(invite.status),
            ),
        )
        .map((role) => role.id)
    : parsed.data.playbookRoleId
      ? [parsed.data.playbookRoleId]
      : parsed.data.ensureAll
        ? []
        : [null];
  if (
    roleIds.some(
      (roleId) => roleId && !roles.some((role) => role.id === roleId),
    )
  ) {
    return NextResponse.json({ error: "Unknown scenario role" }, { status: 400 });
  }

  const email = normalizedEmail(parsed.data.recipientEmail);
  if (
    email &&
    session.roleInvites.some(
      (invite) =>
        invite.recipientEmail === email && ACTIVE_STATES.includes(invite.status),
    )
  ) {
    return NextResponse.json(
      { error: "This recipient already has an active assignment" },
      { status: 409 },
    );
  }

  for (const playbookRoleId of roleIds) {
    await prisma.sessionRoleInvite.create({
      data: {
        sessionId: id,
        playbookRoleId,
        teamId,
        recipientEmail: email,
        recipientName: parsed.data.recipientName?.trim() || null,
        status: email && (!session.teams.length || teamId) ? "READY" : "ALLOCATED",
        createdByUserId: actor.user.id,
      },
    });
  }
  return NextResponse.json({ created: roleIds.length });
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
  const result = await manageableSession(id, actor.user);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const frozen = forbidTerminalSessionWrite(result.session.status, "invite");
  if (frozen) return frozen;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation update" }, { status: 400 });
  }
  const { session, roles } = result;
  const invite = session.roleInvites.find((item) => item.id === parsed.data.inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invite.claimedAt || invite.status === "REVOKED") {
    return NextResponse.json(
      { error: "Claimed or revoked invitations cannot be changed" },
      { status: 409 },
    );
  }

  const playbookRoleId =
    parsed.data.playbookRoleId === undefined
      ? invite.playbookRoleId
      : parsed.data.playbookRoleId;
  const teamId =
    parsed.data.teamId === undefined ? invite.teamId : parsed.data.teamId || null;
  const recipientEmail =
    parsed.data.recipientEmail === undefined
      ? invite.recipientEmail
      : normalizedEmail(parsed.data.recipientEmail);
  const recipientName =
    parsed.data.recipientName === undefined
      ? invite.recipientName
      : parsed.data.recipientName?.trim() || null;
  if (
    playbookRoleId &&
    !roles.some((role) => role.id === playbookRoleId)
  ) {
    return NextResponse.json({ error: "Unknown scenario role" }, { status: 400 });
  }
  if (teamId && !session.teams.some((team) => team.id === teamId)) {
    return NextResponse.json({ error: "Unknown squad" }, { status: 400 });
  }
  if (
    recipientEmail &&
    session.roleInvites.some(
      (item) =>
        item.id !== invite.id &&
        item.recipientEmail === recipientEmail &&
        ACTIVE_STATES.includes(item.status),
    )
  ) {
    return NextResponse.json(
      { error: "This recipient already has an active assignment" },
      { status: 409 },
    );
  }
  const candidate = { recipientEmail, playbookRoleId, teamId };
  if (parsed.data.action === "issue") {
    if (!readyForToken(candidate, session.teams.length > 0)) {
      return NextResponse.json(
        { error: "Recipient, role, and squad must be complete first" },
        { status: 409 },
      );
    }
    const token = makeRoleToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await prisma.sessionRoleInvite.update({
      where: { id: invite.id },
      data: {
        recipientEmail,
        recipientName,
        playbookRoleId,
        teamId,
        token: null,
        tokenHash: hashRoleToken(token),
        tokenHint: roleTokenHint(token),
        expiresAt,
        status: "READY",
        deliveryError: null,
      },
    });
    return NextResponse.json({
      link: roleInviteLink(new URL(request.url).origin, token),
      expiresAt: expiresAt.toISOString(),
    });
  }

  const bindingChanged =
    invite.recipientEmail !== recipientEmail ||
    invite.recipientName !== recipientName ||
    invite.playbookRoleId !== playbookRoleId ||
    invite.teamId !== teamId;
  await prisma.sessionRoleInvite.update({
    where: { id: invite.id },
    data: {
      recipientEmail,
      recipientName,
      playbookRoleId,
      teamId,
      ...(bindingChanged
        ? {
            token: null,
            tokenHash: null,
            tokenHint: null,
            expiresAt: null,
            sentAt: null,
            lastSentAt: null,
            deliveryError: null,
          }
        : {}),
      status: readyForToken(candidate, session.teams.length > 0)
        ? "READY"
        : "ALLOCATED",
    },
  });
  return NextResponse.json({ ok: true, tokenRotated: bindingChanged });
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
  const result = await manageableSession(id, actor.user);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const frozen = forbidTerminalSessionWrite(result.session.status, "invite");
  if (frozen) return frozen;
  const inviteId = new URL(request.url).searchParams.get("inviteId");
  const invite = result.session.roleInvites.find((item) => item.id === inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invite.claimedAt) {
    return NextResponse.json(
      { error: "A claimed invitation cannot be revoked" },
      { status: 409 },
    );
  }
  await prisma.sessionRoleInvite.update({
    where: { id: invite.id },
    data: {
      status: "REVOKED",
      token: null,
      tokenHash: null,
      expiresAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
