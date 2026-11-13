import type { LlmProvider } from "@/lib/schema/exercise";
import {
  getProviderPublicStatuses,
  type ProviderPublicStatus,
} from "@/lib/ai/provider-config";

export type ProviderStatus = ProviderPublicStatus;

/** @deprecated Prefer getProviderPublicStatuses — kept for call sites migrating to async. */
export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  return getProviderPublicStatuses();
}

export function anyProviderReady(statuses: ProviderStatus[]) {
  return statuses.some((s) => s.ready);
}

export function autoOnboardIntelEnabled() {
  const raw = process.env.AUTO_ONBOARD_INTEL?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

export type { LlmProvider };
