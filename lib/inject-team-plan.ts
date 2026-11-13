import type { ExerciseDocument } from "@/lib/schema/exercise";

type Inject = ExerciseDocument["injects"][number];

/** Session-scoped map of injectId → active SessionTeam ids. */
export type InjectTeamPlan = Record<string, string[]>;

export function parseInjectTeamPlan(raw: unknown): InjectTeamPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: InjectTeamPlan = {};
  for (const [injectId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[injectId] = value.filter((id): id is string => typeof id === "string");
    }
  }
  return out;
}

/**
 * Resolve activeTeamIds for participation: session plan wins, then document, else [].
 * Empty after resolve ⇒ "all teams" when SessionTeams exist (see resolveActiveTeamIds).
 */
export function withSessionActiveTeams(
  inject: Inject,
  plan: InjectTeamPlan,
): Inject {
  const fromPlan = plan[inject.id];
  if (fromPlan !== undefined) {
    return { ...inject, activeTeamIds: fromPlan };
  }
  return inject;
}

export function applyTeamPlanToInjects(
  injects: Inject[],
  plan: InjectTeamPlan,
): Inject[] {
  return injects.map((inject) => withSessionActiveTeams(inject, plan));
}
