import { prisma } from "@/lib/prisma";
import type { FeedSource } from "@prisma/client";

const CVE_RE = /CVE-\d{4}-\d{4,}/gi;
const TECH_RE = /\bT\d{4}(?:\.\d{3})?\b/g;
const GROUP_RE = /\bG\d{4}\b/g;

export async function importAdvisory(input: {
  source: FeedSource;
  title: string;
  body: string;
  url?: string;
  publisher?: string | null;
  publishedAt?: Date | null;
}) {
  const cveIds = Array.from(new Set(input.body.match(CVE_RE) ?? [])).map((s) =>
    s.toUpperCase(),
  );
  const techniqueIds = Array.from(
    new Set(input.body.toUpperCase().match(TECH_RE) ?? []),
  );
  const groupIds = Array.from(
    new Set(input.body.toUpperCase().match(GROUP_RE) ?? []),
  );

  const knownTech = await prisma.attackTechnique.findMany({
    where: { id: { in: techniqueIds } },
    select: { id: true },
  });
  const knownGroups = await prisma.attackGroup.findMany({
    where: { id: { in: groupIds } },
    select: { id: true },
  });

  const item = await prisma.feedItem.create({
    data: {
      source: input.source,
      publisher: input.publisher?.trim() || null,
      title: input.title,
      body: input.body,
      url: input.url,
      publishedAt: input.publishedAt ?? undefined,
      cveIds,
      techniqueIds: knownTech.map((t) => t.id),
      groupIds: knownGroups.map((g) => g.id),
    },
  });

  return item;
}
