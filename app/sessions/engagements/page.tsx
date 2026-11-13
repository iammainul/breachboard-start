import Link from "next/link";
import { DeskShell } from "@/components/desk-shell";
import { EngagementsBoard } from "@/components/engagements-board";
import { PageFrame } from "@/components/page-frame";
import { StartSessionForm } from "@/components/start-session-form";
import { EmptyState, PageHero, ShieldIcon } from "@/components/ui-kit";
import { isDeskOperator, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";
import { listVisibleOrganizations } from "@/lib/org-scope";
import { acceptedExerciseVisibleToOrg } from "@/lib/scenario-packs";
import { redirect } from "next/navigation";

export default async function EngagementsPage() {
  const user = await requirePageUser();
  if (!isDeskOperator(user)) redirect("/sessions");

  const workspaceOrgId = await getWorkspaceOrgId(user);

  const [sessions, orgs, exercises, workspaceOrg, liveCount, seatedSum, closedCount, archivedCount] =
    await Promise.all([
      workspaceOrgId
        ? prisma.exerciseSession.findMany({
            where: { runKind: "engagement", organizationId: workspaceOrgId },
            orderBy: { updatedAt: "desc" },
            include: {
              organization: true,
              exercise: true,
              _count: { select: { seats: true, answers: true } },
            },
          })
        : Promise.resolve([]),
      listVisibleOrganizations(user),
      prisma.exercise.findMany({
        where: {
          isTemplate: false,
          status: "accepted",
          ...(workspaceOrgId ? acceptedExerciseVisibleToOrg(workspaceOrgId) : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
      workspaceOrgId
        ? prisma.organization.findUnique({
            where: { id: workspaceOrgId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      workspaceOrgId
        ? prisma.exerciseSession.count({
            where: {
              runKind: "engagement",
              status: "live",
              organizationId: workspaceOrgId,
            },
          })
        : Promise.resolve(0),
      workspaceOrgId
        ? prisma.sessionSeat.count({
            where: {
              session: {
                runKind: "engagement",
                status: "live",
                organizationId: workspaceOrgId,
              },
            },
          })
        : Promise.resolve(0),
      workspaceOrgId
        ? prisma.exerciseSession.count({
            where: {
              runKind: "engagement",
              status: "closed",
              organizationId: workspaceOrgId,
            },
          })
        : Promise.resolve(0),
      workspaceOrgId
        ? prisma.exerciseSession.count({
            where: {
              runKind: "engagement",
              status: "archived",
              organizationId: workspaceOrgId,
            },
          })
        : Promise.resolve(0),
    ]);

  const rows = sessions.map((session) => ({
    id: session.id,
    status: session.status,
    joinCode: session.joinCode,
    createdAt: session.createdAt.toISOString(),
    scheduledAt: session.scheduledAt?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    closedAt: session.closedAt?.toISOString() ?? null,
    reportGeneratedAt: session.reportGeneratedAt?.toISOString() ?? null,
    organizationName: session.organization.name,
    exerciseTitle: session.exercise.title,
    seatCount: session._count.seats,
    answerCount: session._count.answers,
  }));

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Facilitated runs"
          title="Engagements"
          description={
            workspaceOrg
              ? `Runs for ${workspaceOrg.name} only. Use Active for day-to-day work; Closed and Archived keep history out of the way.`
              : "Select a working organization in the sidebar to see that client’s engagements."
          }
          actions={
            <Link href="/sessions/drafts" className="btn btn-ghost">
              Draft runs
            </Link>
          }
        />

        {!workspaceOrgId ? (
          <EmptyState
            icon={<ShieldIcon className="h-7 w-7" />}
            title="Pick a client to continue"
            description="Engagements are scoped to one working organization. Choose a client in the sidebar, or onboard one first."
            action={
              <div className="flex flex-wrap gap-2">
                <Link href="/orgs" className="btn btn-primary">
                  Organizations
                </Link>
                {orgs.length > 0 ? (
                  <p className="self-center text-[13px] text-muted">
                    Or use the Organization picker in the left sidebar.
                  </p>
                ) : null}
              </div>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <Metric label="Live now" value={liveCount} tone="live" />
              <Metric label="Seated live" value={seatedSum} tone="live" />
              <Metric label="Closed" value={closedCount} tone="closed" />
              <Metric label="Archived" value={archivedCount} tone="archived" />
            </div>

            <StartSessionForm
              organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
              exercises={exercises.map((e) => ({ id: e.id, title: e.title }))}
              defaultRunKind="engagement"
              defaultOrganizationId={workspaceOrgId}
              lockOrganization
            />

            <EngagementsBoard
              sessions={rows}
              clientName={workspaceOrg?.name ?? "Client"}
            />
          </>
        )}
      </PageFrame>
    </DeskShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "live" | "draft" | "closed" | "archived";
}) {
  const hot = value > 0;
  return (
    <div className="flash-card px-4 py-3" data-run={hot ? tone : undefined}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
        {label}
      </div>
      <div
        className={
          hot && tone === "live"
            ? "mt-0.5 text-[26px] font-bold leading-none tracking-tight text-primary-hover"
            : hot && tone === "closed"
              ? "mt-0.5 text-[26px] font-bold leading-none tracking-tight text-success"
              : hot && tone === "archived"
                ? "mt-0.5 text-[26px] font-bold leading-none tracking-tight text-muted"
                : "mt-0.5 text-[26px] font-bold leading-none tracking-tight text-fg"
        }
      >
        {value}
      </div>
    </div>
  );
}
