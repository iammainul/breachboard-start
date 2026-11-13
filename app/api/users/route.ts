import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { hashPassword } from "@/lib/password";
import { replaceOrgAssignments } from "@/lib/org-scope";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  platformRole: z.enum(["ADMIN", "USER"]).default("USER"),
  canFacilitate: z.boolean().default(false),
  organizationId: z.string().nullable().optional(),
  organizationIds: z.array(z.string()).optional(),
  preferredRole: z.string().max(120).optional(),
  preferredTeam: z.string().max(120).optional(),
});

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: true,
      assignments: { select: { organization: { select: { id: true, name: true } } } },
    },
    omit: { passwordHash: true, totpSecret: true },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
  const orgIds = [
    ...new Set(
      [
        ...(parsed.data.organizationIds ?? []),
        parsed.data.organizationId ?? "",
      ].filter(Boolean),
    ),
  ];
  if (orgIds.length) {
    const found = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true },
    });
    if (found.length !== orgIds.length) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }
  }
  const needsPassword =
    parsed.data.platformRole === "ADMIN" || parsed.data.canFacilitate;
  if (parsed.data.platformRole === "USER" && !parsed.data.canFacilitate) {
    return NextResponse.json(
      {
        error:
          "Participants do not get accounts. Share a join code or invite link instead.",
      },
      { status: 400 },
    );
  }
  const password = parsed.data.password?.trim() ?? "";
  if (needsPassword && password.length < 8) {
    return NextResponse.json(
      { error: "Admins and facilitators need a password of at least 8 characters" },
      { status: 400 },
    );
  }
  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters, or leave it blank" },
      { status: 400 },
    );
  }
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash: password ? await hashPassword(password) : null,
      platformRole: parsed.data.platformRole,
      canFacilitate:
        parsed.data.canFacilitate || parsed.data.platformRole === "ADMIN",
      organizationId: orgIds[0] ?? null,
      preferredRole: parsed.data.preferredRole?.trim() || null,
      preferredTeam: parsed.data.preferredTeam?.trim() || null,
    },
    omit: { passwordHash: true, totpSecret: true },
  });
  if (orgIds.length) {
    await replaceOrgAssignments(user.id, orgIds);
  }
  return NextResponse.json(user);
}
