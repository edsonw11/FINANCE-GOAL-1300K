# Review of the reliability of the tests

Date 2026-11-26. Scope: the browser unit suite (62 files, 4826 checks), the backend unit and integration suites, the end to end suites. Priority: financial modules, import, consolidation (sync).

| Question | How it was checked | Result |
|---|---|---|
| Tests that pass although the code is wrong | Mutation testing: two seeded samples, every survivor located and read, plus targeted reruns (mutation-survivors.md) | Gaps found and closed; 0 survivors unexplained. |
| Weak assertions | Searched every `ok(!!...error)`, `toBeDefined`, `length>0` | 10 "is refused" tests only checked that an error existed. All 10 now check the exact reason (allocation, own names, brokerage note, custody, undo); the double undo also checks that nothing changed. The three `toBeDefined` in backend tests are about the existence of a session or a result after a flow whose content other tests check. |
| Too many mocks | Counted `vi.mock`/`vi.fn` in backend tests | Only 4 backend unit files use them. Domain tests use the real domain code, no mocks. The backend uses in-memory fakes (`backend/test/support/fakes.ts`) that also run the same contract tests as the real repositories (`backend/test/contracts`). |
| Dependence on the time of day or the time zone | Whole unit suite under 5 time zones (UTC, Sao Paulo, Kiritimati +14, Los Angeles, Kolkata) | 4826 passed, 0 failed in all five. |
| Dependence on today's date | `tools/fake-clock-preload.cjs` moves "now" (FAKE_NOW) on boundary days: 2026-11-30, 2026-12-31, 2027-01-31, 2027-03-01, 2027-03-31, 2027-05-31, 2028-02-29, 2030-01-01 | **Two time bombs found and fixed.** `category-groups` and `commands` used fixed 2026 dates against logic relative to today (a 12 month window, demo data): they would have failed from about October 2027. The harness now has `createContext({today:'YYYY-MM-DD'})` (a fixed clock inside the context) and both tests use it. After the fix all dates above pass. Dates **before** the fixtures (earlier than Nov 2026) are not meaningful: fixtures would be in the future. |
| Order of execution | Backend unit and integration shuffled (see backend-integration.md) | Files are independent. Inside five backend HTTP files the tests are a story and must run in order (documented limit). |
| Shared data between tests | Each unit test file creates its own context (`createContext`); the sync tests build their state per case | No sharing found. The integration suite shares one database and runs file by file; it passed twice on a reused database. |
| Unstable tests | Load average was 20 to 28 throughout | One flaky: `web.http.test.ts` hook timeout (10 s) under load: limit raised to 30 s. `sync-records` has two timing assertions (`< 3000 ms` for 5000 records): kept, they passed at load 25, but they are the first to look at if the suite becomes flaky. A runner crash from a leftover timer was fixed earlier in this audit. |
| Exceptions hidden | Searched for empty `catch` blocks in tests | None. |
| Disabled or skipped tests | Searched `.skip`, `.only`, `xit`, `todo` | None in unit, backend or integration. |
| Random data | Searched `Math.random` in tests | One use (a unique file hash in `transfers`), not part of an assertion. The property tests use a seeded generator (`finance-invariants`). |
| Golden values copied from the program | Reviewed | `sync-records` fingerprint values are a compatibility pin and say so. `golden` and `calc-audit` recompute totals independently of the code (golden numbers in `docs/architecture/baseline`). |

## Remaining weaknesses

- Many domain tests build their state with `run("...")` strings: a typo in a string shows as a failure only when run. Acceptable, but long strings are hard to read.
- The unit harness runs the modules as one script, so a test can call any internal function; it can hide a missing export. The sync tests load the real ES modules and would catch that for `src/sync`.
- The tests inside five backend HTTP files depend on order.
