/**
 * Live-run scoring.
 * - Max points live on each inject question in the scenario JSON (`points`).
 * - On submit, `gradeAnswerWithRubric` writes `InjectAnswer.autoPoints` + `pointsAwarded`.
 * - Facilitators PATCH `/api/sessions/:id/answers/:answerId/score` to override `pointsAwarded`.
 * - Totals/leaderboard read `pointsAwarded` via `earnedPoints` in this file.
 * - Answers flagged `needsReview` contribute 0 until a facilitator override.
 */
type Question = {
  roleId: string;
  roleIds?: string[];
  common?: boolean;
  points?: number;
};
type Inject = { id: string; questions?: Question[] };

/** Participant GET omits `questions` on future injects (`{ id, sequence }`). */
function questionsOf(inject: Inject | undefined): Question[] {
  return inject?.questions ?? [];
}

type Answer = {
  injectId: string;
  userId: string;
  pointsAwarded?: number | null;
  needsReview?: boolean;
};

function questionMatchesRole(q: Question, roleId: string) {
  if (q.common) return true;
  if (q.roleId === roleId) return true;
  return Array.isArray(q.roleIds) && q.roleIds.includes(roleId);
}

function questionPoints(q: Question) {
  return q.points ?? 0;
}

export function pointsForRole(injects: Inject[], roleId: string | null | undefined) {
  if (!roleId) return 0;
  return injects.reduce(
    (sum, inject) =>
      sum +
      questionsOf(inject)
        .filter((q) => questionMatchesRole(q, roleId))
        .reduce((s, q) => s + questionPoints(q), 0),
    0,
  );
}

/** Sum of points from questions the role can answer on an inject. */
export function maxPointsForRoleQuestions(
  questions: Question[] | null | undefined,
  playbookRoleId: string,
) {
  return (questions ?? [])
    .filter((q) => questionMatchesRole(q, playbookRoleId))
    .reduce((sum, q) => sum + questionPoints(q), 0);
}

export function maxPointsForInjectRole(
  injects: Inject[],
  injectId: string,
  playbookRoleId: string | null | undefined,
) {
  if (!playbookRoleId) return 0;
  const inject = injects.find((item) => item.id === injectId);
  if (!inject) return 0;
  return maxPointsForRoleQuestions(questionsOf(inject), playbookRoleId);
}

/** Bound a stored or typed score to the inject/role ceiling. */
export function clampAwardedPoints(points: number, maxPoints: number) {
  const max = Math.max(0, maxPoints);
  if (!Number.isFinite(points) || points < 0) return 0;
  return Math.min(Math.round(points), max);
}

/** Reject facilitator overrides above the inject/role max. */
export function overrideScoreError(pointsAwarded: number, maxPoints: number) {
  if (!Number.isInteger(pointsAwarded) || pointsAwarded < 0) {
    return "Score must be a non-negative integer";
  }
  if (pointsAwarded > maxPoints) {
    return `Score cannot exceed ${maxPoints} points for this role on this inject`;
  }
  return null;
}

/** Prefer stored pointsAwarded; fall back to full question points for legacy rows. */
export function earnedPoints(
  injects: Inject[],
  answers: Answer[],
  userId: string,
  roleId: string | null | undefined,
) {
  const mine = answers.filter((a) => a.userId === userId);
  if (mine.length === 0) return 0;

  // Ungraded / needs-review answers never count as earned (or as legacy full points).
  const countable = mine.filter((a) => !a.needsReview);
  if (countable.length === 0) return 0;

  const hasStored = countable.some(
    (a) => typeof a.pointsAwarded === "number" && a.pointsAwarded >= 0,
  );
  if (hasStored) {
    const earned = countable.reduce((sum, a) => {
      const cap = maxPointsForInjectRole(injects, a.injectId, roleId);
      return sum + clampAwardedPoints(a.pointsAwarded ?? 0, cap);
    }, 0);
    const campaignMax = pointsForRole(injects, roleId);
    return campaignMax > 0 ? Math.min(earned, campaignMax) : earned;
  }

  if (!roleId) return 0;
  const answered = new Set(countable.map((a) => a.injectId));
  return injects.reduce((sum, inject) => {
    if (!answered.has(inject.id)) return sum;
    return (
      sum +
      questionsOf(inject)
        .filter((q) => questionMatchesRole(q, roleId))
        .reduce((s, q) => s + questionPoints(q), 0)
    );
  }, 0);
}

export function injectProgress(
  injects: Inject[],
  currentInjectId: string | null | undefined,
) {
  if (injects.length === 0) return 0;
  if (!currentInjectId) return 0;
  const idx = injects.findIndex((i) => i.id === currentInjectId);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / injects.length) * 100);
}

export function rankLabel(earned: number, total: number) {
  if (total === 0) return "Rookie";
  const ratio = earned / total;
  if (ratio >= 0.9) return "Elite";
  if (ratio >= 0.7) return "Veteran";
  if (ratio >= 0.4) return "Operator";
  if (ratio > 0) return "Recruit";
  return "Rookie";
}

export function leaderboardRows(
  injects: Inject[],
  answers: Answer[],
  people: {
    userId: string;
    name: string;
    playbookRoleId: string | null;
  }[],
) {
  return people
    .map((p) => {
      const earned = earnedPoints(injects, answers, p.userId, p.playbookRoleId);
      const total = pointsForRole(injects, p.playbookRoleId);
      return {
        userId: p.userId,
        name: p.name,
        playbookRoleId: p.playbookRoleId,
        earned,
        total,
        rank: rankLabel(earned, total),
      };
    })
    .sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));
}
