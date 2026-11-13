# Toxic Phosphor liquid glass — portable design spec

This is the visual contract for **Breachboard** and any sibling product that should feel like the same family. Copy the tokens and CSS recipes; do not invent a second language.

Live reference: `/brand` in this app.

---

## 1. Field and finish

| Token | Dark (default) | Light |
|---|---|---|
| Theme attr | `data-theme="dark"` | `data-theme="light"` |
| Finish attr | `data-finish="glass"` | same — **always glass** |
| Storage key | `breachboard-theme` | `light` \| `dark` |
| Field name | Pitch Obsidian | Toxic Phosphor Day |
| Canvas | `#0B0F0D` | `#E3EDE7` |
| Accent | `#00FF66` | `#008833` |
| Signal / warn | `#CCFF00` | `#77AA00` |
| Danger | `#FF3366` | `#D01140` |
| On-accent | `#0B0F0D` | `#FFFFFF` |

Rules:

- Default field is **dark**. Light is the daytime / print counterpart, not a pastel redesign.
- Surface finish is **elite liquid glass only**. Do not offer a brutalist, terminal, or “AI chrome” finish.
- No purple, indigo, violet, or neon-magenta. If you need a second accent, use signal (`#CCFF00` / `#77AA00`) or the blue status dot `#5B8CFF` on the mark only.
- Persist theme in `localStorage` under `breachboard-theme`. Bootstrap it in `<head>` before paint to avoid a flash.

HTML shell:

```html
<html data-theme="dark" data-finish="glass">
  <body class="app-canvas">…</body>
</html>
```

---

## 2. Type

| Role | Family | Use |
|---|---|---|
| Display | **Space Grotesk** | Product name, page `h1`, lockups |
| Body | **IBM Plex Sans** | UI copy, tables, forms |
| Mono | **IBM Plex Mono** | ATT&CK IDs, join codes, hashes, IPs, emails, eyebrows, terminal prompts, TOTP secrets |

Scale (ops density):

- Page title: `26–28px`, bold, tight tracking
- Panel title: `15–16px`
- Section label: `11–13px`, uppercase, `letter-spacing: 0.06–0.16em`, muted
- Body: `14px` / `1.5`
- Meta / table: `12–13px`

Admin surfaces stay dense (lists, tables). Player / join surfaces may be slightly more spacious, never more decorative.

---

## 3. Layout

- App chrome is a **248px glass rail** + a scrolling main canvas. Field colour (Pitch Obsidian / Toxic Phosphor Day) is the sun/moon control on the rail and login — not a Settings tab.
- Content max width **1680px** (`PageFrame`). Fill the width with columns; do not trap everything in a 960px article column.
- Present / Stage are full-viewport boards (`h-dvh`): slim chrome, three columns, scroll inside docks — not a stacked article.
- Section gap **20px** (`gap-5`). Inside a panel **12–14px**.
- Panel padding **16–20px**. Rows **10–14px** vertical.
- Prefer **multi-column** at `xl` / `2xl` (metrics 4-up, org cards 3-up, library 4-up) over a single tall stack.
- Workspace surfaces (live console, editor, presenter) **fill the viewport** and scroll inside docks — they must not grow the page.

---

## 4. Liquid glass recipe

Every raised surface is a **frosted panel**, not a flat card.

Required traits:

1. Translucent fill (`color-mix` of surface + transparent) so the canvas grid and glow show through.
2. `backdrop-filter: blur(20–22px) saturate(1.4–1.5)`.
3. **Gradient rim**: bright on the top-left, shaded on the bottom-right, masked to a 1px ring that follows the radius.
4. **Specular sheen**: a short highlight along the top edge only — never a diagonal wash across the whole panel (that kills text contrast).
5. Drop shadow underneath; inset shade on the bottom inner edge.
6. Radius **16px** panels, **12px** controls.

Put custom classes in `@layer components` so Tailwind utilities (`bg-*`, `sticky`, `border-*`) still win when composed.

