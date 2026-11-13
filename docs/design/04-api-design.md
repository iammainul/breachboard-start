# API design (target)

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Style | Existing Next.js Route Handlers under `/app/api` |

All mutating routes MUST check session auth + capability (see architecture §3).

---

## 1. Session read (extend)

`GET /api/sessions/[id]`

Add to JSON:

```ts
{
  phase: 'idle' | 'answering' | 'debrief',
  currentInjectStartedAt: string | null,
  teams: { id, name, memberUserIds: string[] }[],
  myParticipation: {
    state: 'inactive' | 'active' | 'observer' | 'facilitator',
    teamId: string | null,
    canSeeInject: boolean,
    answerableQuestionKeys: string[]  // roleId+prompt hash or question id
  },
  currentInject: { ... , activeTeamIds: string[], questions: Question[] } | null,
  completion: { answered: number, expected: number, pendingUserIds?: string[] }
  // pendingUserIds only if canFacilitate
}
```

Question payloads for participants: strip `expectedAction` unless facilitator.

---

## 2. Teams (Slice A)

| Method | Path | Actor | Body |
|--------|------|-------|------|
| GET | `/api/sessions/[id]/teams` | Facilitator+ | |
| POST | `/api/sessions/[id]/teams` | Facilitator | `{ name }` |
| PATCH | `/api/sessions/[id]/teams/[teamId]` | Facilitator | `{ name }` |
| DELETE | `/api/sessions/[id]/teams/[teamId]` | Facilitator | |
| PUT | `/api/sessions/[id]/teams/[teamId]/members` | Facilitator | `{ userIds: string[] }` |

---

## 3. Session control (extend PATCH)

`PATCH /api/sessions/[id]`

```ts
{
  status?: 'live' | 'closed' | 'draft',
  currentInjectId?: string | 'next',
  phase?: 'answering' | 'debrief' | 'idle'
}
```

Rules:
- Only Facilitator.  
- Setting `currentInjectId` sets `phase=answering`, `currentInjectStartedAt=now()`.  
- `phase=debrief` allowed when Facilitator requests (optionally require completion threshold — product default: facilitator discretion).

---

## 4. Answers (extend)

`POST /api/sessions/[id]/answers`

Reject if:
- Not participant  
- Inactive team  
- Question not answerable for role  
- phase ≠ answering (optional harden)

Slice D PATCH for override:

`PATCH /api/sessions/[id]/answers/[answerId]`  
`{ awardedPoints, overrideComment }` — Facilitator only.

---

## 5. Documents (Slice B)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/sessions/[id]/documents` | multipart; `kind`, `retentionDays` |
| GET | `/api/sessions/[id]/documents` | metadata only; no bytes for participants |
| DELETE | `/api/sessions/[id]/documents/[docId]` | soft-delete early |
| GET | `/api/internal/retention/run` | cron secret; hard-delete due docs |

---

## 5b. AI settings + intel auto-onboard + library

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/settings/ai` | Admin; provider readiness + sync timestamps |
| POST | `/api/settings/ai/complete` | Admin; mark onboarded, seed library, sync advisories |
| POST | `/api/intel/auto-onboard` | Admin; `{ force?: boolean }` CISA KEV + RSS |
| GET | `/api/library` | Admin; `?kind=scenario_pack|inject_pack|all&tag=` |
| POST | `/api/library/[key]/clone` | Admin; `{ organizationId? }` → new Exercise |
| POST | `/api/scenarios/[id]/injects/regenerate` | Admin; `{ injectId, guidance?, provider? }` |
| POST | `/api/scenarios/[id]/injects/replace` | Admin; `{ injectId, replacement }` |
| POST | `/api/join` | Authed; `{ code }` seat or lobby |
| GET | `/api/users/template` | Admin; XLSX download |
| POST | `/api/users/import` | Admin; multipart `file` CSV/XLSX |

See `docs/design/05-intel-library.md`.

---

## 6. AI (Slice D)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/sessions/[id]/answers/[id]/ai-notes` | generate/store AI notes |
| POST | `/api/sessions/[id]/debrief` | generate Stage narrative for current inject |

---

## 7. Error contract

```ts
{ error: string, code?: 'FORBIDDEN' | 'INACTIVE' | 'PHASE' | 'VALIDATION' }
```

HTTP: 401 unauthenticated, 403 forbidden/inactive, 409 phase conflict, 400 validation.
