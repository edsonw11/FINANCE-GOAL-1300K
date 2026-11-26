# Backend integration tests

## What CI does (`.github/workflows/ci.yml`, job `backend`)

1. A throwaway PostgreSQL 18.7 service container (`everfox` owner, database `everfox`).
2. `DATABASE_URL` is the **data-only** role `everfox_app`; `MIGRATE_DATABASE_URL` is the owner.
3. `npm ci`, audit, typecheck, `npm test` (unit), `npm run build`.
4. `backend/scripts/db-app-role.sh` creates the `everfox_app` role; `npm run db:migrate` applies the migrations to the empty database and then `prisma/roles/grants.sql`.
5. A throwaway Keycloak (`docker compose up -d --wait keycloak`, development realm) for the login tests.
6. `npm run test:integration` (`vitest.integration.config.mts`: files one at a time, 30 s limits).

Variables: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `APP_BASE_URL`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. The tests fail loudly (no skip) when `DATABASE_URL` is missing, so a green run means something.

## What was run here (2026-11-26)

| Step | Result |
|---|---|
| Database | A **new throwaway container** `postgres:18.7-alpine3.24` on `127.0.0.1:55432`, data on tmpfs, password used only for this run. The project's own development database (`everfox-db-1`, port 5433) was **not** touched. |
| Role and migrations | `db-app-role.sh` and `npm run db:migrate`: 5 migrations applied, `_prisma_migrations` has 5 rows. |
| Keycloak | The development Keycloak that was already running (`localhost:8081`, development realm). The login tests only log in as the development users. |
| `npm run test:integration` | **14 files, 209 tests, all passed** (123 s). |
| Same suite, files and tests shuffled, on the database already used by the first run (seed 7) | **14 files, 209 tests, all passed** (110 s). No order dependence and no leftover-data dependence found in that run. |
| Clean up | The container was removed. |

Only one shuffle seed was run for the integration suite; this is evidence, not proof.

## Backend unit tests: order and load

- `npx vitest run`: 35 files, 855 tests, all passed.
- Shuffling the **order of files** (seeds 11 and 23): passed, except one run of seed 23 where `web.http.test.ts` failed with `Hook timed out in 10000ms`. The machine load average was about 25. This is a timing limit, not a logic error. `backend/vitest.config.mts` now has `hookTimeout: 30_000` (the integration config already had it), and the file passed afterwards.
- Shuffling the order of the **tests inside a file** (`--sequence.shuffle.tests`): in round 2, 12 tests in 5 files failed (`legacy.http`, `sync.http`, `plans.http`, `app`): the files were written as a story on one shared application (a second import answers 409 because the first one ran; the administrator's plan change from one test was seen by the next; an application that was closed could not be reopened).

## Round 3: the order dependence is removed

Cause, per file: one application, in-memory storage and logged-in people shared by all tests of the file (`beforeAll`), plus tests that read what an earlier test had stored.

| File | Shared state | Fix |
|---|---|---|
| `http/legacy.http.test.ts` | app, storage, alice and bob; the baseline imported by one test and read by the months tests; "a second import is 409" needed the first import | `beforeEach` creates an application per test; the tests that need data import it themselves (the months block has its own `beforeEach`) |
| `http/plans.http.test.ts` | app, plan table, audit log, administrator flag; "turning it on again" and "turns it off" needed the previous enable | per-test application; those two tests do their own first step |
| `http/sync.http.test.ts` | app and the change feed (`toEqual([])` on a feed another test had filled) | per-test application |
| `app.test.ts` | one application, and the last test closed it | per-test application; the comment "keep this one last" is gone |

Not a fix by hiding: no shuffle was switched off, no order was fixed, no test was skipped. The cost is time: the 4 files now build one application per test (the whole backend unit run is still about 10 s).

Evidence (all with `--sequence.shuffle.files --sequence.shuffle.tests`, 855 tests each): seeds 1, 2, 3, 5, 7, 11, 23, 42, 101 and 2026, all passed. Before the fix, seeds 1, 2, 3 and 5 failed (3 to 14 tests).

Command: `cd backend && npx vitest run --sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=<N>`

Other files (`accounts.http`, `auth.http`, `security.http`, `records-sync.http`, `web.http`, `device-sync.http`, `http-server`) still share one application per file; they passed every seed above, so no order dependence was found in them. That is evidence, not proof: a test that only reads shared state can start to depend on it when someone adds a writer.

## Integration suite, round 3

Throwaway PostgreSQL 18.7 on 127.0.0.1:55432 (removed afterwards), the development Keycloak at 8081: `npm run test:integration` in file order: 14 files, 209 tests passed. Then, on the same database (not recreated, so leftovers of the earlier runs were present), shuffled files and tests with seeds 7, 21 and 77: 209 passed each. Command: `npx vitest run -c vitest.integration.config.mts --sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=<N>`.

Limits: the integration files run one at a time and share the database by design (`fileParallelism: false`); running them in parallel was not tried. Three different seeds (7, 21, 77; seed 7 was also run in round 2).

## Reproduce

```
OWNER_PW=$(openssl rand -hex 12); APP_PW=$(openssl rand -hex 12)   # throwaway values for a container that lives a few minutes
docker run -d --name everfox-audit-db --rm -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql \
  -e POSTGRES_USER=everfox -e POSTGRES_DB=everfox -e POSTGRES_PASSWORD="$OWNER_PW" postgres:18.7-alpine3.24
cd backend
export DATABASE_URL="postgresql://everfox_app:${APP_PW}@127.0.0.1:55432/everfox" \
  MIGRATE_DATABASE_URL="postgresql://everfox:${OWNER_PW}@127.0.0.1:55432/everfox" \
  APP_BASE_URL=http://localhost:3000 OIDC_ISSUER=http://localhost:8081/realms/everfox \
  OIDC_CLIENT_ID=everfox-web OIDC_CLIENT_SECRET=<the development client secret from the local Keycloak setup>
PSQL_CMD="docker exec -i everfox-audit-db psql -U everfox -d everfox" APP_DB_PASSWORD="$APP_PW" ./scripts/db-app-role.sh
npm run db:migrate && npm run test:integration
docker rm -f everfox-audit-db
```
(The passwords are generated for the run and thrown away with the container.)
