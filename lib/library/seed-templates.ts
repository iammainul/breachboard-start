import { prisma } from "@/lib/prisma";
import { exerciseDocumentSchema } from "@/lib/schema/exercise";
import { LIBRARY_TEMPLATES } from "@/lib/library/templates/catalog";

export async function seedLibraryTemplates() {
  let upserted = 0;
  for (const tpl of LIBRARY_TEMPLATES) {
    const document = exerciseDocumentSchema.parse(tpl.document);
    await prisma.exercise.upsert({
      where: { templateKey: tpl.key },
      create: {
        title: document.title,
        durationMin: document.durationMin,
        sector: document.sector,
        status: "published",
        document,
        isTemplate: true,
        templateKey: tpl.key,
        libraryKind: tpl.kind,
        libraryTags: tpl.tags,
        coverImagePath: tpl.coverImagePath,
      },
      update: {
        title: document.title,
        durationMin: document.durationMin,
        sector: document.sector,
        document,
        isTemplate: true,
        libraryKind: tpl.kind,
        libraryTags: tpl.tags,
        coverImagePath: tpl.coverImagePath,
        status: "published",
      },
    });
    upserted += 1;
  }
  return { upserted, total: LIBRARY_TEMPLATES.length };
}
