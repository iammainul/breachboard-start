import { z } from "zod";
import { sectorSchema } from "@/lib/sectors";

export { sectorSchema };
export const regulatorTagSchema = z.enum([
  "RBI",
  "SEBI",
  "CERT-In",
  "CISA",
  "FBI",
]);
export const llmProviderSchema = z.enum([
  "openai",
  "anthropic",
  "github",
  "ollama",
  "cursor",
  "gemini",
]);
export const seatKindSchema = z.enum(["MODERATOR", "OBSERVER", "PARTICIPANT"]);

export const injectQuestionSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const q = value as Record<string, unknown>;
  const roleId = typeof q.roleId === "string" ? q.roleId : "";
  const roleIds = Array.isArray(q.roleIds)
    ? (q.roleIds as unknown[]).filter((id): id is string => typeof id === "string")
    : roleId
      ? [roleId]
      : [];
  return {
    ...q,
    roleId: roleId || roleIds[0] || "",
    roleIds,
    common: Boolean(q.common),
  };
}, z.object({
  roleId: z.string(),
  roleIds: z.array(z.string()).default([]),
  common: z.boolean().default(false),
  prompt: z.string(),
  expectedAction: z.string(),
  points: z.number().int(),
}));

export const mediaPromptSchema = z.object({
  kind: z.enum(["image", "video"]),
  prompt: z.string().min(1),
  aspect: z.enum(["16:9", "1:1", "9:16"]).optional(),
  durationSec: z.number().int().positive().optional(),
  /** Path under /public when a static artifact ships with the template */
  assetPath: z.string().optional(),
  /** How the file was produced — not sent to the LLM. */
  source: z.enum(["generated", "fallback", "upload"]).optional(),
  /** Last image-generation error, if the board fell back. */
  error: z.string().optional(),
});

const injectObjectSchema = z.object({
  id: z.string(),
  sequence: z.number().int(),
  title: z.string(),
  body: z.string(),
  timerSeconds: z.number().int().min(30).max(900),
  targetRoleIds: z.array(z.string()),
  techniqueIds: z.array(z.string()),
  /** Empty / omitted = all teams on the run (legacy-compatible). */
  activeTeamIds: z.array(z.string()).default([]),
  questions: z.array(injectQuestionSchema).min(1),
  aiGradeRubric: z.string(),
  consequences: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      nextInjectId: z.string().optional(),
      scoreDelta: z.number().int(),
      worldState: z.string(),
    }),
  ),
  mediaPrompts: z.array(mediaPromptSchema).default([]),
});

export const injectSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const inject = value as Record<string, unknown>;
  const questions = inject.questions;
  const expectedActions = inject.expectedActions;
  if (
    (!Array.isArray(questions) || questions.length === 0) &&
    Array.isArray(expectedActions)
  ) {
    return {
      ...inject,
      questions: expectedActions.map((action) => {
        const row = action as {
          roleId?: string;
          action?: string;
          points?: number;
        };
        return {
          roleId: row.roleId ?? "",
          prompt: row.action ?? "",
          expectedAction: row.action ?? "",
          points: row.points ?? 1,
        };
      }),
    };
  }
  return inject;
}, injectObjectSchema);

export const exerciseDocumentSchema = z.object({
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
        url: z.string().optional(),
      }),
    ),
  }),
  attackMap: z.object({
    groupId: z.string().optional(),
    groupName: z.string().optional(),
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
      d3fendId: z.string().optional(),
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
  /** Named response / inject groups seeded into live session teams. */
  teamDefinitions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  modules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      narrative: z.string(),
      discussionQuestions: z.array(z.string()),
    }),
  ),
  injects: z.array(injectObjectSchema),
});

const storedExerciseDocumentSchema = z.object({
  ...exerciseDocumentSchema.shape,
  injects: z.array(injectSchema),
});

export function parseExerciseDocument(raw: unknown) {
  return storedExerciseDocumentSchema.safeParse(raw);
}

export type ExerciseDocument = z.infer<typeof exerciseDocumentSchema>;
export type InjectQuestion = z.infer<typeof injectQuestionSchema>;
export type LlmProvider = z.infer<typeof llmProviderSchema>;
export type Sector = z.infer<typeof sectorSchema>;
export type SeatKind = z.infer<typeof seatKindSchema>;

export const generateRequestSchema = z.object({
  sector: sectorSchema,
  durationMin: z.number().int().min(60).max(180).default(90),
  /** Primary APT / ATT&CK intrusion set (Gxxxx). */
  groupId: z.string().optional(),
  /** Extra APTs (combined with groupId, max 3). */
  groupIds: z.array(z.string()).max(3).optional(),
  cveId: z.string().optional(),
  advisoryId: z.string().optional(),
  advisoryIds: z.array(z.string()).max(5).optional(),
  advisoryText: z.string().optional(),
  stackNotes: z.string().optional(),
  organizationId: z.string().optional(),
  /** Named inject / response groups for the SitMan (become teamDefinitions). */
  teamNames: z.array(z.string().min(1).max(64)).max(8).optional(),
  provider: llmProviderSchema.optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export function questionRoleIds(question: InjectQuestion) {
  if (question.roleIds?.length) return question.roleIds;
  return question.roleId ? [question.roleId] : [];
}

export function questionKey(question: InjectQuestion) {
  const roles = questionRoleIds(question).slice().sort().join(",") || "common";
  return `${question.common ? "common" : roles}::${question.prompt}`;
}

export function canAnswerQuestion(
  question: InjectQuestion,
  playbookRoleId: string | null | undefined,
) {
  if (question.common) return true;
  if (!playbookRoleId) return false;
  return questionRoleIds(question).includes(playbookRoleId);
}

export function questionsForRole(
  inject: ExerciseDocument["injects"][number],
  playbookRoleId: string | null | undefined,
) {
  if (!playbookRoleId) return [];
  return inject.questions.filter((q) => canAnswerQuestion(q, playbookRoleId));
}

export function questionsVisibleOnActiveTeam(
  inject: ExerciseDocument["injects"][number],
) {
  return inject.questions;
}
