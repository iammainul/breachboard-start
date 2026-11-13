import { test, expect } from "@playwright/test";
import {
  createDraftSession,
  operatorAuth,
  selectWorkspaceOrg,
} from "./helpers";

/**
 * Journey C — Participant: join by code (no account).
 * Invalid code error; valid draft code seats a guest into the session.
 */
test.describe("Journey C — Participant", () => {
  test("join lobby rejects unknown codes", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/join");
    await expect(page.getByText("Mission lobby")).toBeVisible();
    await page.getByPlaceholder("How you appear on the roster").fill("E2E Player");
    await page.getByPlaceholder("ABC123").fill("ZZZZZZ");
    await page.getByRole("button", { name: "Join squad" }).click();
    await expect(page.getByText(/Unknown join code|Could not join/i)).toBeVisible();

    await context.close();
  });

  test("guest joins a draft run by code and name", async ({ browser }) => {
    const operatorContext = await browser.newContext({ storageState: operatorAuth });
    const operatorPage = await operatorContext.newPage();
    await selectWorkspaceOrg(operatorPage);
    const session = await createDraftSession(operatorContext.request);
    await operatorContext.close();

    const playerContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await playerContext.newPage();

    await page.goto("/join");
    await page.getByPlaceholder("How you appear on the roster").fill("E2E Player");
    await page.getByPlaceholder("ABC123").fill(session.joinCode);
    await page.getByRole("button", { name: "Join squad" }).click();

    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}`), {
      timeout: 30_000,
    });
    await expect(page.getByText(session.joinCode)).toBeVisible();

    await playerContext.close();
  });

  test("closed runs reject join", async ({ browser }) => {
    const operatorContext = await browser.newContext({ storageState: operatorAuth });
    const session = await createDraftSession(operatorContext.request);

    const closeRes = await operatorContext.request.patch(`/api/sessions/${session.id}`, {
      data: { status: "closed" },
    });
    expect(closeRes.ok()).toBeTruthy();
    await operatorContext.close();

    const playerContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await playerContext.newPage();
    await page.goto("/join");
    await page.getByPlaceholder("How you appear on the roster").fill("E2E Player");
    await page.getByPlaceholder("ABC123").fill(session.joinCode);
    await page.getByRole("button", { name: "Join squad" }).click();
    await expect(page.getByText(/This run has ended|Could not join/i)).toBeVisible();
    await playerContext.close();
  });
});
