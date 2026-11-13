import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  getCapacitySetting,
  saveCapacitySetting,
  pollIntervalsForCapacity,
} from "@/lib/capacity";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const capacity = await getCapacitySetting();
  const polls = pollIntervalsForCapacity(capacity.expectedConcurrentUsers);
  const dbUrl = process.env.DATABASE_URL ?? "";

  return NextResponse.json({
    expectedConcurrentUsers: capacity.expectedConcurrentUsers,
    sessionPollMs: polls.visibleMs,
    sessionPollHiddenMs: polls.hiddenMs,
    databaseUrlHasPool: /connection_limit=/i.test(dbUrl),
    notes: [
      "One live session with 20–100 seated clients is the design target.",
      "Clients use lite poll=1 payloads; background tabs poll less often.",
      "Prefer a single facilitator Present window plus Stage; avoid many idle admin tabs.",
      "For Docker, DATABASE_URL should include a Prisma connection_limit.",
    ],
  });
}

const putSchema = z.object({
  expectedConcurrentUsers: z.number().int().min(20).max(100),
});

export async function PUT(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "expectedConcurrentUsers must be 20–100" },
      { status: 400 },
    );
  }

  const capacity = await saveCapacitySetting(parsed.data);
  const polls = pollIntervalsForCapacity(capacity.expectedConcurrentUsers);
  const dbUrl = process.env.DATABASE_URL ?? "";

  return NextResponse.json({
    expectedConcurrentUsers: capacity.expectedConcurrentUsers,
    sessionPollMs: polls.visibleMs,
    sessionPollHiddenMs: polls.hiddenMs,
    databaseUrlHasPool: /connection_limit=/i.test(dbUrl),
    notes: [
      "Poll intervals update for new page loads after save.",
      "Existing open session tabs pick up intervals on next navigation.",
    ],
  });
}
