"use client";

import { signOutAction } from "@/app/sign-out-action";
import { cn } from "@/lib/cn";

export function SignOutButton({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <form action={signOutAction} className={iconOnly ? "shrink-0" : "w-full"}>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={cn(
          iconOnly
            ? "flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            : "glass-row flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-[13px] font-medium text-muted hover:text-fg",
          className,
        )}
      >
        <span className={cn("shrink-0", iconOnly ? "h-4 w-4" : "h-4 w-4 opacity-70")} aria-hidden>
          <SignOutIcon />
        </span>
        {iconOnly ? null : "Sign out"}
      </button>
    </form>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M6 2H3v12h3v1.5H2.5A1.5 1.5 0 011 14V2a1.5 1.5 0 011.5-1.5H6V2zm7.8 5.3L11.5 5l-.9.9 1.3 1.3H6v1.6h5.9L10.6 10l.9.9 2.3-2.3a1 1 0 000-1.3z" />
    </svg>
  );
}
