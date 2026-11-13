import { z } from "zod";
import { NextResponse } from "next/server";
import { getActor, isAdmin } from "@/lib/access";
import { claimRoleInvite } from "@/lib/claim-role-invite";
import { randomBytes } from "node:crypto";
import { mintGuestJoinToken } from "@/lib/guest-join-token";
import { prisma } from "@/lib/prisma";
import { guestActivityDenied, joinDenied } from "@/lib/security/session-policy";
import {
  denyCrossSiteMutation,
  enforceRateLimit,
} from "@/lib/security/api-guard";
import { normalizeJoinCode } from "@/lib/security/auth-rate-limit";

const bodySchema = z.object({
  code: z.string().min(4).max(12),
  /** Display name required for squad join without a role card. */
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  /** One-time role card from the facilitator — binds playbook role server-side. */
  roleToken: z.string().min(32).max(256).optional(),
});

export async function POST(request: Request) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const limited = enforceRateLimit(request, "joinIp");
    if (limited) return limited;
    return NextResponse.json({ error: "Join code required" }, { status: 400 });
  }

  const code = normalizeJoinCode(parsed.data.code);
  const perCode = enforceRateLimit(request, "join", code);
  if (perCode) return perCode;
  const perIp = enforceRateLimit(request, "joinIp");
  if (perIp) return perIp;

  const actor = await getActor();
  const roleToken = parsed.data.roleToken?.trim();
  const displayName = parsed.data.name?.trim();
  const emailInput = parsed.data.email?.trim().toLowerCase();

  const session = await prisma.exerciseSession.findUnique({
    where: { joinCode: code },
    include: {
      seats: true,
      exercise: { select: { id: true, title: true } },
      organization: { select: { name: true } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Unknown join code" }, { status: 404 });
  }
  const closed = joinDenied(session.status);
  if (closed) {
    return NextResponse.json(
      { error: closed.error, code: closed.code },
      { status: closed.status },
    );
  }
  const hop = guestActivityDenied(actor?.activitySessionId, session.id);
  if (hop) {
    return NextResponse.json(
      { error: hop.error, code: hop.code },
      { status: hop.status },
    );
  }

  // --- Guest path (no session cookie yet) ---
  if (!actor) {
    if (!displayName) {
      return NextResponse.json(
        { error: "Enter your name to join the squad", code: "NAME_REQUIRED" },
        { status: 400 },
      );
    }
    if (roleToken) {
      return NextResponse.json(
        {
          error:
            "Sign in or open your invitation link to claim a role card. Or join by name without a card.",
          code: "AUTH_REQUIRED_FOR_ROLE",
        },
        { status: 401 },
      );
    }

    const email =
      emailInput ||
      `guest+${randomBytes(8).toString("hex")}@join.local`;

    if (emailInput) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.passwordHash) {
        return NextResponse.json(
          {
            error: "That email already has an account — sign in, then join.",
            code: "ACCOUNT_EXISTS",
          },
          { status: 409 },
        );
      }
    }

    const user =
      (emailInput
        ? await prisma.user.findUnique({ where: { email } })
        : null) ??
      (await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: null,
          platformRole: "USER",
          canFacilitate: false,
          organizationId: session.organizationId,
        },
      }));

    if (user.name !== displayName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: displayName },
      });
    }

    let seat = await prisma.sessionSeat.findUnique({
      where: {
        sessionId_userId: { sessionId: session.id, userId: user.id },
      },
    });
    if (!seat) {
      seat = await prisma.sessionSeat.create({
        data: {
          sessionId: session.id,
          userId: user.id,
          kind: "PARTICIPANT",
          playbookRoleId: null,
        },
      });
    }

    const guestToken = mintGuestJoinToken(user.id, session.id);
    return NextResponse.json({
      sessionId: session.id,
      seatId: seat.id,
      kind: seat.kind,
      playbookRoleId: seat.playbookRoleId,
      needsRole: false,
      guestToken,
      title: session.exercise.title,
      organization: session.organization.name,
      joinCode: session.joinCode,
    });
  }

  // --- Authenticated path ---
  if (displayName && displayName !== actor.name) {
    await prisma.user.update({
      where: { id: actor.id },
      data: { name: displayName },
    });
  }

  if (isAdmin(actor)) {
    return NextResponse.json({
      sessionId: session.id,
      seatId: null,
      kind: null,
      playbookRoleId: null,
      needsRole: false,
      adminView: true,
      title: session.exercise.title,
      organization: session.organization.name,
      joinCode: session.joinCode,
    });
  }

  const existing = session.seats.find((s) => s.userId === actor.id);

  if (roleToken) {
    const claimed = await claimRoleInvite({
      sessionId: session.id,
      userId: actor.id,
      token: roleToken,
    });
    if (!claimed.ok) {
      return NextResponse.json(
        { error: claimed.error },
        { status: claimed.status },
      );
    }
    return NextResponse.json({
      sessionId: session.id,
      seatId: claimed.seatId,
      kind: "PARTICIPANT",
      playbookRoleId: claimed.playbookRoleId,
      needsRole: false,
      title: session.exercise.title,
      organization: session.organization.name,
      joinCode: session.joinCode,
    });
  }

  if (existing) {
    return NextResponse.json({
      sessionId: session.id,
      seatId: existing.id,
      kind: existing.kind,
      playbookRoleId: existing.playbookRoleId,
      needsRole: false,
      title: session.exercise.title,
      organization: session.organization.name,
      joinCode: session.joinCode,
    });
  }

  if (!displayName && !actor.name?.trim()) {
    return NextResponse.json(
      { error: "Enter your name to join the squad", code: "NAME_REQUIRED" },
      { status: 400 },
    );
  }

  const seat = await prisma.sessionSeat.create({
    data: {
      sessionId: session.id,
      userId: actor.id,
      kind: "PARTICIPANT",
      playbookRoleId: null,
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    seatId: seat.id,
    kind: seat.kind,
    playbookRoleId: null,
    needsRole: false,
    title: session.exercise.title,
    organization: session.organization.name,
    joinCode: session.joinCode,
  });
}
