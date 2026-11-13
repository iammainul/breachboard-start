import { test, expect } from "@playwright/test";
import {
  assertNoAnswerKeys,
  createDraftSession,
  guestBrowserContext,
  joinByCode,
  loginAs,
  openQuestions,
  operatorAuth,
  selectWorkspaceOrg,
  sessionJson,
  startExercise,
} from "./helpers";

test.describe("Guards — archived join, observer, keys, cross-org", () => {
  test("archived runs reject join", async ({ browser }) => {
    const operatorContext = await browser.newContext({ storageState: operatorAuth });
    const session = await createDraftSession(operatorContext.request);

    const closeRes = await operatorContext.request.patch(`/api/sessions/${session.id}`, {
      data: { status: "closed" },
    });
    expect(closeRes.ok()).toBeTruthy();
    const archiveRes = await operatorContext.request.patch(`/api/sessions/${session.id}`, {
      data: { status: "archived" },
    });
    expect(archiveRes.ok()).toBeTruthy();
    await operatorContext.close();

    const playerContext = await guestBrowserContext(browser);
    const page = await playerContext.newPage();
    await joinByCode(page, session.joinCode, "E2E Player");
    await expect(page.getByText(/This run is archived|Could not join/i)).toBeVisible();
    await playerContext.close();
  });

  test("observer cannot submit answers in the UI or API", async ({
    browser,
    page,
    request,
  }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);
    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);
    await openQuestions(page);

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await joinByCode(guest, session.joinCode, "E2E Observer");
    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`));

    const live = await sessionJson(request, session.id);
    const observerSeat = live.seats?.find((seat) => seat.user.name === "E2E Observer");
    expect(observerSeat).toBeTruthy();
    const seatRes = await request.post(`/api/sessions/${session.id}/seats`, {
      data: {
        userId: observerSeat!.user.id,
        kind: "OBSERVER",
      },
    });
    expect(seatRes.ok(), await seatRes.text()).toBeTruthy();

    await guest.reload();
    await expect(guest.getByText(session.joinCode)).toBeVisible();
    await expect(guest.getByRole("status")).toContainText(/Observing/i);
    await expect(guest.getByText(/Read-only seat/i)).toBeVisible();
    await expect(guest.getByText(/Room prompts · view only/i)).toBeVisible();
    await expect(guest.getByText("View only").first()).toBeVisible();
    await expect(guest.getByPlaceholder(/What actions does your role take/i)).toHaveCount(0);
    await expect(guest.getByRole("button", { name: /Lock in response/i })).toHaveCount(0);
    await expect(guest.getByText(/Submit your response/i)).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Open questions" })).toHaveCount(0);

    const guestView = await sessionJson(guest.context().request, session.id);
    const injectId = guestView.currentInjectId ?? guestView.currentInject?.id;
    expect(injectId).toBeTruthy();
    const answerRes = await guest.context().request.post(`/api/sessions/${session.id}/answers`, {
      data: { injectId, text: "Observer should not be able to submit this." },
    });
    expect(answerRes.status()).toBe(403);
    const body = (await answerRes.json()) as { error?: string };
    expect(body.error).toMatch(/observer/i);

    await guestContext.close();
  });

  test("participant API payloads never include expectedAction or rubric", async ({
    browser,
    page,
    request,
  }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);
    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);
    await openQuestions(page);

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await joinByCode(guest, session.joinCode, "E2E Keycheck");
    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`));

    const payload = await sessionJson(guest.context().request, session.id);
    assertNoAnswerKeys(payload, "GET /api/sessions/:id");
    expect(JSON.stringify(payload.currentInject ?? {})).not.toMatch(/expectedAction/);

    const injectId = payload.currentInjectId ?? payload.currentInject?.id;
    if (injectId) {
      const answerRes = await guest.context().request.post(
        `/api/sessions/${session.id}/answers`,
        { data: { injectId, text: "Attempting a submit without a playbook role." } },
      );
      if (answerRes.ok()) {
        assertNoAnswerKeys(await answerRes.json(), "POST /api/sessions/:id/answers");
      }
    }

    const report = await guest.context().request.get(`/api/sessions/${session.id}/report`);
    if (report.ok()) {
      assertNoAnswerKeys(await report.json(), "GET /api/sessions/:id/report");
    }

    await guestContext.close();
  });

  test("cross-org facilitator cannot read another client's session", async ({
    browser,
    request,
  }) => {
    const session = await createDraftSession(request);

    const other = await request.post("/api/orgs", {
      data: { name: `E2E Other Bank ${Date.now()}`, sector: "bfsi_in" },
    });
    expect(other.ok(), await other.text()).toBeTruthy();
    const otherOrg = (await other.json()) as { id: string };

    const email = `facil-b-${Date.now()}@e2e.local`;
    const password = "E2eFacilitator1";
    const userRes = await request.post("/api/users", {
      data: {
        name: "E2E Other Facilitator",
        email,
        password,
        platformRole: "USER",
        canFacilitate: true,
        organizationIds: [otherOrg.id],
      },
    });
    expect(userRes.ok(), await userRes.text()).toBeTruthy();

    const otherContext = await guestBrowserContext(browser);
    const otherPage = await otherContext.newPage();
    await loginAs(otherPage, email, password);
    await expect(otherPage.getByRole("heading", { name: /Control|Welcome back/i })).toBeVisible();

    const listRes = await otherPage.context().request.get("/api/sessions");
    expect(listRes.ok()).toBeTruthy();
    const listed = (await listRes.json()) as { id: string }[];
    expect(listed.some((row) => row.id === session.id)).toBeFalsy();

    const getRes = await otherPage.context().request.get(`/api/sessions/${session.id}`);
    expect(getRes.status()).toBe(403);

    const claim = await otherPage.context().request.post(`/api/sessions/${session.id}/seats`, {
      data: { kind: "MODERATOR", claimSelf: true },
    });
    expect(claim.status()).toBe(403);

    await otherPage.goto(`/sessions/${session.id}`);
    await expect(otherPage.getByText(session.joinCode)).toHaveCount(0);
    await expect(otherPage.locator("body")).toContainText(/not found|404/i);

    await otherContext.close();
  });

});
