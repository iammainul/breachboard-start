import { z } from "zod";
import {
  parseExerciseDocument,
  regulatorTagSchema,
  sectorSchema,
  type ExerciseDocument,
} from "@/lib/schema/exercise";

/**
 * OpenAI structured outputs require every key in `properties` to appear in
 * `required`. Zod `.optional()` omits the key from `required` and fails.
 * Use `.nullable()` here; strip nulls before storing.
 */
export function stripNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = stripNulls(entry);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}

const llmQuestionSchema = z.object({
  roleId: z.string(),
  roleIds: z.array(z.string()),
  common: z.boolean(),
  prompt: z.string(),
  expectedAction: z.string(),
  points: z.number().int(),
});

export const llmMediaPromptSchema = z.object({
  kind: z.enum(["image", "video"]),
  prompt: z.string().min(1),
  aspect: z.enum(["16:9", "1:1", "9:16"]).nullable(),
  durationSec: z.number().int().positive().nullable(),
  assetPath: z.string().nullable(),
});

export const injectLlmSchema = z.object({
  id: z.string(),
  sequence: z.number().int(),
  title: z.string(),
  body: z.string(),
  timerSeconds: z.number().int().min(30).max(900),
  targetRoleIds: z.array(z.string()),
  techniqueIds: z.array(z.string()),
  activeTeamIds: z.array(z.string()),
  questions: z.array(llmQuestionSchema).min(1),
  aiGradeRubric: z.string(),
  consequences: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      nextInjectId: z.string().nullable(),
      scoreDelta: z.number().int(),
      worldState: z.string(),
    }),
  ),
  mediaPrompts: z.array(llmMediaPromptSchema),
});

export const mediaPromptsLlmSchema = z.object({
  mediaPrompts: z.array(llmMediaPromptSchema).min(1).max(3),
});

export const exerciseDocumentLlmSchema = z.object({
  title: z.string().min(1),
  durationMin: z.number().int().min(60).max(180),
  objectives: z.array(z.string()).min(1).max(6),
  sector: sectorSchema,
  regulatorTags: z.array(regulatorTagSchema),
  clientProfile: z.object({
    orgType: z.string(),
    criticalAssets: z.array(z.string()),
    stackNotes: z.string(),
  }),
  intelCitations: z.object({
    cveIds: z.array(z.string()),
    groupIds: z.array(z.string()),
    advisories: z.array(
      z.object({
        title: z.string(),
        url: z.string().nullable(),
      }),
    ),
  }),
  attackMap: z.object({
    groupId: z.string().nullable(),
    groupName: z.string().nullable(),
    techniques: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        tactic: z.string(),
      }),
    ),
  }),
  detectionPlaybooks: z.array(
    z.object({
      techniqueId: z.string(),
      name: z.string(),
      logSource: z.string(),
      alertName: z.string(),
      d3fendId: z.string().nullable(),
      expectedDetection: z.string(),
    }),
  ),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      expectedDecisions: z.array(z.string()),
    }),
  ),
  teamDefinitions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
  modules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      narrative: z.string(),
      discussionQuestions: z.array(z.string()),
    }),
  ),
  injects: z.array(injectLlmSchema),
});

export type ExerciseDocumentLlm = z.infer<typeof exerciseDocumentLlmSchema>;

export function parseLlmExerciseDocument(raw: unknown): ExerciseDocument {
  const llm = exerciseDocumentLlmSchema.parse(raw);
  const stored = parseExerciseDocument(stripNulls(llm));
  if (!stored.success) {
    const issue = stored.error.issues[0];
    throw new Error(
      issue
        ? `LLM scenario failed stored schema: ${issue.path.join(".")} ${issue.message}`
        : "LLM scenario failed stored schema",
    );
  }
  return stored.data;
}
