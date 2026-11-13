import { z } from "zod";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";

const codeSchema = z.object({
  code: z.string().min(6).max(12),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  const actor = await requireApiUser();
  if ("error" in actor) return actor.error;
  const body = await request.json().catch(() => ({}));
  const action = String((body as { action?: string }).action ?? "start");

  if (action === "start") {
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: actor.user.id },
      data: { totpSecret: secret, totpEnabled: false },
    });
    const url = otpauthUrl(actor.user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#0b0f0d", light: "#f0f8f4" },
    });
    return NextResponse.json({ secret, otpauthUrl: url, qrDataUrl });
  }

  const parsed = codeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Authenticator code required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { totpSecret: true, totpEnabled: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "enable") {
    if (!user.totpSecret) {
      return NextResponse.json({ error: "Start setup first" }, { status: 400 });
    }
    if (!verifyTotp(user.totpSecret, parsed.data.code)) {
      return NextResponse.json({ error: "That code is not valid" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: actor.user.id },
      data: { totpEnabled: true },
    });
    return NextResponse.json({ ok: true, totpEnabled: true });
  }

  if (action === "disable") {
    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: "Authenticator is not on" }, { status: 400 });
    }
    if (!user.passwordHash || !parsed.data.password) {
      return NextResponse.json({ error: "Password required to turn off 2FA" }, { status: 400 });
    }
    const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordOk || !verifyTotp(user.totpSecret, parsed.data.code)) {
      return NextResponse.json({ error: "Password or authenticator code is wrong" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: actor.user.id },
      data: { totpEnabled: false, totpSecret: null },
    });
    return NextResponse.json({ ok: true, totpEnabled: false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
