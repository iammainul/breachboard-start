# System architecture design

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | Draft |
| Related | BRD, FRS, ADRs |

---

## 1. Current baseline

| Layer | Choice |
|-------|--------|
| UI | Next.js 16 App Router, React 19, Tailwind v4 |
| Auth | NextAuth credentials (`OPERATOR_*` bootstraps Admin) |
| Data | PostgreSQL + Prisma |
| AI | Vercel AI SDK (`generateObject`) + optional Cursor SDK path |
| Deploy | Docker Compose (app + Postgres, `prisma migrate deploy` on start) or `./run.sh` local. Runbook: `docs/DEPLOY.md`. |

---

## 2. Target logical architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Clients                                                      │
│  Participant UI │ Facilitator Controller │ Stage window      │
└────────────┬─────────────┬───────────────────┬───────────────┘
             │             │                   │
             ▼             ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js App Router                                           │
│  RSC pages │ Client consoles │ Route Handlers (REST)         │
│  Auth middleware / session gates                             │
└────────────┬───────────────────────────────┬─────────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────┐         ┌────────────────────────────┐
│ PostgreSQL          │         │ Object storage (Slice B)   │
│ seats, teams,       │         │ IRP/CCMP blobs             │
│ answers, audits     │         │ + retention job            │
└─────────────────────┘         └────────────────────────────┘
                                             │
                                             ▼
                                ┌────────────────────────────┐
                                │ LLM providers (Slice D)    │
                                │ OpenAI/Anthropic/Cursor…   │
                                └────────────────────────────┘
```

---

## 3. Capability model (authorization)

Replace “Admin can do everything on sessions” with capabilities:

| Capability | Admin | Facilitator | Participant | Observer |
|------------|:-----:|:-----------:|:-----------:|:--------:|
| Manage orgs/people | ✓ | △ optional | | |
| Create teams / seat | | ✓ | | |
| Go live / release inject | | ✓ | | |
| Present mode | | ✓ | | |
| Upload IRP/CCMP | | ✓ | | |
| Override scores | | ✓ | | |
| Answer inject | | | ✓* | |
| View Stage (audience) | | ✓ opens | via projector | via projector |
| Read answers live | | ✓ | own only | inject-level watch policy |

\* Subject to active team + role/common rules.

**Implementation sketch:** `platformRole` + `sessionSeat.kind` + optional `UserCapability` / `isFacilitator` flag. Prefer explicit `FACILITATOR` platform role or org membership role — **ADR-001**.

---

## 4. Live session synchronization

**Today:** Client polls `GET /api/sessions/[id]` ~2.5s.

**Target (phased):**
- Slice A: keep polling; add team/visibility fields to payload.  
- Slice C+: consider SSE or short poll for Stage/Controller sync; server-authoritative `injectStartedAt` + `timerSeconds` for shared clock (**ADR-002**).

Session phases:

```
draft → live(answering) → live(debrief) → … → closed
              ▲                │
              └──── next inject ┘
```

`phase` enum on session: `idle | answering | debrief`.

---

## 5. Present mode topology

```
Facilitator browser
├── /sessions/[id]/control   ← Controller (primary)
└── window.open /sessions/[id]/stage  ← Stage (2nd screen or popup)
Co-facilitator browsers may also open /control (multi-controller)
```

Stage is a **read-mostly** view bound to session id + auth (Facilitator or public stage token — **ADR-003** prefers authenticated Facilitator-only Stage URL for v1; projector uses that machine’s login or shared facilitator account).

---

## 6. Document pipeline (Slice B)

1. Multipart upload → virus/size validation → store blob encrypted at rest if available.  
2. Extract text for LLM grounding (docx/pdf parsers).  
3. Soft-delete on `session.closedAt`.  
4. Cron/worker hard-deletes after `retentionDays`.  
5. `DocumentAuditEvent` immutable rows.

---

## 7. AI boundaries (Slice D)

| Job | Input | Output | Shown where |
|-----|-------|--------|-------------|
| Score notes | Answer + IRP/CCMP excerpts + rubric | Note + suggested points | Facilitator; not Stage live |
| Debrief narrative | All answers (aggregated) + plans | Gaps/strengths prose | Stage in debrief |
| Scenario generate | Existing generate flow | Exercise JSON | Admin/Facilitator authoring |

---

## 8. Slice A engineering plan (no code until go)

1. Prisma: `SessionTeam`, `SessionTeamMember`, inject `activeTeamIds`, question `common` + roles[].  
2. Access helpers: `canFacilitate(user, session)`.  
3. API payload: `participationState`, visible questions.  
4. UI: inactive panel; facilitator team manager.  
5. Tests: authz matrix + visibility matrix.

---

## 9. Open design decisions → ADRs

- ADR-001 Facilitator role modeling  
- ADR-002 Shared clock authority  
- ADR-003 Stage authentication  
- ADR-004 Document storage backend  
