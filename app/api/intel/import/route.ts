import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/access";
import { importAdvisory } from "@/lib/intel/import";

const bodySchema = z.object({
  source: z.enum(["CISA", "FBI", "RBI", "SEBI", "CERT_IN", "NVD", "MANUAL", "NEWS"]),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().url().optional(),
});

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const item = await importAdvisory(parsed.data);
  return NextResponse.json(item);
}
