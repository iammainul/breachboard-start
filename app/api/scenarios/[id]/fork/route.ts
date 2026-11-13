import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { forkAcceptedDraft } from "@/lib/scenario-lineage";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const result = await forkAcceptedDraft(id, actor.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
