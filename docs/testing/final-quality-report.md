# Final quality report

Date: 2026-11-26. Repository: Everfox (FINANCE-GOAL-1300K), branch `feat/ux-audit-improvements`, base commit `ae21ae8`. Nothing was committed or pushed. Production code changed in one place only, for the PDF import bug that the owner reported (`scripts/build-mobile.py`, the Android build), with its own tests.

## A. Initial diagnosis

- Analysed: `src/core`, `src/domain`, `src/sync`, `src/ui` (56 view modules), `backend/src` (NestJS), `scripts`, the build for Android, CI.
- Browser unit tests at `HEAD`: 46 files, 4481 assertions, all passing. Backend unit: 35 files, 830 passing and 1 timing failure under load.
- End to end: 78 steps on the source, 65 on `dist/`, 23 on the Android shell, 6 phone widths; on-device test script exists (needs `adb`).
- Main problems: (1) the Android shell test never opened a file, so a PDF reader blocked by the policy went unnoticed; (2) 23 functions never executed by the unit suite; (3) import classification, duplicates, the API client, portfolio realised result, card cycle edge rules had no direct tests; (4) a hidden crash in `app-lock-settings.test.js` (a pending timer fired after its fake `document` was removed).

## B. Gaps

See [test-coverage-gaps.md](test-coverage-gaps.md). In short: import classify and duplicates, CSV/OFX column detection, the API client, store hooks and migration, card cycle rules, invoice of purchase, gross balance, realised portfolio result, settings commands, display formatting; backend input parsing, account schemas and entitlements; no end to end check of CSV, OFX and PDF import under the Android policy.

## C. Work done

- Fixed the reported bug (blocked PDF reader on Android) and proved the new smoke fails with the owner's exact message when the fix is removed.
- 14 new unit files in `tests/unit`, extended 4 existing ones (`sync-runner`, `transfers`, `import-readers`, `month-result`) and fixed 1 (`app-lock-settings`). 3 new backend files, 1 changed (a 60 s budget on a 2,600-request test).
- New end to end run: CSV, OFX and PDF imports inside the Android shell under its policy (`tests/smoke-native-import.js`, generated samples in `tests/fixtures`).
- A seeded property test of money invariants (`finance-invariants`) and a mutation tool (`tools/mutation-lite.cjs`).
- Nothing was removed.

## D. Results

| Measure | Before (`HEAD`) | After |
|---|---|---|
| Browser unit files | 46 | 60 |
| Browser unit assertions | 4481 passed, 0 failed | 4704 passed, 0 failed |
| Backend unit | 830 passed, 1 timing failure | 855 passed, 0 failed (35 files) |
| `npm run check` (lint, typecheck, unit, build check, e2e, phone widths) | not re-run at HEAD | passes: SMOKE OK, MOBILE ENV OK |
| Functions never executed (V8 function coverage) | 23 | 4 (DOM code covered by e2e) |

Line and branch coverage were **not** measured: the unit harness strips ES modules, so V8 offsets do not map back to the sources. Only function coverage exists.

Mutation testing (`mutation-lite`, 8 seeded mutants per file, 9 domain, core and sync files): 72 mutants, 53 killed, 19 survived (73.6 %). The survivors were then read one by one:

- Missing tests, now added: item value 0.5 income (`month-result:15`), first saved record wins on a repeated key (`import-duplicates:30`), CSV value in column 0 and header "Data lançamento" (`import-csv:47,54`), OFX entry position (`import-ofx:24`), Santander balance of exactly 0.005 (`store:22`).
- Re-run on 5 of those files after the new tests: 36 mutants (a different seeded sample), 20 killed, 16 survived. Confirmed killed in the re-run: `month-result:15` (3 variants) and `store:22` (3 variants). The other survivors there are equivalent changes (a regex split limit, a constant in demo seed data, a 4000 character sniff limit) or untested corners that are listed in section E. The two scores are not comparable because the samples differ.
- Not re-run and still open from the first run: `month-summary:19`, `card-cycle:31`, `portfolio:11`, `transfers:35` and `:20`, `import-classify:45`, `sync/records:31`, `sync/outbox:37,42`, `sync/apply:34`. Each needs a decision whether it is an equivalent change.

## E. Remaining risks

