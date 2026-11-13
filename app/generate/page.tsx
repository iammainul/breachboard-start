import Link from "next/link";
import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { GenerateForm } from "@/components/generate-form";
import { InjectGenerateForm } from "@/components/inject-generate-form";
import {
  DataTable,
  EmptyState,
  PageHero,
  SectionHeading,
  ShieldIcon,
} from "@/components/ui-kit";
import { cn } from "@/lib/cn";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listCatalogInjects, type CatalogInject } from "@/lib/inject-catalog";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; mode?: string }>;
}) {
  const user = await requirePageAdmin();
  const { feed, mode: rawMode } = await searchParams;
  const mode = rawMode === "inject" ? "inject" : "scenario";
  const workspaceOrgId = await getWorkspaceOrgId(user);

  const [groups, orgs, injects] = await Promise.all([
    prisma.attackGroup.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { techniques: true } } },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    mode === "inject" ? listCatalogInjects(workspaceOrgId) : Promise.resolve([]),
  ]);

  const scenarioHref = feed
    ? `/generate?feed=${encodeURIComponent(feed)}`
    : "/generate";

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Authoring"
          title="Generate"
          description={
            mode === "inject"
              ? "Draft one portable inject with {{org}} / {{team}} tokens, or reuse a catalog inject in a SitMan."
              : "Open a middle-column card when you want to pick injects, APTs, news, or advisories. Collapse the rest."
          }
          actions={
            <Link href="/library" className="btn btn-ghost">
              Start from library
            </Link>
          }
        />

        <div
          className="glass-inset flex w-fit flex-wrap gap-1 rounded-xl p-1"
          role="tablist"
          aria-label="Generate tool"
        >
          <Link
            href={scenarioHref}
            role="tab"
            aria-selected={mode === "scenario"}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              mode === "scenario"
                ? "bg-primary text-primary-fg"
                : "text-muted hover:text-fg",
            )}
          >
            Scenario
          </Link>
          <Link
            href="/generate?mode=inject"
            role="tab"
            aria-selected={mode === "inject"}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              mode === "inject"
                ? "bg-primary text-primary-fg"
                : "text-muted hover:text-fg",
            )}
          >
            Inject
          </Link>
        </div>

        {mode === "inject" ? (
          <InjectMode organizations={orgs} injects={injects} />
        ) : (
          <GenerateForm
            organizations={orgs}
            initialFeedId={feed}
            initialGroups={groups.map((g) => ({
              id: g.id,
              name: g.name,
              aliases: g.aliases,
              description: g.description,
              techniqueCount: g._count.techniques,
            }))}
          />
        )}
      </PageFrame>
    </DeskShell>
  );
}

function InjectMode({
  organizations,
  injects,
}: {
  organizations: { id: string; name: string }[];
  injects: CatalogInject[];
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeading
          title="Catalog"
          description={`${injects.length} inject${injects.length === 1 ? "" : "s"}`}
        />
        <DataTable
          dense
          columns={["Inject", "Source", "ATT&CK", "Questions"]}
          columnWidths={[undefined, "220px", "160px", "90px"]}
          columnClasses={["", "", "font-mono", "whitespace-nowrap"]}
          rows={injects.map((inject) => [
            <div key={`${inject.sourceId}-${inject.injectId}-title`}>
              <div className="font-semibold text-fg">{inject.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[12px] text-meta">
                {inject.body}
              </div>
            </div>,
            <Link
              key={`${inject.sourceId}-${inject.injectId}-src`}
              href={`/scenarios/${inject.sourceId}`}
              className="text-primary-hover hover:underline"
            >
              <span className="block font-medium">{inject.sourceTitle}</span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-meta">
                {inject.sourceKind} · {inject.status}
              </span>
            </Link>,
            <span key={`${inject.sourceId}-${inject.injectId}-tech`}>
              {inject.techniqueIds.slice(0, 3).join(" ") || "—"}
            </span>,
            <span key={`${inject.sourceId}-${inject.injectId}-q`}>
              {inject.questionCount}
            </span>,
          ])}
          empty={
            <EmptyState
              icon={<ShieldIcon className="h-7 w-7" />}
              title="No injects yet"
              description="Generate one here, or author a scenario — they show up to mix into a SitMan."
            />
          }
        />
      </section>
      <InjectGenerateForm organizations={organizations} />
    </div>
  );
}
