import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const items = await prisma.feedItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const counts = {
    tactics: await prisma.attackTactic.count(),
    techniques: await prisma.attackTechnique.count(),
    groups: await prisma.attackGroup.count(),
    cves: await prisma.cveRecord.count(),
    feeds: await prisma.feedItem.count(),
  };
  return NextResponse.json({ items, counts });
}
