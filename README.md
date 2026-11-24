# Finance · R$ 1.3M Goal

Personal app (plain HTML + CSS + JavaScript, no build required) to track:

1. **Goal:** invested net worth up to R$ 1.3 million, with projection and scenarios.
2. **Monthly cash flow:** income, expenses, contributions, credit card (invoices by cycle), meal vouchers and categories.
3. **Spending analysis:** month-by-month curve, trend and per-category detail.

Data lives only in the browser (`localStorage`, key `metaapp.v2`). Export a backup in Settings → Data from time to time.

## How to use

| I want to | Do this |
|---|---|
| Open the app (development) | `scripts/serve.sh` and open `http://127.0.0.1:8000/index.html` (ES modules need http) |
| Open the app without a server | open `index.html` (it forwards to `dist/finance_goal_1300k.html`, same data) or the dist file itself; run `python3 scripts/build.py` after changing `src/` |
| Build a single file to keep or share | `python3 scripts/build.py` → `dist/finance_goal_1300k.html` |
| Open on the phone (same Wi-Fi) | `scripts/serve-phone.sh` (serves dist/ with caching disabled) and open the printed `http://<pc-ip>:8080/` (today `http://192.168.15.13:8080/`); on the phone, "Add to Home screen" makes it an app icon |
| Run the unit tests | `node tests/run-unit.js` (one file per module in `tests/unit/`, plus the architecture and module-graph rules) |
| Run the end-to-end test | `scripts/smoke.sh` (headless Chrome; use `CHROME=chromium` if needed) |
| Check phone widths | `scripts/mobile-check.sh` (320, 360, 375, 390, 430, 768 px: no horizontal scroll, readable charts, 44 px targets) |
| Take a screenshot | serve the folder on port 8765, then `scripts/shot.sh 390 844 /tmp/a.png "demo&tab=resumo"` |

> The source is **ES modules**: `index.html` loads only `src/app.js`, and every file imports what it uses
> (one named import per line, relative `.js` paths). `tools/module-graph.cjs` reads that graph: `build.py`
> uses it to bundle everything into one classic script for `dist/` (so the built file still opens from
> `file://`), and the unit tests use it to load core + domain in evaluation order.
> `src/package.json` (`"type": "module"`) lets Node import the core/domain modules directly.

## Structure

```
index.html            tab markup and pop-ups; loads src/app.js as a module
src/
  styles/             CSS in cascade order (01 … 10; 08 components, 08-screens per-screen classes, 09 mobile, 10 print)
  core/               no business rules: config, DOM, formatting, dates, money (cents)
  domain/             rules and data, NO access to DOM/toast/render
    store.js          state S + localStorage (load/save/migrate)
    accounts.js       accounts and balances
    transactions.js   transaction queries
    investments.js    real series and projection
    categories.js     category catalog
    category-groups.js expense groups (Moradia = condomínio, luz, água, gás...): group of a category, suggestion by name
    card-cycle.js     card cycle (closing, due date, which invoice a purchase belongs to)
    card-invoices.js  purchases of each invoice, undetailed amount, open invoices
    month-summary.js  month totals AND the records behind each one (cards and details share it)
    spending.js       12-month spending window, totals by group, the records of a group/category in a month
    spending-stats.js trend line (least squares) and per-group profile (fixed / variable / occasional)
    budgets.js        monthly budget per group: spent, remaining, ok / near (80%) / over, pace projection, alerts
    monthly-bills.js  recurring bills (once a month, stable value) and their status this month: paid / scheduled / missing
    transaction-filter.js transaction list filter (type, group, search) and its signed total
    import-reader.js  file text -> drafts (picks CSV / OFX by content, size and format limits, duplicates marked)
    import-csv.js     CSV cells, delimiter, column detection and mapping (date, description, value or in/out columns)
    import-ofx.js     OFX (SGML and XML): transactions only, bank or card, calendar day as written
    import-pdf.js     text of a digital PDF -> entries (date + amount lines), rebuilds lines from pdf.js pieces
    import-classify.js balance lines, card bill payment, transfers, refunds, installments ("PARC 03/10"), fees, salary
    import-draft.js   the draft model (not a transaction yet), sign conventions, keys, review totals
    import-duplicates.js confirmed (same key / bank id) and possible (same value and day) duplicates
    import-history.js category suggestion from what the user already entered
    import-commit.js  the only place drafts become transactions (after confirmation); idempotent per row key
    quick-entry.js    "gastei 85,90 no mercado hoje" -> fields (fixed rules, no AI)
    card-status.js    purchases, totals and status of one invoice
    invoice-payment.js payment plan (full / checked / partial), pay, classify the undetailed part
    transaction-builder.js validate and save a transaction (new, series, edit + future ones)
    *-commands.js     categories, accounts/balances, settings/backup import: validate, change, or return {error}
    demo-data.js      test data (marked demo:true)
  ui/                 everything that touches the DOM
    components/       reusable pieces: money-input, date-input, sheet, confirm, field-error,
                      stack-table, breakdown (rows and list views), command (runCommand),
                      detail-registry (what each card opens)
    charts/           SVG chart drawing
    views/            one screen (or part of a screen) per file + its events (bindXxx)
    render.js         orchestrates rendering
    ui-state.js       what the screen shows now (month, filters, form being edited): one shared object
  app.js              bootstrap: imports and wires everything, renders
tests/                run-unit.js + unit/*.test.js (Node), smoke.js (end-to-end, DOM only), mobile-check.js, shot.js
scripts/              build.py, serve.sh, serve-phone.sh, smoke.sh, mobile-check.sh, shot.sh
tools/                module-graph.cjs (import graph, bundle for dist/)
vendor/pdfjs/         pdf.js build used only to read PDF text (see its README.txt)
dist/                 generated single file
```

