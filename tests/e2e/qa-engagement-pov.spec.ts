import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { createDraftSession, selectWorkspaceOrg } from "./helpers";

/**
 * QA engagement rehearsal POV — facilitator drives a draft run while a guest
 * player joins by code. Video is always on (see playwright qa project).
 *
 * Run: npm run test:e2e:qa
 * Then: docs/qa/recordings/qa-engagement-pov.webm
 */
test.describe("QA engagement POV", () => {
  test("facilitator + participant rehearsal with recording", async ({
    page,
    request,
  }, testInfo) => {
    await selectWorkspaceOrg(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Control" })).toBeVisible();
    await page.screenshot({
      path: path.join(testInfo.outputDir, "01-control.png"),
      fullPage: true,
    });

    const session = await createDraftSession(request);

    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({
      path: path.join(testInfo.outputDir, "02-console-prep.png"),
      fullPage: true,
    });

    const baseURL =
      (testInfo.project.use.baseURL as string | undefined) ??
      "http://localhost:3010";

    const guestBrowser = await chromium.launch({
      args: ["--disable-dev-shm-usage"],
    });
    const guestContext = await guestBrowser.newContext({
      baseURL,
      recordVideo: {
        dir: path.join(testInfo.outputDir, "guest-video"),
        size: { width: 1280, height: 720 },
      },
    });
    const guest = await guestContext.newPage();
    await guest.goto("/join");
    await guest.getByPlaceholder("How you appear on the roster").fill("QA Player One");
    await guest.getByPlaceholder("ABC123").fill(session.joinCode);
    await guest.getByRole("button", { name: /Join squad/i }).click();
    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`), {
      timeout: 30_000,
    });
    await guest.screenshot({
      path: path.join(testInfo.outputDir, "03-player-joined.png"),
      fullPage: true,
    });

    await page.reload();
    await expect(page.getByText(/QA Player One/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const start = page.getByRole("button", { name: "Start exercise" });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.getByText(/Discuss with your squad/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({
      path: path.join(testInfo.outputDir, "04-discuss.png"),
      fullPage: true,
    });

    await guest.reload();
    await expect(
      guest.getByText(/discuss|inject|standby|squad|mission/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    const openQuestions = page.getByRole("button", { name: "Open questions" });
    await expect(openQuestions).toBeVisible();
    await openQuestions.click();
    await expect(
      page.getByRole("button", { name: "Release next inject" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(testInfo.outputDir, "05-answering.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: /Open projector|Present/i }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`));
    await page.screenshot({
      path: path.join(testInfo.outputDir, "06-projector.png"),
      fullPage: true,
    });

    await page.goto(`/sessions/${session.id}`);
    await page.getByRole("button", { name: "End exercise" }).click();
    await expect(
      page.getByText(/closed|ended|End exercise/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(testInfo.outputDir, "07-closed.png"),
      fullPage: true,
    });

    await guestContext.close();
    await guestBrowser.close();

    await testInfo.attach("session-meta", {
      body: Buffer.from(
        JSON.stringify(
          {
            sessionId: session.id,
            joinCode: session.joinCode,
            recordedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
  });
});
