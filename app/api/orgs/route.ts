import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { slugify } from "@/lib/join-code";
import { sectorSchema } from "@/lib/schema/exercise";

const createSchema = z.object({
  name: z.string().min(2),
  sector: sectorSchema.default("bfsi_in"),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, sessions: true } } },
  });
  return NextResponse.json(orgs);
}

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid organization" }, { status: 400 });
  }
  let slug = slugify(parsed.data.name);
  const clash = await prisma.organization.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name.trim(),
      slug,
      sector: parsed.data.sector,
      notes: parsed.data.notes ?? "",
    },
  });
  return NextResponse.json(org);
}
