import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { replaceOrgAssignments } from "@/lib/org-scope";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { validateUpload } from "@/lib/security/upload";

function truthy(value: unknown) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function cell(row: ExcelJS.Row, index: number) {
  const v = row.getCell(index).value;
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
  return String(v).trim();
}

export async function POST(request: Request) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const checked = validateUpload({
    kind: "user-import",
    filename: file.name,
    declaredMime: file.type,
    bytes: buf,
    size: file.size,
  });
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: checked.status });
  }
  const name = checked.displayName.toLowerCase();

  type RowIn = {
    name: string;
    email: string;
    password: string;
    platformRole: string;
    canFacilitate: boolean;
    organizationSlug: string;
    preferredRole: string;
    preferredTeam: string;
  };
  const rows: RowIn[] = [];

  if (name.endsWith(".csv")) {
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (key: string) => headers.indexOf(key);
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      rows.push({
        name: cols[idx("name")] ?? "",
        email: cols[idx("email")] ?? "",
        password: cols[idx("password")] ?? "",
        platformRole: (cols[idx("platformrole")] ?? "USER").toUpperCase(),
        canFacilitate: truthy(cols[idx("canfacilitate")]),
        organizationSlug: cols[idx("organizationslug")] ?? "",
        preferredRole: cols[idx("preferredrole")] ?? "",
        preferredTeam: cols[idx("preferredteam")] ?? "",
      });
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    // exceljs typings expect Buffer; Node 22 Buffer generics differ
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({
        name: cell(row, 1),
        email: cell(row, 2),
        password: cell(row, 3),
        platformRole: cell(row, 4).toUpperCase() || "USER",
        canFacilitate: truthy(cell(row, 5)),
        organizationSlug: cell(row, 6),
        preferredRole: cell(row, 7),
        preferredTeam: cell(row, 8),
      });
    });
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true },
  });
  const orgBySlug = new Map(orgs.map((o) => [o.slug, o.id]));

  let created = 0;
  let updated = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNum = i + 2;
    if (!row.name || !row.email) {
      errors.push({ row: rowNum, error: "name and email required" });
      continue;
    }
    const email = row.email.trim().toLowerCase();
    const platformRole = row.platformRole === "ADMIN" ? "ADMIN" : "USER";
    const organizationId = row.organizationSlug
      ? orgBySlug.get(row.organizationSlug) ?? null
      : null;
    if (row.organizationSlug && !organizationId) {
      errors.push({
        row: rowNum,
        error: `Unknown organizationSlug ${row.organizationSlug}`,
      });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    const canFacilitate =
      row.canFacilitate || platformRole === "ADMIN";
    if (platformRole === "USER" && !canFacilitate) {
      errors.push({
        row: rowNum,
        error: "Participants join via code — import operators or facilitators only",
      });
      continue;
    }

    try {
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: row.name.trim(),
            platformRole,
            canFacilitate,
            organizationId,
            preferredRole: row.preferredRole.trim() || null,
            preferredTeam: row.preferredTeam.trim() || null,
            ...(row.password.length >= 8
              ? { passwordHash: await hashPassword(row.password) }
              : {}),
          },
        });
        await replaceOrgAssignments(existing.id, organizationId ? [organizationId] : []);
        updated += 1;
      } else {
        if (row.password && row.password.length < 8) {
          errors.push({
            row: rowNum,
            error: "password must be at least 8 characters or blank",
          });
          continue;
        }
        if (canFacilitate && row.password.length < 8) {
          errors.push({
            row: rowNum,
            error: "admins and facilitators require a password",
          });
          continue;
        }
        const createdUser = await prisma.user.create({
          data: {
            name: row.name.trim(),
            email,
            passwordHash: row.password
              ? await hashPassword(row.password)
              : null,
            platformRole,
            canFacilitate,
            organizationId,
            preferredRole: row.preferredRole.trim() || null,
            preferredTeam: row.preferredTeam.trim() || null,
          },
        });
        if (organizationId) {
          await replaceOrgAssignments(createdUser.id, [organizationId]);
        }
        created += 1;
      }
    } catch (error) {
      errors.push({
        row: rowNum,
        error: error instanceof Error ? error.message : "Save failed",
      });
    }
  }

  return NextResponse.json({ created, updated, errors });
}
