import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { TTX_ANSWER_GRADE_SYSTEM } from "@/lib/ai/prompts/ttx-designer";
import { maxPointsForRoleQuestions } from "@/lib/game-score";

export { maxPointsForRoleQuestions };

/** Live auto-score: POST /api/sessions/:id/answers → InjectAnswer.autoPoints + pointsAwarded. */

export const GRADE_NEEDS_REVIEW_NO_RUBRIC =
  "Needs facilitator review — no rubric or expected actions for this inject.";
export const GRADE_NEEDS_REVIEW_AI_UNAVAILABLE =
  "Needs facilitator review — AI grading unavailable.";

export type GradeResult = {
  autoPoints: number;
  aiNotes: string | null;
  needsReview: boolean;
};

const gradeSchema = z.object({
  scoreRatio: z.number().min(0).max(1),
  notes: z.string().min(1).max(800),
});

export type AnswerGradeInput = {
  maxPoints: number;
  questionPrompts: string[];
  expectedActions: string[];
  rubric: string;
  answerBody: string;
  roleLabel: string;
  /** Crisis management + IRC excerpts from the seated organization, if uploaded. */
  orgPlanContext?: string | null;
};

/**
 * AI grade from inject rubric. Empty rubric / expected actions, or an AI
 * failure, leave the answer ungraded for facilitator review — never full points.
 */
export async function gradeAnswerWithRubric(
  input: AnswerGradeInput,
): Promise<GradeResult> {
  const max = Math.max(0, input.maxPoints);
  if (max === 0) {
    return { autoPoints: 0, aiNotes: null, needsReview: false };
  }
  const expectedActions = input.expectedActions.map((a) => a.trim()).filter(Boolean);
  if (!input.rubric.trim() && expectedActions.length === 0) {
    return {
      autoPoints: 0,
      aiNotes: GRADE_NEEDS_REVIEW_NO_RUBRIC,
      needsReview: true,
    };
  }

  try {
    const model = await getLanguageModel();
    const { object } = await generateObject({
      model,
      schema: gradeSchema,
      system: TTX_ANSWER_GRADE_SYSTEM,
      prompt: `Role: ${input.roleLabel}
Max points: ${max}
Questions:
${input.questionPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(none)"}
Expected actions:
${input.expectedActions.map((a, i) => `${i + 1}. ${a}`).join("\n") || "(none)"}
Rubric:
${input.rubric.trim() || "(none — use expected actions)"}
${
  input.orgPlanContext?.trim()
    ? `\nOrganization plans (use these; do not invent clauses):\n${input.orgPlanContext.trim()}\n`
    : "\nOrganization plans: (none uploaded)\n"
}
Participant answer:
${input.answerBody}`,
    });
    const autoPoints = Math.round(
      Math.min(1, Math.max(0, object.scoreRatio)) * max,
    );
    return {
      autoPoints,
      aiNotes: object.notes.trim(),
      needsReview: false,
    };
  } catch {
    return {
      autoPoints: 0,
      aiNotes: GRADE_NEEDS_REVIEW_AI_UNAVAILABLE,
      needsReview: true,
    };
  }
}
