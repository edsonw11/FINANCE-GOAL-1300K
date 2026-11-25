#!/usr/bin/env bash
# One command for the whole local environment (database, login server, migrations, API and the app), with demo data.
#   scripts/dev.sh up        check the machine, build and start everything, wait until it is healthy, load demo data, say where to go
#   scripts/dev.sh seed      load (again) the demo data for alice and bob
#   scripts/dev.sh status    what is running
#   scripts/dev.sh logs [s]  follow the logs (all services, or one: api, db, keycloak)
#   scripts/dev.sh check     prove the stack works end to end (scripts/dev-check.sh)
#   scripts/dev.sh down      stop (the data stays)
#   scripts/dev.sh reset     stop and DELETE the local data, then start again from zero
# Same through npm: npm run dev:up | dev:seed | dev:status | dev:check | dev:down | dev:reset
set -euo pipefail
cd "$(dirname "$0")/.."
API_PORT="${API_PORT:-3000}" DB_PORT="${DB_PORT:-5433}" KEYCLOAK_PORT="${KEYCLOAK_PORT:-8081}"
export API_URL="http://localhost:${API_PORT}"

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

preflight() {
  command -v docker >/dev/null || die "docker is not installed (https://docs.docker.com/get-docker/)"
  docker info >/dev/null 2>&1 || die "the Docker daemon is not running (start Docker, then try again)"
  docker compose version >/dev/null 2>&1 || die "'docker compose' (v2) is missing"
  command -v node >/dev/null || die "node is needed for the demo data (Node 20 or newer)"
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node 20 or newer is needed (found $(node -v))"
  # a port in use by something else would make the start fail later with a confusing message
  local mine busy=""
  mine="$(docker compose ps --format '{{.Service}}' 2>/dev/null | tr '\n' ' ')"
  for pair in "api:$API_PORT" "db:$DB_PORT" "keycloak:$KEYCLOAK_PORT"; do
    local svc="${pair%%:*}" port="${pair##*:}"
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && [[ " $mine " != *" $svc "* ]]; then busy="$busy $port($svc)"; fi
  done
  [ -z "$busy" ] || die "port(s) already in use by another program:$busy. Stop it, or choose others: API_PORT=… DB_PORT=… KEYCLOAK_PORT=… scripts/dev.sh up"
}

cmd_up() {
  preflight
  say "starting the stack (the first run builds the API image, it can take a few minutes)…"
  docker compose up -d --build --wait --wait-timeout 300 || { docker compose ps; die "the stack did not become healthy; see: scripts/dev.sh logs"; }
  say "loading demo data…"
  node scripts/dev-seed.mjs alice bob
  cat <<MSG

Everfox is running.
  App          http://localhost:${API_PORT}      (sign in: alice / alice-dev-password, or bob / bob-dev-password; both have demo data)
  Health       http://localhost:${API_PORT}/health/ready
  Login server http://localhost:${KEYCLOAK_PORT}   (admin / admin_dev_only, development only)
  Database     127.0.0.1:${DB_PORT}  (user everfox, password in docker-compose.yml, development only)
Stop: scripts/dev.sh down      Start over from zero: scripts/dev.sh reset      Prove it works: scripts/dev.sh check
MSG
}

case "${1:-}" in
  up) cmd_up ;;
  seed) node scripts/dev-seed.mjs alice bob ;;
  status) docker compose ps ;;
  logs) shift; docker compose logs -f --tail=100 "$@" ;;
  check) bash scripts/dev-check.sh ;;
  down) docker compose down ;;
  reset) docker compose down -v --remove-orphans; cmd_up ;;
  *) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; [ -z "${1:-}" ] || exit 2 ;;
esac