### Layers and dependency rule

`core` ← `domain` ← `ui` ← `app.js`

- `core` and `domain` do **not** use `document`, `toast`, `render` or dialogs.
- `ui/` **never changes the state** (`S`) nor calls `save()`: it calls a domain command through `runCommand()`
  (which wraps `transact()`: rollback on failure, `{error}` shown to the user, then `render()`).
- `ui/views/*` read from `domain` and write to the DOM; each view exposes `renderXxx()` and `bindXxx()`.
- Imports only point down the layers (core imports only core, domain never imports ui), every module is
  reachable from `app.js` and every imported name exists (`tests/unit/modules.test.js`).
- These rules are **tests** (`tests/unit/architecture.test.js`, `modules.test.js`), so a regression fails the build.
- `app.js` only calls the `registerXxx()` / `bindXxx()` functions and `render()`.

### Naming

Code, file names, comments and docs are in English. Two things intentionally stay in Portuguese:

- **UI text** (labels, messages): the app is used in pt-BR.
- **Persisted data keys and values** (`type: 'receita' | 'despesa' | 'aporte' | 'fatura'`, `fonte`, `serie`, `fm`, `items`, category names): renaming them would break saved data and old backups. To change them, add a versioned migration in `domain/store.js` first.

## UX building blocks

| Need | Component | Notes |
|---|---|---|
| Money fields | `ui/components/money-input.js` | Opt in with `data-money`. Only digits are accepted and the last two are cents (`123456` → `R$ 1.234,56`); numeric keypad on phones; paste is parsed. The stored value is always a number (`parseMoney`). |
| Money math | `core/money.js` | `sumMoney`, `roundMoney`: totals are summed in integer cents. |
| Date fields | `ui/components/date-input.js` | `datePicker(input)`: shows `dd/mm/aaaa`, opens the native calendar on tap, `.value` stays ISO `yyyy-mm-dd` (no timezone shift). |
| Details | `ui/components/sheet.js` | One dialog with a view stack (list → record → edit) and a back button; bottom sheet on phones. |
| Confirmation | `ui/components/confirm.js` | `askConfirm({title, html, ok, danger, check})` → Promise. Replaces every `confirm()`. |
| Validation | `ui/components/field-error.js` | Message next to the field, `aria-invalid`, cleared on change. |
| Safe save | `transact(fn)` in `domain/store.js` | If saving fails, the change is undone and the form keeps what was typed. |

Expense **groups**: each expense category has a `group` (`S.groups` holds the group names and icons). The summary list,
the analysis and the trend tooltip add up by group (`groupMonth`), the group sheet shows the split by category and
drills down into one category. New categories get a group suggested by name (`GROUP_KEYWORDS` in `core/config.js`:
"Wellhub" → Saúde); the Categorias tab lets the user change it or type a new group.

