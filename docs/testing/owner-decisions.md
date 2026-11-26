# Owner decisions (Q1 to Q5 and Q8 decided on 2026-11-26; Q6 and Q7 closed)

Each section says what the app did before, what the owner decided, what the app does now, and which tests pin it. The decisions were applied in the working tree only: **nothing is committed**.

## Q1. Card settings of an old backup: decided, keep the reset and validate on read

**Before.** `CARD()` replaced `best` with 29 for any state without the `v3` mark and kept `due`. A card with `best` or `due` of `0`, `null`, a string or a number outside 1 to 31 went straight into the invoice rules.
**Decision.** Keep the reset for pre-v3 data; do not reinterpret `best`. Add a defensive check on read.
**Now.** `best` and `due` must be integers from 1 to 31. A valid value is kept as it is; a missing or invalid one becomes the default (best 29, due 7), per field, so one good field is not lost. Valid backups and their format are unchanged; nothing is migrated or deleted (`src/domain/card-cycle.js`).
**Tests.** `card-settings-validation.test.js` (zero, null, string, out of range, fractional, missing field, valid values kept, the closing date of a bad card).

## Q2. Planned contribution and "use my average": decided A, both keep cents

**Before.** The Settings field stored cents; the "use my average" button rounded to whole reais.
**Now.** Both use `roundMoney` (`setPlannedContribution` in `settings-commands.js`). An average of R$ 183,33 is stored as 183.33, not 183. Existing stored values are untouched.
**Tests.** `settings-commands.test.js`: cents kept, third decimal rounded to the cent, NaN and text give 0, the field and the button store the same amount, the average of three months keeps its cents.

## Q3. `1.234` and `1,234`: decided, keep both parsers and document the difference

Nothing changed in the code. The two readers differ on purpose:

| Text | Form parser (`parse`, `core/format.js`) | File importer (`parseAmount`, `core/import-values.js`) |
|---|---|---|
| `1.234` | 1234 | 1234 |
| `1,234` | **1.234** (a comma is always a decimal mark) | **1234** (a lone comma followed by 3 digits is a thousands mark) |
| `1,234.56` | not a supported input | 1234.56 |

**Risk to know.** A bank CSV in American format writes `1,234.56` (read right) but also `1,234` for a round amount: the importer would read that as 1234 and an American file with a decimal point and thousands commas is the case where the two readers could disagree with the file's meaning. Bank files seen so far (the owner's statements and the fixtures) use the Brazilian format with two decimals, so no known file is affected. Every amount is shown in the preview before anything is saved.
**Tests.** `import-values.test.js` pins both readers side by side.

## Q4. `migrate()`: decided B, run once with a mark in the state

**What `migrate()` changes.** Only when an account `sa` exists, is not archived, and an account `nu` exists: it replaces today's snapshots of `sa` (and of `nu` when `sa` has money), adds a snapshot of `nu` with `nu + sa`, adds a zero snapshot of `sa`, and archives `sa`. It touches nothing else.
**Now.** The state carries `migrated: {sa: true}` after the move (`src/domain/store.js`). With the mark, `migrate()` returns at once, even if the account shows up unarchived again. Rules kept: an old backup (no mark, Santander still open) is migrated on its next open, so the money still moves; an account already archived by an earlier version only gets the mark (stored on the next save, no snapshot added); a state without `sa` or `nu` is left exactly as it was, with no mark. The mark travels in the settings of the backup and of the sync.
**Tests.** `store-hooks.test.js`: first run, repeated run, mark in a backup, old backup without the mark, archived by an earlier version, no Santander. Mutants removing the guard, the mark or the archived branch are killed.

## Q5. Import words: decided C, a possible transfer is flagged and kept visible

**Before.** Money **in** with a redemption or investment word (`resgate`, `aplicacao`, `tesouro`, `caixinha`…) on a bank statement was ignored as a transfer with no sign of doubt.
**Now.** The line is still not counted as income or expense and is not selected, but it carries the flag `possible-transfer` with a text that says why and how to count it (change the type to income). It is counted in "Para revisar" (`possibleTransfers` in the overview) and shows its note in the review. Totals do not include it until the person changes its type. Money **out** is unchanged (a contribution flagged `check-aporte`). `poupanca` keeps being an own transfer in both directions (it was never ignored, as the earlier text said); own-transfer words on a card statement stay ignored with no flag.
**Tests.** `import-classify.test.js` (money in and out, five words, an ordinary income, the card case, the flag text) and `import-flow.test.js` (flag, not selected, totals unchanged, changing the type counts it, saving the untouched review creates no record). Mutants dropping the flag, flipping the direction or removing it from the review count are killed.

## Q6. Closed: header "Data do lançamento"

Fixed in round 2 with your approval (`import-csv.js`); the regression test fails without the fix.

## Q7. Closed: the id counter

Investigated in round 3 ([id-counter.md](id-counter.md)): the risk was real (missing counter gave `NaN` ids, a low counter reused ids). Fixed in `src/core/id-counter.js` with a test that failed first. Format of ids and existing data are unchanged. Kept by the owner's decision of 2026-11-26.

## Q8. Paying more than what is open on an invoice: decided A (provisional), keep it with a clear confirmation

**Before.** Typing R$ 500 on an invoice with R$ 150 open was accepted, and the confirmation did not say that the extra R$ 350 would not be a credit.
**Decision.** Keep the behaviour; the confirmation must show the open amount, the amount to be paid, the excess and what happens to the excess. No automatic credit, no change to the financial model or to the sync.
**Now.** Above the open amount, the confirmation reads: "Em aberto: R$ 150,00. Você vai pagar: R$ 500,00. Diferença: R$ 350,00. A diferença será registrada como despesa “Cartão (sem detalhe)” neste mês; não vira crédito para as próximas faturas." Paying exactly the open amount shows no warning. The rule is `paymentExcess` in `invoice-payment.js`; the dialog is in `pay-invoice.js`.
**Provisional.** If the owner starts paying in advance, option B (cap at the open amount) or a real credit should be evaluated: today an advance becomes an expense of the month and does not reduce the next invoice.
**Tests.** `invoice-payment-edges.test.js` (the excess, and the next invoice staying whole) and the end to end "money flows" step (text of the dialog, and no warning at the exact amount).

## Two behaviour changes made in round 3 that you should know about

Both were found by the new end to end test, reproduced by a test that failed first, and fixed with one line each. They change what the screen does, so please say if you want them reverted.
The owner decided on 2026-11-26 to keep both.

1. **"Repetir" stayed on after saving a series.** After a record with "Todo mês · 3x", the next **new** record was also created three times (the toast said "(3x)"). The form now goes back to "Não repetir" after a save (`transaction-form.js`, `endEdit`).
2. **Choosing another invoice in "Fatura que vence em" was undone.** In the advanced invoice form, picking a month in the list (or ticking "any date") reset the list to the invoice of the payment date, so only the invoice of "today" could be paid with its purchases. The list and the checkbox now only re-select the purchases (`invoice-form.js`, `selectInvoicePurchases`).
