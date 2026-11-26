# Coverage gaps (state at the start of the audit, and what happened to each)

How the gaps were found: (1) V8 function coverage of the unit suite (functions that never ran); (2) a list of every exported function or backend file that no test names; (3) reading each critical rule and asking what bug the tests would miss; (4) the owner's report that PDF import failed on the Android build.
Status: **CLOSED** = a test now protects it; **OPEN** = not covered, reason given; **QUESTION** = behaviour whose intent is not documented, so no test was written (see `critical-business-rules.md`, section 3).

## Browser app: rules (`src/core`, `src/domain`, `src/sync`)

| ID | Component | What was not protected | Prio | Status | Closed by |
|---|---|---|---|---|---|
| G01 | `domain/portfolio.js` `realizedTotal` | Realised gain or loss of what was sold (average cost, fees, several tickers) never ran | P0 | CLOSED | `portfolio-realized` |
| G02 | `domain/store.js` `adoptRemoteState`, `onSave` | The state the sync merges replaces the local one and is stored; listeners notified; a failing listener must not break saving; allocation cache must not survive | P0 | CLOSED | `store-hooks` |
| G03 | `domain/store.js` `migrate` | One-off migration that moves money between accounts and archives one, run at every start | P0 | CLOSED | `store-hooks` |
| G04 | `domain/card-cycle.js` `cycleStart`, `nearestDueMonth`, `invoiceMonthOf` | Which days belong to which invoice: never checked as a whole | P0 | CLOSED | `card-cycle-rules` (by hand and as a property over 9 card settings x 30 invoices) |
| G05 | `domain/transactions.js` `invoiceOfPurchase` | Which paid invoice absorbs a purchase (automatic and manual choice) | P1 | CLOSED | `invoice-of-purchase` |
| G06 | `domain/accounts.js` `totalGross` | Gross total with accounts that have no gross value; the "approximate" flag | P1 | CLOSED | `accounts-gross` |
| G07 | `domain/import-classify.js` | Direction, own transfers, invoice payment, refund, redemption, installments, fee and salary categories were reached only through whole-file imports | P1 | CLOSED | `import-classify` |
| G08 | `domain/import-duplicates.js` | The confirmed and possible duplicate rules, day tolerance, cents comparison | P1 | CLOSED | `import-duplicates` |
| G09 | CSV and OFX reading | Only hand-written examples; no check that whatever is written is read back | P1 | CLOSED | `import-roundtrip` (40 random statements x 2 formats + 4 CSV variants) |
| G10 | Month result, report | Rules checked on a few ledgers only | P0 | CLOSED | `finance-invariants` (60 random ledgers against an independent oracle) |
| G11 | `domain/settings-commands.js` | Planned contribution rounding, goal fallbacks, card day clamping | P1 | CLOSED | `settings-commands` |
| G12 | `sync/api-client.js` | Verbs, CSRF header, offline / unauthorized / server mapping, `me()` | P1 | CLOSED | `api-client` |
| G13 | `sync/runner.js` `reviewItems`, `clearReview`, `sync/outbox.js` `pendingCount` | What the user sees of refused changes | P2 | CLOSED | `sync-runner` (extended) |
| G14 | `core/dates.js` `mLabel`, `mShort`; `core/format.js` `f0`, `f2`, `pc`, `parse`; `domain/transfers.js` `pairText` | How amounts and months are written | P2 | CLOSED | `display-format`, `transfers` |
| G15 | `domain/demo-extras.js`, constants of `core/config.js` | Demo data generators and constants | P3 | OPEN | Test data only; used by the end-to-end suite. |

## Android build

| ID | What | Prio | Status | Closed by |
|---|---|---|---|---|
| G16 | Opening a file under the Android CSP (the PDF reader failed on the phone, "Não consegui carregar o leitor de PDF") | P0 | CLOSED | `smoke-native-import` (CSV, OFX bank and card, PDF statement, card invoice, custody, broken PDF, zero CSP violations); mutation-proved |
| G17 | The CSP and the pdf.js files of the Android build | P1 | CLOSED | `mobile-build` |
| G18 | Importing a file on a real phone or emulator | P1 | OPEN | `adb` was not available; `device-test.mjs` still has no import step |

## Backend

| ID | Component | Gap | Prio | Status |
|---|---|---|---|---|
| G19 | `http/parse-input.ts` | Refusal shape, never echoes the input | P1 | CLOSED (`parse-input.test.ts`) |
| G20 | `accounts/account.schemas.ts` | UUID id, name length, control characters, lone surrogates, strict body | P1 | CLOSED (`account-schemas.test.ts`) |
| G21 | `plans/entitlements.service.ts` | Feature map for free and pro, unknown person, catalogue-only keys, change visible on next call | P1 | CLOSED (`entitlements.service.test.ts`) |
| G22 | Controllers, modules, guards | Exercised through `*.http.test.ts` and the integration suite, not by name | P2 | ADEQUADO, not changed |
| G23 | Backend integration suite | Not executed in this audit (needs PostgreSQL and Keycloak; the local stack holds the owner's development data) | P1 | OPEN here; CI runs it |
| G24 | Line and branch coverage of the backend | `@vitest/coverage-v8` is not installed | P3 | OPEN |

## Screens (`src/ui/views`, 56 modules)

| ID | Gap | Prio | Status |
|---|---|---|---|
| G25 | No unit tests for the screens; protection is the end-to-end suite (65 steps) and the XSS suite | P2 | OPEN. A real fix is a DOM-capable unit harness (jsdom) or Playwright: a tool decision for the owner. |

## Items of the brief that do not apply

Fundamental analysis, asset universe, OpLab, Bolsai, Tesouro Direto: not implemented in this code base (`docs/architecture/diagrams/analysis/integrations.md` lists them as NOT IDENTIFIED), so nothing was tested. Fixed-income maths is limited to the goal projection (compound monthly rate from an annual one), already checked against an independent calculation in `calc-audit` and `projection`. The PDF report is made by the browser's print dialog; its numbers (`buildReport`) are protected by `report` and `finance-invariants`; the print layout is checked only by the end-to-end suite.
