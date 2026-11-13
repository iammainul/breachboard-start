import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getAppSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return null;
  return row.value as T;
}

export async function setAppSetting(key: string, value: Prisma.InputJsonValue) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export const SETTING_AI_ONBOARDING = "ai.onboarding.completedAt";
export const SETTING_INTEL_LAST_RUN = "intel.autoOnboard.lastRunAt";
export const SETTING_AI_PROVIDERS = "ai.providers";
export const SETTING_EMAIL = "email.smtp";
