import { JoinCodeForm } from "@/components/join-code-form";
import { getActor } from "@/lib/access";

export default async function JoinPage() {
  const user = await getActor();

  return (
    <div className="app-canvas relative grid min-h-dvh place-items-center overflow-hidden px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -5%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 65%)",
        }}
      />
      <JoinCodeForm initialName={user?.name ?? ""} />
    </div>
  );
}
