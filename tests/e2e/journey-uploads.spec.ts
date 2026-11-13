import { test, expect } from "@playwright/test";
import { samplePdfBytes, selectWorkspaceOrg } from "./helpers";

test.describe("Uploads lifecycle", () => {
  test("admin PDF appears in Settings → Uploads; soft-delete hides it from /api/media", async ({
    page,
    request,
  }) => {
    await selectWorkspaceOrg(page);
    const orgsRes = await request.get("/api/orgs");
    expect(orgsRes.ok()).toBeTruthy();
    const orgs = (await orgsRes.json()) as { id: string; name: string }[];
    const org = orgs.find((row) => /Northline/i.test(row.name)) ?? orgs[0]!;

    const filename = `e2e-irp-${Date.now()}.pdf`;
    await page.goto(`/orgs/${org.id}`);
    await expect(page.getByRole("heading", { name: org.name })).toBeVisible();

    const ircInput = page.locator('input[type="file"]').nth(1);
    await ircInput.setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: samplePdfBytes("E2E IRP"),
    });
    await expect(page.getByText(filename)).toBeVisible();

    const mediaLink = page.getByRole("link", { name: filename });
    await expect(mediaLink).toBeVisible();
    const mediaHref = await mediaLink.getAttribute("href");
    expect(mediaHref).toBeTruthy();

    await page.goto("/settings/uploads");
    await expect(page.getByRole("link", { name: "Uploads" })).toBeVisible();
    await expect(page.getByText(filename)).toBeVisible();
    await expect(page.getByText("Active").first()).toBeVisible();

    const row = page.locator("tr").filter({ hasText: filename });
    await row.getByRole("button", { name: "Soft-delete" }).click();
    await expect(page.getByText("Soft-deleted").first()).toBeVisible();

    const mediaRes = await request.get(mediaHref!);
    expect(mediaRes.status()).toBe(404);

    const apiPath = mediaHref!.replace(/^\/media\//, "/api/media/");
    const apiRes = await request.get(apiPath);
    expect(apiRes.status()).toBe(404);

    await page.goto(`/orgs/${org.id}`);
    await expect(page.getByRole("link", { name: filename })).toHaveCount(0);
    await expect(page.getByText("No document on file.").first()).toBeVisible();
  });
});
