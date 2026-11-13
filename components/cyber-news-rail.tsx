import Link from "next/link";
import { timeAgo } from "@/lib/cn";
import type { HubNewsItem } from "@/lib/intel/news-feeds";

export function CyberNewsRail({
  items,
  canGenerate,
  layout = "rail",
}: {
  items: HubNewsItem[];
  canGenerate: boolean;
  layout?: "rail" | "strip" | "headlines";
}) {
  const strip = layout === "strip";
  const headlines = layout === "headlines";
  return (
    <aside
      className={
        strip
          ? "flash-card flex min-h-0 flex-col p-4"
          : headlines
            ? "flash-card flex max-h-[460px] min-h-0 flex-col p-4"
            : "flash-card flex min-h-0 flex-col p-4 xl:sticky xl:top-4 xl:max-h-[min(78vh,720px)]"
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
            Cyber news
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            CISA, NCSC, Krebs, BleepingComputer, The Record, and more
          </p>
        </div>
        {canGenerate ? (
          <Link
            href="/intel"
            className="shrink-0 text-[12px] font-medium text-primary-hover hover:underline"
          >
            Intel
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">
          No headlines yet.
          {canGenerate ? " Open Intel and pull cyber news feeds." : ""}
        </p>
      ) : headlines ? (
        <ul
          className="glass-scroll mt-3 min-h-0 flex-1 divide-y divide-border-soft overflow-y-auto"
          aria-label="Latest cyber news"
        >
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-4 py-2.5">
              <span className="w-32 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-meta">
                {item.publisher}
              </span>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-fg hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-fg">
                  {item.title}
                </span>
              )}
              {canGenerate ? (
                <Link
                  href={`/generate?feed=${encodeURIComponent(item.id)}`}
                  className="shrink-0 text-[12px] font-medium text-primary-hover hover:underline"
                >
                  Generate
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className={
            strip
              ? "mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
              : "mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:snap-y"
          }
          aria-label="Latest cyber news"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className={
                strip
                  ? "w-72 shrink-0 snap-start border border-border-soft bg-card/70 p-3"
                  : "w-64 shrink-0 snap-start rounded-xl border border-border-soft bg-card/70 p-3 xl:w-auto"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-hover">
                  {item.publisher}
                </span>
                <span className="text-[11px] text-meta">
                  {timeAgo(new Date(item.publishedAt))}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-fg">
                {item.title}
              </p>
              {item.excerpt ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                  {item.excerpt}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canGenerate ? (
                  <Link
                    href={`/generate?feed=${encodeURIComponent(item.id)}`}
                    className="text-[12px] font-medium text-primary-hover hover:underline"
                  >
                    Generate scenario
                  </Link>
                ) : null}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-muted hover:text-fg hover:underline"
                  >
                    Source
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
