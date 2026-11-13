import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export async function GET() {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      canFacilitate: true,
      totpEnabled: true,
      passwordHash: true,
      organization: { select: { name: true } },
      assignments: {
        select: { organization: { select: { id: true, name: true } } },
        orderBy: { organization: { name: "asc" } },
      },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole,
    canFacilitate: user.canFacilitate,
    totpEnabled: user.totpEnabled,
    hasPassword: Boolean(user.passwordHash),
    homeOrg: user.organization?.name ?? null,
    clients: user.assignments.map((row) => row.organization),
  });
}

export async function PATCH(request: Request) {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  if (!parsed.data.name) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id: actor.user.id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json(user);
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(8).max(128),
});

export async function PUT(request: Request) {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "This account does not have a password login" },
      { status: 400 },
    );
  }
  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: actor.user.id },
    data: { passwordHash: await hashPassword(parsed.data.nextPassword) },
  });
  return NextResponse.json({ ok: true });
}
