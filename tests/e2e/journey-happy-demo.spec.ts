import { test, expect } from "@playwright/test";
import {
  DEMO_JOIN_CODE,
  DEMO_PLAYER_EMAIL,
  DEMO_PLAYER_PASSWORD,
  assertPageAlive,
  findDemoSession,
  guestBrowserContext,
  joinByCode,
  loginAs,
  openQuestions,
  selectWorkspaceOrg,
  sessionJson,
  startExercise,
  waitForAnswering,
} from "./helpers";

/**
 * Happy path on the seeded DEMO01 engagement: operator opens the room,
 * starts, a player joins, questions unlock, an answer is scored, debrief
 * shows Strengths / Gaps.
 */
test.describe("Happy path — DEMO01", () => {
  test("operator runs DEMO01 through join, answer, and debrief", async ({
    page,
    request,
    browser,
  }) => {
    await selectWorkspaceOrg(page);
    const demo = await findDemoSession(request);
    expect(demo.status).toMatch(/draft|live/);

    const demoLink = page.getByRole("link", { name: /PhishGate/i }).first();
    const codeOnHub = page.getByText(DEMO_JOIN_CODE).first();
    if (await demoLink.isVisible()) {
      await demoLink.click();
    } else if (await codeOnHub.isVisible()) {
      await codeOnHub.click();
    } else {
      await page.goto(`/sessions/${demo.id}`);
    }
    await expect(page).toHaveURL(new RegExp(`/sessions/${demo.id}`));
    await expect(page.getByText(DEMO_JOIN_CODE)).toBeVisible();

    if (demo.status !== "live") {
      await startExercise(page);
    }

    const open = page.getByRole("button", { name: "Open questions" });
    if (await open.isVisible()) {
      await openQuestions(page);
    }
    await waitForAnswering(request, demo.id);

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await joinByCode(guest, DEMO_JOIN_CODE, "E2E Guest");
    await expect(guest).toHaveURL(new RegExp(`/sessions/${demo.id}`));
    await expect(guest.getByText(DEMO_JOIN_CODE)).toBeVisible();
    await guestContext.close();

    const playerContext = await guestBrowserContext(browser);
    const player = await playerContext.newPage();
    await loginAs(player, DEMO_PLAYER_EMAIL, DEMO_PLAYER_PASSWORD);
    await expect(
      player.getByRole("heading", { name: /Welcome back/i }),
    ).toBeVisible();
    // Same tab and context as a real participant: MissionCard is a next/link.
    // Regression for hub → /sessions/:id 307 into ?_rsc= (docs/decisions/e2e.md).
    const mission = player.getByRole("link", { name: /PhishGate/i });
    await expect(mission).toHaveAttribute("href", `/sessions/${demo.id}`);
    await mission.click();
    await expect(player).toHaveURL(new RegExp(`/sessions/${demo.id}`));
    await expect(player).not.toHaveURL(/[?&]_rsc=/);
    await expect(player.getByText(DEMO_JOIN_CODE)).toBeVisible();
    await assertPageAlive(player, "CISO console");
    await assertPageAlive(page, "facilitator console");

    const seated = await sessionJson(playerContext.request, demo.id);
    expect(seated.mySeat?.playbookRoleId).toBe("ciso");
    expect(seated.myParticipation?.state).toBe("active");
    expect(seated.myParticipation?.answerableQuestionKeys.length ?? 0).toBeGreaterThan(
      0,
    );

    const answerBox = player.getByPlaceholder(
      "What actions does your role take right now?",
    );
    await expect(answerBox).toBeVisible();
    await answerBox.fill(
      "Declare the incident now, stand up the IR cell, and isolate NL-FIN-WS-441.",
    );
    await player.getByRole("button", { name: /Lock in response|Update response/ }).click();
    // Role + common objectives can both show “Response logged”.
    await expect(player.getByText(/Response logged/i).first()).toBeVisible();
    await expect(player.getByRole("button", { name: /Update response/ })).toBeVisible();

    await page.reload();
    await expect(page.getByText(DEMO_JOIN_CODE)).toBeVisible();
    const mark = page.getByRole("button", { name: "Mark score" });
    if (await mark.isVisible()) {
      const points = page.getByRole("spinbutton").first();
      await points.fill("5");
      await mark.click();
      await expect(page.getByText(/5 pts/i).first()).toBeVisible();
    }

    const debrief = page.getByRole("button", { name: "Debrief" });
    await expect(debrief).toBeVisible();
    await debrief.click();
    await expect
      .poll(async () => (await sessionJson(request, demo.id)).phase)
      .toBe("debrief");

    await page.getByRole("link", { name: /Open projector|Present/i }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${demo.id}/present`));
    await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gaps" })).toBeVisible();

    await playerContext.close();
  });

  test("participant hub MissionCard opens the session in the same tab", async ({
    request,
    browser,
  }) => {
    const demo = await findDemoSession(request);
    const playerContext = await guestBrowserContext(browser);
    const player = await playerContext.newPage();
    await loginAs(player, DEMO_PLAYER_EMAIL, DEMO_PLAYER_PASSWORD);
    await expect(
      player.getByRole("heading", { name: /Welcome back/i }),
    ).toBeVisible();

    const mission = player.getByRole("link", { name: /PhishGate/i });
    await expect(mission).toBeVisible();
    await expect(mission).toHaveAttribute("href", `/sessions/${demo.id}`);
    await mission.click();

    await expect(player).toHaveURL(new RegExp(`/sessions/${demo.id}`));
    await expect(player).not.toHaveURL(/[?&]_rsc=/);
    await expect(player.getByText(DEMO_JOIN_CODE)).toBeVisible();
    await playerContext.close();
  });
});