- No known open bug. The "Data do lançamento" CSV header bug was fixed after approval (critical-business-rules.md, item 6).
- The 56 modules of `src/ui/views` are covered only by the end to end suites, which check that screens draw and that main flows work, not each decision.
- Backend integration tests (need a database) were not run in this audit. The CI runs them.
- On-device behaviour (real WebView, share sheet, status bar) was not tested here: `adb` is not on the PATH.
- The PDF reader is tested with generated PDFs, not with the owner's real statements from each bank; a new bank layout can still fail to parse.
- Open owner questions Q1 to Q6 in critical-business-rules.md: the tests describe the current behaviour for Q1 to Q3 and do not decide who is right.
- The on-load average of the machine was 20 to 25: timing-sensitive tests can fail under load (one backend test was changed for that).

## F. Recommendations

1. (Done) Fix for "Data do lançamento".
2. Decide Q1 to Q5 so that tests can pin the intended rule.
3. Run `scripts/mobile.sh test` on a phone before each release, and `npm run check` before each push.
4. Add real line and branch coverage by running the unit suite on real ES modules (for example with Vitest) instead of the stripping harness.
5. Re-run `tools/mutation-lite.cjs` with more mutants per file on `import-*`, `card-cycle`, `portfolio` and `sync/*`, and close the survivors listed in section D.
6. Add a few anonymised real statements (CSV, OFX, PDF) as fixtures when the owner approves.

---

# Round 2 (2026-11-26)

Scope: close the survivors, measure coverage, fix the CSV header bug, run the backend integration tests, build a statement-fixture strategy, review the end to end gaps and the reliability of the tests. Nothing was committed or pushed. Production code changed only in `src/domain/import-csv.js` (the authorized "Data do lançamento" regex, with `dist/` rebuilt) plus the earlier Android PDF fix; test config: `backend/vitest.config.mts` (`hookTimeout`), `.gitignore` (`coverage/`), `scripts/send-apk.sh` (new helper).

## Results

| Measure | Result |
|---|---|
| Browser unit | 4878 assertions passed, 0 failed (was 4704 at the end of round 1; 4481 at HEAD) |
| `npm run check` (lint, typecheck, unit, build check, e2e, phone widths, mobile env) | exit 0: SMOKE OK, MOBILE ENV OK |
| Backend unit | 855 passed (35 files), 0 failed |
| Backend integration | 209 passed against a throwaway PostgreSQL on 127.0.0.1:55432 and the dev Keycloak; also passed with shuffled files and tests (one seed). Not re-run after the last unit-only changes, because no backend code changed |
| Android shell on an **emulator** (Android 15) | 23/23 steps. This is **not** a real phone |
| Mutation, seed 3 sample (same 72 mutants) | before the new tests 49 killed (68.1 %); after 66 killed (91.7 %); the 6 left were handled by line: 5 gaps now killed, 1 equivalent |
| Mutation, seed 2 sample (92 mutants) | 75 killed (81.5 %) before, 90 (97.8 %) after; the 2 left are equivalent |
| Coverage (unit) | core 100 % lines, domain 99.95 %, sync 100 %; branches (V8 blocks) 93 %, 91 %, 97 %. Views 0.97 % (e2e only). See coverage-report.md |

Details: mutation-survivors.md (every survivor, with reason or test), coverage-report.md, backend-integration.md, statement-fixtures.md, e2e-gaps.md, device-checklist.md, reliability-review.md.

## Bugs and hazards found

- CSV "Data do lançamento" header: reproduced (test failed first), fixed in `import-csv.js`, checked against other headers for ambiguity. Item 6 of critical-business-rules.md.
- Time bombs: tests that used the real clock were made deterministic (`createContext({today})`) and re-run under a fake clock matrix (`tools/fake-clock-preload.cjs`).
- Hazard (item 7): the record id counter can become NaN with some stored ids; documented, not changed (no authorization).
- Backend HTTP tests written as stories depend on order inside each file: shuffling tests inside files breaks 5 files. Documented limit.

## Remaining risks

- No test on a **real** phone: use device-checklist.md before a release.
- No real bank statements: fixtures are generated or anonymised examples (statement-fixtures.md); a new layout can still fail. The runner picks up new files dropped in `tests/fixtures/statements/`.
- The 56 view modules are covered only by end to end runs, which do not check every decision (12 gaps listed in e2e-gaps.md).
- Coverage branches are V8 blocks, not Istanbul branches; coverage of the headless browser run was not measured.
- Mutation testing is a sample (seeded), not the whole code; a high score on a sample is not a guarantee.
- One integration shuffle seed only.
- Open owner questions Q1 to Q7 (critical-business-rules.md): tests describe current behaviour and do not decide who is right.
- Machine load (20 to 28 on 14 cores) can make timing-sensitive tests fail; hook timeouts were raised for that.

## Recommendations