Class vocabulary (copy these names):

| Class | Job |
|---|---|
| `.app-canvas` | Field + phosphor glows + 28px dot grid |
| `.flash-card` | Primary glass panel |
| `.glass-chrome` | Accent-tinted toolbar / hero |
| `.glass-dock` | Full-height column; scroll inside |
| `.glass-rail` | App sidebar |
| `.glass-header` | Sticky frosted bar over scrolling content |
| `.glass-reading` | Calmer, more opaque long-form well |
| `.glass-inset` | Recessed inner well |
| `.glass-tile` | Small inner tile (metrics, avatars, QR) |
| `.glass-row` | List/table row hover wash; `data-active="true"` |
| `.glass-divider` | Fading vertical seam |
| `.glass-scroll` | Thin scrollbar |
| `.btn` / `.btn-primary` / `.btn-ghost` | Controls |
| `.field` | Inputs |
| `.chip` / `.status-pill` | Status |

Gotcha: `.flash-card > *` is `position: relative; z-index: 1` so content sits above the sheen. Absolutely positioned decorations on the card itself must use `data-deco` (and omit the `absolute` utility).

Hover lift belongs on `a.flash-card` / `.flash-card-interactive` — do not restyle every card with `hover:-translate-y`.

---

## 5. Colour roles (CSS variables)

Expose as `--bg`, `--surface`, `--fg`, `--fg-2`, `--muted`, `--meta`, `--card`, `--card-solid`, `--sidebar`, `--hover`, `--border`, `--border-soft`, `--accent`, `--on-accent`, `--signal`, `--primary`, `--primary-fg`, `--primary-hover`, `--primary-wash`, `--success`, `--warn`, `--danger`, `--ring`, `--radius`, `--radius-control`, `--shadow-card`, `--canvas-glow`, `--canvas-dot`, `--glass-blur`, `--glass-saturate`, `--glass-specular`, `--glass-rim`, `--glass-sheen`, `--glass-shade`, `--field-bg`.

Implementation lives in `design/tokens.css` and `app/globals.css` (`@layer components`). Port those two files, then map `--color-*` in Tailwind `@theme inline`.

---

## 6. Mark

Rounded square, letter **B**, **blue status dot** (`#5B8CFF`) at the top-right. Stroke and B inherit `currentColor`. Do not substitute a reticle, skull, shield-only, or parent-brand glyph.

---

## 7. Interaction

- Empty: secondary action, no fake data.
- Loading: `aria-busy` + spinner, keep layout.
- Error: `role="alert"`, `aria-invalid` on fields, `--danger` wash — never a toast-only failure for forms.
- Focus: `box-shadow: 0 0 0 3px var(--ring)` — no browser outline.
- Respect `prefers-reduced-motion` (no lift, no pulse).
- Unsupported `backdrop-filter`: fall back to `--card-solid`.

---

## 8. Do / don’t

**Do**

- Let the mint/obsidian canvas show through panels.
- Reserve phosphor green for primary actions, live status, and the active nav pill.
- Use mono for anything a human might copy (codes, IDs, secrets).
- Keep admin pages information-dense; use horizontal columns on wide screens.

**Don’t**

- Flood a panel with accent. Severity colour is for chips, rails, and one callout.
- Use purple “AI” gradients, glassmorphism-on-white-only, or drop shadows without a rim.
- Mix a second type family.
- Build a light theme that is just inverted dark — retune borders, card opacity, and accent depth.

---

## 9. Files to copy into another app

1. `design/tokens.css` — theme variables
2. `app/globals.css` — `@layer components` glass + controls (from `.app-canvas` through the reduced-motion block)
3. `lib/themes.ts` + `components/theme-provider.tsx` + `components/theme-toggle.tsx`
4. Fonts: Space Grotesk, IBM Plex Sans, IBM Plex Mono (this app loads them in `app/layout.tsx`)

Keep product copy and domain components; reuse the chrome.
