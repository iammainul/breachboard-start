import { test, expect } from "@playwright/test";
import { selectWorkspaceOrg } from "./helpers";

/**
 * Journey A — Operator: first client engagement (smoke).
 * Login → Control → Engagements tabs → Generate surface.
 */
test.describe("Journey A — Operator", () => {
  test("ops desk, engagements tabs, and generate are reachable", async ({
    page,
  }) => {
    await selectWorkspaceOrg(page);

    await expect(page.getByRole("heading", { name: "Control" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Engagements" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Engagements" }).first().click();
    await expect(page.getByRole("heading", { name: "Engagements", exact: true })).toBeVisible();

    await expect(page.getByRole("tab", { name: /Active/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Closed/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Archived/i })).toBeVisible();

    await page.getByRole("tab", { name: /Closed/i }).click();
    await expect(page.getByRole("tab", { name: /Closed/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /Archived/i }).click();
    await expect(page.getByRole("tab", { name: /Archived/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /Active/i }).click();

    await page.goto("/generate");
    await expect(page.getByRole("heading", { name: "Generate", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate exercise" })).toBeVisible();

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/ai/);
    await expect(page.getByRole("link", { name: "Appearance" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "AI providers" })).toBeVisible();
  });
});
