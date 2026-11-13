"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldLabel, FormCard } from "@/components/ui-kit";

type Profile = {
  name: string;
  email: string;
  platformRole: string;
  canFacilitate: boolean;
  totpEnabled: boolean;
  hasPassword: boolean;
  homeOrg: string | null;
  clients: { id: string; name: string }[];
};

export function AccountPanel({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pending, setPending] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(profile.totpEnabled);
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNameMsg(null);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPending(false);
    if (!response.ok) {
      setNameMsg("Could not save name");
      return;
    }
    setNameMsg("Saved");
    router.refresh();
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setPwError(null);
    setPwOk(false);
    const response = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        nextPassword: String(formData.get("nextPassword") ?? ""),
      }),
    });
    const json = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setPwError(json.error ?? "Could not change password");
      return;
    }
    setPwOk(true);
    form.reset();
  }

  async function startTotp() {
    setTotpError(null);
    const response = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const json = await response.json();
    if (!response.ok) {
      setTotpError(json.error ?? "Could not start 2FA");
      return;
    }
    setSetup({ secret: json.secret, qrDataUrl: json.qrDataUrl });
    setTotpCode("");
  }

  async function enableTotp(event: React.FormEvent) {
    event.preventDefault();
    setTotpError(null);
    const response = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", code: totpCode }),
    });
    const json = await response.json();
    if (!response.ok) {
      setTotpError(json.error ?? "Could not enable 2FA");
      return;
    }
    setTotpEnabled(true);
    setSetup(null);
    setTotpCode("");
    router.refresh();
  }

  async function disableTotp(event: React.FormEvent) {
    event.preventDefault();
    setTotpError(null);
    const response = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "disable",
        code: totpCode,
        password: disablePassword,
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setTotpError(json.error ?? "Could not turn off 2FA");
      return;
    }
    setTotpEnabled(false);
    setTotpCode("");
    setDisablePassword("");
    router.refresh();
  }

  const roleLabel =
    profile.platformRole === "ADMIN"
      ? "Admin"
      : profile.canFacilitate
        ? "Facilitator"
        : "Participant";

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <FormCard title="Profile" description="This name is shown on the roster and in the rail.">
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <FieldLabel label="Display name">
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </FieldLabel>
          <FieldLabel label="Email" hint="Email is the login identifier and cannot be changed here.">
            <input className="field" value={profile.email} readOnly />
          </FieldLabel>
          <dl className="glass-inset grid gap-2 px-3 py-2.5 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-meta">Desk role</dt>
              <dd className="mt-0.5 font-medium">{roleLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-meta">Clients</dt>
              <dd className="mt-0.5 font-medium">
                {profile.clients.length
                  ? profile.clients.map((c) => c.name).join(", ")
                  : profile.homeOrg ?? "—"}
              </dd>
            </div>
          </dl>
          {nameMsg ? <p className="text-[13px] text-muted">{nameMsg}</p> : null}
          <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-50">
            Save name
          </button>
        </form>
      </FormCard>

      {profile.hasPassword ? (
        <FormCard title="Password" description="Use a unique password. Changing it signs you in on this device only.">
          <form onSubmit={changePassword} className="flex flex-col gap-3">
            <FieldLabel label="Current password">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="field"
              />
            </FieldLabel>
            <FieldLabel label="New password" hint="At least 8 characters">
              <input
                name="nextPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="field"
              />
            </FieldLabel>
            {pwError ? (
              <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {pwError}
              </p>
            ) : null}
            {pwOk ? <p className="text-[13px] text-primary">Password updated.</p> : null}
            <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-50">
              Update password
            </button>
          </form>
        </FormCard>
      ) : (
        <FormCard
          title="Password"
          description="This seat is join-code only — there is no password on the account."
        >
          <p className="text-[13px] text-muted">Ask an operator if you need a desk login.</p>
        </FormCard>
      )}

      <FormCard
        className="xl:col-span-2"
        title="Authenticator (2FA)"
        description="Time-based codes from an authenticator app. Required at sign-in once enabled."
      >
        {totpEnabled && !setup ? (
          <form onSubmit={disableTotp} className="flex max-w-lg flex-col gap-3">
            <p className="text-[13px] text-muted">
              Two-factor is <span className="font-semibold text-primary">on</span> for this account.
            </p>
            <FieldLabel label="Current password">
              <input
                type="password"
                className="field"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                required
              />
            </FieldLabel>
            <FieldLabel label="Authenticator code">
              <input
                className="field font-mono tracking-[0.2em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                required
              />
            </FieldLabel>
            {totpError ? (
              <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {totpError}
              </p>
            ) : null}
            <button type="submit" className="btn btn-ghost self-start">
              Turn off 2FA
            </button>
          </form>
        ) : setup ? (
          <form onSubmit={enableTotp} className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrDataUrl}
              alt="Authenticator QR code"
              className="glass-tile h-[220px] w-[220px] p-2"
            />
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-muted">
                Scan with your authenticator, then enter the 6-digit code. Manual secret:
              </p>
              <code className="glass-inset block break-all px-3 py-2 font-mono text-[12px]">
                {setup.secret}
              </code>
              <FieldLabel label="Authenticator code">
                <input
                  className="field font-mono tracking-[0.2em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  required
                />
              </FieldLabel>
              {totpError ? (
                <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                  {totpError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary">
                  Confirm and enable
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSetup(null);
                    setTotpCode("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              {profile.hasPassword
                ? "Add an authenticator so a stolen password is not enough to reach the desk."
                : "2FA is available on password desk logins."}
            </p>
            {totpError ? (
              <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {totpError}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary self-start"
              onClick={startTotp}
              disabled={!profile.hasPassword}
            >
              Set up authenticator
            </button>
          </div>
        )}
      </FormCard>
    </div>
  );
}
