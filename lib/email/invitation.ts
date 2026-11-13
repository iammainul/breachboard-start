import "server-only";

import { prisma } from "@/lib/prisma";
import {
  hashRoleToken,
  makeRoleToken,
  roleTokenHint,
} from "@/lib/role-invite-token";
import { roleInviteLink } from "@/lib/role-invite";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { formattedSender, smtpTransport } from "@/lib/email/smtp";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export async function sendRoleInvitation(inviteId: string, origin: string) {
  const invite = await prisma.sessionRoleInvite.findUnique({
    where: { id: inviteId },
    include: {
      session: {
        include: {
          organization: { select: { name: true } },
          exercise: { select: { title: true, document: true } },
          teams: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (
    !invite ||
    !invite.recipientEmail ||
    !invite.playbookRoleId ||
    invite.claimedAt ||
    invite.status === "REVOKED"
  ) {
    throw new Error("Invitation assignment is incomplete");
  }
  if (
    invite.lastSentAt &&
    Date.now() - invite.lastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new Error("Wait 30 seconds before resending");
  }
  if (
    invite.session.teams.length > 0 &&
    (!invite.teamId ||
      !invite.session.teams.some((team) => team.id === invite.teamId))
  ) {
    throw new Error("Choose a valid squad before sending");
  }

  const document = parseExerciseDocument(invite.session.exercise.document);
  const roleName = document.success
    ? document.data.roles.find((role) => role.id === invite.playbookRoleId)?.name
    : null;
  if (!roleName) throw new Error("Choose a valid scenario role before sending");
  const teamName = invite.teamId
    ? invite.session.teams.find((team) => team.id === invite.teamId)?.name
    : null;

  const token = makeRoleToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const now = new Date();
  await prisma.sessionRoleInvite.update({
    where: { id: invite.id },
    data: {
      token: null,
      tokenHash: hashRoleToken(token),
      tokenHint: roleTokenHint(token),
      expiresAt,
      lastSentAt: now,
      status: "READY",
      deliveryError: null,
    },
  });

  const link = roleInviteLink(origin, token);
  const organization = invite.session.organization.name;
  const exercise = invite.session.exercise.title;
  const name = invite.recipientName || "Participant";
  const assignment = `${roleName}${teamName ? ` · ${teamName}` : ""}`;
  const text = [
    `Hello ${name},`,
    "",
    `You have been assigned to ${exercise} for ${organization}.`,
    `Assignment: ${assignment}`,
    `This passwordless link expires ${expiresAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC.`,
    "",
    link,
    "",
    "Opening the link does not use it. Confirm on the page to join the activity.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#15202b">
      <div style="border:1px solid #d6e0e4;border-radius:16px;padding:28px;background:#f7fafb">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#0b6b73">${escapeHtml(organization)} · Activity assignment</div>
        <h1 style="font-size:24px;margin:10px 0 8px">${escapeHtml(exercise)}</h1>
        <p style="line-height:1.55">Hello ${escapeHtml(name)}, you have been assigned as <strong>${escapeHtml(roleName)}</strong>${teamName ? ` in <strong>${escapeHtml(teamName)}</strong>` : ""}.</p>
        <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;border-radius:12px;background:#0b6b73;color:white;text-decoration:none;padding:12px 18px;font-weight:700">Review and join activity</a></p>
        <p style="font-size:13px;color:#5a6b7c">The link expires in 72 hours. Email scanners cannot consume it; joining occurs only after confirmation.</p>
      </div>
    </div>`;

  try {
    const { transport, config } = await smtpTransport();
    await transport.sendMail({
      from: formattedSender(config),
      to: invite.recipientEmail,
      replyTo: config.replyTo,
      subject: `${organization}: ${exercise} activity invitation`,
      text,
      html,
    });
    transport.close();
    await prisma.sessionRoleInvite.update({
      where: { id: invite.id },
      data: {
        status: "SENT",
        sentAt: invite.sentAt ?? now,
        deliveryError: null,
      },
    });
    return { inviteId: invite.id, recipientEmail: invite.recipientEmail };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "SMTP delivery failed";
    await prisma.sessionRoleInvite.update({
      where: { id: invite.id },
      data: { deliveryError: message, status: "READY" },
    });
    throw new Error(message);
  }
}
