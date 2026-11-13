"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ExerciseDocument, Sector } from "@/lib/schema/exercise";
import { FieldLabel, FormCard } from "@/components/ui-kit";
import { SectorOptions } from "@/components/sector-options";
import { cn } from "@/lib/cn";
import {
  AiProviderSelect,
  providerOrUndefined,
  type AiProviderChoice,
} from "@/components/ai-provider-select";

const InjectWorkshop = dynamic(
  () =>
    import("@/components/inject-workshop").then((m) => m.InjectWorkshop),
  { ssr: false },
);

type AptTechnique = {
  id: string;
  name: string;
  tacticId: string | null;
  tactic: string;
  description: string;
};

type AptGroup = {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  techniqueCount: number;
  techniques?: AptTechnique[];
};
type Org = { id: string; name: string };

type AdvisoryItem = {
  id: string;
  source: string;
  sourceLabel: string;
  title: string;
  url: string | null;
  publishedAt: string;
  excerpt: string;
  bodyLength: number;
  cveIds: string[];
  groupIds: string[];
  techniqueIds: string[];
};

type AvailableInject = {
  templateId: string;
  packTitle: string;
  id: string;
  title: string;
  body: string;
  timerSeconds: number;
  techniqueIds: string[];
  questionCount: number;
};

const DEFAULT_TEAMS = ["Blue Cell", "Crisis Comms", "Business Continuity"];

