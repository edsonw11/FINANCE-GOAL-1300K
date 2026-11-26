# End to end suites: what they drive, and what they do not

## Method (and its limit)

The end to end suites are `tests/smoke.js` (65 steps), `smoke-flows.js` (23, round 3), `smoke-sync.js` (5), `smoke-xss.js` (8), `smoke-native.js` (23 in two runs) and `smoke-native-import.js` (CSV, OFX and PDF under the Android policy, 9 steps incl. the password PDF), plus the on-device script. To find what they do not drive:

1. For every module of `src/ui` and `src/ui/views`, the element ids it creates or reads were extracted (235 ids) and searched in the suites. 113 are named by a suite, 122 are not. This overestimates the gaps: many ids are labels or outputs, and some actions are driven by text or data attributes.
2. The candidates below were then checked by searching the suites for the action itself (the words of the screen, not the id).

The unit suite (`npm run test:unit`) covers the rules behind these screens (all of `src/domain`, `src/core`, `src/sync`: 99.95 % of lines, see coverage-report.md); the question here is only the screen: the form, the validation message, the wiring from a tap to the rule.

## Screens that are covered with their main flow

Navigation and tabs; first visit; summary cards opening their lists; list filters and search; new, edit, delete with undo, repeat (copy); quick entry; category detail, groups, move to a group, new category with suggestion; budget (empty state, set, over-limit warning); recurring bills; CSV import: preview, edit a row, split, confirm, repeat of the same file, old statement, transfers between own accounts; PDF import (bank, card, custody); brokerage note; report; card: purchase, invoice navigation, partial payment and cancel; test data on and off; offline use; sync card; XSS; app lock on the Android shell.

## The 12 gaps after round 3

New scenario: `tests/smoke-flows.js` (a blank app, 23 steps, run by `scripts/smoke.sh` as "money flows"; `SMOKE_ONLY="money flows" bash scripts/smoke.sh` runs only it). Every step checks what the screen shows **and** what is stored, with fixed dates in the past so it does not depend on the day. Each closed row was also proved by breaking the app on purpose and watching the step fail (listed in the last column).

| # | Screen or flow | Priority | Status | What is driven now | Proof that it detects a defect |
|---|---|---|---|---|---|
| 1 | Settings: card rules, yield, planned contribution | Critical (moves every card total and the projection) | **Closed** | best day 10 or 25 with due day 28 decides the invoice of a 20 March purchase (`2026-04` or `2026-03`, worked by hand); planned contribution and yield are stored and change the projection text and table | due day ignored: 4 steps fail |
| 2 | Manual balance | Critical (the main number of the app) | **Closed** | a typed balance is stored and shown; typing the same day again replaces it; no date is refused with its message and stores nothing | snapshot not replaced: the step fails |
| 3 | Pay invoice: partial, checked purchases, forgotten purchase, future invoice, value 0 and above what is open | Critical (money out of the account) | **Closed**, one owner question (Q8) | partial 30 is registered once and the rest shows 120,00; unchecking a purchase pays only the checked ones; a forgotten purchase is added to the invoice; a future invoice is paid in full; 0 is refused; a value above what is open still asks to confirm and shows the amount; paying is not an expense; paid never above bought | broke the sum: 2 steps fail |
| 4 | Edit with "apply to similar" and delete | High | **Closed** | edit one of a series of three with the option on (this and the later ones change, the earlier does not), with it off (only that one), delete one and undo | `futureSiblings` returns nothing: 2 steps fail |
| 5 | Split in the new-record form | High | **Closed** | 100 with a part of 30 in another category is stored as one record with its part; parts above the total are refused with a message and nothing is stored | (message matched against the real text) |
| 6 | Series ("Todo mês · 3x") | High | **Closed, found a bug** | three records one month apart with their own ids and one series number; **the form kept "3x" for the next new record** (fixed, see owner-decisions.md) | the step failed before the fix |
| 7 | Invoice form (advanced) | High | **Closed, found a bug** | marked purchases add up; "usar a soma" fills the value; a payment above the marked ones keeps the rest as "sem detalhe"; marked purchases above the payment are refused; **choosing another invoice in the list was undone** (fixed) | sum ignored: 2 steps fail; failed before the fix |
| 8 | Goal and projection text | Medium | **Partly closed** | the text and table change when the planned contribution changes (row 1); the exact wording is not asserted (it would break on every copy edit) | - |
| 9 | Category dialogs: merge and confirm | Medium | **Open** | the unit tests cover the commands; the dialog flow is not driven | - |
| 10 | Import mapping screen | High (the only recovery for an unknown layout) | **Closed** | with two date columns the first is used, "Ajustar colunas" picks the other and the saved records follow the choice; an unrecognised file opens the mapping screen with its explanation, and choosing no date says so and saves nothing | - |
| 11 | Error and loading states | Medium | **Open** | only the save error, the invalid PDF, the password PDF and the empty value are driven; a slow import and a failed backup write are not (a scripted file-plugin failure is needed) | - |
| 12 | Persistence after a kill | Medium | **Covered elsewhere** | the on-device script (emulator), and the unit tests of save and load (`state-recovery`, `id-counter`: save, load, add) | - |

Still open after round 3: rows 9 and 11, and the part of row 8 that is wording. They are listed in the report as remaining risks, not hidden. Rows 9 and 11 have no money moving through them: a category merge changes labels, not amounts.

Also not covered by any end to end suite: the on-screen keyboard and a real file picker (only a real phone: see device-checklist.md), and a reload of the page in the middle of the scenario (the runner has one page load per scenario; `smoke-xss.js` is the only one that loads twice).
