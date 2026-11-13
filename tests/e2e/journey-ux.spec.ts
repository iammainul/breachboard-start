import { test, expect } from "@playwright/test";
import { createNoRubricExercise } from "./db";
import {
  assertPageAlive,
  createDraftSession,
  guestBrowserContext,
  openQuestions,
  operatorAccount,
  selectWorkspaceOrg,
  seatUser,
  sessionJson,
  startExercise,
} from "./helpers";

test.describe("Live-room UX", () => {
  test("tablet viewport collapses the workspace rail", async ({ page, request }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);
    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();

    const rail = page.locator("aside[aria-label='Workspace rail']");

    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 1024 });
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      await expect(rail).toHaveAttribute("inert");
      await expect(page.getByRole("link", { name: "Control" })).not.toBeInViewport();
      await expect(page.getByRole("button", { name: "Start exercise" })).toBeInViewport();
      await expect(page.getByText(session.joinCode)).toBeInViewport();

      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(rail).not.toHaveAttribute("inert");
      await expect(page.getByRole("link", { name: "Control" })).toBeInViewport();
      await page.getByRole("button", { name: "Close navigation" }).click();
      await expect(rail).toHaveAttribute("inert");
      await expect(page.getByRole("link", { name: "Control" })).not.toBeInViewport();
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
    await expect(rail).not.toHaveAttribute("inert");
    await expect(page.getByRole("link", { name: "Control" })).toBeInViewport();
  });

  test("discuss countdown names time remaining and the automatic flip", async ({
    page,
    request,
  }) => {
    await selectWorkspaceOrg(page);
    const session = await createDraftSession(request);
    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);

    const timer = page.getByRole("timer");
    await expect(timer).toContainText("Time remaining");
    await expect(timer).toContainText("Answering opens automatically");
    await expect(page.getByText(/Discuss with your squad/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Open questions" })).toBeVisible();
  });

  test("mobile: join + answer usable", async ({ page, request, browser }) => {
    await selectWorkspaceOrg(page);
    const orgsRes = await request.get("/api/orgs");
    expect(orgsRes.ok()).toBeTruthy();
    const orgs = (await orgsRes.json()) as { id: string; name: string }[];
    const org = orgs.find((row) => /Northline/i.test(row.name)) ?? orgs[0]!;
    const exercise = await createNoRubricExercise(org.id);
    const me = await operatorAccount(request);
    expect(me.id).toBeTruthy();

    const createRes = await request.post("/api/sessions", {
      data: {
        organizationId: org.id,
        exerciseId: exercise.id,
        runKind: "draft",
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const session = (await createRes.json()) as { id: string; joinCode: string };

    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);
    await openQuestions(page);
    await page.close();

    const guestContext = await guestBrowserContext(browser, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const guest = await guestContext.newPage();
    await guest.goto("/join");
    await expect(guest.getByText("Mission lobby")).toBeVisible();
    await guest.getByPlaceholder("How you appear on the roster").fill("E2E Mobile");
    await guest.getByPlaceholder("ABC123").fill(session.joinCode);

    const joined = guest.waitForResponse(
      (res) => res.url().includes("/api/join") && res.request().method() === "POST",
    );
    await guest.getByRole("button", { name: "Join squad" }).click();
    expect((await joined).ok()).toBeTruthy();

    const live = await sessionJson(request, session.id);
    const seated = live.seats?.find((seat) => seat.user.name === "E2E Mobile");
    expect(seated).toBeTruthy();
    await seatUser(request, session.id, seated!.user.id, {
      kind: "PARTICIPANT",
      playbookRoleId: "soc",
    });

    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`), {
      timeout: 30_000,
    });
    await expect(guest.getByRole("button", { name: "Open navigation" })).toBeVisible();
    const box = guest.getByPlaceholder("What actions does your role take right now?");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await box.fill("Isolate the mailbox and notify the IR lead.");
    await guest.getByRole("button", { name: /Lock in response/ }).click();
    await expect(guest.getByText(/Response logged/i)).toBeVisible();
    await expect(guest.getByRole("button", { name: /Update response/ })).toBeVisible();

    await guestContext.close();
  });

  test("facilitator console, Stage, and a participant stay open through one inject", async ({
    page,
    request,
    browser,
  }) => {
    await selectWorkspaceOrg(page);
    const orgsRes = await request.get("/api/orgs");
    expect(orgsRes.ok()).toBeTruthy();
    const orgs = (await orgsRes.json()) as { id: string; name: string }[];
    const org = orgs.find((row) => /Northline/i.test(row.name)) ?? orgs[0]!;
    const exercise = await createNoRubricExercise(org.id);

    const createRes = await request.post("/api/sessions", {
      data: {
        organizationId: org.id,
        exerciseId: exercise.id,
        runKind: "draft",
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const session = (await createRes.json()) as { id: string; joinCode: string };

    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);
    await openQuestions(page);

    const stage = await page.context().newPage();
    await stage.goto(`/sessions/${session.id}/stage`);
    await expect(
      stage.getByRole("heading", { name: "No rubric inject" }),
    ).toBeVisible();

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await guest.goto("/join");
    await guest.getByPlaceholder("How you appear on the roster").fill("E2E Trio");
    await guest.getByPlaceholder("ABC123").fill(session.joinCode);
    const joined = guest.waitForResponse(
      (res) => res.url().includes("/api/join") && res.request().method() === "POST",
    );
    await guest.getByRole("button", { name: "Join squad" }).click();
    expect((await joined).ok()).toBeTruthy();

    const live = await sessionJson(request, session.id);
    const seated = live.seats?.find((seat) => seat.user.name === "E2E Trio");
    expect(seated).toBeTruthy();
    await seatUser(request, session.id, seated!.user.id, {
      kind: "PARTICIPANT",
      playbookRoleId: "soc",
    });

    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`), {
      timeout: 30_000,
    });
    const box = guest.getByPlaceholder("What actions does your role take right now?");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await box.fill("Isolate the host and notify the IR lead.");
    await guest.getByRole("button", { name: /Lock in response/ }).click();
    await expect(guest.getByText(/Response logged/i)).toBeVisible();

    await assertPageAlive(page, "facilitator console");
    await assertPageAlive(stage, "Stage");
    await assertPageAlive(guest, "participant");
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await expect(page.getByRole("button", { name: "Release next inject" })).toBeVisible();
    await expect(
      stage.getByRole("heading", { name: "No rubric inject" }),
    ).toBeVisible();
    await expect(guest.getByRole("button", { name: /Update response/ })).toBeVisible();

    await stage.close();
    await guestContext.close();
  });
});
