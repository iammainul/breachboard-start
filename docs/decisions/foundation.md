# Production foundation

Status: Accepted (this PR)  
Date: 2026-10-09  
Scope: Deployability — migrations, env validation, Docker, health, logging, backup, runbook.

This is the decision log for making Breachboard production-deployable. Format follows the repo ADR style (`docs/decisions/ADR-00*.md`) plus the locked `architecture-decision-records` skill, without renumbering those Slice A ADRs.

## Skills and docs used

Read and followed:

| Source | How it was used |
|--------|-----------------|
| `.cursor/rules/project.mdc` | Stack, ports, env files, “do not commit secrets”. Schema apply path updated from `db push` to migrate. Stayed out of session UI / scoring. |
| `.cursor/rules/design.mdc` | No visual redesign. Health is JSON-only. |
| `AGENTS.md` / `CLAUDE.md` | Next.js 16: read `node_modules/next/dist/docs/` (instrumentation, `output: standalone`, self-hosting, env vars). Commands table now says migrate. |
| `docs/GATE.md`, `docs/00-sdlc.md` | Refreshed: build slices already shipped; Operate/Release is the current gate. |
| `docs/USER-JOURNEY.md` | No journey/UI changes. Production ops sit beside existing QA paths. |
| `docs/design/01-system-architecture.md` | Deploy remains Docker Compose + Postgres (no new PaaS). |
| `docs/design/04-api-design.md` | New `/api/health` is unauthenticated by design (probe). Did not touch session/authz routes. |
| `docs/decisions/ADR-004-document-storage.md` | Media stays on a named volume (option A). S3 still the later production target. |
| `docs/security/01-threat-model.md` | Health must not leak internals; backups contain IRP/answers — TTL called out in DEPLOY.md. |
| Next.js 16 docs (`instrumentation.md`, `output.md`, `self-hosting.md`, `environment-variables.md`, upgrade guide “resolve alias fallback”) | `instrumentation.ts` `register` + `onRequestError`; standalone output kept; `outputFileTracingIncludes` for media; no `NEXT_PUBLIC_` secrets; `server-only` on `lib/media/fs.ts` instead of a Turbopack `fs` browser alias. |
| Vercel `env-vars` skill | `.env.example` as the committed template; secrets only in `.local` / host `.env`; no `NEXT_PUBLIC_` secrets. **Departure:** this deploy is Docker self-host, not `vercel env pull`. |
| Vercel `deployments-cicd` skill | GitHub Actions for lint/test/build; no production deploy from CI (hard rule). |
| Vercel `create-a-backend` / `vercel-functions` skills | **Departure:** kept always-on Compose, not Vercel Functions/Fluid. Postgres + local media volume and `pg_dump` do not fit serverless. Dockerfile.vercel was not added. |
| Locked GitHub skill `adding-docker` | Multi-stage image, `.dockerignore` excludes `.env`, named volume, healthcheck. **Departure:** Next `output: "standalone"` instead of copying all `node_modules` and `npm start` — already in the Dockerfile and recommended by Next.js self-hosting docs. Node 22 to match local and Next 16. |
| Locked GitHub skill `setting-up-ci` | `npm ci`, lint, test, build, typecheck. **Departure:** trigger `pull_request` for any base (this PR targets the scoring branch, not master); Node 22; extra Docker-build job that does not push. |
| Locked GitHub skill `architecture-decision-records` | This file. Named `foundation.md` as requested rather than `ADR-005`. |
| Cursor `env-setup` skill | Not changing Cloud Agent `environment.json`; local/prod Docker is in-repo. |

Repo `.cursor/skills/**` is gitignored (see `skills-lock.json`); copies were not present on disk. Context7 docs MCP quota was exceeded; Next.js docs were read from `node_modules/next/dist/docs/` instead.