1. Decide Q1 to Q7 so the tests can pin the intended rules.
2. Run the device checklist on a real phone before each release.
3. Add a few anonymised real statements when approved.
4. Measure coverage inside the headless browser for the views.
5. Re-run `tools/mutation-lite.cjs` with new seeds periodically; start with `import-*`, `card-*`, `sync/*`.

---

# Round 3 (2026-11-26): order independence, the id counter, end to end gaps, integrity, stability

Nothing was committed or pushed. Production code changed in four places, each with a test that failed first (list in commit-review.md): the id counter repair (`src/core/id-counter.js` and its four doors), "Repetir" reset after a save, and the invoice month choice (two files). Two of these are behaviour changes you should confirm (owner-decisions.md, last section).

## 1. Order dependence of the backend HTTP tests

Found: four files (`legacy.http`, `plans.http`, `sync.http`, `app`) shared one application, storage and logged-in people for all their tests, and some tests read what an earlier one had written. Fixed with an application per test; each test prepares its own data. No shuffle was disabled and no order fixed. Details and the per-file table: backend-integration.md. Evidence: 855 backend unit tests, files and tests shuffled, seeds 1, 2, 3, 5, 7, 11, 23, 42, 101, 2026: all passed (before: seeds 1, 2, 3, 5 failed with 3 to 14 tests).

## 2. The id counter

Diagnosis in id-counter.md. The NaN risk is **confirmed**: a backup file or stored state without a counter gave ids that are `NaN` (stored as `null`); `null`, `0` gave id 0; a counter lower than the ids in use gave reused ids. Normal use never produces these states (the app always writes a counter), so it needed an unusual file or server document. Fixed without changing id formats or any good data. 56 new assertions; 23 of 26 mutants killed, 3 equivalent. Open limit: two browser tabs on one storage (not a counter problem).

## 3. End to end gaps

New scenario `tests/smoke-flows.js`, 23 steps, wired into `scripts/smoke.sh` ("money flows"), passing in the final `npm run check`. Rows 1 to 7 and 10 of the 12 gaps are closed; row 8 partly; rows 9 and 11 stay open; row 12 is covered by the device script and unit tests. Table with priority and proof: e2e-gaps.md. Four deliberate breaks of the app were each caught. **It found two real bugs** (the series repeat that stayed on, and the invoice month that could not be chosen), both fixed.

## 4. Financial integrity

`tests/unit/financial-integrity.test.js` (seeded, 8 properties): the same file or an overlapping file never saves a line twice (25 statements); sums are exact to the cent in any order and float noise is rounded; own-account transfer lines change neither income, expenses, records nor balance, and are not kept twice (15 ledgers); paying every open invoice closes it, takes out exactly what was bought and is not an expense (15 ledgers); delete plus undo restores the same records (20 ledgers); pulling the same server changes twice gives the same state with no echo and no duplicate id (25 sets). No violation was found. Writing it exposed two weak spots in existing tests (`transfers.js:69`, `transactions.js:33`), now killed. One rule question came out of it: paying above what is open (Q8).

Not checked as an invariant, because the rule is not written anywhere: "the sum of the records equals the balances". Balances are typed snapshots, not derived from records, by design.

## 5. Stability

Browser unit suite, 4958 assertions in 67 files: 8 shuffled orders (`node tests/run-unit.js --seed N`, N = 1, 2, 3, 7, 13, 42, 99, 2026), every file alone (`--only name`, 67 of 67 pass), 5 time zones (`TZ=` UTC, America/Sao_Paulo, Asia/Tokyo, Pacific/Kiritimati, America/Los_Angeles), 3 fake clocks (`FAKE_NOW=` 2028-02-29T23:30, 2030-01-01T00:10, 2027-12-31T23:59 with `NODE_OPTIONS="--require ./tools/fake-clock-preload.cjs"`): all passed. Backend unit: 10 seeds (above). Backend integration (real PostgreSQL, throwaway): in order, then shuffled seeds 7, 21, 77: 209 passed each time. The database was removed afterwards.

## 6. The proposed commits

Critical review in commit-review.md. The two-commit split is not recommended (the second commit would mix three production fixes with about 70 files of tests and docs, and `dist/` must follow `src/` commit by commit because CI checks it). A five-commit split is proposed. `scripts/send-apk.sh` has no secret and no personal path but is unrelated to the audit. `tools/coverage.cjs` installs c8 without a pinned version.

## 7. Questions

