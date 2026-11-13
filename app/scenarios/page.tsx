import Link from "next/link";
import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { ScenarioPackList } from "@/components/scenario-pack-list";
import {
  EmptyState,
  FilterChips,
  PageHero,
  ShieldIcon,
} from "@/components/ui-kit";
import { requirePageOperator } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listVisibleOrganizations } from "@/lib/org-scope";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import {
  exerciseVisibleToOrg,
  flattenScenarioRows,
  isScenarioVisibleToWorkspaceOrg,
  resolvedClientIds,
  scenariosHref,
} from "@/lib/scenario-packs";
import { getWorkspaceOrgId } from "@/lib/workspace-org-server";
import { SECTORS } from "@/lib/sectors";

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; tag?: string; status?: string }>;
}) {
  const user = await requirePageOperator();
  const { sector, tag, status } = await searchParams;
  const workspaceOrgId = await getWorkspaceOrgId(user);
  const [exercises, organizations] = await Promise.all([
    prisma.exercise.findMany({
      where: {
        isTemplate: false,
        ...(workspaceOrgId ? exerciseVisibleToOrg(workspaceOrgId) : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
        clients: {
          include: { organization: { select: { id: true, name: true } } },
        },
        _count: { select: { sessions: true } },
      },
    }),
    listVisibleOrganizations(user),
  ]);

  const rows = flattenScenarioRows(
    exercises.map((ex) => {
      const doc = parseExerciseDocument(ex.document);
      const linked = ex.clients.map((row) => row.organization);
      const clientIds = resolvedClientIds(
        ex.organizationId,
        linked.map((org) => org.id),
      );
      const clientById = new Map(
        [
          ...(ex.organization ? [ex.organization] : []),
          ...linked,
        ].map((org) => [org.id, org]),
      );
      const clients = clientIds
        .map((id) => clientById.get(id))
        .filter((org): org is { id: string; name: string } => Boolean(org));
      return {
        id: ex.id,
        title: ex.title,
        sector: ex.sector,
        status: ex.status,
        lineageKey: ex.lineageKey,
        organizationId: ex.organizationId,
        orgName: ex.organization?.name ?? clients[0]?.name ?? null,
        clients,
        updatedAt: ex.updatedAt.toISOString(),
        groupId: doc.success ? doc.data.attackMap.groupId : undefined,
        injectCount: doc.success ? doc.data.injects.length : 0,
        roleCount: doc.success ? doc.data.roles.length : 0,
        regulatorTags: doc.success ? doc.data.regulatorTags : [],
        sessionCount: ex._count.sessions,
      };
    }),
    status,
  )
    .filter((row) =>
      workspaceOrgId ? isScenarioVisibleToWorkspaceOrg(row, workspaceOrgId) : true,
    )
    .filter((row) => (sector ? row.sector === sector : true))
    .filter((row) => (tag ? row.regulatorTags.includes(tag) : true));

  const statusChips = [
    {
      href: scenariosHref({ sector, tag }),
      label: "All",
      active: !status,
    },
    {
      href: scenariosHref({ status: "draft", sector, tag }),
      label: "Draft",
      active: status === "draft",
    },
    {
      href: scenariosHref({ status: "accepted", sector, tag }),
      label: "Accepted",
      active: status === "accepted",
    },
  ];

  const topicChips = [
    {
      href: scenariosHref({ status }),
      label: "All sectors",
      active: !sector,
    },
    ...SECTORS.map((item) => ({
      href: scenariosHref({ status, sector: item.id }),
      label: item.label,
      active: sector === item.id,
    })),
    {
      href: scenariosHref({ status, tag: "RBI" }),
      label: "RBI",
      active: tag === "RBI",
    },
    {
      href: scenariosHref({ status, tag: "CISA" }),
      label: "CISA",
      active: tag === "CISA",
    },
  ];

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Authoring"
          title="Scenarios"
          description="Accept a draft to lock the pack, then link it to one or more clients. Engagements launch from accepted only."
          actions={
            <>
              <Link href="/library" className="btn btn-ghost">
                Library
              </Link>
              <Link href="/generate" className="btn btn-primary">
                Generate new
              </Link>
            </>
          }
        />

        <FilterChips items={[...statusChips, ...topicChips]} />

        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon className="h-7 w-7" />}
            title={status === "draft" ? "No drafts" : status === "accepted" ? "No accepted packs" : "No scenarios yet"}
            description={
              status === "accepted"
                ? "Accept a draft to lock a pack, then link it to clients."
                : "Generate a draft from threat intel, then accept it for the working organization."
            }
            action={
              <Link href="/generate" className="btn btn-primary">
                Generate
              </Link>
            }
          />
        ) : (
          <ScenarioPackList
            rows={rows}
            organizations={organizations.map((org) => ({ id: org.id, name: org.name }))}
            organizationId={workspaceOrgId}
          />
        )}
      </PageFrame>
    </DeskShell>
  );
}
