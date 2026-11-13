import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { acceptScenario } from "@/lib/scenario-lineage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const json = (await request.json().catch(() => null)) as {
    organizationId?: string;
  } | null;
  const result = await acceptScenario(id, json?.organizationId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
