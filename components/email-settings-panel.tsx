"use client";

import { useEffect, useState } from "react";
import { FlashCard } from "@/components/page-frame";
import { FieldLabel } from "@/components/ui-kit";

type Status = {
  configured: boolean;
  source: "portal" | "env" | "none";
  host: string;
  port: number;
  tlsMode: "tls" | "starttls" | "none";
  username: string;
  passwordConfigured: boolean;
  senderName: string;
  senderAddress: string;
  replyTo: string;
};

function SmtpStatus({ status }: { status: Status }) {
  const configured = status.configured;
  const label = configured
    ? status.source === "env"
      ? "Using environment"
      : "Configured"
    : "Not configured";
  return (
    <span
      className="status-pill shrink-0"
      data-status={configured ? "closed" : "draft"}
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function EmailSettingsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/settings/email");
    const json = await response.json();
    if (response.ok) setStatus(json);
    else setSaveError(json.error ?? "Could not load email settings");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void load();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending("save");
    setSaveError(null);
    setSaveMessage(null);
    const response = await fetch("/api/settings/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: String(form.get("host") ?? ""),
        port: Number(form.get("port") ?? 587),
        tlsMode: String(form.get("tlsMode") ?? "starttls"),
        username: String(form.get("username") ?? ""),
        password,
        senderName: String(form.get("senderName") ?? ""),
        senderAddress: String(form.get("senderAddress") ?? ""),
        replyTo: String(form.get("replyTo") ?? ""),
      }),
    });
    const json = await response.json();
    setPending(null);
    if (!response.ok) {
      setSaveError(json.error ?? "Could not save SMTP");
      return;
    }
    setStatus(json);
    setPassword("");
    setSaveMessage("SMTP settings saved. The password remains encrypted.");
  }

  async function sendTest() {
    setPending("test");
    setTestError(null);
    setTestMessage(null);
    const response = await fetch("/api/settings/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: testRecipient }),
    });
    const json = await response.json();
    setPending(null);
    if (!response.ok) {
      setTestError(json.error ?? "Test delivery failed");
      return;
    }
    setTestMessage(`Test email sent to ${testRecipient}.`);
  }

  if (!status) {
    return <p className="text-[14px] text-muted">{saveError ?? "Loading email settings…"}</p>;
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
      <FlashCard className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[16px] font-semibold text-fg">SMTP delivery</h2>
          <SmtpStatus status={status} />
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          Email passwordless onboard and role invites. Portal values here take
          precedence; <code className="font-mono text-[12px]">SMTP_*</code> env
          remains a fallback.
        </p>
        <form onSubmit={save} className="mt-4 grid grid-cols-1 items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel label="SMTP host">
              <input name="host" required className="field" defaultValue={status.host} />
            </FieldLabel>
          </div>
          <FieldLabel label="Port">
            <input
              name="port"
              required
              type="number"
              min={1}
              max={65535}
              className="field"
              defaultValue={status.port}
            />
          </FieldLabel>
          <FieldLabel label="TLS mode">
            <select name="tlsMode" className="field" defaultValue={status.tlsMode}>
              <option value="starttls">STARTTLS (recommended)</option>
              <option value="tls">Implicit TLS</option>
              <option value="none">None</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Username">
            <input name="username" className="field" defaultValue={status.username} autoComplete="username" />
          </FieldLabel>
          <FieldLabel
            label="Password"
            hint={
              status.passwordConfigured
                ? "A password is already saved. Leave blank to keep it."
                : undefined
            }
          >
            <input
              type="password"
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={status.passwordConfigured ? "••••••••" : undefined}
            />
          </FieldLabel>
          <FieldLabel label="Sender name">
            <input
              name="senderName"
              className="field"
              defaultValue={status.senderName}
              placeholder="Cyber Exercise Desk"
            />
          </FieldLabel>
          <FieldLabel label="Sender address">
            <input
              name="senderAddress"
              type="email"
              required
              className="field"
              defaultValue={status.senderAddress}
            />
          </FieldLabel>
          <div className="sm:col-span-2">
            <FieldLabel label="Reply-to">
              <input
                name="replyTo"
                type="email"
                className="field"
                defaultValue={status.replyTo}
              />
            </FieldLabel>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending !== null}
            >
              {pending === "save" ? "Saving…" : "Save email settings"}
            </button>
            {saveMessage ? (
              <p className="text-[13px] text-success">{saveMessage}</p>
            ) : null}
            {saveError ? (
              <p className="text-[13px] text-danger">{saveError}</p>
            ) : null}
          </div>
        </form>
      </FlashCard>

      <FlashCard className="p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-fg">Send test email</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Tests the saved portal or environment SMTP, not an unsaved draft.
        </p>
        <div className="mt-3.5">
          <FieldLabel label="Recipient">
            <input
              type="email"
              className="field"
              value={testRecipient}
              onChange={(event) => setTestRecipient(event.target.value)}
              placeholder="you@example.com"
            />
          </FieldLabel>
        </div>
        <button
          type="button"
          className="btn btn-ghost mt-3.5 w-full"
          disabled={pending !== null || !testRecipient}
          onClick={() => void sendTest()}
        >
          {pending === "test" ? "Sending…" : "Send test"}
        </button>
        {testMessage ? <p className="mt-3 text-[13px] text-success">{testMessage}</p> : null}
        {testError ? <p className="mt-3 text-[13px] text-danger">{testError}</p> : null}
      </FlashCard>
    </div>
  );
}
