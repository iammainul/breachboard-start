import type { ExerciseDocument } from "@/lib/schema/exercise";
import { writeStageCardFile } from "@/lib/media/stage-card";
import { resolveMediaFile } from "@/lib/media/fs";
import {
  describeInjectSeverity,
  inferInjectSeverity,
} from "@/lib/media/inject-severity";
import { mediaSource } from "@/lib/media/status";
import { composeMediaPrompt } from "@/lib/media/org-style-prompt";
import {
  generateAndSaveStageImage,
  imageProviderAvailable,
} from "@/lib/ai/generate-stage-image";

export function fallbackImagePrompt(inject: ExerciseDocument["injects"][number]) {
  const body = inject.body.replace(/\s+/g, " ").trim().slice(0, 220);
  const severity = inferInjectSeverity(inject);
  return `16:9 tabletop inject board titled "${inject.title}". Neutral gray-slate briefing slide, flat illustration. Severity accent: ${describeInjectSeverity(severity)}. Situation: ${body} No cinematic lighting, no photoreal SOC, no logos or readable PII.`;
}

export function ensureInjectMediaPrompts(document: ExerciseDocument): ExerciseDocument {
  return {
    ...document,
    injects: document.injects.map((inject) => {
      const existing = inject.mediaPrompts ?? [];
      const hasImagePrompt = existing.some(
        (item) => item.kind === "image" && item.prompt.trim().length > 0,
      );
      if (hasImagePrompt) return inject;
      return {
        ...inject,
        mediaPrompts: [
          {
            kind: "image" as const,
            aspect: "16:9" as const,
            prompt: fallbackImagePrompt(inject),
          },
          ...existing,
        ],
      };
    }),
  };
}

async function fileExists(assetPath: string | undefined): Promise<boolean> {
  if (!assetPath) return false;
  if (assetPath.startsWith("/library/")) return true;
  return Boolean(await resolveMediaFile(assetPath));
}

async function writeFallback(opts: {
  exerciseId: string;
  inject: ExerciseDocument["injects"][number];
  prompt: string;
  error?: string;
}): Promise<ExerciseDocument["injects"][number]["mediaPrompts"][number]> {
  const assetPath = await writeStageCardFile({
    exerciseId: opts.exerciseId,
    injectId: opts.inject.id,
    sequence: opts.inject.sequence,
    title: opts.inject.title,
    subtitle: opts.inject.body.split("\n")[0] ?? opts.inject.title,
  });
  return {
    kind: "image",
    aspect: "16:9",
    prompt: opts.prompt,
    assetPath,
    source: "fallback",
    error: opts.error,
  };
}

export async function ensureInjectStageAssets(
  exerciseId: string,
  document: ExerciseDocument,
  opts?: {
    tryAi?: boolean;
    org?: { name: string; sector: string; notes: string } | null;
  },
): Promise<ExerciseDocument> {
  const withPrompts = ensureInjectMediaPrompts(document);
  const canAi = opts?.tryAi ? await imageProviderAvailable() : false;
  const injects = [];
  for (const inject of withPrompts.injects) {
    const mediaPrompts = [...(inject.mediaPrompts ?? [])];
    const imageIdx = mediaPrompts.findIndex((item) => item.kind === "image");
    const current = imageIdx >= 0 ? mediaPrompts[imageIdx] : undefined;
    const source = mediaSource(current);
    const hasFile = await fileExists(current?.assetPath);
    if (hasFile && source !== "missing") {
      injects.push(inject);
      continue;
    }

    const prompt = current?.prompt?.trim() || fallbackImagePrompt(inject);
    let nextImage = current;
    let error: string | undefined;

    if (canAi) {
      try {
        const styled = composeMediaPrompt(prompt, opts?.org ?? null, { inject });
        const saved = await generateAndSaveStageImage({
          prompt: styled,
          aspect: "16:9",
          exerciseId,
          injectId: inject.id,
          index: 0,
        });
        nextImage = {
          kind: "image",
          aspect: "16:9",
          prompt,
          assetPath: saved.assetPath,
          source: "generated",
        };
      } catch (err) {
        error = err instanceof Error ? err.message : "Image generation failed";
        nextImage = await writeFallback({ exerciseId, inject, prompt, error });
      }
    } else {
      nextImage = await writeFallback({
        exerciseId,
        inject,
        prompt,
        error: opts?.tryAi
          ? "No OpenAI or Gemini image provider configured."
          : undefined,
      });
    }

    if (imageIdx >= 0) {
      mediaPrompts[imageIdx] = nextImage!;
    } else {
      mediaPrompts.unshift(nextImage!);
    }
    injects.push({ ...inject, mediaPrompts });
  }
  return { ...withPrompts, injects };
}
