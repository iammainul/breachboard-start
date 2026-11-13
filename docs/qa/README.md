# QA recordings & engagement rehearsal

## Run the recorded engagement POV

Requires Postgres (e.g. `docker compose up -d db`) and env from `.env` / `.env.local`.

```bash
npm run test:e2e:qa
```

Playwright CI (`npm run test:e2e`) runs Chromium against a production `next build` + the standalone server (`scripts/start-web-e2e.sh`) with `prisma migrate deploy` and the DEMO01 seed. See `docs/decisions/e2e.md`.

This QA recording command:

1. Builds if `.next` is missing, then starts production Next.js on port **3010**
2. Logs in as the operator
3. Creates a **draft** rehearsal session
4. Joins a guest player by join code + name
5. Starts exercise → discuss → open questions → open projector → end
6. Copies the newest Playwright `.webm` to this folder

### Artifacts

| File | Contents |
|------|----------|
| `recordings/qa-engagement-pov.webm` | Facilitator POV video |
| `recordings/qa-engagement-pov.json` | Source path + timestamp |
| `test-results/` | Raw Playwright videos, traces, step screenshots |

Videos are local artifacts (gitignored `*.webm`). Re-run the command after product changes.

## Manual QA checklist (short)

- [ ] Operator lands on Control with an org selected (auto if only one)
- [ ] `/join` asks for name + code; Advanced hides email/role card
- [ ] Draft: Start → Open questions → Open projector → End
- [ ] Guest join appears on the roster
- [ ] Closed code rejects new joins

Full journeys: [../USER-JOURNEY.md](../USER-JOURNEY.md)  
Onboarding: [../ONBOARDING.md](../ONBOARDING.md)

## Other E2E

```bash
npm run test:e2e          # journeys A–C (no always-on video)
npm run test:e2e:ui       # Playwright UI mode
```