No repo skill required departing from the product design contract. Departures above are from *generic* Docker/Vercel skills where they conflict with Next standalone, self-hosting, or the “do not deploy / no paid services” rules.

## Decisions

### 1. Prisma migrate with a baseline, not `db push`

**Chose:** One baseline migration `20261009120000_baseline` generated from the current schema (includes `InjectAnswer.needsReview`). Runtime apply is `migrate deploy`. Local authors use `migrate dev`. Existing db-push databases are marked with `migrate resolve --applied 20261009120000_baseline`.

**Alternatives:** Keep `db push` in production; `migrate diff` against a live shadow DB in CI; squash later instead of a baseline.

**Why:** Push cannot be reviewed or rolled forward. A baseline matches Prisma’s documented path off db-push. The SQL is in git.

**Owner check:** On a database that already has tables, run resolve once and confirm `_prisma_migrations` has the baseline before the next schema change.

### 2. Auto-baseline locally, fail hard in production

**Chose:** `./run.sh` (dev/reseed) calls `scripts/apply-migrations.sh --baseline`, which only auto-resolves on Prisma **P3005**. Docker entrypoint runs `migrate deploy` only.

**Alternatives:** Always auto-baseline; require every developer to resolve by hand.

**Why:** Local volumes from earlier `db push` would brick `./run.sh`. Auto-resolving a non-empty production DB without review could hide drift.

**Owner check:** Production runbooks must include the P3005 snippet. Do not pass `--baseline` in the image.

### 3. Zod env schema at startup; fail fast in production

**Chose:** `lib/env.ts` (Zod, already in the repo) + `instrumentation.ts` `register()`. Strict checks (placeholder secrets, `AUTH_SECRET` length, operator password) apply when `NODE_ENV=production` and `ALLOW_DEV_DEFAULTS` is not true. Skipped for `next build` (`NEXT_PHASE`) and `NODE_ENV=test`. Error messages name keys, never values.

**Alternatives:** `@t3-oss/env-nextjs`; validate only in Docker; crash on missing LLM keys.

**Why:** Zod is already the schema language. LLM keys are optional (portal storage). Build-time dummy `AUTH_SECRET` in the Dockerfile must not fail the image build.

**Owner check:** Confirm a production boot with a placeholder `AUTH_SECRET` exits before serving. Confirm `./run.sh docker` still starts (it exports `ALLOW_DEV_DEFAULTS=true`).

### 4. Docker Compose as the production topology

**Chose:** Keep one `docker-compose.yml` (app + Postgres 16, named volumes `ttx_pg` / `ttx_media`, healthchecks). Image is multi-stage, Next standalone, non-root `nextjs`, `migrate deploy` on start. `SEED_DEMO` defaults false. Local `./run.sh docker` sets `SEED_DEMO=true` and `ALLOW_DEV_DEFAULTS=true`.

**Alternatives:** Split `docker-compose.prod.yml`; Kubernetes manifests; Vercel + Neon (paid / out of scope).

**Why:** The file already existed; adding a second compose file would drift. Hard rules: no paid services, no public deploy from this agent.

**Owner check:** Compose now requires `AUTH_SECRET` and `OPERATOR_PASSWORD` in `.env` (no weak defaults). TLS stays on a reverse proxy you provide. Postgres password `ttx` in compose is **dev-grade** — change it before a real production host (Needs owner).

### 5. Health: one route, two probes

**Chose:** `GET /api/health` liveness; `GET /api/health?ready=1` readiness with `SELECT 1`. `200` / `503`. No version, hostname, or error text.

**Alternatives:** `/api/ready`; always ping DB on `/api/health` (k8s would kill pods on DB blips).

**Why:** Orchestrators need a liveness signal that does not depend on Postgres. Unauthenticated by necessity for probes.

**Owner check:** Do not put this behind session auth. If you add a status page later, keep probe JSON boring.

### 6. Pino JSON logs, low-risk swap-in

