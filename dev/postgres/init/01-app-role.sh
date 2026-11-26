#!/bin/sh
# Runs once, when the local database is first created (docker-entrypoint-initdb.d): makes the role the API connects with.
# It may only read and write data. The owner (POSTGRES_USER) is used for migrations and nothing else.
# For a database that already exists: scripts/db-app-role.sh (in backend/).
set -eu
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE everfox_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'app_password')
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'everfox_app') \gexec
-- the maintenance database is not for the API role
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
SQL
