import { AppShell } from "@/components/app-shell";
import { WorkspaceOrgProvider } from "@/components/workspace-org";
import { isAdmin, canFacilitate, requirePageUser } from "@/lib/access";
import { listVisibleOrganizations } from "@/lib/org-scope";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";

export async function DeskShell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const admin = isAdmin(user);
  const facilitator = canFacilitate(user);
  const [organizations, initialOrgId] = await Promise.all([
    admin || facilitator ? listVisibleOrganizations(user) : Promise.resolve([]),
    getWorkspaceOrgId(user),
  ]);

  return (
    <WorkspaceOrgProvider
      organizations={organizations}
      initialOrgId={
        initialOrgId && organizations.some((o) => o.id === initialOrgId)
          ? initialOrgId
          : null
      }
    >
      <AppShell
        userEmail={user.email}
        userName={user.name}
        isAdmin={admin}
        canFacilitate={facilitator}
      >
        {children}
      </AppShell>
    </WorkspaceOrgProvider>
  );
}
