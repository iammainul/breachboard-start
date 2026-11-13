import { cn } from "@/lib/cn";

export function PageFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 w-full max-w-[1680px] flex-col gap-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-primary-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-hover">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[26px] font-bold tracking-tight text-fg">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function FlashCard({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "flash-card",
        hover && "transition-transform duration-150 hover:-translate-y-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

const statIcons = {
  org: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v2H7V5zm0 4h6v2H7V9zm0 4h4v2H7v-2z" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 16.5A4.5 4.5 0 017 12h6a4.5 4.5 0 014.5 4.5V17H2v-.5z" />
    </svg>
  ),
  scenario: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm9-1a1 1 0 00-1 1v6a1 1 0 001 1h4a1 1 0 001-1v-6a1 1 0 00-1-1h-4z" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M10 2a6 6 0 00-6 6v1.5a6 6 0 0012 0V8a6 6 0 00-6-6zm-8 9a8 8 0 0116 0v.5a8 8 0 01-16 0V11zm8 5a3 3 0 003-3h-6a3 3 0 003 3z" />
    </svg>
  ),
  mission: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 14.5 5.1 17.2l.9-5.5-4-3.9 5.5-.8L10 2z" />
    </svg>
  ),
} as const;

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  icon?: keyof typeof statIcons;
}) {
  return (
    <FlashCard className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon ? (
          <span className={cn("text-meta", accent && "text-primary")}>{statIcons[icon]}</span>
        ) : null}
      </div>
      <span
        className={cn(
          "text-[28px] font-bold leading-none tabular-nums tracking-tight",
          accent && "text-primary",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[12px] text-meta">{hint}</span> : null}
    </FlashCard>
  );
}
