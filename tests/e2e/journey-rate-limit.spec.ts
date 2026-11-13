import { test, expect } from "@playwright/test";
import {
  createDraftSession,
  guestBrowserContext,
  joinByCode,
  loginAs,
  operatorAuth,
  selectWorkspaceOrg,
} from "./helpers";

/**
 * Guest-join used to POST /api/auth/callback/guest-join through the login
 * bucket (10/15m/IP). A dozen classroom joins would 429 the next password
 * sign-in. Join and login are separate; this burst is still under the join cap.
 */
test.describe("Rate limits — join vs login", () => {
  test("a burst of guest joins does not block credential login", async ({
    browser,
  }) => {
    const operatorContext = await browser.newContext({ storageState: operatorAuth });
    const operatorPage = await operatorContext.newPage();
    await selectWorkspaceOrg(operatorPage);
    const session = await createDraftSession(operatorContext.request);

    const burst = 12;
    for (let i = 0; i < burst; i += 1) {
      const ctx = await guestBrowserContext(browser);
      const guest = await ctx.newPage();
      await joinByCode(guest, session.joinCode, `Burst ${i + 1}`);
      await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`), {
        timeout: 30_000,
      });
      await ctx.close();
    }

    const email = `burst-login-${Date.now()}@e2e.local`;
    const password = "BurstLogin1!";
    const other = await operatorContext.request.post("/api/orgs", {
      data: { name: `E2E Burst Org ${Date.now()}`, sector: "bfsi_in" },
    });
    expect(other.ok(), await other.text()).toBeTruthy();
    const otherOrg = (await other.json()) as { id: string };
    const userRes = await operatorContext.request.post("/api/users", {
      data: {
        name: "E2E Burst Facilitator",
        email,
        password,
        platformRole: "USER",
        canFacilitate: true,
        organizationIds: [otherOrg.id],
      },
    });
    expect(userRes.ok(), await userRes.text()).toBeTruthy();
    await operatorContext.close();

    const loginContext = await guestBrowserContext(browser);
    const loginPage = await loginContext.newPage();
    await loginAs(loginPage, email, password);
    await expect(
      loginPage.getByRole("heading", { name: /Control|Welcome back/i }),
    ).toBeVisible();
    await loginContext.close();
  });
});
