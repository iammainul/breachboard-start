import Link from "next/link";
import { DeskShell } from "@/components/desk-shell";
import { ControlDesk } from "@/components/control-desk";
import { CyberNewsRail } from "@/components/cyber-news-rail";
import { MissionCard } from "@/components/game-ui";
import { PageFrame, StatCard } from "@/components/page-frame";
import { EmptyState, PageHero, SectionHeading, ShieldIcon } from "@/components/ui-kit";
import { firstStageAssetPath } from "@/lib/media/first-asset";
import { isAdmin, isDeskOperator, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { seatLabel, timeAgo } from "@/lib/cn";
import { listHubNews } from "@/lib/intel/news-feeds";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";

export default async function HubPage() {
  const user = await requirePageUser();
  const admin = isAdmin(user);
  const operator = isDeskOperator(user);
  const workspaceOrgId = operator ? await getWorkspaceOrgId(user) : null;
  const orgScope = workspaceOrgId ? { organizationId: workspaceOrgId } : null;

  const [
    orgCount,
    userCount,
    scenarioCount,
    liveEngagements,
    draftLive,
    engagementSeated,
    answerCount,
    mySeats,
    ongoingEngagements,
    workspaceOrg,
    newsItems,
  ] = await Promise.all([
    admin ? prisma.organization.count() : Promise.resolve(0),
    admin ? prisma.user.count() : Promise.resolve(0),
    admin ? prisma.exercise.count() : Promise.resolve(0),
    orgScope
      ? prisma.exerciseSession.count({
          where: { status: "live", runKind: "engagement", ...orgScope },
        })
      : Promise.resolve(0),
    operator && orgScope
      ? prisma.exerciseSession.count({
          where: { status: "live", runKind: "draft", ...orgScope },
        })
      : Promise.resolve(0),
    operator && orgScope
      ? prisma.sessionSeat.count({
          where: {
            session: { status: "live", runKind: "engagement", ...orgScope },
          },
        })
      : Promise.resolve(0),
    operator && orgScope
      ? prisma.injectAnswer.count({
          where: {
            session: { status: "live", runKind: "engagement", ...orgScope },
          },
        })
      : Promise.resolve(0),
    prisma.sessionSeat.findMany({
      where: { userId: user.id },
      include: {
        session: {
          include: {
            organization: { select: { name: true } },
            exercise: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    operator && orgScope
      ? prisma.exerciseSession.findMany({
          where: {
            runKind: "engagement",
            status: { in: ["live", "draft"] },
            ...orgScope,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            organization: { select: { name: true } },
            exercise: { select: { title: true, document: true } },
            _count: { select: { seats: true, answers: true } },
          },
        })
      : Promise.resolve([]),
    workspaceOrgId
      ? prisma.organization.findUnique({
          where: { id: workspaceOrgId },
          select: { name: true },
        })
      : Promise.resolve(null),
    listHubNews(admin ? 25 : 25),
  ]);

  return (
    <DeskShell>
      <PageFrame className="gap-5">
        {operator ? (
          <ControlDesk
            orgName={workspaceOrg?.name ?? null}
            liveEngagements={liveEngagements}
            engagementSeated={engagementSeated}
            answerCount={answerCount}
            draftLive={draftLive}
            orgCount={orgCount}
            userCount={userCount}
            scenarioCount={scenarioCount}
            ongoing={ongoingEngagements.map((session) => ({
              id: session.id,
              status: session.status,
              joinCode: session.joinCode,
              createdAt: session.createdAt,
              startedAt: session.startedAt,
              organization: session.organization,
              exercise: { title: session.exercise.title },
              imageSrc: firstStageAssetPath(session.exercise.document),
              seats: session._count.seats,
              answers: session._count.answers,
            }))}
            newsItems={newsItems}
          />
        ) : (
          <>
        <PageHero
          variant="player"
          eyebrow="Your arena"
          title={`Welcome back, ${user.name.split(" ")[0]}`}
          description="Join live exercises, respond to injects, and earn points for your playbook role."
          actions={
              <Link href="/join" className="btn btn-primary">
                Enter join code
              </Link>
          }
        />

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Assigned runs"
                  value={mySeats.length}
                  hint="Exercises waiting for you"
                  icon="mission"
                />
                <StatCard
                  label="Live exercises"
                  value={liveEngagements}
                  accent={liveEngagements > 0}
                  hint={liveEngagements > 0 ? "Jump in now" : "None active"}
                  icon="live"
                />
              </div>

              <section className="flex flex-col gap-4">
                <SectionHeading
                  title="Your missions"
                  description="Exercises where you are seated"
                />
                {mySeats.length === 0 ? (
                  <EmptyState
                    icon={<ShieldIcon className="h-7 w-7" />}
                    title="No missions assigned"
                    description="Enter a join code and your name to join a squad."
                    action={
                      <Link href="/join" className="btn btn-primary">
                        Enter join code
                      </Link>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {mySeats.map((seat) => (
                      <MissionCard
                        key={seat.id}
                        href={`/sessions/${seat.session.id}`}
                        title={seat.session.exercise.title}
                        org={seat.session.organization.name}
                        meta={`${seatLabel(seat.kind)}${
                          seat.playbookRoleId ? ` · ${seat.playbookRoleId}` : " · squad"
                        } · ${timeAgo(seat.session.updatedAt)}`}
                        status={seat.session.status}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
            <CyberNewsRail items={newsItems} canGenerate={false} />
          </div>
          </>
        )}
      </PageFrame>
    </DeskShell>
  );
}
