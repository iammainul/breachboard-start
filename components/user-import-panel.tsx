"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormCard } from "@/components/ui-kit";
import { cn } from "@/lib/cn";

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; error: string }[];
};

const ACCEPT =
  ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export function UserImportPanel() {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setResult(null);
    setError(null);
    if (inputRef.current) {
      if (!next) inputRef.current.value = "";
    }
  }

  function onFileList(list: FileList | null) {
    const next = list?.[0] ?? null;
    if (!next) return;
    const lower = next.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      setError("Use an .xlsx or .csv file");
      setFile(null);
      return;
    }
    pickFile(next);
  }

  async function onImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a spreadsheet first");
      return;
    }
    const data = new FormData();
    data.set("file", file);
    setBusy(true);
    setError(null);
    setResult(null);
    const response = await fetch("/api/users/import", {
      method: "POST",
      body: data,
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Import failed");
      return;
    }
    setResult({
      created: json.created ?? 0,
      updated: json.updated ?? 0,
      errors: Array.isArray(json.errors) ? json.errors : [],
    });
    pickFile(null);
    router.refresh();
  }

  return (
    <FormCard
      title="Bulk import"
      description="Import admins and facilitators from Excel or CSV. Participants are not imported — they join with a code or invite link."
    >
      <ol className="flex flex-col gap-3.5">
        <li className="flex gap-3">
          <Step n={1} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[13px] font-medium text-fg">Get the template</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Includes name, email, password, role, facilitate flag, org slug, and
              preferred role/squad.
            </p>
            {/* File download from the API, not an App Router page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/users/template"
              className="btn btn-ghost mt-2.5 inline-flex h-9 px-3 text-[13px]"
            >
              Download Excel template
            </a>
          </div>
        </li>

        <li className="flex gap-3">
          <Step n={2} done={Boolean(file)} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[13px] font-medium text-fg">Add your file</div>
            <form id="user-import-form" onSubmit={onImport} className="mt-2">
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                name="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => onFileList(e.target.files)}
              />
              <label
                htmlFor={inputId}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onFileList(e.dataTransfer.files);
                }}
                className={cn(
                  "flex min-h-[84px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed px-4 py-3.5 text-center backdrop-blur-[10px] transition-colors",
                  dragging
                    ? "border-primary bg-primary-wash"
                    : file
                      ? "border-primary/40 bg-primary-wash/50"
                      : "border-border bg-bg/55 hover:border-primary/40 hover:bg-primary-wash/40",
                )}
              >
                {file ? (
                  <>
                    <span className="max-w-full truncate text-[13px] font-semibold text-fg">
                      {file.name}
                    </span>
                    <span className="mt-1 text-[12px] text-muted">
                      {(file.size / 1024).toFixed(1)} KB · click to replace
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-medium text-fg">
                      Drop spreadsheet here
                    </span>
                    <span className="mt-1 text-[12px] text-muted">
                      or click to browse · .xlsx / .csv
                    </span>
                  </>
                )}
              </label>
              {file ? (
                <button
                  type="button"
                  className="mt-2 text-[12px] font-medium text-muted hover:text-danger"
                  onClick={() => pickFile(null)}
                >
                  Clear file
                </button>
              ) : null}
            </form>
          </div>
        </li>

        <li className="flex gap-3">
          <Step n={3} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[13px] font-medium text-fg">Import into roster</div>
            <button
              type="submit"
              form="user-import-form"
              disabled={busy || !file}
              className="btn btn-primary mt-2.5 h-9 disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import operators"}
            </button>
          </div>
        </li>
      </ol>

      {error ? (
        <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="glass-inset rounded-[var(--radius-control)] px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <Stat label="Created" value={result.created} tone="success" />
            <Stat label="Updated" value={result.updated} />
            <Stat
              label="Row errors"
              value={result.errors.length}
              tone={result.errors.length ? "danger" : "muted"}
            />
          </div>
          {result.errors.length > 0 ? (
            <ul className="glass-scroll glass-tile mt-2.5 max-h-36 overflow-y-auto px-3 py-2 text-[12px] text-fg-2">
              {result.errors.slice(0, 40).map((row) => (
                <li key={`${row.row}-${row.error}`} className="py-1">
                  <span className="font-mono text-meta">Row {row.row}</span>
                  {" · "}
                  {row.error}
                </li>
              ))}
              {result.errors.length > 40 ? (
                <li className="py-1 text-meta">
                  +{result.errors.length - 40} more
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-success">All rows processed cleanly.</p>
          )}
        </div>
      ) : null}
    </FormCard>
  );
}

function Step({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
        done
          ? "bg-primary text-primary-fg"
          : "bg-primary-wash text-primary-hover",
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  return (
    <div className="glass-tile px-2.5 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-meta">
        {label}
      </div>
      <div
        className={cn(
          "text-[16px] font-bold tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "muted" && "text-meta",
          tone === "default" && "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}
