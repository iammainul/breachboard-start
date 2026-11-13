"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sectorLabel } from "@/lib/cn";

export type LibraryCardData = {
  key: string;
  kind?: string;
  title: string;
  durationMin: number;
  sector: string;
  libraryTags: string[];
  coverImagePath: string | null;
  cloneCount: number;
  injectCount?: number;
};

export function LibraryCloneCard({
  template,
  organizations,
}: {
  template: LibraryCardData;
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clone() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/library/${template.key}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId || null }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Clone failed");
      return;
    }
    router.push(`/scenarios/${json.id}`);
    router.refresh();
  }

  async function exportPack() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/library/export?keys=${encodeURIComponent(template.key)}`,
      );
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Export failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? `${template.key}.ttxpack`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flash-card flex flex-col overflow-hidden">
      <div className="aspect-[16/9] shrink-0 bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.coverImagePath ?? "/library/ransomware-swift/cover.svg"}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <span className="chip chip-on text-[11px]">
              {template.kind === "inject_pack" ? "Inject pack" : "Scenario pack"}
            </span>
            {template.libraryTags.map((tag) => (
              <span key={tag} className="chip text-[11px]">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="mt-1.5 text-[16px] font-bold leading-snug tracking-tight">
            {template.title}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {sectorLabel(template.sector)} · {template.durationMin} min ·{" "}
            {template.injectCount ?? "?"} inject
            {(template.injectCount ?? 0) === 1 ? "" : "s"} · cloned {template.cloneCount}×
          </p>
        </div>
        {organizations.length > 0 ? (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-muted">Clone into org</span>
            <select
              className="field h-10"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">No org (draft only)</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !template.key}
            className="btn btn-primary disabled:opacity-50"
            onClick={() => void clone()}
          >
            {busy ? "Cloning…" : "Clone to scenarios"}
          </button>
          <button
            type="button"
            disabled={busy || !template.key}
            className="btn btn-ghost disabled:opacity-50"
            onClick={() => void exportPack()}
          >
            Export .ttxpack
          </button>
          <Link
            href={`/scenarios?template=${template.key}`}
            className="btn btn-ghost"
          >
            Details
          </Link>
        </div>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>
    </article>
  );
}
