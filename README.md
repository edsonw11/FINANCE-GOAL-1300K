# Finance · R$ 1.3M Goal

Personal app (plain HTML + CSS + JavaScript, no build required) to track:

1. **Goal:** invested net worth up to R$ 1.3 million, with projection and scenarios.
2. **Monthly cash flow:** income, expenses, contributions, credit card (invoices by cycle), meal vouchers and categories.
3. **Spending analysis:** month-by-month curve, trend and per-category detail.

Data lives only in the browser (`localStorage`, key `metaapp.v2`). Export a backup in Settings → Data from time to time.

## How to use

| I want to | Do this |
|---|---|
| Open the app | Open `index.html` in the browser (works over `file://`) |
| Build a single file to keep or share | `python3 scripts/build.py` → `dist/finance_goal_1300k.html` |
| Run a quick test | `scripts/smoke.sh` (headless Chrome; use `CHROME=chromium` if needed) |

> Scripts are loaded with classic `<script src>` tags (not ES modules) because modules do not work over `file://`.
> The load order is defined in `index.html` and reused by `build.py`.

## Structure

```
index.html            tab markup and pop-ups + script load order
src/
  styles/             CSS in cascade order (01 … 08)
  core/               no business rules: config, DOM, formatting, dates, input masks
  domain/             rules and data, NO access to DOM/toast/render
    store.js          state S + localStorage (load/save/migrate)
    accounts.js       accounts and balances
    transactions.js   transaction queries
    investments.js    real series and projection
    categories.js     category catalog
    card-cycle.js     card cycle (closing, due date, which invoice a purchase belongs to)
    card-invoices.js  purchases of each invoice, undetailed amount, open invoices
  ui/                 everything that touches the DOM
    charts/           SVG chart drawing
    views/            one screen (or part of a screen) per file + its events (bindXxx)
    render.js         orchestrates rendering
  app.js              bootstrap: wires everything and renders
tests/smoke.js        smoke scenario (DOM only)
scripts/              build.py and smoke.sh
dist/                 generated single file
```

### Layers and dependency rule

`core` ← `domain` ← `ui` ← `app.js`

- `core` and `domain` do **not** use `document`, `toast`, `render` or `confirm` (checked by searching the code).
- `ui/views/*` read from `domain` and write to the DOM; each view exposes `renderXxx()` and `bindXxx()`.
- `app.js` only calls the `bindXxx()` functions and `render()`.

### Naming

Code, file names, comments and docs are in English. Two things intentionally stay in Portuguese:

- **UI text** (labels, messages): the app is used in pt-BR.
- **Persisted data keys and values** (`type: 'receita' | 'despesa' | 'aporte' | 'fatura'`, `fonte`, `serie`, `fm`, `items`, category names): renaming them would break saved data and old backups. To change them, add a versioned migration in `domain/store.js` first.

## SOLID: what is applied and what is missing

**Applied**
- **SRP:** each file has one responsibility, stated in its header (e.g. `card-cycle.js` only decides closing/due dates; `transaction-save.js` only saves).
- **Layers / DIP (partial):** business rules do not depend on the DOM. The UI depends on the domain, never the other way around.
- **ISP:** each screen exposes only `render` and `bind`.

**Not done yet (next steps, by value)**
1. **Global state `S`:** the domain reads and writes `S` directly. Next: an injectable `Store` (`store.get()`, `store.update(fn)`) so the domain can be tested without a browser (DIP).
2. **Large handlers:** `transaction-save.js` and `pay-invoice.js` mix form reading, validation and persistence. Split into a pure `buildTransaction()` + persist + refresh.
3. **OCP:** `renderFlow` / `renderInsights` use fixed lists of indicators. Replace with a card registry so new ones can be added without editing existing code.
4. **Unit tests** for `domain/` (card cycle, invoice allocation, projection) running in Node.
5. **ES modules:** once the app is served by a local server (`python3 -m http.server`), move from classic scripts to `import/export`.
6. **Data keys in English** via a versioned migration (see Naming).

## History

Extracted from `~/Downloads/meta_1300k_app.html` (single file, ~1,300 lines) **without changing behavior**: the final DOM of a full scenario (generate test data, tabs, enter a card purchase, partial invoice payment, cancel it, disable a category, remove test data) is identical to the original file's.
