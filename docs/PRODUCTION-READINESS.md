# Production readiness — stacked review

| Field | Value |
|-------|--------|
| Status | Assembled on PR #7 (`cursor/assemble-private-stack`). `master` is unchanged. |
| Date | 2026-10-09, stack note 2026-11-11 |
| Scope | Decisions, alternatives, skills, and **Needs Mainul** across the former PRs #1–#6 |
| Runbook | `docs/DEPLOY.md` |

This consolidates `docs/decisions/foundation.md`, `uploads.md`, `security.md`, `e2e.md`, and `ux.md`. Those files remain the per-PR logs. Read this before merging #7 to `master`.

Do not put real secrets in git. Host boot is `./scripts/deploy.sh`.

---

## Review / merge order

The draft branches are closed. Their commits are on PR #7, in this order:

```
#1 scoring  →  #3 foundation  →  #2 uploads  →  #4 security  →  #5 E2E  →  #6 live-room UX  →  operator guide
```

| PR | Branch (typical) | Why this slot |
|----|------------------|---------------|
| #1 | scoring | Authoritative points / `needsReview` |
| #3 | production-foundation | Baseline migration, Zod env, Compose, `/api/health`, backups |
| #2 | irp-ccmp-document-lifecycle | ClientDocument retention — needs #3’s migrate path |
| #4 | security-hardening | CSP/proxy, upload validation, rate limits — needs #2’s document table |
| #5 | `cursor/playwright-e2e-ci-ef13` | Playwright + production bugs found in CI |
| #6 | `cursor/live-room-ux-aabe` | Rail / observer / discuss copy / mobile; **this file** |

**#3 and #4 must ship together with #5.** #5 is the first job that boots the production standalone server and therefore carries the **`/api/health` public-path** (probes must not 302 to `/login`) and **HTTPS-only HSTS / `upgrade-insecure-requests`** (emitting them on HTTP made Chromium rewrite to `https://localhost`). Merging #3/#4 without #5 leaves a foundation that Docker HEALTHCHECK and Playwright cannot actually hit.

`master` does not contain this stack until #7 is merged.

---

## Skills followed

Orchestration (this review pass):

| Skill | Use |
|-------|-----|
| **code-changes** | Implement in the app, keep diffs in the owning PR, do not paper over crashes in tests |
| **source-control** | Feature branch `cursor/live-room-ux-aabe`, stacked base `cursor/playwright-e2e-ci-ef13`, no merge of `master`, no deploy |

Repo / product (every stacked PR):

| Source | Use |
|--------|-----|
| `AGENTS.md` / `CLAUDE.md` | Next.js 16 App Router, Prisma, no `next start` for standalone |
| `.cursor/rules/project.mdc` | Live console / game-ui patterns; no committed secrets |
| `.cursor/rules/design.mdc` | Pitch Obsidian, toxic phosphor, 248px glass rail, `data-finish="glass"` |
| `docs/GATE.md` | Operate / Release gate; slices A–D already had go |
| `docs/USER-JOURNEY.md` | Journeys A–D, observer, mobile, QA ticks |
| ADRs 001–004 | Facilitator vs admin; shared discuss clock; Stage auth; local media volume |
| `docs/security/01-threat-model.md` | IRP as critical asset; observer deny; backup residual |

Per-slice extras (see each `docs/decisions/*.md`): architecture-decision-records, adding-docker, setting-up-ci, adding-e2e-tests, auditing-security, writing-copy, using-ui-stack, Vercel env-vars / routing-middleware / auth / verification (deploy is **Docker self-host**, not Vercel).

---

## Decisions (what shipped, alternatives, why)

### Hosting and foundation (#3)

**Chose: self-hosted Docker Compose + Postgres 16**, Next `output: "standalone"`, named volumes `ttx_pg` / `ttx_media`, `prisma migrate deploy` on start, Zod env fail-fast in production, Pino JSON logs, host-side `pg_dump` backups. **Not Vercel + Neon.**

| Alternative | Why not |
|-------------|---------|
| Vercel Functions / Fluid + Neon | Paid; media volume and `pg_dump` do not fit serverless; hard rule: no paid services / no production deploy from the agent |
| Keep `db push` | Cannot review or roll forward |
| Always-on DB ping as liveness | Orchestrators would kill pods on a Postgres blip |

Health: `GET /api/health` live; `?ready=1` runs `SELECT 1`. **Unauthenticated** (probe). #5 made that path public in `proxy.ts` so the login gate cannot 302 the check.

### Uploads / IRP (#2)

**Chose:** `ClientDocument` + append-only audit. Default **14 days after soft-delete**, plus a **365-day abandoned cap**. Closing an **engagement** soft-deletes standing org IRP/CCMP; draft close does not. Bytes leave `public/` (`./data/media`). Sweep: in-app interval + CLI + secret-gated `/api/internal/retention/run`.

| Alternative | Why not |
|-------------|---------|
| 14 days from upload | Wipes plans uploaded during prep |
| No abandoned cap | Forgotten tenants keep plans forever |
| Soft-delete org plans on every draft close | Breaks rehearsals |
| Vercel Cron | Platform lock-in / paid |

### Security (#4)

**Chose:** Shared session policy helpers; in-memory rate limits (join ≠ login buckets); CSP nonce on **HTML only**; HSTS / upgrade-insecure-requests **HTTPS only**; magic-byte upload allowlist; 8h httpOnly cookies; `skipProxyUrlNormalize` so RSC flights keep their headers.

