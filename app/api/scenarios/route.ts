import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { parseExerciseDocument } from "@/lib/schema/exercise";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const exercises = await prisma.exercise.findMany({
    where: { isTemplate: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      sector: true,
      durationMin: true,
      status: true,
      updatedAt: true,
      document: true,
    },
  });

  return NextResponse.json(
    exercises.map((ex) => {
      const doc = parseExerciseDocument(ex.document);
      return {
        id: ex.id,
        title: ex.title,
        sector: ex.sector,
        durationMin: ex.durationMin,
        status: ex.status,
        updatedAt: ex.updatedAt,
        groupId: doc.success ? doc.data.attackMap.groupId : undefined,
        injectCount: doc.success ? doc.data.injects.length : 0,
        regulatorTags: doc.success ? doc.data.regulatorTags : [],
      };
    }),
  );
}
