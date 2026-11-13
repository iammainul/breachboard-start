# SDLC gate checklist

Slices A–D application code is already in tree (explicit go 2026-09-05). **Current gate: Operate / Release** — production deployability.

Stacked PRs (not `master` until this lands): **#1 → #3 → #2 → #4 → #5 → #6**. **#3 and #4 must ship with #5** (`/api/health` public-path + HTTPS-only HSTS). Review checklist: [`docs/PRODUCTION-READINESS.md`](./PRODUCTION-READINESS.md). Runbook: [`docs/DEPLOY.md`](./DEPLOY.md).

## Phase complete?

- [x] Discovery notes (`.cursor/notes/…`)
- [x] BRD drafted (`docs/01-brd.md`)
- [x] FRS drafted (`docs/02-frs.md`)
- [x] System / data / UX / API design drafted (`docs/design/`)
- [x] Threat model drafted (`docs/security/01-threat-model.md`)
- [x] ADRs proposed (`docs/decisions/`)
- [x] Slice A–D product code (live TTX)
- [x] Production foundation runbook (`docs/DEPLOY.md`, `docs/decisions/foundation.md`)
- [x] Stacked Operate/Release PRs #1–#6 (pending owner merge)

## Acceptance (human)

- [x] Stakeholder accepts BRD (2026-09-05 — “seems fine”)
- [x] Stakeholder accepts FRS Slice A (same)
- [x] Threat model reviewed at draft level (same)
- [x] ADR-001..004 accepted as proposed baseline (same)
- [x] Explicit **go** for Slice A (2026-09-05)
- [ ] Owner accepts production foundation and the **Needs Mainul** list in [`docs/PRODUCTION-READINESS.md`](./PRODUCTION-READINESS.md)

### Accepted with deferral

- **Present / Stage mode** (`FR-PRES-*`, UX design §3): baseline is OK; **expect further modifications later**. Treat Stage specs as **directional**, not final pixel/flow lock.
- **ADR-004 object storage:** local/volume for single-node Docker; S3-compatible when running more than one replica.

## Development rule

Product code is in motion. Do not collide on API route authz or upload lifecycle unless that is your assigned slice.

New schema: `prisma migrate dev` locally, `migrate deploy` in production — never `db push`. No secrets in git. Do not merge or deploy from stacked-PR agents.
