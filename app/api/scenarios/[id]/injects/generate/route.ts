import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  exerciseDocumentSchema,
  llmProviderSchema,
  parseExerciseDocument,
} from "@/lib/schema/exercise";
import { generateInject, nextInjectIdentity } from "@/lib/ai/generate-inject";

const bodySchema = z.object({
  guidance: z.string().optional(),
  provider: llmProviderSchema.optional(),
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
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
  const { injectId, sequence } = nextInjectIdentity(document);

  try {
    const inject = await generateInject({
      document,
      injectId,
      sequence,
      guidance: parsed.data.guidance,
      provider: parsed.data.provider,
    });
    const nextDoc = exerciseDocumentSchema.parse({
      ...document,
      injects: [...document.injects, inject],
    });
    await prisma.exercise.update({
      where: { id },
      data: {
        document: nextDoc,
        title: nextDoc.title,
        durationMin: nextDoc.durationMin,
        sector: nextDoc.sector,
      },
    });
    return NextResponse.json({ inject, document: nextDoc });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Inject generation failed",
      },
      { status: 500 },
    );
  }
}
