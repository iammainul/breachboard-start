"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LibraryPackToolbar() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportAll() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/library/export");
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Export failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? "library.ttxpack";
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
      setMessage(`Downloaded ${name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/library/import", {
      method: "POST",
      body: form,
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Import failed");
      return;
    }
    setMessage(`Imported ${json.imported} pack(s): ${json.keys?.join(", ")}`);
    router.refresh();
  }

  async function installFromUrl() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/library/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Install failed");
      return;
    }
    setMessage(`Installed ${json.imported} pack(s): ${json.keys?.join(", ")}`);
    setUrl("");
    router.refresh();
  }

  return (
    <div className="flash-card glass-chrome flex flex-col gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-[15px] font-semibold">Share packs</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            Export <span className="font-mono text-[12px]">.ttxpack</span> files
            for email, USB, or another install. Import a file or install from a
            URL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary disabled:opacity-50"
            disabled={busy}
            onClick={() => void exportAll()}
          >
            Export all
          </button>
          <button
            type="button"
            className="btn btn-ghost disabled:opacity-50"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ttxpack,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[320px]">
            <span className="shrink-0 text-[12px] font-medium text-muted">
              Install from URL
            </span>
            <input
              className="field h-10 min-w-0 flex-1"
              placeholder="https://…/pack.ttxpack"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost shrink-0 disabled:opacity-50"
            disabled={busy || !url.trim()}
            onClick={() => void installFromUrl()}
          >
            Install
          </button>
        </div>
      </div>

      {message ? (
        <p className="glass-inset rounded-xl px-3 py-2 text-[13px] text-fg-2">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