**Budgets** (`S.budgets = {group: value}`): set per group in Categorias, shown in Resumo with a progress bar, and the
save toast warns when an expense takes a group to 80% / 100%. **Monthly bills** (Resumo): expenses that came once a
month with a stable value in at least 2 of the last 3 months; a missing bill opens the form already filled ("Lançar"),
and "Não é conta" hides a false positive (`S.billsIgnored`). The **Lançamentos** tab filters by group. Goal and
projection share one tab (Meta).

**Styling:** presentation lives in `src/styles`. Markup has no fixed inline style: `style="..."` is only written for
values computed at runtime (bar widths, account colors), visibility uses the `hidden` attribute (global
`[hidden]{display:none!important}`) and CSS never selects on `[style*=...]`. `tests/unit/no-inline-styles.test.js`
enforces it.

**Import** (Lançamentos → "Importar extrato ou fatura"): reads **CSV, OFX and digital PDF** (text you can select; approximate, the review warns about it). Flow: choose or drop the file →
(CSV: confirm the columns when they were not recognised) → **review** (preview totals, editable cards, select / remove /
add, duplicates, items to double check) → explicit confirmation with totals → result per item. Nothing is saved before
the confirmation. Rules worth knowing:
- Balances and totals of a statement are dropped; card bill payment, transfers between own accounts and card refunds
  are listed but **unselected** (the bill payment is already covered by the card purchases; record it in "Pagar fatura").
- Pix/TED/transfer lines are flagged ("could be a transfer"); installments are flagged and the remaining ones are
  created only if the user ticks it (as one series, like "Repetir").
- A card file turns purchases into card expenses (`fonte: cartao`); they count in the month of the purchase date
  and belong to the invoice computed by the existing card cycle, so an invoice already paid does not count twice.
- Idempotent: every saved row keeps its key in `tx.imp` (bank id, or date + value + text + order) and the file hash is
  logged in `S.imports`; importing the same or an overlapping file marks the rows as duplicates.
- **PDF** (digital only): `ui/views/pdf-text.js` extracts the text with pdf.js (`vendor/pdfjs`, Apache-2.0, loaded only
  when a PDF is chosen; in `dist/` it is embedded by `build.py` and started from a blob, so it works from `file://`);
  `domain/import-pdf.js` turns lines that start with a date (`05/09/2026` or `05 NOV`) and contain an amount into entries.
  Generic, no per-bank layout: unsigned values are deduced from words and flagged, a second amount on a line (balance)
  is ignored and flagged. If a bank's PDF comes out wrong, prefer its CSV/OFX or send the layout to tune the parser.
- **Not supported yet**: photos (camera/OCR), scanned PDFs (no text to read) and Excel. The screen says so. They need
  an OCR/vision service, which this offline single-file app does not have.
- No users or server exist here, so there is no per-user isolation to test: data stays in this browser.

**Quick entry** (Lançamentos): a sentence fills the normal form with a note of what was understood and what is still
missing (never invents a category, account or date). **Repetir** in a record's detail copies it into a new form,
and typing a description offers the category used before (one tap, never applied alone).

Every summary card has `data-kpi` and opens its records from `monthSummary()`, the same function that computes the card, so the items always add up to the total.

## SOLID: what is applied and what is missing

**Applied**
- **SRP:** each file has one responsibility, stated in its header (checked by a test). Screens only read
  fields and draw; rules live in the domain (`transaction-builder`, `invoice-payment`, `card-status`,
  `spending-stats`, `*-commands`). Settings, backup and investments are separate screens.
- **OCP:** what a card opens is registered (`registerDetail(key, factory)` / `registerLink(kind, fn)`).
  A new card registers itself; the click handling does not change.
- **DIP:** persistence is injected (`configureStorage(adapter)`); tests use an in-memory storage, including a
  failing one. Screens depend on commands, not on the shape of the state.
- **ISP:** each screen exposes only `render` and `bind`; components expose one function each.
- **No duplicated rules:** the trend line, category statistics, month totals and invoice status exist once.

