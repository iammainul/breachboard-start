"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrgAssignPicker } from "@/components/org-assign-picker";
import { DataTable } from "@/components/ui-kit";
import { sectorLabel, timeAgo } from "@/lib/cn";
import { resolvedClientIds, type ScenarioPackItem } from "@/lib/scenario-packs";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.5 3a1 1 0 011-1h3a1 1 0 011 1H16a1 1 0 110 2h-1v10.5A1.5 1.5 0 0113.5 16h-7A1.5 1.5 0 015 14.5V5H4a1 1 0 110-2h3.5zM7 5v9h6V5H7zm2 2a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0V7zm3 0a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0V7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function statusBadge(status: string) {
  if (status === "accepted") return "Accepted";
  if (status === "retired") return "Retired";
  return "Draft";
}

function clientLabels(row: ScenarioPackItem) {
  if (row.clients.length > 0) return row.clients.map((c) => c.name);
  if (row.orgName) return [row.orgName];
  return [];
}

export function ScenarioPackList({
  rows,
  organizations,
  organizationId,
}: {
  rows: ScenarioPackItem[];
  organizations: { id: string; name: string }[];
  organizationId: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  async function accept(id: string) {
    if (!organizationId) {
      setError("Select a working organization in the sidebar, then accept.");
      return;
    }
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/scenarios/${id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    setBusyId(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not accept scenario");
      return;
    }
    router.refresh();
  }

  async function remove(row: ScenarioPackItem) {
    const label = row.status === "draft" ? "draft" : "scenario";
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    setBusyId(row.id);
    setError(null);
    const response = await fetch(`/api/scenarios/${row.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not delete scenario");
      return;
    }
    if (linkingId === row.id) setLinkingId(null);
    router.refresh();
  }

  if (rows.length === 0) return null;

  const linkingRow = rows.find((row) => row.id === linkingId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      <DataTable
        dense
        columns={["Scenario", "Status", "Clients", "Size", "Updated", "Actions"]}
        columnWidths={["", "92px", "200px", "140px", "88px", "128px"]}
        columnClasses={[
          "min-w-0",
          "whitespace-nowrap",
          "min-w-0",
          "whitespace-nowrap text-muted",
          "whitespace-nowrap text-meta",
          "text-right",
        ]}
        rows={rows.map((row) => {
          const labels = clientLabels(row);
          const busy = busyId === row.id;
          return [
            <div key={`${row.id}-title`} className="min-w-0">
              <Link
                href={`/scenarios/${row.id}`}
                className="block truncate font-semibold text-fg hover:text-primary-hover hover:underline"
              >
                {row.title}
              </Link>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-meta">
                <span>{sectorLabel(row.sector)}</span>
                {row.groupId ? (
                  <span className="font-mono">{row.groupId}</span>
                ) : null}
                {row.regulatorTags.map((tag) => (
                  <span key={tag} className="chip chip-on h-5 px-1.5 text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>,
            <span key={`${row.id}-status`} className="chip chip-on">
              {statusBadge(row.status)}
            </span>,
            <div key={`${row.id}-clients`} className="flex min-w-0 flex-wrap gap-1">
              {labels.length ? (
                labels.map((label) => (
                  <span key={label} className="chip chip-on h-5 max-w-full truncate px-1.5 text-[10px]">
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-meta">Unassigned</span>
              )}
            </div>,
            <span key={`${row.id}-size`}>
              {row.injectCount} injects · {row.roleCount} roles
            </span>,
            <span key={`${row.id}-updated`}>{timeAgo(new Date(row.updatedAt))}</span>,
            <div
              key={`${row.id}-actions`}
              className="flex items-center justify-end gap-1"
            >
              {row.status === "draft" ? (
                <button
                  type="button"
                  className="btn btn-primary h-8 w-8 p-0 disabled:opacity-50"
                  disabled={busy}
                  aria-label="Accept draft"
                  title="Accept"
                  onClick={() => void accept(row.id)}
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              ) : null}
              {row.status === "accepted" ? (
                <button
                  type="button"
                  className="btn btn-ghost h-8 px-2.5 text-[12px] disabled:opacity-50"
                  disabled={busy}
                  aria-expanded={linkingId === row.id}
                  onClick={() =>
                    setLinkingId((current) => (current === row.id ? null : row.id))
                  }
                >
                  Link
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-danger h-8 w-8 p-0 disabled:opacity-50"
                disabled={busy}
                aria-label="Delete scenario"
                title="Delete"
                onClick={() => void remove(row)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>,
          ];
        })}
      />
      {linkingRow ? (
        <LinkClientsPanel
          row={linkingRow}
          organizations={organizations}
          busy={busyId === linkingRow.id}
          onBusy={(pending) => setBusyId(pending ? linkingRow.id : null)}
          onError={setError}
          onClose={() => setLinkingId(null)}
        />
      ) : null}
    </div>
  );
}

function LinkClientsPanel({
  row,
  organizations,
  busy,
  onBusy,
  onError,
  onClose,
}: {
  row: ScenarioPackItem;
  organizations: { id: string; name: string }[];
  busy: boolean;
  onBusy: (pending: boolean) => void;
  onError: (message: string | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [ids, setIds] = useState(() =>
    resolvedClientIds(
      row.organizationId,
      row.clients.map((c) => c.id),
    ),
  );

  async function save() {
    onBusy(true);
    onError(null);
    const response = await fetch(`/api/scenarios/${row.id}/clients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationIds: ids }),
    });
    onBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      onError(json.error ?? "Could not link clients");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="flash-card flex flex-col gap-3 p-4 sm:max-w-md">
      <div>
        <h3 className="text-[14px] font-semibold text-fg">Link to clients</h3>
        <p className="mt-0.5 text-[12px] text-muted">
          {row.title} — engagements can launch this pack for every selected client.
        </p>
      </div>
      <OrgAssignPicker
        organizations={organizations}
        name={undefined}
        selectedIds={ids}
        onChange={setIds}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary h-9 px-3 text-[13px] disabled:opacity-50"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save clients"}
        </button>
        <button
          type="button"
          className="btn btn-ghost h-9 px-3 text-[13px]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
