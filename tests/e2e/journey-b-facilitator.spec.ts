import { test, expect } from "@playwright/test";
import { createDraftSession, selectWorkspaceOrg } from "./helpers";

/**
 * Journey B — Facilitator: live inject loop (smoke on a draft run).
 * Create draft → open console → Start exercise → discuss → Open questions → Present.
 */
test.describe("Journey B — Facilitator", () => {
  test("draft run go-live, discuss, open questions, present", async ({
    page,
    request,
  }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);

    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible({ timeout: 30_000 });

    const start = page.getByRole("button", { name: "Start exercise" });
    await expect(start).toBeVisible();
    await start.click();

    await expect(page.getByText(/Discuss with your squad/i)).toBeVisible({
      timeout: 20_000,
    });

    const openQuestions = page.getByRole("button", { name: "Open questions" });
    await expect(openQuestions).toBeVisible();
    await openQuestions.click();

    await expect(page.getByRole("button", { name: "Release next inject" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("link", { name: /Open projector|Present/i }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`));
    await expect(page.getByText(/^Present$/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inject map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Stage" })).toBeVisible();
    await expect(page.getByPlaceholder(/scratchpad/i)).toBeVisible();

    await page.goto(`/sessions/${session.id}`);
    await page.getByRole("button", { name: "End exercise" }).click();
    await expect(page.getByText(/closed|ended|End exercise/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
