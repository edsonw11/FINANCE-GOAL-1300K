#!/usr/bin/env bash
# Proves that a backup can be restored: dumps the database, restores the dump into a scratch database, and compares the number of rows
# of every table (and a checksum of the people/records content). A backup that was never restored is a hope, not a backup.
# Usage: scripts/backup-restore-test.sh            uses the compose database (`docker compose up -d db`)
#        PSQL_EXEC="docker compose exec -T db" scripts/backup-restore-test.sh    to name another way to reach the database tools
set -euo pipefail
cd "$(dirname "$0")/.."
EXEC="${PSQL_EXEC:-docker compose exec -T db}"
DB="${BACKUP_DB:-everfox}" USER_="${BACKUP_USER:-everfox}" SCRATCH="everfox_restore_test"
OUT="${BACKUP_FILE:-$(mktemp -d)/everfox.dump}"
psql_() { $EXEC psql -U "$USER_" -v ON_ERROR_STOP=1 -At "$@"; }
cleanup() { psql_ -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

sum_() { psql_ -d "$1" -c "SELECT count(*) || ':' || coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), '') FROM \"$2\" x"; }
TABLES="$(psql_ -d "$DB" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")"
[ -n "$TABLES" ] || { echo "FAIL: no tables found"; exit 1; }
declare -A BEFORE
for t in $TABLES; do BEFORE[$t]="$(sum_ "$DB" "$t")"; done

echo "1. dump $DB (custom format, no owner/privileges so it restores anywhere)"
$EXEC pg_dump -U "$USER_" -d "$DB" --format=custom --no-owner --no-privileges > "$OUT"
[ -s "$OUT" ] || { echo "FAIL: empty dump"; exit 1; }
echo "   $(wc -c < "$OUT") bytes -> $OUT"

echo "2. restore into a scratch database"
cleanup
psql_ -d postgres -c "CREATE DATABASE $SCRATCH" >/dev/null
$EXEC pg_restore -U "$USER_" -d "$SCRATCH" --no-owner --exit-on-error < "$OUT"

echo "3. compare every table (the source may change while the API runs: a table matching its state before or after the dump is fine)"
BAD=0
for t in $TABLES; do
  A="${BEFORE[$t]}"; A2="$(sum_ "$DB" "$t")"; B="$(sum_ "$SCRATCH" "$t")"
  if [ "$B" = "$A" ] || [ "$B" = "$A2" ]; then echo "   ok   $t (${B%%:*} rows)";
  elif [ "$A" != "$A2" ]; then echo "   live $t changed during the test (${A%%:*} -> ${A2%%:*} rows, restored ${B%%:*}); not compared";
  else echo "   DIFF $t: source $A vs restored $B"; BAD=1; fi
done
[ "$BAD" = 0 ] && echo "BACKUP RESTORE OK" || { echo "BACKUP RESTORE FAILED"; exit 1; }
