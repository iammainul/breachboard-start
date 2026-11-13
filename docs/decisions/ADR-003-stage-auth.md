# ADR-003: Stage window authentication

## Status
Proposed

## Date
2026-09-05

## Context
Stage may run on a projector PC or shared Zoom window. Threat model wants to avoid anonymous scrape of inject/answers.

## Options
### A — Same Facilitator session cookie (login on projector machine)
Pros: simple; Cons: shared account.
### B — Short-lived stage token in URL
Pros: no full account on projector; Cons: token leakage via screen share of URL bar.
### C — Public read Stage for join code
Pros: easy; Cons: rejected by threat model for answers/debrief.

## Decision
**Accepted (Slice C)** — Stage routes require Facilitator seat (`MODERATOR`). Projector uses facilitator login or dedicated facilitator user.  
Revisit B when mobile/projector hardening is prioritized.

## Consequences
`/sessions/[id]/stage` and `/sessions/[id]/present` behind auth; no public Stage.
