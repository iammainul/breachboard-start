# Data model design

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | Draft — target model |

---

## 1. Current entities (keep)

`Organization`, `User`, `Exercise` (JSON document), `ExerciseSession`, `SessionSeat`, `InjectAnswer`, ATT&CK/intel tables.

Exercise injects/questions live in `Exercise.document` JSON (Zod `exerciseDocumentSchema`).

---

## 2. Target additions

### 2.1 SessionTeam (Slice A)

```
SessionTeam
  id
  sessionId → ExerciseSession
  name
  createdAt
```

### 2.2 SessionTeamMember (Slice A)

```
SessionTeamMember
  id
  teamId → SessionTeam
  userId → User
  @@unique([teamId, userId])
  @@unique([sessionId, userId])  -- one team per user per run
```

*(sessionId denormalized or enforced via team.sessionId uniqueness.)*

### 2.3 SessionSeat adjustments (Slice A)

- `kind`: continue `MODERATOR` **or rename display to Facilitator**; map MODERATOR ≡ Facilitator in product language.  
- Optional `teamId` FK for quick lookup (nullable until onboarded).

### 2.4 Exercise document schema (Slice A)

Per inject:

```ts
{
  id, sequence, title, body, timerSeconds, techniqueIds,
  activeTeamKeys: string[],   // team ids OR stable keys resolved at runtime
  // migration: empty/missing => all teams active (compat) OR single default team
  questions: [{
    roleId?: string,          // legacy
    roleIds?: string[],       // preferred
    common?: boolean,         // default false
    prompt, expectedAction, points
  }]
}
```

Runtime resolves `activeTeamKeys` against `SessionTeam` records for that session.

### 2.5 ExerciseSession (Slice C+)

```
phase: 'idle' | 'answering' | 'debrief'
currentInjectStartedAt: DateTime?
```

### 2.6 SessionDocument (Slice B)

```
SessionDocument
  id, sessionId, uploadedById
  kind: 'IRP' | 'CCMP' | 'OTHER'
  filename, mimeType, storageKey
  retentionDays Int @default(14)
  softDeletedAt DateTime?
  hardDeletedAt DateTime?
  contentSha256
  extractedText (nullable, cleared on hard-delete)
  createdAt
```

### 2.7 DocumentAuditEvent (Slice B)

```
id, documentId?, sessionId, actorId, action, at, meta Json
-- actions: UPLOADED | SOFT_DELETED | HARD_DELETED | DOWNLOADED | TEXT_EXTRACTED
```

### 2.8 InjectAnswer extensions (Slice D)

```
autoPoints Int?
awardedPoints Int?
aiNotes String?
overrideComment String?
overriddenById String?
overriddenAt DateTime?
```

---

## 3. Visibility algorithm (normative)

```
function participation(user, session, inject, teams, seat):
  if seat.kind == OBSERVER: return { state: 'observer', canSee: true/false per policy, canAnswer: false }
  if seat.kind != PARTICIPANT: return facilitator paths
  team = teamOf(user, session)
  if team is null OR team.id not in inject.activeTeamIds:
    return { state: 'inactive', canSee: false, canAnswerQuestions: [] }
  visibleQs = inject.questions
  answerable = visibleQs.filter(q =>
    q.common === true || roleMatches(seat.playbookRoleId, q)
  )
  return { state: 'active', canSee: true, answerable }
```

---

## 4. Migration strategy

1. Add tables nullable / empty.  
2. For legacy sessions: create default team “All participants”, assign all PARTICIPANT seats, set every inject `activeTeamKeys = [default]`.  
3. Map legacy `questions[].roleId` → `roleIds: [roleId]`, `common: false`.

---

## 5. Indexes

- `SessionTeam(sessionId)`  
- `SessionTeamMember(userId, teamId)`  
- `SessionDocument(sessionId, softDeletedAt)`  
- `DocumentAuditEvent(sessionId, at)`  

---

## 6. ER sketch

```
Organization 1──* User
Organization 1──* ExerciseSession
Exercise 1──* ExerciseSession
ExerciseSession 1──* SessionSeat ── User
ExerciseSession 1──* SessionTeam 1──* SessionTeamMember ── User
ExerciseSession 1──* InjectAnswer ── User
ExerciseSession 1──* SessionDocument 1──* DocumentAuditEvent
```
