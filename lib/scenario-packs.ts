import { slugify } from "@/lib/join-code";

export function scenarioLineageKey(title: string) {
  return slugify(title);
}

export type ScenarioClientRef = {
  id: string;
  name: string;
};

export type ScenarioPackItem = {
  id: string;
  title: string;
  status: string;
  lineageKey: string | null;
  organizationId: string | null;
  orgName: string | null;
  clients: ScenarioClientRef[];
  sector: string;
  updatedAt: Date | string;
  injectCount: number;
  roleCount: number;
  groupId?: string;
  regulatorTags: string[];
  sessionCount?: number;
};

/** Join-table clients, falling back to the legacy home organization. */
export function resolvedClientIds(
  organizationId: string | null | undefined,
  linkedIds: string[],
) {
  if (linkedIds.length > 0) return [...new Set(linkedIds)];
  return organizationId ? [organizationId] : [];
}

export function flattenScenarioRows(
  rows: ScenarioPackItem[],
  status?: string | null,
) {
  return rows
    .filter((row) => {
      if (!status || status === "all") {
        return row.status !== "retired";
      }
      return row.status === status;
    })
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function scenariosHref(params: {
  status?: string | null;
  sector?: string | null;
  tag?: string | null;
}) {
  const q = new URLSearchParams();
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.sector) q.set("sector", params.sector);
  if (params.tag) q.set("tag", params.tag);
  const s = q.toString();
  return s ? `/scenarios?${s}` : "/scenarios";
}

/** Workspace desk: this org’s accepted packs, plus drafts (this org or unassigned). */
export function exerciseVisibleToOrg(organizationId: string) {
  return {
    OR: [
      {
        status: "draft",
        OR: [{ organizationId }, { organizationId: null }],
      },
      {
        status: "accepted",
        OR: [
          { organizationId },
          { clients: { some: { organizationId } } },
        ],
      },
    ],
  };
}

export function isScenarioVisibleToWorkspaceOrg(
  row: {
    status: string;
    organizationId: string | null;
    clients: Array<{ id: string }>;
  },
  organizationId: string,
) {
  if (row.status === "draft") {
    return row.organizationId === null || row.organizationId === organizationId;
  }
  if (row.status === "accepted") {
    const ids = resolvedClientIds(
      row.organizationId,
      row.clients.map((client) => client.id),
    );
    return ids.includes(organizationId) || row.organizationId === organizationId;
  }
  return false;
}

export function acceptedExerciseVisibleToOrg(organizationId: string) {
  return {
    OR: [
      { organizationId },
      { clients: { some: { organizationId } } },
    ],
  };
}

export function packIdentity(row: {
  lineageKey: string | null;
  title: string;
  organizationId: string | null;
}) {
  const key = row.lineageKey?.trim() || scenarioLineageKey(row.title);
  return `${row.organizationId ?? "_"}:${key}`;
}

export type ScenarioPack = {
  identity: string;
  lineageKey: string;
  organizationId: string | null;
  orgName: string | null;
  accepted: ScenarioPackItem | null;
  drafts: ScenarioPackItem[];
  retired: ScenarioPackItem[];
};

export function groupScenarioPacks(rows: ScenarioPackItem[]): ScenarioPack[] {
  const map = new Map<string, ScenarioPackItem[]>();
  for (const row of rows) {
    const id = packIdentity(row);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }

  const packs: ScenarioPack[] = [];
  for (const [identity, items] of map) {
    const accepted =
      items.find((item) => item.status === "accepted") ?? null;
    const drafts = items
      .filter((item) => item.status === "draft")
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const retired = items
      .filter((item) => item.status === "retired")
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const sample = accepted ?? drafts[0] ?? retired[0];
    if (!sample) continue;
    packs.push({
      identity,
      lineageKey: sample.lineageKey?.trim() || scenarioLineageKey(sample.title),
      organizationId: sample.organizationId,
      orgName: sample.orgName,
      accepted,
      drafts,
      retired,
    });
  }

  return packs.sort((a, b) => {
    const org = (a.orgName ?? "").localeCompare(b.orgName ?? "");
    if (org !== 0) return org;
    const aDate = latestPackDate(a);
    const bDate = latestPackDate(b);
    return +bDate - +aDate;
  });
}

function latestPackDate(pack: ScenarioPack) {
  const dates = [
    pack.accepted?.updatedAt,
    ...pack.drafts.map((d) => d.updatedAt),
    ...pack.retired.map((d) => d.updatedAt),
  ].filter(Boolean) as Array<Date | string>;
  return dates.reduce(
    (max, d) => {
      const t = new Date(d);
      return t > max ? t : max;
    },
    new Date(0),
  );
}

/** Prefer the accepted pack’s slug so the live identifier moves off the retired row. */
export function transferredLineageKey(
  previous: { lineageKey: string | null } | null,
  draft: { lineageKey: string | null; title: string },
) {
  return (
    previous?.lineageKey?.trim() ||
    draft.lineageKey?.trim() ||
    scenarioLineageKey(draft.title)
  );
}

export function scenarioEditLockMessage(status: string) {
  if (status === "draft") return null;
  if (status === "accepted") {
    return "Accepted packs are locked. Fork a new draft to edit.";
  }
  return "Retired scenarios cannot be edited.";
}
