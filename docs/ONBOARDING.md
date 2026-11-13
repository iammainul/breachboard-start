# User onboarding guide

Short path from first login to a live rehearsal. Full reference: [USER-MANUAL.md](./USER-MANUAL.md). Timed first hour: [WALKTHROUGH.md](./WALKTHROUGH.md). Journeys and QA: [USER-JOURNEY.md](./USER-JOURNEY.md).

## Who you are

| You | What you do | Start here |
|-----|-------------|------------|
| **Operator** | Onboard clients, generate scenarios, launch runs | `/login` |
| **Facilitator** | Drive injects, open projector, end the run | Session console |
| **Player** | Join with code + name, answer when your team is active | `/join` |

Players do **not** need accounts. Facilitators and operators sign in once.

---

## Operator — first 15 minutes

1. **Sign in** at `/login` with the operator email/password from `.env` / `.env.local`.
2. **Land on Control.** If you have only one organization, it is selected automatically. Otherwise pick a client in the sidebar **Organization** menu.
3. **Onboard a client** (if needed): Admin → Organizations → create org (sector, notes).
4. **Optional demo room:** from the repo root run `npx tsx scripts/seed-demo.ts`. Join code **`DEMO01`**, facilitator already seated.
5. **AI (for generate):** Settings → AI → pick a provider and test. Skip if you only run library / seeded scenarios.
6. **Account** in the rail is your name (profile, password, 2FA) and Sign out — same row style as Play.
7. **Generate or reuse a scenario:** Admin → Generate, or open Scenarios / Library.
8. **Rehearse first:** Engagements → Draft runs → open a draft → **Start exercise**. Drafts skip full role coverage so you can QA injects alone.
9. **Real engagement:** Accept the scenario for the org, then Engagements → Start engagement. Seat playbook roles (or send invite links) before go-live.

Creating a run seats **you** as Facilitator automatically when your account can facilitate.

---

## Facilitator — live loop

1. Open the session console (`/sessions/[id]`). Confirm join code on screen.
2. Share the code (or QR / invite links) with players.
3. **Start exercise** → discuss window (~2 minutes).
4. **Open questions** when the room is ready.
5. **Open projector** → controller + Stage for the room display.
6. **Release next inject** or **End exercise** when done.

If you see “Seat myself as Facilitator”, click it — Admin without a moderator seat cannot go live.

---

## Player — join in under a minute

1. Open `/join` (or `/join/DEMO01` style deep link).
2. Enter **your name** and the **join code**.
3. Leave Advanced closed unless you were emailed an invite or role card.
4. **Join squad** → you land in the session.
5. During discuss: watch the inject. During answering: submit your role’s response when your team is active.

Closed or archived codes are rejected.

---

## Access rules (simplified)

| Action | Who |
|--------|-----|
| Create orgs, people, generate scenarios | Admin |
| Start draft / engagement | Admin |
| Go live, advance injects, score | Facilitator seat (MODERATOR) |
| Answer inject questions | Participant seat, live + answering, active team |
| Watch only | Observer seat |

Workspace cookie `ttx-workspace-org` scopes Engagements and Control metrics to one client. Sole org is auto-selected.

---

## Demo credentials (local / Docker)

| Role | Credential |
|------|------------|
| Operator | `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` (default `operator@local` / `change-me`) |
| Demo join | Code **`DEMO01`** after Northline Bank seed |
| Demo players | `*@demo.local` / `Demo@Tabletop1` (passworded accounts for invite testing) |

Docker: `./run.sh docker` → http://localhost:3080  
Local dev: `./run.sh` → http://localhost:3000  
Production: [DEPLOY.md](./DEPLOY.md)  

---

## Recorded QA walkthrough

Automated facilitator + player POV (with video):

```bash
npm run test:e2e:qa
```

Recording path: [`docs/qa/recordings/qa-engagement-pov.webm`](./qa/recordings/qa-engagement-pov.webm)  
Details: [qa/README.md](./qa/README.md)