**Still open (by value)**
1. **State as a module variable:** commands read/write the shared `S`. Passing the state explicitly
   (`saveTransaction(state, d)`) would make every function pure; the tests already isolate it per file.
2. **Data keys in English** via a versioned migration (see Naming).

## History

Extracted from `~/Downloads/meta_1300k_app.html` (single file, ~1,300 lines) **without changing behavior**: the final DOM of a full scenario (generate test data, tabs, enter a card purchase, partial invoice payment, cancel it, disable a category, remove test data) is identical to the original file's.

UX overhaul (Nov 2026): calendar date fields, R$ money mask, clickable summary cards with the records behind each total, record detail with edit/delete (with confirmation), mobile-first layout (bottom navigation, "+" button, bottom sheets, tables as cards), unit/e2e/width tests.

SOLID refactor (Nov 2026): screens no longer change the state (commands + runCommand), rules moved to the domain
(builder, payment plan, invoice status, statistics), card details registry (OCP), injectable storage (DIP),
one unit test file per module + architecture rules as tests.

ES modules (Nov 2026): classic scripts → `import/export` with the shared UI state in `ui/ui-state.js`; `dist/` is a
bundle built from the import graph. Expense groups (Moradia, Saúde...) with drill-down into categories.

Import of CSV/OFX with review, quick entry, repeat and history suggestions (Nov 2026).

Budgets per group, monthly bills, group filter, Meta + Projeção in one tab, and every fixed inline style moved to CSS
classes (Nov 2026; screenshots before/after identical at 1280 and 485 px).

## Aporte na importação
Na revisão, cada linha pode ser **Aporte** (escolhe-se o investimento de destino). Linhas de aplicação/RDB/CDB/Tesouro saindo do banco já vêm sugeridas como aporte; o investimento só é preenchido sozinho se o nome bater com uma única conta. Resgates, rendimentos, IR e IOF ficam como “Não importar”. O resumo de posição consolidada da corretora é um saldo (não tem aportes datados): atualize-o em Investimentos.

## Extrato de custódia (corretora)
Um PDF “Extrato de Custódia” é o saldo em uma data, não movimentações. O app o reconhece, mostra data, saldo bruto, IR, IOF e líquido, você escolhe a conta e ele grava um snapshot de saldo (`domain/import-custody.js`). Reimportar substitui o mesmo dia; nenhum aporte ou gasto é criado.

## Carteira e nota de corretagem
Em Investimentos, a **Carteira** agrupa os ativos por tipo (ações, FIIs, ETFs, BDRs), com quantidade, preço médio (custos incluídos) e total investido por ticker. Ela vem das notas de corretagem importadas (PDF ou texto): cada compra vira um negócio em `S.trades` e um aporte na conta do tipo (criada se faltar); cada venda só reduz a posição (preço médio) e aparece no resultado. Módulos: `ticker-class`, `brokerage-note`, `portfolio`, `trade-commit` (domain) e `portfolio-view`, `import-note-view` (ui). Sem cotação: o valor de mercado vem do saldo da conta em “Atualizar saldos”.

## Auditoria dos cálculos e distribuição
`tests/unit/calc-audit.test.js` gera os dados de teste (12 meses) e recalcula cada número **sem usar as funções do app**, só dos lançamentos: totais e percentuais do mês, categorias, patrimônio, rendimento e % no mês, anel da meta, projeção e data da meta, orçamentos, faturas do cartão, carteira e a tendência de gastos. Divergência = número errado na tela. Em Investimentos, o gráfico de anel mostra a parcela de cada conta no patrimônio (`investmentDistribution`, `ui/charts/donut-chart.js`).

