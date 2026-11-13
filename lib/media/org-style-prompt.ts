/**
 * Shared visual language for Stage media prompts.
 * Tabletop briefing boards — not cinematic incident stills.
 */
import {
  describeInjectSeverity,
  inferInjectSeverity,
  type InjectSeverityInput,
} from "@/lib/media/inject-severity";
import { TTX_STAGE_IMAGE_PROMPT_RULES } from "@/lib/ai/prompts/ttx-designer";
import { sectorVisual } from "@/lib/sectors";

export type OrgStyleInput = {
  name: string;
  sector?: string;
  notes?: string;
};

export type StageStyleContext = {
  inject?: InjectSeverityInput;
};

export function orgVisualStyleGuide(
  org: OrgStyleInput | null | undefined,
  context?: StageStyleContext,
): string {
  const visual = sectorVisual(org?.sector);
  const orgName = org?.name?.trim() || "the participating organization";
  const notes = org?.notes?.trim();

  const lines = [
    `HOUSE STYLE (apply to every frame for ${orgName}):`,
    `- Audience: ${visual.audience}.`,
    `- Format: facilitator inject board / MSEL slide for ${visual.setting}. Flat or lightly illustrated briefing graphic.`,
    `- Field: cool gray #E8EEF2, off-white #F7F5F0, slate #5A6B75, charcoal labels #2C353B. Muted teal only as a quiet secondary.`,
    `- Severity color is reserved for important sections (banner, status chip, one callout). Do not flood the canvas.`,
    TTX_STAGE_IMAGE_PROMPT_RULES.trim(),
    `- Branding: do not invent logos; imply org context via desk objects (binder, clock, network map) without trademark marks.`,
  ];

  if (context?.inject) {
    const severity = inferInjectSeverity(context.inject);
    lines.push(`- This inject severity: ${describeInjectSeverity(severity)}.`);
  }

  if (notes) {
    lines.push(`- Org context notes: ${notes.slice(0, 280)}`);
  }
  return lines.join("\n");
}

export function composeMediaPrompt(
  injectPrompt: string,
  org: OrgStyleInput | null | undefined,
  context?: StageStyleContext,
): string {
  return `${orgVisualStyleGuide(org, context)}\n\nINJECT BOARD:\n${injectPrompt.trim()}`;
}
