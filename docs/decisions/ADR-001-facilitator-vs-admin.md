# ADR-001: Modeling Facilitator vs Admin

## Status
Proposed

## Date
2026-09-05

## Context
BRD requires Admin ≠ Facilitator, while Facilitator may also be Admin. Today `platformRole=ADMIN` can manage all sessions; session `MODERATOR` is the live driver.

## Options
### A — Platform role `FACILITATOR` (+ optional ADMIN)
Pros: clear; Cons: dual roles on user record.
### B — Capability flag `canFacilitate` on User
Pros: simple; Cons: weak for multi-org later.
### C — Org membership roles
Pros: future SaaS; Cons: overkill (SSO/SaaS out of scope).

## Decision
**Proposed A:** `platformRole` ∈ `ADMIN | FACILITATOR | USER` with allow `ADMIN`+facilitator via either dual assignment table or `FACILITATOR` who is also granted admin permissions when needed. Session seat `MODERATOR` remains the per-run binding; go-live requires platform Facilitator **or** seat MODERATOR created by a Facilitator.

*Final coding choice locked at Slice A kickoff.*

## Consequences
Access helpers must change; seed scripts update; UI labels “Facilitator” not only “Moderator”.
