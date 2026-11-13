import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser, sessionActorDenied } from "@/lib/access";
import { claimPasswordlessInvite } from "@/lib/claim-role-invite";
import { allowInviteClaim } from "@/lib/invite-rate-limit";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { prisma } from "@/lib/prisma";
import { hashRoleToken } from "@/lib/role-invite-token";

const schema = z.object({ token: z.string().min(32).max(256) });

export async function POST(request: Request) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const key = `${actor.user.id}:${forwarded.split(",")[0]?.trim() || "unknown"}`;
  if (!allowInviteClaim(key)) {
    return NextResponse.json(
      { error: "This invitation is invalid or no longer available" },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "This invitation is invalid or no longer available" },
      { status: 400 },
    );
  }
  if (actor.user.activitySessionId) {
    const preview = await prisma.sessionRoleInvite.findUnique({
      where: { tokenHash: hashRoleToken(parsed.data.token) },
      select: { sessionId: true },
    });
    if (preview?.sessionId) {
      const locked = sessionActorDenied(actor.user, preview.sessionId);
      if (locked) return locked;
    }
  }
  const claim = await claimPasswordlessInvite(parsed.data.token, actor.user.id);
  if (!claim.ok) {
    return NextResponse.json({ error: claim.error }, { status: claim.status });
  }
  return NextResponse.json({ ok: true, sessionId: claim.sessionId });
}