Q1 to Q5 and the new Q8 are laid out with options and risks in owner-decisions.md. Q6 and Q7 are closed (please confirm Q7's code change).

## 8. Final validation (this run)

| Check | Result |
|---|---|
| `npx eslint .` | clean |
| `npm run build` | `dist/` rebuilt from `src/` (must be committed with the source) |
| `npm run check` | exit 0: 4958 unit assertions passed, 0 failed; SMOKE OK on 9 scenarios (source, sync x2, money flows, XSS, Android shell x3, built dist); MOBILE ENV OK |
| Backend unit | 855 passed (35 files) |
| Backend integration | 209 passed, in order and with 3 shuffle seeds |
| CSV regression | `import-csv-columns` (36 assertions) and `import-fixtures` pass |
| Emulator / real phone | not re-run in round 3; round 2 had 23/23 on an emulator; **no real phone** |

Not run in round 3: `tools/coverage.cjs` and a fresh mutation sample over the whole domain (only the new and touched modules were mutated). Numbers from round 2 stand for those.

## 9. Remaining risks, and whether any justifies delaying the next version

- **Needs your answer before release, not a blocker by itself:** Q8 (paying above the open amount is accepted after a confirmation) and the two behaviour changes of this round. None of them can corrupt stored data; Q8 can take more money out of the cash balance than the invoice, if the person confirms a mistyped amount.
- **Needs your answer, data-related:** Q1 (an old backup loses its best purchase day, reset to 29) is the only open item that can silently change where purchases land for someone who restores an old backup. It depends on whether such backups still exist.
- Two tabs open on the same storage can overwrite each other's records and reuse ids (a design limit, not tested end to end).
- Open end to end gaps: category dialogs (merge), error and loading states (slow import, failed backup write).
- No real phone test; no real bank statements; the views are covered by end to end only; coverage "branches" are V8 blocks; mutation testing is sampled.
- Machine load can still make timing-sensitive tests fail; hook timeouts were raised.

**Verdict.** I found no known defect that corrupts data in normal use and that is still unfixed. The reasons to wait are about confidence, not about a known bug: the real-phone checklist (device-checklist.md) has not been run, and Q1 and Q8 want your decision. If the release is for people who restore old backups, resolve Q1 first.

---

# Owner decisions applied (2026-11-26)

Nothing was committed or pushed, nothing deployed. Details and old/new behaviour of each decision: [owner-decisions.md](owner-decisions.md). The split is now seven commits: [commit-review.md](commit-review.md).

| Decision | Change | Main tests |
|---|---|---|
| Q1 | `best` and `due` validated on read (integers 1 to 31, default per field); the pre-v3 reset is kept | `card-settings-validation` (31 assertions) |
| Q2 | "use my average" keeps cents, like the Settings field | `settings-commands` |
| Q3 | no code change; both parsers pinned and the divergence documented | `import-values`, `display-format` |
| Q4 | `migrate()` runs once (`migrated.sa` in the state); old backups still migrate | `store-hooks` |
| Q5 | money in with an investment or redemption word is flagged `possible-transfer`, kept visible, not counted, counted in "Para revisar" | `import-classify`, `import-flow` |
| Q8 | the over-payment confirmation shows open, paid, excess and that it is the expense "Cartão (sem detalhe)", not a credit; provisional | `invoice-payment-edges`, `smoke-flows` |

Mutants made by hand on the new code (guard of `migrate`, the mark, the archived branch, the flag, the direction of the Q5 rule, the review count, `roundMoney` in Q2) were all caught. One survivor is equivalent: `x>0.004` against `x>0` in `paymentExcess`, because `roundMoney` only returns 0 or at least 0.01.

## Validation of the final tree

| Check | Result |
|---|---|
| `npx eslint .` | clean |
| `npm run build` | `dist/` rebuilt from `src/`; a second build is byte-identical |
| `npm run check` | exit 0: 5018 unit assertions in 68 files, 0 failed; SMOKE OK (including the Q8 dialog steps in "money flows"); phone widths and MOBILE ENV OK |
| Browser unit, shuffled | seeds 1, 7, 42: 5018 passed each; `TZ=Pacific/Kiritimati`: 5018 passed |
| Backend unit | 855 passed (35 files) |
| Backend integration | 209 passed (14 files) on a new throwaway PostgreSQL 18.7 and the dev Keycloak; the container was removed |
| `tools/coverage.cjs` with `c8@12.0.0` | runs, exit 0 |
| `scripts/secret-scan.sh` (the CI step) | nothing found (the doc's throwaway passwords were replaced by generated variables) |

Not run: the emulator or a real phone, and the commits one by one in worktrees (no commits exist yet). `/tmp/sim` (a simulation folder of the commit split) remains outside the project; its removal was blocked by a safety check and was not worked around.
