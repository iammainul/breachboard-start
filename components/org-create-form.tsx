"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldLabel, FormCard } from "@/components/ui-kit";
import { SectorOptions } from "@/components/sector-options";

export function OrgCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);
    const response = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        sector: String(formData.get("sector") ?? "bfsi_in"),
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Could not create organization");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <FormCard
      title="Onboard organization"
      description="Add a client who will run tabletop exercises with your team."
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <FieldLabel label="Organization name">
          <input name="name" required placeholder="Northline Bank" className="field" />
        </FieldLabel>
        <FieldLabel label="Sector">
          <select name="sector" className="field" defaultValue="bfsi_in">
            <SectorOptions />
          </select>
        </FieldLabel>
        <div className="sm:col-span-2 xl:col-span-1">
          <FieldLabel label="Notes" hint="Stack, regulators, SOC vendor…">
            <textarea
              name="notes"
              rows={3}
              className="field min-h-20 resize-y"
              placeholder="Core banking, Splunk SIEM, RBI oversight…"
            />
          </FieldLabel>
        </div>
        {error ? (
          <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger sm:col-span-2 xl:col-span-1">
            {error}
          </p>
        ) : null}
        <div className="sm:col-span-2 xl:col-span-1">
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-50">
            {pending ? "Saving…" : "Create organization"}
          </button>
        </div>
      </form>
    </FormCard>
  );
}
