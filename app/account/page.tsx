import { DeskShell } from "@/components/desk-shell";
import { AccountPanel } from "@/components/account-panel";
import { PageFrame } from "@/components/page-frame";
import { PageHero } from "@/components/ui-kit";
import { requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
  const actor = await requirePageUser();
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      name: true,
      email: true,
      platformRole: true,
      canFacilitate: true,
      totpEnabled: true,
      passwordHash: true,
      organization: { select: { name: true } },
      assignments: {
        select: { organization: { select: { id: true, name: true } } },
        orderBy: { organization: { name: "asc" } },
      },
    },
  });
  if (!user) return null;

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          eyebrow="Account"
          title="Profile & security"
          description="Update how you appear on the desk, rotate your password, and add an authenticator."
        />
        <AccountPanel
          profile={{
            name: user.name,
            email: user.email,
            platformRole: user.platformRole,
            canFacilitate: user.canFacilitate,
            totpEnabled: user.totpEnabled,
            hasPassword: Boolean(user.passwordHash),
            homeOrg: user.organization?.name ?? null,
            clients: user.assignments.map((row) => row.organization),
          }}
        />
      </PageFrame>
    </DeskShell>
  );
}
