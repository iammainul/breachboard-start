export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
      <div className="h-6 w-40 animate-pulse rounded bg-border/50" />
      <div className="h-10 w-72 animate-pulse rounded-lg bg-border/60" />
      <div className="mt-4 h-[28rem] animate-pulse rounded-2xl bg-surface shadow-card" />
    </div>
  );
}
