# Implementation plan (what was proposed, why, and what it protects)

| ID | Component | Scenario | Existed? | Gap | Prio | Type | File |
|---|---|---|---|---|---|---|---|
| T01 | Portfolio | Realised result with two buys at different prices, a sale with fees, a loss, several tickers, order independence, oversold | Positions only | G01 | P0 | unit, hand calculation | `portfolio-realized.test.js` |
| T02 | Store | Listeners after the data is stored, a throwing listener, failed save, adopted state, stale allocation, one-time account migration | No | G02 G03 | P0 | unit | `store-hooks.test.js` |
| T03 | Card cycle | Cycle boundaries by hand (with and without business days) and as a property over 9 settings x 30 invoices | Partly | G04 | P0 | unit + property | `card-cycle-rules.test.js` |
| T04 | Month and report | 60 seeded random ledgers against an independent oracle (income, expenses, left, kept, rate, report groups with split records, order independence) | Few ledgers | G10 | P0 | property | `finance-invariants.test.js` |
| T05 | Android import | CSV, OFX (bank, card), PDF (statement, invoice, custody), broken PDF, no CSP violation, in the Android page | No | G16 | P0 | end to end | `smoke-native-import.js` |
| T06 | Android build | CSP strict, pdf.js as same-origin files, not embedded | No | G17 | P1 | unit | `mobile-build.test.js` |
| T07 | Invoice allocation | Which invoice absorbs a purchase | No | G05 | P1 | unit | `invoice-of-purchase.test.js` |
| T08 | Accounts | Gross and net totals, approximate flag | No | G06 | P1 | unit | `accounts-gross.test.js` |
| T09 | Import classifier | Every branch of `classifyEntry`, installments | Indirect | G07 | P1 | unit | `import-classify.test.js` |
| T10 | Duplicates | Confirmed and possible duplicates | Indirect | G08 | P1 | unit | `import-duplicates.test.js` |
| T11 | CSV and OFX | Written and read back, 40 statements x 2 formats, 4 CSV variants | Examples | G09 | P1 | property | `import-roundtrip.test.js` |
| T12 | Settings | Rounding, fallbacks, day clamping | No | G11 | P1 | unit | `settings-commands.test.js` |
| T13 | API client | Requests, failure kinds, `me()`, logout, login URL | No | G12 | P1 | unit | `api-client.test.js` |
| T14 | Sync | Review list, clear, pending count | No | G13 | P2 | unit | `sync-runner.test.js` (extended) |
| T15 | Display | Amounts, percentages, months, parsing what a person types | Partly | G14 | P2 | unit | `display-format.test.js`, `transfers.test.js` |
| T16 | Backend | `parseInput`, account schemas, entitlements | No | G19-21 | P1 | unit | `test/unit/http/parse-input.test.ts`, `test/unit/accounts/account-schemas.test.ts`, `test/unit/plans/entitlements.service.test.ts` |
| T17 | Test hygiene | Toast timer crash; a 2,600-request test with a 5 s budget | n/a | section 4 of the audit | P1 | fix of tests | `app-lock-settings.test.js`, `security.http.test.ts` |
| T18 | Quality of the suite | Mutation testing of the critical rules | No | Phase 8 | P1 | tool | `tools/mutation-lite.cjs` |

## Choices

- **No production code was changed.** All tests were written against current behaviour that is documented by the code, its comments, the ADRs or the existing tests. Where the intent is unclear no test was written (section 3 of `critical-business-rules.md`).
- **Property tests use a seeded generator** (a linear congruential generator in the test file), so the same ledgers are generated every run. No library was added (`fast-check` is not installed, and adding a dependency is a decision for the owner).
- **Oracles are independent of the code under test**: sums are recomputed from the raw list in cents; cycle rules are checked from the stated rule "a purchase belongs to the first invoice whose closing has not passed"; the realised result is calculated by hand on paper in the test.
- **Tests that need a database or a device were not run**, and none of the new tests needs them.
