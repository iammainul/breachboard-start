"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceOrgPicker } from "@/components/workspace-org-picker";
import { useWorkspaceOrg } from "@/components/workspace-org";
import { cn } from "@/lib/cn";

/** Design contract: collapsible rail below 1280px (`xl`). */
const NARROW_RAIL_QUERY = "(max-width: 1279px)";

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW_RAIL_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useNarrowRail() {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_RAIL_QUERY).matches,
    () => false,
  );
}

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: string };

export function AppShell({
  children,
  userEmail,
  userName,
  isAdmin,
  canFacilitate,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
  canFacilitate?: boolean;
}) {
  const pathname = usePathname();
  const { organizations } = useWorkspaceOrg();
  const operator = Boolean(isAdmin || canFacilitate);
  const [railOpen, setRailOpen] = useState(false);
  const narrow = useNarrowRail();
  const railId = useId();
  const railInert = narrow && !railOpen;
  const operations: NavItem[] = operator
    ? [
        { href: "/", label: "Control", icon: <HomeIcon /> },
        { href: "/sessions/engagements", label: "Engagements", icon: <PlayIcon />, badge: "Live" },
        { href: "/sessions/drafts", label: "Draft runs", icon: <DraftIcon /> },
        { href: "/scenarios", label: "Scenarios", icon: <MapIcon /> },
      ]
    : [
        { href: "/", label: "Arena", icon: <HomeIcon /> },
        { href: "/sessions", label: "My runs", icon: <PlayIcon /> },
      ];
  const admin: NavItem[] = isAdmin
    ? [
        { href: "/orgs", label: "Organizations", icon: <OrgIcon /> },
        { href: "/people", label: "Operators", icon: <PeopleIcon /> },
        { href: "/library", label: "Library", icon: <MapIcon /> },
        { href: "/generate", label: "Generate", icon: <SparkIcon /> },
        { href: "/intel", label: "Intel", icon: <IntelIcon /> },
        { href: "/settings", label: "Settings", icon: <GearIcon /> },
      ]
    : [];

  const initials = (userName || userEmail || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const isSessionWorkspace =
    /^\/sessions\/[^/]+$/.test(pathname) ||
    /^\/sessions\/[^/]+\/(present|stage|report)$/.test(pathname);
  const isPresentSurface = /^\/sessions\/[^/]+\/(present|stage)$/.test(pathname);

  useEffect(() => {
    if (!railOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRailOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railOpen]);

  return (
    <div
      className="flex h-dvh min-h-0 text-fg"
      data-rail={railOpen ? "open" : "closed"}
    >
      {railOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[color-mix(in_oklab,var(--bg)_62%,transparent)] xl:hidden"
          aria-label="Dismiss navigation overlay"
          onClick={() => setRailOpen(false)}
        />
      ) : null}

      {/* Transform lives on this wrapper, not on `.glass-rail`. Chromium crashes
          when backdrop-filter and transform share one layer (phone/tablet overlay). */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 h-dvh w-[248px] shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
          "max-xl:-translate-x-full xl:static xl:z-20 xl:translate-x-0",
          railOpen && "max-xl:translate-x-0",
          railInert && "max-xl:invisible",
        )}
      >
      <aside
        id={railId}
        aria-label="Workspace rail"
        inert={railInert ? true : undefined}
        className="glass-rail flex h-full min-h-0 w-full flex-col"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          <div className="min-w-0 flex-1">
            <BrandLockup />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle compact />
            <button
              type="button"
              className="btn btn-ghost h-11 w-11 shrink-0 px-0 xl:hidden"
              aria-label="Close navigation"
              onClick={() => setRailOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {operator && organizations.length > 0 ? <WorkspaceOrgPicker /> : null}

        <div className="glass-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <NavSection
            title="Play"
            items={operations}
            pathname={pathname}
            onNavigate={() => setRailOpen(false)}
          />
          {admin.length ? (
            <NavSection
              title="Admin"
              items={admin}
              pathname={pathname}
              onNavigate={() => setRailOpen(false)}
            />
          ) : null}
        </div>

        <div className="border-t border-border-soft px-3 py-3">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-meta">
            Account
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Account">
            <div className="flex items-center gap-0.5">
              <Link
                href="/account"
                onClick={() => setRailOpen(false)}
                className={cn(
                  "glass-row flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium",
                  pathname.startsWith("/account")
                    ? "bg-primary text-primary-fg shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:bg-primary"
                    : "text-muted hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    pathname.startsWith("/account")
                      ? "bg-primary-fg/20 text-primary-fg"
                      : "bg-primary-wash text-primary-hover",
                  )}
                >
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{userName || userEmail}</span>
                  {userName && userEmail ? (
                    <span
                      className={cn(
                        "mt-0.5 block truncate font-mono text-[10px] font-normal",
                        pathname.startsWith("/account")
                          ? "text-primary-fg/75"
                          : "text-meta",
                      )}
                    >
                      {userEmail}
                    </span>
                  ) : null}
                </span>
              </Link>
              <SignOutButton iconOnly />
            </div>
          </nav>
        </div>
      </aside>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="glass-header flex h-12 shrink-0 items-center gap-2 px-3 xl:hidden">
          <button
            type="button"
            className="btn btn-ghost h-11 w-11 shrink-0 px-0"
            aria-expanded={railOpen}
            aria-controls={railId}
            aria-label="Open navigation"
            onClick={() => setRailOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandMark className="h-8 w-8 shrink-0 text-fg" />
            <span className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold tracking-tight">
              Breachboard
            </span>
          </div>
          <ThemeToggle compact />
        </div>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1",
            isPresentSurface
              ? "flex flex-col overflow-hidden p-0"
              : isSessionWorkspace
                ? "flex flex-col overflow-hidden p-3 sm:p-3.5"
                : "glass-scroll overflow-y-auto px-5 py-5 sm:px-6 sm:py-5 xl:px-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="pb-3">
      <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-meta">
        {title}
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "glass-row flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium",
                active
                  ? "bg-primary text-primary-fg shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:bg-primary"
                  : "text-muted hover:text-fg",
              )}
            >
              <span className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70")}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && active ? (
                <span className="rounded-md bg-primary-fg/15 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M2 3.25h12v1.5H2v-1.5zm0 4h12v1.5H2v-1.5zm0 4h12v1.5H2v-1.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M3.2 3.2l1.1-1.1L8 5.8l3.7-3.7 1.1 1.1L9.1 6.9l3.7 3.7-1.1 1.1L8 8l-3.7 3.7-1.1-1.1 3.7-3.7-3.7-3.7z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5L2 6v8h4v-5h4v5h4V6L8 1.5z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l10-5.5L4 2.5z" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 2h7l3 3v9H3V2zm7 1v2h2l-2-2zM5 7h6v1.5H5V7zm0 3h6v1.5H5V10z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M2 3.5l5-2 5 2v9l-5-2-5 2v-9zm5 7.3l4 1.6V4.9l-4-1.6v7.5zM3 5.1l3-1.2v7.5L3 12.6V5.1z" />
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M2 2h5v12H2V2zm7 4h5v8H9V6zM3 4h3v2H3V4zm0 3h3v2H3V7zm7 2h3v2H10V9z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M6 8a3 3 0 100-6 3 3 0 000 6zm6 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1 14.5A5 5 0 016 10h4a5 5 0 015 5.5V15H1v-.5z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1l1.2 4.2L13 6.5 9.2 8 8 12 6.8 8 3 6.5l3.8-1.3L8 1z" />
    </svg>
  );
}

function IntelIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 6.5A1.5 1.5 0 118 4a1.5 1.5 0 010 3.5z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M6.5 1h3l.4 1.6a5 5 0 011.4.8L13 2.8l2.1 2.1-1.6 1.7c.2.45.3.9.3 1.4s-.1.95-.3 1.4l1.6 1.7-2.1 2.1-1.7-1.6a5 5 0 01-1.4.8L9.5 15h-3l-.4-1.6a5 5 0 01-1.4-.8L2.9 14 0.8 11.9l1.6-1.7A5 5 0 012.1 8c0-.5.1-.95.3-1.4L.8 4.9 2.9 2.8l1.7 1.6a5 5 0 011.4-.8L6.5 1zM8 5.5A2.5 2.5 0 108 10.5 2.5 2.5 0 008 5.5z" />
    </svg>
  );
}
