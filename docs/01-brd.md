# Business Requirements Document (BRD)
# Tabletop — Cyber Tabletop Exercise Platform

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | **Accepted (2026-09-05)** — Stage/Present mode subject to later change |
| Owner | Product / stakeholder |
| Source | Facilitator scenario workshop + UX audit |

---

## 1. Executive summary

**Tabletop** is a software platform to **host live cyber tabletop exercises (TTX)** onsite or online (projector, Microsoft Teams, or Zoom). It supports **facilitators** running the exercise and **participants** answering role- and team-targeted inject questions under a shared room clock.

The platform must support client engagements where **Incident Response Plans (IRP)** and **Crisis / Crisis Management Plans (CCMP)** are uploaded for the exercise, used to ground scoring/AI notes, then **removed** after the engagement under a defined retention policy.

---

## 2. Business objectives

1. Reduce facilitation friction for live TTX (inject pacing, audience control, projector/presentation).
2. Ensure participants only engage when their **team is active**, with clear inactive waiting state.
3. Separate **platform administration** from **exercise facilitation**.
4. Protect client sensitive plans (IRP/CCMP) with upload controls, soft/hard delete, and audit.
5. Improve learning outcomes via auto-scoring, optional facilitator overrides, and post-inject **debrief** with AI narrative and answer reveal on Stage.

### Non-objectives (near term)

- SSO / enterprise IdP  
- Full multi-tenant SaaS commercial packaging  
- Native mobile controller app (parked; web later)  
- Deep embed into Teams/Zoom SDKs (screen-share Stage window is enough)

---

## 3. Stakeholders & users

| Persona | Business need |
|---------|----------------|
| **Client / hosting org** | Run a TTX for their staff; keep plans confidential after the event |
| **Admin** | Onboard organization and people before the event |
| **Facilitator** | Run the live session, Present mode, documents, scoring overrides |
| **Participant** | Answer when their team/role requires; otherwise wait inactive |
| **Observer** | Watch without answering (sponsors, auditors) |

**Role rule:** Facilitator may also be Admin. **Admin alone cannot facilitate.**

---

## 4. Business context & scenario

Typical engagement:

1. Admin creates the client **organization** and uploads participants with roles.  
2. Facilitator forms **teams for this run** and onboards people onto teams.  
3. Facilitator uploads **IRP/CCMP** (pdf/docx/txt/md).  
4. Scenario/injects prepared; each inject declares **active teams**.  
5. Live session: shared clock; Present mode (Stage + Controller).  
6. Active-team members see questions; required roles (or common questions) answer.  
7. After answers in: debrief on Stage (answers + AI gaps/strengths).  
8. Session closes → documents soft-deleted → hard-deleted after N days (default 14, set at upload).

---

## 5. High-level capabilities

| ID | Capability | Priority |
|----|------------|----------|
| B1 | Org & people onboarding | P0 |
| B2 | Distinct Admin vs Facilitator authority | P0 |
| B3 | Per-run teams + inactive/active participant states | P0 |
| B4 | Inject active-team targeting; see vs answer rules | P0 |
| B5 | Shared inject timer | P0 |
| B6 | Present mode: Stage + Controller (multi-controller) | P1 |
| B7 | IRP/CCMP upload + retention + audit | P1 |
| B8 | Auto score + AI notes; override with optional comments | P1 |
| B9 | Post-inject briefing / debrief with answer reveal on Stage | P1 |
| B10 | Adaptive desktop-dense UX | P1 |
| B11 | Cursor as LLM provider | P2 |
| B12 | Mobile controller | P2 (parked) |

---

## 6. Success metrics (initial)

| Metric | Target (qualitative v1) |
|--------|-------------------------|
| Facilitator can run a full inject cycle without leaving Present mode | Yes |
| Wrong-team participants never see active inject content | 100% |
| Admin-only cannot release injects | 100% |
| IRP/CCMP purged per policy after hard-delete window | 100% |
| Stage never leaks answers during live answering phase | 100% |

---

## 7. Constraints

- Stack: Next.js App Router, Prisma, PostgreSQL, NextAuth credentials (current).  
- Design system: light canvas, lime primary, flash-cards (existing).  
- Hosting may be Docker (`:3080`) or local dev.  
- LLM providers configurable; Cursor optional later.

---

## 8. Risks (business)

| Risk | Mitigation |
|------|------------|
| Sensitive plans linger in backups | Soft/hard delete + audit; document backup retention ops |
| Projector shows private answers too early | Phase gate: answers only in debrief |
| Role confusion Admin/Facilitator | Explicit platform + session capability checks |
| Scope creep (SSO, SaaS) | Explicit out-of-scope list |

---

## 9. Approval

| Role | Name | Date | Sign-off |
|------|------|------|----------|
| Stakeholder | | | ☐ Accept BRD |
| Engineering | | | ☐ Accept BRD |

**Acceptance means:** FRS and design may proceed to implementation planning; code starts only after SDLC gate + **go**.
