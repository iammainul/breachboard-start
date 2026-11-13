import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/access";
import { replaceScenarioClients } from "@/lib/scenario-lineage";

const bodySchema = z.object({
  organizationIds: z.array(z.string()),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid clients" }, { status: 400 });
  }
  const result = await replaceScenarioClients(id, parsed.data.organizationIds);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
