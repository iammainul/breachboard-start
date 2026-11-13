import { test, expect } from "@playwright/test";
import { expireDiscussWindow } from "./db";
import {
  createDraftSession,
  guestBrowserContext,
  joinByCode,
  selectWorkspaceOrg,
  startExercise,
} from "./helpers";

test.describe("Discuss expiry without facilitator tab", () => {
  test("participant poll flips discuss to answering after the window elapses", async ({
    page,
    request,
    browser,
  }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);
    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await joinByCode(guest, session.joinCode, "E2E Clock");
    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`));

    // Leave the facilitator surface so only a seated client poll can flip the phase.
    await page.goto("about:blank");

    await expireDiscussWindow(session.id);

    await expect
      .poll(
        async () => {
          const res = await guest.context().request.get(`/api/sessions/${session.id}`);
          if (!res.ok()) return `status:${res.status()}`;
          const json = (await res.json()) as { phase?: string };
          return json.phase ?? "";
        },
        { timeout: 20_000 },
      )
      .toBe("answering");

    await guest.reload();
    await expect(guest.getByRole("button", { name: "Open questions" })).toHaveCount(0);

    await guestContext.close();
  });
});
