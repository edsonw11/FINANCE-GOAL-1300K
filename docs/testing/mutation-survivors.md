# Mutation survivors: every one investigated

Second round, 2026-11-26. A mutant is one small deliberate change to the code (`>` to `>=`, `&&` to `||`, a constant plus one). A test suite that is any good fails when the code is changed this way. A mutant that the tests do not notice (a "survivor") is either a missing test or a change that cannot alter behaviour (an "equivalent" mutant).

Rule used: a mutant is called equivalent only with a reason found in the code, never because the tests still pass. The two samples of the first round (72 mutants, 53 killed; 36 mutants, 20 killed) are different samples and are not added together.

How it was done: `node tools/mutation-lite.cjs --lines <n,n> <file>` runs **every** mutant on the given lines of a file (no sampling) and the report lists line and column. Each survivor of round one was located by line and column, read, and either given a test or explained here.

## 1. Survivors that were a missing test (now killed)

| Where | Mutation | What was not checked | Test that now kills it |
|---|---|---|---|
| `month-result.js:15` | `0 -> 1` | an income below 1 (0.50) still has a savings rate | `month-result`: tiny income |
| `card-cycle.js:31` | `<=`, `3 -> 4`, `+ -> -`, `1 -> 2` | the search window of `dueMonth` (previous month to 3 months ahead, else next month) | `card-cycle-rules`: window tests with closing dates set by hand |
| `portfolio.js:11` | `>` to `>=`, `<` to `<=` (dates) | trades of the same day are taken in id order | `portfolio-realized`: same day, both input orders |
| `store.js:22` | `>` to `>=` | Santander balance of exactly 0.005 is not moved to Nubank | `store-hooks` |
| `transfers.js:20` | `===` to `!==` | direction taken from the type when the reader gave no flow | `transfer-pairing` |
| `transfers.js:35` (all 5) | `>=`, `0 -> 1`, three `||` to `&&` | zero and small amounts, ignored and contribution drafts, drafts without a date | `transfer-pairing` |
| `import-classify.js:45` (all 8) | boundaries | unsure installment `n/of`: 1 <= n <= of, 2 <= of <= 24 | `import-classify`: boundary cases |
| `import-duplicates.js:30` | `&&` to `||` | with two saved records sharing a key, the first is the one named | `import-duplicates` |
| `import-csv.js:47` | `&&` to `||` | a free column before the description is not the description | `import-csv-columns` |
| `import-csv.js:39,52,54,57,58,65` (all but the two equivalent ones below) | many | empty file has no header; empty column is not a date; header value, debit and credit columns at index 0 are kept; a second date column is not the value; 4 of 5 is enough, 3 of 5 is not; D/C column at index 0; `complete` with only a debit or only a credit column | `import-csv-columns` |
| `import-ofx.js:10` | `4000 -> 4001` | detection reads only the first 4000 characters | `import-readers` |
| `import-ofx.js:19` (7) | `<` and `>` inside the regex | an entry stops at each of its four closing tags | `import-readers`: text after each closing tag does not leak |
| `import-ofx.js:24` | `1 -> 2`, `+ -> -` | entry position (1-based) | `import-readers` |
| `import-ofx.js:23` | `&&` to `||` | a memo equal to the name is shown once (the mutant would print "A - A") | `import-readers` |
| `sync/records.js:31` (4) | hash constants | the fingerprint is a stored contract (`meta.known`); changing it would re-send every record | `sync-records`: golden values (a compatibility pin captured from the implementation, not an independent source) |
| `sync/outbox.js:37,42` | `>=` to `>`, `0 -> 1`, `1 -> 2` | deleting a never-sent record cancels exactly its entry, also at index 0; settings entry at index 0 is updated in place | `sync-records` |
| `sync/apply.js:34` (4 of 5) | `||` to `&&`, `1 -> 2` (twice), `!==` to `===` | the id counter of the settings document: keeps the local counter, never lowers it, never below 1 | `sync-apply` |

The same method on `invoice-payment.js` and `trade-commit.js` (found by the coverage report) killed 26 of 29 mutants; the 3 left are in section 2.

## 2. Equivalent mutants (cannot change behaviour), with the reason

