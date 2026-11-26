# Review of the working tree before any commit (nothing was committed)

Round 3, updated after the owner decisions of 2026-11-26. Branch `feat/ux-audit-improvements`, base `ae21ae8`. 45 entries modified, 39 untracked (84 in `git status`). This is a critical read of the two-commit split proposed earlier, and a better one.

## What is in the tree

| Group | Files | Kind |
|---|---|---|
| A. Android PDF reader | `scripts/build-mobile.py`, `tests/smoke-native-import.js`, `tests/fixtures/import-samples.js`, `tests/fixtures/statement-pdf.js`, `scripts/write-import-samples.mjs`, `tests/unit/mobile-build.test.js`, one hunk of `scripts/smoke.sh` | bug fix (the owner's error) and its tests |
| B. CSV header | `src/domain/import-csv.js`, `tests/unit/import-csv-columns.test.js`, `dist/*` | bug fix (round 2) |
| C. Round 3 fixes in the app | `src/core/id-counter.js`, `src/domain/state-recovery.js`, `settings-commands.js`, `store.js`, `src/sync/apply.js`, `src/ui/views/transaction-form.js`, `invoice-form.js`, `transaction-form-events.js`, `dist/*`, `tests/unit/id-counter.test.js`, the flows scenario | three small production fixes |
| C2. Owner decisions (2026-11-26) | `src/domain/card-cycle.js` (Q1), `settings-commands.js` (Q2), `store.js` (Q4), `import-classify.js`, `import-draft.js` (Q5), `invoice-payment.js`, `src/ui/views/pay-invoice.js` (Q8), `dist/*`, `tests/unit/card-settings-validation.test.js`, `import-flow.test.js` and `import-values.test.js` (modified), the Q8 steps of `tests/smoke-flows.js` | five small production changes |
| D. Tests only | ~45 files in `tests/unit`, `tests/fixtures/statements/`, `tests/smoke-flows.js`, harness changes, `backend/test/**`, `backend/vitest.config.mts` | no production code |
| E. Tools and docs | `tools/*.cjs`, `docs/testing/*`, `AGENTS.md`, `.gitignore`, `tests/run-unit.js` | no production code |
| F. Unrelated to the audit | `scripts/send-apk.sh` | convenience script |

## The proposed split, judged

1. *PDF reader fix and import tests* and 2. *everything else*: the second commit would hold three different things (a bug fix in the CSV reader, three fixes in the app, the whole test and doc work) and the `dist/` of all of them. A reviewer cannot judge a production fix inside 70 files of tests, and `git bisect` or a revert of one fix would take the others with it. Not recommended.
- Files that belong to the same context but sit in different commits of that split: `scripts/smoke.sh` (the native-import page belongs to the PDF fix, the flows page and `SMOKE_ONLY` to the new scenario), `tests/fixtures/statement-pdf.js` (the locked-PDF fixture is needed by the PDF scenario and by the fixtures runner).
- `dist/` is versioned on purpose: CI runs `npm run build && git diff --exit-code -- dist/` (`.github/workflows/ci.yml`, line 30), so every commit that changes `src/` must carry the `dist/` built from exactly that `src/`. A single `dist/` at the end of a series would break CI on the earlier commits of the series if they are pushed together and checked one by one.

## Recommended split (seven commits, by purpose) — changed from five

The owner decisions added production code in files that already carry a round 3 fix (`settings-commands.js` and `store.js` each have an id counter hunk and a decision hunk), and the flows scenario now also checks the Q8 dialog. Keeping five commits would mix bug fixes with decisions, so the series becomes seven. **Fallback:** if you prefer five, merge commits 3, 4 and 5 into one `fix(app)` commit (no partial adds needed).

1. `fix(mobile): the PDF reader works under the Android CSP`: group A. `dist/` unchanged. Needs the native-import hunk of `smoke.sh`.
2. `fix(import): recognise the column "Data do lançamento"`: `import-csv.js`, its test, `dist/` built at that point.
3. `fix(core): repair the id counter`: `src/core/id-counter.js`, the id counter hunks of `state-recovery.js`, `settings-commands.js` (`importBackup`), `store.js` (`adoptRemoteState`) and `sync/apply.js`, `tests/unit/id-counter.test.js`, `dist/`. **Partial add** (`git add -p`) for `settings-commands.js` and `store.js`.
4. `fix(ui): "Repetir" reset, invoice month choice, over-payment confirmation (Q8)`: `transaction-form.js`, `invoice-form.js`, `transaction-form-events.js`, `invoice-payment.js` (`paymentExcess`), `pay-invoice.js`, `tests/smoke-flows.js`, the flows hunk and `SMOKE_ONLY` of `smoke.sh` (**partial add**), `dist/`.
5. `fix(domain): owner decisions Q1, Q2, Q4, Q5`: `card-cycle.js`, the Q2 line of `settings-commands.js` and the `migrate` hunk of `store.js` (the other halves of the partial adds), `import-classify.js`, `import-draft.js`, `card-settings-validation.test.js`, and the **modified tracked tests** `import-flow.test.js` (the review count is now 7, it would fail at `HEAD` without the change) and `import-values.test.js`, `dist/`.
6. `test: audit rounds 1 to 3 (unit, fixtures, integration isolation, tools)`: group D and the tools, including the new files that pin the decisions (`store-hooks`, `settings-commands`, `import-classify`, `invoice-payment-edges`: they are new files, so they cannot be split across commits and come after the code they test). `tools/coverage.cjs` now pins c8 to `12.0.0`.
7. `docs(testing): audit documents and AGENTS.md pointer`: group E.
`scripts/send-apk.sh` stays **out** of all seven. Decide separately whether it goes in this branch (`chore: scripts/send-apk.sh`); it has no secrets and no personal path.

**Check each commit alone** before pushing the series: in a temporary worktree of each commit run `npm run build && git diff --exit-code -- dist/` and `npm run check` (CI checks `dist/` against `src/` on every commit it builds). I did not create the commits, so this has not been run per commit; the final tree passes (below).

## Things that should not be committed, or need a decision

- Generated or ignored: `coverage/`, `tests/.smoke*.html` and `node_modules` are already ignored. `dist/` is tracked and must be committed.
- No secrets and no personal paths in the new files (searched for the user name, home path, tokens, passwords). `scripts/secret-scan.sh` (the CI step) finds nothing on the tree: the throwaway database passwords in `backend-integration.md` are now generated in the commands, not written. `README.md` mentions `~/Downloads/meta_1300k_app.html` in a historical note that is not part of this change.
- `tools/coverage.cjs` now installs `c8@12.0.0` (pinned; Node ^20.19, ^22.12 or newer; the report ran with it on Node 20.20.2). It is still fetched at run time and is not used by CI.
- `tools/mutation-lite.cjs` copies the repository to a temporary folder and never touches the working tree.
- Changes that are not related to the audit: none found in `src/` besides the four fixes above. `backend/test/unit/http/security.http.test.ts` has a 3-line change (a larger time budget for a 2,600-request test), `backend/vitest.config.mts` a `hookTimeout`.

## Production code changed, all of it

| File | Change | Reason | Test that failed first |
|---|---|---|---|
| `scripts/build-mobile.py` | PDF worker and `blob:` allowed in the Android page policy | PDF import error on Android | `smoke-native-import` (fails with the owner's exact message) |
| `src/domain/import-csv.js` | `data (d[aeo] )?...` | "Data do lançamento" was read as the description | `import-csv-columns` |
| `src/core/id-counter.js` (new), `state-recovery.js`, `settings-commands.js`, `store.js`, `sync/apply.js` | repair of the id counter at the four doors | `NaN` or reused ids | `id-counter` |
| `src/ui/views/transaction-form.js` | `fRep` back to 1 after a save | next record was repeated | `smoke-flows` |
| `src/ui/views/invoice-form.js`, `transaction-form-events.js` | choosing an invoice no longer resets the choice | only today's invoice could be selected | `smoke-flows` |
| `src/domain/card-cycle.js` | `best` and `due` must be integers 1 to 31, else the default | Q1 | `card-settings-validation` |
| `src/domain/settings-commands.js` | `setPlannedContribution` keeps cents | Q2 | `settings-commands` |
| `src/domain/store.js` | `migrate()` runs once (`migrated.sa`) | Q4 | `store-hooks` |
| `src/domain/import-classify.js`, `import-draft.js` | money in with an investment word is flagged `possible-transfer` and counted in "Para revisar" | Q5 | `import-classify`, `import-flow` |
| `src/domain/invoice-payment.js`, `src/ui/views/pay-invoice.js` | the over-payment confirmation shows open, paid, excess and what happens to it | Q8 | `invoice-payment-edges`, `smoke-flows` |
