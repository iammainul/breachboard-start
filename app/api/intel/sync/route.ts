import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { syncEnterpriseAttack } from "@/lib/attack/sync";
import { seedMinimalAttack } from "@/lib/attack/seed";

export async function POST() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  try {
    const result = await syncEnterpriseAttack();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const result = await seedMinimalAttack();
  return NextResponse.json(result);
}
