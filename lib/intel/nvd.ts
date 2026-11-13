import { prisma } from "@/lib/prisma";

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

type NvdResponse = {
  vulnerabilities?: {
    cve: {
      id: string;
      published?: string;
      descriptions?: { lang: string; value: string }[];
      metrics?: {
        cvssMetricV31?: { cvssData?: { baseScore?: number } }[];
        cvssMetricV40?: { cvssData?: { baseScore?: number } }[];
      };
    };
  }[];
};

function normalizeCveId(value: string) {
  const match = value.toUpperCase().match(/CVE-\d{4}-\d{4,}/);
  return match?.[0] ?? null;
}

async function kevSet() {
  try {
    const response = await fetch(KEV_URL, { next: { revalidate: 3600 } });
    if (!response.ok) return new Set<string>();
    const json = (await response.json()) as {
      vulnerabilities?: { cveID?: string }[];
    };
    return new Set(
      (json.vulnerabilities ?? [])
        .map((v) => v.cveID)
        .filter((id): id is string => Boolean(id)),
    );
  } catch {
    return new Set<string>();
  }
}

export async function lookupCve(rawId: string) {
  const id = normalizeCveId(rawId);
  if (!id) return null;

  const cached = await prisma.cveRecord.findUnique({ where: { id } });
  if (cached && Date.now() - cached.updatedAt.getTime() < 24 * 60 * 60 * 1000) {
    return cached;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.NVD_API_KEY) {
    headers["apiKey"] = process.env.NVD_API_KEY;
  }

  const response = await fetch(`${NVD_URL}?cveId=${id}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return cached;
  }

  const json = (await response.json()) as NvdResponse;
  const cve = json.vulnerabilities?.[0]?.cve;
  if (!cve) return cached;

  const description =
    cve.descriptions?.find((d) => d.lang === "en")?.value ??
    cve.descriptions?.[0]?.value ??
    "";
  const cvss =
    cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ??
    cve.metrics?.cvssMetricV40?.[0]?.cvssData?.baseScore ??
    null;
  const kev = (await kevSet()).has(id);

  return prisma.cveRecord.upsert({
    where: { id },
    create: {
      id,
      description,
      cvss,
      kev,
      publishedAt: cve.published ? new Date(cve.published) : null,
      raw: json as object,
    },
    update: {
      description,
      cvss,
      kev,
      publishedAt: cve.published ? new Date(cve.published) : null,
      raw: json as object,
    },
  });
}