export function GenerateForm({
  initialGroups = [],
  organizations = [],
  initialFeedId,
}: {
  initialGroups?: AptGroup[];
  organizations?: Org[];
  initialFeedId?: string;
}) {
  const [groups, setGroups] = useState<AptGroup[]>(initialGroups);
  const [provider, setProvider] = useState<AiProviderChoice>("");
  const [sector, setSector] = useState<Sector>("bfsi_in");
  const [selectedAptIds, setSelectedAptIds] = useState<string[]>([]);
  const [focusAptId, setFocusAptId] = useState<string | null>(null);
  const [aptQuery, setAptQuery] = useState("");
  const [advisories, setAdvisories] = useState<AdvisoryItem[]>([]);
  const [newsItems, setNewsItems] = useState<AdvisoryItem[]>([]);
  const [advisorySources, setAdvisorySources] = useState<string[]>([]);
  const [advisoriesLoading, setAdvisoriesLoading] = useState(false);
  const [selectedAdvisoryIds, setSelectedAdvisoryIds] = useState<string[]>([]);
  const [focusAdvisoryId, setFocusAdvisoryId] = useState<string | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAMS);
  const [teamDraft, setTeamDraft] = useState("");
  const [availableInjects, setAvailableInjects] = useState<AvailableInject[]>([]);
  const [selectedInjectKeys, setSelectedInjectKeys] = useState<string[]>([]);
  const [injectSearch, setInjectSearch] = useState("");
  const [composedTitle, setComposedTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [workshop, setWorkshop] = useState<{
    id: string;
    document: ExerciseDocument;
  } | null>(null);

  useEffect(() => {
    fetch("/api/intel/groups")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGroups(data);
          setFocusAptId((prev) => prev ?? data[0]?.id ?? null);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/injects")
      .then((response) => response.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.injects) ? payload.injects : [];
        setAvailableInjects(
          rows.map(
            (inject: {
              sourceId: string;
              sourceTitle: string;
              injectId: string;
              title: string;
              body: string;
              timerSeconds: number;
              techniqueIds: string[];
              questionCount: number;
            }) => ({
              templateId: inject.sourceId,
              packTitle: inject.sourceTitle,
              id: inject.injectId,
              title: inject.title,
              body: inject.body,
              timerSeconds: inject.timerSeconds,
              techniqueIds: inject.techniqueIds,
              questionCount: inject.questionCount,
            }),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/intel/news")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data.items)
          ? (data.items as AdvisoryItem[])
          : [];
        setNewsItems(items);
        if (initialFeedId && items.some((item) => item.id === initialFeedId)) {
          setSelectedAdvisoryIds((prev) =>
            prev.includes(initialFeedId)
              ? prev
              : [initialFeedId, ...prev].slice(0, 3),
          );
          setFocusAdvisoryId(initialFeedId);
        }
      })
      .catch(() => undefined);
  }, [initialFeedId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while sector request starts
    setAdvisoriesLoading(true);
    fetch(`/api/intel/advisories?sector=${sector}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data.items) ? (data.items as AdvisoryItem[]) : [];
        setAdvisories(items);
        setAdvisorySources(
          Array.isArray(data.sources) ? (data.sources as string[]) : [],
        );
        setSelectedAdvisoryIds((prev) =>
          prev.filter(
            (id) =>
              items.some((item) => item.id === id) ||
              newsItems.some((item) => item.id === id) ||
              id === initialFeedId,
          ),
        );
        setFocusAdvisoryId((prev) => {
          if (
            prev &&
            (items.some((item) => item.id === prev) ||
              newsItems.some((item) => item.id === prev) ||
              prev === initialFeedId)
          ) {
            return prev;
          }
          return items[0]?.id ?? newsItems[0]?.id ?? null;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAdvisories([]);
          setAdvisorySources([]);
        }
      })
      .finally(() => {
        if (!cancelled) setAdvisoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sector, newsItems, initialFeedId]);

  const focusedAdvisory = useMemo(
    () =>
      advisories.find((a) => a.id === focusAdvisoryId) ??
      newsItems.find((a) => a.id === focusAdvisoryId) ??
      null,
    [advisories, newsItems, focusAdvisoryId],
  );

  const filteredApts = useMemo(() => {
    const q = aptQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.id.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        (g.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [groups, aptQuery]);

  const focusedApt = useMemo(
    () => groups.find((g) => g.id === focusAptId) ?? null,
    [groups, focusAptId],
  );

  const selectedNewsCount = useMemo(
    () =>
      selectedAdvisoryIds.filter((id) =>
        newsItems.some((item) => item.id === id),
      ).length,
    [selectedAdvisoryIds, newsItems],
  );

  const selectedRegulatorCount = useMemo(
    () =>
      selectedAdvisoryIds.filter(
        (id) => !newsItems.some((item) => item.id === id),
      ).length,
    [selectedAdvisoryIds, newsItems],
  );

  const filteredAvailableInjects = useMemo(() => {
    const query = injectSearch.trim().toLowerCase();
    if (!query) return availableInjects;
    return availableInjects.filter(
      (inject) =>
        inject.title.toLowerCase().includes(query) ||
        inject.packTitle.toLowerCase().includes(query) ||
        inject.techniqueIds.some((id) => id.toLowerCase().includes(query)),
    );
  }, [availableInjects, injectSearch]);

  function injectKey(inject: AvailableInject) {
    return `${inject.templateId}:${inject.id}`;
  }

  function toggleAvailableInject(inject: AvailableInject) {
    const key = injectKey(inject);
    setSelectedInjectKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : current.length < 12
          ? [...current, key]
          : current,
    );
  }

  function toggleAdvisory(id: string) {
    setSelectedAdvisoryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setFocusAdvisoryId(id);
  }

  function toggleApt(id: string) {
    setSelectedAptIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setFocusAptId(id);
  }

  function addTeam() {
    const name = teamDraft.trim();
    if (!name) return;
    if (teamNames.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTeamDraft("");
      return;
    }
    if (teamNames.length >= 8) return;
    setTeamNames((prev) => [...prev, name]);
    setTeamDraft("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const advisoryIds = selectedAdvisoryIds;
    const payload = {
      sector,
      durationMin: Number(formData.get("durationMin") || 90),
      groupId: selectedAptIds[0],
      groupIds: selectedAptIds.length ? selectedAptIds : undefined,
      cveId: String(formData.get("cveId") || "") || undefined,
      advisoryId: advisoryIds[0],
      advisoryIds: advisoryIds.length ? advisoryIds : undefined,
      advisoryText: String(formData.get("advisoryText") || "") || undefined,
      stackNotes: String(formData.get("stackNotes") || "") || undefined,
      organizationId: String(formData.get("organizationId") || "") || undefined,
      teamNames: teamNames.length ? teamNames : undefined,
      provider: providerOrUndefined(provider),
    };
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Generation failed");
      return;
    }
    setWorkshop({ id: json.id, document: json.document });
  }

  async function composeFromInjects(form: HTMLFormElement) {
    const selected = selectedInjectKeys
      .map((key) => availableInjects.find((inject) => injectKey(inject) === key))
      .filter((inject): inject is AvailableInject => Boolean(inject));
    if (!selected.length) {
      setError("Select at least one available inject.");
      return;
    }
    if (composedTitle.trim().length < 3) {
      setError("Name the scenario before creating it from selected injects.");
      return;
    }
    const formData = new FormData(form);
    setPending(true);
    setError(null);
    const response = await fetch("/api/scenarios/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: composedTitle.trim(),
        sector,
        durationMin: Number(formData.get("durationMin") || 90),
        organizationId:
          String(formData.get("organizationId") || "") || undefined,
        selections: selected.map((inject) => ({
          templateId: inject.templateId,
          injectId: inject.id,
        })),
      }),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Could not create scenario from selected injects");
      return;
    }
    setWorkshop({ id: json.id, document: json.document });
  }

  if (workshop) {
    return (
      <InjectWorkshop
        exerciseId={workshop.id}
        initialDocument={workshop.document}
        provider={providerOrUndefined(provider)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="glass-header flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] px-4 py-2.5">
        {selectedAptIds.length > 0 ||
        selectedRegulatorCount > 0 ||
        selectedNewsCount > 0 ? (
          <p className="text-[12px] text-muted">
            {[
              selectedAptIds.length > 0
                ? `${selectedAptIds.length} APT${selectedAptIds.length === 1 ? "" : "s"}`
                : null,
              selectedRegulatorCount > 0
                ? `${selectedRegulatorCount} advisor${selectedRegulatorCount === 1 ? "y" : "ies"}`
                : null,
              selectedNewsCount > 0
                ? `${selectedNewsCount} headline${selectedNewsCount === 1 ? "" : "s"}`
                : null,
              `${teamNames.length} inject group${teamNames.length === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : (
          <p className="text-[12px] text-muted">
            Tip: open a card in the middle column to pick injects, APTs, news, or
            advisories.
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <FormCard
            collapsible
            title="Scenario context"
            description="Sector, duration, and environment notes."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldLabel label="Onboarded org">
                <select name="organizationId" className="field" defaultValue="">
                  <option value="">Library only</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Sector">
                <select
                  name="sector"
                  className="field"
                  value={sector}
                  onChange={(e) => setSector(e.target.value as Sector)}
                >
                  <SectorOptions />
                </select>
              </FieldLabel>
              <FieldLabel label="Duration">
                <select name="durationMin" className="field" defaultValue="90">
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
              </FieldLabel>
              <FieldLabel label="CVE" hint="Optional — enriches inject narrative">
                <input
                  name="cveId"
                  placeholder="CVE-2024-…"
                  className="field font-mono"
                />
              </FieldLabel>
              <FieldLabel
                label="Stack notes"
                hint="Environment the SitMan should mirror"
              >
                <input
                  name="stackNotes"
                  placeholder="Core banking, AD, email, OT…"
                  className="field"
                />
              </FieldLabel>
            </div>
          </FormCard>

          <FormCard
            collapsible
            defaultOpen={false}
            title="Create from available injects"
            description="Every inject from templates and this workspace’s scenarios. Tokens {{org}} and {{team}} fill when you run the pack for a client."
            meta={
              selectedInjectKeys.length
                ? `${selectedInjectKeys.length} selected`
                : undefined
            }
          >
            {availableInjects.length === 0 ? (
              <p className="glass-inset rounded-xl px-3 py-2.5 text-[13px] text-muted">
                No injects yet. Generate a scenario or a single inject, then they
                show up here to mix into a new pack.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
                  <input
                    className="field"
                    value={injectSearch}
                    onChange={(event) => setInjectSearch(event.target.value)}
                    placeholder="Search available injects or ATT&CK IDs…"
                  />
                  <input
                    className="field"
                    value={composedTitle}
                    onChange={(event) => setComposedTitle(event.target.value)}
                    placeholder="New scenario title"
                  />
                </div>
                <ul className="glass-scroll mt-2.5 grid max-h-80 gap-2 overflow-y-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
                  {filteredAvailableInjects.map((inject) => {
                    const key = injectKey(inject);
                    const order = selectedInjectKeys.indexOf(key);
                    const selected = order >= 0;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => toggleAvailableInject(inject)}
                          className={cn(
                            "flex h-full w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary-wash"
                              : "glass-tile hover:border-primary/30",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-bold",
                              selected
                                ? "border-primary bg-primary text-primary-fg"
                                : "glass-tile text-meta",
                            )}
                          >
                            {selected ? order + 1 : "+"}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-meta">
                              {inject.packTitle}
                            </span>
                            <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-fg">
                              {inject.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-muted">
                              {Math.round(inject.timerSeconds / 60)} min ·{" "}
                              {inject.questionCount} questions ·{" "}
                              {inject.techniqueIds.slice(0, 3).join(" ") || "No TTP"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-2.5">
                  <p className="text-[12px] text-muted">
                    {selectedInjectKeys.length
                      ? `${selectedInjectKeys.length} selected · click selected cards to remove`
                      : "Select up to 12 injects"}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      pending ||
                      selectedInjectKeys.length === 0 ||
                      composedTitle.trim().length < 3
                    }
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      if (form) void composeFromInjects(form);
                    }}
                  >
                    {pending ? "Creating…" : "Create selected scenario"}
                  </button>
                </div>
              </>
            )}
          </FormCard>

          <FormCard
            collapsible
            defaultOpen={false}
            title="APT / intrusion set"
            description="Generate from known ATT&CK groups and their TTPs. Select up to 3 — injects follow the kill chain from those techniques. Works alone or with an advisory."
            meta={
              selectedAptIds.length
                ? `${selectedAptIds.length} selected`
                : undefined
            }
          >
            <input
              className="field h-10"
              value={aptQuery}
              onChange={(e) => setAptQuery(e.target.value)}
              placeholder="Search APT29, Lazarus, G0016…"
            />
            {groups.length === 0 ? (
              <p className="glass-inset rounded-xl px-3 py-2.5 text-[13px] text-muted">
                No ATT&CK groups seeded yet. Run{" "}
                <span className="font-mono text-[12px]">npm run attack:seed</span>{" "}
                or sync from Intel.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <ul className="glass-scroll flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                  {filteredApts.map((apt) => {
                    const checked = selectedAptIds.includes(apt.id);
                    const focusedRow = focusAptId === apt.id;
                    return (
                      <li key={apt.id}>
                        <button
                          type="button"
                          onClick={() => toggleApt(apt.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                            checked
                              ? "border-primary bg-primary-wash"
                              : focusedRow
                                ? "border-primary/40 bg-primary-wash/40"
                                : "glass-tile hover:border-primary/30",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                              checked
                                ? "border-primary bg-primary text-primary-fg"
                                : "glass-tile text-transparent",
                            )}
                            aria-hidden
                          >
                            {checked
                              ? String(selectedAptIds.indexOf(apt.id) + 1)
                              : "·"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] text-meta">
                                {apt.id}
                              </span>
                              <span className="text-[11px] text-meta">
                                {apt.techniqueCount} TTPs
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[13px] font-semibold text-fg">
                              {apt.name}
                            </span>
                            {apt.aliases && apt.aliases.length > 0 ? (
                              <span className="mt-0.5 block text-[11px] text-muted">
                                {apt.aliases.join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="glass-inset rounded-xl px-4 py-3">
                  {focusedApt ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-meta">
                          {focusedApt.id}
                        </span>
                        <span className="chip chip-on">{focusedApt.name}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
                        {focusedApt.description || "No description on file."}
                      </p>
                      {focusedApt.aliases && focusedApt.aliases.length > 0 ? (
                        <p className="mt-1.5 text-[12px] text-muted">
                          Also known as {focusedApt.aliases.join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-meta">
                        Known TTPs
                      </div>
                      <ul className="glass-scroll mt-1.5 max-h-48 overflow-y-auto">
                        {(focusedApt.techniques ?? []).map((t) => (
                          <li
                            key={t.id}
                            className="border-t border-border-soft py-2 first:border-t-0"
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-mono text-[11px] text-meta">
                                {t.id}
                              </span>
                              <span className="text-[12px] font-medium text-fg">
                                {t.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted">{t.tactic}</div>
                          </li>
                        ))}
                        {(focusedApt.techniques ?? []).length === 0 ? (
                          <li className="text-[12px] text-muted">
                            No linked techniques — re-seed ATT&CK data.
                          </li>
                        ) : null}
                      </ul>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">
                      Select an APT to preview description and TTPs.
                    </p>
                  )}
                </div>
              </div>
            )}
          </FormCard>

          <FormCard
            collapsible
            defaultOpen={Boolean(initialFeedId)}
            title="Cyber news"
            description="Latest headlines from CISA, NCSC, Krebs, BleepingComputer, The Record, The Hacker News, and Dark Reading. Select up to three to ground inject #1 in current events."
            meta={
              selectedNewsCount ? `${selectedNewsCount} selected` : undefined
            }
          >
            {newsItems.length === 0 ? (
              <p className="glass-inset rounded-xl px-3 py-2.5 text-[13px] text-muted">
                No news yet. Pull feeds on{" "}
                <a href="/intel" className="font-medium text-primary-hover underline">
                  Intel
                </a>
                .
              </p>
            ) : (
              <ul className="glass-scroll grid max-h-64 gap-2 overflow-y-auto pr-1 2xl:grid-cols-2">
                {newsItems.map((item) => {
                  const checked = selectedAdvisoryIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggleAdvisory(item.id)}
                        className={cn(
                          "flex h-full w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                          checked
                            ? "border-primary bg-primary-wash"
                            : "glass-tile hover:border-primary/30",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                            checked
                              ? "border-primary bg-primary text-primary-fg"
                              : "glass-tile text-transparent",
                          )}
                          aria-hidden
                        >
                          {checked ? String(selectedAdvisoryIds.indexOf(item.id) + 1) : "·"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-primary-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-hover">
                              {item.sourceLabel}
                            </span>
                            <span className="text-[11px] text-meta">
                              {new Date(item.publishedAt).toLocaleDateString()}
                            </span>
                          </span>
                          <span className="mt-1 block text-[13px] font-medium leading-snug text-fg">
                            {item.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </FormCard>

          <FormCard
            collapsible
            defaultOpen={false}
            title="Regulator advisory"
            description={`Pick from ${advisorySources.join(" · ") || "regulator"} feeds in the last 24 months for this sector. Select up to 3 — inject #1 opens from the first when set.`}
            meta={
              selectedRegulatorCount
                ? `${selectedRegulatorCount} selected`
                : undefined
            }
          >
            {advisoriesLoading ? (
              <p className="text-[13px] text-muted">Loading advisories…</p>
            ) : advisories.length === 0 ? (
              <p className="glass-inset rounded-xl px-3 py-2.5 text-[13px] text-muted">
                No sector advisories in the last 24 months. Import feeds on{" "}
                <a href="/intel" className="font-medium text-primary-hover underline">
                  Intel
                </a>
                , or paste text below.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <ul className="glass-scroll flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                  {advisories.map((item) => {
                    const checked = selectedAdvisoryIds.includes(item.id);
                    const focusedRow = focusAdvisoryId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleAdvisory(item.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                            checked
                              ? "border-primary bg-primary-wash"
                              : focusedRow
                                ? "border-primary/40 bg-primary-wash/40"
                                : "glass-tile hover:border-primary/30",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                              checked
                                ? "border-primary bg-primary text-primary-fg"
                                : "glass-tile text-transparent",
                            )}
                            aria-hidden
                          >
                            {checked ? String(selectedAdvisoryIds.indexOf(item.id) + 1) : "·"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="glass-tile px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meta">
                                {item.sourceLabel}
                              </span>
                              <span className="text-[11px] text-meta">
                                {new Date(item.publishedAt).toLocaleDateString()}
                              </span>
                            </span>
                            <span className="mt-1 block text-[13px] font-medium leading-snug text-fg">
                              {item.title}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="glass-inset rounded-xl px-4 py-3">
                  {focusedAdvisory ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip chip-on">{focusedAdvisory.sourceLabel}</span>
                        <span className="text-[12px] text-meta">
                          {new Date(focusedAdvisory.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-[15px] font-semibold leading-snug text-fg">
                        {focusedAdvisory.title}
                      </h4>
                      <p className="glass-reading mt-1.5 rounded-xl px-3 py-2 text-[13px] leading-relaxed text-fg-2">
                        {focusedAdvisory.excerpt}
                        {focusedAdvisory.bodyLength > focusedAdvisory.excerpt.length
                          ? "…"
                          : ""}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {focusedAdvisory.cveIds.map((id) => (
                          <span
                            key={id}
                            className="glass-tile px-1.5 py-0.5 font-mono text-[11px] text-fg-2"
                          >
                            {id}
                          </span>
                        ))}
                        {focusedAdvisory.groupIds.map((id) => (
                          <span
                            key={id}
                            className="glass-tile px-1.5 py-0.5 font-mono text-[11px] text-fg-2"
                          >
                            {id}
                          </span>
                        ))}
                        {focusedAdvisory.techniqueIds.slice(0, 4).map((id) => (
                          <span
                            key={id}
                            className="glass-tile px-1.5 py-0.5 font-mono text-[11px] text-fg-2"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                      {focusedAdvisory.url ? (
                        <a
                          href={focusedAdvisory.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2.5 inline-block text-[12px] font-medium text-primary-hover hover:underline"
                        >
                          Open source
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">
                      Select an advisory to preview details.
                    </p>
                  )}
                </div>
              </div>
            )}

            <FieldLabel
              label="Paste override"
              hint="Optional — used with or instead of selected feed items"
            >
              <textarea
                name="advisoryText"
                rows={4}
                className="field min-h-28 resize-y"
                placeholder="Paste an alert, circular, or flash report…"
              />
            </FieldLabel>
          </FormCard>

          <FormCard
            collapsible
            defaultOpen={false}
            title="Inject groups"
            description="Named response cells the SitMan should schedule into injects. Live runs can seat people onto these teams."
            meta={`${teamNames.length} group${teamNames.length === 1 ? "" : "s"}`}
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {teamNames.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="glass-tile flex items-center gap-2 px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-meta">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-fg">{name}</span>
                  <button
                    type="button"
                    className="text-[12px] text-muted hover:text-danger"
                    onClick={() =>
                      setTeamNames((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="field h-10 flex-1"
                value={teamDraft}
                onChange={(e) => setTeamDraft(e.target.value)}
                placeholder="Add group — e.g. Fraud Ops"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTeam();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!teamDraft.trim() || teamNames.length >= 8}
                onClick={addTeam}
              >
                Add
              </button>
            </div>
          </FormCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-14 xl:self-start">
          <FormCard
            title="AI provider"
            description="Used for SitMan generation and inject sync in the workshop. Leave on default to use Settings → AI."
          >
            <AiProviderSelect
              value={provider}
              onChange={setProvider}
              hint="Empty = portal default"
            />
            {provider === "cursor" ? (
              <p className="glass-inset rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted">
                Set <span className="font-mono">CURSOR_API_KEY</span> in your env. Optionally set{" "}
                <span className="font-mono">CURSOR_BASE_URL</span> to use an OpenAI-compatible proxy
                instead of the native SDK.
              </p>
            ) : null}
          </FormCard>

          <div className="flash-card px-5 py-4">
            {error ? (
              <p className="mb-2.5 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary h-11 w-full text-[15px] disabled:opacity-50"
            >
              {pending ? "Generating SitMan…" : "Generate exercise"}
            </button>
            <p className="mt-2 text-center text-[11px] leading-snug text-meta">
              Produces roles, inject groups, injects, rubric, and branching consequences
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
