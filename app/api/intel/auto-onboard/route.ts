import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { runAutoOnboardIntel } from "@/lib/intel/auto-onboard";

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const body = (await request.json().catch(() => null)) as {
    force?: boolean;
  } | null;

  try {
    const result = await runAutoOnboardIntel({
      force: body?.force !== false,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 502 },
    );
  }
}
