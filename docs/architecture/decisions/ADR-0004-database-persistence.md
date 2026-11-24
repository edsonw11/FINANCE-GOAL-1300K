# ADR-0004 · Persistence: PostgreSQL, normalised, money in integer cents

Status: Accepted (2026-11-24)

## Decision
- **PostgreSQL**, current major version, image pinned by version in Phase 2 (Docker locally, RDS later). Normalised tables mapped from the current document (accounts, snapshots, transactions,
  splits, invoice items, categories, groups, budgets, card settings, transfers, trades, imports, billing, audit), **`user_id` on every row**,
  composite indexes `(user_id, date)` / `(user_id, type, date)`.
- **Money as `BIGINT` cents** (exactly what `core/money.js` already sums), converted at the edge.
- **Prisma** for schema and versioned migrations (mature, typed, good DX); raw SQL allowed for reports. Application role without superuser
  rights; PostgreSQL row-level security evaluated in Phase 7 as a second barrier.
- Migration of the current users: the browser JSON export imported per account, totals compared (counts, sums per month, balances) before anything is deleted.

Alternatives: JSONB document per user (fast, no row-level integrity), TypeORM (less active), Drizzle/Kysely (closer to SQL, smaller ecosystem).
