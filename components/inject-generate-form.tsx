"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sector } from "@/lib/schema/exercise";
import { FieldLabel, FormCard } from "@/components/ui-kit";
import { SectorOptions } from "@/components/sector-options";
import {
  AiProviderSelect,
  providerOrUndefined,
  type AiProviderChoice,
} from "@/components/ai-provider-select";

export function InjectGenerateForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<AiProviderChoice>("");
  const [sector, setSector] = useState<Sector>("bfsi_in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch("/api/injects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guidance: String(formData.get("guidance") || "") || undefined,
        sector,
        organizationId: String(formData.get("organizationId") || "") || undefined,
        provider: providerOrUndefined(provider),
      }),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Inject generation failed");
      return;
    }
    router.push(`/scenarios/${json.id}`);
    router.refresh();
  }

  return (
    <FormCard
      title="Generate inject"
      description="One notification with {{org}} / {{team}} tokens. Saved as a draft pack you can mix into a SitMan on Scenario."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FieldLabel
          label="Guidance"
          hint="What should land — phishing, ransomware, SWIFT, regulator notice…"
        >
          <textarea
            name="guidance"
            rows={4}
            className="field min-h-[6.5rem] resize-y"
            placeholder="Mailbox spike at {{org}}; {{team}} gets the first alert."
          />
        </FieldLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="Client">
            <select name="organizationId" className="field" defaultValue="">
              <option value="">Unassigned draft</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Sector">
            <select
              className="field"
              value={sector}
              onChange={(event) => setSector(event.target.value as Sector)}
            >
              <SectorOptions />
            </select>
          </FieldLabel>
        </div>
        <AiProviderSelect
          value={provider}
          onChange={setProvider}
          label="AI provider"
          hint="Uses portal default unless you pick one"
        />
        {error ? (
          <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate inject"}
        </button>
      </form>
    </FormCard>
  );
}
