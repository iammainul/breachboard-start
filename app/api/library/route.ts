import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { seedLibraryTemplates } from "@/lib/library/seed-templates";
import { parseExerciseDocument } from "@/lib/schema/exercise";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "all";
  const tag = url.searchParams.get("tag") ?? "";

  let templates = await prisma.exercise.findMany({
    where: {
      isTemplate: true,
      ...(kind === "scenario_pack" || kind === "inject_pack"
        ? { libraryKind: kind }
        : {}),
      ...(tag ? { libraryTags: { has: tag } } : {}),
    },
    orderBy: { title: "asc" },
  });

  if (templates.length === 0 && !tag) {
    await seedLibraryTemplates();
    templates = await prisma.exercise.findMany({
      where: {
        isTemplate: true,
        ...(kind === "scenario_pack" || kind === "inject_pack"
          ? { libraryKind: kind }
          : {}),
      },
      orderBy: { title: "asc" },
    });
  }

  return NextResponse.json(
    templates.map((t) => {
      const doc = parseExerciseDocument(t.document);
      return {
        id: t.id,
        key: t.templateKey,
        kind: t.libraryKind,
        title: t.title,
        durationMin: t.durationMin,
        sector: t.sector,
        libraryTags: t.libraryTags,
        coverImagePath: t.coverImagePath,
        cloneCount: t.cloneCount,
        injectCount: doc.success ? doc.data.injects.length : 0,
        injects: doc.success
          ? doc.data.injects.map((inj) => ({
              id: inj.id,
              sequence: inj.sequence,
              title: inj.title,
              techniqueIds: inj.techniqueIds,
              questionCount: inj.questions.length,
              targetRoleIds: inj.targetRoleIds,
              body: inj.body,
              questions: inj.questions,
              mediaPrompts: inj.mediaPrompts ?? [],
              timerSeconds: inj.timerSeconds,
              aiGradeRubric: inj.aiGradeRubric,
              consequences: inj.consequences,
              activeTeamIds: inj.activeTeamIds ?? [],
            }))
          : [],
        updatedAt: t.updatedAt,
      };
    }),
  );
}
