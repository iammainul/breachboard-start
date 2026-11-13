import { z } from "zod";
import { NextResponse } from "next/server";
import { canManageLiveSession, requireApiUserForSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { sendRoleInvitation } from "@/lib/email/invitation";
import { denyCrossSiteMutation, enforceRateLimit } from "@/lib/security/api-guard";
import { forbidTerminalSessionWrite } from "@/lib/session-access";

const schema = z.union([
  z.object({ inviteId: z.string().min(1) }),
  z.object({ sendAll: z.literal(true) }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const limited = enforceRateLimit(request, "invite", actor.user.id);
  if (limited) return limited;
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true, teams: true, roleInvites: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const seat = session.seats.find((item) => item.userId === actor.user.id);
  if (!canManageLiveSession(actor.user, seat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const frozen = forbidTerminalSessionWrite(session.status, "invite");
  if (frozen) return frozen;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email action" }, { status: 400 });
  }

  const inviteId = "inviteId" in parsed.data ? parsed.data.inviteId : null;
  const targets =
    inviteId
      ? session.roleInvites.filter((invite) => invite.id === inviteId)
      : session.roleInvites.filter(
          (invite) =>
            invite.recipientEmail &&
            invite.playbookRoleId &&
            !invite.claimedAt &&
            ["ALLOCATED", "READY", "SENT"].includes(invite.status) &&
            (session.teams.length === 0 || invite.teamId),
        );
  if (!targets.length) {
    return NextResponse.json(
      { error: "No ready invitation assignments" },
      { status: 409 },
    );
  }

  const sent: string[] = [];
  const errors: { inviteId: string; error: string }[] = [];
  for (const invite of targets.slice(0, 100)) {
    try {
      await sendRoleInvitation(invite.id, new URL(request.url).origin);
      sent.push(invite.id);
    } catch (error) {
      errors.push({
        inviteId: invite.id,
        error: error instanceof Error ? error.message : "Delivery failed",
      });
    }
  }
  if (sent.length === 0 && errors.length > 0) {
    return NextResponse.json(
      { error: errors[0].error, errors },
      { status: 502 },
    );
  }
  return NextResponse.json({ sent: sent.length, errors });
}
