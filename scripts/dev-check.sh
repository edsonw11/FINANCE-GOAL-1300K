#!/usr/bin/env bash
# Proves the local stack works end to end (what "clean-machine start" means): health, the login redirect, the app page and its headers,
# the data-only database role, and that the demo people have their own data and cannot see each other's.
# Usage: scripts/dev-check.sh   (the stack must be up: scripts/dev.sh up)
set -uo pipefail
cd "$(dirname "$0")/.."
API="http://localhost:${API_PORT:-3000}"
FAILED=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; FAILED=1; }
expect() { # label, command that must succeed
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else bad "$label"; fi
}

expect "the API answers ready"            bash -c "curl -fsS $API/health/ready | grep -q ."
expect "/auth/login sends the browser to the login server" bash -c "curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $API/auth/login | grep -qE '^302 http://localhost:[0-9]+/realms/everfox/'"
expect "the app page is served with its security headers" bash -c "curl -sI $API/ | tr -d '\r' | grep -qi '^content-security-policy:' && curl -sI $API/ | grep -qi '^x-content-type-options: nosniff'"
expect "an API route without a session is refused (401)" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' $API/api/v1/me)\" = 401 ]"

# the API must be running as the data-only role
ROLE="$(docker compose exec -T db psql -U everfox -d everfox -At -c "SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='everfox_app'" 2>/dev/null)"
[ "$ROLE" = "f" ] && ok "the API's database role has no admin powers" || bad "the API's database role is missing or too powerful ($ROLE)"

# people and their data, through the real login
node --input-type=module - "$API" <<'JS' && ok "alice has demo data, bob has his own, and neither sees the other's" || bad "data per person"
import { execFileSync } from 'node:child_process';
const api = process.argv[2];
const run = (who) => execFileSync('node', ['scripts/dev-export.mjs', who], { encoding: 'utf8', env: { ...process.env, API_URL: api } });
const a = JSON.parse(run('alice')), b = JSON.parse(run('bob'));
if (!(a.tx?.length > 100)) throw new Error('alice has no demo transactions');
if (!(b.tx?.length > 0 && b.tx.length < a.tx.length)) throw new Error('bob should have his own, smaller data');
if (a.goal === b.goal) throw new Error('both people have the same goal: not separate');
if (JSON.stringify(a).includes('"goal":500000')) throw new Error("alice sees bob's goal");
JS

[ "$FAILED" = 0 ] && echo "DEV STACK OK" || { echo "DEV STACK CHECK FAILED"; exit 1; }
