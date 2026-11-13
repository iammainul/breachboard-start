"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ExerciseDocument } from "@/lib/schema/exercise";
import { sectorLabel } from "@/lib/cn";
import { useWorkspaceOrg } from "@/components/workspace-org";
import { InjectMediaList } from "@/components/inject-media";
import { mediaSource, mediaSourceLabel } from "@/lib/media/status";
import {
  composeMediaPrompt,
  orgVisualStyleGuide,
} from "@/lib/media/org-style-prompt";
import {
  PLACEHOLDER_HINT,
  generalizeInject,
  sourcePlaceholderContext,
} from "@/lib/scenario-placeholders";
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

type Tab = "sitman" | "attack" | "msel" | "media" | "json";

export function ScenarioEditor({
  id,
  initial,
  status: initialStatus = "draft",
  lineageKey,
}: {
  id: string;
  initial: ExerciseDocument;
  status?: string;
  lineageKey?: string | null;
  /** @deprecated Org is selected in the sidebar workspace control */
  organizations?: { id: string; name: string }[];
}) {
  const { selectedOrg, selectedOrgId } = useWorkspaceOrg();
  const [tab, setTab] = useState<Tab>("sitman");
  const [document, setDocument] = useState(initial);
  const [packStatus, setPackStatus] = useState(initialStatus);
  const readOnly = packStatus !== "draft";
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(initial, null, 2),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [mediaBusyId, setMediaBusyId] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProviderChoice>("");
  const [accepting, setAccepting] = useState(false);
  const [forking, setForking] = useState(false);
  const [selectedInjectId, setSelectedInjectId] = useState<string | null>(null);

  const styleGuide = useMemo(
    () => orgVisualStyleGuide(selectedOrg),
    [selectedOrg],
  );

  const orderedInjects = useMemo(
    () => document.injects.slice().sort((a, b) => a.sequence - b.sequence),
    [document.injects],
  );

  const activeInject =
    orderedInjects.find((inject) => inject.id === selectedInjectId) ??
    orderedInjects[0] ??
    null;

  const tactics = useMemo(() => {
    const map = new Map<string, ExerciseDocument["attackMap"]["techniques"]>();
    for (const tech of document.attackMap.techniques) {
      const list = map.get(tech.tactic) ?? [];
      list.push(tech);
      map.set(tech.tactic, list);
    }
    return Array.from(map.entries());
  }, [document.attackMap.techniques]);

  async function save(next: ExerciseDocument) {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    setSaving(true);
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setStatus(json.error ?? "Save failed");
      return;
    }
    setDocument(next);
    setJsonText(JSON.stringify(next, null, 2));
    setStatus("Saved");
  }

  function patchInject(
    injectId: string,
    patch: Partial<ExerciseDocument["injects"][number]>,
  ) {
    setDocument({
      ...document,
      injects: document.injects.map((inj) =>
        inj.id === injectId ? { ...inj, ...patch } : inj,
      ),
    });
  }

  function patchQuestion(
    injectId: string,
    index: number,
    patch: Partial<ExerciseDocument["injects"][number]["questions"][number]>,
  ) {
    const inject = document.injects.find((inj) => inj.id === injectId);
    if (!inject) return;
    const questions = inject.questions.map((question, i) => {
      if (i !== index) return question;
      const next = { ...question, ...patch };
      if (patch.common === true) {
        next.common = true;
        next.roleIds = document.roles.map((role) => role.id);
      } else if (patch.roleId !== undefined) {
        next.common = false;
        next.roleIds = patch.roleId ? [patch.roleId] : [];
      }
      return next;
    });
    patchInject(injectId, { questions });
  }

  function addQuestion(injectId: string) {
    const inject = document.injects.find((inj) => inj.id === injectId);
    if (!inject) return;
    const roleId = document.roles[0]?.id ?? "";
    patchInject(injectId, {
      questions: [
        ...inject.questions,
        {
          roleId,
          roleIds: roleId ? [roleId] : [],
          common: false,
          prompt: "",
          expectedAction: "",
          points: 5,
        },
      ],
    });
  }

  function removeQuestion(injectId: string, index: number) {
    const inject = document.injects.find((inj) => inj.id === injectId);
    if (!inject || inject.questions.length <= 1) return;
    patchInject(injectId, {
      questions: inject.questions.filter((_, i) => i !== index),
    });
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as ExerciseDocument;
      void save(parsed);
    } catch {
      setStatus("Invalid JSON");
    }
  }

  async function startRun() {
    if (!selectedOrgId) {
      setStatus("Select a working organization in the sidebar first.");
      return;
    }
    setStarting(true);
    setStatus(null);
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: id,
        organizationId: selectedOrgId,
        runKind: "draft",
      }),
    });
    const json = await response.json();
    setStarting(false);
    if (!response.ok) {
      setStatus(json.error ?? "Could not start run");
      return;
    }
    window.location.href = `/sessions/${json.id}`;
  }

  async function acceptPack() {
    if (!selectedOrgId) {
      setStatus("Select a working organization in the sidebar first.");
      return;
    }
    setAccepting(true);
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrgId }),
    });
    const json = await response.json().catch(() => ({}));
    setAccepting(false);
    if (!response.ok) {
      setStatus(json.error ?? "Could not accept scenario");
      return;
    }
    setPackStatus("accepted");
    setStatus(
      json.previousId
        ? "Accepted. Previous version retired — pack slug moved here."
        : "Accepted for this organization. Engagements can launch this pack.",
    );
  }

  async function forkDraft() {
    setForking(true);
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}/fork`, { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setForking(false);
    if (!response.ok) {
      setStatus(json.error ?? "Could not create draft");
      return;
    }
    if (json.exercise?.id) {
      window.location.href = `/scenarios/${json.exercise.id}`;
    }
  }

  async function generateAllMedia() {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    const injects = document.injects.slice().sort((a, b) => a.sequence - b.sequence);
    for (const inject of injects) {
      await generateMedia(inject.id);
    }
  }

  async function generateMedia(injectId: string) {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    setMediaBusyId(injectId);
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}/injects/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        injectId,
        organizationId: selectedOrgId ?? undefined,
        provider: providerOrUndefined(provider),
        generateImages: true,
      }),
    });
    const json = await response.json();
    setMediaBusyId(null);
    if (!response.ok) {
      setStatus(json.error ?? "Media generation failed");
      return;
    }
    if (json.document) {
      setDocument(json.document);
      setJsonText(JSON.stringify(json.document, null, 2));
    }
    const sources = Array.isArray(json.mediaPrompts)
      ? json.mediaPrompts
          .filter((m: { kind?: string }) => m.kind === "image")
          .map((m: { source?: string }) => m.source ?? "missing")
      : [];
    const generated = sources.filter((s: string) => s === "generated").length;
    const fallback = sources.filter((s: string) => s === "fallback").length;
    const imageNote =
      generated > 0
        ? ` ${generated} AI image${generated === 1 ? "" : "s"}${json.imageProviderId ? ` via ${json.imageProviderId}` : ""}.`
        : "";
    const fallbackNote =
      fallback > 0
        ? ` ${fallback} fallback board${fallback === 1 ? "" : "s"}.`
        : "";
    const errNote =
      Array.isArray(json.imageErrors) && json.imageErrors.length
        ? ` ${json.imageErrors[0]}`
        : "";
    const pickNote =
      sources.length > 1
        ? " Pick one board for Stage and remove the rest."
        : "";
    setStatus(
      `Stage media updated.${imageNote}${fallbackNote}${errNote}${pickNote}`.trim(),
    );
  }

  async function uploadMedia(injectId: string, file: File) {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    setMediaBusyId(injectId);
    setStatus(null);
    const data = new FormData();
    data.set("injectId", injectId);
    data.set("file", file);
    const response = await fetch(`/api/scenarios/${id}/injects/media/upload`, {
      method: "POST",
      body: data,
    });
    const json = await response.json();
    setMediaBusyId(null);
    if (!response.ok) {
      setStatus(json.error ?? "Upload failed");
      return;
    }
    if (json.document) {
      setDocument(json.document);
      setJsonText(JSON.stringify(json.document, null, 2));
    } else if (Array.isArray(json.mediaPrompts)) {
      setDocument((prev) => {
        const next = structuredClone(prev);
        const idx = next.injects.findIndex((i) => i.id === injectId);
        if (idx >= 0) {
          next.injects[idx] = {
            ...next.injects[idx],
            mediaPrompts: json.mediaPrompts,
          };
        }
        setJsonText(JSON.stringify(next, null, 2));
        return next;
      });
    }
    setStatus(`Uploaded ${json.kind} — image is on Stage now.`);
  }

  async function patchMedia(
    injectId: string,
    body: { keepIndex: number } | { deleteIndex: number },
  ) {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    setMediaBusyId(injectId);
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}/injects/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ injectId, ...body }),
    });
    const json = await response.json();
    setMediaBusyId(null);
    if (!response.ok) {
      setStatus(json.error ?? "Could not update media");
      return;
    }
    if (json.document) {
      setDocument(json.document);
      setJsonText(JSON.stringify(json.document, null, 2));
    }
    setStatus(
      "keepIndex" in body
        ? "That board is on Stage. Other images were removed."
        : "Removed that file.",
    );
  }

  async function generateNewInject() {
    if (readOnly) {
      setStatus("Accepted packs are locked. Fork a new draft to edit.");
      return;
    }
    setMediaBusyId("new-inject");
    setStatus(null);
    const response = await fetch(`/api/scenarios/${id}/injects/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerOrUndefined(provider),
        guidance: "New notification inject using {{org}} and {{team}} tokens.",
      }),
    });
    const json = await response.json();
    setMediaBusyId(null);
    if (!response.ok) {
      setStatus(json.error ?? "Could not generate inject");
      return;
    }
    if (json.document) {
      setDocument(json.document);
      setJsonText(JSON.stringify(json.document, null, 2));
    }
    if (json.inject?.id) setSelectedInjectId(json.inject.id);
    setStatus("New inject added. Review on MSEL, then Save if you tweak it.");
  }

  function convertActiveToPlaceholders() {
    if (!activeInject) return;
    const portable = generalizeInject(
      activeInject,
      sourcePlaceholderContext({
        orgName: selectedOrg?.name,
        sector: document.sector,
        teamDefinitions: document.teamDefinitions,
      }),
    );
    patchInject(activeInject.id, portable);
    setStatus("Client and team names converted to {{org}} / {{team}} tokens.");
  }

  async function copyPrompt(
    prompt: string,
    inject: ExerciseDocument["injects"][number],
  ) {
    const full = composeMediaPrompt(prompt, selectedOrg, { inject });
    try {
      await navigator.clipboard.writeText(full);
      setStatus("Copied generator prompt (tabletop board + severity color).");
    } catch {
      setStatus("Could not copy to clipboard.");
    }
  }
  const showInjectRail = tab === "msel" || tab === "media";

  return (
    <div className="flex min-h-0 flex-col gap-3 xl:flex-1">
      <header className="flash-card glass-chrome shrink-0 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[22px] font-bold tracking-tight text-fg sm:text-[26px]">
              {document.title}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {packStatus === "accepted"
                ? "Accepted"
                : packStatus === "retired"
                  ? "Retired"
                  : "Draft"}{" "}
              {lineageKey ? `· ${lineageKey}` : ""} · {document.durationMin} min ·{" "}
              {sectorLabel(document.sector)} ·{" "}
              {document.attackMap.groupId ?? "ungrouped"} · {document.injects.length}{" "}
              injects
            </p>
            <p className="mt-1 text-[12px] leading-snug text-meta">
              {readOnly
                ? "This version is locked. Fork a new draft to edit, or open a rehearsal run."
                : "Edit the draft, then accept it for the working organization. Accepting retires the previous accepted pack and moves that slug here."}
            </p>
            {!selectedOrgId ? (
              <p className="mt-1.5 text-[12px] leading-snug text-warn">
                Choose a working organization in the sidebar before starting a run
                or generating Stage media.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
            {packStatus === "draft" ? (
              <button
                type="button"
                disabled={accepting || !selectedOrgId}
                onClick={() => void acceptPack()}
                className="btn btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {accepting ? "Accepting…" : "Accept for organization"}
              </button>
            ) : packStatus === "accepted" ? (
              <button
                type="button"
                disabled={forking}
                onClick={() => void forkDraft()}
                className="btn btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {forking ? "Forking…" : "New draft from accepted"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={starting || !selectedOrgId}
              onClick={() => void startRun()}
              className="btn btn-ghost whitespace-nowrap disabled:opacity-50"
            >
              {starting ? "Opening draft…" : "Open draft run"}
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setWorkshopOpen(true)}
              className="btn btn-ghost whitespace-nowrap disabled:opacity-50"
            >
              Inject workshop
            </button>
            <button
              type="button"
              onClick={() => void save(document)}
              disabled={saving || readOnly}
              className="btn btn-ghost whitespace-nowrap disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="glass-inset flex flex-wrap gap-1 rounded-xl p-1">
            {(
              [
                ["sitman", "SitMan"],
                ["attack", "ATT&CK + TDPs"],
                ["msel", "MSEL"],
                ["media", "Media"],
                ["json", "JSON"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "json") {
                    setJsonText(JSON.stringify(document, null, 2));
                  }
                  setTab(key);
                }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  tab === key
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {status ? <p className="text-[12px] text-muted">{status}</p> : null}
        </div>
      </header>

      {workshopOpen ? (
        <InjectWorkshop
          exerciseId={id}
          initialDocument={document}
          provider={providerOrUndefined(provider)}
          onClose={() => {
            setWorkshopOpen(false);
            void fetch(`/api/scenarios/${id}`)
              .then((r) => r.json())
              .then((ex) => {
                if (ex?.document) {
                  setDocument(ex.document);
                  setJsonText(JSON.stringify(ex.document, null, 2));
                }
              });
          }}
        />
      ) : null}

      <div
        className={`grid min-h-0 flex-1 gap-3 ${
          showInjectRail ? "xl:grid-cols-[300px_minmax(0,1fr)]" : ""
        }`}
      >
        {showInjectRail ? (
          <aside className="flash-card glass-dock min-h-0">
            <div className="glass-header flex shrink-0 items-center px-4 py-2.5">
              <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                {orderedInjects.length} injects
              </span>
            </div>
            <div className="glass-scroll max-h-72 min-h-0 flex-1 overflow-y-auto xl:max-h-none">
              {orderedInjects.map((inject) => (
                <button
                  key={inject.id}
                  type="button"
                  onClick={() => setSelectedInjectId(inject.id)}
                  data-active={
                    activeInject?.id === inject.id ? "true" : undefined
                  }
                  className="glass-row flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-mono text-[11px] text-meta">
                      {String(inject.sequence).padStart(2, "0")}
                    </span>
                    {(inject.mediaPrompts ?? []).length > 0 ? (
                      <span className="chip text-[10px]">
                        {mediaSourceLabel(
                          mediaSource(
                            inject.mediaPrompts?.find((m) => m.kind === "image"),
                          ),
                        )}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[11px] text-meta">
                      {inject.timerSeconds}s
                    </span>
                  </span>
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">
                    {inject.title}
                  </span>
                </button>
              ))}
            </div>
            {tab === "msel" && !readOnly ? (
              <div className="shrink-0 border-t border-border-soft px-3 py-3">
                <AiProviderSelect
                  value={provider}
                  onChange={setProvider}
                  label="AI for new inject"
                  hint="Uses SitMan roles and ATT&CK map"
                />
                <button
                  type="button"
                  className="btn btn-primary mt-2 h-9 w-full whitespace-nowrap text-[13px] disabled:opacity-50"
                  disabled={mediaBusyId !== null}
                  onClick={() => void generateNewInject()}
                >
                  {mediaBusyId === "new-inject"
                    ? "Generating inject…"
                    : "Generate inject"}
                </button>
              </div>
            ) : null}
            {tab === "media" ? (
              <div className="shrink-0 border-t border-border-soft px-3 py-3">
                <AiProviderSelect
                  value={provider}
                  onChange={setProvider}
                  label="AI for prompts / sync"
                  hint="Images use OpenAI or Gemini (default when capable)"
                />
                <button
                  type="button"
                  className="btn btn-primary mt-2 h-9 w-full whitespace-nowrap text-[13px] disabled:opacity-50"
                  disabled={readOnly || mediaBusyId !== null}
                  onClick={() => void generateAllMedia()}
                >
                  {mediaBusyId ? "Generating…" : "Generate all inject images"}
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}

        {tab === "sitman" ? (
          <section className="flash-card glass-dock min-h-0">
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="flex min-w-0 flex-col gap-3.5">
                  <section className="glass-inset rounded-[var(--radius)] px-4 py-3.5">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                      Objectives
                    </h2>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-fg-2">
                      {document.objectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </section>
                  {document.modules.map((mod) => (
                    <section
                      key={mod.id}
                      className="glass-reading rounded-[var(--radius)] border border-border-soft p-4 sm:p-5"
                    >
                      <h2 className="text-[16px] font-semibold text-fg">
                        {mod.name}
                      </h2>
                      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-2">
                        {mod.narrative}
                      </p>
                      <h3 className="mt-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                        Discussion
                      </h3>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-fg-2">
                        {mod.discussionQuestions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <aside className="flex min-w-0 flex-col gap-2">
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                    Roles
                  </h2>
                  {document.roles.map((role) => (
                    <div key={role.id} className="glass-tile px-3 py-2">
                      <div className="text-[13px] font-medium text-fg">
                        {role.name}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-muted">
                        {role.description}
                      </p>
                    </div>
                  ))}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {document.regulatorTags.map((tag) => (
                      <span key={tag} className="chip text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "attack" ? (
          <section className="flash-card glass-dock min-h-0">
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3.5 xl:grid-cols-2">
                <section className="flex min-w-0 flex-col gap-2.5">
                  <div>
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                      Coverage
                    </h2>
                    <p className="mt-1 font-mono text-[12px] text-fg-2">
                      {document.attackMap.groupId} {document.attackMap.groupName}
                    </p>
                  </div>
                  {tactics.map(([tactic, techs]) => (
                    <div
                      key={tactic}
                      className="glass-inset rounded-xl px-3 py-2.5"
                    >
                      <div className="text-[12px] font-medium text-muted">
                        {tactic}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {techs.map((t) => (
                          <span
                            key={t.id}
                            className="chip font-mono text-[11px] text-fg-2"
                          >
                            {t.id} {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
                <section className="flex min-w-0 flex-col gap-2">
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                    Detection playbooks
                  </h2>
                  {document.detectionPlaybooks.map((pb) => (
                    <div
                      key={`${pb.techniqueId}-${pb.name}`}
                      className="glass-tile px-3 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-fg">
                          {pb.name}
                        </span>
                        <span className="font-mono text-[11px] text-meta">
                          {pb.techniqueId}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {pb.logSource} · {pb.alertName}
                        {pb.d3fendId ? ` · ${pb.d3fendId}` : ""}
                      </p>
                      <p className="mt-0.5 text-[12px] text-fg-2">
                        {pb.expectedDetection}
                      </p>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "msel" ? (
          <section className="flash-card glass-dock min-h-0">
            {activeInject ? (
              <>
                <div className="glass-header flex shrink-0 flex-col gap-2 px-4 py-2.5 sm:px-5">
                  {readOnly ? (
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-mono text-[11px] text-meta">
                        {String(activeInject.sequence).padStart(2, "0")}
                      </span>
                      <h3 className="text-[16px] font-semibold text-fg">
                        {activeInject.title}
                      </h3>
                      <span className="text-[11px] text-meta">
                        {activeInject.timerSeconds}s
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-meta">
                        {String(activeInject.sequence).padStart(2, "0")}
                      </span>
                      <input
                        value={activeInject.title}
                        onChange={(e) =>
                          patchInject(activeInject.id, { title: e.target.value })
                        }
                        className="field h-9 min-w-0 flex-1 text-[15px] font-semibold"
                        aria-label="Inject title"
                      />
                      <label className="flex items-center gap-1.5 text-[12px] text-meta">
                        Timer
                        <input
                          type="number"
                          min={30}
                          max={900}
                          step={30}
                          value={activeInject.timerSeconds}
                          onChange={(e) =>
                            patchInject(activeInject.id, {
                              timerSeconds: Number(e.target.value) || 30,
                            })
                          }
                          className="field h-9 w-20 font-mono text-[13px]"
                        />
                        s
                      </label>
                    </div>
                  )}
                </div>
                <div className="glass-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  <div className="flex flex-col gap-3.5">
                    {readOnly ? (
                      <p className="glass-reading rounded-[var(--radius)] border border-border-soft px-4 py-3.5 text-[13px] leading-relaxed text-fg-2">
                        {activeInject.body}
                      </p>
                    ) : (
                      <>
                        <textarea
                          value={activeInject.body}
                          onChange={(e) =>
                            patchInject(activeInject.id, { body: e.target.value })
                          }
                          className="field glass-reading min-h-28 resize-y text-[13px] leading-relaxed"
                          aria-label="Inject body"
                          placeholder="Use {{org}}, {{team}}, {{teams}}, {{sector}} so this inject can move between clients."
                        />
                        <p className="font-mono text-[11px] text-meta">
                          {PLACEHOLDER_HINT}
                        </p>
                      </>
                    )}
                    {activeInject.techniqueIds.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeInject.techniqueIds.map((tid) => (
                          <span
                            key={tid}
                            className="chip font-mono text-[11px] text-muted"
                          >
                            {tid}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                        Role questions
                      </h4>
                      {!readOnly ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost h-8 px-3 text-[12px]"
                            onClick={convertActiveToPlaceholders}
                          >
                            Use org/team tokens
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost h-8 px-3 text-[12px]"
                            onClick={() => addQuestion(activeInject.id)}
                          >
                            Add question
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {readOnly ? (
                      <ul className="grid gap-2 text-[13px] text-fg-2 2xl:grid-cols-2">
                        {activeInject.questions.map((q) => (
                          <li
                            key={`${q.roleId}-${q.prompt}`}
                            className="glass-inset rounded-xl px-3 py-2 leading-relaxed"
                          >
                            <span className="font-medium text-primary-hover">
                              {q.roleId}
                            </span>
                            {" · "}
                            {q.prompt}
                            <span className="text-meta"> ({q.points} pts)</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="grid gap-2 2xl:grid-cols-2">
                        {activeInject.questions.map((q, qIdx) => (
                          <li
                            key={`${activeInject.id}-q-${qIdx}`}
                            className="glass-inset flex flex-col gap-2 rounded-xl px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={q.common ? "" : q.roleId}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    patchQuestion(activeInject.id, qIdx, {
                                      common: true,
                                    });
                                    return;
                                  }
                                  patchQuestion(activeInject.id, qIdx, {
                                    roleId: e.target.value,
                                    common: false,
                                  });
                                }}
                                className="field h-8 min-w-0 flex-1 text-[12px]"
                                aria-label="Question role"
                              >
                                <option value="">All roles</option>
                                {document.roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1 text-[12px] text-meta">
                                Pts
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={q.points}
                                  onChange={(e) =>
                                    patchQuestion(activeInject.id, qIdx, {
                                      points: Number(e.target.value) || 1,
                                    })
                                  }
                                  className="field h-8 w-16 font-mono text-[12px]"
                                />
                              </label>
                              <button
                                type="button"
                                className="btn btn-ghost h-8 px-2 text-[12px] text-danger disabled:opacity-40"
                                disabled={activeInject.questions.length <= 1}
                                onClick={() =>
                                  removeQuestion(activeInject.id, qIdx)
                                }
                              >
                                Remove
                              </button>
                            </div>
                            <textarea
                              value={q.prompt}
                              onChange={(e) =>
                                patchQuestion(activeInject.id, qIdx, {
                                  prompt: e.target.value,
                                })
                              }
                              className="field min-h-16 resize-y text-[13px]"
                              placeholder="Question the player sees"
                              aria-label="Question prompt"
                            />
                            <textarea
                              value={q.expectedAction}
                              onChange={(e) =>
                                patchQuestion(activeInject.id, qIdx, {
                                  expectedAction: e.target.value,
                                })
                              }
                              className="field min-h-14 resize-y text-[12px] text-fg-2"
                              placeholder="Expected action (grading)"
                              aria-label="Expected action"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {activeInject.consequences.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeInject.consequences.map((c) => (
                          <span
                            key={c.id}
                            className="glass-tile px-2.5 py-1 text-[11px] text-fg-2"
                          >
                            {c.label} ({c.scoreDelta >= 0 ? "+" : ""}
                            {c.scoreDelta}
                            {c.nextInjectId ? ` → ${c.nextInjectId}` : ""})
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {tab === "media" ? (
          <section className="flash-card glass-dock min-h-0">
            {activeInject ? (
              <div className="glass-header flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <h3 className="text-[15px] font-semibold">
                  INJ-{String(activeInject.sequence).padStart(2, "0")} ·{" "}
                  {activeInject.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <label className="btn btn-ghost h-9 cursor-pointer whitespace-nowrap text-[13px]">
                    {mediaBusyId === activeInject.id
                      ? "Working…"
                      : "Upload file"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                      className="sr-only"
                      disabled={mediaBusyId === activeInject.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadMedia(activeInject.id, file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost h-9 whitespace-nowrap text-[13px] disabled:opacity-50"
                    disabled={mediaBusyId === activeInject.id}
                    onClick={() => void generateMedia(activeInject.id)}
                  >
                    {mediaBusyId === activeInject.id
                      ? "Generating…"
                      : "Generate image"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-col gap-3.5">
                <div className="glass-inset rounded-[var(--radius)] px-4 py-3.5">
                  <h2 className="text-[15px] font-semibold text-fg">
                    Stage images & videos
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Generate AI image prompts for each inject, or upload
                    PNG/JPEG/WebP/GIF and MP4/WebM files for the live console and
                    Stage. Generate can return 1–2 candidate boards — pick one
                    for Stage and remove the rest. Prompts describe facilitator
                    briefing boards — neutral field, severity color on the banner
                    and callout only.
                    {selectedOrg
                      ? ` House style for ${selectedOrg.name} applies to AI prompts.`
                      : ""}
                  </p>
                  <pre className="glass-scroll mt-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 font-mono text-[11px] text-fg-2">
                    {styleGuide}
                  </pre>
                </div>

                {activeInject ? (
                  <>
                    <p className="line-clamp-2 text-[12px] text-muted">
                      {activeInject.body}
                    </p>
                    {(activeInject.mediaPrompts ?? []).length === 0 ? (
                      <p className="text-[13px] text-muted">
                        No Stage media yet — generate with AI or upload an
                        image/video.
                      </p>
                    ) : (
                      <>
                        {(activeInject.mediaPrompts ?? []).filter(
                          (m) => m.kind !== "video",
                        ).length > 1 ? (
                          <p className="text-[13px] text-fg-2">
                            Multiple boards came back. Choose one for Stage — the
                            others are deleted.
                          </p>
                        ) : null}
                        <ul className="grid gap-3 2xl:grid-cols-2">
                        {(activeInject.mediaPrompts ?? []).map((m, idx) => (
                          <li
                            key={`${activeInject.id}-${idx}`}
                            className="glass-inset flex flex-col rounded-[var(--radius)] px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                <span className="chip chip-on uppercase">
                                  {m.kind}
                                </span>
                                {m.aspect ? (
                                  <span className="text-meta">{m.aspect}</span>
                                ) : null}
                                {m.durationSec ? (
                                  <span className="text-meta">
                                    {m.durationSec}s
                                  </span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost h-8 px-3 text-[12px]"
                                onClick={() => void copyPrompt(m.prompt, activeInject)}
                              >
                                Copy with style
                              </button>
                            </div>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
                              {m.prompt}
                            </p>
                            <div className="mt-2.5 overflow-hidden">
                              <InjectMediaList items={[m]} pick="all" showStatus />
                              {m.assetPath ? (
                                <p className="px-3 py-2 font-mono text-[11px] text-meta">
                                  {m.assetPath}
                                </p>
                              ) : null}
                            </div>
                            {!readOnly ? (
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                {(activeInject.mediaPrompts ?? []).filter(
                                  (item) => item.kind !== "video",
                                ).length > 1 && m.kind !== "video" ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary h-8 px-3 text-[12px] disabled:opacity-50"
                                    disabled={mediaBusyId === activeInject.id}
                                    onClick={() =>
                                      void patchMedia(activeInject.id, {
                                        keepIndex: idx,
                                      })
                                    }
                                  >
                                    Use this on Stage
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-ghost h-8 px-3 text-[12px] text-danger disabled:opacity-50"
                                  disabled={mediaBusyId === activeInject.id}
                                  onClick={() =>
                                    void patchMedia(activeInject.id, {
                                      deleteIndex: idx,
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                        </ul>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "json" ? (
          <section className="flash-card glass-dock min-h-0">
            <div className="min-h-0 flex-1 p-4 sm:p-5">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="field glass-scroll h-full min-h-[360px] w-full resize-none font-mono text-[12px]"
              />
            </div>
            <div className="flex shrink-0 justify-end border-t border-border-soft px-4 py-2.5 sm:px-5">
              <button type="button" onClick={applyJson} className="btn btn-ghost">
                Apply JSON
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
