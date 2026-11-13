# IRP/CCMP upload lifecycle

Status: Proposed (this PR)  
Date: 2026-10-09  
Related: ADR-004, FR-DOC-01..05, threat model §3–5, data model §2.6–2.7, API design §5, [foundation.md](./foundation.md), [DEPLOY.md](../DEPLOY.md)

Rebased onto `cursor/production-foundation-e925` (PR #3). Stack is PR #1 → PR #3 → this PR.

This is the decision log for production-grade client plan uploads: retention, soft/hard delete, audit, extraction, and admin visibility.

---

## Skills and docs used

Read and followed:

| Source | How it was used |
|--------|-----------------|
| `AGENTS.md` / `CLAUDE.md` | Stack, domain language, prefer existing patterns |
| `.cursor/rules/project.mdc` | Prisma + Next.js App Router, access helpers, no secrets in git |
| `.cursor/rules/design.mdc` + `design/DESIGN.md` | Pitch Obsidian / liquid glass, dense admin tables, IBM Plex Mono for ids/hashes, ops copy |
| `docs/GATE.md` + `docs/00-sdlc.md` | Slice B (IRP/CCMP) is in-scope after go; DoD = FRS + authZ + no secrets |
| `docs/01-brd.md` | Plans uploaded for the engagement, then removed; default 14 days |
| `docs/02-frs.md` FR-DOC-* / NFR-04 / NFR-05 | Upload types, N-day retention, soft-delete on close, hard-delete after N, audit, no Stage leak |
| `docs/USER-JOURNEY.md` | Operator onboarding; admin surfaces stay in the rail/settings IA |
| `docs/USER-MANUAL.md` | Settings tabs stay under Admin → Settings |
| `docs/design/01-system-architecture.md` §6 | Extract → soft-delete on close → worker hard-delete → immutable audit |
| `docs/design/02-data-model.md` §2.6–2.7 | SessionDocument / DocumentAuditEvent fields as the baseline |
| `docs/design/03-ux-present-mode.md` | No IRP/CCMP raw text on Stage (unchanged; grading stays server-side) |
| `docs/design/04-api-design.md` §5 | Session document list; protected `/api/internal/retention/run` |
| `docs/design/05-intel-library.md` | Not applicable; not duplicated |
| `docs/security/01-threat-model.md` | Critical asset; cron secret; truncate LLM excerpts; hide from participants; backup TTL residual |
| `docs/decisions/ADR-004-document-storage.md` | Filesystem volume now; `DocumentStorage` via `lib/media/fs.ts`; production S3 later |
| `.github/workflows/ci.yml` | All-PR CI from the foundation branch; Node 22; `prisma validate` + Docker image job |
| `docs/DEPLOY.md` + `docs/decisions/foundation.md` | `migrate deploy` on start; env Zod schema; pino logger; compose healthchecks |
| `lib/env.ts` / `lib/logger.ts` | Retention cron secret and sweep interval in the Zod schema; sweep logs via pino with redaction |

Looked for and **did not find** in this checkout:

- `.cursor/skills/**` (USER-JOURNEY lists community testing skills that are not vendored here)
- `.cursor/notes/requirements-draft-2026-09-05.md` (GATE checklist points at it)
- `node_modules/next/dist/docs/` (Next.js agent guide; package not unpacked until `npm ci`)
- Plugin skills `vercel-storage`, `react-best-practices` at the documented absolute paths (not present in this VM)

Tried and **could not use**:

- Context7 (`resolve-library-id` / `query-docs`) — monthly quota exceeded
- pdf-parse as the PDF engine — chose `pdfjs-dist` instead (see decision 6)

### Deliberate departures

| Departure | From | Why |
|-----------|------|-----|
| Model named `ClientDocument`, `sessionId` optional | Data model `SessionDocument` with required `sessionId` | Standing org IRP/CCMP already exist on `Organization` and grade every run. One table covers org + engagement without breaking `/orgs/[id]` |
| String `kind` / `action` instead of Prisma enums | Data model enums | Matches existing `status` / `phase` style |
| Hard-delete clock = N days after **soft-delete**, plus a 365-day abandoned cap | FRS allows either; default is post-soft-delete only | 14 days from upload would wipe plans uploaded during prep; unbounded active files violate the threat model |
| Engagement close soft-deletes **org-level** plans; draft close does not | FRS says “on session closed” | Draft rehearsals must not purge the client’s standing IRP; real engagements must |
| Org upload route stays `requireApiAdmin` | FRS Facilitator SHALL upload; architecture matrix says Facilitator | Parallel agent owns upload route authZ; this PR does not widen/narrow that surface |
| MIME/magic/size validation left as the existing allowlist | Threat model “upload allowlist” | Parallel agent owns validation; this PR does not duplicate it |
| Admin UI lives at `/settings/uploads`, not a new rail item | — | Settings is already the admin dense surface; USER-MANUAL IA |
| `pdfjs-dist` + `mammoth`, not `pdf-parse` | Task example | `pdf-parse` v1 loads a debug fixture on import; pdf.js is the same family the task allowed |
| In-app interval + CLI + secret-gated route | API design “cron secret”; Vercel Cron | No paid scheduler; Docker/single-node must work offline |

---

## Decision 1 — Default retention is **14 days after soft-delete**

**Chose:** `DEFAULT_RETENTION_DAYS = 14`. Configurable 1–365 per org (`Organization.documentRetentionDays`), optional per engagement (`ExerciseSession.documentRetentionDays`), optional per upload (`retentionDays` on the form). Resolution order: upload → session → org → 14.

**Alternatives:** 7 days (too tight for weekend debrief + restore); 30/90 days (plans linger longer than a consulting engagement); upload+N with no close clock (punishes early upload).

**Why:** BRD §4, FR-DOC-02, and the Prisma sketch all say 14. FR-DOC-04’s default is N days after soft-delete, which gives a restore window after the room ends.

**Owner should check:** Whether 14 days after close matches client contracts / CERT-In / RBI data-handling addenda. Whether an engagement scheduled weeks after upload needs a longer **active** lifetime (we added a separate 365-day abandoned cap — Decision 2).

---

## Decision 2 — Abandoned active files cap at **365 days**

**Chose:** Active (never closed, never admin-deleted) documents become due for hard-delete 365 days after upload. Soft-deleted documents use close+N, even if that is later than the abandoned date (`max` of the two clocks at soft-delete).

**Alternatives:** No cap (FRS-pure; files live until close — a forgotten client org never purges); apply 14 days from upload to active files (breaks prep); 90-day cap.

**Why:** Threat model abuse case 1 (“consultant leaves IRP in DB”). A year is long enough for delayed engagements and short enough that forgotten tenants do not keep plans forever.

**Owner should check:** Legal max retention for client plans. If contracts require destruction at engagement end *only*, drop the 365-day cap.

---

## Decision 3 — Soft-delete on engagement close; hide everywhere except admin

**Chose:** Closing or archiving a session soft-deletes session-bound documents. Closing an **engagement** (`runKind=engagement`) also soft-deletes standing org-level IRP/CCMP for that org. Draft close does not touch org-level files. Soft-deleted rows are omitted from grading, org UI pointers, session document GET, and generic `/api/media`. Bytes stay on disk until hard-delete. Admin `/settings/uploads` lists them and can restore.

**Alternatives:** Soft-delete org plans on every session close (breaks rehearsals); never auto-soft-delete org plans (violates FR-DOC-03 / BRD step 8); copy-on-write a session snapshot and leave org files (more moving parts).

**Why:** Matches the typical one-engagement consulting flow in the BRD. Restore is one admin click if a second engagement is booked immediately.

**Owner should check:** Overlapping engagements for the same org. Today, ending engagement A hides standing plans from engagement B until restore or re-upload.

---

## Decision 4 — Scheduler: in-app interval + CLI + protected route

**Chose:** Shared idempotent `runRetentionSweep()` used by:

1. `instrumentation.ts` interval when `DOCUMENT_RETENTION_SWEEP_MS` ≥ 60000 (Compose default 1 hour). Env vars live in `lib/env.ts`. Logs use `lib/logger.ts` (pino JSON, secrets redacted).
2. `npm run retention:sweep` / `tsx scripts/retention-sweep.ts` for host cron (same logger).
3. `GET|POST /api/internal/retention/run` with `Authorization: Bearer` or `x-retention-secret` matching `RETENTION_CRON_SECRET` or `CRON_SECRET` (timing-safe). Empty secret → 401.

Sweep selects rows with `hardDeletedAt=null`, applies `isDueForHardDelete`, then `hardDeleteClientDocument`. Already-purged rows no-op. Operator runbook: [DEPLOY.md](../DEPLOY.md) § IRP/CCMP retention sweep.

**Alternatives:** Vercel Cron (platform lock-in; paid on some plans); OS cron only (easy to forget in Docker); Postgres `pg_cron` (extra extension).

**Why:** Task forbids paid services. API design already specified a cron-secret route. Single-node Docker needs a loop that does not depend on an external ping.

**Owner should check:** Set `RETENTION_CRON_SECRET` in every deployment. Confirm host cron if the Next.js process is not always on. Backup TTL vs hard-delete (threat model residual: backups may outlive purge).

---

## Decision 5 — Append-only `DocumentAuditEvent`

**Chose:** Actions `UPLOADED | VIEWED | DOWNLOADED | TEXT_EXTRACTED | SOFT_DELETED | RESTORED | HARD_DELETED`. Fields: actor, org, session, timestamp, target (document id and/or storage key), reason, optional meta. App writes only via `appendDocumentAudit` / `buildAuditEvent`. `documentAuditMutations` throw. Prisma `$extends` rejects `update` / `updateMany` / `delete` / `deleteMany` on this model. Hard-delete sets `documentId` SetNull but keeps the audit row.

**Alternatives:** Update-in-place status table (repudiation risk); DB triggers (belongs in migrations the other agent owns); separate audit product.

**Why:** Threat model §3.3; NFR-05; data model §2.7.

**Owner should check:** Whether VIEWED on every media hit is too noisy (we audit generic media views of plan files and admin downloads). Privileged DB users can still DELETE rows — Postgres grants are an ops concern.

---

## Decision 6 — PDF/DOCX extraction with caps, feeding grading

**Chose:** `pdfjs-dist` (Mozilla pdf.js, legacy Node build) and `mammoth` (DOCX). Text/markdown/csv via UTF-8. Legacy `.doc` is stored but extract=`skipped`. Caps: 20 MB extract, 50 pages, 200k chars stored, 4k chars sent to the grader (`GRADE_EXCERPT_CHARS`). Failures set `extractStatus=failed` and do not fail the upload. Soft/hard-deleted text is not sent to the model. Stage still never receives plan bodies.

**Alternatives:** `pdf-parse` (debug-file import hazard; same pdf.js underneath); send PDF bytes to the LLM (threat model: don’t); no page cap.

**Why:** Task asked for open-source pdf-parse/pdfjs + mammoth. Truncation matches “LLM is semi-trusted”.

**Owner should check:** Scanned PDFs (no text layer) will grade without clauses — upload DOCX/text or accept generic scoring. 50 pages may truncate long CCMPs; raise `EXTRACT_MAX_PAGES` if needed.

---

## Decision 7 — Storage stays on the local/volume filesystem

**Chose:** Reuse `writeMediaFile` / `deleteMediaFile` under `orgs/{orgId}/plans/`. ADR-004 option A for Docker; production S3 is still the stated target behind this helper.

**Alternatives:** S3 now (ops + credentials; out of slice); BYTEA in Postgres (backup bloat).

**Owner should check:** Volume backup TTL; encrypt-at-rest on the host disk; MEDIA_ROOT permissions in Docker (`/data/media`).

---

## Decision 8 — Admin surface and authorization

**Chose:** `/settings/uploads` (admin layout already `requirePageAdmin`). APIs under `/api/admin/documents*` use `requireApiAdmin`. Session metadata GET is facilitator-or-admin. Generic media returns 404 for hidden plans and 403 to non-admins for active plan files. Manual soft-delete / restore / hard-delete require an admin and a reason string.

**Alternatives:** New rail “Documents” item (extra chrome); facilitator-wide document admin (wider blast radius).

**Owner should check:** Whether facilitators should restore after close without an admin. FRS gives facilitators upload; restore is an admin break-glass in this PR.

---

## Decision 9 — Migration on top of the foundation baseline

**Chose:** Ship `prisma/migrations/20261009154325_client_documents_lifecycle` after `20261009120000_baseline`. Created with `prisma migrate dev --create-only` against scratch Postgres, then verified with `migrate deploy` on a DB that already had the baseline **and** on a fresh database (baseline + this migration). Production apply path is still `prisma migrate deploy` (image start / `npm run db:migrate:deploy`).

**Alternatives:** Keep `db push` (rejected by PR #3); squash into the baseline (would rewrite history of PR #3).

**Why:** Foundation PR owns the baseline. This PR only adds ClientDocument / DocumentAuditEvent / `documentRetentionDays`.

**Owner should check:** Existing `db push` databases must `migrate resolve --applied 20261009120000_baseline` **before** this second migration deploys.

---

## Data-protection implications

- Extracted text is a second copy of the plan. Hard-delete nulls it; audit meta must not include body text (it does not).
- LLM grading still receives up to 4k chars of active plans — vendor logs are a residual risk (threat model §6).
- Soft-delete is not destruction. Backups, Docker volumes, and crash dumps can outlive `hardDeletedAt`.
- SHA-256 of the file is stored for integrity; it is not a secret but identifies the document.

---

## Needs owner

1. Confirm **14-day post-close** default and **365-day abandoned** cap against client contracts.
2. Confirm engagement-close purging of **standing org plans** when two engagements overlap.
3. Set `RETENTION_CRON_SECRET` (and optionally host cron) in every real environment; do not leave the HTTP route unauthenticated.
4. Decide backup TTL ≤ retention, or document the exception as the threat model requires.
5. Revisit Facilitator vs Admin upload/restore once the parallel authZ PR merges.
6. Revisit MIME/magic-byte validation once the parallel validation PR merges (this PR kept the existing 20 MB allowlist).
7. Decide S3 cutover timing (ADR-004 production target).
8. Privacy note for clients: excerpts may reach the configured LLM provider.
9. Whether scanned PDFs need an OCR path (out of scope here).
