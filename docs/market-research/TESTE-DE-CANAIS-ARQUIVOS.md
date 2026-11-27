# Channel test: the owner's real statements through the app's own import code

Date 2026-11-27. Everything ran **locally** (Node, the app's own `core/domain` code and its vendored pdf.js). No file left the machine. This document has only aggregate numbers: no descriptions, names, document numbers or balances.

## What was tested

| Bank | Files | Format |
|---|---|---|
| Santander | 10 monthly statements (Jan to Oct 2026) | digital PDF |
| Nubank | 11 monthly statements (Jan to 16 Nov 2026) | digital PDF |
| Bradesco | 1 statement (one period, about 11 pages of table) | digital PDF |
| Inter | 1 file, 1 Jan to 26 Nov 2026 | OFX |
| Itaú | **none provided** | not tested |

Method: each file goes through `readImportFile` (the same path as the Import screen), once cold (empty history, no own name) and once with the owner's name registered and files imported in month order so that cross-bank transfer pairing could work.

## 1. Reading: do the numbers match the statement? (the only ground truth available)

| Check | Result |
|---|---|
| Santander: credits and debits printed in each statement vs the sum of imported lines | **10 of 10 months match to the cent** |
| Nubank: (final balance - initial balance) vs imported in/out, including the "net yield" line the statement prints | **11 of 11 match to the cent** once the yield is added. In 7 months the difference was exactly that month's "Rendimento líquido" (e.g. 0,38 to 38,97). The app does not import it as income; it tracks the yield through balance snapshots, by design |
| Bradesco: total credit and total debit printed vs imported | **both match to the cent** (1 of 1) |
| Inter OFX | 41 transaction blocks in the file, 41 entries read. **No totals to reconcile**, so only the count is verified |

Conclusion (evidence): for these banks and this period, **reading is exact**. The problem is not parsing.

## 2. Classification: how much arrives resolved?

Cold start (no history, no own name registered), lines flagged for review or without category:

| Bank | Lines | Need review | Without category |
|---|---|---|---|
| Santander | 134 | 89 (66%) | 80 |
| Nubank | 101 | 98 (97%) | 95 |
| Bradesco | 184 | 139 (76%) | 139 |
| Inter | 41 | 39 (95%) | 31 |

Reading: on a first import **almost nothing is categorised**, because suggestions come only from what the user typed before. That is the expected cold start, not a defect, but it is the real effort a new user would face.

## 3. Own transfers and the other side

With the owner's name registered and month-ordered import:

- 88 transfers between own accounts were recognised and kept apart (Santander 44, Bradesco 20, Nubank 17, Inter 7), and not counted as income or expense.
- **34 were matched with their other side** in a different bank's statement (Santander 29, Nubank 4, Inter 1).
- Remaining lines still flagged "maybe a transfer" after the name was registered: Bradesco 104 of 184, Santander 23 of 134, Nubank 5 of 101, Inter 2 of 41.
- The unmatched own transfers include money sent to the Itaú account, which is a missing file, not an app defect (**not verified**).

## 4. What this means for the product (interpretation, not measurement)

1. The "import and confirm" idea does not need better reading. Reading is exact on 23 of 23 files that can be checked by totals or counts.
2. The effort is in **categories** (cold start) and in **Pix/TED to people** (Bradesco: 104 lines to decide). The second is where the "money of third parties" idea matters: those lines need a decision that is not "expense" by default. Whether they are third-party money, own transfers or real spending was **not** validated; only the owner can say.
3. Automatic cross-bank pairing works for part of the transfers (34 pairs). The share that did not pair was not analysed line by line.

## Limits (read before using these numbers)

- Ground truth is only the totals printed in the statements. **Whether each category or each transfer decision is right was not checked**; that needs the owner to review a sample.
- Itaú missing; Nubank and Santander only as PDF (the research says Nubank also offers CSV and OFX; not tested here); Inter only as OFX; Bradesco one period only.
- One person's statements: the numbers are not a market sample.
- The owner's name was set by reading it from a statement header locally; it is not stored in any document.
- The scripts used live outside the repository and were not committed.
