import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/join-code";
import {
  exerciseDocumentSchema,
  type ExerciseDocument,
} from "@/lib/schema/exercise";

export async function cloneTemplateToExercise(input: {
  templateKey: string;
  organizationId?: string | null;
  authorId?: string | null;
}) {
  const template = await prisma.exercise.findFirst({
    where: { templateKey: input.templateKey, isTemplate: true },
  });
  if (!template) {
    throw new Error("Template not found");
  }

  const parsed = exerciseDocumentSchema.parse(template.document);
  const document: ExerciseDocument = {
    ...parsed,
    title: parsed.title,
  };

  const [exercise] = await prisma.$transaction([
    prisma.exercise.create({
      data: {
        title: document.title,
        durationMin: document.durationMin,
        sector: document.sector,
        status: "draft",
        lineageKey: slugify(document.title),
        document,
        isTemplate: false,
        libraryTags: template.libraryTags,
        coverImagePath: template.coverImagePath,
        organizationId: input.organizationId || null,
        authorId: input.authorId || null,
      },
    }),
    prisma.exercise.update({
      where: { id: template.id },
      data: { cloneCount: { increment: 1 } },
    }),
  ]);

  return exercise;
}
