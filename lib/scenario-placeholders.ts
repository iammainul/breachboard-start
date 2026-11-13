import { sectorLabel } from "@/lib/cn";
import type { ExerciseDocument } from "@/lib/schema/exercise";

export type PlaceholderContext = {
  orgName?: string | null;
  sector?: string | null;
  teams?: { id?: string; name: string }[] | null;
};

type Inject = ExerciseDocument["injects"][number];

export const PLACEHOLDER_HINT =
  "{{org}} · {{sector}} · {{team}} · {{teams}} — filled from the client and seated teams when the run goes live.";

function teamList(ctx: PlaceholderContext) {
  return (ctx.teams ?? []).map((team) => team.name.trim()).filter(Boolean);
}

function joinTeams(names: string[]) {
  if (names.length === 0) return "the response teams";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function applyPlaceholders(
  text: string | null | undefined,
  ctx: PlaceholderContext,
): string {
  if (!text) return text ?? "";
  const names = teamList(ctx);
  return text
    .replaceAll("{{org}}", ctx.orgName?.trim() || "the organization")
    .replaceAll("{{sector}}", ctx.sector ? sectorLabel(ctx.sector) : "this sector")
    .replaceAll("{{team}}", names[0] || "the response team")
    .replaceAll("{{teams}}", joinTeams(names));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceName(text: string, name: string, token: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return text;
  const pattern = new RegExp(`(?<![\\w{{])${escapeRegExp(trimmed)}(?![\\w}}])`, "gi");
  return text.replace(pattern, token);
}

export function generalizePlaceholders(
  text: string | null | undefined,
  ctx: PlaceholderContext,
): string {
  if (!text) return text ?? "";
  let next = text;
  const names = teamList(ctx).slice().sort((a, b) => b.length - a.length);
  for (const name of names) {
    next = replaceName(next, name, "{{team}}");
  }
  if (ctx.orgName?.trim()) {
    next = replaceName(next, ctx.orgName, "{{org}}");
  }
  if (ctx.sector) {
    next = replaceName(next, sectorLabel(ctx.sector), "{{sector}}");
  }
  return next;
}

export function applyPlaceholdersInInject(inject: Inject, ctx: PlaceholderContext): Inject {
  return {
    ...inject,
    title: applyPlaceholders(inject.title, ctx),
    body: applyPlaceholders(inject.body, ctx),
    aiGradeRubric: applyPlaceholders(inject.aiGradeRubric, ctx),
    questions: inject.questions.map((question) => ({
      ...question,
      prompt: applyPlaceholders(question.prompt, ctx),
      expectedAction: applyPlaceholders(question.expectedAction, ctx),
    })),
    consequences: inject.consequences.map((consequence) => ({
      ...consequence,
      label: applyPlaceholders(consequence.label, ctx),
      worldState: applyPlaceholders(consequence.worldState, ctx),
    })),
  };
}

export function generalizeInject(inject: Inject, ctx: PlaceholderContext): Inject {
  return {
    ...inject,
    title: generalizePlaceholders(inject.title, ctx),
    body: generalizePlaceholders(inject.body, ctx),
    aiGradeRubric: generalizePlaceholders(inject.aiGradeRubric, ctx),
    questions: inject.questions.map((question) => ({
      ...question,
      prompt: generalizePlaceholders(question.prompt, ctx),
      expectedAction: generalizePlaceholders(question.expectedAction, ctx),
    })),
    consequences: inject.consequences.map((consequence) => ({
      ...consequence,
      label: generalizePlaceholders(consequence.label, ctx),
      worldState: generalizePlaceholders(consequence.worldState, ctx),
    })),
  };
}

export function sourcePlaceholderContext(input: {
  orgName?: string | null;
  sector?: string | null;
  teamDefinitions?: ExerciseDocument["teamDefinitions"];
}): PlaceholderContext {
  return {
    orgName: input.orgName,
    sector: input.sector,
    teams: input.teamDefinitions ?? [],
  };
}
