# Threat model — Tabletop TTX platform

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Method | STRIDE per trust boundary |
| Status | Draft — review before Slice B/D |

---

## 1. Assets

| Asset | Sensitivity |
|-------|-------------|
| IRP / CCMP files & extracted text | **Critical** — client confidential |
| Participant free-text answers | High — may contain internal process details |
| AI notes / debrief narratives | High |
| Account credentials / sessions | High |
| Inject narratives & ATT&CK mappings | Medium |
| Join codes | Medium — capability to find session if combined with auth gap |
| Score / leaderboard | Low–Medium |

---

## 2. Trust boundaries

```
[Browser Participant] ─┐
[Browser Facilitator] ─┼─ HTTPS ─► [Next.js App] ─► [Postgres]
[Stage Window]        ─┘                │
                                        ├─► [Object storage] (docs)
                                        └─► [LLM provider]
[Cron / retention job] ── secret ───────► [Next.js]
```

Assume: LLM provider is **semi-trusted** — data sent there may be logged per vendor policy → minimize excerpts; prefer vendor zero-retention where available.

---

## 3. STRIDE analysis

### 3.1 Spoofing

| Threat | Impact | Control |
|--------|--------|---------|
| Stolen session cookie runs injects | High | HTTP-only cookies; short session; Facilitator capability check server-side |
| Co-facilitator impersonation | Medium | Auth required; audit actor on mutations |
| Stage opened by unauthorized user | High | ADR-003: Stage requires Facilitator auth (v1) |

### 3.2 Tampering

| Threat | Impact | Control |
|--------|--------|---------|
| Participant PATCHes score | High | Score override Facilitator-only |
| Client sends answers for inactive team | High | Server re-check team/role on POST answer |
| Polluting inject id | Medium | Validate inject ∈ exercise document |
| Retention job without auth | Critical | Shared cron secret / Vercel cron auth |

### 3.3 Repudiation

| Threat | Impact | Control |
|--------|--------|---------|
| Denial of document upload/delete | High | `DocumentAuditEvent` immutable |
| Denial of score override | Medium | Store `overriddenById`, timestamp, comment |

### 3.4 Information disclosure

| Threat | Impact | Control |
|--------|--------|---------|
| Stage shows answers during answering | High | Phase gate `answering` vs `debrief` |
| Inactive user receives inject via API | High | Filter payload by participation state |
| Participant receives others’ answers | High | Existing canSeeAll gate; keep |
| IRP/CCMP downloaded by participant | Critical | Documents API Facilitator-only; no Stage body |
| Extracted plan text in LLM logs | Critical | Truncate; strip secrets; contract with provider; don’t send full PDF bytes if text extract suffices |
| Soft-deleted docs still in backups | Critical | Ops runbook: backup TTL ≤ or documented exception |
| Join code enumeration | Low | Auth still required to join content |

### 3.5 Denial of service

| Threat | Impact | Control |
|--------|--------|---------|
| Huge document upload | Medium | MIME allowlist, size cap (e.g. 25MB), rate limit |
| LLM cost blowup | Medium | Per-session rate limits; facilitator-only triggers |
| Poll storm | Low | Keep interval; later SSE |

### 3.6 Elevation of privilege

| Threat | Impact | Control |
|--------|--------|---------|
| Admin-only facilitates | High | FR-AUTH-01 server enforcement |
| Observer submits answer | High | Reject non-PARTICIPANT |
| Participant opens Controller UI | Medium | UI hide + API 403 |

---

## 4. Abuse cases (priority)

1. **Consultant leaves IRP in DB after engagement** → retention job + soft/hard delete + audit.  
2. **Zoom recording of Stage during debrief** → business process (warn facilitator); product cannot fully prevent.  
3. **Participant screenshares while inactive spoiler from Stage in room** → expected for room; laptop must stay inactive.  
4. **Prompt injection via answer text into debrief LLM** → system prompt hardening; don’t execute tools from answers; sanitize.

---

## 5. Control backlog by slice

| Slice | Must implement |
|-------|----------------|
| A | Server-side visibility & answer authorization; Facilitator≠Admin-only |
| C | Phase-aware Stage payload (no answers in answering) |
| B | Upload allowlist, authz, soft/hard delete, audit, size limits |
| D | LLM data minimization; override audit; debrief only in debrief phase |

---

## 6. Residual risks (accepted for v1)

- Facilitator account shared on projector PC.  
- Screen-share / room cameras capturing debrief answers.  
- LLM vendor subprocessors (document in privacy note for clients).  
- Mobile controller parked → no extra mobile threat surface yet.

---

## 7. Review sign-off

| Role | Date | ☐ |
|------|------|---|
| Stakeholder (data handling) | | |
| Engineering | | |
| Security reviewer (if any) | | |
