import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authDir = path.join(__dirname, ".auth");
const operatorFile = path.join(authDir, "operator.json");

const operatorEmail =
  process.env.E2E_OPERATOR_EMAIL ??
  process.env.OPERATOR_EMAIL ??
  "operator@local";
const operatorPassword =
  process.env.E2E_OPERATOR_PASSWORD ??
  process.env.OPERATOR_PASSWORD ??
  "change-me";

setup("authenticate operator", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await page.goto("/login");
  await page.getByLabel("Email").fill(operatorEmail);
  await page.getByLabel("Password").fill(operatorPassword);
  await page.getByRole("button", { name: /Enter arena|Sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: /Control|Welcome back/i }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.context().storageState({ path: operatorFile });
});
