"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Provider = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
  source: "portal" | "env" | "none";
  portalConfigured: boolean;
  maskedApiKey: string | null;
  model: string | null;
  baseURL: string | null;
  maskedBaseURL: string | null;
};

type Status = {
  providers: Provider[];
  defaultProvider: string;
  anyReady: boolean;
  autoOnboardIntel: boolean;
  aiOnboardingCompletedAt: string | null;
  intelLastRunAt: string | null;
  templateCount: number;
  feedCount: number;
};

const NEEDS_KEY = new Set(["openai", "anthropic", "github", "cursor", "gemini"]);
const NEEDS_BASE = new Set(["ollama", "cursor"]);
const CAN_LIST_MODELS = new Set([
  "gemini",
  "openai",
  "ollama",
  "anthropic",
  "github",
  "cursor",
]);

export function AiSettingsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [modelLists, setModelLists] = useState<
    Record<string, { ids: { id: string; label: string }[]; message: string }>
  >({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { apiKey: string; model: string; baseURL: string }>
  >({});

  async function load() {
    const response = await fetch("/api/settings/ai");
    const json = await response.json();
    if (response.ok) {
      setStatus(json);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const p of json.providers as Provider[]) {
          if (!next[p.id]) {
            next[p.id] = {
              apiKey: "",
              model: p.model ?? "",
              baseURL: p.baseURL ?? "",
            };
          }
        }
        return next;
      });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void load();
  }, []);

  async function saveProvider(id: string, setAsDefault = false) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const draft = drafts[id] ?? { apiKey: "", model: "", baseURL: "" };
    const response = await fetch("/api/settings/ai/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        apiKey: draft.apiKey.trim() || undefined,
        model: draft.model.trim() || undefined,
        baseURL: draft.baseURL.trim() || undefined,
        setAsDefault,
      }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], apiKey: "" },
    }));
    setMessage(`${id} saved${setAsDefault ? " · set as default" : ""}.`);
    setStatus((s) =>
      s
        ? {
            ...s,
            providers: json.providers,
            defaultProvider: json.defaultProvider,
            anyReady: json.anyReady,
          }
        : s,
    );
  }

  async function clearProvider(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/settings/ai/providers?id=${id}`, {
      method: "DELETE",
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Clear failed");
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [id]: { apiKey: "", model: "", baseURL: "" },
    }));
    setMessage(`Cleared portal credentials for ${id}.`);
    setStatus((s) =>
      s
        ? {
            ...s,
            providers: json.providers,
            defaultProvider: json.defaultProvider,
            anyReady: json.anyReady,
          }
        : s,
    );
  }

  async function setDefault(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/settings/ai/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultProvider: id }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Could not set default");
      return;
    }
    setStatus((s) =>
      s
        ? {
            ...s,
            providers: json.providers,
            defaultProvider: json.defaultProvider,
            anyReady: json.anyReady,
          }
        : s,
    );
  }

  async function testConnection(id: string) {
    setTestingId(id);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await response.json();
    setTestingId(null);
    setTestResults((prev) => ({
      ...prev,
      [id]: {
        ok: Boolean(json.ok),
        message: json.message ?? (json.ok ? "Connected" : "Failed"),
      },
    }));
    if (json.ok) {
      setMessage(`${id}: ${json.message}`);
    } else {
      setError(`${id}: ${json.message ?? "Connection failed"}`);
    }
  }

  async function listModels(id: string) {
    setListingId(id);
    setError(null);
    const draft = drafts[id] ?? { apiKey: "", model: "", baseURL: "" };
    const response = await fetch("/api/settings/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        apiKey: draft.apiKey.trim() || undefined,
        baseURL: draft.baseURL.trim() || undefined,
      }),
    });
    const json = await response.json();
    setListingId(null);
    const models = Array.isArray(json.models)
      ? (json.models as { id: string; label: string }[])
      : [];
    setModelLists((prev) => ({
      ...prev,
      [id]: {
        ids: models,
        message: json.message ?? (json.ok ? "Models loaded" : "List failed"),
      },
    }));
    if (!json.ok && models.length === 0) {
      setError(`${id}: ${json.message ?? "Could not list models"}`);
    } else {
      setMessage(`${id}: ${json.message}`);
    }
  }

  async function complete(force = false) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings/ai/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Onboarding failed");
      await load();
      return;
    }
    const intel = json.intel;
    setMessage(
      [
        "Onboarding complete.",
        intel?.skipped
          ? `Intel: ${intel.reason ?? "skipped"}`
          : `Intel: ${intel?.kevFeedsCreated ?? 0} KEV · ${intel?.rssCreated ?? 0} alerts · ${intel?.kevUpserted ?? 0} CVEs.`,
        `Library: ${json.library?.upserted ?? 0} templates.`,
      ].join(" "),
    );
    await load();
  }

  if (!status) {
    return <p className="text-[14px] text-muted">Loading providers…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">AI providers</h2>
        <p className="mt-1 text-[13px] text-muted">
          Credentials saved here override environment variables. Expand a row to
          configure.
        </p>
      </div>

      <div className="flash-card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_88px_minmax(0,0.9fr)_64px_minmax(140px,auto)] gap-3 border-b border-border-soft bg-[color-mix(in_oklab,var(--bg)_45%,transparent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-meta backdrop-blur-md sm:grid">
          <span>Provider</span>
          <span>Status</span>
          <span>Model</span>
          <span>Source</span>
          <span className="text-right">Actions</span>
        </div>
        <ul>
          {status.providers.map((p) => {
            const isDefault = status.defaultProvider === p.id;
            const open = expanded === p.id;
            const draft = drafts[p.id] ?? {
              apiKey: "",
              model: p.model ?? "",
              baseURL: p.baseURL ?? "",
            };
            const probe = testResults[p.id];
            return (
              <li key={p.id} className="border-b border-border-soft last:border-0">
                <div
                  data-active={open ? "true" : undefined}
                  className="glass-row grid grid-cols-1 items-center gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_88px_minmax(0,0.9fr)_64px_minmax(140px,auto)] sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-fg">
                        {p.label}
                      </span>
                      {isDefault ? (
                        <span className="chip chip-on text-[10px]">Default</span>
                      ) : null}
                      {probe ? (
                        <span
                          className={cn(
                            "chip text-[10px]",
                            probe.ok ? "chip-on" : "",
                          )}
                          title={probe.message}
                        >
                          {probe.ok ? "Verified" : "Failed"}
                        </span>
                      ) : null}
                    </div>
                    {p.maskedApiKey ? (
                      <div className="mt-0.5 font-mono text-[11px] text-meta">
                        {p.maskedApiKey}
                      </div>
                    ) : null}
                    {probe && !probe.ok ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-danger">
                        {probe.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "chip text-[10px]",
                        p.ready ? "chip-on" : "",
                      )}
                    >
                      {p.ready ? "Ready" : "Missing"}
                    </span>
                  </div>
                  <div className="truncate text-[13px] text-muted">
                    {p.model ?? "—"}
                  </div>
                  <div className="text-[12px] capitalize text-meta">
                    {p.source === "none" ? "—" : p.source}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {p.ready ? (
                      <button
                        type="button"
                        className="btn btn-ghost px-2 py-1 text-[11px] disabled:opacity-50"
                        disabled={busy || testingId !== null}
                        onClick={() => void testConnection(p.id)}
                      >
                        {testingId === p.id ? "Testing…" : "Test"}
                      </button>
                    ) : null}
                    {!isDefault && p.ready ? (
                      <button
                        type="button"
                        className="btn btn-ghost px-2 py-1 text-[11px]"
                        disabled={busy}
                        onClick={() => void setDefault(p.id)}
                      >
                        Default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-[11px]"
                      onClick={() =>
                        setExpanded((cur) => (cur === p.id ? null : p.id))
                      }
                    >
                      {open ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="glass-inset px-4 py-3.5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {NEEDS_KEY.has(p.id) ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-meta">
                            API key{p.maskedApiKey ? " (blank = keep)" : ""}
                          </span>
                          <input
                            type="password"
                            className="field h-10 text-[14px]"
                            autoComplete="off"
                            placeholder={p.maskedApiKey ? "•••• keep" : "sk-…"}
                            value={draft.apiKey}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, apiKey: e.target.value },
                              }))
                            }
                          />
                        </label>
                      ) : null}
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-meta">
                          Model
                        </span>
                        {modelLists[p.id]?.ids.length ? (
                          <select
                            className="field h-10 text-[14px]"
                            value={draft.model}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, model: e.target.value },
                              }))
                            }
                          >
                            <option value="">Select a model</option>
                            {draft.model &&
                            !modelLists[p.id].ids.some((m) => m.id === draft.model) ? (
                              <option value={draft.model}>{draft.model}</option>
                            ) : null}
                            {modelLists[p.id].ids.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="field h-10 text-[14px]"
                            value={draft.model}
                            placeholder={
                              p.id === "gemini"
                                ? p.model ?? "gemini-2.5-flash"
                                : p.model ?? "model id"
                            }
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, model: e.target.value },
                              }))
                            }
                          />
                        )}
                        {CAN_LIST_MODELS.has(p.id) ? (
                          <button
                            type="button"
                            className="mt-1 self-start text-[11px] font-semibold text-primary-hover hover:underline disabled:opacity-50"
                            disabled={
                              listingId !== null ||
                              (NEEDS_KEY.has(p.id) &&
                                !draft.apiKey.trim() &&
                                !p.ready)
                            }
                            onClick={() => void listModels(p.id)}
                          >
                            {listingId === p.id
                              ? "Listing models…"
                              : "List models from API key"}
                          </button>
                        ) : null}
                        {modelLists[p.id]?.message ? (
                          <span className="text-[11px] text-meta">
                            {modelLists[p.id].message}
                          </span>
                        ) : null}
                      </label>
                      {NEEDS_BASE.has(p.id) ? (
                        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                          <span className="text-[11px] font-medium text-meta">
                            {p.id === "cursor" ? "Proxy URL (optional)" : "Base URL"}
                          </span>
                          <input
                            className="field h-10 text-[14px]"
                            value={draft.baseURL}
                            placeholder={
                              p.id === "ollama"
                                ? "http://host.docker.internal:11434/v1"
                                : "http://127.0.0.1:8080/v1"
                            }
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, baseURL: e.target.value },
                              }))
                            }
                          />
                          {p.id === "ollama" ? (
                            <span className="text-[11px] text-meta">
                              Docker: use host.docker.internal (not localhost).
                              Dev on host: localhost is fine. Model must exist
                              in Ollama (e.g. qwen2.5:14b).
                            </span>
                          ) : null}
                        </label>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void saveProvider(p.id, false)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void saveProvider(p.id, true)}
                      >
                        Save as default
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost disabled:opacity-50"
                        disabled={busy || testingId !== null || !p.ready}
                        onClick={() => void testConnection(p.id)}
                      >
                        {testingId === p.id ? "Testing…" : "Test connection"}
                      </button>
                      {p.portalConfigured ? (
                        <button
                          type="button"
                          className="btn btn-ghost disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void clearProvider(p.id)}
                        >
                          Clear portal
                        </button>
                      ) : null}
                    </div>
                    {probe ? (
                      <p
                        className={cn(
                          "mt-3 text-[12px]",
                          probe.ok ? "text-success" : "text-danger",
                        )}
                      >
                        {probe.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flash-card p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-fg">Intel onboarding</h3>
        <dl className="mt-2.5 grid gap-2 text-[13px] sm:grid-cols-4">
          <div className="glass-tile px-3 py-2">
            <dt className="text-[11px] text-meta">Completed</dt>
            <dd className="mt-0.5 font-medium">
              {status.aiOnboardingCompletedAt
                ? new Date(status.aiOnboardingCompletedAt).toLocaleDateString()
                : "Not yet"}
            </dd>
          </div>
          <div className="glass-tile px-3 py-2">
            <dt className="text-[11px] text-meta">Last intel sync</dt>
            <dd className="mt-0.5 font-medium">
              {status.intelLastRunAt
                ? new Date(status.intelLastRunAt).toLocaleDateString()
                : "Never"}
            </dd>
          </div>
          <div className="glass-tile px-3 py-2">
            <dt className="text-[11px] text-meta">Feed items</dt>
            <dd className="mt-0.5 font-medium">{status.feedCount}</dd>
          </div>
          <div className="glass-tile px-3 py-2">
            <dt className="text-[11px] text-meta">Library templates</dt>
            <dd className="mt-0.5 font-medium">{status.templateCount}</dd>
          </div>
        </dl>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !status.anyReady}
            className="btn btn-primary disabled:opacity-50"
            onClick={() => void complete(false)}
          >
            {busy ? "Working…" : "Complete onboarding"}
          </button>
          <button
            type="button"
            disabled={busy || !status.anyReady}
            className="btn btn-ghost disabled:opacity-50"
            onClick={() => void complete(true)}
          >
            Force re-sync
          </button>
          <Link href="/library" className="btn btn-ghost">
            Library
          </Link>
        </div>
        {!status.anyReady ? (
          <p className="mt-3 text-[13px] text-danger">
            Configure at least one provider above.
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary-wash px-3 py-2 text-[13px] text-fg-2">
            {message}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
