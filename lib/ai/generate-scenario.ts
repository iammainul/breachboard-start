import { generateObject } from "ai";
import { prisma } from "@/lib/prisma";
import { generateObjectWithCursor, shouldUseCursorSdk } from "@/lib/ai/cursor-generate";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  type ExerciseDocument,
  type GenerateRequest,
} from "@/lib/schema/exercise";
import {
  exerciseDocumentLlmSchema,
  parseLlmExerciseDocument,
} from "@/lib/schema/llm-exercise";
import { lookupCve } from "@/lib/intel/nvd";
import { TTX_DESIGNER_SYSTEM } from "@/lib/ai/prompts/ttx-designer";
import { ensureInjectMediaPrompts } from "@/lib/media/ensure-inject-media";
import { sectorPrompt } from "@/lib/sectors";

function techniqueId(value: string) {
  const match = value.toUpperCase().match(/T\d{4}(?:\.\d{3})?/);
  return match?.[0];
}

function groupId(value: string) {
  const match = value.toUpperCase().match(/G\d{4}/);
  return match?.[0];
}

export async function generateScenario(input: GenerateRequest) {
  const evidence = await collectEvidence(input);
  const useCursorSdk = await shouldUseCursorSdk(input.provider);
  const model = useCursorSdk ? null : await getLanguageModel(input.provider);
  const userPrompt = buildPrompt(input, evidence);

  let document: ExerciseDocument;
  if (useCursorSdk) {
    document = await generateObjectWithCursor(TTX_DESIGNER_SYSTEM, userPrompt);
  } else {
    const first = await generateObject({
      model: model!,
      schema: exerciseDocumentLlmSchema,
      system: TTX_DESIGNER_SYSTEM,
      prompt: userPrompt,
    });
    document = parseLlmExerciseDocument(first.object);
  }
  const validated = await validateAgainstIntel(document, evidence);

  if (validated.stripped.length > 0) {
    const retryPrompt = `${userPrompt}

The previous draft invented or used invalid ATT&CK IDs: ${validated.stripped.join(", ")}.
Rewrite using ONLY these technique IDs: ${evidence.techniques.map((t) => t.id).join(", ") || "(none — use narrative without fake T-IDs)"}.
Group IDs allowed: ${evidence.groups.map((g) => g.id).join(", ") || "(none)"}.`;

    let retryDoc: ExerciseDocument;
    if (useCursorSdk) {
      retryDoc = await generateObjectWithCursor(TTX_DESIGNER_SYSTEM, retryPrompt);
    } else {
      const retry = await generateObject({
        model: model!,
        schema: exerciseDocumentLlmSchema,
        system: TTX_DESIGNER_SYSTEM,
        prompt: retryPrompt,
      });
      retryDoc = parseLlmExerciseDocument(retry.object);
    }
    document = (await validateAgainstIntel(retryDoc, evidence)).document;
  } else {
    document = validated.document;
  }

  assertInjectCount(document);
  document = ensureInjectMediaPrompts(document);
  return { document, evidence };
}

function assertInjectCount(document: ExerciseDocument) {
  if (document.injects.length < 5) {
    throw new Error(
      `Scenario needs at least 5 injects (got ${document.injects.length}). Regenerate.`,
    );
  }
  return document;
}

