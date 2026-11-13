import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  anyProviderReady,
  getProviderStatuses,
} from "@/lib/ai/provider-status";
import {
  SETTING_AI_ONBOARDING,
  setAppSetting,
} from "@/lib/app-settings";
import { runAutoOnboardIntel } from "@/lib/intel/auto-onboard";
import { seedLibraryTemplates } from "@/lib/library/seed-templates";

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const body = (await request.json().catch(() => null)) as {
    force?: boolean;
  } | null;

  const providers = await getProviderStatuses();
  if (!anyProviderReady(providers)) {
    return NextResponse.json(
      {
        error:
          "No AI provider credentials found. Add a provider in Settings → AI, or set an env key as fallback.",
      },
      { status: 400 },
    );
  }

  const completedAt = new Date().toISOString();
  await setAppSetting(SETTING_AI_ONBOARDING, completedAt);

  const library = await seedLibraryTemplates();
  let intel;
  try {
    intel = await runAutoOnboardIntel({ force: Boolean(body?.force) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Intel sync failed",
        aiOnboardingCompletedAt: completedAt,
        library,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    aiOnboardingCompletedAt: completedAt,
    providers,
    library,
    intel,
  });
}
