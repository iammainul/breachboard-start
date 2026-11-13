import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiAdmin } from "@/lib/access";

export async function GET() {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Breachboard";
  const sheet = workbook.addWorksheet("Players");
  sheet.columns = [
    { header: "name", key: "name", width: 24 },
    { header: "email", key: "email", width: 28 },
    { header: "password", key: "password", width: 16 },
    { header: "platformRole", key: "platformRole", width: 14 },
    { header: "canFacilitate", key: "canFacilitate", width: 14 },
    { header: "organizationSlug", key: "organizationSlug", width: 20 },
    { header: "preferredRole", key: "preferredRole", width: 24 },
    { header: "preferredTeam", key: "preferredTeam", width: 20 },
  ];
  sheet.addRow({
    name: "Priya Shah",
    email: "priya@example.com",
    password: "",
    platformRole: "USER",
    canFacilitate: "false",
    organizationSlug: "example-bank",
    preferredRole: "SOC Lead",
    preferredTeam: "Blue Cell",
  });
  sheet.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ttx-players-template.xlsx"',
    },
  });
}
