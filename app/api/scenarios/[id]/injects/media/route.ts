import { z } from "zod";
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  llmProviderSchema,
  parseExerciseDocument,
} from "@/lib/schema/exercise";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  shouldUseCursorSdk,
  generateObjectWithCursor,
} from "@/lib/ai/cursor-generate";
import { orgVisualStyleGuide, composeMediaPrompt } from "@/lib/media/org-style-prompt";
import { generateAndSaveStageImage } from "@/lib/ai/generate-stage-image";
import { writeStageCardFile } from "@/lib/media/stage-card";
import { TTX_STAGE_IMAGE_PROMPT_RULES } from "@/lib/ai/prompts/ttx-designer";
import { deleteMediaFile } from "@/lib/media/fs";
import {
  discardedMedia,
  keepMediaIndex,
  removeMediaIndex,
} from "@/lib/media/pick";

const bodySchema = z.object({
  injectId: z.string().min(1),
  organizationId: z.string().optional(),
  provider: llmProviderSchema.optional(),
  /** When true (default), generate image files via OpenAI/Gemini after prompts. */
  generateImages: z.boolean().optional().default(true),
});

const aspectSchema = z.enum(["16:9", "1:1", "9:16"]);

const mediaResultSchema = z.object({
  mediaPrompts: z
    .array(
      z.object({
        kind: z.enum(["image", "video"]),
        prompt: z.string().min(20),
        aspect: aspectSchema.nullable(),
        durationSec: z.number().int().positive().nullable(),
      }),
    )
    .min(1)
    .max(3),
});

type MediaAspect = z.infer<typeof aspectSchema>;

function normalizeAspect(
  kind: "image" | "video",
  aspect: string | undefined,
): MediaAspect | undefined {
  if (aspect === "16:9" || aspect === "1:1" || aspect === "9:16") return aspect;
  return kind === "image" ? "16:9" : undefined;
}

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
  const inject = document.injects[idx];
  const provider = parsed.data.provider;

  let org: { name: string; sector: string; notes: string } | null = null;
  if (parsed.data.organizationId) {
    org = await prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: { name: true, sector: true, notes: true },
    });
  }

  const style = orgVisualStyleGuide(org, { inject });
  const system = `You author Stage media prompts for a cyber tabletop exercise.
Return 1–2 candidate image prompts (kind "image") for a facilitator briefing board. The operator will pick one for Stage and discard the rest. Optional one short video cue (kind "video") of the same board, not a cinematic scene.
${TTX_STAGE_IMAGE_PROMPT_RULES}
Every prompt MUST incorporate this house style so the pack looks uniform across injects:
${style}
Prompts describe the board only (no product UI chrome). aspect "16:9" for images.`;

  const userPrompt = `Scenario: ${document.title}
Sector: ${document.sector}
Org: ${org?.name ?? "unspecified"}

Inject INJ-${String(inject.sequence).padStart(2, "0")}: ${inject.title}
Body: ${inject.body}
Techniques: ${inject.techniqueIds.join(", ") || "n/a"}

Write mediaPrompts an image model can render as a tabletop inject board. Name the severity color on the status banner and one callout only. Keep the rest of the field neutral.`;

  try {
    const useCursor = await shouldUseCursorSdk(provider);
    let mediaPrompts;
    if (useCursor) {
      const full = await generateObjectWithCursor(
        system,
        `${userPrompt}

Return a minimal exercise JSON with only injects:[{ id: "${inject.id}", mediaPrompts:[...] }] plus required stub fields if needed. Prefer mediaPrompts on the matching inject.`,
      );
      const found =
        full.injects.find((i) => i.id === inject.id) ?? full.injects[0];
      mediaPrompts = found?.mediaPrompts ?? [];
      if (!mediaPrompts.length) {
        throw new Error("No media prompts returned");
      }
    } else {
      const result = await generateObject({
        model: await getLanguageModel(provider),
        schema: mediaResultSchema,
        system,
        prompt: userPrompt,
      });
      mediaPrompts = result.object.mediaPrompts;
    }

    const normalized = [];
    let imageProviderId: string | null = null;
    const imageErrors: string[] = [];

    for (let i = 0; i < mediaPrompts.length; i++) {
      const m = mediaPrompts[i];
      const kind = m.kind as "image" | "video";
      const aspect = normalizeAspect(kind, m.aspect ?? undefined);
      const entry: {
        kind: "image" | "video";
        prompt: string;
        aspect?: MediaAspect;
        durationSec?: number;
        assetPath?: string;
        source?: "generated" | "fallback" | "upload";
        error?: string;
      } = {
        kind,
        prompt: m.prompt,
        aspect,
        durationSec: m.durationSec ?? undefined,
      };

      if (parsed.data.generateImages && kind === "image") {
        try {
          const fullPrompt = composeMediaPrompt(m.prompt, org, { inject });
          const saved = await generateAndSaveStageImage({
            prompt: fullPrompt,
            aspect,
            exerciseId: id,
            injectId: inject.id,
            index: i,
            provider,
          });
          entry.assetPath = saved.assetPath;
          entry.source = "generated";
          imageProviderId = saved.providerId;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Image generation failed";
          imageErrors.push(message);
          entry.assetPath = await writeStageCardFile({
            exerciseId: id,
            injectId: inject.id,
            sequence: inject.sequence,
            title: inject.title,
            subtitle: inject.body.split("\n")[0] ?? inject.title,
          });
          entry.source = "fallback";
          entry.error = message;
        }
      }

      normalized.push(entry);
    }

    const nextInjects = document.injects.slice();
    nextInjects[idx] = {
      ...inject,
      mediaPrompts: normalized,
    };
    const nextDoc = { ...document, injects: nextInjects };
    await prisma.exercise.update({
      where: { id },
      data: { document: nextDoc },
    });

    return NextResponse.json({
      ok: true,
      injectId: inject.id,
      mediaPrompts: nextInjects[idx].mediaPrompts,
      document: nextDoc,
      styleGuide: style,
      imageProviderId,
      imageErrors: imageErrors.length ? imageErrors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Media prompt generation failed",
      },
      { status: 500 },
    );
  }
}

const patchSchema = z
  .object({
    injectId: z.string().min(1),
    keepIndex: z.number().int().min(0).optional(),
    deleteIndex: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      (value.keepIndex !== undefined) !== (value.deleteIndex !== undefined),
    { message: "Provide keepIndex or deleteIndex" },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
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

  const inject = document.injects[idx];
  const current = inject.mediaPrompts ?? [];
  const nextPrompts =
    parsed.data.keepIndex !== undefined
      ? keepMediaIndex(current, parsed.data.keepIndex)
      : removeMediaIndex(current, parsed.data.deleteIndex!);

  if (nextPrompts.length === current.length) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  for (const item of discardedMedia(current, nextPrompts)) {
    await deleteMediaFile(item.assetPath);
  }

  const nextInjects = document.injects.slice();
  nextInjects[idx] = { ...inject, mediaPrompts: nextPrompts };
  const nextDoc = { ...document, injects: nextInjects };
  await prisma.exercise.update({
    where: { id },
    data: { document: nextDoc },
  });

  return NextResponse.json({
    ok: true,
    injectId: inject.id,
    mediaPrompts: nextPrompts,
    document: nextDoc,
  });
}
