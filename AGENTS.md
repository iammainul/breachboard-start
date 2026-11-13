<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Breachboard — tabletop exercise platform

Live gamified cyber TTX for onboarded organizations. Operators generate scenarios from ATT&CK/CVE intel; moderators drive injects; participants answer role-specific questions and earn points.

## Commands

| Command | Purpose |
|---------|---------|
| `./run.sh` / `npm run run` | Start dev (Postgres + seed + Next.js on :3000) |
| `./run.sh docker` | Full Docker stack on :3080 |
| `npm run attack:seed` | Seed minimal ATT&CK data |
| `npx prisma migrate deploy` | Apply migrations (production / `./run.sh`) |
| `npx prisma migrate dev` | Create a migration locally |

## Architecture

- **Hub** (`app/page.tsx`) — admin command center or participant mission list
- **Session console** (`components/session-console.tsx`) — live inject UI, timer, scoring, roster
- **Generate** (`app/api/generate/route.ts`) — AI scenario from intel via `generateObject`
- **Auth** — first login with operator credentials creates ADMIN user

## Cursor integration options

This repo is set up for **Cursor IDE** via `.cursor/rules/` (design + project context). Other integrations:

1. **IDE rules (done)** — agents follow TTX domain and design system automatically
2. **Cursor Automations** — scheduled agents for CI, PR review, or intel sync (configure in Cursor Automations editor)
3. **Cursor SDK** — programmatic agents from scripts/CI (`CURSOR_API_KEY`); best for repo automation, not in-app scenario generation (app uses AI SDK providers instead)

When adding features, prefer extending existing patterns in `components/game-ui.tsx`, `lib/game-score.ts`, and `lib/schema/exercise.ts`.
