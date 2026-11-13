#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

MODE="${1:-dev}"
ENV_FILE=".env.local"
DOCKER_ENV_FILE=".env"
APP_URL_DEV="http://localhost:3000"
APP_URL_DOCKER="http://localhost:3080"

usage() {
  cat <<'EOF'
Usage: ./run.sh [dev|docker|clean|reseed] [--rebuild]

  dev     Local development (default)
          - starts Postgres via Docker
          - installs deps, applies migrations, seeds ATT&CK
          - runs Next.js on http://localhost:3000

  docker  Full stack in Docker
          - starts app + Postgres (uses image cache; fast restart)
          - open http://localhost:3080
          - pass --rebuild to force a fresh image build

  clean   Wipe the database, reseed ATT&CK + library + demo org, start dev
  reseed  Keep the schema; rebuild demo org/session/players only

Examples:
  ./run.sh
  ./run.sh dev
  ./run.sh docker
  ./run.sh docker --rebuild
  ./run.sh clean
  ./run.sh reseed

Production host (Postgres unpublished, app on 127.0.0.1:3080):
  ./scripts/deploy.sh
EOF
}

log() {
  printf '\n▸ %s\n' "$1"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_env_file() {
  local target="$1"
  local example="$2"

  if [[ -f "$target" ]]; then
    return
  fi

  if [[ ! -f "$example" ]]; then
    echo "Missing $example — cannot create $target" >&2
    exit 1
  fi

  cp "$example" "$target"
  log "Created $target from $example — review it before production use."
}

ensure_auth_secret() {
  local file="$1"
  if grep -q '^AUTH_SECRET="replace-with-a-long-random-string"$' "$file" 2>/dev/null; then
    local secret
    secret="$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)"
    sed -i "s|^AUTH_SECRET=\"replace-with-a-long-random-string\"|AUTH_SECRET=\"$secret\"|" "$file"
    log "Generated AUTH_SECRET in $file"
  fi
}

load_env() {
  local file="$1"
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

apply_migrations() {
  local extra=()
  if [[ "${1:-}" == "--baseline" ]]; then
    extra=(--baseline)
  fi
  bash "$ROOT/scripts/apply-migrations.sh" "${extra[@]}"
}

run_dev() {
  need_cmd node
  need_cmd npm
  need_cmd docker

  ensure_env_file "$ENV_FILE" ".env.example"
  ensure_auth_secret "$ENV_FILE"
  load_env "$ENV_FILE"

  if [[ ! -d node_modules ]]; then
    log "Installing npm dependencies…"
    npm install
  fi

  log "Starting Postgres (host port 5433)…"
  docker compose up -d db

  log "Waiting for Postgres…"
  for _ in $(seq 1 40); do
    if docker compose exec -T db pg_isready -U ttx -d ttx >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  log "Applying database migrations…"
  apply_migrations --baseline

  log "Seeding ATT&CK subset…"
  npm run attack:seed

  log "Seeding scenario library templates…"
  npm run library:seed

  echo
  echo "Ready."
  echo "  App:    $APP_URL_DEV"
  echo "  Login:  \${OPERATOR_EMAIL} / \${OPERATOR_PASSWORD} from $ENV_FILE"
  echo
  echo "  Next: /settings/ai to add AI providers + sync advisories"
  echo

  exec npm run dev
}

wait_for_postgres() {
  log "Starting Postgres (host port 5433)…"
  docker compose up -d db
  log "Waiting for Postgres…"
  for _ in $(seq 1 40); do
    if docker compose exec -T db pg_isready -U ttx -d ttx >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready" >&2
  exit 1
}

run_reseed() {
  need_cmd node
  need_cmd npm
  need_cmd docker
  ensure_env_file "$ENV_FILE" ".env.example"
  ensure_auth_secret "$ENV_FILE"
  load_env "$ENV_FILE"
  if [[ ! -d node_modules ]]; then
    log "Installing npm dependencies…"
    npm install
  fi
  wait_for_postgres
  log "Applying database migrations…"
  apply_migrations --baseline
  log "Reseeding demo application…"
  npx tsx scripts/reseed-demo.ts
}

run_clean() {
  need_cmd node
  need_cmd npm
  need_cmd docker
  ensure_env_file "$ENV_FILE" ".env.example"
  ensure_auth_secret "$ENV_FILE"
  load_env "$ENV_FILE"
  if [[ ! -d node_modules ]]; then
    log "Installing npm dependencies…"
    npm install
  fi
  wait_for_postgres
  log "Resetting database (all app data will be deleted)…"
  npx prisma migrate reset --force --skip-seed
  log "Seeding ATT&CK + library + demo org…"
  npx tsx scripts/reseed-demo.ts
  echo
  echo "Clean demo is ready. Starting the app…"
  echo "  App:    $APP_URL_DEV"
  echo "  Login:  operator@local / value of OPERATOR_PASSWORD in $ENV_FILE"
  echo "  Join:   DEMO01"
  echo
  exec npm run dev
}

wait_for_app() {
  local url="$1"
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null "$url/api/health" 2>/dev/null || curl -sf -o /dev/null "$url" 2>/dev/null || curl -sf -o /dev/null "$url/login" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

ensure_docker_public_pulls() {
  # Docker Desktop on WSL sets credsStore=desktop.exe. With no Hub login in the
  # Windows keychain, BuildKit dies: "error getting credentials / dockerfile:1".
  # Anonymous pulls of public images (node, alpine) work without that helper.
  local cfg="${HOME}/.docker/config.json"
  if [[ -f "$cfg" ]] && grep -Eq '"credsStore"[[:space:]]*:[[:space:]]*"desktop(\.exe)?"' "$cfg"; then
    mkdir -p "$ROOT/.docker-cli"
    printf '%s\n' '{"auths":{}}' > "$ROOT/.docker-cli/config.json"
    export DOCKER_CONFIG="$ROOT/.docker-cli"
    log "Docker Hub: skipping desktop.exe credential helper (no Hub login in the keychain)."
  fi
}

run_docker() {
  need_cmd docker
  local rebuild=0
  for arg in "$@"; do
    case "$arg" in
      --rebuild|-r) rebuild=1 ;;
      -h|--help|help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown docker option: $arg" >&2
        usage
        exit 1
        ;;
    esac
  done

  ensure_env_file "$DOCKER_ENV_FILE" ".env.example"
  ensure_auth_secret "$DOCKER_ENV_FILE"
  load_env "$DOCKER_ENV_FILE"
  # Image runs NODE_ENV=production; these flags keep local compose usable.
  export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
  export SEED_DEMO="${SEED_DEMO:-true}"
  ensure_docker_public_pulls

  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1

  echo
  echo "Starting Docker stack…"
  echo "  App:    $APP_URL_DOCKER"
  echo "  Login:  \${OPERATOR_EMAIL} / \${OPERATOR_PASSWORD} from $DOCKER_ENV_FILE"
  if [[ "$rebuild" -eq 1 ]]; then
    echo "  Mode:   forced rebuild"
  else
    echo "  Mode:   cache-friendly (./run.sh docker --rebuild to force)"
  fi
  echo

  if [[ "$rebuild" -eq 1 ]]; then
    log "Forced rebuild (no cache)…"
    docker compose build --no-cache --pull
  else
    # BuildKit cache makes this near-instant when Dockerfile/deps are unchanged.
    docker compose build
  fi

  docker compose up -d

  log "Waiting for app at $APP_URL_DOCKER …"
  if wait_for_app "$APP_URL_DOCKER"; then
    echo
    echo "Ready."
    echo "  Open $APP_URL_DOCKER"
    echo "  Logs: docker compose logs -f app"
    echo
  else
    echo "Stack started but app not reachable yet — check: docker compose logs -f app" >&2
  fi

  exec docker compose logs -f app
}

case "$MODE" in
  dev) run_dev ;;
  clean) run_clean ;;
  reseed) run_reseed ;;
  docker)
    shift || true
    run_docker "$@"
    ;;
  -h|--help|help) usage ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage
    exit 1
    ;;
esac
