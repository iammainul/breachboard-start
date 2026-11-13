import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const groups = await prisma.attackGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      techniques: {
        include: {
          technique: {
            include: { tactic: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json(
    groups.map((g) => {
      const techniques = g.techniques
        .map((link) => ({
          id: link.technique.id,
          name: link.technique.name,
          tacticId: link.technique.tactic?.id ?? null,
          tactic: link.technique.tactic?.name ?? "Unknown",
          description: link.technique.description.slice(0, 220),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        id: g.id,
        name: g.name,
        aliases: g.aliases,
        description: g.description,
        techniqueCount: techniques.length,
        techniques,
      };
    }),
  );
}
