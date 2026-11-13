import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import {
  exerciseDocumentSchema,
  parseExerciseDocument,
  sectorSchema,
  type ExerciseDocument,
} from "@/lib/schema/exercise";
import { scenarioLineageKey } from "@/lib/scenario-packs";
import {
  generalizeInject,
  sourcePlaceholderContext,
} from "@/lib/scenario-placeholders";

const requestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  sector: sectorSchema,
  durationMin: z.number().int().min(60).max(180).default(90),
  organizationId: z.string().optional(),
  selections: z
    .array(
      z.object({
        templateId: z.string().min(1),
        injectId: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

function uniqueBy<T>(rows: T[], key: (row: T) => string) {
  return [...new Map(rows.map((row) => [key(row), row])).values()];
}

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a title and at least one available inject" },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
  }

  const templateIds = [...new Set(input.selections.map((item) => item.templateId))];
  const templates = await prisma.exercise.findMany({
    where: { id: { in: templateIds } },
    select: {
      id: true,
      document: true,
      sector: true,
      organization: { select: { name: true } },
    },
  });
  const documents = new Map<string, ExerciseDocument>();
  const sourceCtx = new Map<string, { orgName?: string | null; sector?: string | null; teamDefinitions?: ExerciseDocument["teamDefinitions"] }>();
  for (const template of templates) {
    const document = parseExerciseDocument(template.document);
    if (document.success) {
      documents.set(template.id, document.data);
      sourceCtx.set(template.id, {
        orgName: template.organization?.name,
        sector: template.sector,
        teamDefinitions: document.data.teamDefinitions,
      });
    }
  }

  const selected = input.selections.map((selection) => {
    const document = documents.get(selection.templateId);
    const inject = document?.injects.find((item) => item.id === selection.injectId);
    const ctx = sourcePlaceholderContext(sourceCtx.get(selection.templateId) ?? {});
    return document && inject
      ? { document, inject: generalizeInject(inject, ctx) }
      : null;
  });
  if (selected.some((item) => !item)) {
    return NextResponse.json(
      { error: "One or more selected injects are no longer available" },
      { status: 409 },
    );
  }
  const rows = selected.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const first = rows[0].document;
  const referencedRoleIds = new Set(
    rows.flatMap(({ inject }) => [
      ...inject.targetRoleIds,
      ...inject.questions.flatMap((question) => [
        question.roleId,
        ...(question.roleIds ?? []),
      ]),
    ]),
  );
  referencedRoleIds.delete("");

  const sourceRoles = uniqueBy(
    rows.flatMap(({ document }) => document.roles),
    (role) => role.id,
  );
  const roles = [...referencedRoleIds].map(
    (roleId) =>
      sourceRoles.find((role) => role.id === roleId) ?? {
        id: roleId,
        name: roleId.replaceAll(/[-_]/g, " "),
        description: "Imported from the selected inject library",
        expectedDecisions: [],
      },
  );
  const techniqueIds = new Set(
    rows.flatMap(({ inject }) => inject.techniqueIds),
  );
  const techniques = uniqueBy(
    rows.flatMap(({ document }) => document.attackMap.techniques),
    (technique) => technique.id,
  ).filter((technique) => techniqueIds.has(technique.id));

  const injects = rows.map(({ inject }, index) => {
    const id = `inj-${String(index + 1).padStart(2, "0")}`;
    const nextId =
      index < rows.length - 1
        ? `inj-${String(index + 2).padStart(2, "0")}`
        : undefined;
    return {
      ...inject,
      id,
      sequence: index + 1,
      consequences: inject.consequences.map((consequence) => ({
        ...consequence,
        nextInjectId: nextId,
      })),
    };
  });

  const candidate: ExerciseDocument = {
    title: input.title,
    durationMin: input.durationMin,
    objectives: uniqueBy(
      rows.flatMap(({ document }) => document.objectives),
      (objective) => objective,
    ).slice(0, 6),
    sector: input.sector,
    regulatorTags: uniqueBy(
      rows.flatMap(({ document }) => document.regulatorTags),
      (tag) => tag,
    ),
    clientProfile: first.clientProfile,
    intelCitations: {
      cveIds: uniqueBy(
        rows.flatMap(({ document }) => document.intelCitations.cveIds),
        (id) => id,
      ),
      groupIds: uniqueBy(
        rows.flatMap(({ document }) => document.intelCitations.groupIds),
        (id) => id,
      ),
      advisories: uniqueBy(
        rows.flatMap(({ document }) => document.intelCitations.advisories),
        (advisory) => `${advisory.title}:${advisory.url ?? ""}`,
      ),
    },
    attackMap: {
      groupId: first.attackMap.groupId,
      groupName: first.attackMap.groupName,
      techniques,
    },
    detectionPlaybooks: uniqueBy(
      rows.flatMap(({ document }) => document.detectionPlaybooks),
      (playbook) => `${playbook.techniqueId}:${playbook.name}`,
    ).filter((playbook) => techniqueIds.has(playbook.techniqueId)),
    roles,
    teamDefinitions: uniqueBy(
      rows.flatMap(({ document }) => document.teamDefinitions ?? []),
      (team) => team.name.toLowerCase(),
    ),
    modules: [
      {
        id: "selected-injects",
        name: "Selected inject sequence",
        narrative: "Scenario assembled from curated inject library selections.",
        discussionQuestions: uniqueBy(
          rows.flatMap(({ document }) =>
            document.modules.flatMap((module) => module.discussionQuestions),
          ),
          (question) => question,
        ).slice(0, 8),
      },
    ],
    injects,
  };
  const document = exerciseDocumentSchema.parse(candidate);
  const exercise = await prisma.exercise.create({
    data: {
      title: document.title,
      durationMin: document.durationMin,
      sector: document.sector,
      status: "draft",
      lineageKey: scenarioLineageKey(document.title),
      document,
      authorId: actor.user.id,
      organizationId: input.organizationId || null,
    },
  });
  return NextResponse.json({ id: exercise.id, document });
}
