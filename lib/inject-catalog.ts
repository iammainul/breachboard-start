import { prisma } from "@/lib/prisma";
import { parseExerciseDocument, type ExerciseDocument } from "@/lib/schema/exercise";
import { exerciseVisibleToOrg } from "@/lib/scenario-packs";
import {
  generalizeInject,
  sourcePlaceholderContext,
} from "@/lib/scenario-placeholders";

export type CatalogInject = {
  sourceId: string;
  sourceTitle: string;
  sourceKind: "template" | "scenario";
  status: string;
  injectId: string;
  sequence: number;
  title: string;
  body: string;
  timerSeconds: number;
  techniqueIds: string[];
  questionCount: number;
  targetRoleIds: string[];
  questions: ExerciseDocument["injects"][number]["questions"];
  mediaPrompts: ExerciseDocument["injects"][number]["mediaPrompts"];
  aiGradeRubric: string;
  consequences: ExerciseDocument["injects"][number]["consequences"];
  activeTeamIds: string[];
};

export async function listCatalogInjects(
  workspaceOrgId: string | null,
): Promise<CatalogInject[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { isTemplate: true },
        {
          isTemplate: false,
          status: { in: ["draft", "accepted"] },
          ...(workspaceOrgId ? exerciseVisibleToOrg(workspaceOrgId) : { id: { in: [] } }),
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      isTemplate: true,
      sector: true,
      document: true,
      organization: { select: { name: true } },
    },
  });

  const rows: CatalogInject[] = [];
  for (const exercise of exercises) {
    const parsed = parseExerciseDocument(exercise.document);
    if (!parsed.success) continue;
    const ctx = sourcePlaceholderContext({
      orgName: exercise.organization?.name,
      sector: exercise.sector,
      teamDefinitions: parsed.data.teamDefinitions,
    });
    for (const inject of parsed.data.injects) {
      const portable = generalizeInject(inject, ctx);
      rows.push({
        sourceId: exercise.id,
        sourceTitle: exercise.title,
        sourceKind: exercise.isTemplate ? "template" : "scenario",
        status: exercise.status,
        injectId: portable.id,
        sequence: portable.sequence,
        title: portable.title,
        body: portable.body,
        timerSeconds: portable.timerSeconds,
        techniqueIds: portable.techniqueIds,
        questionCount: portable.questions.length,
        targetRoleIds: portable.targetRoleIds,
        questions: portable.questions,
        mediaPrompts: portable.mediaPrompts ?? [],
        aiGradeRubric: portable.aiGradeRubric,
        consequences: portable.consequences,
        activeTeamIds: portable.activeTeamIds ?? [],
      });
    }
  }
  return rows;
}
