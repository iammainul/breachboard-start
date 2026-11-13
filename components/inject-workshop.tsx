"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseDocument, LlmProvider } from "@/lib/schema/exercise";
import {
  AiProviderSelect,
  providerOrUndefined,
  type AiProviderChoice,
} from "@/components/ai-provider-select";

type LibInject = {
  packKey: string;
  packTitle: string;
  id: string;
  title: string;
  techniqueIds: string[];
  questionCount: number;
  targetRoleIds: string[];
  body: string;
  questions: ExerciseDocument["injects"][number]["questions"];
  mediaPrompts: ExerciseDocument["injects"][number]["mediaPrompts"];
  timerSeconds: number;
  aiGradeRubric: string;
  consequences: ExerciseDocument["injects"][number]["consequences"];
  activeTeamIds: string[];
  sequence: number;
};

export function InjectWorkshop({
  exerciseId,
  initialDocument,
  provider: initialProvider,
  onClose,
}: {
  exerciseId: string;
  initialDocument: ExerciseDocument;
  provider?: LlmProvider;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [library, setLibrary] = useState<LibInject[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProviderChoice>(
    initialProvider ?? "",
  );

  useEffect(() => {
    void fetch("/api/injects")
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.injects) ? payload.injects : [];
        const flat: LibInject[] = rows.map(
          (row: {
            sourceId: string;
            sourceTitle: string;
            injectId: string;
            title: string;
            techniqueIds: string[];
            questionCount: number;
            targetRoleIds: string[];
            body: string;
            questions: LibInject["questions"];
            mediaPrompts: LibInject["mediaPrompts"];
            timerSeconds: number;
            aiGradeRubric: string;
            consequences: LibInject["consequences"];
            activeTeamIds: string[];
            sequence: number;
          }) => ({
            packKey: row.sourceId,
            packTitle: row.sourceTitle,
            id: row.injectId,
            title: row.title,
            techniqueIds: row.techniqueIds,
            questionCount: row.questionCount,
            targetRoleIds: row.targetRoleIds,
            body: row.body,
            questions: row.questions,
            mediaPrompts: row.mediaPrompts,
            timerSeconds: row.timerSeconds,
            aiGradeRubric: row.aiGradeRubric,
            consequences: row.consequences,
            activeTeamIds: row.activeTeamIds,
            sequence: row.sequence,
          }),
        );
        setLibrary(flat);
      })
      .catch(() => undefined);
  }, []);

  const techSet = useMemo(
    () => new Set(document.attackMap.techniques.map((t) => t.id)),
    [document.attackMap.techniques],
  );

  const rankedLibrary = useMemo(() => {
    return library
      .map((inj) => ({
        inj,
        score: inj.techniqueIds.filter((id: string) => techSet.has(id)).length,
      }))
      .sort((a, b) => b.score - a.score);
  }, [library, techSet]);

  const resolvedProvider = providerOrUndefined(provider);

  async function regenerate(injectId: string) {
    setBusyId(injectId);
    setError(null);
    const response = await fetch(
      `/api/scenarios/${exerciseId}/injects/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          injectId,
          guidance,
          provider: resolvedProvider,
        }),
      },
    );
    const json = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(json.error ?? "Regenerate failed");
      return;
    }
    setDocument(json.document);
  }

  async function generateNewInject() {
    setBusyId("new-inject");
    setError(null);
    const response = await fetch(`/api/scenarios/${exerciseId}/injects/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guidance:
          guidance.trim() ||
          "New notification inject using {{org}} and {{team}} tokens.",
        provider: resolvedProvider,
      }),
    });
    const json = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(json.error ?? "Generate failed");
      return;
    }
    setDocument(json.document);
  }

  async function syncAllInjects() {
    setSyncing(true);
    setError(null);
    const ordered = document.injects
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    let latest = document;
    for (const inject of ordered) {
      setBusyId(inject.id);
      const response = await fetch(
        `/api/scenarios/${exerciseId}/injects/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            injectId: inject.id,
            guidance:
              guidance.trim() ||
              "Sync tone, role questions, and consequences with the rest of this SitMan so injects feel like one coherent exercise.",
            provider: resolvedProvider,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        setBusyId(null);
        setSyncing(false);
        setError(json.error ?? `Sync failed on ${inject.title}`);
        return;
      }
      latest = json.document;
      setDocument(latest);
    }
    setBusyId(null);
    setSyncing(false);
  }

  async function replace(injectId: string, lib: LibInject) {
    setBusyId(injectId);
    setError(null);
    const replacement = {
      id: injectId,
      sequence: document.injects.find((i) => i.id === injectId)?.sequence ?? 1,
      title: lib.title,
      body: lib.body,
      timerSeconds: lib.timerSeconds,
      targetRoleIds: lib.targetRoleIds,
      techniqueIds: lib.techniqueIds,
      activeTeamIds: lib.activeTeamIds ?? [],
      questions: lib.questions,
      aiGradeRubric: lib.aiGradeRubric,
      consequences: lib.consequences,
      mediaPrompts: lib.mediaPrompts ?? [],
    };
    const response = await fetch(
      `/api/scenarios/${exerciseId}/injects/replace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injectId, replacement }),
      },
    );
    const json = await response.json();
    setBusyId(null);
    setPickerFor(null);
    if (!response.ok) {
      setError(json.error ?? "Replace failed");
      return;
    }
    setDocument(json.document);
  }

  function done() {
    if (onClose) onClose();
    router.push(`/scenarios/${exerciseId}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      <header className="glass-header flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-hover">
            Inject workshop
          </p>
          <h1 className="text-[20px] font-bold tracking-tight">{document.title}</h1>
          <p className="text-[13px] text-muted">
            Swap any catalog inject or generate a new one. {"{{org}} / {{team}}"} fill at run time.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={done}>
            Skip
          </button>
          <button type="button" className="btn btn-primary" onClick={done}>
            Done — open scenario
          </button>
        </div>
      </header>

      <div className="glass-scroll mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="flash-card glass-chrome flex shrink-0 flex-col gap-3 px-4 py-3.5 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.5fr)_auto] lg:items-end">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">
                AI sync guidance (optional)
              </span>
              <input
                className="field h-10"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="e.g. More RBI-focused legal questions"
              />
            </label>
            <AiProviderSelect
              value={provider}
              onChange={setProvider}
              label="AI for sync"
              hint="Same choice as Generate · empty = default"
            />
            <button
              type="button"
              className="btn btn-primary h-10 whitespace-nowrap disabled:opacity-50"
              disabled={syncing || busyId !== null}
              onClick={() => void generateNewInject()}
            >
              {busyId === "new-inject" ? "Generating…" : "Generate inject"}
            </button>
            <button
              type="button"
              className="btn btn-primary h-10 whitespace-nowrap disabled:opacity-50"
              disabled={syncing || busyId !== null}
              onClick={() => void syncAllInjects()}
            >
              {syncing ? "Syncing injects…" : "Sync all injects with AI"}
            </button>
          </div>
          <p className="text-[12px] leading-snug text-muted">
            Sync rewrites every inject with the selected AI so tone and questions
            align across the MSEL.
          </p>
        </div>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <ul className="grid gap-2.5 2xl:grid-cols-2">
          {document.injects
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((inject) => (
              <li key={inject.id} className="flash-card px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] text-meta">
                      INJ-{String(inject.sequence).padStart(2, "0")}
                    </div>
                    <h2 className="mt-0.5 text-[16px] font-semibold leading-snug">
                      {inject.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">
                      {inject.body}
                    </p>
                    <p className="mt-1.5 text-[12px] text-meta">
                      {inject.questions.length} questions ·{" "}
                      {inject.targetRoleIds.join(", ")} ·{" "}
                      {inject.techniqueIds.join(" ") || "no TTP"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === inject.id || syncing}
                      className="btn btn-ghost disabled:opacity-50"
                      onClick={() =>
                        setPickerFor(pickerFor === inject.id ? null : inject.id)
                      }
                    >
                      Replace from catalog
                    </button>
                    <button
                      type="button"
                      disabled={busyId === inject.id || syncing}
                      className="btn btn-primary disabled:opacity-50"
                      onClick={() => void regenerate(inject.id)}
                    >
                      {busyId === inject.id ? "Working…" : "Sync with AI"}
                    </button>
                  </div>
                </div>

                {pickerFor === inject.id ? (
                  <div className="glass-inset mt-3 overflow-hidden rounded-xl">
                    <p className="px-4 pb-1.5 pt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-meta">
                      Available injects
                    </p>
                    {rankedLibrary.length === 0 ? (
                      <p className="px-4 pb-3 text-[13px] text-muted">
                        No injects in the catalog yet.
                      </p>
                    ) : (
                      <ul className="glass-scroll flex max-h-56 flex-col overflow-y-auto">
                        {rankedLibrary.map(({ inj, score }) => (
                          <li
                            key={`${inj.packKey}-${inj.id}`}
                            className="glass-row flex items-start justify-between gap-3 px-4 py-2"
                          >
                            <div>
                              <div className="text-[13px] font-medium">
                                {inj.title}
                              </div>
                              <div className="text-[11px] text-meta">
                                {inj.packTitle} · {inj.questionCount} Q
                                {score > 0 ? ` · ${score} TTP match` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost h-8 shrink-0 text-[12px]"
                              disabled={busyId === inject.id}
                              onClick={() => void replace(inject.id, inj)}
                            >
                              Use
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
