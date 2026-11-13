import { prisma } from "@/lib/prisma";
import { importAdvisory } from "@/lib/intel/import";
import { seedMinimalAttack } from "@/lib/attack/seed";
import {
  SETTING_INTEL_LAST_RUN,
  getAppSetting,
  setAppSetting,
} from "@/lib/app-settings";
import { autoOnboardIntelEnabled } from "@/lib/ai/provider-status";
import { ingestCyberNewsFeeds } from "@/lib/intel/news-feeds";

export const KEV_FEED_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const CISA_ALERTS_RSS_URL =
  "https://www.cisa.gov/cybersecurity-advisories/all.xml";

const KEV_LIMIT = 25;

type KevFeed = {
  vulnerabilities?: {
    cveID?: string;
    vendorProject?: string;
    product?: string;
    shortDescription?: string;
    dateAdded?: string;
    requiredAction?: string;
  }[];
};

export type AutoOnboardResult = {
  skipped: boolean;
  reason?: string;
  attackSeeded: boolean;
  kevUpserted: number;
  kevFeedsCreated: number;
  rssCreated: number;
  newsCreated: number;
  newsErrors: string[];
  lastRunAt: string | null;
};

async function ensureAttackSeeded() {
  const count = await prisma.attackTechnique.count();
  if (count > 0) return false;
  await seedMinimalAttack();
  return true;
}

async function upsertKevBatch(): Promise<{ upserted: number; feeds: number }> {
  const response = await fetch(KEV_FEED_URL, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`KEV fetch failed (${response.status})`);
  }
  const json = (await response.json()) as KevFeed;
  const items = (json.vulnerabilities ?? [])
    .filter((v) => v.cveID)
    .slice(0, KEV_LIMIT);

  let upserted = 0;
  let feeds = 0;

  for (const item of items) {
    const id = item.cveID!.toUpperCase();
    const description =
      item.shortDescription?.trim() ||
      `${item.vendorProject ?? "Unknown"} / ${item.product ?? "product"} — KEV`;
    await prisma.cveRecord.upsert({
      where: { id },
      create: {
        id,
        description,
        cvss: null,
        kev: true,
        publishedAt: item.dateAdded ? new Date(item.dateAdded) : null,
        raw: item as object,
      },
      update: {
        description,
        kev: true,
        publishedAt: item.dateAdded ? new Date(item.dateAdded) : null,
        raw: item as object,
      },
    });
    upserted += 1;

    const title = `CISA KEV: ${id}`;
    const url = `https://nvd.nist.gov/vuln/detail/${id}`;
    const existing = await prisma.feedItem.findFirst({
      where: { OR: [{ url }, { title }] },
    });
    if (existing) continue;

    const body = [
      description,
      item.requiredAction ? `Required action: ${item.requiredAction}` : "",
      `CVE: ${id}`,
      item.vendorProject ? `Vendor: ${item.vendorProject}` : "",
      item.product ? `Product: ${item.product}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await importAdvisory({
      source: "CISA",
      title,
      body,
      url,
    });
    feeds += 1;
  }

  return { upserted, feeds };
}

export async function runAutoOnboardIntel(opts?: {
  force?: boolean;
}): Promise<AutoOnboardResult> {
  const lastRunAt = await getAppSetting<string>(SETTING_INTEL_LAST_RUN);

  if (!autoOnboardIntelEnabled() && !opts?.force) {
    return {
      skipped: true,
      reason: "AUTO_ONBOARD_INTEL is disabled",
      attackSeeded: false,
      kevUpserted: 0,
      kevFeedsCreated: 0,
      rssCreated: 0,
      newsCreated: 0,
      newsErrors: [],
      lastRunAt,
    };
  }

  if (lastRunAt && !opts?.force) {
    const ageMs = Date.now() - Date.parse(lastRunAt);
    // Skip re-run within 12h unless forced
    if (!Number.isNaN(ageMs) && ageMs < 12 * 60 * 60 * 1000) {
      return {
        skipped: true,
        reason: "Intel already synced recently (use force to re-run)",
        attackSeeded: false,
        kevUpserted: 0,
        kevFeedsCreated: 0,
        rssCreated: 0,
        newsCreated: 0,
        newsErrors: [],
        lastRunAt,
      };
    }
  }

  const attackSeeded = await ensureAttackSeeded();
  let kevUpserted = 0;
  let kevFeedsCreated = 0;
  let rssCreated = 0;
  let newsCreated = 0;
  const errors: string[] = [];
  let newsErrors: string[] = [];

  try {
    const kev = await upsertKevBatch();
    kevUpserted = kev.upserted;
    kevFeedsCreated = kev.feeds;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "KEV failed");
  }

  try {
    const news = await ingestCyberNewsFeeds();
    rssCreated = news.created;
    newsCreated = news.created;
    newsErrors = news.errors;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "News RSS failed");
  }

  const now = new Date().toISOString();
  await setAppSetting(SETTING_INTEL_LAST_RUN, now);

  if (errors.length && kevUpserted === 0 && rssCreated === 0) {
    throw new Error(errors.join("; "));
  }

  return {
    skipped: false,
    reason: errors.length ? errors.join("; ") : undefined,
    attackSeeded,
    kevUpserted,
    kevFeedsCreated,
    rssCreated,
    newsCreated,
    newsErrors,
    lastRunAt: now,
  };
}
