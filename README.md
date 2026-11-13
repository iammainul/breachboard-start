# Breachboard

Operator app that generates CISA-style tabletop exercises from MITRE ATT&CK groups, CVEs, and pasted regulator advisories. Living brand spec at `/brand`. Portable liquid-glass cookbook for sibling apps: [`design/DESIGN.md`](design/DESIGN.md).

## Quick start

**Local dev (recommended for hacking):**

```bash
chmod +x run.sh   # first time only
./run.sh
# or: npm run run
```

App: http://localhost:3000 — sign in with `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` from `.env.local`.

**Full stack in Docker:**

```bash
./run.sh docker
# or: npm run run:docker
```

App: http://localhost:3080 (3080 avoids a busy host :3000). Uses `.env` for credentials and LLM keys.

The run script creates the env file from `.env.example` if missing and generates `AUTH_SECRET` when still set to the placeholder.

**Onboarding & QA**

- User manual: [docs/USER-MANUAL.md](./docs/USER-MANUAL.md)
- First-hour walkthrough: [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)
- Short onboarding: [docs/ONBOARDING.md](./docs/ONBOARDING.md)
- Journeys / checklist: [docs/USER-JOURNEY.md](./docs/USER-JOURNEY.md)
- Chromium E2E (production standalone server): `npm run test:e2e` — [docs/decisions/e2e.md](./docs/decisions/e2e.md)
- Recorded engagement POV: `npm run test:e2e:qa` → [docs/qa/recordings/](./docs/qa/recordings/)
- Production deploy: [docs/DEPLOY.md](./docs/DEPLOY.md)

## Manual setup

1. Copy `.env.example` to `.env.local` (dev) or `.env` (Docker) and set operator credentials plus at least one LLM key if you want generation.
2. Start Postgres: `npm run db:up` (host port **5433**)
3. `npx prisma generate && npx prisma migrate deploy`
   (existing db-push databases: `npx prisma migrate resolve --applied 20261009120000_baseline` first — [docs/DEPLOY.md](./docs/DEPLOY.md))
4. `npm run attack:seed`
5. `npm run dev` → http://localhost:3000
