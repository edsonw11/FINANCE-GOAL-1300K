# Critical business rules and where each is protected

Source of every rule: the code and its comments, the ADRs, and the existing tests. Rules whose intent could not be established are in section 3 and have **no test on purpose**.

## 1. Rules and their protection

| Rule | Where it lives | Protected by |
|---|---|---|
| Money is integer cents; sums are made in cents | `core/money.js` | `money`, mutation runs on it; all property tests compare in cents |
| Income of a month = sum of its incomes; expenses = sum of its expenses plus the undetailed part of paid invoices; left = income - expenses; kept = left - invested; rate only with income | `month-summary.js`, `month-result.js` | `month-result`, `month-summary`, `calc-audit`, `golden`, `finance-invariants` (60 ledgers x 3 months) |
| The report agrees with the screens; its groups add up to the expenses (also with split records) | `report.js` | `report`, `finance-invariants` |
| A purchase belongs to the first invoice whose closing has not passed; a cycle starts the day after the previous closing; closing moves to the next business day when the option is on | `card-cycle.js` | `dates-card-cycle`, `card-cycle-rules` (by hand and as a property) |
| A paid invoice absorbs card purchases oldest first up to its amount; a manual choice replaces the automatic one | `card-invoices.js`, `transactions.js` | `card-invoices`, `invoice-of-purchase` |
| Gross total uses gross where known, net otherwise, and says when it is approximate | `accounts.js` | `accounts-gross` |
| Average-cost method: realised result = proceeds - fees - average cost of what was sold | `portfolio.js` | `portfolio`, `portfolio-realized` (hand calculation) |
| Goal projection: monthly rate = (1 + annual)^(1/12) - 1; contribution each month; lower-rate scenario | `goal-projection.js` | `projection`, `calc-audit` (independent calculation) |
| An import never saves before the person confirms; same file again does not duplicate; a bank id seen twice is a duplicate; same type, value and day is a possible duplicate | `import-*.js` | `import-flow`, `import-duplicates`, smoke steps |
| An invoice payment, a refund, a redemption, a yield and a transfer between own accounts are not income or expense | `import-classify.js`, `transfers.js` | `import-classify`, `transfers` |
| What is written in a CSV or OFX is read back with the same date, amount and direction | `import-csv.js`, `import-ofx.js` | `import-readers`, `import-roundtrip` |
| A failed save rolls back; a refused command changes nothing; unreadable data is kept aside, never overwritten | `store.js`, `state-recovery.js` | `store`, `state-recovery`, `store-hooks` |
| Sync: idempotent mutations, a rejected one goes to review, nothing loops, local data is never lost by a failure | `src/sync`, `backend/src/sync` | `sync-records`, `sync-apply`, `sync-runner`, backend `sync.http`, `device-sync` contract |
| A person only sees their own data (IDOR), writes need origin and CSRF, rate limits, session lifetimes | backend guards | backend `*.http.test.ts`, `idor.test.ts` (integration) |
| A locked feature stays locked; a change of plan counts from the next request | `plans/` | `plans.http`, `entitlements.service.test.ts` |
| The Android page runs under a strict CSP and can read PDF, CSV and OFX | `scripts/build-mobile.py` | `mobile-build`, `smoke-native`, `smoke-native-import` |
| The app lock asks again after 30 seconds away | `src/ui/app-lock` | six `app-lock*` files, `smoke-native`, `device-test-lock` |

## 2. Rules checked as properties (seeded, so repeatable)

- `finance-invariants`: 60 random ledgers x 3 months: the oracle (sums of the raw list) equals the app for income, expenses, left, invested, kept and rate; the groups of the report add up; reversing the records changes nothing.
- `card-cycle-rules`: for 9 card settings (best day 1..31, due day 1..31, with and without business days) and 30 invoices, every day from the cycle start to the closing maps to that invoice and the day before maps to the previous one; no gap and no overlap.
- `financial-integrity` (round 3, seeded): importing the same file twice or an overlapping one never saves a line twice; sums are exact to the cent in any order; own-account transfer lines change neither income, expenses, records nor the balance; paying every open invoice closes them, takes out exactly what was bought and is not an expense; deleting any set of records and undoing restores the same records; pulling the same server changes twice gives the same state with no echo and no duplicate id.
- `import-roundtrip`: 40 random statements x CSV and OFX come back with the same count, dates, amounts, directions and totals.

No violation was found by any property.

## 3. Owner decisions (2026-11-26, applied in the working tree, not yet committed)

1. **Card settings of an old state (Q1).** The reset to `best: 29` for pre-v3 data is kept. On read, `best` and `due` must be integers 1 to 31; a missing or invalid one becomes its default (29 or 7), a valid one is kept. Protected by `card-settings-validation`.
2. **Planned contribution (Q2).** The field and "use my average" both keep cents. Protected by `settings-commands`.
3. **`parse('1.234')` and `parse('1,234')` (Q3).** Kept. The form reads `1,234` as 1.234 and the importer as 1234; documented in owner-decisions.md. Pinned by `display-format` and `import-values`.
4. **`migrate()` (Q4).** Runs once: the mark `migrated.sa` in the state. Old backups without the mark are still migrated. Protected by `store-hooks`.
5. **Words in the classifier (Q5).** Money in with an investment or redemption word is a possible transfer: flagged `possible-transfer`, not counted, not selected, counted in "Para revisar". Protected by `import-classify` and `import-flow`.
6. **FIXED (2026-11-26, owner approved; not yet committed): the header "Data do lançamento" is not recognised as the date column** (`src/domain/import-csv.js`, `detectCsvMapping`). The date pattern now accepts it; checked against the other headers for ambiguity; protected by `import-csv-columns`.
7. **FIXED (round 3, not yet committed): an id counter that is missing, null, NaN, 0, negative, fractional, too large or behind the ids in use** gave `NaN`, falsy or reused ids. Protected by `id-counter`.
8. **Paying more than what is open on a card invoice (Q8, provisional).** Accepted after a confirmation that shows the open amount, the amount, the excess and that the excess is the expense "Cartão (sem detalhe)", not a credit. Protected by `invoice-payment-edges` and the flows scenario. Option B may be evaluated if the owner starts paying in advance.

Each decision, with the old and the new behaviour, is in [owner-decisions.md](owner-decisions.md).
