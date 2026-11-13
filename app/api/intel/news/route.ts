import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  formatNewsPublisher,
  ingestCyberNewsFeeds,
  listHubNews,
} from "@/lib/intel/news-feeds";
import { decodeFeedText } from "@/lib/intel/rss";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const items = await prisma.feedItem.findMany({
    where: { source: "NEWS" },
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
    items: items.map((item) => ({
      id: item.id,
      source: item.source,
      sourceLabel: formatNewsPublisher(item.source, item.publisher),
      title: decodeFeedText(item.title),
      url: item.url,
      publishedAt: (item.publishedAt ?? item.createdAt).toISOString(),
      excerpt: decodeFeedText(item.body.slice(0, 420)).trim(),
      bodyLength: item.body.length,
      cveIds: item.cveIds.slice(0, 8),
      groupIds: item.groupIds.slice(0, 6),
      techniqueIds: item.techniqueIds.slice(0, 8),
    })),
  });
}

export async function POST() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  try {
    const result = await ingestCyberNewsFeeds();
    const items = await listHubNews(25);
    return NextResponse.json({ ...result, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "News ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
