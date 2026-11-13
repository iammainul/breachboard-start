import { isAdmin, canFacilitate, isDeskOperator, pickWorkspaceOrgId } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export { isDeskOperator, pickWorkspaceOrgId };

export type OrgActor = {
  id: string;
  platformRole: string;
  canFacilitate?: boolean | null;
  organizationId?: string | null;
};

export type VisibleOrg = {
  id: string;
  name: string;
  sector?: string;
  notes?: string;
};

/**
 * Clients this operator may work. Admins see every org. Facilitators see
 * explicit assignments, falling back to the legacy home-org field.
 */
export async function listVisibleOrganizations(
  user: OrgActor,
): Promise<VisibleOrg[]> {
  if (isAdmin(user)) {
    return prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sector: true, notes: true },
    });
  }
  if (!canFacilitate(user)) return [];

  const assigned = await prisma.orgAssignment.findMany({
    where: { userId: user.id },
    orderBy: { organization: { name: "asc" } },
    select: {
      organization: { select: { id: true, name: true, sector: true, notes: true } },
    },
  });
  if (assigned.length > 0) {
    return assigned.map((row) => row.organization);
  }
  if (user.organizationId) {
    const home = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true, sector: true, notes: true },
    });
    return home ? [home] : [];
  }
  return [];
}

export async function canAccessOrganization(user: OrgActor, organizationId: string) {
  if (isAdmin(user)) return true;
  const visible = await listVisibleOrganizations(user);
  return visible.some((org) => org.id === organizationId);
}

export async function replaceOrgAssignments(userId: string, organizationIds: string[]) {
  const unique = [...new Set(organizationIds.filter(Boolean))];
  await prisma.$transaction([
    prisma.orgAssignment.deleteMany({ where: { userId } }),
    ...(unique.length
      ? [
          prisma.orgAssignment.createMany({
            data: unique.map((organizationId) => ({ userId, organizationId })),
            skipDuplicates: true,
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: { organizationId: unique[0] ?? null },
    }),
  ]);
}
