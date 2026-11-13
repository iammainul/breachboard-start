import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  anyProviderReady,
  autoOnboardIntelEnabled,
  getProviderStatuses,
} from "@/lib/ai/provider-status";
import { getDefaultProviderId } from "@/lib/ai/provider-config";
import {
  SETTING_AI_ONBOARDING,
  SETTING_INTEL_LAST_RUN,
  getAppSetting,
} from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const [providers, aiCompletedAt, intelLastRunAt, templateCount, feedCount, defaultProvider] =
    await Promise.all([
      getProviderStatuses(),
      getAppSetting<string>(SETTING_AI_ONBOARDING),
      getAppSetting<string>(SETTING_INTEL_LAST_RUN),
      prisma.exercise.count({ where: { isTemplate: true } }),
      prisma.feedItem.count(),
      getDefaultProviderId(),
    ]);

  return NextResponse.json({
    providers,
    defaultProvider,
    anyReady: anyProviderReady(providers),
    autoOnboardIntel: autoOnboardIntelEnabled(),
    aiOnboardingCompletedAt: aiCompletedAt,
    intelLastRunAt,
    templateCount,
    feedCount,
  });
}
