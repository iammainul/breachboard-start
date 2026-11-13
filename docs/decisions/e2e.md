# Playwright E2E in GitHub Actions

| Field | Value |
|-------|--------|
| Status | Proposed (this PR) |
| Date | 2026-10-09 |
| Base | `cursor/security-hardening-cb7a` (PR #4), on PR #2 uploads → PR #3 foundation → PR #1 scoring |
| Related | `docs/USER-JOURNEY.md`, GATE.md, `docs/decisions/foundation.md`, `docs/decisions/security.md` |

This file records **what we chose, the alternatives, why, and what the owner should double-check**.

---

## Skills and docs used

Read and followed:

| Source | How it was used |
|--------|-----------------|
| `.cursor/rules/project.mdc` | Stack, DEMO01 seed, no committed secrets, stay on existing session/score patterns |
| `.cursor/rules/design.mdc` | No visual redesign; selectors use roles/labels already on the glass UI |
| `AGENTS.md` / `CLAUDE.md` | Next.js 16 warning; commands table; prefer existing helpers |
| `docs/GATE.md` | Operate/Release gate; E2E is Verify, not a new product slice |
| `docs/USER-JOURNEY.md` | Journeys A–C plus every unchecked QA line except mobile |
| `docs/00-sdlc.md` | AuthZ coverage for Admin / Facilitator / Participant / Observer |
| `docs/design/04-api-design.md` | Strip `expectedAction` unless facilitator; 403/409 contracts |
| `docs/decisions/foundation.md` | `migrate deploy`, Zod env + `ALLOW_DEV_DEFAULTS`, `/api/health?ready=1`, CI on all PR bases |
| `docs/decisions/security.md` | Headers/CSP, observer deny, key redaction, CSRF, **D2 rate-limit buckets** (join ≠ login after the NAT classroom bug) |
| `docs/decisions/uploads.md` | Settings → Uploads ledger; soft-delete 404 on `/api/media` |
| ADR-001 / ADR-002 / ADR-003 | Facilitator seat; shared discuss clock; Stage stays facilitator-gated (not in this suite) |
| Repo skill **adding-e2e-tests** | Playwright config, Chromium, HTML report artifact, npm scripts. **Departure:** CI is Chromium-only (task: keep CI cheap), not “all browsers in CI”; `webServer` is the standalone Node server, not `npm run dev` |
| Repo skill **writing-tests** | Match existing `tests/e2e/*.spec.ts` style; behavior over internals |
| Repo skill **setting-up-ci** | `npm ci`, Node 22, no deploy job. **Departure:** do not restrict `pull_request` to master (stacked PR) |
| Repo skill **architecture-decision-records** | This file (requested path `e2e.md`, not ADR-00N) |
| Repo skill **api-smoke-testing** | Health + session/join/answer/media status checks inside Playwright, not a separate curl sweep |
| Repo skill **creating-pr** / **writing-commit-messages** / **babysitting-pr** | PR onto the security-hardening branch; watch Actions |
| Vercel **deployments-cicd** | GitHub Actions for test; **no production deploy** (hard rule) |
| Vercel **verification** | Full-story journeys (browser → API → Postgres), not screenshot-only |
| Playwright CI docs (`playwright.dev/docs/ci`, `ci-intro`) | `playwright install --with-deps chromium`, `globalTimeout`, upload report/traces on failure, workers=1 |
| Cursor **subscribe** | Watch GitHub Actions via subscription instead of tight polling |

Looked for and **did not find** in this checkout:

- `.cursor/skills/**` (lockfile only; fetched upstream SKILL.md)
- `node_modules/next/dist/docs/` until `npm ci`
- Context7 Playwright docs (quota exceeded); used Playwright’s own CI pages

Community skills named in USER-JOURNEY (`testing`, `e2e-playwright-testing`, `playwright-e2e`, `tester`, `testing-best-practices`) are not in `skills-lock.json` and were not vendored.

### Deliberate departures

1. **Filename `docs/decisions/e2e.md`** instead of `ADR-00N`. Task asked for this path.
2. **Chromium only**, including CI. adding-e2e-tests wants every browser in CI; the task wants a cheap job under 10 minutes.
3. **Standalone `node server.js` after `next build`**, not `next dev`. `output: "standalone"` cannot be served with `next start` (Next prints a warning and some requests hang). Production middleware/CSP/standalone behavior is what we are proving.
4. **No Playwright Cloud / BrowserStack / paid tracing.** Artifacts stay on GitHub Actions.
5. **Discuss window is not shortened via env.** Waiting 120s would blow the budget; tests backdate `currentInjectStartedAt` through Prisma in the runner. Product clock stays 120s.
6. **No-rubric fixture is a dedicated `E2E …` exercise**, not a mutation of PhishGate (shared by DEMO01).
7. **Question `points` still appear** on participant JSON (`lib/participant-view.ts`). Assertions cover `expectedAction` / `aiGradeRubric` / `rubric`, matching security.md D3.
8. **Mobile journey** was `test.fixme` on this PR; **PR #6** un-fixmes it (390×844, no-rubric fixture).
9. **QA video project is opt-in** (`PLAYWRIGHT_QA=1`). Default `npm run test:e2e` is Chromium CI paths only.

---

## Decisions

### 1. One GitHub Actions job with a `postgres:16` service

**Chose:** New `e2e` job beside existing `check` and `docker`. Service container, `prisma migrate deploy`, `scripts/reseed-demo.ts` (DEMO01), `next build`, `playwright install --with-deps chromium`, `npm run test:e2e`. Upload `playwright-report/` + `test-results/` on **failure** only.

**Alternatives:** Fold e2e into `check` (makes the lint job slow and couples failures); run against Docker Compose (image job already exists, slower); hosted Playwright grid (paid / external).

**Why:** Foundation already builds without a DB. E2E is the first job that needs a real Postgres. Stacked PRs still get Actions (`pull_request:` has no branch filter).

**Owner check:** First run has no Playwright browser cache (Playwright docs advise against caching Linux browsers). If the job sits near 10 minutes, add `actions/cache` only after measuring.

### 2. Production server, throwaway CI secrets

**Chose:** `webServer` runs `scripts/start-web-e2e.sh` (`node .next/standalone/server.js` after copying `.next/static` + `public`, same layout as the Docker image). `ALLOW_DEV_DEFAULTS=true` so placeholder `AUTH_SECRET` / `OPERATOR_PASSWORD` from the existing CI env are legal. `AUTH_URL=http://localhost:3010` matches Playwright. CI uses **production rate-limit defaults** (no inflated `RATE_LIMIT_*`) and Docker’s Prisma pool (`connection_limit=20`, not 5).

**Alternatives:** `npx next start` (Next 16 warns it does not work with `output: "standalone"`; `/api/join` hung on “Joining…”); keep `next dev --turbopack` (misses CSP nonce on the production path); strict production secrets in GitHub (unnecessary; task forbids real secrets).

**Why:** CSP, standalone tracing, and `NODE_ENV=production` cookies only show up on the production server. Docker already uses this binary.

**Owner check:** Local `npm run test:e2e` needs a `.next` build and a migrated DB (`./run.sh` or the same migrate+seed steps).

### 2b. Join vs login rate-limit buckets (production bug)

**Chose:** Guest-join Auth.js callbacks (`/api/auth/callback/guest-join`) no longer consume the login bucket. Login is keyed **IP + account**. Join is keyed **IP + session code** (80 / 2 min) with a per-IP stuffing cap `joinIp` (120 / 2 min). Defaults sized for a ~50-person tabletop joining within a minute behind one NAT. Documented in security.md **D2**. Unit test: 50 join hits on a shared IP leave login open. E2E: 12 real guest joins, then a fresh facilitator password sign-in.

**Alternatives:** Raise CI `RATE_LIMIT_LOGIN_MAX` to 100 (hides the NAT bug); keep one Auth.js POST bucket (classroom joins lock the operator); paid Redis / WAF (forbidden).

**Why:** The first Playwright run showed `/api/auth` login 10/15m/IP counting `signIn("guest-join")`. That is a production incident for any office NAT, not a test flake.

**Owner check:** Same as security.md D2 — largest room size vs 80/120.

### 3. Serial Chromium, web-first assertions

**Chose:** `workers: 1`, `fullyParallel: false`, retries=1 on CI, `globalTimeout` 8 minutes, no `waitForTimeout`. Locators are roles/labels/placeholders already in the UI (no new `data-testid` sweep).

**Alternatives:** Parallel workers (DEMO01 + login rate limits would race); adding testids on every control.

**Why:** In-memory rate limits and a single DEMO01 row are process-global. Serial is the cheap stability lever.

### 4. Prisma in the test runner for two fixtures only

**Chose:** `tests/e2e/db.ts` backdates the discuss clock and inserts a no-rubric draft exercise. Everything else goes through HTTP/UI.

**Alternatives:** `DISCUSS_SECONDS=2` env (Journey B would race Open questions); a test-only HTTP backdoor (attack surface); wait the real 120s.

**Why:** ADR-002 clock stays production-true. Empty-rubric scoring must not rewrite PhishGate.

### 5. Coverage map

| Journey | Spec |
|---------|------|
| A operator desk | `journey-a-operator.spec.ts` |
| B facilitator loop | `journey-b-facilitator.spec.ts` |
| C join / closed | `journey-c-participant.spec.ts` |
| DEMO01 happy path + debrief Strengths/Gaps | `journey-happy-demo.spec.ts` |
| Archived join, observer UI+API, key leak, cross-org | `journey-guards.spec.ts` |
| Honest scoring | `journey-scoring.spec.ts` |
| Discuss expiry without facilitator tab | `journey-discuss-expiry.spec.ts` |
| Upload PDF → Settings → Uploads → soft-delete 404 | `journey-uploads.spec.ts` |
| CSP/headers + readiness | `journey-security.spec.ts` |
| Join burst does not lock login | `journey-rate-limit.spec.ts` |
| Hub MissionCard click → `/sessions/:id` (no `?_rsc=`) | `journey-happy-demo.spec.ts` |
| QA video (not CI) | `qa-engagement-pov.spec.ts` |

---

## App bugs found in this PR

1. **`npx tsx scripts/seed-demo.ts` crashed on `server-only`.** `writeStageCardFile` → `lib/media/fs.ts` imports Next’s `server-only` package, which throws outside the RSC compiler. CI seed (and `./run.sh reseed`) never reached DEMO01. **Fix:** `scripts/shim-server-only.cjs` aliased in `reseed-demo.ts` child `NODE_OPTIONS`. Product `import "server-only"` on `fs.ts` stays (keeps media I/O out of the browser bundle).
2. **`GET /api/health` redirected to `/login`.** Security `proxy.ts` required a session for every path except login/join/brand. Foundation’s probe (and the Docker `HEALTHCHECK`) is unauthenticated by design, so Playwright received the login HTML (`<!DOCTYPE…`). **Fix:** `lib/security/public-paths.ts` — `/api/health` is public and activity-lock exempt.
3. **`npx next start` with `output: "standalone"` hung.** Next 16 warns to use `node .next/standalone/server.js`. Guest join stuck on “Joining…” and a player tab showed Chrome’s “This page couldn’t load”. **Fix:** Playwright `webServer` now matches the Docker layout via `scripts/start-web-e2e.sh`.
4. **Journey A heading.** The generate page hero is `Generate`, not `Generate scenario`. Test-only locator fix.
5. **Guest-join billed to the login rate-limit bucket.** Auth.js `POST /api/auth/*` applied `login` (10/15m per IP) to `signIn("guest-join")`. A room joining from one NAT would 429 the operator. **Fix:** `authPostLimitKind` skips guest-join; login is IP+email; join is IP+code plus `joinIp`. CI no longer raises the caps.
6. **Second participant tab aborted on `/sessions/:id` (HTTPS upgrade + `after()`).** Playwright’s DEMO01 happy path logged in as seeded CISO Priya, then navigating to the live session showed Chrome’s “This page couldn’t load”. One trace requested **`https://localhost:3010/sessions/…`** (nothing listens on TLS). Production CSP included `upgrade-insecure-requests` and HSTS on plain HTTP (`NODE_ENV=production`, `AUTH_URL=http://localhost:3010`). Chromium then upgraded the next top-level navigation. Session RSC also **awaited** `persistStageAssets` on every load (a classroom stampede); scheduling it with Next `after()` then threw `cookies() inside after()` because `DeskShell` reads the workspace-org cookie. **Fix:** HSTS / `upgrade-insecure-requests` only on HTTPS (security.md D3); session page no longer persists assets (seed / scenario editor still do); E2E pool matches Docker.
7. **Hub → session client navigation 307’d into `?_rsc=`.** After the HTTPS fix, a real click of the PhishGate `MissionCard` (`next/link`) from the hydrated participant hub still aborted Chromium with “This page couldn’t load”. Traces: document GET `/sessions/:id` → **307** `Location: /sessions/:id?_rsc=…`. Guest join worked because `/sessions/:id` was that tab’s **first document** load (no Flight). This is a production bug: facilitators and players click through from the hub in the same tab.

   **Hypothesis (confirmed):** not the session page’s org-workspace cookie (read-only; no redirect) and not a seat `notFound()`. Next.js 16 default **proxy URL normalize** strips `rsc`, `next-router-state-tree`, `next-router-prefetch`, and `_rsc` before `proxy.ts`. Security PR #4’s CSP nonce path did `new Headers(req.headers)` + `x-nonce` and `NextResponse.next({ request: { headers } })`. That **replaces** the incoming request headers with the stripped clone. `experimental.validateRSCRequestHeaders` (default true) then 307s to the hash of the remaining headers. Next’s client treats a non-flight follow as MPA navigation; Chromium loads the flight URL as a document and aborts. Auth.js `auth()` wrapping `proxy` was checked: login/activity-lock `NextResponse.redirect` clears search, so those Locations are `/login` or `/sessions/:id`, not `?_rsc=`. Rewriting RSC to login would serve the login tree at the session URL — rejected. Matcher-skipping RSC would skip the guest activity lock (security.md: proxy is the URL-level gate).

   **Fix:** `skipProxyUrlNormalize: true` so proxy sees Flight headers; **HTML documents** still get `x-nonce` on the request (theme bootstrap in `app/layout.tsx`); **RSC/prefetch** call `NextResponse.next()` with no request-header override; redirects stay document paths. Happy path and a dedicated spec click PhishGate in the **same tab and context**. Do not disable `validateRSCRequestHeaders` (CDN cache-poisoning guard).

   **PR #6:** a tab crashing while another tab polls `/api/sessions` can be the same failure mode — one tab’s client navigation 307s into `?_rsc=` while the facilitator console is polling. If #6 still crashes after this lands, it is a separate issue (poll payload / shared Chromium process), not this Flight redirect.

8. **Seated player ScorePanel crashed on redacted injects.** After the Flight 307 was gone, Priya’s hub click still ended on Chromium’s “This page couldn’t load”. The session RSC returned **200** `text/x-component`; Playwright then recorded `TypeError: Cannot read properties of undefined (reading 'filter')` in `pointsForRole`. Participant `GET /api/sessions/:id` returns `{ id, sequence }` for future injects (no `questions`). Guests skip ScorePanel (`playbookRoleId` null); a seeded CISO does not. **Fix:** `questionsOf` in `lib/game-score.ts`. This is a production crash for any role-seated player opening a live run.

Test notes (not product bugs): after submit the answer form stays for updates, so the copy on the card is **Response logged** (the “Your response is logged” paragraph only shows when `canAnswer` is false). CISO can see that copy on both the role card and a common card — locators use `.first()`. `loginAs` waits for the login form’s `window.location.href` hard navigation before the next goto.

---

## Needs owner

1. Confirm **question `points`** may remain on player JSON (same open item as security.md).
2. Confirm **DEMO01 happy path** may log in as `priya@demo.local` to answer (seeded CISO). Guest join on DEMO01 cannot answer until a playbook role is free.
3. Optional: env-tunable `DISCUSS_SECONDS` if you want expiry tests without Prisma.
4. Optional: real-device iPhone Safari (PR #6 Chromium e2e is not WebKit).
5. STACKED PR: base is `cursor/security-hardening-cb7a` for this file’s PR; **merge order is #1 → #3 → #2 → #4 → #5 → #6**. **#3/#4 must ship with #5.** See `docs/PRODUCTION-READINESS.md`.
6. Re-run `npm run test:e2e` locally after `npm run build` before the first client engagement.
7. Confirm 80/2m per join code and 120/2m per IP for the largest live room (security.md D2).
