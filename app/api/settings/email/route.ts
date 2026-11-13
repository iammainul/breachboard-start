import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  getSmtpPublicStatus,
  saveSmtpConfig,
  smtpInputSchema,
} from "@/lib/email/smtp";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  return NextResponse.json(await getSmtpPublicStatus());
}

export async function PUT(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = smtpInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid host, port, sender address, and TLS mode" },
      { status: 400 },
    );
  }
  try {
    await saveSmtpConfig(parsed.data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save SMTP" },
      { status: 500 },
    );
  }
  return NextResponse.json(await getSmtpPublicStatus());
}
