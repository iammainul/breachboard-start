import { generateImage } from "ai";
import { writeMediaFile } from "@/lib/media/fs";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LlmProvider } from "@/lib/schema/exercise";
import {
  getDefaultProviderId,
  resolveProvider,
  type ResolvedProvider,
} from "@/lib/ai/provider-config";

const IMAGE_CAPABLE = new Set<LlmProvider>(["openai", "gemini"]);

type Aspect = "16:9" | "1:1" | "9:16";

function openaiSize(aspect: Aspect | undefined): `${number}x${number}` {
  switch (aspect) {
    case "9:16":
      return "1024x1536";
    case "1:1":
      return "1024x1024";
    case "16:9":
    default:
      return "1536x1024";
  }
}

function geminiAspect(aspect: Aspect | undefined): `${number}:${number}` {
  switch (aspect) {
    case "9:16":
      return "9:16";
    case "1:1":
      return "1:1";
    case "16:9":
    default:
      return "16:9";
  }
}

/**
 * Prefer the caller's provider when it can generate images; otherwise portal
 * default, then OpenAI / Gemini if configured.
 */
export async function resolveImageProvider(
  preferred?: LlmProvider,
): Promise<ResolvedProvider> {
  const order: LlmProvider[] = [];
  if (preferred && IMAGE_CAPABLE.has(preferred)) order.push(preferred);

  const def = await getDefaultProviderId();
  if (IMAGE_CAPABLE.has(def) && !order.includes(def)) order.push(def);

  for (const id of ["openai", "gemini"] as const) {
    if (!order.includes(id)) order.push(id);
  }

  for (const id of order) {
    const resolved = await resolveProvider(id);
    if (resolved.apiKey) return resolved;
  }

  throw new Error(
    "Image generation needs OpenAI or Google Gemini configured (Settings → AI providers).",
  );
}

export async function imageProviderAvailable(): Promise<boolean> {
  try {
    await resolveImageProvider();
    return true;
  } catch {
    return false;
  }
}

export async function generateAndSaveStageImage(opts: {
  prompt: string;
  aspect?: Aspect;
  exerciseId: string;
  injectId: string;
  index: number;
  provider?: LlmProvider;
}): Promise<{ assetPath: string; providerId: LlmProvider }> {
  const resolved = await resolveImageProvider(opts.provider);
  let bytes: Uint8Array;

  if (resolved.id === "gemini") {
    if (!resolved.apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
    const { image } = await generateImage({
      model: google.image("gemini-2.5-flash-image"),
      prompt: opts.prompt,
      aspectRatio: geminiAspect(opts.aspect),
    });
    bytes = image.uint8Array;
  } else {
    if (!resolved.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    const openai = createOpenAI({ apiKey: resolved.apiKey });
    const { image } = await generateImage({
      model: openai.image("gpt-image-1"),
      prompt: opts.prompt,
      size: openaiSize(opts.aspect),
    });
    bytes = image.uint8Array;
  }

  const fileName = `${opts.injectId}-${opts.index}.png`;
  const assetPath = await writeMediaFile(
    `generated/${opts.exerciseId}`,
    fileName,
    bytes,
  );
  return {
    assetPath,
    providerId: resolved.id,
  };
}
