export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 sm:px-6">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-border/60" />
      <div className="h-4 w-full max-w-lg animate-pulse rounded bg-border/40" />
      <div className="mt-2 h-[32rem] animate-pulse rounded-2xl bg-surface shadow-card" />
    </div>
  );
}
