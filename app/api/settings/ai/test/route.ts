import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { llmProviderSchema } from "@/lib/schema/exercise";
import { testProviderConnection } from "@/lib/ai/test-connection";

const bodySchema = z.object({
  id: llmProviderSchema,
});

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide provider id" }, { status: 400 });
  }

  const result = await testProviderConnection(parsed.data.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
