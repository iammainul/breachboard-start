import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { OrgCreateForm } from "@/components/org-create-form";
import { EmptyState, OrgCard, PageHero, SectionHeading } from "@/components/ui-kit";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { sectorLabel, timeAgo } from "@/lib/cn";

export default async function OrgsPage() {
  await requirePageAdmin();
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, sessions: true } },
    },
  });

  return (
    <DeskShell>
      <PageFrame className="gap-5">
        <PageHero
          variant="admin"
          eyebrow="Admin"
          title="Organizations"
          description="Clients onboarded to run tabletop exercises. Open an organization to upload its crisis management and IRC documents."
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeading
              title="Onboarded clients"
              description={`${orgs.length} organization${orgs.length === 1 ? "" : "s"}`}
            />
            {orgs.length === 0 ? (
              <EmptyState
                title="No organizations yet"
                description="Create your first client org to start seating players and running exercises."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {orgs.map((org) => (
                  <OrgCard
                    key={org.id}
                    href={`/orgs/${org.id}`}
                    name={org.name}
                    slug={org.slug}
                    sector={sectorLabel(org.sector)}
                    notes={org.notes || undefined}
                    stats={`${org._count.users} people · ${org._count.sessions} runs · ${timeAgo(org.createdAt)}`}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="min-w-0 xl:sticky xl:top-0">
            <OrgCreateForm />
          </div>
        </div>
      </PageFrame>
    </DeskShell>
  );
}
