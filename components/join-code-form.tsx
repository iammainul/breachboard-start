"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BrandLockup } from "@/components/brand-mark";

export function JoinCodeForm({
  initialCode = "",
  initialRoleToken = "",
  initialName = "",
}: {
  initialCode?: string;
  initialRoleToken?: string;
  initialName?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [roleToken, setRoleToken] = useState(initialRoleToken);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoJoined = useRef(false);

  async function joinWith(normalized: string, card: string, displayName: string) {
    setBusy(true);
    setError(null);
    const body: {
      code: string;
      name?: string;
      email?: string;
      roleToken?: string;
    } = {
      code: normalized,
    };
    if (displayName.trim()) body.name = displayName.trim();
    if (email.trim()) body.email = email.trim();
    if (card) body.roleToken = card;
    const response = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      setBusy(false);
      setError(json.error ?? "Could not join");
      return;
    }
    if (json.guestToken) {
      const result = await signIn("guest-join", {
        token: json.guestToken,
        redirect: false,
      });
      if (result?.error) {
        setBusy(false);
        setError("Joined the roster but could not start your session — try again.");
        return;
      }
    }
    setBusy(false);
    router.push(`/sessions/${json.sessionId}`);
    router.refresh();
  }

  useEffect(() => {
    if (autoJoined.current) return;
    if (!initialCode || !initialRoleToken || !initialName) return;
    autoJoined.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot deep-link submission
    void joinWith(
      initialCode.trim().toUpperCase(),
      initialRoleToken.trim(),
      initialName.trim(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link claim
  }, [initialCode, initialRoleToken, initialName]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    if (!roleToken.trim() && !name.trim()) {
      setError("Enter your name to join the squad.");
      return;
    }
    await joinWith(normalized, roleToken.trim().toUpperCase(), name.trim());
  }

  return (
    <form onSubmit={submit} className="flash-card w-full max-w-[420px] p-6 sm:p-7">
      <div className="mb-5">
        <BrandLockup
          product="Mission lobby"
          subtitle={
            initialRoleToken
              ? "Role card attached — claim your seat"
              : "Join code + name. No account needed."
          }
        />
      </div>
      <label htmlFor="join-name" className="mb-1.5 block text-[12px] font-semibold text-muted">
        Your name
      </label>
      <input
        id="join-name"
        className="field mb-4 h-11 text-[16px]"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="How you appear on the roster"
        autoComplete="name"
        autoFocus={!initialName}
        required={!initialRoleToken}
      />
      <label htmlFor="join-code" className="mb-1.5 block text-[12px] font-semibold text-muted">
        Join code
      </label>
      <input
        id="join-code"
        className="field mb-4 h-11 font-mono text-[16px] tracking-[0.16em] uppercase sm:text-[18px] sm:tracking-[0.2em]"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        required
      />
      {initialRoleToken ? (
        <p className="mb-4 rounded-[var(--radius-control)] border border-primary/20 bg-primary-wash px-3 py-2 text-[12px] text-fg-2">
          Role card ready — claiming binds your seat server-side.
        </p>
      ) : (
        <details className="glass-inset mb-4 rounded-[var(--radius-control)] px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-muted">
            Advanced — invite email or role card
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="join-email" className="mb-1.5 block text-[12px] font-semibold text-muted">
                Email (only if pre-invited)
              </label>
              <input
                id="join-email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional@"
              />
            </div>
            <div>
              <label htmlFor="join-role-card" className="mb-1.5 block text-[12px] font-semibold text-muted">
                Role card token
              </label>
              <input
                id="join-role-card"
                className="field font-mono text-[14px] tracking-[0.12em] uppercase"
                value={roleToken}
                onChange={(e) => setRoleToken(e.target.value)}
                placeholder="From facilitator link"
              />
            </div>
            <p className="text-[12px] text-muted">
              Most players leave these blank. Use them only when the facilitator
              sent an invite link or role card.
            </p>
          </div>
        </details>
      )}
      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn btn-primary h-11 w-full">
        {busy ? "Joining…" : initialRoleToken ? "Join & claim role" : "Join squad"}
      </button>
      <p className="mt-3.5 text-center text-[13px] text-muted">
        Facilitator?{" "}
        <Link href="/login" className="text-primary-hover hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
