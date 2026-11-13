import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import path from "node:path";

export const operatorAuth = path.join(__dirname, ".auth/operator.json");

export const DEMO_JOIN_CODE = "DEMO01";
export const DEMO_PLAYER_EMAIL = "priya@demo.local";
export const DEMO_PLAYER_PASSWORD = "Demo@Tabletop1";

export function samplePdfBytes(label = "E2E IRP") {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
trailer
<< /Size 4 /Root 1 0 R /Info << /Title (${label}) >> >>
startxref
0
%%EOF
`;
  return Buffer.from(body, "latin1");
}

/** Ensure the sidebar workspace org is selected so Engagements are scoped. */
export async function selectWorkspaceOrg(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Control" })).toBeVisible();

  const trigger = page.getByRole("button", { name: /Organization/i }).first();
  if ((await trigger.count()) === 0) return;

  const label = await trigger.innerText();
  if (!/Select organization/i.test(label)) return;

  await trigger.click();
  const list = page.getByRole("listbox", { name: "Working organization" });
  await expect(list).toBeVisible();
  const firstOrg = list.getByRole("option").nth(1); // 0 is "Clear selection"
  await firstOrg.click();
  await expect(page.getByRole("heading", { name: "Control" })).toBeVisible();
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  // Login form uses redirect:false then window.location.href — wait until that
  // hard navigation finishes before the caller issues another goto.
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}

/** Chromium sad-tab copy when /dev/shm or the GPU process dies. */
export async function assertPageAlive(page: Page, label: string) {
  await expect(
    page.getByText("This page couldn’t load"),
    `${label} must not sad-tab`,
  ).toHaveCount(0);
  await expect(page.locator("body"), label).not.toBeEmpty();
}

export async function guestBrowserContext(
  browser: Browser,
  options: {
    viewport?: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
    deviceScaleFactor?: number;
    reducedMotion?: "reduce" | "no-preference";
  } = {},
) {
  return browser.newContext({
    storageState: { cookies: [], origins: [] },
    ...options,
  });
}

export async function seatUser(
  request: APIRequestContext,
  sessionId: string,
  userId: string,
  data: { kind: string; playbookRoleId?: string | null; teamId?: string | null },
) {
  const seatRes = await request.post(`/api/sessions/${sessionId}/seats`, {
    data: {
      userId,
      kind: data.kind,
      playbookRoleId: data.playbookRoleId ?? null,
      teamId: data.teamId ?? null,
    },
  });
  expect(seatRes.ok(), await seatRes.text()).toBeTruthy();
  return seatRes;
}

export async function joinByCode(page: Page, joinCode: string, name: string) {
  await page.goto("/join");
  await expect(page.getByText("Mission lobby")).toBeVisible();
  await page.getByPlaceholder("How you appear on the roster").fill(name);
  await page.getByPlaceholder("ABC123").fill(joinCode);
  await page.getByRole("button", { name: "Join squad" }).click();
}

export async function createDraftSession(request: APIRequestContext) {
  const orgsRes = await request.get("/api/orgs");
  expect(orgsRes.ok()).toBeTruthy();
  const orgs = (await orgsRes.json()) as { id: string; name: string }[];
  expect(orgs.length).toBeGreaterThan(0);

  const exercisesRes = await request.get("/api/scenarios");
  expect(exercisesRes.ok()).toBeTruthy();
  const exercises = (await exercisesRes.json()) as {
    id: string;
    title: string;
    status?: string;
  }[];
  const playable = exercises.filter(
    (ex) => ex.status !== "retired" && !ex.title.startsWith("E2E "),
  );
  expect(playable.length).toBeGreaterThan(0);
  const preferred =
    playable.find((ex) => /PhishGate/i.test(ex.title)) ?? playable[0]!;

  const createRes = await request.post("/api/sessions", {
    data: {
      organizationId: orgs[0]!.id,
      exerciseId: preferred.id,
      runKind: "draft",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const session = (await createRes.json()) as {
    id: string;
    joinCode: string;
    status: string;
    runKind: string;
  };
  expect(session.id).toBeTruthy();
  expect(session.joinCode).toBeTruthy();
  return {
    ...session,
    organizationId: orgs[0]!.id,
    exerciseId: preferred.id,
  };
}

export async function findDemoSession(request: APIRequestContext) {
  const res = await request.get("/api/sessions");
  expect(res.ok()).toBeTruthy();
  const sessions = (await res.json()) as {
    id: string;
    joinCode: string;
    status: string;
    organizationId?: string;
  }[];
  const demo = sessions.find((row) => row.joinCode === DEMO_JOIN_CODE);
  expect(demo, "seeded DEMO01 session").toBeTruthy();
  return demo!;
}

export async function operatorAccount(request: APIRequestContext) {
  const res = await request.get("/api/account");
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; email: string; name: string };
}

export function assertNoAnswerKeys(payload: unknown, label = "payload") {
  const raw = JSON.stringify(payload);
  expect(raw, `${label} must not include expectedAction`).not.toMatch(
    /"expectedAction"/,
  );
  expect(raw, `${label} must not include aiGradeRubric`).not.toMatch(
    /"aiGradeRubric"/,
  );
  expect(raw, `${label} must not include a rubric key`).not.toMatch(/"rubric"/);
}

export async function startExercise(page: Page) {
  const start = page.getByRole("button", { name: "Start exercise" });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.getByText(/Discuss with your squad/i)).toBeVisible();
}

export async function openQuestions(page: Page) {
  const open = page.getByRole("button", { name: "Open questions" });
  await expect(open).toBeVisible();
  await open.click();
  await expect(
    page.getByRole("button", { name: "Release next inject" }),
  ).toBeVisible();
}

export type SessionJson = {
  id: string;
  joinCode: string;
  status: string;
  phase: string;
  currentInjectId: string | null;
  currentInject?: { id: string; questions?: unknown[] } | null;
  injects?: unknown[];
  answers?: { id: string; needsReview?: boolean; pointsAwarded?: number }[];
  seats?: {
    id: string;
    kind: string;
    playbookRoleId?: string | null;
    user: { id: string; name: string; email?: string };
  }[];
  roles?: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
  mySeat?: {
    id: string;
    kind: string;
    playbookRoleId?: string | null;
  } | null;
  myParticipation?: {
    state: string;
    teamId: string | null;
    canSeeInject: boolean;
    answerableQuestionKeys: string[];
  };
};

export async function sessionJson(request: APIRequestContext, sessionId: string) {
  const res = await request.get(`/api/sessions/${sessionId}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as SessionJson;
}

export async function waitForAnswering(
  request: APIRequestContext,
  sessionId: string,
) {
  await expect
    .poll(async () => (await sessionJson(request, sessionId)).phase, {
      timeout: 20_000,
    })
    .toBe("answering");
}
