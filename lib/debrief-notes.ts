import { maxPointsForRoleQuestions } from "@/lib/game-score";

/** Score ratio at or above this is a Stage/Present strength. */
export const DEBRIEF_STRENGTH_RATIO = 0.7;

export type DebriefSourceAnswer = {
  userName: string;
  playbookRoleId: string;
  pointsAwarded?: number | null;
  autoPoints?: number | null;
  aiNotes?: string | null;
  overrideComment?: string | null;
  needsReview?: boolean;
};

export type DebriefQuestion = {
  roleId: string;
  roleIds?: string[];
  common?: boolean;
  points?: number;
};

export type DebriefHighlight = {
  userName: string;
  roleId: string;
  points: number;
  maxPoints: number;
  note: string | null;
  kind: "strength" | "gap";
};

export type DebriefEmptyReason = "no_answers" | "pending_review" | "no_scores";

export function debriefHighlights(
  answers: DebriefSourceAnswer[],
  questions: DebriefQuestion[],
): {
  strengths: DebriefHighlight[];
  gaps: DebriefHighlight[];
  emptyReason: DebriefEmptyReason | null;
} {
  const strengths: DebriefHighlight[] = [];
  const gaps: DebriefHighlight[] = [];

  for (const answer of answers) {
    if (answer.needsReview) continue;
    const maxPoints = maxPointsForRoleQuestions(questions, answer.playbookRoleId);
    const points = answer.pointsAwarded ?? 0;
    const note =
      [answer.aiNotes, answer.overrideComment]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(" — ") || null;
    if (maxPoints <= 0 && !note) continue;
    const ratio = maxPoints > 0 ? points / maxPoints : 0;
    const item: DebriefHighlight = {
      userName: answer.userName,
      roleId: answer.playbookRoleId,
      points,
      maxPoints,
      note,
      kind: ratio >= DEBRIEF_STRENGTH_RATIO ? "strength" : "gap",
    };
    if (item.kind === "strength") strengths.push(item);
    else gaps.push(item);
  }

  const emptyReason: DebriefEmptyReason | null =
    strengths.length > 0 || gaps.length > 0
      ? null
      : answers.length === 0
        ? "no_answers"
        : answers.every((answer) => answer.needsReview)
          ? "pending_review"
          : "no_scores";

  return { strengths, gaps, emptyReason };
}

export function debriefEmptyCopy(reason: DebriefEmptyReason | null): string {
  if (reason === "no_answers") return "No responses on this inject yet.";
  if (reason === "pending_review") {
    return "Answers are waiting on facilitator scores.";
  }
  if (reason === "no_scores") return "No scoring notes on this inject yet.";
  return "";
}
