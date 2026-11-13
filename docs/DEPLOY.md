# Deploy Breachboard

Self-hosted production runbook. The supported path is **Docker Compose** (app + Postgres). Do not put real secrets in git.

Related: [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) (owner checklist + merge order), [GATE.md](./GATE.md), [decisions/foundation.md](./decisions/foundation.md), [decisions/uploads.md](./decisions/uploads.md), [ONBOARDING.md](./ONBOARDING.md).

## Prerequisites

- Docker Engine with Compose v2
- `openssl` (to mint `AUTH_SECRET`)
- Optional on the host: `pg_dump` / `pg_restore` if you backup without `docker compose exec`
- A hostname and TLS terminator (nginx, Caddy, or a load balancer) in front of the app. Next.js should not be the public TLS endpoint. Forward `X-Forwarded-Proto: https` (or set `AUTH_URL=https://…`) so the app emits HSTS; it will not pin HTTPS on plain HTTP.

Recommended host sizing for a single tabletop room (20–100 seats): 2 vCPU, 4 GB RAM, 20 GB disk plus media volume growth.

## Environment variables

Copy `.env.example` to `.env` on the host. Next.js dev uses `.env.local`; Compose and the Prisma CLI use `.env`. `./run.sh` creates the file for the mode you pick and fills `AUTH_SECRET` when it is still the placeholder.

| Variable | Required in production | Notes |
|----------|------------------------|--------|
| `DATABASE_URL` | yes | Compose overrides this to the `db` service. Include `connection_limit` when you set it yourself. |
| `AUTH_SECRET` | yes | ≥ 32 characters, unique. `openssl rand -base64 32`. Placeholders are rejected at startup. |
| `AUTH_URL` | yes | Public origin, e.g. `https://ttx.example.com`. |
| `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` | yes | First sign-in creates the ADMIN user. `change-me` is rejected in production. |
| `MEDIA_ROOT` | compose sets `/data/media` | Default on the host is `./data/media` (outside `public/`, so IRP/CCMP is not statically served). Compose volume `ttx_media` mounts `/data/media`. Back up this directory. Local leftover files under `public/media` cannot bypass `/api/media` (`beforeFiles` rewrite). |
| `ALLOW_DEV_DEFAULTS` | must be unset/false | Local `./run.sh docker` sets `true`. |
| `SEED_DEMO` | optional, default false | Seeds the fictional DEMO01 org. Keep false in production. |
| `LOG_LEVEL` | optional | `info` (default in production) or `debug`. |
| `DOCUMENT_RETENTION_SWEEP_MS` | optional | In-app IRP/CCMP hard-delete interval, milliseconds, min `60000`. Compose defaults to `3600000` (1 hour). Unset in non-compose deploys turns the loop off. |
| `RETENTION_CRON_SECRET` | recommended if you use the HTTP trigger | Bearer / `x-retention-secret` for GET or POST `/api/internal/retention/run`. Alias: `CRON_SECRET`. Empty secret → 401. Compared in constant time; rate limited. Not printed at startup. |
| `RATE_LIMIT_*` | optional | In-memory caps. Login is per IP+account (10/15m); join is per IP+code (80/2m) plus per-IP 120/2m. See `.env.example` and `docs/decisions/security.md` D2. |
| LLM / SMTP / `NVD_API_KEY` | optional | Portal `/settings/ai` and `/settings/email` can store these instead. |

Startup validation lives in `lib/env.ts` and runs from `instrumentation.ts`. Failures print field names only — never values.

## First deploy

```bash
./scripts/deploy.sh
```

That writes `.env` from `.env.example` when it is missing, fills `AUTH_SECRET`, `OPERATOR_PASSWORD`, `RETENTION_CRON_SECRET`, and `POSTGRES_PASSWORD` when they are still placeholders, then starts a Compose project named `breachboard`. Postgres is not published. The app listens on `127.0.0.1:3080` only. `ALLOW_DEV_DEFAULTS` and `SEED_DEMO` are forced off. This does not use the local `./run.sh docker` project, so a laptop demo stack can stay up until port 3080 is free.

```bash
./scripts/deploy.sh --rebuild    # pull base images and rebuild
./scripts/deploy.sh --baseline   # once, if this database was created with prisma db push
```

Confirm:

- `curl -sf http://127.0.0.1:3080/api/health` → `{"status":"ok","live":true}`
- `curl -sf http://127.0.0.1:3080/api/health?ready=1` → `ready: true`

Then put TLS in front of `127.0.0.1:3080`, set `AUTH_URL` to that `https://` origin, and strip client-supplied `X-Forwarded-Proto` at the proxy. Sign in as the operator and set AI providers in `/settings/ai` if you generate scenarios.

The container entrypoint runs `prisma migrate deploy`, then seeds ATT&CK and library templates **only when those tables are empty**. Demo org seed runs only when `SEED_DEMO=true`.

