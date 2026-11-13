"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FieldLabel, FormCard } from "@/components/ui-kit";

type Kind = "crisis" | "irc";

export function OrgPlanDocs({
  organizationId,
  crisisDocName,
  crisisDocPath,
  ircDocName,
  ircDocPath,
  documentRetentionDays,
}: {
  organizationId: string;
  crisisDocName: string | null;
  crisisDocPath: string | null;
  ircDocName: string | null;
  ircDocPath: string | null;
  documentRetentionDays: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Kind | "retention" | null>(null);
  const [retentionDays, setRetentionDays] = useState(documentRetentionDays);

  async function upload(kind: Kind, file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    const data = new FormData();
    data.set("kind", kind);
    data.set("file", file);
    data.set("retentionDays", String(retentionDays));
    const response = await fetch(`/api/orgs/${organizationId}/docs`, {
      method: "POST",
      body: data,
    });
    setBusy(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Upload failed");
      return;
    }
    router.refresh();
  }

  async function remove(kind: Kind) {
    setBusy(kind);
    setError(null);
    const response = await fetch(`/api/orgs/${organizationId}/docs?kind=${kind}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not remove document");
      return;
    }
    router.refresh();
  }

  async function saveRetention() {
    setBusy("retention");
    setError(null);
    const response = await fetch(`/api/orgs/${organizationId}/retention`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentRetentionDays: Number(retentionDays) }),
    });
    setBusy(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not save retention");
      return;
    }
    router.refresh();
  }

  return (
    <FormCard
      title="Crisis and IRC documents"
      description="Uploaded IRP/CCMP files ground AI grading. PDF and DOCX are extracted (capped). Closed engagements soft-delete standing plans; Settings → Uploads can restore until purge."
    >
      <FieldLabel
        label="Retention after close"
        hint="Default 14 days. Applies to new uploads for this client unless overridden on the file."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            className="field h-9 w-24 font-mono text-[13px]"
            value={retentionDays}
            onChange={(event) => setRetentionDays(Number(event.target.value))}
          />
          <span className="text-[12px] text-meta">days</span>
          <button
            type="button"
            className="btn btn-ghost h-9 text-[13px] disabled:opacity-50"
            disabled={busy === "retention"}
            onClick={() => void saveRetention()}
          >
            {busy === "retention" ? "Saving…" : "Save"}
          </button>
        </div>
      </FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <DocSlot
          label="Crisis management plan"
          hint="CCMP / BCP"
          name={crisisDocName}
          path={crisisDocPath}
          busy={busy === "crisis"}
          onUpload={(file) => void upload("crisis", file)}
          onRemove={() => void remove("crisis")}
        />
        <DocSlot
          label="Incident response / IRC"
          hint="IRP"
          name={ircDocName}
          path={ircDocPath}
          busy={busy === "irc"}
          onUpload={(file) => void upload("irc", file)}
          onRemove={() => void remove("irc")}
        />
      </div>
      {error ? (
        <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </FormCard>
  );
}

function DocSlot({
  label,
  hint,
  name,
  path,
  busy,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  name: string | null;
  path: string | null;
  busy: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="glass-tile flex min-w-0 flex-col gap-1 p-3">
      <span className="text-[12px] font-semibold text-fg-2">{label}</span>
      <span className="text-[11px] leading-snug text-meta">{hint}</span>
      <div className="mt-1 flex flex-col gap-2">
        {name && path ? (
          <div className="glass-inset flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 py-2">
            <a
              href={path}
              className="truncate text-[13px] font-medium text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {name}
            </a>
            <button
              type="button"
              className="text-[12px] text-danger hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-muted">No document on file.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv"
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="btn btn-ghost h-9 w-full text-[13px] disabled:opacity-50"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : name ? "Replace file" : "Upload file"}
        </button>
      </div>
    </div>
  );
}