| Alternative | Why not |
|-------------|---------|
| Paid WAF / Redis | Forbidden |
| HSTS on HTTP | Chromium follows to `https://localhost` (Playwright / Docker :3080) |
| Clone Flight headers into `NextResponse.next({ request })` | Next 307s to `?_rsc=`; Chromium loads the flight as a document |
| Matcher-skip RSC in proxy | Would skip the guest activity lock |

### E2E (#5)

**Chose:** Chromium-only GitHub Actions, production standalone `node .next/standalone/server.js` on :3010, DEMO01 reseed, no paid Playwright grid. Found and fixed: `server-only` seed crash, health behind login, standalone `next start` hang, guest-join eating the login bucket, HTTPS upgrade on HTTP, **hub→session 307 `?_rsc=`**, **ScorePanel crash on redacted injects**.

Participant `GET /api/sessions/:id` still redacts future injects to **`{ id, sequence }`** (no `questions`, no body). `questionsOf` in `lib/game-score.ts` treats missing `questions` as `[]`. Guests skip ScorePanel; seated roles do not.

### Live-room UX (#6)

**Chose:** Overlay rail below 1280px; observer read-only layout; discuss copy “Time remaining” / “Answering opens automatically” with **no client phase PATCH**; self-hosted fontsource fonts; frost off below 640px and inside nested cards; `--disable-dev-shm-usage` for CI Chromium. Present/Stage/session-console iterate `questions ?? []`. Does **not** change the redacted-inject contract.

| Alternative | Why not |
|-------------|---------|
| Client PATCH discuss→answering | Forbidden; server clock (ADR-002) |
| `next/font/google` | CI/Docker builds fetch fonts.google.com |
| Park operator / `hardNavigate` / fresh context | Hides the classroom path; #5 fixed the app |

---

## Needs Mainul

Owner decisions before a real engagement. None of these were executed by the stack agents (no merge, no deploy, no real secrets).

1. **Hosting target.** Self-hosted Docker + Postgres is what shipped. Confirm you do **not** want Vercel.
2. **Compose Postgres password and `:5433`.** `./scripts/deploy.sh` generates `POSTGRES_PASSWORD` for a new volume and `docker-compose.prod.yml` does not publish the database. Local `./run.sh docker` still uses password `ttx` and publishes **5433** for the laptop. Do not point a public host at that dev compose file.
3. **TLS proxy.** Put nginx/Caddy/LB in front. Set `AUTH_URL=https://…`. The TLS terminator should set `X-Forwarded-Proto: https`. **Strip or overwrite client-supplied `x-forwarded-proto`** at the proxy so a player cannot force HSTS/secure cookies by sending the header. The app currently trusts the first value of that header (`lib/security/headers.ts`).
4. **Rotate `OPERATOR_PASSWORD`** off `change-me` (and mint a unique `AUTH_SECRET` ≥ 32 chars). Production Zod rejects placeholders when `ALLOW_DEV_DEFAULTS` is false.
5. **Baseline existing `db push` databases** once: `./scripts/deploy.sh --baseline`, or `npx prisma migrate resolve --applied 20261009120000_baseline` then `migrate deploy`. A normal boot will not baseline.
6. **Backup schedule and off-box copies.** `scripts/backup.sh` / `restore.sh` are host-side. Schedule them. IRP/answers in dumps outlive hard-delete (threat model §3.4). Test a restore on a copy.
7. **Upload retention vs contracts / DPDP.** Default is **14d after soft-delete** and a **365d abandoned cap**. Confirm against client contracts, CERT-In / RBI addenda, and DPDP. If destruction is “at engagement end only”, drop the 365-day cap.
8. **Overlapping engagements.** Closing one **engagement** hides shared org IRP/CCMP from other live runs for that org until restore/re-upload. Confirm that is acceptable.
9. **Re-home old IRP files** out of `public/media/orgs` into `data/media/orgs` (or set `MEDIA_ROOT`). Leftovers are not migrated; `/media/*` is a `beforeFiles` rewrite so `public/` cannot bypass authz.
10. **Question `points` on player JSON.** `expectedAction` / rubric / AI notes are stripped. **Points stay** for ScorePanel. Confirm they are not an “answer key”.
11. **`npm audit` majors not taken:** Vitest 5, nodemailer 10 (via Auth.js), Prisma 7 / force-downgrade. Re-audit before the first client run.
12. **Rate-limit numbers.** Login 10/15m per IP+mailbox; join 80/2m per IP+code; joinIp 120/2m per IP. Sized for ~50 people behind one NAT. Confirm your largest room.
13. **DB pool size.** Compose/CI use `connection_limit=20`. Prisma default 5 is too small for a live room + polls.
14. **Stage-card generation for imported scenarios.** Session RSC no longer persists stage assets (classroom stampede / `cookies()` in `after()`). Seed and the scenario editor still write cards. Confirm imported packs get cards before you project them.
15. **Object storage (ADR-004 B)** before running **more than one app replica**. Media volume and in-memory rate limits are single-node.
16. **Redacted-inject contract.** Future injects stay `{ id, sequence }` with **no `questions`**. ScorePanel totals for players only count injects they can see. Confirm that leak surface (and the incomplete total) is what you want.
17. **UX leftovers** (rail default on 1100–1279px laptops; observer sees all prompts; discuss hint vs early “Open questions”; compact QR default-hidden; real iPhone Safari; latin-only fonts).

---

## What “green” means

GitHub Actions on each stacked PR: **lint + unit + production build**, **Docker image**, **Playwright Chromium e2e** (production standalone, DEMO01). Local: `npm run lint`, `npm test`, `NODE_ENV=production npm run build`, `npm run test:e2e` after migrate+seed.

This document does not replace `docs/DEPLOY.md`.
