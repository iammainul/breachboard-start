# Intel auto-onboard + scenario library

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Date | 2026-09-05 |
| Status | Implemented |

---

## 1. AI onboarding → advisory bootstrap

Admin opens `/settings/ai`. Provider credentials can be saved **in the portal**
(`AppSetting` key `ai.providers`); env vars remain optional fallbacks.
Portal values override env when present. Keys are never returned plaintext (masked).

**Complete onboarding** (`POST /api/settings/ai/complete`):

1. Requires at least one ready provider (portal or env).
2. Sets `AppSetting` `ai.onboarding.completedAt`.
3. Upserts library templates (`seedLibraryTemplates`).
4. Runs `runAutoOnboardIntel` (CISA KEV JSON + CISA advisories RSS) unless skipped by cooldown / `AUTO_ONBOARD_INTEL=false` (force bypasses).

Provider CRUD: `PUT|DELETE /api/settings/ai/providers`.

Manual: `POST /api/intel/auto-onboard` with `{ force: true }` from Intel hub.

### Dedupe

- KEV: `FeedItem` by title `CISA KEV: CVE-…` or NVD detail URL.
- RSS: by `FeedItem.url`.
- Cooldown: 12h between automatic runs; force ignores.

CERT-In / RBI / FBI remain paste-import only.

---

## 2. Scenario library

`Exercise` template fields: `isTemplate`, `templateKey`, `libraryTags`, `coverImagePath`, `cloneCount`.

Document injects carry `mediaPrompts[]`:

- `kind`: `image` | `video`
- `prompt`, optional `aspect`, `durationSec`
- `assetPath`: static file under `/public/library/...`

Video is prompt-only (no in-app render). Stage shows image when `assetPath` is set. Controller lists media cues.

Routes:

- `GET /api/library`
- `POST /api/library/[key]/clone`
- `GET /api/library/export?keys=` — download `.ttxpack` (portable JSON plugin)
- `POST /api/library/import` — upload file or JSON body
- `POST /api/library/install` — `{ url }` fetch + import

UI: `/library` (export/import/install toolbar), nav “Library”, Media tab on scenario editor.

### Pack format (`ttx-library-pack` v1)

Share via email, USB, or URL. Each pack includes template metadata, full `ExerciseDocument`, and optional base64 assets written under `public/library/imported/`.

## Scenario vs inject packs

- `libraryKind`: `scenario_pack` (multi-inject SitMan) or `inject_pack` (1–N injects for workshop swaps).
- Library UI filters by kind + tags.
- After AI generate, **Inject workshop** can replace an inject from an inject pack or regenerate via LLM.

## Join

- `/join` and `/join/[code]` after login call `POST /api/join`.
- Players auto-seat as PARTICIPANT without role until facilitator assigns playbook role.
- Admin accounts never submit answers.
