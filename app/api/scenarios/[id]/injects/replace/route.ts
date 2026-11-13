import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  exerciseDocumentSchema,
  injectSchema,
  parseExerciseDocument,
} from "@/lib/schema/exercise";

const bodySchema = z.object({
  injectId: z.string().min(1),
  replacement: injectSchema,
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid replacement inject", details: parsed.error.flatten() },
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
  const docParsed = parseExerciseDocument(exercise.document);
  if (!docParsed.success) {
    return NextResponse.json({ error: "Scenario unreadable" }, { status: 500 });
  }
  const document = docParsed.data;
  const idx = document.injects.findIndex((i) => i.id === parsed.data.injectId);
  if (idx < 0) {
    return NextResponse.json({ error: "Inject not found" }, { status: 404 });
  }

  const replacement = {
    ...parsed.data.replacement,
    id: document.injects[idx].id,
    sequence: document.injects[idx].sequence,
  };
  const injects = document.injects.slice();
  injects[idx] = replacement;
  const nextDoc = exerciseDocumentSchema.parse({ ...document, injects });

  await prisma.exercise.update({
    where: { id },
    data: {
      document: nextDoc,
      title: nextDoc.title,
      durationMin: nextDoc.durationMin,
      sector: nextDoc.sector,
    },
  });

  return NextResponse.json({ inject: replacement, document: nextDoc });
}
