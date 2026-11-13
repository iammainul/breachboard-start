import { z } from "zod";
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  injectSchema,
  llmProviderSchema,
  parseExerciseDocument,
  exerciseDocumentSchema,
} from "@/lib/schema/exercise";
import { injectLlmSchema, stripNulls } from "@/lib/schema/llm-exercise";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  shouldUseCursorSdk,
  generateObjectWithCursor,
} from "@/lib/ai/cursor-generate";
import { TTX_INJECT_REGEN_SYSTEM } from "@/lib/ai/prompts/ttx-designer";

const bodySchema = z.object({
  injectId: z.string().min(1),
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
  const idx = document.injects.findIndex((i) => i.id === parsed.data.injectId);
  if (idx < 0) {
    return NextResponse.json({ error: "Inject not found" }, { status: 404 });
  }
  const current = document.injects[idx];
  const provider = parsed.data.provider;
  const useCursor = await shouldUseCursorSdk(provider);

  const system = `${TTX_INJECT_REGEN_SYSTEM}

Roles available: ${document.roles.map((r) => `${r.id} (${r.name})`).join(", ")}.
Use only technique IDs from: ${document.attackMap.techniques.map((t) => t.id).join(", ") || "T1486, T1566, T1078"}.
Return fields: id, sequence, title, body, timerSeconds, targetRoleIds, techniqueIds, questions, aiGradeRubric, consequences, mediaPrompts (optional), activeTeamIds.`;

  const prompt = `Rewrite this inject to be sharper and more discussion-ready.
Guidance: ${parsed.data.guidance?.trim() || "Improve clarity and role-specific questions."}

Current inject JSON:
${JSON.stringify(current, null, 2)}

Scenario title: ${document.title}
Sector: ${document.sector}`;

  try {
    let nextInject;
    if (useCursor) {
      const full = await generateObjectWithCursor(
        system,
        `${prompt}

Return a full exercise document with a single inject in injects[] (copy other fields from a minimal stub if needed). Prefer returning just the inject object if possible — if you return a full document, use injects[0].`,
      );
      // Cursor path returns full document; take matching or first inject
      nextInject =
        full.injects.find((i) => i.id === current.id) ?? full.injects[0];
      if (!nextInject) {
        throw new Error("Cursor did not return an inject");
      }
      nextInject = {
        ...nextInject,
        id: current.id,
        sequence: current.sequence,
      };
    } else {
      const singleSchema = z.object({ inject: injectLlmSchema });
      const result = await generateObject({
        model: await getLanguageModel(provider),
        schema: singleSchema,
        system,
        prompt,
      });
      nextInject = {
        ...(stripNulls(result.object.inject) as typeof current),
        id: current.id,
        sequence: current.sequence,
      };
    }

    const validated = injectSchema.parse(nextInject);
    const injects = document.injects.slice();
    injects[idx] = validated;
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

    return NextResponse.json({ inject: validated, document: nextDoc });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regenerate failed" },
      { status: 500 },
    );
  }
}
