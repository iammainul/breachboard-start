import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "@/lib/documents/constants";
import { clampRetentionDays } from "@/lib/documents/retention";

const bodySchema = z.object({
  documentRetentionDays: z
    .number()
    .int()
    .min(MIN_RETENTION_DAYS)
    .max(MAX_RETENTION_DAYS),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `documentRetentionDays must be ${MIN_RETENTION_DAYS}–${MAX_RETENTION_DAYS} (default ${DEFAULT_RETENTION_DAYS})`,
      },
      { status: 400 },
    );
  }
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.organization.update({
    where: { id },
    data: {
      documentRetentionDays: clampRetentionDays(parsed.data.documentRetentionDays),
    },
    select: { id: true, documentRetentionDays: true },
  });
  return NextResponse.json(updated);
}
