import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import {
  assertPageSessionAccess,
  canManageLiveSession,
  isAdmin,
  requirePageUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";

const PresentController = dynamic(
  () =>
    import("@/components/present-controller").then((m) => m.PresentController),
  {
    loading: () => (
      <div className="flex h-dvh min-h-0 items-center justify-center p-6">
        <p className="flash-card px-5 py-3.5 text-[14px] text-muted">
          Loading Present…
        </p>
      </div>
    ),
  },
);

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  assertPageSessionAccess(user, id);
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    select: {
      id: true,
      seats: {
        select: { userId: true, kind: true, playbookRoleId: true, teamId: true },
      },
    },
  });
  if (!session) notFound();
  const seat = session.seats.find((s) => s.userId === user.id);
  if (!seat && !isAdmin(user)) notFound();
  if (!canManageLiveSession(user, seat)) {
    redirect(`/sessions/${id}`);
  }

  return <PresentController sessionId={id} />;
}
