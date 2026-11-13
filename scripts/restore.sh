#!/usr/bin/env bash
# Restore Postgres (pg_restore) and the uploads/media directory from a backup
# produced by scripts/backup.sh.
# Usage: ./scripts/restore.sh [--prod] <backup-dir>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--prod" ]]; then
  shift
  export COMPOSE_PROJECT_NAME=breachboard
  export COMPOSE_FILE="$ROOT/docker-compose.yml:$ROOT/docker-compose.prod.yml"
fi

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [--prod] <backup-dir>" >&2
  echo "Restores postgres.dump and media.tar.gz. This overwrites the live database and media files." >&2
  exit 1
fi

SRC="$1"
if [[ ! -d "$SRC" ]]; then
  echo "Backup directory not found: $SRC" >&2
  exit 1
fi
if [[ ! -f "$SRC/postgres.dump" ]]; then
  echo "Missing $SRC/postgres.dump" >&2
  exit 1
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

db_running() {
  command -v docker >/dev/null 2>&1 && docker compose ps --status running db >/dev/null 2>&1
}

echo "▸ Restoring Postgres from $SRC/postgres.dump"
if db_running; then
  docker compose exec -T db pg_restore -U ttx -d ttx --clean --if-exists --no-owner --no-acl < "$SRC/postgres.dump"
elif [[ -n "${DATABASE_URL:-}" ]] && command -v pg_restore >/dev/null 2>&1; then
  pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl "$SRC/postgres.dump"
else
  echo "Need a running compose db service or pg_restore + DATABASE_URL" >&2
  exit 1
fi

MEDIA_HOST="${MEDIA_ROOT:-$ROOT/data/media}"
if [[ ! -f "$SRC/media.tar.gz" ]]; then
  echo "No media.tar.gz in backup; skipping media restore."
  echo "Restore complete (database only)."
  exit 0
fi

echo "▸ Restoring media from $SRC/media.tar.gz"
if docker compose ps --status running app >/dev/null 2>&1; then
  docker compose exec -T app sh -c 'mkdir -p /data/media && tar -xzf - -C /data/media' < "$SRC/media.tar.gz"
elif [[ -n "${MEDIA_ROOT:-}" ]]; then
  mkdir -p "$MEDIA_ROOT"
  tar -xzf "$SRC/media.tar.gz" -C "$MEDIA_ROOT"
elif [[ -n "${MEDIA_HOST:-}" ]]; then
  mkdir -p "$MEDIA_HOST"
  tar -xzf "$SRC/media.tar.gz" -C "$MEDIA_HOST"
else
  VOLUME="$(docker volume ls -q | grep 'ttx_media$' | head -n 1 || true)"
  if [[ -z "$VOLUME" ]]; then
    echo "Could not find media destination (MEDIA_ROOT, app container, or ttx_media volume)" >&2
    exit 1
  fi
  docker run --rm -v "$VOLUME":/data/media -v "$SRC":/backup:ro alpine:3.20 \
    sh -c 'mkdir -p /data/media && tar -xzf /backup/media.tar.gz -C /data/media'
fi

echo "Restore complete. If the schema predates Prisma migrate, run:"
echo "  npx prisma migrate resolve --applied 20261009120000_baseline"
echo "  npx prisma migrate deploy"
