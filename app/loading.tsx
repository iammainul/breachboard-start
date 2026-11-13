export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-border/60" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-border/40" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface shadow-card" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-surface shadow-card" />
    </div>
  );
}
