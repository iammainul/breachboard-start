import { z } from "zod";
import { generateObject } from "ai";
import type { ExerciseDocument, LlmProvider } from "@/lib/schema/exercise";
import { injectSchema } from "@/lib/schema/exercise";
import { injectLlmSchema, stripNulls } from "@/lib/schema/llm-exercise";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  generateObjectWithCursor,
  shouldUseCursorSdk,
} from "@/lib/ai/cursor-generate";
import { TTX_INJECT_GENERATE_SYSTEM } from "@/lib/ai/prompts/ttx-designer";

export const STUB_ROLES: ExerciseDocument["roles"] = [
  {
    id: "ciso",
    name: "CISO",
    description: "Owns cyber decision rights",
    expectedDecisions: ["Invoke IR plan", "Brief executives"],
  },
  {
    id: "soc",
    name: "SOC Lead",
    description: "Detection and containment",
    expectedDecisions: ["Isolate segment", "Preserve evidence"],
  },
  {
    id: "legal",
    name: "Legal / Compliance",
    description: "Regulator and customer notice",
    expectedDecisions: ["RBI / CERT-In timeline"],
  },
  {
    id: "comms",
    name: "Communications",
    description: "Internal and customer messaging",
    expectedDecisions: ["Holding statement"],
  },
];

export async function generateInject(input: {
  document: ExerciseDocument;
  injectId: string;
  sequence: number;
  guidance?: string;
  provider?: LlmProvider;
}): Promise<ExerciseDocument["injects"][number]> {
  const { document, injectId, sequence, guidance, provider } = input;
  const useCursor = await shouldUseCursorSdk(provider);
  const roles = document.roles.length ? document.roles : STUB_ROLES;
  const techniques =
    document.attackMap.techniques.map((t) => t.id).join(", ") ||
    "T1566, T1078, T1486";
  const system = `${TTX_INJECT_GENERATE_SYSTEM}

Roles available: ${roles.map((r) => `${r.id} (${r.name})`).join(", ")}.
Use only technique IDs from: ${techniques}.
Return fields: id, sequence, title, body, timerSeconds, targetRoleIds, techniqueIds, questions, aiGradeRubric, consequences, mediaPrompts, activeTeamIds.`;

  const prompt = `Write a new inject for this tabletop.
Guidance: ${guidance?.trim() || "A fresh notification that fits the SitMan and uses {{org}} / {{team}} tokens."}

Inject id: ${injectId}
Sequence: ${sequence}
Scenario title: ${document.title}
Sector: ${document.sector}
Teams: ${(document.teamDefinitions ?? []).map((t) => t.name).join(", ") || "response cells"}
Existing inject titles: ${document.injects.map((i) => i.title).join("; ") || "(none yet)"}`;

  if (useCursor) {
    const full = await generateObjectWithCursor(
      system,
      `${prompt}

Return a full exercise document with a single inject in injects[].`,
    );
    const next = full.injects[0];
    if (!next) throw new Error("Cursor did not return an inject");
    return injectSchema.parse({ ...next, id: injectId, sequence });
  }

  const result = await generateObject({
    model: await getLanguageModel(provider),
    schema: z.object({ inject: injectLlmSchema }),
    system,
    prompt,
  });
  return injectSchema.parse({
    ...(stripNulls(result.object.inject) as ExerciseDocument["injects"][number]),
    id: injectId,
    sequence,
    activeTeamIds: [],
  });
}

export function nextInjectIdentity(document: ExerciseDocument) {
  const sequence =
    document.injects.reduce((max, inject) => Math.max(max, inject.sequence), 0) +
    1;
  let injectId = `inj-${String(sequence).padStart(2, "0")}`;
  const taken = new Set(document.injects.map((inject) => inject.id));
  let n = sequence;
  while (taken.has(injectId)) {
    n += 1;
    injectId = `inj-${String(n).padStart(2, "0")}`;
  }
  return { injectId, sequence };
}
