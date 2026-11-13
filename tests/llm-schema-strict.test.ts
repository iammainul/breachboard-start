import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  exerciseDocumentLlmSchema,
  injectLlmSchema,
  mediaPromptsLlmSchema,
  parseLlmExerciseDocument,
  stripNulls,
} from "@/lib/schema/llm-exercise";

function missingRequiredKeys(node: unknown, path = "$"): string[] {
  if (!node || typeof node !== "object") return [];
  const schema = node as Record<string, unknown>;
  const missing: string[] = [];
  const defs = schema.$defs;
  if (defs && typeof defs === "object") {
    for (const [name, def] of Object.entries(defs)) {
      missing.push(...missingRequiredKeys(def, `${path}.$defs.${name}`));
    }
  }
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = schema[key];
    if (Array.isArray(variants)) {
      variants.forEach((variant, index) => {
        missing.push(
          ...missingRequiredKeys(variant, `${path}.${key}[${index}]`),
        );
      });
    }
  }
  if (schema.items) {
    missing.push(...missingRequiredKeys(schema.items, `${path}.items`));
  }
  if (schema.properties && typeof schema.properties === "object") {
    const keys = Object.keys(schema.properties);
    const required = new Set(
      Array.isArray(schema.required) ? (schema.required as string[]) : [],
    );
    for (const key of keys) {
      if (!required.has(key)) missing.push(`${path}.${key}`);
    }
    for (const [key, value] of Object.entries(schema.properties)) {
      missing.push(...missingRequiredKeys(value, `${path}.${key}`));
    }
  }
  return missing;
}

describe("OpenAI-strict LLM schemas", () => {
  it("requires every exercise document property, including advisory url", () => {
    const json = z.toJSONSchema(exerciseDocumentLlmSchema);
    expect(missingRequiredKeys(json)).toEqual([]);
  });

  it("requires every inject property used for regenerate", () => {
    const json = z.toJSONSchema(injectLlmSchema);
    expect(missingRequiredKeys(json)).toEqual([]);
  });

  it("requires every media prompt property", () => {
    const json = z.toJSONSchema(mediaPromptsLlmSchema);
    expect(missingRequiredKeys(json)).toEqual([]);
  });

  it("strips null advisory urls before stored parse", () => {
    const cleaned = stripNulls({
      intelCitations: { advisories: [{ title: "CISA note", url: null }] },
    });
    expect(cleaned).toEqual({
      intelCitations: { advisories: [{ title: "CISA note" }] },
    });
  });

  it("accepts a generated document with nullable intel fields", () => {
    const document = parseLlmExerciseDocument({
      title: "Operation Glass",
      durationMin: 90,
      objectives: ["Practice notification"],
      sector: "bfsi_in",
      regulatorTags: ["RBI"],
      clientProfile: {
        orgType: "bank",
        criticalAssets: ["core"],
        stackNotes: "on-prem",
      },
      intelCitations: {
        cveIds: [],
        groupIds: ["G0016"],
        advisories: [{ title: "CISA advisory", url: null }],
      },
      attackMap: {
        groupId: null,
        groupName: null,
        techniques: [{ id: "T1566", name: "Phishing", tactic: "initial-access" }],
      },
      detectionPlaybooks: [
        {
          techniqueId: "T1566",
          name: "Phish TDP",
          logSource: "email",
          alertName: "phish",
          d3fendId: null,
          expectedDetection: "gateway drop",
        },
      ],
      roles: [
        {
          id: "soc",
          name: "SOC",
          description: "Detect",
          expectedDecisions: ["triage"],
        },
      ],
      teamDefinitions: [{ id: "blue", name: "Blue", description: null }],
      modules: [
        {
          id: "m1",
          name: "Notice",
          narrative: "Alert lands",
          discussionQuestions: ["What first?"],
        },
      ],
      injects: [
        {
          id: "i1",
          sequence: 1,
          title: "Notice",
          body: "CISA ping",
          timerSeconds: 300,
          targetRoleIds: ["soc"],
          techniqueIds: ["T1566"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "Who do you call?",
              expectedAction: "Notify CISO",
              points: 5,
            },
          ],
          aiGradeRubric: "Reward timely notification.",
          consequences: [
            {
              id: "c1",
              label: "Escalate",
              nextInjectId: null,
              scoreDelta: 1,
              worldState: "leadership informed",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt: "Briefing board",
              aspect: "16:9",
              durationSec: null,
              assetPath: null,
            },
          ],
        },
      ],
    });
    expect(document.intelCitations.advisories[0]?.url).toBeUndefined();
    expect(document.attackMap.groupId).toBeUndefined();
    expect(document.injects[0]?.questions[0]?.points).toBe(5);
  });
});
