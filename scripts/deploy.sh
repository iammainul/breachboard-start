#!/usr/bin/env bash
# One-shot production boot for a single host.
# Uses docker-compose.prod.yml: Postgres is not published, the app listens on
# 127.0.0.1:3080, and dev seed flags are forced off.
# Does not touch the local `./run.sh docker` project.
#
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh --rebuild
#   ./scripts/deploy.sh --baseline   # once, for a database created with db push
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="breachboard"
ENV_FILE=".env"
APP_URL="http://127.0.0.1:3080"
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.prod.yml)

rebuild=0
baseline=0
for arg in "$@"; do
  case "$arg" in
    --rebuild|-r) rebuild=1 ;;
    --baseline) baseline=1 ;;
    -h|--help|help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need docker
need openssl

if [[ -f "${HOME}/.docker/config.json" ]] && grep -Eq '"credsStore"[[:space:]]*:[[:space:]]*"desktop(\.exe)?"' "${HOME}/.docker/config.json"; then
  mkdir -p "$ROOT/.docker-cli"
  printf '%s\n' '{"auths":{}}' > "$ROOT/.docker-cli/config.json"
  export DOCKER_CONFIG="$ROOT/.docker-cli"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example"
fi

set_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

rand() {
  openssl rand -base64 32 | tr -d '\n'
}

current() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d '"'
}

if [[ "$(current AUTH_SECRET)" == "replace-with-a-long-random-string" || -z "$(current AUTH_SECRET)" ]]; then
  set_kv AUTH_SECRET "$(rand)"
  echo "Generated AUTH_SECRET in $ENV_FILE"
fi

if [[ "$(current OPERATOR_PASSWORD)" == "change-me" || -z "$(current OPERATOR_PASSWORD)" ]]; then
  operator_password="$(rand)"
  set_kv OPERATOR_PASSWORD "$operator_password"
  echo "Generated OPERATOR_PASSWORD. Sign in once with operator@local / the value now in $ENV_FILE, then change it."
fi

if [[ -z "$(current RETENTION_CRON_SECRET)" ]]; then
  set_kv RETENTION_CRON_SECRET "$(rand)"
  echo "Generated RETENTION_CRON_SECRET in $ENV_FILE"
fi

volume="$(docker volume ls -q | grep -E '^breachboard_.*ttx_pg$' || true)"
if [[ -z "$volume" ]]; then
  if [[ -z "$(current POSTGRES_PASSWORD)" || "$(current POSTGRES_PASSWORD)" == "ttx" ]]; then
    set_kv POSTGRES_PASSWORD "$(rand)"
    echo "Generated POSTGRES_PASSWORD in $ENV_FILE (new database volume)."
  fi
elif [[ -z "$(current POSTGRES_PASSWORD)" ]]; then
  echo "Database volume already exists and $ENV_FILE has no POSTGRES_PASSWORD." >&2
  echo "Set POSTGRES_PASSWORD to the password that volume was created with, then re-run." >&2
  exit 1
fi

auth_url="$(current AUTH_URL)"
if [[ -z "$auth_url" || "$auth_url" == "http://localhost:3000" || "$auth_url" == "http://localhost:3080" ]]; then
  set_kv AUTH_URL "http://127.0.0.1:3080"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "$baseline" -eq 1 ]]; then
  export BASELINE_DB_PUSH=true
else
  export BASELINE_DB_PUSH=false
fi
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

port_busy=0
if ss -ltn 2>/dev/null | grep -q ':3080 ' || netstat -ltn 2>/dev/null | grep -q ':3080 '; then
  port_busy=1
fi
prod_app="$("${COMPOSE[@]}" ps --status running --format '{{.Service}}' 2>/dev/null | grep -x app || true)"
if [[ "$port_busy" -eq 1 && -z "$prod_app" ]]; then
  echo "Port 3080 is already in use. Stop the local stack first: docker compose down" >&2
  exit 1
fi

echo "Building and starting project ${PROJECT} (app on ${APP_URL}, Postgres not published)."
if [[ "$rebuild" -eq 1 ]]; then
  "${COMPOSE[@]}" build --pull
else
  "${COMPOSE[@]}" build
fi
"${COMPOSE[@]}" up -d

echo "Waiting for ${APP_URL}/api/health?ready=1"
ready=0
for _ in $(seq 1 60); do
  if curl -sf "${APP_URL}/api/health?ready=1" >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "App did not become ready. Logs: docker compose -p ${PROJECT} -f docker-compose.yml -f docker-compose.prod.yml logs app" >&2
  exit 1
fi

echo "Ready: ${APP_URL}"
echo "Put TLS in front of 127.0.0.1:3080 and set AUTH_URL to that https origin before anyone else uses it."
echo "Backup: ./scripts/backup.sh --prod"
