import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { installLibraryPackFromUrl } from "@/lib/library/pack";

const bodySchema = z.object({
  url: z.string().url(),
});

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid url" }, { status: 400 });
  }

  try {
    const result = await installLibraryPackFromUrl(parsed.data.url);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Install failed" },
      { status: 400 },
    );
  }
}
