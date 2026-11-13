import type { FeedSource } from "@prisma/client";
import { importAdvisory } from "@/lib/intel/import";
import { feedUserAgent, parseFeedEntries, decodeFeedText } from "@/lib/intel/rss";
import { prisma } from "@/lib/prisma";

export type NewsOutlet = {
  id: string;
  publisher: string;
  source: FeedSource;
  url: string;
};

/** Public RSS from well-known gov and independent cyber outlets. */
export const CYBER_NEWS_OUTLETS: NewsOutlet[] = [
  {
    id: "cisa",
    publisher: "CISA",
    source: "NEWS",
    url: "https://www.cisa.gov/news.xml",
  },
  {
    id: "ncsc",
    publisher: "NCSC",
    source: "NEWS",
    url: "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml",
  },
  {
    id: "krebs",
    publisher: "Krebs on Security",
    source: "NEWS",
    url: "https://krebsonsecurity.com/feed/",
  },
  {
    id: "bleeping",
    publisher: "BleepingComputer",
    source: "NEWS",
    url: "https://www.bleepingcomputer.com/feed/",
  },
  {
    id: "record",
    publisher: "The Record",
    source: "NEWS",
    url: "https://therecord.media/feed",
  },
  {
    id: "thn",
    publisher: "The Hacker News",
    source: "NEWS",
    url: "https://feeds.feedburner.com/TheHackersNews",
  },
  {
    id: "dark-reading",
    publisher: "Dark Reading",
    source: "NEWS",
    url: "https://www.darkreading.com/rss.xml",
  },
];

const PER_FEED = 8;

export type NewsIngestResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function ingestCyberNewsFeeds(): Promise<NewsIngestResult> {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const outlet of CYBER_NEWS_OUTLETS) {
    try {
      const response = await fetch(outlet.url, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
          "User-Agent": feedUserAgent(),
        },
        next: { revalidate: 0 },
      });
      if (!response.ok) {
        errors.push(`${outlet.publisher}: HTTP ${response.status}`);
        continue;
      }
      const xml = await response.text();
      const entries = parseFeedEntries(xml, PER_FEED);
      for (const entry of entries) {
        const existing = await prisma.feedItem.findFirst({
          where: { url: entry.link },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        await importAdvisory({
          source: outlet.source,
          publisher: outlet.publisher,
          title: entry.title,
          body: entry.description,
          url: entry.link,
          publishedAt: entry.publishedAt,
        });
        created += 1;
      }
    } catch (error) {
      errors.push(
        `${outlet.publisher}: ${error instanceof Error ? error.message : "fetch failed"}`,
      );
    }
  }

  return { created, skipped, errors };
}

export function formatNewsPublisher(
  source: string,
  publisher?: string | null,
) {
  if (publisher?.trim()) return publisher.trim();
  if (source === "CERT_IN") return "CERT-In";
  if (source === "NEWS") return "Cyber news";
  return source;
}

export type HubNewsItem = {
  id: string;
  publisher: string;
  title: string;
  url: string | null;
  excerpt: string;
  publishedAt: string;
  cveIds: string[];
};

const MAX_PER_PUBLISHER = 3;

function diversifyByPublisher<T extends { publisher: string }>(
  items: T[],
  take: number,
  maxPer = MAX_PER_PUBLISHER,
): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = item.publisher || "Cyber news";
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const out: T[] = [];
  let round = 0;
  while (out.length < take) {
    let added = false;
    for (const list of buckets.values()) {
      if (round < list.length && round < maxPer) {
        out.push(list[round]!);
        added = true;
        if (out.length >= take) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return out;
}

export async function listHubNews(take = 18): Promise<HubNewsItem[]> {
  const items = await prisma.feedItem.findMany({
    where: { source: "NEWS" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(take * 6, 80),
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
    },
  });

  const mapped = items.map((item) => ({
    id: item.id,
    publisher: formatNewsPublisher(item.source, item.publisher),
    title: decodeFeedText(item.title),
    url: item.url,
    excerpt: decodeFeedText(item.body.slice(0, 180)).trim(),
    publishedAt: (item.publishedAt ?? item.createdAt).toISOString(),
    cveIds: item.cveIds.slice(0, 4),
  }));

  return diversifyByPublisher(mapped, take, Math.max(MAX_PER_PUBLISHER, Math.ceil(take / 4)));
}
