import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { replaceOrgAssignments } from "@/lib/org-scope";

const patchSchema = z.object({
  organizationIds: z.array(z.string()).optional(),
  canFacilitate: z.boolean().optional(),
  platformRole: z.enum(["ADMIN", "USER"]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (parsed.data.platformRole || parsed.data.canFacilitate !== undefined) {
    await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.platformRole ? { platformRole: parsed.data.platformRole } : {}),
        ...(parsed.data.canFacilitate !== undefined
          ? { canFacilitate: parsed.data.canFacilitate || parsed.data.platformRole === "ADMIN" }
          : {}),
      },
    });
  }
  if (parsed.data.organizationIds) {
    const orgs = await prisma.organization.findMany({
      where: { id: { in: parsed.data.organizationIds } },
      select: { id: true },
    });
    await replaceOrgAssignments(
      id,
      orgs.map((org) => org.id),
    );
  }
  const user = await prisma.user.findUnique({
    where: { id },
    omit: { passwordHash: true, totpSecret: true },
    include: {
      organization: { select: { name: true } },
      assignments: { select: { organization: { select: { id: true, name: true } } } },
    },
  });
  return NextResponse.json(user);
}
