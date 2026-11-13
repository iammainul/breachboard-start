# SDLC — Tabletop platform

## Lifecycle (this program)

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 1. Discover │ →  │ 2. Specify  │ →  │ 3. Design    │ →  │ 4. Secure   │
│  (notes)    │    │  BRD + FRS  │    │  Arch/Data/  │    │  Threat     │
│             │    │             │    │  UX/API/ADR  │    │  model      │
└─────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                                                                  │
       ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
       │ 8. Operate  │ ←  │ 7. Release  │ ←  │ 6. Verify   │ ←────┤
       │  runbooks   │    │  deploy     │    │  test/QA    │      │
       └─────────────┘    └─────────────┘    └─────────────┘      │
                                                                  ▼
                                                         ┌─────────────┐
                                                         │ 5. Build    │
                                                         │  slices A→D │
                                                         └─────────────┘
```

**Current gate:** Phase 7–8 (Release / Operate). Phases 1–5 are done (go 2026-09-05; product slices are in tree). Production runbook: `docs/DEPLOY.md`. Owner review: `docs/PRODUCTION-READINESS.md`. Merge order **#1 → #3 → #2 → #4 → #5 → #6** (#3/#4 with #5).

## Delivery slices (after go)

| Slice | Name | Depends on |
|------:|------|------------|
| A | Teams + see/answer rules + role gates | Design data model §A |
| C | UX density + Present mode (Stage/Controller) | Slice A |
| B | IRP/CCMP upload + retention | Threat model §docs |
| D | Scoring AI notes + debrief reveal | B + C |
| Later | Cursor provider, mobile controller | D |

## Definition of Done (per slice)

- Acceptance criteria in FRS checked  
- Schema migrations applied and reversible where possible  
- AuthZ tests for Admin vs Facilitator vs Participant vs Observer  
- No secrets in repo  
- Threat-model controls for that slice implemented or explicitly deferred with ticket  

## Change control

Material requirement changes → update BRD/FRS → amend threat model if trust boundaries change → ADR if architecture shifts → then code.
