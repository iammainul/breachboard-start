"use client";

import { useEffect, useState } from "react";

type OpsStatus = {
  expectedConcurrentUsers: number;
  sessionPollMs: number;
  sessionPollHiddenMs: number;
  databaseUrlHasPool: boolean;
  notes: string[];
};

export function OperationsSettings() {
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [users, setUsers] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/settings/operations");
    const json = await response.json();
    if (response.ok) {
      setStatus(json);
      setUsers(json.expectedConcurrentUsers ?? 50);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings/operations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedConcurrentUsers: users }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setStatus(json);
    setMessage(
      `Capacity set to ~${json.expectedConcurrentUsers} concurrent users. Live clients will use ${json.sessionPollMs / 1000}s poll intervals.`,
    );
  }

  if (!status) {
    return <p className="text-[14px] text-muted">Loading operations…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">Live capacity</h2>
        <p className="mt-1 text-[13px] text-muted">
          Sized for tabletop rooms of roughly 20–100 people on one server. Higher
          headcount slows session polling slightly so the database stays healthy.
        </p>
      </div>

      <div className="flash-card overflow-hidden">
        <div className="glass-scroll overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <tbody>
              <tr className="glass-row border-b border-border-soft">
                <th className="w-[40%] px-4 py-2.5 font-medium text-meta">
                  Expected concurrent users
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={users}
                      onChange={(e) => setUsers(Number(e.target.value))}
                      className="w-48 accent-[var(--primary)]"
                    />
                    <span className="font-mono text-[14px] font-semibold">{users}</span>
                    <button
                      type="button"
                      className="btn btn-primary disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      Save
                    </button>
                  </div>
                </td>
              </tr>
              <tr className="glass-row border-b border-border-soft">
                <th className="px-4 py-2.5 font-medium text-meta">Session poll (visible)</th>
                <td className="px-4 py-2.5 font-mono">{status.sessionPollMs / 1000}s</td>
              </tr>
              <tr className="glass-row border-b border-border-soft">
                <th className="px-4 py-2.5 font-medium text-meta">
                  Session poll (background tab)
                </th>
                <td className="px-4 py-2.5 font-mono">
                  {status.sessionPollHiddenMs / 1000}s
                </td>
              </tr>
              <tr className="glass-row">
                <th className="px-4 py-2.5 font-medium text-meta">DB connection pool hint</th>
                <td className="px-4 py-2.5">
                  {status.databaseUrlHasPool ? (
                    <span className="chip chip-on text-[11px]">Configured</span>
                  ) : (
                    <span className="text-muted">
                      Add{" "}
                      <code className="font-mono text-[12px]">
                        ?connection_limit=20&amp;pool_timeout=10
                      </code>{" "}
                      to DATABASE_URL for Docker / multi-user hosts.
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ul className="glass-inset list-disc space-y-1.5 rounded-[var(--radius)] py-3.5 pl-9 pr-4 text-[13px] text-muted">
        {status.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      {message ? (
        <p className="rounded-lg border border-primary/20 bg-primary-wash px-3 py-2 text-[13px] text-fg-2">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
