import { test, expect } from "@playwright/test";
import { createNoRubricExercise } from "./db";
import {
  guestBrowserContext,
  joinByCode,
  openQuestions,
  operatorAccount,
  selectWorkspaceOrg,
  sessionJson,
  startExercise,
  waitForAnswering,
} from "./helpers";

test.describe("Honest scoring", () => {
  test("empty rubric yields Needs review at 0 points and Mark score persists", async ({
    page,
    request,
    browser,
  }) => {
    await selectWorkspaceOrg(page);
    const orgsRes = await request.get("/api/orgs");
    expect(orgsRes.ok()).toBeTruthy();
    const orgs = (await orgsRes.json()) as { id: string; name: string }[];
    expect(orgs.length).toBeGreaterThan(0);
    const org = orgs.find((row) => /Northline/i.test(row.name)) ?? orgs[0]!;
    const exercise = await createNoRubricExercise(org.id);
    const me = await operatorAccount(request);

    const createRes = await request.post("/api/sessions", {
      data: {
        organizationId: org.id,
        exerciseId: exercise.id,
        runKind: "draft",
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const session = (await createRes.json()) as { id: string; joinCode: string };
    expect(me.id).toBeTruthy();

    await page.goto(`/sessions/${session.id}`);
    await expect(page.getByText(session.joinCode)).toBeVisible();
    await startExercise(page);
    await openQuestions(page);
    await waitForAnswering(request, session.id);

    const guestContext = await guestBrowserContext(browser);
    const guest = await guestContext.newPage();
    await joinByCode(guest, session.joinCode, "E2E Scorer");
    await expect(guest).toHaveURL(new RegExp(`/sessions/${session.id}`), {
      timeout: 30_000,
    });

    const live = await sessionJson(request, session.id);
    const scorer = live.seats?.find((seat) => seat.user.name === "E2E Scorer");
    expect(scorer).toBeTruthy();
    const seatRes = await request.post(`/api/sessions/${session.id}/seats`, {
      data: {
        userId: scorer!.user.id,
        kind: "PARTICIPANT",
        playbookRoleId: "soc",
      },
    });
    expect(seatRes.ok(), await seatRes.text()).toBeTruthy();

    await guest.reload();
    const box = guest.getByPlaceholder("What actions does your role take right now?");
    await expect(box).toBeVisible();
    await box.fill("Isolate the host and freeze the mailbox.");
    await guest.getByRole("button", { name: /Lock in response/ }).click();
    await expect(guest.getByText(/Response logged/i).first()).toBeVisible();
    await expect(guest.getByRole("button", { name: /Update response/ })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Needs review")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark score" })).toBeVisible();

    const afterSubmit = await sessionJson(request, session.id);
    const answer = afterSubmit.answers?.[0];
    expect(answer).toBeTruthy();
    expect(answer!.needsReview).toBe(true);
    expect(answer!.pointsAwarded ?? 0).toBe(0);

    await page.getByRole("spinbutton").first().fill("3");
    await page.getByRole("button", { name: "Mark score" }).click();
    await expect(page.getByText(/3 pts/i).first()).toBeVisible();
    await expect(page.getByText("Needs review")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(/3 pts/i).first()).toBeVisible();
    const persisted = await sessionJson(request, session.id);
    expect(persisted.answers?.[0]?.needsReview).toBe(false);
    expect(persisted.answers?.[0]?.pointsAwarded).toBe(3);

    await guestContext.close();
  });
});
