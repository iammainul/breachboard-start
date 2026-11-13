import Link from "next/link";
import { DeskShell } from "@/components/desk-shell";
import { DraftRunsBoard } from "@/components/draft-runs-board";
import { PageFrame } from "@/components/page-frame";
import { StartSessionForm } from "@/components/start-session-form";
import { EmptyState, PageHero, ShieldIcon } from "@/components/ui-kit";
import { isDeskOperator, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";
import { listVisibleOrganizations } from "@/lib/org-scope";
import { exerciseVisibleToOrg } from "@/lib/scenario-packs";
import { redirect } from "next/navigation";

export default async function DraftRunsPage() {
  const user = await requirePageUser();
  if (!isDeskOperator(user)) redirect("/sessions");

  const workspaceOrgId = await getWorkspaceOrgId(user);

  const [sessions, orgs, exercises, workspaceOrg] = await Promise.all([
    workspaceOrgId
      ? prisma.exerciseSession.findMany({
          where: { runKind: "draft", organizationId: workspaceOrgId },
          orderBy: { updatedAt: "desc" },
          include: {
            organization: true,
            exercise: true,
            _count: { select: { seats: true } },
          },
        })
      : Promise.resolve([]),
    listVisibleOrganizations(user),
      prisma.exercise.findMany({
        where: {
          isTemplate: false,
          status: { in: ["draft", "accepted"] },
          ...(workspaceOrgId ? exerciseVisibleToOrg(workspaceOrgId) : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
    workspaceOrgId
      ? prisma.organization.findUnique({
          where: { id: workspaceOrgId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Rehearsal"
          title="Draft runs"
          description={
            workspaceOrg
              ? `Sandbox rooms for ${workspaceOrg.name}. Go-live does not require a full playbook roster.`
              : "Select a working organization in the sidebar to see that client’s draft runs."
          }
          actions={
            <Link href="/sessions/engagements" className="btn btn-ghost">
              Engagements
            </Link>
          }
        />

        {!workspaceOrgId ? (
          <EmptyState
            icon={<ShieldIcon className="h-7 w-7" />}
            title="Select a client organization"
            description="Draft runs are scoped to the working organization in the sidebar."
          />
        ) : (
          <>
            <StartSessionForm
              organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
              exercises={exercises.map((e) => ({ id: e.id, title: e.title }))}
              defaultRunKind="draft"
              defaultOrganizationId={workspaceOrgId}
              lockOrganization
            />

            <DraftRunsBoard
              clientName={workspaceOrg?.name ?? "this client"}
              sessions={sessions.map((session) => ({
                id: session.id,
                status: session.status,
                joinCode: session.joinCode,
                createdAt: session.createdAt.toISOString(),
                scheduledAt: session.scheduledAt?.toISOString() ?? null,
                startedAt: session.startedAt?.toISOString() ?? null,
                organizationName: session.organization.name,
                exerciseTitle: session.exercise.title,
                seatCount: session._count.seats,
              }))}
            />
          </>
        )}
      </PageFrame>
    </DeskShell>
  );
}
