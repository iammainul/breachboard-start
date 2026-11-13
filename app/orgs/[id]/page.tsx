import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { OrgPlanDocs } from "@/components/org-plan-docs";
import { PageFrame } from "@/components/page-frame";
import { EmptyState, PageHero, SectionHeading } from "@/components/ui-kit";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime, sectorLabel } from "@/lib/cn";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAdmin();
  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, sessions: true, exercises: true } },
      sessions: {
        where: { runKind: "engagement", status: { in: ["closed", "archived"] } },
        orderBy: { closedAt: "desc" },
        take: 12,
        select: {
          id: true,
          joinCode: true,
          status: true,
          closedAt: true,
          reportGeneratedAt: true,
          exercise: { select: { title: true } },
        },
      },
    },
  });
  if (!org) notFound();

  return (
    <DeskShell>
      <PageFrame className="gap-5">
        <PageHero
          variant="admin"
          eyebrow="Organization"
          title={org.name}
          description={`${sectorLabel(org.sector)} · ${org.slug}. Crisis and IRC documents grade inject answers for this client.`}
          actions={
            <Link href="/orgs" className="btn btn-ghost">
              All organizations
            </Link>
          }
        />

        {org.notes ? (
          <p className="glass-inset rounded-[var(--radius)] px-4 py-3 text-[14px] leading-relaxed text-muted">
            {org.notes}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Operators" value={org._count.users} />
          <Metric label="Scenarios" value={org._count.exercises} />
          <Metric label="Runs" value={org._count.sessions} />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeading
              title="Stored after-action reports"
              description="Closed and archived engagements keep a snapshot of scores and answers."
            />
            {org.sessions.length === 0 ? (
              <EmptyState
                title="No final reports yet"
                description="End an engagement to store the after-action report for this organization."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {org.sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/sessions/${session.id}/report`}
                      className="flash-card flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-fg">
                          {session.exercise.title}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-meta">
                          {session.joinCode} · {session.status}
                          {session.closedAt
                            ? ` · Closed ${formatDateTime(session.closedAt.toISOString())}`
                            : ""}
                          {session.reportGeneratedAt
                            ? ` · Report ${formatDateTime(session.reportGeneratedAt.toISOString())}`
                            : " · Report pending"}
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] text-primary">Open report</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="min-w-0 xl:sticky xl:top-0">
            <OrgPlanDocs
              organizationId={org.id}
              crisisDocName={org.crisisDocName}
              crisisDocPath={org.crisisDocPath}
              ircDocName={org.ircDocName}
              ircDocPath={org.ircDocPath}
              documentRetentionDays={org.documentRetentionDays}
            />
          </div>
        </div>
      </PageFrame>
    </DeskShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flash-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
        {label}
      </div>
      <div className="mt-0.5 text-[26px] font-bold leading-none tabular-nums tracking-tight text-fg">
        {value}
      </div>
    </div>
  );
}