| Where | Mutation | Why no valid test can tell the difference |
|---|---|---|
| `month-summary.js:19` | `x.value > 0.004` to `>=` | `x.value` comes from `invoiceUndetailed`, which returns `Math.max(0, roundMoney(...))`: always a whole number of cents. No value equals 0.004. |
| `import-duplicates.js:14` | `Math.round(v*100)` to `v*101` | `cents` is only a bucket key, used on both sides. Money values are whole cents (`parseAmount` rounds with `roundMoney`), and two different cent values stay 1.01 apart, so no two values share a key and equal values always do. |
| `import-duplicates.js:37` | `SAVEABLE.includes(d.type) && d.date` to `||` | The guard is redundant: `matchExisting` skips records of another type (`t.type !== d.type`) and saved `aporte` records are never in the bucket; a draft without a date gives `daysBetween` of NaN, which is neither 0 nor 1. The tests still pin the outcome (no duplicate flag) for those drafts. |
| `portfolio.js:11` col 76, 91 | `1 -> 2` in the comparator | A sort comparator only uses the sign. |
| `portfolio.js:11` col 82 | `a.id < b.id` to `<=` | Differs only for two trades with the same date **and the same id**. Ids are unique (`'t' + S.nid++`). The assumption is stated here. |
| `import-csv.js:54` col 54 | `width - 1` to `width + 1` | The scan starts at a column that does not exist; `share()` is 0 for an empty column, so it is skipped and the next index is `width`, then `width - 1`: the same result. |
| `import-csv.js:57` col 16 | `i < width` to `<=` | The extra index is an empty column: `col(i).length` is 0, so it is skipped. |
| `import-ofx.js:21` | `bad.push(i+1)` (two mutants) | `bad` is only used through `bad.length` (`unreadable`). The pushed number is never read. |
| `invoice-payment.js:21` | `value >= inv.rest - 0.004` to `>` | `value` and `inv.rest` are whole cents: `value == rest - 0.004` cannot happen, and `value == rest` is true for both. |
| `invoice-payment.js:34` | `value > free + 0.004` to `>=` | Whole cents again: `value == free + 0.004` cannot happen. |
| `trade-commit.js:38` | `tradeKey(date, t, 0)` to `1` | The third argument only forms the suffix after `#`, which `.split('#')[0]` throws away. |
| `store.js:12` (7) | seed balances and `est` flags | `seed()` is used in production only by `settings-commands.js:24`, which then does `n.snaps = []`. The values never reach a person; a test asserting them would only repeat the literals. |

## 3. Not equivalent, but harmless in normal use: reported, not changed

`sync/apply.js:34`, `counter > 1` to `>= 1` (and `!==` to `===`). When the server's settings document has no `nid`, the original leaves the counter `undefined`, and the next `S.nid++` produces `NaN` ids. The mutant would set it to 1. A settings document written by this app always has `nid` (it is not one of the lists), so it needs a malformed document from the server. Fixing it means changing production code: asked for approval, not done (see critical-business-rules.md, item 7).

## 4. Second sample (seed 2, 92 mutants, 11 files): new survivors found and handled

A fresh seeded sample found 17 survivors in files the first round had not sampled well. Reading every mutant of the affected lines (not only the sampled ones) showed more. All were handled the same way.

Killed by new tests: `money.js:14` (the mask keeps 13 digits), `card-cycle.js` (`ruleClosing` same-month due date, `dueDateOf` with day 31, the reset of an old card setting and its `over` object), `import-csv.js` (small debit, empty debit and credit, description and id column in first position, row with `0,00`), `transfers.js` (`recordToTransfer` keeps the import key; only transfer-like saved records are offered as the other side, in both directions), `accounts.js` (two balances on one day), `store.js` (empty state), `sync/outbox.js` (edit of a never-sent record at index 0), `sync/apply.js` (adoption at index 0, conflict count).

Equivalent, with the reason:

| Where | Mutation | Reason |
|---|---|---|
| `card-cycle.js:25` | `k <= 2` to `< 2`, `2 -> 3` | `ruleClosing` looks back k months for the closing whose due date falls in the invoice month. A due date is in the closing's month or the next, so only k = 0 and 1 can match; k = 2 never does. |
| `card-cycle.js:13` | `due || 7` (second one) to 8 | The first conversion on the previous line already sets `due: due || 7`, so by then the due day is never missing; the second default is unreachable for a card that passed through it. (The case of a card with a best day, no `v3` and no due day is tested and does reach it.) |
| `import-csv.js:48` (4) | `m.debit >= 0 && m.credit >= 0 && m.debit === m.credit` | Dead guard. `free(i)` excludes a column already given to `debit`, so the credit search can never return the same column. The guard can never fire. It could be removed from production code (not done). |
| `import-csv.js:67` (2) | `deb && Math.abs(deb) > 0` | The second condition repeats the first: a truthy number is not 0. |
| `import-classify.js:44` | `\d{1,2}` to 3 digits (second group) | The next line requires `of <= 24` (and `n <= of`), so a longer number is refused either way. |

