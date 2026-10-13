#!/usr/bin/env bash
# Start Breachboard with Docker. Clones the application repo, then builds and runs it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${BREACHBOARD_DIR:-$ROOT/app}"
APP_REPO="${BREACHBOARD_REPO:-https://github.com/iammainul/breachboard.git}"
APP_REF="${BREACHBOARD_REF:-master}"
APP_URL="${BREACHBOARD_URL:-http://localhost:3080}"

usage() {
  cat <<'EOF'
Usage: ./start.sh [--rebuild] [--stop] [--logs]

  (default)  Clone the application if needed, then build and start Docker.
             Open http://localhost:3080
  --rebuild  Rebuild the image without cache, then start
  --stop     Stop the stack (keeps the database and media volumes)
  --logs     Follow application logs

The application repository is private. git must already be able to read it
(GitHub login, SSH, or a credential helper).

Environment:
  BREACHBOARD_REPO   clone URL
  BREACHBOARD_REF    branch or tag (default: master)
  BREACHBOARD_DIR    checkout directory (default: ./app)
  BREACHBOARD_URL    URL to wait for (default: http://localhost:3080)
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

ensure_docker_public_pulls() {
  local cfg="${HOME}/.docker/config.json"
  if [[ -f "$cfg" ]] && grep -Eq '"credsStore"[[:space:]]*:[[:space:]]*"desktop(\.exe)?"' "$cfg"; then
    mkdir -p "$ROOT/.docker-cli"
    printf '%s\n' '{"auths":{}}' > "$ROOT/.docker-cli/config.json"
    export DOCKER_CONFIG="$ROOT/.docker-cli"
    log "Docker Hub: skipping desktop credential helper so public base images can pull."
  fi
}

ensure_checkout() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Application checkout: $APP_DIR"
    return
  fi
  if [[ -e "$APP_DIR" ]]; then
    echo "$APP_DIR exists but is not a git checkout." >&2
    exit 1
  fi
  log "Cloning $APP_REPO ($APP_REF)…"
  if ! git clone --branch "$APP_REF" --single-branch "$APP_REPO" "$APP_DIR"; then
    echo "Could not clone the application. The repo is private — sign in to GitHub and retry." >&2
    exit 1
  fi
}

ensure_env_file() {
  local target="$APP_DIR/.env"
  if [[ -f "$target" ]]; then
    return
  fi
  if [[ ! -f "$ROOT/.env.example" ]]; then
    echo "Missing $ROOT/.env.example" >&2
    exit 1
  fi
  cp "$ROOT/.env.example" "$target"
  log "Created $target from .env.example"
}

ensure_auth_secret() {
  local file="$APP_DIR/.env"
  if grep -q '^AUTH_SECRET="replace-with-a-long-random-string"$' "$file" 2>/dev/null; then
    local secret
    secret="$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)"
    sed -i "s|^AUTH_SECRET=\"replace-with-a-long-random-string\"|AUTH_SECRET=\"$secret\"|" "$file"
    log "Generated AUTH_SECRET in app/.env"
  fi
}

load_env() {
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
}

wait_for_app() {
  local url="$1"
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null "$url/api/health" 2>/dev/null \
      || curl -sf -o /dev/null "$url/login" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

compose() {
  docker compose --project-directory "$APP_DIR" "$@"
}

stop_stack() {
  need_cmd docker
  if [[ ! -d "$APP_DIR" ]]; then
    echo "No application checkout at $APP_DIR" >&2
    exit 1
  fi
  compose down
  echo "Stopped. Database and media volumes were kept."
}

follow_logs() {
  need_cmd docker
  compose logs -f app
}

run_start() {
  local rebuild=0
  if [[ "${1:-}" == "--rebuild" ]]; then
    rebuild=1
  fi

  need_cmd docker
  need_cmd git
  need_cmd curl
  ensure_docker_public_pulls
  ensure_checkout
  ensure_env_file
  ensure_auth_secret
  load_env

  # Local Docker matches ./run.sh docker: production image, demo seed allowed.
  # A real host should set both to false in app/.env before starting.
  export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
  export SEED_DEMO="${SEED_DEMO:-true}"
  export AUTH_URL="${AUTH_URL:-$APP_URL}"
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1

  echo
  echo "Starting Breachboard…"
  echo "  App:    $APP_URL"
  echo "  Source: $APP_DIR ($APP_REF)"
  echo "  Login:  OPERATOR_EMAIL / OPERATOR_PASSWORD from app/.env"
  echo

  if [[ "$rebuild" -eq 1 ]]; then
    log "Rebuilding image without cache…"
    compose build --no-cache --pull
  else
    log "Building image…"
    compose build
  fi

  compose up -d

  log "Waiting for $APP_URL …"
  if wait_for_app "$APP_URL"; then
    echo
    echo "Ready."
    echo "  Open $APP_URL"
    echo "  Guide: docs/guide/README.md"
    echo "  Logs:  ./start.sh --logs"
    echo
  else
    echo "Stack is up but the app is not reachable yet. Run: ./start.sh --logs" >&2
    exit 1
  fi
}

main() {
  case "${1:-}" in
    -h|--help|help) usage ;;
    --stop) stop_stack ;;
    --logs) follow_logs ;;
    --rebuild) run_start --rebuild ;;
    "") run_start ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
