import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  exerciseDocumentSchema,
  llmProviderSchema,
  sectorSchema,
  type ExerciseDocument,
} from "@/lib/schema/exercise";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";
import { listCatalogInjects } from "@/lib/inject-catalog";
import {
  generateInject,
  nextInjectIdentity,
  STUB_ROLES,
} from "@/lib/ai/generate-inject";
import { scenarioLineageKey } from "@/lib/scenario-packs";
import { defaultRegulatorTags } from "@/lib/sectors";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const workspaceOrgId = await getWorkspaceOrgId(actor.user);
  return NextResponse.json({ injects: await listCatalogInjects(workspaceOrgId) });
}

const createSchema = z.object({
  guidance: z.string().optional(),
  provider: llmProviderSchema.optional(),
  sector: sectorSchema.optional().default("bfsi_in"),
  organizationId: z.string().optional(),
  teamNames: z.array(z.string().min(1)).max(8).optional(),
});

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const teamNames = (parsed.data.teamNames ?? ["Blue Cell", "Crisis Comms"])
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 8);
  const stub: ExerciseDocument = {
    title: "New inject",
    durationMin: 90,
    objectives: ["Rehearse coordination on this inject for {{org}}."],
    sector: parsed.data.sector,
    regulatorTags: defaultRegulatorTags(parsed.data.sector),
    clientProfile: {
      orgType: "{{org}}",
      criticalAssets: ["core systems"],
      stackNotes: "",
    },
    intelCitations: { cveIds: [], groupIds: [], advisories: [] },
    attackMap: { techniques: [] },
    detectionPlaybooks: [],
    roles: STUB_ROLES,
    teamDefinitions: teamNames.map((name, index) => ({
      id: `team-${index + 1}`,
      name,
    })),
    modules: [
      {
        id: "inject-draft",
        name: "Single inject",
        narrative:
          "Standalone inject draft. Tokens {{org}}, {{team}}, and {{teams}} fill when this is run for a client.",
        discussionQuestions: ["What does {{org}} do first?"],
      },
    ],
    injects: [],
  };

  const { injectId, sequence } = nextInjectIdentity(stub);
  try {
    const inject = await generateInject({
      document: stub,
      injectId,
      sequence,
      guidance: parsed.data.guidance,
      provider: parsed.data.provider,
    });
    const document = exerciseDocumentSchema.parse({
      ...stub,
      title: inject.title,
      injects: [inject],
    });
    const exercise = await prisma.exercise.create({
      data: {
        title: document.title,
        durationMin: document.durationMin,
        sector: document.sector,
        status: "draft",
        lineageKey: scenarioLineageKey(document.title),
        document,
        authorId: actor.user.id,
        organizationId: parsed.data.organizationId || null,
      },
    });
    return NextResponse.json({ id: exercise.id, inject, document });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Inject generation failed",
      },
      { status: 500 },
    );
  }
}