async function collectEvidence(input: GenerateRequest) {
  const techniques: { id: string; name: string; tactic: string; description: string }[] = [];
  const groups: {
    id: string;
    name: string;
    description: string;
    aliases: string[];
  }[] = [];
  const cves: { id: string; description: string; kev: boolean }[] = [];
  const advisories: {
    id: string;
    source: string;
    title: string;
    url?: string | null;
    publishedAt?: string | null;
    body: string;
    cveIds: string[];
    groupIds: string[];
    techniqueIds: string[];
  }[] = [];

  const advisoryIds = [
    ...new Set(
      [input.advisoryId, ...(input.advisoryIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ].slice(0, 5);

  const selectedAptIds = [
    ...new Set(
      [input.groupId, ...(input.groupIds ?? [])]
        .filter((id): id is string => Boolean(id))
        .map((id) => groupId(id) ?? id.toUpperCase()),
    ),
  ].slice(0, 3);

  async function loadApt(gid: string) {
    const group = await prisma.attackGroup.findUnique({
      where: { id: gid },
      include: {
        techniques: {
          include: { technique: { include: { tactic: true } } },
        },
      },
    });
    if (!group) return;
    if (!groups.some((g) => g.id === group.id)) {
      groups.push({
        id: group.id,
        name: group.name,
        description: group.description,
        aliases: group.aliases,
      });
    }
    for (const link of group.techniques) {
      if (techniques.some((t) => t.id === link.technique.id)) continue;
      techniques.push({
        id: link.technique.id,
        name: link.technique.name,
        tactic: link.technique.tactic?.name ?? "unknown",
        description: link.technique.description.slice(0, 400),
      });
    }
  }

  // Explicit APT selection drives TTPs for generation
  for (const gid of selectedAptIds) {
    await loadApt(gid);
  }

  if (advisoryIds.length > 0) {
    const feedItems = await prisma.feedItem.findMany({
      where: { id: { in: advisoryIds } },
    });
    for (const item of feedItems) {
      advisories.push({
        id: item.id,
        source: item.publisher || item.source,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt?.toISOString() ?? item.createdAt.toISOString(),
        body: item.body.slice(0, 6000),
        cveIds: item.cveIds,
        groupIds: item.groupIds,
        techniqueIds: item.techniqueIds,
      });
      // Only pull APT TTPs from advisories when the operator did not pick APTs explicitly
      if (selectedAptIds.length === 0) {
        for (const gid of item.groupIds.slice(0, 2)) {
          await loadApt(gid);
        }
      }
      for (const techId of item.techniqueIds.slice(0, 8)) {
        if (techniques.some((t) => t.id === techId)) continue;
        const tech = await prisma.attackTechnique.findUnique({
          where: { id: techId },
          include: { tactic: true },
        });
        if (!tech) continue;
        techniques.push({
          id: tech.id,
          name: tech.name,
          tactic: tech.tactic?.name ?? "unknown",
          description: tech.description.slice(0, 400),
        });
      }
      for (const cveId of item.cveIds.slice(0, 3)) {
        if (cves.some((c) => c.id === cveId)) continue;
        const record = await lookupCve(cveId);
        if (record) {
          cves.push({
            id: record.id,
            description: record.description,
            kev: record.kev,
          });
        }
      }
    }
  }

  if (input.cveId) {
    const record = await lookupCve(input.cveId);
    if (record && !cves.some((c) => c.id === record.id)) {
      cves.push({
        id: record.id,
        description: record.description,
        kev: record.kev,
      });
    }
  }

  // Generic technique fallback only when neither APT nor advisory TTPs are available
  if (techniques.length === 0 && selectedAptIds.length === 0) {
    const fallback = await prisma.attackTechnique.findMany({
      take: 12,
      include: { tactic: true },
      orderBy: { id: "asc" },
    });
    for (const tech of fallback) {
      techniques.push({
        id: tech.id,
        name: tech.name,
        tactic: tech.tactic?.name ?? "unknown",
        description: tech.description.slice(0, 400),
      });
    }
  }

  const pasted = input.advisoryText?.slice(0, 8000) ?? "";
  const advisoryText = [
    ...advisories.map(
      (a) =>
        `[${a.source}] ${a.title} (${a.publishedAt ?? "undated"})\n${a.body}`,
    ),
    pasted,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, 12000);

  const teamNames = (input.teamNames ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    techniques,
    groups,
    cves,
    advisories,
    advisoryText,
    teamNames,
    aptDriven: selectedAptIds.length > 0,
  };
}

function buildPrompt(
  input: GenerateRequest,
  evidence: Awaited<ReturnType<typeof collectEvidence>>,
) {
  const sectorLabel = sectorPrompt(input.sector);

  const teamsBlock =
    evidence.teamNames.length > 0
      ? evidence.teamNames
          .map((name, i) => `- team-${i + 1}: ${name}`)
          .join("\n")
      : `- team-1: Blue Cell\n- team-2: Crisis Comms\n- team-3: Business Continuity`;

  const openingLine = evidence.advisories.length
    ? "Inject 1 MUST be a notification opened from the selected advisory or cyber-news headline; inject 2+ continue notification → questions → TTP-from-that-notice."
    : evidence.aptDriven
      ? "Inject 1 MUST be an APT threat-intel notification; later injects alternate deeper questions and TTPs foreshadowed by those notices (listed techniques only)."
      : "Inject 1 opens as a sector-relevant notification; keep the notification → questions → TTP cadence for all 5–6 injects.";

  return `Design a live facilitated TTX (${input.durationMin} minutes) for: ${sectorLabel}.
Stack / environment notes: ${input.stackNotes || "typical core banking + email + endpoint + SOC SIEM"}
Generation mode: ${evidence.aptDriven ? "APT-driven (known TTPs)" : evidence.advisories.length ? "Advisory-driven" : "General sector"}

Evidence you MUST ground in (do not invent IDs outside this list):
APTs / intrusion sets:
${
  evidence.groups
    .map(
      (g) =>
        `- ${g.id} ${g.name}${g.aliases?.length ? ` (aka ${g.aliases.join(", ")})` : ""}: ${g.description.slice(0, 280)}`,
    )
    .join("\n") || "- none selected"
}

Known TTPs for selected APT(s) — map injects along this kill chain:
${evidence.techniques.map((t) => `- ${t.id} [${t.tactic}] ${t.name}: ${t.description.slice(0, 180)}`).join("\n") || "- none in database"}

CVEs:
${evidence.cves.map((c) => `- ${c.id}${c.kev ? " (CISA KEV)" : ""}: ${c.description.slice(0, 280)}`).join("\n") || "- none"}

Regulator advisories and cyber news (when present, primary narrative seed for inject #1):
${
  evidence.advisories
    .map(
      (a) =>
        `- ${a.source}: ${a.title} (${a.publishedAt ?? "undated"})${a.url ? ` ${a.url}` : ""}\n  CVEs: ${a.cveIds.join(", ") || "n/a"} · Groups: ${a.groupIds.join(", ") || "n/a"} · TTPs: ${a.techniqueIds.join(", ") || "n/a"}`,
    )
    .join("\n") || "- none selected from library"
}

Full advisory / news text:
${evidence.advisoryText || "(none)"}

Inject / response groups (emit these as teamDefinitions with stable ids). Set every inject.activeTeamIds to [] so all seated teams play without a facilitator toggle:
${teamsBlock}

Write {{org}}, {{sector}}, {{team}}, and {{teams}} instead of any real client or team brand. Those tokens fill at run time.

Produce 3 modules, exactly 5 or 6 injects (minimum 5), 5–7 playbook roles, and teamDefinitions matching the groups above.
${openingLine}
Cadence: notification → questions on that notice → TTP executed/escalated from that notice → next notification → … through all 5–6 injects.
Set attackMap.groupId/groupName to the primary APT when one is selected; cite all APT G-IDs in intelCitations.groupIds.
For each inject, target 3–5 roles and write a unique live question for each of those roles in questions[]. Also add 1 common (shared) discussion question when it strengthens the inject. Aim for 4–6 questions total per inject.
Every inject must include mediaPrompts with at least one 16:9 facilitator briefing-board prompt (neutral palette; severity color only on the status banner/callout). Do not omit media on injects 2–6. No cinematic SOC drama.
Scoring rubric + branching consequences required.`;
}

async function validateAgainstIntel(
  document: ExerciseDocument,
  evidence: Awaited<ReturnType<typeof collectEvidence>>,
) {
  const knownTech = new Set(evidence.techniques.map((t) => t.id));
  const dbTech =
    knownTech.size > 0
      ? knownTech
      : new Set(
          (
            await prisma.attackTechnique.findMany({ select: { id: true } })
          ).map((t) => t.id),
        );

  const knownGroups = new Set(evidence.groups.map((g) => g.id));
  const stripped: string[] = [];

  const techniques = document.attackMap.techniques.filter((t) => {
    const id = techniqueId(t.id) ?? t.id;
    if (dbTech.size === 0) return /^T\d{4}/.test(id);
    if (!dbTech.has(id)) {
      stripped.push(id);
      return false;
    }
    return true;
  });

  if (document.attackMap.groupId) {
    const gid = groupId(document.attackMap.groupId) ?? document.attackMap.groupId;
    if (knownGroups.size > 0 && !knownGroups.has(gid)) {
      stripped.push(gid);
      document.attackMap.groupId = evidence.groups[0]?.id;
      document.attackMap.groupName = evidence.groups[0]?.name;
    }
  } else if (evidence.groups[0]) {
    document.attackMap.groupId = evidence.groups[0].id;
    document.attackMap.groupName = evidence.groups[0].name;
  }

  const citedGroups = new Set(document.intelCitations.groupIds);
  for (const g of evidence.groups) {
    citedGroups.add(g.id);
  }
  document.intelCitations.groupIds = [...citedGroups];

  document.attackMap.techniques = techniques;
  document.detectionPlaybooks = document.detectionPlaybooks.filter((p) => {
    const id = techniqueId(p.techniqueId) ?? p.techniqueId;
    return dbTech.size === 0 || dbTech.has(id);
  });
  document.injects = document.injects.map((inject) => ({
    ...inject,
    activeTeamIds: [],
    techniqueIds: inject.techniqueIds.filter((id) => {
      const tid = techniqueId(id) ?? id;
      return dbTech.size === 0 || dbTech.has(tid);
    }),
  }));

  if (!document.teamDefinitions) {
    document.teamDefinitions = [];
  }
  if (document.teamDefinitions.length === 0 && evidence.teamNames.length > 0) {
    document.teamDefinitions = evidence.teamNames.map((name, i) => ({
      id: `team-${i + 1}`,
      name,
    }));
  }

  if (evidence.advisories.length > 0) {
    const known = new Set(
      document.intelCitations.advisories.map((a) => a.title.toLowerCase()),
    );
    for (const adv of evidence.advisories) {
      if (known.has(adv.title.toLowerCase())) continue;
      document.intelCitations.advisories.push({
        title: adv.title,
        url: adv.url ?? undefined,
      });
    }
  }

  return { document, stripped };
}
