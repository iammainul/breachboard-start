import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { hashRoleToken } from "@/lib/role-invite-token";

const GENERIC_FAILURE = {
  ok: false as const,
  error: "This invitation is invalid or no longer available",
  status: 400,
};

type PasswordlessClaimResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string;
        platformRole: string;
        organizationId: string | null;
      };
      sessionId: string;
      activityExpiresAt: number;
    }
  | typeof GENERIC_FAILURE;

/**
 * Consumes a hashed invite only after an explicit POST/Auth.js authorize call.
 * Recipient, scenario role, and squad always come from the database.
 */
export async function claimPasswordlessInvite(
  rawToken: string,
  expectedUserId?: string,
): Promise<PasswordlessClaimResult> {
  const token = rawToken.trim();
  if (token.length < 32) return GENERIC_FAILURE;
  const tokenHash = hashRoleToken(token);
  const now = new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const invite = await tx.sessionRoleInvite.findUnique({
          where: { tokenHash },
          include: { session: true },
        });
        if (
          !invite ||
          !invite.recipientEmail ||
          !invite.playbookRoleId ||
          !invite.expiresAt ||
          invite.expiresAt <= now ||
          invite.claimedAt ||
          !["READY", "SENT"].includes(invite.status) ||
          invite.session.status === "closed" ||
          invite.session.status === "archived"
        ) {
          return GENERIC_FAILURE;
        }

        if (invite.teamId) {
          const team = await tx.sessionTeam.findFirst({
            where: { id: invite.teamId, sessionId: invite.sessionId },
          });
          if (!team) return GENERIC_FAILURE;
        }

        const email = invite.recipientEmail.trim().toLowerCase();
        let user = await tx.user.findUnique({ where: { email } });
        if (expectedUserId && user?.id !== expectedUserId) {
          return GENERIC_FAILURE;
        }
        if (!user) {
          if (expectedUserId) return GENERIC_FAILURE;
          user = await tx.user.create({
            data: {
              email,
              name: invite.recipientName?.trim() || email.split("@")[0],
              passwordHash: null,
              platformRole: "USER",
              canFacilitate: false,
              organizationId: invite.session.organizationId,
            },
          });
        }

        const existing = await tx.sessionSeat.findUnique({
          where: {
            sessionId_userId: {
              sessionId: invite.sessionId,
              userId: user.id,
            },
          },
        });
        if (
          existing &&
          (existing.kind !== "PARTICIPANT" ||
            (existing.playbookRoleId &&
              existing.playbookRoleId !== invite.playbookRoleId))
        ) {
          return GENERIC_FAILURE;
        }

        const claimed = await tx.sessionRoleInvite.updateMany({
          where: {
            id: invite.id,
            tokenHash,
            claimedAt: null,
            status: { in: ["READY", "SENT"] },
            expiresAt: { gt: now },
          },
          data: {
            claimedByUserId: user.id,
            claimedAt: now,
            status: "CLAIMED",
            deliveryError: null,
          },
        });
        if (claimed.count !== 1) return GENERIC_FAILURE;

        await tx.sessionSeat.upsert({
          where: {
            sessionId_userId: {
              sessionId: invite.sessionId,
              userId: user.id,
            },
          },
          update: {
            kind: "PARTICIPANT",
            playbookRoleId: invite.playbookRoleId,
            teamId: invite.teamId,
          },
          create: {
            sessionId: invite.sessionId,
            userId: user.id,
            kind: "PARTICIPANT",
            playbookRoleId: invite.playbookRoleId,
            teamId: invite.teamId,
          },
        });

        if (invite.teamId) {
          await tx.sessionTeamMember.deleteMany({
            where: {
              userId: user.id,
              team: {
                sessionId: invite.sessionId,
                id: { not: invite.teamId },
              },
            },
          });
          await tx.sessionTeamMember.upsert({
            where: {
              teamId_userId: { teamId: invite.teamId, userId: user.id },
            },
            update: {},
            create: { teamId: invite.teamId, userId: user.id },
          });
        }

        return {
          ok: true as const,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            platformRole: user.platformRole,
            organizationId: user.organizationId,
          },
          sessionId: invite.sessionId,
          activityExpiresAt: Math.min(
            invite.expiresAt.getTime(),
            Date.now() + 12 * 60 * 60 * 1000,
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      return GENERIC_FAILURE;
    }
    throw error;
  }
}

/** Existing authenticated recipients can claim without logging in again. */
export async function claimRoleInvite(opts: {
  sessionId: string;
  userId: string;
  token: string;
}) {
  const result = await claimPasswordlessInvite(opts.token, opts.userId);
  if (!result.ok || result.sessionId !== opts.sessionId) {
    return GENERIC_FAILURE;
  }
  const seat = await prisma.sessionSeat.findUnique({
    where: {
      sessionId_userId: {
        sessionId: opts.sessionId,
        userId: opts.userId,
      },
    },
  });
  if (!seat?.playbookRoleId) return GENERIC_FAILURE;
  return {
    ok: true as const,
    playbookRoleId: seat.playbookRoleId,
    teamId: seat.teamId,
    seatId: seat.id,
  };
}

export async function requiredRolesCoverage(sessionId: string): Promise<{
  ok: boolean;
  missing: { roleId: string; roleName: string }[];
}> {
  const session = await prisma.exerciseSession.findUnique({
    where: { id: sessionId },
    include: {
      seats: true,
      exercise: { select: { document: true } },
    },
  });
  if (!session) {
    return { ok: false, missing: [{ roleId: "?", roleName: "Unknown session" }] };
  }
  const document = parseExerciseDocument(session.exercise.document);
  if (!document.success) {
    return {
      ok: false,
      missing: [{ roleId: "?", roleName: "Unreadable scenario" }],
    };
  }
  const filled = new Set(
    session.seats
      .filter((seat) => seat.kind === "PARTICIPANT" && seat.playbookRoleId)
      .map((seat) => seat.playbookRoleId as string),
  );
  const missing = document.data.roles
    .filter((role) => !filled.has(role.id))
    .map((role) => ({ roleId: role.id, roleName: role.name }));
  return { ok: missing.length === 0, missing };
}
