import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { exportLibraryPack, packFilename } from "@/lib/library/pack";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const url = new URL(request.url);
  const keysParam = url.searchParams.get("keys");
  const keys = keysParam
    ? keysParam
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : undefined;

  try {
    const pack = await exportLibraryPack(keys);
    const body = JSON.stringify(pack, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${packFilename(pack)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 400 },
    );
  }
}
