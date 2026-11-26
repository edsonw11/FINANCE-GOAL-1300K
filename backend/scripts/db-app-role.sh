#!/usr/bin/env bash
# Makes (or updates the password of) the API's least-privilege database role on a database that already exists,
# then applies its grants. Needs the OWNER's access, in one of two ways:
#   ADMIN_URL=postgresql://everfox:...@host:5432/everfox APP_DB_PASSWORD=... backend/scripts/db-app-role.sh
#   PSQL_CMD="docker compose exec -T db psql -U everfox -d everfox" APP_DB_PASSWORD=... backend/scripts/db-app-role.sh
set -euo pipefail
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
if [ -n "${PSQL_CMD:-}" ]; then
  read -r -a PSQL <<<"$PSQL_CMD"
else
  : "${ADMIN_URL:?ADMIN_URL (the owner connection URL) or PSQL_CMD is required}"
  PSQL=(psql "$ADMIN_URL")
fi
"${PSQL[@]}" -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE everfox_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'app_password')
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'everfox_app') \gexec
SELECT format('ALTER ROLE everfox_app PASSWORD %L', :'app_password') \gexec
-- the maintenance database is not for the API role
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
SQL
"${PSQL[@]}" -v ON_ERROR_STOP=1 <"$HERE/prisma/roles/grants.sql"
echo "role everfox_app ready"
