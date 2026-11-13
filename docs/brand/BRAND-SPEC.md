# Brand Spec — N0TS01337 | Toxic Phosphor liquid glass

Cybersecurity tools brand for product UI, marketing web, and operational documents. Dark Pitch Obsidian is the default ops field; Toxic Phosphor Day is the daytime counterpart for marketing, print, and preference toggles. Surfaces are always elite liquid glass.

Living spec (toggles + tokens): [`/brand`](/brand)

## Identity

- **Parent brand:** N0TS01337
- **Aesthetic direction:** Toxic Phosphor liquid glass
- **Mark:** Bracketed Terminal Reticle N0 (`[N0]`) with slashed zero beam (CRT phosphor green `#00FF66`, voltage signal `#CCFF00`, pitch obsidian `#0B0F0D`). Assets: `public/brand/n0ts01337-mark.svg`, `n0ts01337-logo.svg`, `n0ts01337-logo-light.svg`
- **Naming system:** Standalone tool names (compound nouns)

### Locked products

| Product | Domain | Role |
|---|---|---|
| **Packetlens** | Monitoring / alerting | Live telemetry, alert queues, severity triage |
| **Hexgate** | Vulnerability scan | Continuous / pre-release scan, rank, and gate findings |
| **Breachboard** | Tabletop exercises | Plan scenarios, facilitate sessions, capture decisions, and track follow-up actions |

## Tokens — Dark (Pitch Obsidian / Default Terminal)

```css
:root, [data-theme="dark"] {
  --bg:        #0B0F0D;             /* Pitch Obsidian */
  --surface:   #121815;             /* CRT Surface */
  --fg:        #F0F8F4;             /* High-vis terminal text */
  --muted:     #80988C;             /* Dim telemetry text */
  --border:    #1F2E26;             /* Matrix border */
  --accent:    #00FF66;             /* Toxic Phosphor Green */
  --on-accent: #0B0F0D;             /* High-contrast ink on accent */
  --signal:    #CCFF00;             /* Voltage Amber / Signal */
  --success:   #00FF66;             /* Active status */
  --warn:      #CCFF00;             /* Caution status */
  --danger:    #FF3366;             /* Threat breach status */
}
```

## Tokens — Light (Toxic Phosphor Day)

```css
[data-theme="light"] {
  --bg:        #F0F8F4;             /* Cool paper phosphor */
  --surface:   #FFFFFF;             /* Pure surface card */
  --fg:        #0B0F0D;             /* Pitch text */
  --muted:     #4A6658;             /* Readable secondary text */
  --border:    #CCE0D8;             /* Clean border */
  --accent:    #008833;             /* Deepened phosphor for 4.5:1 text contrast */
  --on-accent: #FFFFFF;             /* White text on solid button */
  --signal:    #77AA00;             /* Voltage signal day */
  --success:   #008833;             /* Active status */
  --warn:      #77AA00;             /* Caution status */
  --danger:    #D01140;             /* Threat breach status */
}
```

Primary CTAs use `--accent` fill with `--on-accent` ink.

Semantic tokens (`--success`, `--warn`, `--danger`) represent operational security status.

## Surface finish

Finish is always **elite liquid glass** (`data-finish="glass"`): frosted `--card`, backdrop blur, specular highlight. There is no brutalist terminal option. Persist colour field with `n0ts01337-theme`.

## Typography

- **Display:** `'Space Grotesk', 'Segoe UI', system-ui, sans-serif`
- **Body:** `'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif`
- **Mono:** `'IBM Plex Mono', ui-monospace, monospace` — IPs, hashes, CVEs, logs, captions, eyebrows, terminal prompts

## Visual rules

1. Toxic Phosphor (`#00FF66` dark / `#008833` light) is the signature brand signal. Eyebrow tags, bracketed reticles, and primary CTAs leverage this signal.
2. Pitch Obsidian (`#0B0F0D`) provides deep contrast under frosted liquid-glass panels.
3. Bracketed reticle elements (`[N0]`) and terminal prompt lines (`>_`) reinforce root-level authority.
4. Documents inherit the active theme; prefer mono for evidence lines (hashes, IPs, timestamps, terminal output).
5. High-contrast Toxic Phosphor on liquid glass — institutional, not brutalist chrome.
6. Persist `data-theme` (`dark` | `light`) in product chrome; default remains dark. Storage key: `n0ts01337-theme`.
7. Interaction states: empty (secondary action + disabled export), loading (`aria-busy` + spinner), error (`role="alert"` + `aria-invalid` fields with `--danger`).
8. Respect `prefers-reduced-motion`.
9. Surface finish is always elite liquid glass; do not invent purple/indigo AI chrome.

## Surfaces

- **Website / product app:** sticky terminal-style nav with N0TS01337 bracketed lockup, dense controls, tabular mono telemetry.
- **Documents / reports / PDFs:** dark for live on-screen security briefs, light for printable / daytime executive reports.
- **Packetlens:** alert queue / live telemetry UI.
- **Hexgate:** vulnerability scan brief / findings matrix.
- **Breachboard:** tabletop exercise workspace / facilitator board.
