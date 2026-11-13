# Security hardening — Breachboard client engagements

| Field | Value |
|-------|--------|
| Status | Proposed (this PR) |
| Date | 2026-10-09 |
| Base | `cursor/irp-ccmp-document-lifecycle-75ab` (PR #2), which sits on PR #3 foundation, which sits on PR #1 scoring |
| Related | Threat model `docs/security/01-threat-model.md`, ADR-001..004, FRS NFR-03, USER-JOURNEY.md |

This file records **what we chose, the alternatives, why, and what the owner should double-check**. It is one file (requested path) rather than sequential ADR-005+ files.

This PR adds no Prisma schema of its own. IRP/CCMP retention, `ClientDocument`, and the audit log come from PR #2 (the new base).

---

## Skills and docs used

Read and followed:

| Source | How it was used |
|--------|-----------------|
| `.cursor/rules/project.mdc` | Stack, access helpers, no committed secrets, no schema unless needed |
| `.cursor/rules/design.mdc` | No visual redesign; Stage/Present must keep working |
| `AGENTS.md` / `CLAUDE.md` | Next.js 16 warning: read bundled docs before writing `proxy.ts` / CSP |
| `docs/GATE.md` | Slice A–D already had explicit go; this is post-slice hardening, not a new product slice |
| `docs/USER-JOURNEY.md` | Closed/archived join fail; observer cannot submit; `expectedAction` never in player payload; Stage/Present remain facilitator-gated |
| `docs/security/01-threat-model.md` | STRIDE controls: HTTP-only cookies, MIME/size, observer-answer deny, IRP not on Stage, document upload abuse |
| `docs/design/01-system-architecture.md` | Capability table; authz in route handlers, not UI |
| `docs/design/04-api-design.md` | Strip `expectedAction` unless facilitator; 401/403/409 contract |
| `docs/design/03-ux-present-mode.md` | Stage is `window.open`, not an iframe — `frame-ancestors 'none'` is compatible |
| ADR-001 | Facilitator ≠ Admin-only; live control is `MODERATOR` seat |
| ADR-003 | Stage/Present require facilitator auth (kept) |
| ADR-004 | Filesystem media; do not introduce paid object storage in this PR |
| `docs/02-frs.md` | FR-AUTH-01/02, FR-DOC-01 allowlist, NFR-03 server-side authz |
| `docs/00-sdlc.md` | AuthZ tests for Admin vs Facilitator vs Participant vs Observer |
| Repo skill **auditing-security** (`skills-lock.json` → spencerpauly/awesome-cursor-skills) | Secrets, authz, injection, npm audit, CSP/headers, data exposure |
| Repo skill **architecture-decision-records** | Context / options / decision / consequences per item |
| Repo skill **adding-auth** | Auth.js cookies/CSRF; did **not** add OAuth |
| Repo skill **writing-tests** | Vitest next to existing `tests/*.test.ts` |
| Vercel **routing-middleware** | Next.js 16 uses `proxy.ts` (not deprecated `middleware.ts`); Node runtime; **not** sole auth |
| Vercel **auth** | Auth in route handlers / RSC; proxy only for headers/CSRF |
| Vercel **knowledge-update** | Prefer Node, not Edge runtime |
| Vercel **vercel-firewall** | WAF rate-limit is a paid/platform service — **not used** |
| Next.js CSP guide | Nonce via proxy + `x-nonce`; `'unsafe-eval'` only in dev |

Repo has **no** committed `.cursor/skills/**` copies (lockfile only). External skills were fetched from their upstream SKILL.md.

Follow-up (same PR, after [Audit API authz gaps](bc-b50124e7-d0d0-52ef-a910-b1454bb83286)): re-read `USER-JOURNEY.md`, `GATE.md`, `docs/security/01-threat-model.md`, `docs/design/04-api-design.md`, ADR-001, ADR-003, Vercel **routing-middleware**, **auth**, **knowledge-update**, and **vercel-firewall**. Applied C2 (org-scoped `claimSelf`), M5 (guest `activitySessionId` on `getActor` + session APIs), M6 (strip `aiNotes` on answer POST).

Restack onto PR #2: re-read `docs/decisions/foundation.md`, `docs/decisions/uploads.md`, `docs/DEPLOY.md`, `lib/env.ts`, `lib/logger.ts`. Kept foundation’s Zod env schema, `turbopackIgnore` media tracing, Pino logger, standalone Docker image, and PR #2’s ClientDocument lifecycle.

### Deliberate departures

1. **Filename `docs/decisions/security.md`** instead of `ADR-005-…`. The task asked for this path. Each section still follows the ADR template.
2. **GATE.md “no application code until go”** — Slices A–D already shipped with stakeholder go. This PR is requested production hardening, not a skipped gate.
3. **USER-JOURNEY QA line “Participant cannot see expectedAction / points”** — `expectedAction`, `aiGradeRubric`, and AI notes are stripped. **Question `points` stay** on the player payload because `participant-view.ts` and the score UI already depend on them. Owner should confirm whether display points count as an “answer key”.
4. **Vercel Firewall / paid Redis** — in-memory limiter instead (task: no paid services).
5. **Nonce-only `style-src`** — not used. `style-src 'self' 'unsafe-inline'` so Tailwind, React `style=`, and Stage/Present chrome keep working.
6. **Auth.js OAuth from adding-auth skill** — not added; credentials + invite + guest-join remain.
7. **Proxy as auth gate** — rejected. Authz stays in `requireApi*` / session policy (Auth and routing-middleware skills).
8. **CI `pull_request` only targeting `master`** — expanded to all PRs so this stacked PR (base ≠ master) still gets GitHub Actions.
9. **`getActor` does not 403 globally when `activitySessionId` is set.** The JWT lock is attached on the actor; `requireApiUserForSession` / `loadSessionForActor` / join / invite-claim enforce it. `getActor` has no request URL, and join/account/media still need the user record. Proxy remains the URL-level gate.
10. **Foundation default `public/media`.** Replaced with `./data/media` so client documents cannot be statically served. Kept `turbopackIgnore` on `MEDIA_ROOT` overrides and a static `cwd + data/media` join plus `outputFileTracingIncludes` so standalone builds stay warning-free. Compose still mounts `/data/media`.

---

## D1 — Centralized authorization helpers

**Context.** Authz was duplicated across ~57 route handlers. Gaps: observers received `expectedAction` via `canSeeAll`, facilitators received **every user’s email** on session poll, seat DELETE could remove a seat from another session by ID, closed/archived runs still accepted roster/score writes, invite claim ignored terminal status, GET report leaked AI notes.

**Options.** (A) Per-route patches only. (B) Shared policy module + thin route calls. (C) Prisma middleware / CASL.

**Decision.** **B** — `lib/security/session-policy.ts` (pure, unit-tested) plus `forbidTerminalSessionWrite` in `lib/session-access.ts`.

**Owner check.** Confirm archived → closed restore and closed → archived are the only writes wanted on terminal runs (score overrides after close are now denied).

---

## D2 — Rate limiting

**Context.** Threat model: join-code stuffing, login brute force, invite claim, answer floods, LLM cost.

**Options.** (A) In-memory Map, single node. (B) Postgres table (schema change). (C) Redis / Upstash (paid). (D) Vercel WAF (paid/platform).

**Decision.** **A**, pluggable `RateLimitStore` in `lib/security/rate-limit.ts`. Join and login are **separate buckets with separate keys** (E2E PR found guest-join `signIn` was billed to login; a NAT classroom would lock the operator out — see `docs/decisions/e2e.md`).

| Bucket | Key | Default | Window | Applied on |
|--------|-----|---------|--------|------------|
| `login` | IP + account (email) | 10 | 15m | Auth.js `callback/credentials` only |
| `join` | IP + join code | 80 | 2m | `POST /api/join` |
| `joinIp` | IP | 120 | 2m | `POST /api/join` (stuffing bound) |
| `invite` | IP (+ user id for email) | 8 | 10m | invite-token callback, invite email |
| `answer` | IP + user id | 30 | 5m | answer POST |
| `retention` | IP | 12 | 15m | retention HTTP trigger |

Guest-join Auth.js callbacks are **not** rate-limited as login; `/api/join` already counted that seat. Defaults fit a ~50-person tabletop joining within a minute behind one NAT, with retries, without opening join-code stuffing (the per-IP `joinIp` cap).

**Trade-off.** Correct on Docker / the standalone server on one process. Multiple replicas each have their own counters (limits are weaker, never stronger). Swap store later without caller changes.

**Owner check.** Confirm 80/2m per code and 120/2m per IP for your largest room. Credential brute force stays 10/15m **per mailbox**, not per office IP.

---

## D3 — Security headers and CSP

**Context.** No CSP, HSTS, frame-ancestors, Referrer-Policy, or Permissions-Policy. Next.js 16 wants `proxy.ts` + nonce CSP.

**Options.** (A) Static CSP in `next.config` with `'unsafe-inline'` scripts. (B) Nonce CSP in `proxy.ts`. (C) Experimental SRI hashes.

**Decision.** **B** for scripts (`nonce` + `strict-dynamic`; `unsafe-eval` in dev only), **layered onto the existing Auth.js `proxy.ts`** (login redirect + guest activity-session lock). Do not replace that gate. Static headers also in `next.config` for assets that skip proxy. `frame-ancestors 'none'` + `X-Frame-Options: DENY` — Stage is a window, not an iframe (ADR-003 / UX §3). Theme bootstrap script in `app/layout.tsx` now carries the nonce. **HSTS and CSP `upgrade-insecure-requests` apply only on HTTPS** (`x-forwarded-proto`, request protocol, or `AUTH_URL`). Sending them on HTTP made Chromium rewrite the next navigation to `https://localhost` (Playwright e2e / Docker :3080) — see `docs/decisions/e2e.md`. **CSP nonce is injected on HTML document requests only.** RSC / prefetch flights (`RSC: 1`, `Next-Router-Prefetch`, router-state tree) must not go through `NextResponse.next({ request: { headers } })` — default proxy normalize strips those headers, the clone clobbers the real flight, and Next 307s to `?_rsc=`. `skipProxyUrlNormalize` lets proxy see the flight; HTML still gets `x-nonce` for the theme bootstrap. Auth/activity-lock still `NextResponse.redirect` to a document path (search cleared). Page auth stays `redirect()` in server components (`requirePageUser`). Do not matcher-skip RSC: the guest activity lock is URL-level in proxy.

**Owner check.** After deploy, DevTools → CSP: Stage images (`/media/...`), Present controls, and join QR (`data:` images) must not be blocked. If a future analytics script is added, it needs the nonce. Terminate TLS (or set `AUTH_URL=https://…`) so HSTS is actually emitted.

---

## D4 — Upload validation (not retention)

**Context.** Org IRP/CCMP trusted `file.type` and lived under `public/media/orgs` (static, unauthenticated). Inject uploads trusted declared MIME. No magic-byte check.

**Options.** (A) Validation only on existing paths. (B) Move blobs out of `public/` + `beforeFiles` rewrite + magic bytes. (C) ClamAV / paid scanning.

**Decision.** **B** without antivirus. `lib/security/upload.ts` checks MIME, extension, magic bytes, size, sanitized basename, no `..`. Wired into `persistClientDocument` (PR #2 lifecycle) and inject/library/user-import paths. Default `MEDIA_ROOT` is `./data/media`. `/media/*` rewrite is `beforeFiles` so leftover `public/media` files cannot bypass `/api/media`. Org docs require admin; `orgs/{orgId}/` media requires admin or `canAccessOrganization`. Soft-deleted `ClientDocument` rows 404 on `/api/media` and `/media/*` (admin download route may still fetch them for the ledger).

**Owner check.** Existing files in `public/media/orgs` are **not** migrated (retention agent). Re-upload IRPs after this lands, or copy into `data/media/orgs`.

---

## D5 — Cookies, session, CSRF

**Context.** Auth.js JWT cookies were default; session length unbounded relative to an 8-hour engagement day. Mutations relied on SameSite only.

**Options.** (A) SameSite=Lax only. (B) Lax + Origin/Referer/Sec-Fetch-Site check. (C) Double-submit CSRF tokens on every fetch (client churn).

**Decision.** **B**. Cookies: `httpOnly`, `sameSite: 'lax'`, `secure` when `AUTH_URL` is https or `NODE_ENV=production`, session `maxAge` 8h. Auth.js still issues CSRF tokens for `/api/auth/*`. App mutations: if Origin/Referer present, host must match; if both absent, allow (Playwright `request.patch` and curl). Cross-site form POST sends Origin and is denied.

**Owner check.** Set `AUTH_URL` to the public `https://` origin in production or cookies will not be `Secure`. Do not enable `SameSite=None` without a documented embed case (Stage is not an iframe).

---

## D6 — Dependency audit

**Context.** `npm audit` on this lockfile (run in CI/local after install). Safe non-breaking upgrades applied only when they do not change Prisma/Next major versions.

**Decision.** Applied `npm audit fix` (non-breaking) and bumped **Next.js + eslint-config-next 16.3.4 → 16.4.0** (same major; patches critical `next/og` RCE and cache-poisoning advisories). Did **not** run `npm audit fix --force`.

Remaining after that (owner follow-up; all require majors or would downgrade):

| Package | Severity | Why not bumped |
|---------|----------|----------------|
| `vitest` / `@vitest/mocker` / `tinypool` | critical/moderate | Vitest 5 is a breaking test-runner upgrade |
| `braces` via `eslint-config-next` | high | Force-fix wants eslint-config-next@14 |
| `prisma` / `deepmerge-ts` / `effect` | high | Force-fix wants prisma 6.12 downgrade or 7+ major |
| `nodemailer` via `next-auth` | high | Fix is nodemailer 10 (breaking); Auth.js still pulls ≤10.0.5 |
| `exceljs` → `uuid` | moderate | Force-fix wants exceljs 3.x downgrade |

**Owner check.** Re-run `npm audit` before the first client engagement and after any lockfile change from the migration agent.

---

## D7 — CI on stacked PRs

**Context.** Workflow only ran for PRs into `master`. This PR’s base is the scoring branch.

**Decision.** `on.pull_request` with no branch filter so GitHub Actions runs here.

---

## Route-by-route authz table

Legend: **A** admin · **O** desk operator (`isDeskOperator`) · **F** seated `MODERATOR` · **P** seated `PARTICIPANT` · **V** seated `OBSERVER` · **S** any signed-in user · **G** guest (join only).

| Route | Methods | Who | Org/session scope | Extra denials |
|-------|---------|-----|-------------------|---------------|
| `/api/auth/[...nextauth]` | GET/POST | public | n/a | Login rate limit; Auth.js CSRF |
| `/api/join` | POST | G or S | join code | Closed/archived 409; rate limit |
| `/api/invites/claim` | POST | S | hashed token | Terminal session; invite rate limit |
| `/api/sessions` | GET | S | admin all; operator visible orgs; else own seats | Guest JWT (`activitySessionId`) sees only that run |
| `/api/sessions` | POST | O | `canAccessOrganization` | Linked/accepted scenario rules |
| `/api/sessions/[id]` | GET | S + seat or A | object-level seat | Keys/PII/future injects redacted; people list org-scoped; guest lock |
| `/api/sessions/[id]` | PATCH | F | seated moderator | Terminal writes except restore/archive; guest lock |
| `/api/sessions/[id]` | DELETE | O | org access | Draft-only delete helper; guest lock |
| `/api/sessions/[id]/answers` | POST | P | own seat | Observer/admin/phase/team; rate limit; `aiNotes` stripped |
| `/api/sessions/[id]/answers/[answerId]/score` | PATCH | F | answer in session | Terminal 409 |
| `/api/sessions/[id]/seats` | POST/DELETE | F (or self-claim F **with org access**) | session seats only | Terminal; DELETE must belong to this session; `claimSelf` cannot seize another client’s run |
| `/api/sessions/[id]/teams` | GET | seat or A | session | |
| `/api/sessions/[id]/teams` | POST/PATCH/DELETE | F | session teams | Terminal |
| `/api/sessions/[id]/role-invites` | GET | F | session | |
| `/api/sessions/[id]/role-invites` | POST/PATCH/DELETE | F | session | Terminal |
| `/api/sessions/[id]/role-invites/email` | POST | F | session | Terminal; invite rate limit |
| `/api/sessions/[id]/report` | GET | seat or A | session | AI notes stripped for non-F |
| `/api/sessions/[id]/report` | POST | F or A | session | |
| `/api/media/[...path]` | GET | S | `orgs/` requires org access | Path traversal via `safeMediaRel`; soft/hard-deleted ClientDocuments 404 |
| `/api/orgs` `/api/orgs/[id]` | GET/POST | A | all orgs | |
| `/api/orgs/[id]/docs` | POST/DELETE | A | that org | Magic-byte validation + ClientDocument lifecycle |
| `/api/orgs/[id]/retention` | PATCH | A | that org | CSRF |
| `/api/admin/documents` | GET | A | optional org filter | Ledger may include soft-deleted |
| `/api/admin/documents/[id]` | GET/PATCH | A | document id | CSRF on PATCH; soft/restore/hard-delete |
| `/api/admin/documents/[id]/file` | GET | A | document id | Admin may download soft-deleted; not via `/media` |
| `/api/admin/documents/audit` | GET | A | optional org/document filter | |
| `/api/sessions/[id]/documents` | GET | F or A | session org, active rows only | Guest activity lock |
| `/api/internal/retention/run` | GET/POST | cron secret | n/a | Constant-time compare; rate limit; empty secret 401 |
| `/api/users` `/api/users/[id]` `/api/users/import` `/api/users/template` | * | A | platform | Import validation |
| `/api/account` `/api/account/totp` | * | S | self only | |
| `/api/settings/*` | * | A (capacity: S) | platform | |
| `/api/generate` `/api/scenarios*` `/api/injects` `/api/library*` `/api/intel*` | * | A | admin authoring | Upload validation on media/import |
| `/api/sessions/[id]/stage` page | GET | F | ADR-003 | Unchanged |
| `/api/sessions/[id]/present` page | GET | F | ADR-003 | Unchanged |
| `signOutAction` | server action | S | self | Auth.js CSRF |

Server actions: only `app/sign-out-action.ts`.

---

## Needs owner

1. Confirm **question `points`** may remain on player JSON (score UI) while `expectedAction` / rubric / AI notes stay server-side.
2. Confirm **no score override after close** (now 409).
3. **Re-upload or copy** existing IRP files from `public/media/orgs` into `data/media` (or set `MEDIA_ROOT`).
4. Production **`AUTH_URL=https://…`** so cookies are Secure + HSTS is meaningful.
5. If you run **more than one app replica**, replace the memory rate-limit store (Postgres/Redis) — interface is ready; this PR adds no schema.
6. **npm audit leftovers** listed in the PR report — schedule follow-up upgrades that bump Next/Prisma majors.
7. Optional: virus scan on uploads (not in this PR).
8. Optional: org-scope `generated/` and `uploads/` media by exercise membership (IDs are cuids; residual IDOR is low vs IRP).
9. STACKED PR: linear order is PR #1 (scoring) → PR #3 (foundation) → PR #2 (uploads lifecycle) → this PR. Do not merge to `master` until the stack below is in.

---

## D8 — Follow-up from delayed API authz audit

**Context.** Explore audit of the scoring **base** branch (before this PR’s first commit) found C2/M5/M6 still open after the initial hardening pass.

**Decision.** Closed in this PR:

| ID | Gap | Fix |
|----|-----|-----|
| C2 | `claimSelf` MODERATOR skipped org access | `claimSelfModeratorDenied` + `canAccessOrganization` |
| M5 | Guest `activitySessionId` only in `proxy.ts` | Attached on `getActor`; `requireApiUserForSession`; `loadSessionForActor` (wired on teams GET); join / invite-claim / session pages |
| M6 | Answer POST returned Prisma `aiNotes` | `stripAnswerKeys(..., false)` |

C1/C3/H2–H4/M1–M2/M4 from that audit were already fixed in the first commit of this PR.

---

## D9 — Restack onto foundation + uploads lifecycle

**Context.** This PR originally targeted the scoring branch. Owner asked for one linear stack: #1 → #3 → #2 → #4.

**Decision.** Rebased onto `cursor/irp-ccmp-document-lifecycle-75ab`. Conflicts resolved by keeping both intents (see D4, env schema, logger, Next 16.4.0, `beforeFiles` CSP rewrite, ClientDocument visibility on `/api/media`).

---

## Residual risks (accepted here)

- Facilitator account on the projector PC (threat model §6).
- In-memory rate limits per process.
- `style-src 'unsafe-inline'` (CSS XSS is weaker than script XSS).
- Guest join creates `USER` rows; join is rate-limited but not CAPTCHA.
- LLM vendor logging of truncated IRP excerpts (threat model).
