import { cookies } from "next/headers";
import type { OrgActor } from "@/lib/org-scope";
import { listVisibleOrganizations } from "@/lib/org-scope";
import { pickWorkspaceOrgId } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const WORKSPACE_ORG_COOKIE = "ttx-workspace-org";

/**
 * Server-side working organization from the Ops desk picker cookie.
 * When `user` is passed, the cookie is clamped to clients that operator can see.
 * When the cookie is empty and exactly one visible organization exists, that
 * org is returned so first-run Control / Engagements are not a blank wall.
 */
export async function getWorkspaceOrgId(user?: OrgActor | null): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.get(WORKSPACE_ORG_COOKIE)?.value?.trim() || null;

  if (user) {
    const visible = await listVisibleOrganizations(user);
    return pickWorkspaceOrgId(
      cookie,
      visible.map((org) => org.id),
    );
  }

  if (cookie) return cookie;
  const orgs = await prisma.organization.findMany({
    select: { id: true },
    take: 2,
  });
  return orgs.length === 1 ? orgs[0]!.id : null;
}
