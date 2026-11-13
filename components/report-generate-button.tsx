"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportGenerateButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/report`, {
      method: "POST",
    });
    setBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not generate report");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-primary disabled:opacity-50"
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy ? "Saving…" : "Generate and store"}
      </button>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
