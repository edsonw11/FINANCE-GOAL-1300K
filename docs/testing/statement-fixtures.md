# Strategy for testing statement imports with realistic files

## What exists

| Layer | Where | What it proves |
|---|---|---|
| Text rules of the PDF reader | `tests/unit/import-pdf.test.js` (31 checks) | Lines rebuilt from positioned pieces, numeric and "05 NOV" dates, signs (`-`, `D/C`, parentheses), balance column, card invoice, honest failures. Input is the text a digital PDF gives. |
| CSV, OFX, classification, duplicates, transfers | `import-readers`, `import-flow`, `import-classify`, `import-csv-columns`, `import-duplicates`, `transfer-pairing`, `import-values`, `import-roundtrip` | Each rule on made-up lines, including installments (`parseInstallment`), refunds (`estorno` is ignored), negative values, transfers between own accounts, empty files. |
| **Drop-in fixture files (new)** | `tests/fixtures/statements/` + `tests/unit/import-fixtures.test.js` | Every file there is read by the real importer and compared with `<name>.expected.json`, written by hand. Adding a new bank layout needs no code. |
| Real PDF bytes in a real WebView, under the Android policy | `tests/smoke-native-import.js` with `tests/fixtures/statement-pdf.js` (bank, card, custody, not-a-PDF, **password-protected**) | The reader starts, reads, and each failure shows its own message. |

## The fixtures now in `tests/fixtures/statements/`

All are made up (names end in "SAMPLE"); none comes from a real person.

| File | Covers |
|---|---|
| `bank-ptbr-semicolon.csv` | `;` separator, `dd/mm/yyyy`, `1.234,56`, `R$ -9,90`, `45,00-`, `(3,50)` |
| `bank-comma-iso-dot.csv` | `,` separator, `yyyy-mm-dd`, dot decimals, English headers |
| `card-installment-refund.csv` | card statement, installment text `02/05`, refund and invoice payment ignored |
| `header-only.csv` | no transactions: refused with a reason |
| `no-transactions.ofx` | OFX without transactions: refused with a reason |
| `incomplete-rows.csv` | rows without a value or a date are skipped, the others are read |
| `bank-with-balance.pdf.txt` | text of a digital PDF with a balance column |

## Adding a real statement safely

1. Never commit a real statement. Take a copy and replace every personal item: holder name, document numbers, account and agency, addresses, merchant names that identify a person, and change every amount and date by a fixed pattern while keeping the **layout** (column order, header text, date format, sign style, thousand and decimal marks, line breaks).
2. Save it as `<layout>.csv`, `.ofx` or `.pdf.txt` (for a PDF: the text lines as pdf.js gives them; open the real PDF in the app once and copy what the reader sees).
3. Write `<layout>.expected.json` **by hand** from the file: `{"opts":{"today":"2026-11-20","kind":"bank"},"ok":true,"drafts":[["2026-11-05",12.5,"despesa"]]}` (for `.pdf.txt`: `{"opts":{...},"entries":[["2026-09-05",-123.45]]}`). Do not paste the program's output as the expectation.
4. Run `node tests/run-unit.js`. For a layout the reader gets wrong, the test fails: that is the bug report.

## Limits (be honest)

- **No real bank layout was available as an anonymised sample**, other than the files the owner opened by hand (not committed, personal). The fixtures above come from the formats the importer already documents, not from new bank layouts: **a bank layout that the reader has never seen can still fail**.
- A PDF made of scanned images (no text) cannot be read; the reader says so, but it is not tested with a real scan.
- The unit harness cannot run pdf.js; real PDF bytes are only tested by the end to end suite, with PDFs generated for the tests (Chrome print to PDF, and a Ghostscript copy with a password).
