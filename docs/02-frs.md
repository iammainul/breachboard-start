# Functional Requirements Specification (FRS)

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | **Accepted (2026-09-05)** — `FR-PRES-*` baseline only; revise before Slice C |
| Related | [01-brd.md](./01-brd.md) |

Priority: **P0** = Slice A must-have · **P1** = later slices · **P2** = backlog

---

## 1. Actors

- `Admin`, `Facilitator`, `Participant`, `Observer`  
- Platform role ≠ session seat: a user may be platform Admin and still need Facilitator capability to run a live session.

### FR-AUTH-01 — Facilitator capability (P0)
System SHALL distinguish **Admin** (org/people) from **Facilitator** (live run).  
System SHALL allow Facilitator∪Admin.  
System SHALL deny go-live / inject release / Present mode controls to Admin-only users.

### FR-AUTH-02 — Observers (P0)
Observers SHALL see session context permitted to watchers but SHALL NOT submit answers.

---

## 2. Organizations & people

### FR-ORG-01 (P0)
Admin SHALL create organizations (client tenants-in-app).

### FR-ORG-02 (P1 — bulk upload)
Admin or Facilitator SHALL upload participants with roles (CSV/file TBD in design).  
*Slice A may keep manual seating if upload slips; track as P1.*

---

## 3. Teams & seating (Slice A — P0)

### FR-TEAM-01
For each `ExerciseSession`, Facilitator SHALL create **teams** belonging to that session’s organization/run.

### FR-TEAM-02
Facilitator SHALL onboard participants onto exactly one team for the run (or none → treated as not onboarded / inactive for team-gated injects).

### FR-TEAM-03
Session seats retain `kind` (MODERATOR/FACILITATOR, OBSERVER, PARTICIPANT) and `playbookRoleId`.

---

## 4. Inject participation (Slice A — P0)

### FR-INJ-01 — Active teams
Each inject SHALL declare zero or more **activeTeamIds**.  
When released, only participants onboarded to those teams are **active**.

### FR-INJ-02 — Inactive state
Participants not on an active team SHALL see an **inactive** waiting UI (no inject narrative/questions).

### FR-INJ-03 — See
Active-team participants SHALL **see** inject questions (prompts).

### FR-INJ-04 — Answer
For each question:
- If `common === true`: any active-team participant MAY answer.  
- Else: only seats whose `playbookRoleId` ∈ question `roleIds` (or single `roleId`) MAY answer.  
Others on active team remain viewers (see, no submit for that question).

### FR-INJ-05 — Auto-admit
When an inject becomes current and includes the participant’s team, the participant SHALL automatically enter active state for that inject (no manual join).

### FR-INJ-06 — Shared clock
System SHALL maintain one **shared** countdown for the current inject for the room (server-authoritative preferred; design specifies).

---

## 5. Present mode (Slice C — P1)

### FR-PRES-01
Facilitator SHALL enter Present mode opening **Controller** + **Stage**.

### FR-PRES-02
Stage SHOULD open on secondary display when available; else a new window.

### FR-PRES-03 — Multi-controller
Multiple Facilitator controllers MAY control the same session concurrently.

### FR-PRES-04 — Live Stage content
Stage during answering phase SHALL show: narrative, timer, ATT&CK chips, in-play roles/teams, question prompts, completion rate.  
Stage SHALL NOT show answer text, AI score notes, IRP/CCMP body, or controller chrome.

### FR-PRES-05 — Controller extras
Controller SHALL show named who-answered / who-pending.

### FR-PRES-06 — Debrief Stage
When Facilitator opens Briefing/Debrief after answers submitted, Stage SHALL show submitted answers + AI gaps/strengths narrative.

### FR-PRES-07 — Mobile controller
Parked (P2).

**Slice C DoD (2026-09-05):** FR-PRES-01..05 shipped. FR-PRES-06 answers on Stage; AI gaps/strengths placeholder until Slice D. FR-PRES-07 parked.

---

## 6. Documents (Slice B — P1)

### FR-DOC-01
Facilitator SHALL upload IRP/CCMP as **pdf | docx | txt | md** only (no paste).

### FR-DOC-02
At upload, Facilitator SHALL set retention **N days** (default **14**).

### FR-DOC-03
On session **closed**, documents SHALL be soft-deleted (hidden from UI, marked deleted).

### FR-DOC-04
After N days from soft-delete (or upload+N — design picks; default: **N days after soft-delete**), system SHALL hard-delete file bytes; retain audit metadata.

### FR-DOC-05
Documents SHALL be usable as grounding for AI score notes / debrief (Slice D).

---

## 7. Scoring (Slice D — P1)

### FR-SCR-01
On valid submit, system SHALL auto-award points per question configuration.

### FR-SCR-02
System SHALL attach **AI notes** to the auto score (grounded in IRP/CCMP + answer).

### FR-SCR-03
Facilitator MAY override points with **optional human comments** (no AI required on override).

---

## 8. Non-functional

| ID | Requirement |
|----|-------------|
| NFR-01 | Adaptive layouts: laptop, tablet, projector Stage |
| NFR-02 | Desktop density (reduce empty chrome) |
| NFR-03 | AuthZ enforced server-side on all session mutations |
| NFR-04 | No IRP/CCMP content in client logs or Stage outside allowed phases |
| NFR-05 | Audit log for document lifecycle events |

---

## 9. Slice A acceptance checklist

Copied from frozen requirements — engineering DoD:

- [x] FR-AUTH-01, FR-AUTH-02  
- [x] FR-TEAM-01..03  
- [x] FR-INJ-01..05 (FR-INJ-06 shared clock remains client countdown in A — see ADR-002)  
- [x] Migration path for existing role-only exercises (empty teams / empty activeTeamIds ⇒ all active)  

---

## 10. Traceability

| BRD | FRS |
|-----|-----|
| B1–B2 | FR-ORG-*, FR-AUTH-* |
| B3–B5 | FR-TEAM-*, FR-INJ-* |
| B6 | FR-PRES-* |
| B7 | FR-DOC-* |
| B8–B9 | FR-SCR-*, FR-PRES-06 |
| B10 | NFR-01/02 |
| B11–B12 | P2 |
