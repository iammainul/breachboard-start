import { NextResponse } from "next/server";
import { livenessBody, pingDatabase, readinessBody } from "@/lib/health";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function noStore(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Liveness: GET /api/health
 * Readiness (DB ping): GET /api/health?ready=1
 *
 * Responses never include connection strings, stack traces, or versions.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const readyFlag = searchParams.get("ready");
  const checkReady = readyFlag === "1" || readyFlag === "true";

  if (!checkReady) {
    return noStore(livenessBody(), 200);
  }

  const ready = await pingDatabase(() => prisma.$queryRaw`SELECT 1`);
  if (!ready) {
    logger.warn({ check: "db" }, "readiness check failed");
    return noStore(readinessBody(false), 503);
  }
  return noStore(readinessBody(true), 200);
}
