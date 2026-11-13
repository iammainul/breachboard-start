import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { llmProviderSchema } from "@/lib/schema/exercise";
import {
  clearPortalProvider,
  getDefaultProviderId,
  getProviderPublicStatuses,
  saveAiProvidersSetting,
  getAiProvidersSetting,
  upsertPortalProvider,
} from "@/lib/ai/provider-config";
import { anyProviderReady } from "@/lib/ai/provider-status";

const putSchema = z.object({
  id: llmProviderSchema,
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseURL: z.string().optional(),
  clearApiKey: z.boolean().optional(),
  setAsDefault: z.boolean().optional(),
});

const defaultOnlySchema = z.object({
  defaultProvider: llmProviderSchema,
});

export async function PUT(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const body = await request.json().catch(() => null);
  const defaultOnly = defaultOnlySchema.safeParse(body);
  if (defaultOnly.success && !("id" in (body as object))) {
    const setting = await getAiProvidersSetting();
    await saveAiProvidersSetting({
      ...setting,
      defaultProvider: defaultOnly.data.defaultProvider,
    });
    const providers = await getProviderPublicStatuses();
    return NextResponse.json({
      ok: true,
      defaultProvider: defaultOnly.data.defaultProvider,
      providers,
      anyReady: anyProviderReady(providers),
    });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await upsertPortalProvider(parsed.data.id, parsed.data);
  const [providers, defaultProvider] = await Promise.all([
    getProviderPublicStatuses(),
    getDefaultProviderId(),
  ]);

  return NextResponse.json({
    ok: true,
    defaultProvider,
    providers,
    anyReady: anyProviderReady(providers),
  });
}

export async function DELETE(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const id = new URL(request.url).searchParams.get("id");
  const parsed = llmProviderSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing provider id" }, { status: 400 });
  }

  await clearPortalProvider(parsed.data);
  const [providers, defaultProvider] = await Promise.all([
    getProviderPublicStatuses(),
    getDefaultProviderId(),
  ]);

  return NextResponse.json({
    ok: true,
    defaultProvider,
    providers,
    anyReady: anyProviderReady(providers),
  });
}
