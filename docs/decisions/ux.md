# Live-room UX polish

| Field | Value |
|-------|--------|
| Status | Proposed (this PR) |
| Date | 2026-10-09 |
| Base | `cursor/playwright-e2e-ci-ef13` (PR #5, rebased to `6ca1d14`), on PR #4 security → #2 uploads → #3 foundation → #1 scoring |
| Related | `docs/USER-JOURNEY.md`, `design/DESIGN.md`, `docs/design/03-ux-present-mode.md`, ADR-002, `docs/decisions/e2e.md` |

This file records **what we chose, the alternatives, why, and what the owner should double-check**.

---

## Skills and docs used

Read and followed:

| Source | How it was used |
|--------|-----------------|
| `.cursor/rules/project.mdc` | Stack, session console / game-ui patterns; did not touch authz, uploads, or scoring writes |
| `.cursor/rules/design.mdc` | Pitch Obsidian + toxic phosphor; 248px glass rail when expanded; no purple AI chrome; always `data-finish="glass"` |
| `design/DESIGN.md` | 248px rail, glass overlay z-order, mono for join codes/timers, reduced-motion |
| `docs/design/03-ux-present-mode.md` | Adaptive table: ≥1280 sidebar; 768–1279 collapsible; observers/inactive vs answerer states; copy principles |
| `AGENTS.md` / `CLAUDE.md` | Next.js 16 warning (no `node_modules/next/dist/docs/` in this checkout); extend `session-console` / `game-ui` |
| `docs/GATE.md` | Operate/Release gate; UX is not a schema/authz slice |
| `docs/USER-JOURNEY.md` | Journeys B–C, observer persona, backlog items 2 / 7 / 9, mobile QA tick |
| ADR-002 | Shared clock; `onExpired` still only reloads — no client PATCH for discuss → answering |
| ADR-001 / ADR-003 | Facilitator seat vs observer; Stage stays facilitator-gated (Present/Stage got discuss copy only) |
| `docs/decisions/e2e.md` | Un-fixme mobile; keep Chromium, `next start`, role/label locators; do not shorten `DISCUSS_SECONDS` |
| Repo skill **architecture-decision-records** | This file (requested path `ux.md`, not ADR-00N) |
| Repo skill **using-ui-stack** | 44px rail toggles, overlay z-30 / rail z-40, 5-state buttons via existing `.btn`. **Departure:** tokens and 20px section gaps from DESIGN.md, not the skill’s slate/8px-grid defaults |
| Repo skill **writing-copy** | Discuss: “Time remaining” / “Answering opens automatically”; observer: “Read-only seat…” — ops vs mission voice from UX design §6 |
| Repo skill **adding-e2e-tests** / **writing-tests** | `journey-ux.spec.ts`; locators are roles/labels already in the UI. **Departure:** Chromium-only, production `next start`, no `data-testid` sweep |
| Repo skill **responsive-testing** | Viewports 768, 1024, 1440, iPhone 12 (390) |
| Repo skill **creating-pr** / **writing-commit-messages** / **babysitting-pr** | PR onto the Playwright E2E branch; watch Actions |
| Vercel **react-best-practices** | `useSyncExternalStore` for the rail breakpoint; `React.memo` on inject media; no new client PATCH |
| Context7 **Next.js** `next/font/local` | Quota exceeded this turn; used Next 16 `localFont` + fontsource latin woff2, same CSS variables |
| Vercel **verification** | Tablet / observer / countdown / mobile journeys through UI, not screenshot-only |
| Cursor **walkthrough-artifacts** | Before/after screenshots when the desk can be driven in-browser |
| Cursor **subscribe** | Watch GitHub Actions instead of tight polling |

Looked for and **did not find** in this checkout:

- `.cursor/skills/**` (lockfile only; fetched upstream SKILL.md for the rows above)
- `node_modules/next/dist/docs/`
- shadcn `components/ui` (this app is the glass kit, not shadcn)

Community skills named in USER-JOURNEY (`testing`, `e2e-playwright-testing`, `playwright-e2e`, `tester`) are not in `skills-lock.json`.

### Deliberate departures

1. **Filename `docs/decisions/ux.md`** instead of `ADR-00N`. Task asked for this path.
2. **Rail default-closed below 1280px**, not only 768–1024. CSS overlay + `xl:` (1280) matches the Present-mode adaptive table; 1024 landscape iPad is still a tablet.
3. **No client discuss PATCH.** Timer `onExpired` reloads so the existing server `updateMany` flip stays authoritative (ADR-002 / scoring PR).
4. **No shadcn sidebar.** Collapse is implemented on `.glass-rail` so the design contract stays one language.
5. **Observer sees all role prompts as view-only**, not an empty “Your objectives” list and not facilitator score cards.
6. **Nested `backdrop-filter` off inside `.flash-card`.** Outer cards, rail, and header still frost. Inner tiles/fields/chips keep colour and rims only — stacked compositor layers were crashing headless Chromium on the live console.
7. **Fonts via fontsource + `next/font/local`**, not `next/font/google`. Same families and weights; no build-time Google fetch.
8. **Playwright `--disable-dev-shm-usage`.** CI Chromium shm is ~64MB; that is the multi-tab sad-tab, not a client PATCH. App still drops nested frost and memoizes inject media.

---

## Decisions

### 1. Overlay rail below `xl` (1280px), 248px when open

**Chose:** Compact `glass-header` with **Open navigation** below 1280px. The 248px `.glass-rail` becomes a left overlay (`z-40`) with a dim backdrop. Default closed so 768–1024 content (inject + join code + Start) stays in view. At `xl+` the rail is the existing sticky column; the toggle is `display: none`. `inert` when closed on a narrow viewport keeps off-screen links out of the tab order. Escape and nav clicks close it. Slide animation is on a **non-glass wrapper** so frost and `transform` are not on the same compositor layer.

**Alternatives:** Icon-only 56px rail (doesn’t recover enough width at 768); always-open until 1024 only (iPad landscape still loses ~248px); persist open/closed in `localStorage` (fights the “content first on tablet” default); `transform` on `.glass-rail` itself (Chromium GPU crash at phone widths).

**Why:** USER-JOURNEY backlog item 9 and UX design §5. The live console already uses a 288–332px right dock at `lg`; stacking that on a 248px rail is what made the room unusable.

**Owner check:** Confirm operators on 1100–1279px laptops are fine opening nav once per session. Confirm Stage/Present (no `DeskShell`) staying full-bleed is still what you want.

### 2. Distinct observer layout, no submit chrome

**Chose:** `data-seat="observer"`, Observing chip, `role="status"` banner (“Read-only seat. Watch the inject and roster — you cannot submit answers.”). During answering, all inject prompts render as QuestCards with **View only** (no points, no Lock in, no textarea). Facilitator “Team responses” / score override cards require `canManage`, so observers no longer inherit that `!participant` panel. API observer deny is unchanged.

**Alternatives:** Greyed-out disabled textarea (explicitly rejected by the backlog); hide questions entirely (observers could not follow the room); show other people’s answers (closer to facilitator debrief, wider leak surface).

**Why:** Journey D persona + backlog item 7. The previous filter produced an empty “Your objectives” heading — disabled chrome without a submit.

**Owner check:** Confirm observers should see **all** role prompts (spectator of the room) rather than none. Confirm they should **not** see live answer text before debrief (current choice).

### 3. Discuss countdown copy; server remains the clock

**Chose:** Discuss `InjectCountdown` label **Time remaining**, caption **Answering opens automatically** (while ticking and at 00:00). Inject hint: “Discuss with your squad — questions unlock when this timer hits zero.” Same caption on Present and Stage. `onExpired` still only `reload()` / `router.refresh()` — the GET poll applies `discussExpiryWrite`.

**Alternatives:** Client `PATCH phase=answering` at zero (forbidden here; already caused stall bugs); hide the clock and only show a spinner at zero; “questions unlock in mm:ss” in the hint (duplicates the timer).

**Why:** Backlog item 2 + the task’s example copy. Players need to know *what happens* at zero, not only the mm:ss.

**Owner check:** Facilitators can still **Open questions** early. Copy says automatic; it does not mention the early unlock. Say so in the hint if you want both paths named.

### 4. Mobile join/answer is the collapsed rail + 16px fields

**Chose:** Join name/code fields `h-11` / 16px (no iOS input zoom). Session answer box 16px; Lock in `h-11`. Compact squad-code QR starts hidden (code stays visible; tap **QR**). Participant roster dock no longer forces a 70dvh min-height on small screens. Overlay rail slide uses a **transform wrapper**; `.glass-rail` keeps frost, and `[inert]` drops `backdrop-filter`. Below 640px, **backdrop-filter is off** (solid `--card-solid` panels). Nested `.glass-tile` / `.field` / `.chip` / `.join-code-badge` inside a `.flash-card` also drop `backdrop-filter` — the outer card already frosts, and stacking those layers sad-tabs Chromium. Stage images `loading="lazy"` / `decoding="async"`; videos `preload="metadata"`. Playwright mobile journey: 390×844 CSS px, **`deviceScaleFactor: 1`**, **no `isMobile` emulation** (that path sad-tabs Chromium). Uses the no-rubric fixture (no teams/media) so the first session GET can include the `soc` seat — we seat from the join POST before the room hydrates, instead of `reload()` or a 25s poll. PhishGate at 390 still OOMs headless Chromium after a few timer ticks; tablet/desktop PhishGate is covered elsewhere. Removed `test.fixme`.

**Alternatives:** `devices["iPhone 12"]` (DSF 3) — renderer sad-tab (`This page couldn’t load`) on the live console; client PATCH for discuss (forbidden); keep compact QR always-on (eats the 390px header).

**Why:** The join lobby already had no rail. The broken path was `/sessions/[id]` at ~390px with a 248px glass column **and** Chromium crashing when `transform` + `backdrop-filter` shared the overlay rail layer. PhishGate draft runs also have squads — a role without a team is `inactive` and never shows the answer box.

**Owner check:** iOS Safari keyboard covering the textarea is untested here (Playwright Chromium). Real-device pass before a live engagement. Confirm compact QR default-hidden is OK in the room.

### 5. Self-hosted fonts (fontsource + `next/font/local`)

**Chose:** `@fontsource/space-grotesk`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (latin woff2, same weights as the old Google loader: display 400–700, sans 400/500/600/700, mono 400/500/600). `app/fonts.ts` points `next/font/local` at those files. CSS variables `--font-display-app`, `--font-sans`, `--font-mono-app` are unchanged. Removed the `npm run build || npm run build` retry.

**Alternatives:** Keep `next/font/google` and retry/cache (still needs fonts.google.com at Docker/CI build); commit woff2 into `app/fonts/` (duplicates npm); `@fontsource-variable/*` (one file, slightly different metrics than the previous static Google cuts).

**Why:** CI Turbopack failed with `next/font/google queries have exactly one entry` / missing `@vercel/turbopack-next/internal/font/google/font` when Google flaked. Production Docker builds on restricted networks hit the same fetch. Fontsource arrives with `npm ci`; `font-src 'self'` already matches.

**Owner check:** Skim Control + a live console in both themes — Space Grotesk headings, Plex Sans UI, Plex Mono join codes. Latin-only (same as the previous `subsets: ["latin"]`).

### 6. Multi-tab renderer crash: CI `/dev/shm` + compositor pressure

**Chose:** Rebase onto PR #5 `6ca1d14` (RSC 307 gone; `questionsOf` treats missing participant `questions` as `[]`; scoring/happy-path `.first()` on duplicate “Response logged”). Happy-demo clicks Priya’s PhishGate MissionCard in the same tab. `--disable-dev-shm-usage` and nested-frost-off remain. New E2E: facilitator console + Stage + participant through one inject. This PR does not change the redacted inject contract (`{ id, sequence }` with no `questions`).

**Alternatives:** Park the operator on Control during the player tab (hides a real classroom layout; rejected); stash campaign totals only on the server (still need the client not to throw); drop ScorePanel for participants (hides the live score the room is built around).

**Why:** A seated CISO opening a live room from the hub is the real classroom path. The 307 (e2e.md §7) and ScorePanel `questionsOf` (e2e.md §8) are on PR #5. This PR keeps the 3-tab classroom layout and does not paper over remaining crashes.

**Owner check:** Drive console + Stage + a player window on a laptop GPU. Confirm ScorePanel totals for players (only injects they can see) are acceptable.

---

## Coverage

| Behaviour | Spec |
|-----------|------|
| Tablet 768 + 1024 rail collapse; 1440 rail restored | `tests/e2e/journey-ux.spec.ts` |
| Discuss copy on the timer | `journey-ux.spec.ts` |
| Mobile join + answer | `journey-ux.spec.ts` (replaces guards `test.fixme`) |
| Observer banner / view-only / no submit | `tests/e2e/journey-guards.spec.ts` (extended) |
| Server discuss → answering without facilitator tab | unchanged `journey-discuss-expiry.spec.ts` |
| Facilitator console + Stage + participant, one inject | `journey-ux.spec.ts` |

---

## Needs owner

1. **Laptop 1100–1279px:** default-collapsed rail — keep, or default-open between `lg` and `xl`?
2. **Observer prompts:** all roles vs hide questions until debrief.
3. **Discuss hint:** mention facilitator “Open questions” as well as the automatic flip?
4. **Stage rail:** Present/Stage still omit `AppShell` (no app rail). Confirm that remains correct for projector boxes.
5. **STACKED PR:** this is #6. Do not merge until **#1 → #3 → #2 → #4 → #5 → #6**. **#3/#4 must ship with #5.** See `docs/PRODUCTION-READINESS.md`.
6. Real iPhone Safari pass on join + answer (Chromium e2e is not WebKit; DSF 1 is layout-accurate, not 3× retina). Confirm frost-off below 640px looks acceptable on a real phone.
7. Compact squad QR default-hidden in the console — keep, or show by default on tablet?
8. **PhishGate at ~390px in headless Chromium** still sad-tabs after a few timer ticks; mobile e2e uses the no-rubric fixture. Confirm a real phone can run PhishGate.
9. **Self-hosted fonts:** latin-only Space Grotesk / IBM Plex — confirm no missing glyphs you care about (ATT&CK IDs, join codes).
10. **`--disable-dev-shm-usage`:** CI-only Chromium flag. Real Chrome on a laptop uses the default shm. Confirm console+Stage+player on hardware.
