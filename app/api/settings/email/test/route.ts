import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import {
  formattedSender,
  smtpTransport,
} from "@/lib/email/smtp";

const schema = z.object({ recipient: z.string().email() });

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid test recipient" }, { status: 400 });
  }
  try {
    const { transport, config } = await smtpTransport();
    await transport.verify();
    await transport.sendMail({
      from: formattedSender(config),
      to: parsed.data.recipient,
      replyTo: config.replyTo,
      subject: "Breachboard SMTP test",
      text: "SMTP delivery is configured correctly for your tabletop exercise portal.",
      html: "<p>SMTP delivery is configured correctly for your <strong>tabletop exercise portal</strong>.</p>",
    });
    transport.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "SMTP connection failed",
      },
      { status: 502 },
    );
  }
}
