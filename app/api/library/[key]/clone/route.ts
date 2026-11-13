import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { cloneTemplateToExercise } from "@/lib/library/clone";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  organizationId: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { key } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }
  }

  try {
    const exercise = await cloneTemplateToExercise({
      templateKey: key,
      organizationId: parsed.data.organizationId,
      authorId: actor.user.id,
    });
    return NextResponse.json({
      id: exercise.id,
      title: exercise.title,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clone failed" },
      { status: 404 },
    );
  }
}
