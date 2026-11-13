"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, EmptyState, FieldLabel, SectionHeading } from "@/components/ui-kit";
import { formatDateTime } from "@/lib/cn";

type DocRow = {
  id: string;
  organizationName: string | null;
  sessionJoinCode: string | null;
  kind: string;
  originalName: string;
  status: "active" | "soft_deleted" | "hard_deleted";
  retentionDays: number;
  expiry: string;
  retainUntil: string | null;
  extractStatus: string;
  softDeleteReason: string | null;
  createdAt: string;
  downloadable: boolean;
};

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  organizationName: string | null;
  actorName: string | null;
  actorEmail: string | null;
  target: string;
  reason: string | null;
  documentId: string | null;
};

function statusChip(status: DocRow["status"]) {
  if (status === "active") return <span className="chip chip-on">Active</span>;
  if (status === "soft_deleted") {
    return <span className="chip text-warn">Soft-deleted</span>;
  }
  return <span className="chip">Purged</span>;
}

function expiryLabel(doc: DocRow) {
  if (doc.status === "hard_deleted") return "Purged";
  if (doc.expiry.startsWith("on_close_plus_")) {
    return `Close + ${doc.retentionDays}d`;
  }
  return formatDateTime(doc.expiry) ?? doc.expiry;
}

export function UploadsAdmin() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [includeHardDeleted, setIncludeHardDeleted] = useState(false);
  const [reason, setReason] = useState("admin");

  const load = useCallback(async () => {
    setError(null);
    const [docRes, auditRes] = await Promise.all([
      fetch(
        `/api/admin/documents?includeSoftDeleted=1&includeHardDeleted=${includeHardDeleted ? "1" : "0"}`,
      ),
      fetch("/api/admin/documents/audit"),
    ]);
    const docJson = await docRes.json().catch(() => ({}));
    const auditJson = await auditRes.json().catch(() => ({}));
    if (!docRes.ok) {
      setError(docJson.error ?? "Could not load uploads");
      return;
    }
    if (!auditRes.ok) {
      setError(auditJson.error ?? "Could not load audit log");
      return;
    }
    setDocs(docJson.documents ?? []);
    setEvents(auditJson.events ?? []);
  }, [includeHardDeleted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void load();
  }, [load]);

  async function act(id: string, action: "soft-delete" | "restore" | "hard-delete") {
    if (action === "hard-delete") {
      const ok = window.confirm(
        "Hard-delete removes file bytes and extracted text. Audit rows stay. Continue?",
      );
      if (!ok) return;
    }
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/admin/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason.trim() || "admin" }),
    });
    const json = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setError(json.error ?? "Action failed");
      return;
    }
    await load();
  }

  const counts = useMemo(() => {
    return {
      active: docs.filter((d) => d.status === "active").length,
      soft: docs.filter((d) => d.status === "soft_deleted").length,
      hard: docs.filter((d) => d.status === "hard_deleted").length,
    };
  }, [docs]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active" value={counts.active} />
        <Metric label="Restorable" value={counts.soft} />
        <Metric label="Purged (this page)" value={counts.hard} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Client uploads"
          description="IRP and CCMP files. Soft-deleted rows are hidden from grading and every non-admin API until purge."
          action={
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={includeHardDeleted}
                onChange={(event) => setIncludeHardDeleted(event.target.checked)}
              />
              Show purged
            </label>
          }
        />
        <FieldLabel label="Reason stamped on admin actions" hint="Stored on the audit row. Not shown to participants.">
          <input
            className="field w-full max-w-md font-mono text-[13px]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={240}
          />
        </FieldLabel>
        {error ? (
          <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <DataTable
          dense
          columns={[
            "File",
            "Org",
            "Kind",
            "Status",
            "Extract",
            "Retention",
            "Actions",
          ]}
          empty={
            <EmptyState
              title="No client documents"
              description="Upload an IRP or CCMP from the organization page. Closed engagements soft-delete standing plans."
            />
          }
          rows={docs.map((doc) => [
            <div key={`${doc.id}-file`} className="min-w-0">
              <div className="truncate font-semibold text-fg">{doc.originalName}</div>
              <div className="truncate font-mono text-[11px] text-meta">
                {doc.id}
                {doc.sessionJoinCode ? ` · ${doc.sessionJoinCode}` : ""}
              </div>
            </div>,
            <span key={`${doc.id}-org`} className="truncate">
              {doc.organizationName ?? "—"}
            </span>,
            <span key={`${doc.id}-kind`} className="font-mono text-[12px]">
              {doc.kind}
            </span>,
            statusChip(doc.status),
            <span key={`${doc.id}-ex`} className="font-mono text-[12px] text-meta">
              {doc.extractStatus}
            </span>,
            <div key={`${doc.id}-ret`} className="text-[12px] text-muted">
              <div>{doc.retentionDays}d</div>
              <div className="font-mono text-[11px] text-meta">{expiryLabel(doc)}</div>
            </div>,
            <div key={`${doc.id}-act`} className="flex flex-wrap gap-1.5">
              {doc.downloadable ? (
                <a
                  className="btn btn-ghost h-8 px-2 text-[12px]"
                  href={`/api/admin/documents/${doc.id}/file`}
                >
                  Download
                </a>
              ) : null}
              {doc.status === "active" ? (
                <button
                  type="button"
                  className="btn btn-ghost h-8 px-2 text-[12px] text-danger"
                  disabled={busyId === doc.id}
                  onClick={() => void act(doc.id, "soft-delete")}
                >
                  Soft-delete
                </button>
              ) : null}
              {doc.status === "soft_deleted" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-2 text-[12px]"
                    disabled={busyId === doc.id}
                    onClick={() => void act(doc.id, "restore")}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-2 text-[12px] text-danger"
                    disabled={busyId === doc.id}
                    onClick={() => void act(doc.id, "hard-delete")}
                  >
                    Purge
                  </button>
                </>
              ) : null}
            </div>,
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Audit log"
          description="Append-only. Upload, view, download, extract, soft-delete, restore, hard-delete."
        />
        <DataTable
          dense
          columns={["When", "Action", "Actor", "Org", "Target", "Reason"]}
          empty={
            <EmptyState
              title="No audit events"
              description="Events appear when a plan is uploaded, viewed, extracted, or deleted."
            />
          }
          rows={events.map((event) => [
            <span key={`${event.id}-when`} className="font-mono text-[12px] text-meta">
              {formatDateTime(event.createdAt)}
            </span>,
            <span key={`${event.id}-act`} className="font-mono text-[12px]">
              {event.action}
            </span>,
            <span key={`${event.id}-who`} className="truncate text-[12px]">
              {event.actorName ?? event.actorEmail ?? "system"}
            </span>,
            <span key={`${event.id}-org`} className="truncate">
              {event.organizationName ?? "—"}
            </span>,
            <span key={`${event.id}-tgt`} className="font-mono text-[11px] text-meta">
              {event.target}
            </span>,
            <span key={`${event.id}-rsn`} className="truncate text-[12px] text-muted">
              {event.reason ?? "—"}
            </span>,
          ])}
        />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flash-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
        {label}
      </div>
      <div className="mt-0.5 text-[26px] font-bold leading-none tabular-nums tracking-tight text-fg">
        {value}
      </div>
    </div>
  );
}
