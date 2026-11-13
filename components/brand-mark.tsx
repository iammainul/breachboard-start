export function BrandMark({
  className = "h-9 w-9",
  title = "Breachboard",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <rect
        x="6.5"
        y="6.5"
        width="51"
        height="51"
        rx="12"
        stroke="currentColor"
        strokeWidth="4.25"
      />
      <path
        fill="currentColor"
        d="M22.2 17.6h12.4c5.7 0 9.5 2.9 9.5 7.5 0 2.7-1.4 4.8-3.8 6.1 3.2 1.2 5.2 3.7 5.2 7.3 0 5.3-4.2 8.5-10.7 8.5H22.2V17.6zm7.4 12h5.4c2.5 0 4-1.3 4-3.3s-1.5-3.2-4-3.2h-5.4v6.5zm0 14.6h6.1c2.9 0 4.6-1.4 4.6-3.7s-1.7-3.6-4.6-3.6h-6.1v7.3z"
      />
      <path fill="currentColor" d="M42.2 20.2 49 15.4l-1.6 7.4z" />
      <circle cx="51.6" cy="12.4" r="4.3" fill="#5B8CFF" />
    </svg>
  );
}

export function BrandLockup({
  product = "Breachboard",
  subtitle = "Live exercise board",
}: {
  product?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="h-10 w-10 shrink-0 text-fg" />
      <div className="min-w-0">
        <div className="truncate font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight">
          {product}
        </div>
        {subtitle ? (
          <div className="truncate text-[11px] text-meta">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
