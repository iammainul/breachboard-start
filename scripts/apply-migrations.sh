#!/usr/bin/env bash
# Apply Prisma migrations (prisma migrate deploy).
# Local convenience: if the database was created with `prisma db push` (P3005),
# mark the baseline migration as applied. Production must NOT use --baseline;
# see docs/DEPLOY.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASELINE="${PRISMA_BASELINE_MIGRATION:-20261009120000_baseline}"
ALLOW_BASELINE=0
if [[ "${1:-}" == "--baseline" ]]; then
  ALLOW_BASELINE=1
fi

npx prisma generate >/dev/null

set +e
deploy_output="$(npx prisma migrate deploy 2>&1)"
deploy_status=$?
set -e
printf '%s\n' "$deploy_output"

if [[ "$deploy_status" -eq 0 ]]; then
  exit 0
fi

if [[ "$ALLOW_BASELINE" -eq 1 ]] && printf '%s' "$deploy_output" | grep -q 'P3005'; then
  echo "Database schema is not empty (typical after prisma db push). Baselining ${BASELINE}…"
  echo "See docs/DEPLOY.md — this marks the baseline as already applied; it does not re-run SQL."
  npx prisma migrate resolve --applied "$BASELINE"
  npx prisma migrate deploy
  exit 0
fi

if printf '%s' "$deploy_output" | grep -q 'P3005'; then
  echo "Database is not empty and has no migration history." >&2
  echo "If this database was created with prisma db push, baseline it once:" >&2
  echo "  npx prisma migrate resolve --applied ${BASELINE}" >&2
  echo "  npx prisma migrate deploy" >&2
  echo "Details: docs/DEPLOY.md" >&2
fi

exit "$deploy_status"
