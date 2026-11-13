# User journeys — Tabletop Exercise Platform

Living product map for operators, facilitators, and players. Use with QA checklists and Playwright smoke paths.

## Personas

| Persona | Goal | Entry |
|---------|------|-------|
| **Operator (Admin)** | Onboard clients, generate scenarios, launch engagements | `/login` → Ops desk `/` |
| **Facilitator (Moderator)** | Seat people, go live, drive inject discuss → answer → debrief | `/sessions/[id]` + Present / Stage |
| **Participant** | Join, discuss, answer role questions, earn points | `/join` → `/sessions/[id]` |
| **Observer** | Watch live injects without answering | Seated as OBSERVER → `/sessions/[id]` |

## Status model

```
draft ──go live──▶ live ──end──▶ closed ──archive──▶ archived
                     ▲              │
                     └──── restore ─┘ (archived → closed)
```

- **runKind:** `engagement` (real client run; full role coverage required) vs `draft` (rehearsal; coverage bypassed)
- **phase (while live):** `idle` → `discuss` (~120s) → `answering` → `debrief`

---

## Journey A — Operator: first client engagement

**Story:** As an operator, I onboard a BFSI client, generate a SitMan, seat the room, and run a scored engagement.

| Step | User action | Expected | URL / API |
|------|-------------|----------|-----------|
| A1 | Sign in with operator credentials | Lands on Ops desk | `/login` → `/` |
| A2 | Create organization | Org appears in People / workspace picker | `/orgs` → `POST /api/orgs` |
| A3 | Select working org in sidebar | Engagements list scoped to that client | cookie `ttx-workspace-org` |
| A4 | Configure AI provider | Test succeeds; generate enabled | `/settings/ai` |
| A5 | Generate scenario from intel | Scenario with 5–6 injects saved | `/generate` → `POST /api/generate` |
| A6 | Review / edit injects & media | Changes persist on document | `/scenarios/[id]` |
| A7 | Start engagement for workspace org | Run appears under Active | `/sessions/engagements` |
| A8 | Seat moderator + playbook roles | Roster complete (or use invite links) | Session console seats API |
| A9 | Go live | Phase → discuss; Stage can open | `PATCH status=live` |
| A10 | Advance injects; end run | Closed tab shows run; Archive optional | Active → Closed → Archived |

**Acceptance:** Live engagement only after required roles seated; archived runs reject join.

---

## Journey B — Facilitator: live inject loop

**Story:** As a facilitator, I open Present, discuss for ~2 minutes, unlock questions, then move to the next inject.

| Step | User action | Expected |
|------|-------------|----------|
| B1 | Open session console | See roster, join code, status |
| B2 | Open Stage (projector) + Present | Stage shows inject narrative; Present has controls |
| B3 | Go live / next inject | Discuss timer starts; answers locked |
| B4 | Wait or “Open questions” | Phase → answering; participants can submit |
| B5 | Watch response progress | Completion chip updates |
| B6 | Next inject / debrief / end | Status closed; scoreboard frozen |

**Acceptance:** Answers rejected unless `live` + `answering`; standby teams cannot answer.

---

## Journey C — Participant: join and score

**Story:** As a player, I join with a code and name, wait through discuss, answer my role prompt, and see rank.

| Step | User action | Expected |
|------|-------------|----------|
| C1 | Log in (or claim invite) | Account available |
| C2 | Enter join code + name | Seated as PARTICIPANT; redirected to session |
| C3 | During discuss | See narrative + **Time remaining**; copy that answering opens automatically; no answer box |
| C4 | During answering | Role questions only; submit logs response |
| C5 | View score / rank | Personal points and rank label |

**Acceptance:** Closed/archived codes fail; scoring cues (`points`, `expectedAction`) never leak to client question payload.

---

## Journey D — Draft rehearsal

**Story:** As an operator, I open a draft run without a full roster to QA injects and media.

| Step | Expected |
|------|----------|
| Start from scenario “Open draft run” or Drafts page | `runKind=draft` |
| Go live without all roles | Allowed |
| Does not pollute Engagements Active metrics | Separate `/sessions/drafts` |

