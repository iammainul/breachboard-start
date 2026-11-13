import { DeskShell } from "@/components/desk-shell";
import { MissionCard } from "@/components/game-ui";
import { PageFrame } from "@/components/page-frame";
import { EmptyState, PageHero, SectionHeading, ShieldIcon } from "@/components/ui-kit";
import { isAdmin, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { seatLabel } from "@/lib/cn";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SessionsPage() {
  const user = await requirePageUser();
  const admin = isAdmin(user);
  if (admin) redirect("/sessions/engagements");

  const sessions = await prisma.exerciseSession.findMany({
    where: { seats: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      organization: true,
      exercise: true,
      seats: { where: { userId: user.id } },
      _count: { select: { seats: true } },
    },
  });

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="player"
          eyebrow="Your runs"
          title="My missions"
          description="Open a run to respond to injects. Join with your name even without a playbook role."
          actions={
            <Link href="/join" className="btn btn-primary">
              Enter join code
            </Link>
          }
        />

        <section className="flex flex-col gap-3">
          <SectionHeading title="Assigned runs" description={`${sessions.length} total`} />
          {sessions.length === 0 ? (
            <EmptyState
              icon={<ShieldIcon className="h-7 w-7" />}
              title="No runs yet"
              description="Enter a join code and your name to join a squad."
            />
          ) : (
            <div className="grid gap-2.5 xl:grid-cols-2">
              {sessions.map((session) => {
                const mySeat = session.seats[0];
                return (
                  <MissionCard
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    title={session.exercise.title}
                    org={session.organization.name}
                    meta={`Join ${session.joinCode} · ${session._count.seats} seated${
                      mySeat
                        ? ` · ${seatLabel(mySeat.kind)}${
                            mySeat.playbookRoleId ? "" : " · squad"
                          }`
                        : ""
                    }`}
                    status={session.status}
                  />
                );
              })}
            </div>
          )}
        </section>
      </PageFrame>
    </DeskShell>
  );
}
