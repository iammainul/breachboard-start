"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function InviteClaimForm({
  token,
  sessionId,
  currentEmail,
  recipientMatches,
}: {
  token: string;
  sessionId: string;
  currentEmail: string | null;
  recipientMatches: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setPending(true);
    setError(null);
    // Always use invite-token credentials so authEpoch bumps and other devices drop.
    const result = await signIn("invite-token", {
      token,
      redirect: false,
      callbackUrl: `/sessions/${sessionId}`,
    });
    setPending(false);
    if (result?.error) {
      setError("This invitation is invalid or no longer available.");
      return;
    }
    window.location.assign(result?.url ?? `/sessions/${sessionId}`);
  }

  return (
    <div className="mt-4">
      {currentEmail && !recipientMatches ? (
        <p className="status-warning mb-3 rounded-[var(--radius-control)] border px-3 py-2 text-[12px]">
          You are signed in as {currentEmail}. Continuing switches this browser to
          the invited activity participant (one device only).
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() => void claim()}
      >
        {pending
          ? "Joining activity…"
          : recipientMatches
            ? "Accept assignment"
            : "Continue with passwordless access"}
      </button>
      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
