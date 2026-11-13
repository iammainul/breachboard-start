import { JoinCodeForm } from "@/components/join-code-form";
import { getActor } from "@/lib/access";

export default async function JoinWithCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { code } = await params;
  const { role } = await searchParams;
  const normalized = decodeURIComponent(code).trim().toUpperCase();
  const roleToken = role?.trim().toUpperCase() ?? "";
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
      <JoinCodeForm
        initialCode={normalized}
        initialRoleToken={roleToken}
        initialName={user?.name ?? ""}
      />
    </div>
  );
}
