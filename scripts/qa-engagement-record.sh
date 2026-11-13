#!/usr/bin/env bash
# Run the QA engagement POV Playwright test with video, then copy the recording
# into docs/qa/recordings/ for the onboarding / QA guide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT_DIR="$ROOT/docs/qa/recordings"
mkdir -p "$OUT_DIR"

# Free the Playwright port if a previous run left a hung Next server.
PORT="${PLAYWRIGHT_PORT:-3010}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti ":${PORT}" | xargs -r kill -9 2>/dev/null || true
fi
sleep 1

echo "==> QA engagement POV (Playwright + video) on :${PORT}"
if [[ ! -d "$ROOT/.next" ]]; then
  echo "==> Production build (Playwright runs the standalone server)"
  npm run build
fi
# PLAYWRIGHT_QA enables the video project. CI=1 forces a fresh webServer.
CI=1 PLAYWRIGHT_QA=1 npx playwright test tests/e2e/qa-engagement-pov.spec.ts --project=qa

LATEST="$(find "$ROOT/test-results" -type f -name '*.webm' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"
if [[ -z "${LATEST:-}" ]]; then
  LATEST="$(find "$ROOT/test-results" -type f -name '*.webm' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
fi

if [[ -n "${LATEST:-}" && -f "$LATEST" ]]; then
  DEST="$OUT_DIR/qa-engagement-pov.webm"
  cp -f "$LATEST" "$DEST"
  cat > "$OUT_DIR/qa-engagement-pov.json" <<EOF
{
  "recordedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "$LATEST",
  "dest": "$DEST"
}
EOF
  echo "==> Stored facilitator POV video: $DEST"
  ls -lh "$DEST"
else
  echo "!! No .webm found under test-results — check Playwright output" >&2
  exit 1
fi
