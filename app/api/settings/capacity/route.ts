import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { getCapacitySetting, pollIntervalsForCapacity } from "@/lib/capacity";

export async function GET() {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;

  const capacity = await getCapacitySetting();
  const polls = pollIntervalsForCapacity(capacity.expectedConcurrentUsers);
  return NextResponse.json({
    expectedConcurrentUsers: capacity.expectedConcurrentUsers,
    sessionPollMs: polls.visibleMs,
    sessionPollHiddenMs: polls.hiddenMs,
  });
}
