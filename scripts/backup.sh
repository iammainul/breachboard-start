#!/usr/bin/env bash
# Backup Postgres (pg_dump custom format) and the uploads/media directory.
# Usage: ./scripts/backup.sh [--prod] [output-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--prod" ]]; then
  shift
  export COMPOSE_PROJECT_NAME=breachboard
  export COMPOSE_FILE="$ROOT/docker-compose.yml:$ROOT/docker-compose.prod.yml"
fi

load_env() {
  local file
  for file in .env.local .env; do
    if [[ -f "$file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$file"
      set +a
      return
    fi
  done
}

load_env

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${1:-$ROOT/backups/$STAMP}"
mkdir -p "$OUT"

db_running() {
  command -v docker >/dev/null 2>&1 && docker compose ps --status running db >/dev/null 2>&1
}

echo "▸ Postgres dump → $OUT/postgres.dump"
if db_running; then
  docker compose exec -T db pg_dump -U ttx -d ttx --format=custom --no-owner --no-acl > "$OUT/postgres.dump"
elif [[ -n "${DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null 2>&1; then
  pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUT/postgres.dump"
else
  echo "Need a running compose db service or pg_dump + DATABASE_URL" >&2
  exit 1
fi

MEDIA_HOST="${MEDIA_ROOT:-$ROOT/data/media}"
echo "▸ Media archive → $OUT/media.tar.gz"
if docker compose ps --status running app >/dev/null 2>&1; then
  docker compose exec -T app tar -czf - -C /data/media . > "$OUT/media.tar.gz"
elif [[ -n "${MEDIA_ROOT:-}" && -d "$MEDIA_ROOT" ]]; then
  tar -czf "$OUT/media.tar.gz" -C "$MEDIA_ROOT" .
elif [[ -d "$MEDIA_HOST" ]]; then
  tar -czf "$OUT/media.tar.gz" -C "$MEDIA_HOST" .
elif command -v docker >/dev/null 2>&1 && docker volume ls -q | grep -q 'ttx_media$'; then
  VOLUME="$(docker volume ls -q | grep 'ttx_media$' | head -n 1)"
  docker run --rm -v "$VOLUME":/data/media:ro -v "$OUT":/backup alpine:3.20 \
    tar -czf /backup/media.tar.gz -C /data/media .
else
  echo "No media directory found; writing empty archive."
  tar -czf "$OUT/media.tar.gz" -T /dev/null
fi

cat > "$OUT/manifest.txt" <<EOF
created_at=$STAMP
postgres=postgres.dump
media=media.tar.gz
EOF

echo "Backup complete: $OUT"
echo "  postgres.dump  media.tar.gz  manifest.txt"