## Summary "health" block, reserve and next actions
- `domain/savings.js`: savings rate of a month = (income − expenses) ÷ income, with a level (good ≥ 20%, ok ≥ 10%, low, negative).
- `domain/emergency-fund.js`: accounts flagged `reserve:true` (⋯ menu of each account in Patrimônio, badge "🛟 reserva") ÷ average expenses of the last 3 closed months = months covered (goal 6). Command `setReserveAccount`.
- `domain/todo-list.js`: `nextActions(day)` returns at most 3 items, most urgent first (late invoices grouped, invoices due in 7 days, budgets over the limit, monthly bills not entered, no contribution after day 10). Each item says where to go; `ui/views/summary-todo.js` only writes the text.
- UI: Investments merged into the "Patrimônio" tab (old `inv` tab id still works through `MOVED_TABS`); repeat / split moved into "Mais opções" in the form; card tab shows the current invoice first and the table of all invoices collapsed; VR/VA card appears only when used; projection table keeps 4 columns on phones.
- `domain/allocation.js`: optional target (%) per investment type (`S.targets`, total ≤ 100%); `allocationStatus` gives the gap in points and in money. Shown under the ring in "Por tipo" (`distribution-view.js`).
- The tower chart stacks by investment type (same colors as the ring), and labels are thinned out when bars are narrow.
- Known limitation: a sale reduces the position in the portfolio, but the account balance stays at cost until the balance is updated.

## Transfers between own accounts (Santander → Nubank…)
Money moving between the user's own banks is neither income nor expense. All bank accounts are one "Conta" in the app, so both sides must stay out of the totals.
- `domain/own-names.js`: the user's names as banks print them (`S.ownNames`, set in Ajustes; at least first + last name). `mentionsOwnName` matches first and last name a few words apart, ignoring accents/case ("MARIA S LIMA").
- `domain/import-classify.js`: new draft type `transferencia` ("🔁 Transferência minha"). A bank line with the user's name becomes it, except a salary ("TED CONTA SALARIO <name>" stays income). Card statements never produce it.
- `domain/transfers.js`: transfers are kept in `S.transfers` (`{id,key,date,value,dir,desc,pair}`), never in `S.tx`. `markTransferPairs` finds the other side when another bank is imported: same cents, opposite direction, ≤ 3 days apart. If the other side is a kept transfer, the draft becomes a transfer automatically. If it was saved as income/expense, the review offers "corrigir as duas" (`fixPair`): on confirm, `recordToTransfer` moves that record to `S.transfers`. Re-importing a file keeps nothing twice (key).
- PDF reader (`import-pdf.js`): lines rebuilt from piece widths (Santander cuts words into pieces), measured columns (` | `), and a "Movimentação" block where only the first entry of the day has a date.

## UX audit: the 10 changes (Nov 2026, `docs/ux-audit-2026-11-17.md`)
- **Resumo**: one number "Sobrou no mês" with "Investiu X / Ficou na conta Y" (`domain/month-result.js`, `summary-hero.js`); "Onde gastei" near the top; the spending analysis moved to its own tab **Análise** (Mais → Análise on phones). Removed: the 6-month income × expenses × contributions chart, the savings-rate card (part of the main number) and the repeated "Média mensal" tile.
- **First visit**: welcome steps only while there is no record (`domain/start-steps.js`); the backup warning only when there is data to lose (`domain/backup-reminder.js`).
- **Lançamentos**: search covers every month, accents and case ignored, with month headings (`transaction-filter.js`); "Excluir" left the rows (it is in the record detail); deleting a plain record is immediate with **Desfazer** in the toast (`deleteTransactions` / `restoreTransactions`, `toast(msg,{action})`); a choice or a side effect (future copies, a paid invoice, an aporte) still asks first. The 4 big type buttons on phones were removed (the "+" does it).
- **Form**: a category that does not exist yet asks before it is created and suggests the closest one (`domain/category-match.js`, `ui/views/category-confirm.js`; accents/case differences are fixed silently); "Pago com" / "Entrou em" starts with the method of the last record typed by hand (`domain/entry-defaults.js`). The confirm dialog has an optional second choice (`alt`).
- **Cartão**: ‹ › on the invoice card select the invoice (no month arrows on this tab); purchases are list rows and the total is a plain line (fixes "Data: Total da fatura" on phones); payments shown are those of the selected invoice (`card-paid.js`). One name per invoice everywhere: "Fatura de dez/26" (`ui/invoice-name.js`).
- **Patrimônio**: balances first, then the distribution, then **one chart** (real by type + projection + "se juros caírem" line + goal; the scale fits the data and a far goal becomes a label), and the month-by-month table collapsed. The projection math moved to `domain/goal-projection.js` (chart and table use the same plan). Account actions (reserve, archive) are in the ⋯ menu. On phones (≤ 640 px) the ring has no side labels: the names are a list under it (`donutSvg({bare:true})`).
