# ADR-0011 · Records, state and the shared rules on the server (Phase 4b-1)

Status: Accepted (2026-11-28). Builds on [ADR-0006](ADR-0006-state-scope.md) (the rules read state through `withState`), [ADR-0008](ADR-0008-offline-first-sync.md) and [ADR-0010](ADR-0010-sync-and-plans.md).

## Decision
- **The server runs the same JavaScript rules as the browser app** (`src/core`, `src/domain`), loaded by `src/domain/domain-runtime.ts`. Per request it rebuilds the person's state
  from the tables, runs the rule inside `withState`, and returns the result. There is no second copy of the rules to keep in step.
  The acceptance test is the golden file: baseline state -> import -> tables -> rebuild -> shared rules -> must equal `docs/architecture/baseline/golden-calculations.json`
  (in memory and on PostgreSQL).
- **Storage: one generic `record` table** for the kinds `account`, `tx`, `snap`, `trade`, `transfer`, `import`, plus `user_state` (jsonb) for settings, categories, groups, budgets, card.
  A record has `legacy_key` (the browser app's numeric id, unique per person and kind), `position` (the version it was created at, so lists keep their order), `body` (jsonb, the shape the browser app already uses),
  `version` and a tombstone, so every kind syncs through the ADR-0010 engine without a new table per kind.
- **Accounts moved** from the Phase 3 `account` table to kind `account` (the migration copies the rows, then drops the table).
- **Import / export**: `POST /api/v1/import/legacy-state?replace=true|false` and `GET /api/v1/export/legacy-state`. Without `replace`, a person who already has data gets `409 not_empty`.
  With `replace`, old records become tombstones (other devices are told) and their keys are free again. Import is one transaction; the body limit is 25 MB (other routes 1 MB).
- **Read endpoints**: `GET /api/v1/months/:month/summary|result|report`. `report` needs the `report.monthly` feature. It accepts `?today=YYYY-MM-DD`, because the rules read "today" from the server clock.

## Deviations and costs, stated plainly
- **Money stays in reais inside `body`** (the legacy shape), not integer cents on the wire as ADR-0004/0008 intended. Reason: the shared rules compute on that shape and the golden file proves them; converting at the edge now would
  mean a second, unproven copy of the rules. Typed cents columns are a later slice, after the rules are ported with the golden file as the safety net.
- **"Today" is the server's** (UTC in a container) unless `?today=` is given. The web app must send it.
- **Ids**: the browser app uses numeric ids (`legacy_key`); sync uses UUIDs. A device creating records offline needs a rule for the mapping. Open question for Phase 5.

## Hostile input
A stored body is validated per kind (zod, loose) and scanned: no `__proto__`, depth <= 10, bounded node count and size (record 32 KB, state 256 KB), no NUL, no non-finite numbers, at most 200 000 records, no duplicate keys.
The same checks run for import and for sync pushes. Rule names are looked up with `Object.hasOwn`.

## Deploy
The image is built from the repository root and carries `src/core`, `src/domain` and `src/package.json` under `/app/shared` (`DOMAIN_ROOT`). Locally the default path is the repository `src`.