---

## QA smoke checklist (manual / E2E)

Automated Playwright:

```bash
# Production standalone server + Chromium (needs migrate/seed + npm run build)
npm run test:e2e

# Full facilitator + player POV with video → docs/qa/recordings/
npm run test:e2e:qa
```

Onboarding guide: [ONBOARDING.md](./ONBOARDING.md)

Manual / E2E coverage:
- [x] Login → Ops desk loads with metrics (setup + Journey A)
- [x] Engagements Active / Closed / Archived tabs (Journey A)
- [x] Draft go-live → discuss → Open questions → Present → End (Journey B)
- [x] Join unknown code → error (Journey C)
- [x] Player joins draft by code + name (Journey C)
- [x] Join closed session → error (Journey C)
- [x] QA POV recording (facilitator + guest) — `npm run test:e2e:qa`
- [x] Join archived session → error
- [x] Participant cannot see `expectedAction` / rubric (`points` stay on the player payload for the score UI — `docs/decisions/security.md` D3 + `docs/decisions/e2e.md`)
- [x] Observer cannot submit answers (UI + `POST /api/sessions/:id/answers`)
- [x] Happy path DEMO01: operator opens room, starts, player joins and answers, facilitator opens questions, debrief shows Strengths / Gaps
- [x] Cross-org session access denied
- [x] Honest scoring: empty rubric → Needs review / 0 pts; Mark score persists
- [x] Discuss → answering without the facilitator tab (server clock)
- [x] Admin PDF upload → Settings → Uploads; soft-delete hides file; `/api/media` 404
- [x] Security headers (CSP etc.) present; `GET /api/health?ready=1` → 200
- [x] Mobile: join + answer usable (`journey-ux.spec.ts`, 390×844 CSS px)
- [x] Tablet (768–1024): workspace rail collapsed; Open navigation restores it
- [x] Observer layout: Observing banner, view-only prompts, no submit chrome
- [x] Discuss countdown copy: “Time remaining” + “Answering opens automatically” (server flip)
- [x] Facilitator console + Stage + one participant stay open through one inject (`journey-ux.spec.ts`)

---

## UX backlog (from journey friction)

Priority order for easier use:

1. ~~**Default workspace org** when only one org exists; CTA from empty Engagements to `/orgs` or picker.~~ **Done** (auto sole-org + Engagements CTA).
2. ~~**Discuss-phase copy**~~ **Done** — “Time remaining” + “Answering opens automatically”; discuss hint on the inject.
3. ~~**Facilitator self-seat shortcut**~~ Already on create + “Seat myself as Facilitator” banner.
4. ~~**Present vs Stage** labels~~ **Done** — console button is **Open projector**.
5. ~~**Server-side discuss → answering**~~ **Done** (prior PR) — GET poll applies `discussExpiryWrite`; this PR does not add a client PATCH.
6. ~~**Anonymous / light join**~~ Name + code guest join; Advanced hides email/role card.
7. ~~**Observer layout**~~ **Done** — Observing banner, view-only prompts, no submit chrome.
8. **Meaningful scoring** (moderator mark / AI rubric) instead of submit = full points.
9. ~~**Responsive shell**~~ **Done** — rail overlays below 1280px; collapsed by default so 768–1024 stays usable.
10. **Fix “1 responses”** pluralization in progress chip.

---

## Related skills (installed in this repo)

| Skill | Source |
|-------|--------|
| `testing` | [nickperkins/testing](https://github.com/nickperkins/testing) |
| `e2e-playwright-testing` | [asyrafhussin/agent-skills](https://github.com/asyrafhussin/agent-skills) |
| `playwright-e2e` | [pramoddutta/qaskills](https://github.com/pramoddutta/qaskills) |
| `tester` | [elihuvillaraus/skills](https://github.com/elihuvillaraus/skills) |
| `testing-best-practices` | asyrafhussin/agent-skills |
| `writing-tests` / `adding-e2e-tests` | project agents skills |
