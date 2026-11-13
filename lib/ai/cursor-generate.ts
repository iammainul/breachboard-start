import {
  exerciseDocumentSchema,
  type ExerciseDocument,
  type LlmProvider,
} from "@/lib/schema/exercise";
import { resolveProvider } from "@/lib/ai/provider-config";

/** True when Cursor should use the native SDK (key set, no OpenAI-compatible proxy). */
export async function cursorSdkEnabled() {
  const resolved = await resolveProvider("cursor");
  return Boolean(resolved.apiKey) && !resolved.baseURL;
}

/**
 * Use Cursor SDK when the effective provider (explicit or portal default) is
 * Cursor in SDK mode — not OpenAI-compatible proxy mode.
 */
export async function shouldUseCursorSdk(provider?: LlmProvider) {
  const resolved = await resolveProvider(provider);
  if (resolved.id !== "cursor") return false;
  return Boolean(resolved.apiKey) && !resolved.baseURL;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Cursor response did not contain JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateObjectWithCursor(
  system: string,
  prompt: string,
): Promise<ExerciseDocument> {
  const resolved = await resolveProvider("cursor");
  if (!resolved.apiKey) {
    throw new Error("Cursor API key is not configured (portal or CURSOR_API_KEY)");
  }

  // Dynamic import keeps Turbopack from statically bundling SDK LICENSE.txt chunks.
  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  const modelId = resolved.model ?? "composer-2.5";
  const fullPrompt = `${system}

---

${prompt}

Return ONLY a single JSON object matching the exercise document schema. No markdown fences, no commentary.`;

  try {
    const result = await Agent.prompt(fullPrompt, {
      apiKey: resolved.apiKey,
      model: { id: modelId },
      cloud: { repos: [] },
    });

    if (result.status === "error") {
      throw new Error("Cursor agent run failed");
    }

    const raw = extractJson(result.result ?? "");
    return exerciseDocumentSchema.parse(raw);
  } catch (error) {
    if (error instanceof CursorAgentError) {
      throw new Error(`Cursor API error: ${error.message}`);
    }
    throw error;
  }
}
