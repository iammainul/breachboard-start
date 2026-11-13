"use client";

import { useState } from "react";
import { FormCard } from "@/components/ui-kit";

type Counts = {
  tactics: number;
  techniques: number;
  groups: number;
  cves: number;
  feeds: number;
};

type Feed = {
  id: string;
  source: string;
  title: string;
  cveIds: string[];
  groupIds: string[];
  techniqueIds: string[];
  createdAt: string;
};

export function IntelPanel({
  initialCounts,
  initialFeeds,
}: {
  initialCounts: Counts;
  initialFeeds: Feed[];
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [feeds, setFeeds] = useState(initialFeeds);
  const [status, setStatus] = useState<string | null>(null);
  const [cve, setCve] = useState<string>("");
  const [cveResult, setCveResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/intel");
    const json = await response.json();
    setCounts(json.counts);
    setFeeds(json.items);
  }

  async function seed() {
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/intel/sync", { method: "PUT" });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(json.error ?? "Seed failed");
      return;
    }
    setStatus(`Seeded ${json.groups} groups / ${json.techniques} techniques`);
    await refresh();
  }

  async function sync() {
    setBusy(true);
    setStatus("Downloading MITRE ATT&CK STIX…");
    const response = await fetch("/api/intel/sync", { method: "POST" });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(json.error ?? "Sync failed");
      return;
    }
    setStatus(
      `Synced ${json.groups} groups, ${json.techniques} techniques, ${json.links} mappings`,
    );
    await refresh();
  }

  async function lookupCve(formData: FormData) {
    const id = String(formData.get("cveId") ?? "");
    setCve(id);
    const response = await fetch(`/api/intel/cve?id=${encodeURIComponent(id)}`);
    const json = await response.json();
    if (!response.ok) {
      setCveResult(json.error ?? "Not found");
      return;
    }
    setCveResult(
      `${json.id}${json.kev ? " · CISA KEV" : ""}${json.cvss ? ` · CVSS ${json.cvss}` : ""}\n${json.description}`,
    );
  }

  async function importFeed(formData: FormData) {
    setBusy(true);
    const response = await fetch("/api/intel/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: formData.get("source"),
        title: formData.get("title"),
        url: String(formData.get("url") || "") || undefined,
        body: formData.get("body"),
      }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(json.error ?? "Import failed");
      return;
    }
    setStatus(
      `Imported · CVEs ${json.cveIds.length} · TTPs ${json.techniqueIds.length} · groups ${json.groupIds.length}`,
    );
    await refresh();
  }

  async function syncAdvisories() {
    setBusy(true);
    setStatus("Pulling CISA KEV + advisory RSS…");
    const response = await fetch("/api/intel/auto-onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(json.error ?? "Advisory sync failed");
      return;
    }
    if (json.skipped) {
      setStatus(json.reason ?? "Skipped");
    } else {
      setStatus(
        `Advisories: ${json.kevFeedsCreated} KEV feeds, ${json.newsCreated ?? json.rssCreated} headlines, ${json.kevUpserted} CVEs${
          json.newsErrors?.length
            ? ` · ${json.newsErrors.length} outlet(s) unreachable`
            : ""
        }${json.reason ? ` · ${json.reason}` : ""}`,
      );
    }
    await refresh();
  }

  async function pullNews() {
    setBusy(true);
    setStatus("Pulling CISA, NCSC, Krebs, BleepingComputer, The Record…");
    const response = await fetch("/api/intel/news", { method: "POST" });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(json.error ?? "News ingest failed");
      return;
    }
    setStatus(
      `News: ${json.created} new · ${json.skipped} already stored${
        json.errors?.length
          ? ` · ${json.errors.length} outlet(s) unreachable`
          : ""
      }`,
    );
    await refresh();
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <FormCard
          title="ATT&CK corpus"
          description="Seed a minimal subset or sync the full MITRE STIX bundle."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={seed}
              className="btn btn-primary disabled:opacity-50"
            >
              Seed subset
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={sync}
              className="btn btn-ghost disabled:opacity-50"
            >
              Sync full STIX
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncAdvisories()}
              className="btn btn-ghost disabled:opacity-50"
            >
              Sync public advisories
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pullNews()}
              className="btn btn-ghost disabled:opacity-50"
            >
              Pull cyber news
            </button>
          </div>
          {status ? <p className="text-[13px] text-muted">{status}</p> : null}

          <div className="border-t border-border-soft pt-3.5">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
              CVE lookup
            </h3>
            <form action={lookupCve} className="mt-1.5 flex gap-2">
              <input
                name="cveId"
                defaultValue={cve}
                placeholder="CVE-2024-…"
                className="field h-10 font-mono"
              />
              <button type="submit" className="btn btn-ghost shrink-0">
                Lookup
              </button>
            </form>
            {cveResult ? (
              <pre className="glass-inset glass-scroll mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl px-3 py-2 font-mono text-[12px] text-fg-2">
                {cveResult}
              </pre>
            ) : null}
          </div>
        </FormCard>

        <FormCard
          title="Import advisory"
          description="Extract CVEs, TTPs, and group IDs from regulator text."
        >
          <form action={importFeed} className="flex flex-col gap-2.5">
            <select name="source" className="field h-10" defaultValue="CISA">
              {[
                "CISA",
                "FBI",
                "RBI",
                "SEBI",
                "CERT_IN",
                "NVD",
                "NEWS",
                "MANUAL",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", "-")}
                </option>
              ))}
            </select>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                name="title"
                required
                placeholder="Title"
                className="field h-10"
              />
              <input
                name="url"
                placeholder="https://…"
                className="field h-10"
              />
            </div>
            <textarea
              name="body"
              required
              rows={8}
              className="field glass-scroll min-h-32"
              placeholder="Paste circular / flash / KEV note…"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary self-start disabled:opacity-50"
            >
              Import
            </button>
          </form>
        </FormCard>
      </div>

      <FormCard
        title="Recent feeds"
        description="Latest imported intel used for scenario grounding."
        className="min-h-0"
      >
        <ul className="glass-inset glass-scroll max-h-[34rem] overflow-y-auto overscroll-contain rounded-xl">
          {feeds.map((f) => (
            <li
              key={f.id}
              className="glass-row border-b border-border-soft px-4 py-2.5 last:border-0"
            >
              <div className="text-[14px] font-medium leading-snug text-fg">
                {f.title}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-meta">
                {f.source} · {f.cveIds.join(" ") || "no CVE"} ·{" "}
                {f.techniqueIds.join(" ") || "no TTP"}
              </div>
            </li>
          ))}
          {feeds.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-muted">
              No feed items yet.
            </li>
          ) : null}
        </ul>
      </FormCard>
    </div>
  );
}