## 5. Result

First sample, round 1: 72 mutants, 53 killed. Second sample, round 1: 36, 20 killed. Round 2, targeted reruns of every survivor line: all closed or listed above.
Seed 2 sample, **before** the new tests: 92 mutants, 75 killed (81.5 %). **After**: the same 92 mutants, 90 killed (97.8 %); the 2 left are the equivalent ones above. These tests were written after seeing that sample, so 97.8 % overstates the general strength; a fresh sample (seed 3, other files) is in final-quality-report.md.

The fresh seeded sample of the final run is in final-quality-report.md. Every survivor of round one and two is either killed by a test or listed above with its reason.

## 6. Seed 3 sample (72 mutants, 12 domain files, `--per-file 6 --seed 3`)

First measurement, before any new test for this sample: 72 mutants, 49 killed (68.1 %), 23 survived. These were investigated one by one and tests were written (`threshold-boundaries`, `spending-and-vouchers`, `investment-yield`). The same 72 mutants, after: **66 killed (91.7 %)**, 6 survived; then every one of those 6 was handled by line (`--lines`): 5 were real gaps and are now killed, 1 is equivalent.

| Where | Mutation | What was not checked | Test |
|---|---|---|---|
| `savings.js` | boundaries | levels at 0.2, 0.1, 0 and just below | `threshold-boundaries` |
| `allocation.js` | `setTarget` range | 100 accepted, 100.5 refused | `threshold-boundaries` |
| `goal-projection.js:33` (5) | `*`, `<=` | chart scale: goal 5 % above the top, exactly at the edge | `threshold-boundaries` |
| `goal-projection.js` | `chartMonths`, `tableMonths` | ranges | `threshold-boundaries` |
| `own-names.js:12` | `&&` to `||` | particles ("de", "da") must not count as name words | `threshold-boundaries` |
| `own-names.js` | word distance | at most 3 words between first and last name | `threshold-boundaries` |
| `budgets.js` | `>0` | a budget of 1 is listed | `threshold-boundaries` |
| `import-draft.js:36` (3) | `false -> true`, `0 -> 1` | blank draft: value 0, no pair to fix | `threshold-boundaries` |
| `import-draft.js` | `keptTransfers` | zero value dropped | `threshold-boundaries` |
| `spending.js` | window | closed months only; no current, future or empty month | `spending-and-vouchers` |
| `month-summary.js:14` | `0 -> 1` | a non-income, non-expense record on the voucher balance counts 0 | `spending-and-vouchers` |
| `month-summary.js` | voucher totals | before 70, in 50, out 20, total 100 | `spending-and-vouchers` |
| `card-invoices.js` | `openCard` | invoice being edited also offers its own purchases | `spending-and-vouchers` |
| `report.js` | `hasData`, `trendOf` | each data source; current month excluded | `spending-and-vouchers` |
| `investments.js:24` | `>` to `>=` | an account of exactly 0.005 is not listed | `investment-yield` |
| `investments.js` | `realSeries` | yield without contributions and without the start of a new account | `investment-yield` |

Equivalent, with the reason in the code:

| Where | Mutation | Reason |
|---|---|---|
| `card-invoices.js:20` | `acc+t.value <= f.value+0.004` to `<` | Amounts are whole cents, so `acc+value` and `f.value` differ by a multiple of 0.01 (plus float noise far below 1e-9). It can never equal `f.value+0.004`; the two comparisons give the same answer for every possible input. |

Not mutated again: `import-commit.js` lines 34 and 40 were killed in this run (they are not in the 6).

## 7. Round 3

- `src/core/id-counter.js` (new): 26 mutants, 23 killed after a first run of 11 killed and 15 survived led to direct edge tests (largest safe integer, ids of every kind, series number only for transactions, null entries in a list, non-objects). The 3 left are equivalent: `n >= 1` against `n >= 2` and `1 -> 2` in the validity check (a counter of 1 is either kept as 1 or rebuilt from the floor, which is 1 when no id is in use and is lifted otherwise, so the result is the same), and `state.nid < floor` against `<=` (equal values: assigning the floor changes nothing).
- Found while writing the integrity properties and closed: `transfers.js:69` (`value > 0`: 0 and 1 and 0.5) and `transactions.js:33` (`restoreTransactions` with an undo record that has no list or an empty list), both now killed.
- The flows scenario was proved with four deliberate breaks of the app (due day ignored, balance not replaced, "apply to the next" returning nothing, marked purchases not summed): each made the matching steps fail. Two real bugs in the screens were found by it (see owner-decisions.md).