**Chose:** `lib/logger.ts` (pino) with redaction of secrets, tokens, emails, answer `body`. Used in instrumentation, health (unready only), env failure still also `console.error` so a broken logger cannot swallow the message. Docker bootstrap logs JSON lines without importing pino (pino + thread-stream is awkward in the esbuild CLI bundle).

**Alternatives:** `pino-pretty` in dev; OpenTelemetry; replace every `console.log` in seed scripts.

**Why:** Seeds are CLI. Request logging of bodies would capture inject answers (threat model: High).

**Owner check:** Pipe production stdout to your log stack. Do not log invitation emails or TOTP material later without adding paths to the redact list.

### 7. Media `fs` warning

**Chose:** Default media path is `path.join(process.cwd(), "public", "media", rel)` (Turbopack can scope tracing to that subfolder). `MEDIA_ROOT` and the `fs` calls use `/*turbopackIgnore: true*/` because runtime uploads live on a volume, not in the image. `import "server-only"` remains; Vitest aliases it to an empty shim. Path helpers stay in `lib/media/paths.ts`. Did not change upload routes.

**Alternatives:** Turbopack `resolveAlias.fs.browser`; stop calling `persistStageAssets` from pages (upload lifecycle, owned by another agent); ignore comments only, without a static default path.

**Why:** Next 16.3 prints “Dynamic filesystem access causes tracing of the whole project” for `path.join(mediaRoot(), rel)` when `mediaRoot()` is env-dynamic. The documented fix is a cwd-scoped subfolder or `turbopackIgnore`.

**Owner check:** `next build` should no longer print that warning for `lib/media/fs.ts`. If upload-lifecycle work reintroduces a client import of `fs`, reject that import rather than aliasing `fs` away.

### 8. CI on all PRs + Docker build without push

**Chose:** `pull_request:` with no base filter so PRs onto `cursor/ttx-authoritative-scoring-ci-b3ae` run. Node 22. Extra job `docker build -t breachboard:ci` (no push, no registry).

**Alternatives:** Only `master`; postgres service + `migrate deploy` in CI (needs a DB).

**Why:** This PR’s base is not master. Image build is the cheapest proof the Dockerfile still compiles. `prisma validate` is cheap; a live migrate job is not.

**Owner check:** First Docker CI run is slow (no registry cache). If it times out, add Buildx cache, still without pushing images.

### 9. Backup scripts on the host, not in the app image

**Chose:** `scripts/backup.sh` / `restore.sh` using `pg_dump -Fc` / `pg_restore` via `docker compose exec` when the db service is up, plus a tar of media.

**Alternatives:** Sidecar container with `postgresql16-client`; WAL shipping; object-storage sync.

**Why:** No extra image, no paid backup product.

**Owner check:** Schedule these (cron). Restores are destructive. Test a restore on a copy before you need it.

## Needs owner

1. **Postgres password and published port 5433** in compose are fine for a lab, not for a network-exposed host. Change `POSTGRES_PASSWORD`, drop the host port publish, and put the DB on a private network.
2. **TLS and a reverse proxy** are not in this repo. Set `AUTH_URL` to the HTTPS origin.
3. **Baseline any existing db-push database** before the next schema migration (`migrate resolve --applied 20261009120000_baseline`).
4. **Rotate `OPERATOR_PASSWORD`** off `change-me` before a real engagement.
5. **Backup TTL and off-box copies** for IRP/CCMP and answers (threat model §3.4).
6. **Object storage (ADR-004 option B)** when you run more than one app replica; the media volume is single-node.
7. **CI Docker cache / registry** if the image job is too slow — still do not push from this agent.
8. **pino-pretty or a log drain** if operators dislike raw JSON in `docker compose logs`.
9. **Confirm `next build` stays clean** of the `lib/media/fs.ts` tracing warning after upload-lifecycle work; if a client import of `fs` returns, reject that import rather than adding a Turbopack empty alias.
