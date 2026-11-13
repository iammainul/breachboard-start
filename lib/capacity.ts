import { getAppSetting, setAppSetting } from "@/lib/app-settings";

export const SETTING_CAPACITY = "ops.capacity";

export type CapacitySetting = {
  expectedConcurrentUsers: number;
};

const DEFAULT: CapacitySetting = {
  expectedConcurrentUsers: 50,
};

export async function getCapacitySetting(): Promise<CapacitySetting> {
  const raw = await getAppSetting<Partial<CapacitySetting>>(SETTING_CAPACITY);
  const n = Number(raw?.expectedConcurrentUsers);
  if (!Number.isFinite(n)) return DEFAULT;
  return {
    expectedConcurrentUsers: Math.min(100, Math.max(20, Math.round(n))),
  };
}

export async function saveCapacitySetting(value: CapacitySetting) {
  const next: CapacitySetting = {
    expectedConcurrentUsers: Math.min(
      100,
      Math.max(20, Math.round(value.expectedConcurrentUsers)),
    ),
  };
  await setAppSetting(SETTING_CAPACITY, next);
  return next;
}

/** Poll cadence tuned for ~20–100 concurrent live clients. */
export function pollIntervalsForCapacity(users: number): {
  visibleMs: number;
  hiddenMs: number;
} {
  if (users >= 80) return { visibleMs: 7000, hiddenMs: 20000 };
  if (users >= 50) return { visibleMs: 5500, hiddenMs: 18000 };
  if (users >= 30) return { visibleMs: 4500, hiddenMs: 15000 };
  return { visibleMs: 4000, hiddenMs: 12000 };
}
