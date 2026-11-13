import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { UserCreateForm } from "@/components/user-create-form";
import { UserImportPanel } from "@/components/user-import-panel";
import { DataTable, EmptyState, PageHero, SectionHeading } from "@/components/ui-kit";
import { OperatorClientsCell } from "@/components/org-assign-picker";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function PeoplePage() {
  await requirePageAdmin();
  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [{ platformRole: "ADMIN" }, { canFacilitate: true }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        canFacilitate: true,
        createdAt: true,
        organizationId: true,
        organization: { select: { name: true } },
        assignments: {
          select: { organization: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DeskShell>
      <PageFrame className="gap-5">
        <PageHero
          variant="admin"
          eyebrow="Admin"
          title="Operators"
          description="Admins and facilitators sign in here. Participants never get accounts — they join a live run with a squad code or invite link."
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeading
              title="Desk roster"
              description={`${users.length} operator${users.length === 1 ? "" : "s"}`}
            />
            <DataTable
              columns={["Name", "Role", "Facilitate", "Clients"]}
              columnWidths={[undefined, "110px", "100px", "220px"]}
              columnClasses={["", "whitespace-nowrap", "whitespace-nowrap", ""]}
              rows={users.map((person) => [
                <div key={`${person.id}-name`} className="min-w-0">
                  <div className="truncate font-semibold text-fg">{person.name}</div>
                  <div className="truncate text-[12px] text-meta">{person.email}</div>
                </div>,
                <span key={`${person.id}-role`} className="chip chip-on">
                  {person.platformRole === "ADMIN" ? "Admin" : "Facilitator"}
                </span>,
                person.canFacilitate ? (
                  <span key={`${person.id}-fac`} className="chip chip-on">
                    Yes
                  </span>
                ) : (
                  <span key={`${person.id}-fac`} className="text-[13px] text-meta">
                    —
                  </span>
                ),
                <OperatorClientsCell
                  key={`${person.id}-org`}
                  userId={person.id}
                  organizations={organizations}
                  assignedIds={
                    person.assignments.length
                      ? person.assignments.map((row) => row.organization.id)
                      : person.organizationId
                        ? [person.organizationId]
                        : []
                  }
                />,
              ])}
              empty={
                <EmptyState
                  title="No operators yet"
                  description="Create an admin or facilitator login. Players enter via join code."
                />
              }
            />
          </section>

          <div className="grid min-w-0 items-start gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <div className="min-w-0">
              <UserCreateForm
                organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
              />
            </div>
            <div className="min-w-0">
              <UserImportPanel />
            </div>
          </div>
        </div>
      </PageFrame>
    </DeskShell>
  );
}
