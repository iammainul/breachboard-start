#!/usr/bin/env bash
# Production server for Playwright: Next `output: "standalone"` cannot be
# served with `next start`. Same layout as the Docker image.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PLAYWRIGHT_PORT:-${PORT:-3010}}"
STANDALONE="$ROOT/.next/standalone"

if [[ ! -f "$STANDALONE/server.js" ]]; then
  echo "Missing $STANDALONE/server.js — run npm run build first." >&2
  exit 1
fi

mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/.next/static"
cp -a "$ROOT/.next/static" "$STANDALONE/.next/static"
if [[ -d "$ROOT/public" ]]; then
  rm -rf "$STANDALONE/public"
  cp -a "$ROOT/public" "$STANDALONE/public"
fi

export PORT
export HOSTNAME="${HOSTNAME:-127.0.0.1}"
export MEDIA_ROOT="${MEDIA_ROOT:-$ROOT/data/media}"
cd "$STANDALONE"
exec node server.js
