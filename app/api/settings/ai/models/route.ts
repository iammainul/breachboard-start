import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { llmProviderSchema } from "@/lib/schema/exercise";
import { listProviderModels } from "@/lib/ai/list-models";

const bodySchema = z.object({
  id: llmProviderSchema,
  /** Unsaved draft key — lets operators list models before Save. */
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
});

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const result = await listProviderModels({
    provider: parsed.data.id,
    draftApiKey: parsed.data.apiKey,
    draftBaseURL: parsed.data.baseURL,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
