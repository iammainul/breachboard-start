"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormCard } from "@/components/ui-kit";

export function StartSessionForm({
  organizations,
  exercises,
  defaultRunKind = "engagement",
  defaultOrganizationId,
  lockOrganization = false,
}: {
  organizations: { id: string; name: string }[];
  exercises: { id: string; title: string }[];
  defaultRunKind?: "draft" | "engagement";
  defaultOrganizationId?: string;
  lockOrganization?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isDraft = defaultRunKind === "draft";
  const lockedOrg =
    lockOrganization && defaultOrganizationId
      ? organizations.find((o) => o.id === defaultOrganizationId)
      : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const scheduledRaw = String(formData.get("scheduledAt") || "").trim();
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId:
          lockedOrg?.id ??
          String(formData.get("organizationId") ?? "") ??
          defaultOrganizationId,
        exerciseId: String(formData.get("exerciseId") ?? ""),
        runKind: defaultRunKind,
        scheduledAt: scheduledRaw ? new Date(scheduledRaw).toISOString() : undefined,
      }),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Could not start run");
      return;
    }
    router.push(`/sessions/${json.id}`);
  }

  if (organizations.length === 0 || exercises.length === 0) {
    return (
      <FormCard
        title={isDraft ? "Open a draft run" : "Start an engagement"}
        description={
          isDraft
            ? "You need an organization and a draft or accepted scenario."
            : "You need an organization and an accepted scenario pack."
        }
      >
        <p className="text-[14px] text-muted">
          {isDraft
            ? "Generate a scenario, then return here to rehearse."
            : "Accept a scenario for this organization on the Scenarios page, then launch the engagement."}
        </p>
      </FormCard>
    );
  }

  if (lockOrganization && !defaultOrganizationId) {
    return (
      <FormCard
        title={isDraft ? "Open a draft run" : "Start an engagement"}
        description="Select a working organization in the sidebar first."
      >
        <p className="text-[14px] text-muted">
          Runs stay scoped to the current client — pick an org in Workspace.
        </p>
      </FormCard>
    );
  }

  return (
    <FormCard
      title={isDraft ? "Open draft run" : "Launch engagement"}
      description={
        isDraft
          ? "Rehearsal room for performance checks and bug hunting — go-live does not require a full roster."
          : "Facilitated engagement from the accepted scenario pack. Required playbook roles must be seated before go-live."
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {lockedOrg ? (
          <input type="hidden" name="organizationId" value={lockedOrg.id} />
        ) : (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-fg-2">Organization</span>
            <select
              name="organizationId"
              required
              className="field"
              defaultValue={defaultOrganizationId ?? organizations[0]?.id}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-fg-2">Scenario</span>
          <select name="exerciseId" required className="field">
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-fg-2">
            Execution date & time
          </span>
          <input
            type="datetime-local"
            name="scheduledAt"
            className="field"
          />
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary h-11 disabled:opacity-50">
          {pending ? "Starting…" : isDraft ? "Open draft" : "Start engagement"}
        </button>
        {error ? <p className="w-full text-[13px] text-danger">{error}</p> : null}
      </form>
      {lockedOrg ? (
        <p className="glass-inset rounded-[var(--radius-control)] px-3 py-2 text-[12px] leading-relaxed text-muted">
          Client: <span className="font-medium text-fg">{lockedOrg.name}</span>
          {" · "}Created time is recorded automatically; set execution date above
          when you know the facilitation slot.
        </p>
      ) : null}
    </FormCard>
  );
}
