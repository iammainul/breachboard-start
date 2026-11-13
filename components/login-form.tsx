"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-mark";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      totp: String(formData.get("totp") ?? ""),
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    const code = (result as { code?: string } | undefined)?.code;
    if (code === "totp_required" || result?.error === "totp_required") {
      setTotpRequired(true);
      return;
    }
    if (result?.error) {
      setError(
        totpRequired
          ? "That authenticator code did not match."
          : "Those credentials don't match a player on this board.",
      );
      return;
    }
    window.location.href = callbackUrl.startsWith("/") ? callbackUrl : "/";
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flash-card w-full max-w-[420px] overflow-hidden p-6 sm:p-7"
      autoComplete="on"
    >
      <div
        aria-hidden
        data-deco
        className="pointer-events-none inset-x-0 top-0 h-32 bg-gradient-to-b from-primary-wash to-transparent"
      />
      <div className="mb-5">
        <BrandLockup subtitle=">_ authenticate to the exercise board" />
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        Sign in to Breachboard — respond to injects, play your role, and track
        your score.
      </p>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="login-email">
        Email
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        required
        defaultValue="operator@local"
        autoComplete="username"
        suppressHydrationWarning
        className="field mb-4"
      />
      <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="login-password">
        Password
      </label>
      <input
        id="login-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        suppressHydrationWarning
        className="field mb-4"
      />
      {totpRequired ? (
        <>
          <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="login-totp">
            Authenticator code
          </label>
          <input
            id="login-totp"
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            className="field mb-4 font-mono tracking-[0.2em]"
            placeholder="000000"
          />
        </>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full text-[15px]">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-4 text-center text-[13px] text-muted">
        Have a join code?{" "}
        <Link href="/join" className="font-semibold text-primary-hover hover:underline">
          Enter the mission lobby
        </Link>
      </p>
    </form>
  );
}
