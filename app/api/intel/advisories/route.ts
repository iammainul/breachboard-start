import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  advisoryWindowStart,
  feedSourcesForSector,
  formatFeedSource,
} from "@/lib/intel/advisories";
import { prisma } from "@/lib/prisma";
import { sectorSchema } from "@/lib/schema/exercise";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const url = new URL(request.url);
  const sectorParsed = sectorSchema.safeParse(
    url.searchParams.get("sector") ?? "bfsi_in",
  );
  const sector = sectorParsed.success ? sectorParsed.data : "bfsi_in";
  const sources = feedSourcesForSector(sector);
  const since = advisoryWindowStart(24);

  const items = await prisma.feedItem.findMany({
    where: {
      source: { in: sources },
      OR: [
        { publishedAt: { gte: since } },
        { publishedAt: null, createdAt: { gte: since } },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      source: true,
      publisher: true,
      title: true,
      url: true,
      body: true,
      publishedAt: true,
      createdAt: true,
      cveIds: true,
      groupIds: true,
      techniqueIds: true,
    },
  });

  return NextResponse.json({
    sector,
    sources: sources.map((source) => formatFeedSource(source)),
    windowMonths: 24,
    since: since.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      source: item.source,
      sourceLabel: formatFeedSource(item.source, item.publisher),
      title: item.title,
      url: item.url,
      publishedAt: (item.publishedAt ?? item.createdAt).toISOString(),
      excerpt: item.body.slice(0, 420).trim(),
      bodyLength: item.body.length,
      cveIds: item.cveIds.slice(0, 8),
      groupIds: item.groupIds.slice(0, 6),
      techniqueIds: item.techniqueIds.slice(0, 8),
    })),
  });
}
