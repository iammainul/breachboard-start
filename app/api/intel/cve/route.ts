import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { lookupCve } from "@/lib/intel/nvd";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const record = await lookupCve(id);
  if (!record) {
    return NextResponse.json({ error: "CVE not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
