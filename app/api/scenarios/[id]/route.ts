import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { deleteScenario } from "@/lib/scenario-lineage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(exercise);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = parseExerciseDocument(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.isTemplate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (exercise.status !== "draft") {
    return NextResponse.json(
      {
        error:
          exercise.status === "accepted"
            ? "Accepted packs are locked. Fork a new draft to edit."
            : "Retired scenarios cannot be edited.",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.exercise.update({
    where: { id },
    data: {
      title: parsed.data.title,
      durationMin: parsed.data.durationMin,
      sector: parsed.data.sector,
      document: parsed.data,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const result = await deleteScenario(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
