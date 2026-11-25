# ADR-0010 · Sync engine and plans with locked features (Phase 4a)

Status: Accepted (2026-11-26). Implements [ADR-0008](ADR-0008-offline-first-sync.md); the plans part was proposed in [ADR-0009](ADR-0009-login-sessions-ownership.md).

## Sync
- **One change counter per person** (`sync_cursor`). Every write of a synced record locks it, takes the next number, writes, and commits. Because writers of one
  person queue on that lock, numbers are committed in order: a device that has read up to N can never miss a change that commits later with a number below N.
  (A global sequence cannot promise this: a transaction can take 41, a later one take 42 and commit first.) The cost is that one person's writes are serial, which is fine for one person.
- **A write that changes nothing takes no number.** Saving the name a record already has returns it as it is. A retry is free and wakes no other device.
- **Deletes are tombstones** with their own version, so the delete reaches every device. A delete wins over a later edit (answer `superseded`, not an error).
- **`POST /api/v1/sync/push`**: up to 100 mutations, each `{mutationId, resource, op: put|delete, id, data}`, applied in order. Each gets an answer:
  `applied`, `superseded` (a delete won), `rejected` (invalid data, an id that is not theirs, unknown resource) or `skipped`.
  A rejected one **stops the batch**: later ones may depend on it, so they come back `skipped` and are not remembered; the device sends them again after dealing with it.
- **Every answer is stored** (`sync_mutation`, per person). The same mutation sent again returns its first answer and changes nothing, even if the record changed since.
- **`GET /api/v1/sync/changes?cursor=&limit=`**: what changed after the cursor, oldest first, tombstones included, across all resources merged by version.
  The cursor is a string of digits. `hasMore` is exact (the server asks for one extra row).
- **Adding a resource** (transactions, categories, ...) is one class implementing `SyncResource` and one line in `SyncModule`. The service knows only that interface.
- Accounts are the first resource, through the same repository and rules as the REST routes.

## Plans and locked features
- **The catalogue of feature keys is in code** (`src/plans/features.ts`), because code is what checks it. **Which plan has which feature is in the database**
  (`plan`, `plan_feature`), so the owner changes it without a deploy. A key in the database that the code does not know is ignored; the admin routes refuse one.
- **The server decides.** A route marked `@RequiresFeature('key')` answers `403 {code: 'feature_locked', feature}` when the person's plan lacks it. Hiding a menu is only presentation.
- **`/api/v1/me` returns `plan` and `features`** (every key of the catalogue, true or false) so the app can draw locked items with a PRO badge and open the upgrade screen on a tap.
- **Read on every request**: a change of plan or of a plan's features counts from the next call, and so does taking away the admin flag.
- **Admin routes** (`/api/v1/admin`): list plans, turn a feature on or off for a plan, move a person to a plan. Only people with `is_admin`, which can be set **only outside the API**
  (SQL by an operator). Every real change is written to `audit_log` (who, what, on what, when); repeating a change is `changed: false` and writes nothing.
- **Starting data is a placeholder for the product owner to decide:** `free` and `pro` exist; Pro has all four example keys (`budgets.advanced`, `import.bank-files`,
  `investments.projection`, `report.monthly`); Free has none of them.

## Offline and plans
The device keeps the last `features` it received and uses them to draw the screen. The server checks again on every sync, so an expired plan does not become permanent free use of a locked feature.
Work already recorded offline is never thrown away because of a plan: what a plan limits is what the server accepts from then on.

## Not done yet
Billing events that change the plan (Phase 8b); an admin screen (the routes are the service); rate limits (Phase 7); purging old `sync_mutation` rows and tombstones (needs a rule for how long a device can stay offline).
