import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, sessions: true, exercises: true } },
    },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(org);
}
