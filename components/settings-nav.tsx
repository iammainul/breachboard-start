"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/settings/ai", label: "AI providers" },
  { href: "/settings/email", label: "Email" },
  { href: "/settings/operations", label: "Operations" },
  { href: "/settings/uploads", label: "Uploads" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flash-card glass-scroll flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-x-visible">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "glass-row shrink-0 whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
