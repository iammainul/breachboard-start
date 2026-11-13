import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashRoleToken } from "@/lib/role-invite-token";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { InviteClaimForm } from "@/components/invite-claim-form";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, viewer] = await Promise.all([
    token.length >= 32
      ? prisma.sessionRoleInvite.findUnique({
          where: { tokenHash: hashRoleToken(token) },
          include: {
            session: {
              include: {
                exercise: { select: { title: true, document: true } },
                organization: { select: { name: true } },
                teams: { select: { id: true, name: true } },
              },
            },
          },
        })
      : null,
    auth(),
  ]);
  const usable = Boolean(
    invite?.recipientEmail &&
      invite.playbookRoleId &&
      invite.expiresAt &&
      invite.expiresAt > new Date() &&
      !invite.claimedAt &&
      ["READY", "SENT"].includes(invite.status),
  );

  if (!invite || !usable) {
    return (
      <main className="app-canvas grid min-h-dvh place-items-center px-4 py-8">
        <div className="flash-card glass-reading w-full max-w-[420px] p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-meta">
            Activity invitation
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Link unavailable</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            This invitation is invalid, expired, revoked, or has already been used.
            Ask the facilitator to issue a fresh link.
          </p>
        </div>
      </main>
    );
  }

  const document = parseExerciseDocument(invite.session.exercise.document);
  const roleName = document.success
    ? document.data.roles.find((role) => role.id === invite.playbookRoleId)?.name
    : null;
  const teamName = invite.teamId
    ? invite.session.teams.find((team) => team.id === invite.teamId)?.name
    : null;
  const currentEmail = viewer?.user.email?.trim().toLowerCase() ?? null;
  const recipientMatches =
    Boolean(currentEmail) && currentEmail === invite.recipientEmail;

  return (
    <main className="app-canvas grid min-h-dvh place-items-center px-4 py-8">
      <div className="flash-card glass-chrome w-full max-w-[420px] p-6 sm:p-7">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-hover">
          {invite.session.organization.name} · Activity assignment
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight">
          {invite.session.exercise.title}
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          Confirm to enter this run. No password is required and the link is used
          only when you press the button.
        </p>
        <dl className="glass-inset mt-4 grid grid-cols-2 gap-3 rounded-[var(--radius)] p-3.5 text-[13px]">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-meta">Role</dt>
            <dd className="mt-0.5 font-semibold">{roleName ?? "Assigned role"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-meta">Squad</dt>
            <dd className="mt-0.5 font-semibold">{teamName ?? "Whole squad"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-meta">
              Participant
            </dt>
            <dd className="mt-0.5 font-semibold">
              {invite.recipientName ?? invite.recipientEmail}
            </dd>
          </div>
        </dl>
        <InviteClaimForm
          token={token}
          sessionId={invite.sessionId}
          currentEmail={currentEmail}
          recipientMatches={recipientMatches}
        />
      </div>
    </main>
  );
}
