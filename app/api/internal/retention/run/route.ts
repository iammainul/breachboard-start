import { NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/logger";
import { retentionCronAuthorized } from "@/lib/documents/cron-auth";
import { runRetentionSweep } from "@/lib/documents/sweep";
import { enforceRateLimit } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const limited = enforceRateLimit(request, "retention");
  if (limited) return limited;
  if (!retentionCronAuthorized(request)) {
    logSecurityEvent("authz_denied", {
      code: "CRON",
      route: "retention",
      status: 401,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const result = await runRetentionSweep({ limit });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
