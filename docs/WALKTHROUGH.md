# Breachboard walkthrough

First live hour: sign in, pick the demo bank, rehearse a room, then (optional) run a generated engagement.

Docker: http://localhost:3080 · local: http://localhost:3000  
Sign in: `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` (defaults `operator@local` / `change-me`).

## 1. Sign in and set the desk

1. Open `/login`.
2. Sign in. You land on **Control**.
3. In the rail, confirm **Workspace → Northline Bank**. If the list is empty, create the org under Organizations or seed the demo (`npx tsx scripts/seed-demo.ts`).
4. Click the sun/moon if you need Toxic Phosphor Day. That control lives on the rail, not in Settings.
5. Open **Account** (your name in the rail). Set the name that should appear as facilitator, then return to Control.

## 2. Know the demo room

| Room | Join code | What it is |
|------|-----------|------------|
| Operation PhishGate | **DEMO01** | Seeded demo, six injects, six seated demo players |

## 3. Rehearse PhishGate (DEMO01)

1. Rail → **Engagements**.
2. Open **Operation PhishGate** (code DEMO01).
3. Confirm the roster (CISO, SOC, IT Ops, Legal, Comms, BCP).
4. **Start exercise**. Discuss starts. Share DEMO01 with a second browser if you want a player view (`/join`).
5. **Open questions**.
6. **Open projector** (Present). Check:
   - Slim **Present** chrome with Live / Discuss and the countdown
   - Inject map on the left
   - Stage card beside the narrative
   - Compact squad QR and presence on the right
7. **Open Stage** if you have a second display. Drag that window to the projector.
8. **Release next inject** through the map, or **End exercise** when you are done.

Draft runs (Engagements is for client rooms; **Draft runs** is for QA) skip full role coverage so you can start alone.

## 4. Player view (optional second window)

1. Private window → `/join`.
2. Name: how you want to show on the roster. Code: **DEMO01**.
3. **Join squad**. You should appear under Squad presence on Present.
4. Wait through discuss, then submit when questions open.

## 5. Generate your own pack (optional)

1. **Settings → AI providers**. Gemini or Ollama must show Ready. Test the default.
2. **Generate**. Pick a sector (BFSI, government, energy, healthcare, and others), org Northline Bank, add stack notes (Finacle, UPI, SWIFT, vendor SOC).
3. Wait for the draft. Review injects and media.
4. **Accept** for Northline Bank.
5. **Engagements → Start engagement**.

## 6. After the run

- Closed rooms sit on Engagements → **Closed**. Archive when you no longer need joins.
- Report is on `/sessions/[id]/report` after close.
- Sign out from **Account** in the rail.

## If something blocks you

| Symptom | What to try |
|---------|-------------|
| Control says pick an organization | Workspace menu — select Northline Bank |
| Cannot go live | Seat yourself as Facilitator |
| Generate fails | Settings → AI → Test; confirm Ready |
| Player cannot join | Code is live/draft, not closed; name is filled |
| Present looks clipped | Present is full-viewport; use the session **Present** route, not a nested article |

Full reference: [USER-MANUAL.md](./USER-MANUAL.md).
