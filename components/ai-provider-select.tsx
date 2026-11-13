"use client";

import { useEffect, useState } from "react";
import type { LlmProvider } from "@/lib/schema/exercise";
import { FieldLabel } from "@/components/ui-kit";

const PROVIDERS: { id: LlmProvider; label: string }[] = [
  { id: "cursor", label: "Cursor" },
  { id: "gemini", label: "Google Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "github", label: "GitHub Models" },
  { id: "ollama", label: "Ollama" },
];

export type AiProviderChoice = LlmProvider | "";

/**
 * Dropdown for SitMan / inject sync / media. Empty value = portal default AI.
 */
export function AiProviderSelect({
  value,
  onChange,
  label = "AI provider",
  hint,
  description,
}: {
  value: AiProviderChoice;
  onChange: (next: AiProviderChoice) => void;
  label?: string;
  hint?: string;
  description?: string;
}) {
  const [defaultLabel, setDefaultLabel] = useState("portal default");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const id = data?.defaultProvider as LlmProvider | undefined;
        const match = PROVIDERS.find((p) => p.id === id);
        if (match) setDefaultLabel(`${match.label} (default)`);
        else if (id) setDefaultLabel(`${id} (default)`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {description ? (
        <p className="glass-inset rounded-xl px-3 py-2 text-[12px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      <FieldLabel label={label} hint={hint}>
        <select
          className="field h-10"
          value={value}
          onChange={(e) => onChange(e.target.value as AiProviderChoice)}
        >
          <option value="">Use default AI — {defaultLabel}</option>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </FieldLabel>
    </div>
  );
}

export function providerOrUndefined(
  value: AiProviderChoice,
): LlmProvider | undefined {
  return value || undefined;
}
