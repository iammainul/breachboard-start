# ADR-002: Shared inject clock authority

## Status
Proposed

## Date
2026-09-05

## Context
FR requires one shared room clock. Current UI uses client-side countdown from `timerSeconds` (resets on refresh).

## Options
### A — Server `currentInjectStartedAt` + duration
Pros: consistent across clients/Stage; Cons: clock skew handling.
### B — Facilitator “start timer” event
Pros: control; Cons: extra step.
### C — Keep client-only (Slice A temporary)
Pros: fast; Cons: drift.

## Decision
**Slice A:** C acceptable if documented.  
**Slice C (Present mode):** implement **A** — store `currentInjectStartedAt` on inject release; clients compute remaining = start + timerSeconds − now.

## Status
Accepted (Slice C)

## Consequences
PATCH release inject must set timestamp; Stage/Controller/Participant share formula via `lib/session-clock.ts` + `InjectCountdown`.
