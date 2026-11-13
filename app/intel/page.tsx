import { DeskShell } from "@/components/desk-shell";
import { PageFrame, StatCard } from "@/components/page-frame";
import { IntelPanel } from "@/components/intel-panel";
import { PageHero } from "@/components/ui-kit";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function IntelPage() {
  await requirePageAdmin();
  const [tactics, techniques, groups, cves, feeds, items] = await Promise.all([
    prisma.attackTactic.count(),
    prisma.attackTechnique.count(),
    prisma.attackGroup.count(),
    prisma.cveRecord.count(),
    prisma.feedItem.count(),
    prisma.feedItem.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Admin"
          title="Threat intel"
          description="ATT&CK corpus, CVE/KEV lookup, regulator advisories, and cyber news for scenario generation."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Tactics" value={tactics} />
          <StatCard label="Techniques" value={techniques} accent={techniques > 0} />
          <StatCard label="Groups" value={groups} />
          <StatCard label="CVEs" value={cves} />
          <StatCard label="Feed items" value={feeds} />
        </div>
        <IntelPanel
          initialCounts={{ tactics, techniques, groups, cves, feeds }}
          initialFeeds={items.map((f) => ({
            id: f.id,
            source: f.source,
            title: f.title,
            cveIds: f.cveIds,
            groupIds: f.groupIds,
            techniqueIds: f.techniqueIds,
            createdAt: f.createdAt.toISOString(),
          }))}
        />
      </PageFrame>
    </DeskShell>
  );
}
