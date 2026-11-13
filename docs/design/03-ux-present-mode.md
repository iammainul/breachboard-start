# UX design — Present mode & participation states

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | **Baseline accepted; Stage/Present details TBD for later iteration** |
| Visual system | Light canvas `#f4f6f8`, lime `#5ea00d`, flash-cards, Plus Jakarta Sans |

> **Stakeholder note (2026-09-05):** Present/Stage mode may need more modifications later. Implement Slice A without depending on final Stage UX. Revisit this doc before Slice C.

---

## 1. Goals

1. **Dense desktop** hubs (less empty whitespace).  
2. **Adaptive** layouts for laptop / tablet / projector Stage.  
3. Present mode feels like **PowerPoint Presenter View**: Controller + Stage.  
4. Participants always know if they are **inactive** vs **in play**.

---

## 2. Participant states

### Inactive
- Full-session chrome (brand, sign out) retained.  
- Center card: “Your team is on standby” / “Not active on this inject”.  
- No narrative, questions, or answer box.  
- Optional: show shared timer as “room is live” without content spoilers? **Decision: hide inject body; may show “Exercise in progress” only.**

### Active viewer
- See inject narrative + questions.  
- Questions they cannot answer marked “View only — waiting on {roles}”.

### Active answerer
- Answer controls enabled for allowed questions.  
- Shared countdown prominent.  
- “Lock in response” primary CTA.

---

## 3. Present mode IA

### Entering
- Controller: button **Present** on session.  
- Opens Stage via `window.open` with `popup` features; attempt `screen` placement API when available (`window.getScreenDetails` progressive enhancement).  
- Fallback: Stage tab/window; facilitator drags to projector / shares that window in Teams/Zoom.

### Controller layout (laptop)
```
┌─────────────────────────────────────────────┐
│ Session title · phase · Present indicator   │
├──────────────┬──────────────────────────────┤
│ Inject map   │ Current inject controls      │
│ Team status  │ Timer · Release · Debrief    │
│ Who answered │ Preview of Stage             │
│ (names)      │ Private notes                │
└──────────────┴──────────────────────────────┘
```

### Stage layout (projector)
```
┌─────────────────────────────────────────────┐
│ Org · Live · Join code (optional small)     │
│ INJECT TITLE                                │
│ Narrative…                                  │
│ [ATT&CK chips]  Timer  MM:SS                │
│ In play: Team Legal · Roles CISO, SOC       │
│ Questions (prompts)                         │
│ Answered 7 / 10                             │
└─────────────────────────────────────────────┘
```

### Stage — Debrief
- List/summarize answers (readable at distance).  
- AI “Gaps” / “Strengths” panels.  
- No IRP/CCMP raw text.

---

## 4. Multi-controller

- Any Facilitator seat/capability may open Controller.  
- Mutations are last-write-wins with toast “Inject released by {name}”.  
- No hard lock in v1 (ADR if conflicts appear).

---

## 5. Adaptive rules

| Viewport | Behavior |
|----------|----------|
| ≥1280 | Sidebar + dense grids |
| 768–1279 | Collapsible sidebar |
| Stage window | No app sidebar; typography scaled up; high contrast |
| Controller narrow | Single column; Stage preview optional |

Mobile controller: **out of scope** until unparked.

---

## 6. Copy principles

- Facilitator: ops language (release inject, debrief, roster).  
- Participant: mission language (standby, objectives, lock in).  
- Mono only for join codes and ATT&CK IDs.

---

## 7. Accessibility

- Stage: large type, don’t rely on color alone for live/answered.  
- Completion rate text + progress bar.  
- Keyboard: Controller actions reachable without pointer-only traps.