## Migrations

Schema changes ship as SQL under `prisma/migrations/`. Production applies them with **`prisma migrate deploy`** (the image does this on start). Locally, create new migrations with **`prisma migrate dev`** (`npm run db:migrate`).

```bash
# Local / CI-style apply (no prompts)
npx prisma migrate deploy

# Create a new migration while hacking on schema.prisma
npx prisma migrate dev --name add_whatever
```

### Existing `prisma db push` databases

If the database was created with `db push`, tables exist but `_prisma_migrations` does not. `migrate deploy` exits with **P3005**. Baseline once — this records the current schema as already applied; it does **not** re-run the SQL. On the production Compose project, `./scripts/deploy.sh --baseline` does this on the next boot. By hand:

```bash
npx prisma migrate resolve --applied 20261009120000_baseline
npx prisma migrate deploy
```

`./run.sh` (dev/reseed) does this automatically when it sees P3005. The production image does **not**; operators must baseline deliberately.

`./run.sh clean` uses `prisma migrate reset --force` (destroys data).

## Health checks

| Probe | URL | Success |
|-------|-----|---------|
| Liveness | `GET /api/health` | `200` `{ "status": "ok", "live": true }` |
| Readiness | `GET /api/health?ready=1` | `200` with `ready: true`; `503` if Postgres is down |

Responses omit versions, hostnames, connection strings, and error text. Compose and the Dockerfile use these probes. Point an orchestrator liveness probe at `/api/health` and readiness at `?ready=1`.

## IRP/CCMP retention sweep

Closed engagements soft-delete client plans; a later hard-delete removes file bytes and extracted text. See [decisions/uploads.md](./decisions/uploads.md). Three ways to run the same idempotent job (`runRetentionSweep`):

| How | When to use |
|-----|-------------|
| **In-app interval** | Default for Docker Compose. `instrumentation.ts` starts a loop when `DOCUMENT_RETENTION_SWEEP_MS` ≥ 60000. Compose sets `3600000`. Logs go through `lib/logger.ts` (JSON). |
| **Host cron + CLI** | If the Node process is not always running, or you want an external clock. `docker compose exec app node -e` is not the CLI — use the image’s `tsx` path or run `npm run retention:sweep` from a checkout that can reach `DATABASE_URL` and `MEDIA_ROOT`. Example crontab (hourly): `0 * * * * cd /opt/breachboard && npm run retention:sweep`. |
| **HTTP trigger** | `GET` or `POST /api/internal/retention/run` with `Authorization: Bearer $RETENTION_CRON_SECRET` or header `x-retention-secret`. Empty secret is always 401. Use this from a host cron `curl` if you do not want the in-app loop. |

Compose already enables the in-app loop. You do **not** need host cron as well unless you turn the interval off (`DOCUMENT_RETENTION_SWEEP_MS=` empty in `.env`). Running both is safe (the sweep is idempotent) but doubles I/O.

Set `RETENTION_CRON_SECRET` in production even if you only use the in-app loop, so the HTTP route cannot be called without a secret. Generate with `openssl rand -base64 32`. Never commit the value.

Hard-delete does not erase Postgres backups or the media volume snapshots — keep backup TTL in line with the threat model.

## Backup and restore

```bash
./scripts/backup.sh                  # local ./run.sh docker project
./scripts/backup.sh --prod           # the breachboard project from deploy.sh
./scripts/backup.sh --prod /mnt/backups/run1
./scripts/restore.sh --prod /mnt/backups/run1
```

Each backup contains `postgres.dump` (pg_dump custom format), `media.tar.gz` (uploads / generated stage boards), and `manifest.txt`. Restore overwrites the live database and media. After restoring a db-push-era dump, baseline migrations as above.

Keep backup TTL in line with the threat model (IRP/CCMP and answer text live in these archives).

## Upgrade

1. Take a backup.
2. `git fetch` and check out the release tag/commit.
3. `docker compose build && docker compose up -d`.
4. Confirm `/api/health?ready=1` and a facilitator login.
5. Migrations run on container start. If deploy fails, the previous image is still on disk — do not delete it until the new one is healthy.

## Rollback

1. `docker compose down` (volumes stay).
2. Check out the previous release and `docker compose up -d --build`.
3. If a migration already applied and is not backwards compatible, restore the matching backup instead of hoping SQL rolls back.

Postgres data: volume `ttx_pg`. Media: volume `ttx_media`. Removing volumes is destructive.

## Local development vs this runbook

| | Dev | Production compose |
|---:|-----|--------------------|
| Command | `./run.sh` | `./scripts/deploy.sh` |
| App URL | http://localhost:3000 | http://localhost:3080 (or your `AUTH_URL`) |
| Schema | `migrate deploy` (+ auto-baseline) | `migrate deploy` only |
| Demo org | seeded | off unless `SEED_DEMO=true` |
| Env file | `.env.local` | `.env` |
