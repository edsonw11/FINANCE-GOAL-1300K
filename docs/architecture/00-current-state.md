# 00 · Current state, baseline and target proposal (Phase 0)

Date: 2026-11-24 · Branch `feat/ux-audit-improvements` (HEAD `e76c748`) · **Diagnosis only: no application code was changed.**
Added by this phase (nothing else): this document, `baseline/*.png`, `baseline/golden-calculations.json`,
`tools/golden-calculations.cjs`, `tests/unit/golden.test.js`.

How to read it: every statement is marked by how it was checked.
**[run]** executed and observed · **[code]** read in the source, not executed · **[not verified]** could not be checked here.

---

## 0. The short version

1. **The premise of the brief is outdated.** The project is *not* "one HTML file": it is 138 ES modules in three layers
   (`core` 7, `domain` 55, `ui` 76), 13 CSS files, a documented architecture, **4,011 unit assertions**, a 65-step
   end-to-end test and a phone-width test. The domain layer has no DOM access and the UI cannot mutate state except through
   domain commands. Most of "Phase 1 foundation" already exists. [run]
2. **What is really missing** for a web + Android + iOS product with a backend: persistence beyond one browser, identity,
   a server, types/lint/CI, and a native shell. None of these exist today. [code]
3. **The one structural blocker** for moving rules to a server: the domain reads a **global mutable singleton `S`**.
   A multi-user server needs the state passed as a parameter. [code]
4. **Biggest decision for you:** is this app for **you only** or for **other users**? SSO, multi-tenancy, privacy policy and
   store requirements are mostly about the second case (see §10, D1).
5. **Recommendation:** an incremental plan that keeps the working frontend (no React rewrite), reuses the tested domain rules
   in the backend, and puts the Android shell *before* the backend (§9).

---

## 1. Current architecture [code]

```
index.html (283 lines: markup of 7 tabs + dialogs)  ->  src/app.js (bootstrap, no rules, no HTML)
  src/core/     7 files,    165 lines   config, DOM helpers, formatting, dates, money (integer cents)
  src/domain/  55 files,  2,420 lines   rules + state; NO DOM / toast / render (enforced by tests)
  src/ui/      76 files,  3,284 lines   views (54), components (11), charts (3), shared UI state
  src/styles/  13 files,    848 lines   CSS in cascade order; no inline styles except runtime values
  vendor/pdfjs  pdf.js 5.6.205 (Apache-2.0), only to read the text of digital PDFs
  tests/       37 files,  2,054 lines   32 unit files + smoke (e2e) + mobile-check + screenshot helper
  tools/ scripts/                       module graph, build (single-file dist), phone server, smoke
dist/finance_goal_1300k.html            one 2.2 MB file (everything inlined), opens from file://
```

Dependency direction: `ui -> domain -> core`. The UI never mutates `S`; it calls `runCommand(fn)` which wraps the domain command
in `transact()` (snapshot, run, save, roll back on error). Tests enforce this (`architecture.test.js`, 416 assertions).

Runtime facts: **no network access at all** (no `fetch`, no XHR, no CDN, no external URL in `index.html`/`src`); no service worker
and no web manifest; no npm dependencies (`src/package.json` only sets `"type":"module"`). [run: grep over the repository]

## 2. Feature inventory [code + run]

Seven tabs (`#t-*`), reached from the top menu on desktop and a bottom bar on phones ("Mais" holds the rest).

| Tab | What it does |
|---|---|
| **Resumo** | month result ("Sobrou"), "O que fazer agora" (max 3 actions), income / expenses / invested, spending by group, month navigation, cash-flow detail, budgets per group, monthly bills ("Contas do mês"), emergency reserve, first steps for a new user |
| **Lançamentos** | new entry (expense / income / aporte / invoice payment) with category, payment source, split across categories, repeat monthly, quick entry by sentence ("gastei 85,90 no mercado"), search across all months, list with filters, undo after delete, **import** (CSV, OFX, digital PDF of bank statements: Santander, Bradesco, Nubank layouts; card invoices) with review screen, duplicate detection, own-transfer pairing |
| **Cartão** | invoices by cycle (best purchase day, closing, due date), paid / open / late status, pay an invoice (full or partial), undetailed part of a paid invoice |
| **Patrimônio** | accounts and balances by date (net and gross), update balances, history, goal progress ring, **projection** to R$ 1.3 M with a lower-rate scenario, real yield, distribution by account/type, allocation targets, portfolio by ticker (B3 brokerage notes), custody statements |
| **Análise** | 12-month spending curve, trend line, fixed / variable / occasional profile per group, category detail |
| **Categorias** | catalog, groups, icons, rename, enable/disable |
| **Ajustes** | goal, rate, planned contribution, card settings, own names (transfers between own accounts), backup export/import, demo data, erase everything |
| Cross-cutting | **printed report (PDF)** and e-mail summary, pt-BR formatting (R$, dd/mm/aaaa), 44 px touch targets, daily auto-backup copy, recovery notice for unreadable data |

Baseline screenshots (demo data, headless Chrome, `scripts/shot.sh`): `baseline/desktop-{resumo,lanc,cartao,meta,analise,cad,cfg}.png`
at 1280×900 and `baseline/mobile-*.png` at 390×844. [run]

## 3. Critical flows [run: smoke test, 65 steps, both source and `dist/`]

1. First visit → empty app → example data on demand → add entry (form and sentence) → edit → delete → undo.
2. Import a statement: choose file → preview (nothing saved) → review/edit/split → confirm with totals → result → same file again does not duplicate.
3. Transfers between own accounts: set name → Pix to myself kept apart → other bank recognises the pair → fix a record saved earlier.
4. Card: purchase on card → invoice by cycle → pay (full/partial) → status.
5. Patrimônio: update balances → projection → goal ETA.
6. Backup: export JSON → import; unreadable stored data is kept aside and never overwritten.
7. Print/PDF and e-mail summary of the month on screen.

## 4. Technologies and dependencies [run]

Plain JavaScript (ES2022 modules), HTML, CSS. **No TypeScript, no ESLint, no Prettier, no bundler, no framework.**
Build = `scripts/build.py` + `tools/module-graph.cjs` (concatenates modules into one scope; a unit test forbids repeated top-level names).
Only third-party code: vendored **pdf.js 5.6.205** (the "3.48.0" string found inside is the bundled core-js, not pdf.js).
Machine used here: Node 20.20.2, npm 10.8.2, **Docker 29.10 + Compose v5.8**, OpenJDK 21, Python 3.12, Chrome 158, git 2.43.
**Missing for later phases:** Android SDK / `adb` / Android Studio (Phase 8); macOS + Xcode (iOS, Phase 9). [run]

## 5. Persistence today [code]

One JSON document `S` in `localStorage` key `metaapp.v2` (`v:2`), written after every change by `transact()`; a rolling daily copy
under `metaapp.v2` + backup suffix **in the same storage** (same failure domain). Backup = download of the whole `S` as JSON.
Import accepts any JSON with `v===2`. There is no user concept, no server, no sync: **each browser has its own data** (the phone and the PC
are independent, which you already hit).

```
S = { v, goal, rate, planned, nid,                       // settings and id counter
  accounts:[{id,name,archived?,reserve?}],
  snaps:[{date,acc,value,est?,gross?}],                  // balance of an account on a date
  tx:[{id,type:'receita'|'despesa'|'aporte'|'fatura', date,value,cat,fonte:'caixa'|'cartao'|'beneficio',
       desc,acc?,splits?:[{cat,value}],fm?,items?:[id],serie?,imp?,demo?}],
  cats:{despesa:[{name,icon,group,off}],receita:[...]}, groups:[{name,icon}], budgets:{group:value},
  card:{best,due,biz,over:{fm:date},v3}, billsIgnored:[], imports:[{hash,name,at,count,transfers}],
  ownNames:[], transfers:[{id,key,date,value,dir,desc,pair}], trades:[{id,key,date,ticker,cls,side,qty,price,fees}],
  targets:{type:pct} }
```

Money is a JS number with at most 2 decimals; **every total is summed in integer cents** (`core/money.js`).
Mapping to a relational model is direct (every entity above is a table; `tx.items`, `tx.splits`, `transfers.pair` are the only relations).

## 6. Financial rules identified (where, and the constants) [code]

| Rule | Where | Detail |
|---|---|---|
| Month result | `month-result.js`, `savings.js` | `left = income − expenses` (aportes are **not** expenses); `rate = left/income`; levels: `<0` negative, `≥10%` ok, `≥20%` good, else low; "invested / kept in account" split |
| Card cycle | `card-cycle.js` | best purchase day (default 29), due day (default 7), closing = best−1, weekend closing moves to next business day (`biz`), per-invoice override `card.over`; a purchase belongs to the first invoice whose closing ≥ its date |
| Card cost accounting | `month-summary.js`, `card-invoices.js` | card purchases are expenses **on the purchase date**; a paid invoice's un-itemised remainder counts as expense "Cartão (sem detalhe)"; vouchers (`beneficio`) kept apart from cash |
| Net worth / yield | `investments.js`, `accounts.js` | balance = last snapshot ≤ date + later contributions; monthly yield = Δtotal − contributions − starting balance of new accounts, only when an existing account's balance was updated |
| Projection | `investments.js`, `goal-projection.js` | monthly rate `(1+annual)^(1/12)−1`; `b = b·(1+r) + planned`; up to 60 months; lower-rate scenario = rate − 2 p.p.; average contribution = last 3 closed months |
| Budgets | `budgets.js` | per group; share = spent/budget; **near ≥ 80 %**, **over > 100 %**; pace projection for the month in progress |
| Emergency reserve | `emergency-fund.js` | average of the last 3 closed months with expenses; target 6 months, minimum 3 |
| Monthly bills | `monthly-bills.js` | ≥ 2 occurrences in the last 3 months, value variation ≤ 20 % |
| Own transfers | `transfers.js`, `own-names.js` | not transactions; paired by same value, opposite direction, **≤ 3 days**; a name counts if it matches the holder's name |
| Allocation targets | `allocation.js` | sum ≤ 100 %, tolerance ±2 p.p. |
| Import | `import-*.js` | limits 2 MB text / 10 MB PDF / 40 pages / 3,000 entries; value ≤ R$ 10 M; balance lines dropped; card-bill payments ignored; "PARC 02/03" installments; duplicates: *confirmed* (same key) and *possible* (same value and day); idempotent per row key and file hash |
| Trend | `spending-stats.js` | least-squares line over closed months |

**Characterization:** `baseline/golden-calculations.json` records the results of these rules on one invented state with a frozen clock
(month totals, card cycle dates, budgets, net worth series, projection, reserve, to-do codes, quick entry, CSV and PDF import, the whole report).
`tests/unit/golden.test.js` recomputes it on every run. I proved it detects a change by temporarily raising the "good" savings threshold:
2 assertions failed, then passed again after reverting. [run] It complements `calc-audit.test.js`, which independently recomputes the screens' figures.

## 7. Risks (technical and security)

| # | Risk | Evidence | Severity today → in a multi-user product |
|---|---|---|---|
| R1 | **Data lives in one browser.** Clearing site data or losing the device loses everything; no PC↔phone sync; the "daily backup copy" sits in the same storage | [code] | high for you (already felt) → blocker |
| R2 | **Global singleton `S`** read by ~all domain functions; the deferred "state as a parameter" refactor (≈72 functions / 164 call sites, noted earlier) is required before the rules can serve several users | [code] | none today → **blocker for a shared backend** |
| R3 | **Stored-XSS sink confirmed:** `txRow()` ([breakdown.js:33-36](../../src/ui/components/breakdown.js#L33-L36)) puts the category name into HTML **without `esc()`**. Probe: a category `<img src=x onerror=alert(1)>` appears raw in the row; a description does not (escaped) | [run: probe] | low (needs a self-typed or crafted-backup category) → **high** |
| R4 | Wide HTML-building surface: 93 `innerHTML`/`insertAdjacentHTML` sites in 39 files, escaping is a convention (125 `esc()` calls), **no CSP**. A heuristic scan flagged 14 lines; I read them: all but R3 are pre-escaped fragments or numbers. **Not a full audit** | [code] | medium → high |
| R5 | **Backup import is trusted:** accepted if `v===2`; no schema validation. A crafted file can inject (feeds R3) or break the app | [code] | low → high |
| R6 | Backup is plain JSON with all financial data; no encryption at rest or in the export | [code] | medium |
| R7 | `serve-phone.sh` serves `dist/` over plain HTTP on `0.0.0.0` with no auth. Data does not travel (it stays in each browser), but it is a dev tool only | [code] | low |
| R8 | No types, lint, format or **CI** (no `.github/`); tests run only locally | [run] | medium |
| R9 | Untrusted files (CSV/OFX/PDF) parsed in the browser; size/page limits exist; pdf.js is current. PDF ingestion could not run in Node, so real-file validation was manual in Chrome | [run] | low |
| R10 | No manifest / service worker: "Add to Home screen" is a shortcut, not an installable offline PWA | [run: grep] | medium (relevant to the Android decision) |
| R11 | `localStorage` quota (~5 MB) with a full copy kept for the daily backup | [code] | low for years of personal data |
| R12 | Money as JS number (cents-summed) is fine in the browser; a server should use integer cents / `NUMERIC(14,2)` | [code] | design note |

Not verified: visual behaviour on a real phone/WebView, keyboard/safe-area behaviour in a native shell, any Android or iOS build,
accessibility audit (a contrast test exists), performance with several years of data. [not verified]

## 8. What must be preserved and migrated

Preserve: every feature in §2, the pt-BR formats, the identity and layout (baseline images), the 44 px touch targets, the printed report, the import
behaviours (they took many real-file iterations), the guard-rails (idempotent import, undo, nothing saved before confirmation, unreadable data kept aside).
Migrate: the `S` document into relational tables; **your real data** from the browser through the existing JSON export (never delete the source before totals match: count, sums per month, balances).

---

## 9. Proposed target architecture (and what I would simplify)

```
 Browser / Android (Capacitor) ──HTTPS──> Backend API (modular monolith, /api/v1, OpenAPI) ──> PostgreSQL
        same web app                          ▲ authN/authZ                                    ▲ migrations
                                              └── OIDC provider (Keycloak local, Cognito later, or just Google for one user)
```

### What I would change from the brief, and why

| Brief | Proposal | Reason |
|---|---|---|
| Migrate to React + TypeScript (Phase 5) | **Keep the vanilla ES-module UI.** Add TypeScript checking through JSDoc (`tsc --checkJs`) and typed API clients | 76 UI modules + 166 style tests + a validated responsive look; a rewrite is the highest-risk, lowest-value item and the brief itself says no gratuitous redesign. The UI already talks only to domain commands: that seam is where the API client plugs in |
| Re-implement rules in NestJS layers | **Reuse the tested domain as a shared package** run by the backend (after the state-as-parameter refactor), keep the golden file as the acceptance test | Zero risk of rule drift; the rules are pure JS with 4,011 assertions |
| Keycloak SSO from the start | Decide by D1. For one user: a single OIDC login (e.g. Google) is enough. Keycloak/Cognito make sense only for several users | "Do not build more than the problem needs" |
| Android after the backend (Phase 8) | **Capacitor shell earlier**, as a local-first app, then add the backend | It delivers "installed on my phone" with almost no risk and is independent of the server |
| Many containers | Compose with 3 services: `api`, `db`, `idp` (only if D1 needs it); the web app is served by the API or a static container | no premature microservices |

Kept as written: modular monolith, PostgreSQL, migrations, OpenAPI, server-side validation, ownership checks on every query (IDOR tests), PKCE,
no secrets in bundles, one-command Docker environment, ADRs, per-phase gates, AWS reference doc only (no deploy).

### Backend options for the data model (decision D5)
- **Normalised tables** (recommended): `users, accounts, snapshots, transactions, splits, invoice_items, categories, groups, budgets, card_settings, transfers, trades, imports…` with `user_id` on every row.
  The server loads one user's records and runs the shared rules in memory (a personal finance dataset is small).
- **Document per user**: store `S` as JSONB with a version. Fastest, no integrity at row level, harder to query/audit.

## 10. Decisions (answered 2026-11-24)

**D1 = public, paid product.** Every other recommendation was accepted ("pode corrigir tudo").

| # | Decision | Result |
|---|---|---|
| **D1** | Who will use it | **Public, paid product (subscription)**: multi-tenant, real identity provider, store requirements, LGPD |
| D2 | Frontend | **Keep the vanilla ES-module UI**, add `tsc --checkJs` + typed API client |
| D3 | Backend | **TypeScript modular monolith that imports the shared domain** (framework chosen in ADR-0001, Phase 1) |
| D4 | Rules in the backend | **Reuse the domain** after the state-as-parameter refactor |
| D5 | Data model | **Normalised PostgreSQL tables**, `user_id` on every row |
| D6 | Identity | **Keycloak locally (OIDC + PKCE); Cognito as the AWS option**, decided at deploy time |
| D7 | Order | **Android (Capacitor) shell right after Phase 1** |
| D8 | Offline | **Online-first** with a read cache |
| D9 | Tooling | **ESLint + Prettier + `tsc --checkJs` + GitHub Actions** in Phase 1 |
| D10 | Real data | the owner's browser JSON is imported into his account in Phase 4 |
| D11 | Stored XSS (R3) | **Fixed** in `29b55cf` (category escaped in `txRow`, icons reduced to a short symbol on save and on read, `tests/unit/escape.test.js`) |

### Requirements added because the product is public and paid

Not in the original brief, required for this case:

| Area | What it means here | Phase |
|---|---|---|
| **Billing** | subscription plans, trial, payment status gating features, webhooks, idempotent payment events. **Android rule:** a digital subscription bought inside the app normally has to use Google Play Billing (Apple: In-App Purchase); a web checkout (Stripe / Mercado Pago / Pagar.me) serves the browser. Verify the current store rules at that phase | new phase after 4 |
| **LGPD** | legal basis and consent, privacy policy, terms of use, data-subject rights (access, export, correction, **deletion**), DPO contact, processing records, breach procedure, data retention | 7 and 10 |
| **Account deletion** | in-app and on the web (also a Play Store requirement), with deletion of financial data | 3–4 |
| **Tenant isolation** | every query scoped by the authenticated user; IDOR/BOLA tests on every endpoint; optionally PostgreSQL row-level security as a second barrier | 3–4 |
| **Encryption** | TLS everywhere outside local; encrypted volumes / RDS encryption; backups encrypted; no financial data in logs | 7 |
| **Audit log** | who changed what and when (financial records, account, billing) | 4 |
| **Abuse** | rate limits per user and per IP, upload limits (statements), account-creation abuse | 7 |
| **Support and operation** | error tracking, uptime monitoring, support channel, status of incidents | 10 |
| **Legal entity** | a company (CNPJ) to charge, to publish in the stores and to be the data controller | before billing / store |

## 11. Incremental plan (gates as in the brief)

| Phase | Content | Gate |
|---|---|---|
| 0 | this document, baseline images, golden file | ✅ reviewed 2026-11-24 (D1 = public paid product) |
| 1 | tooling: lint, format, `checkJs`, CI, README of the monorepo layout; state-as-parameter refactor of the domain (behaviour-neutral, golden test must stay green) | ✅ 1a tooling + CI (0dc4a56); ✅ 1b scoped state `withState` (ADR-0006) |
| 2 | Docker Compose with Postgres, backend skeleton, config validation, health, migrations, first vertical slice | ✅ backend + DB up, migrations and tests pass (ADR-0007) |
| 3 | Auth (OIDC + PKCE), ownership on every endpoint, IDOR/BOLA tests | ✅ login works against a real Keycloak; user A cannot read user B (ADR-0009) |
| 4 | ✅ 4a sync engine + plans and locked PRO features (ADR-0010); 4b-1 ✅ records + import/export of your JSON, shared rules on the server, golden file reproduced through import → PostgreSQL → rules (ADR-0011); 4b-2 typed columns and command endpoints pending | totals and golden match the browser app |
| 5 | ✅ Web app talks to the API: sync layer (outbox, pull, first merge, review list), "Conta e sincronização" card and header badge, app served by the API (ADR-0012); e2e + visual baseline unchanged | e2e + visual baseline unchanged; two devices converge on PostgreSQL |
| 6 | ✅ `scripts/dev.sh up` (preflight, build, start, wait healthy, demo data through the real login), `check` (end-to-end proof), `reset`, `seed`, `down`; CI job `stack` runs `up` + `check` on an empty runner | ✅ clean-machine start proven locally (reset → up → check) |
| 7 | ✅ Headers, page CSP and rate limits (7a); data-only database role (7b); threat model, XSS browser scenario (found and closed a stored XSS), log redaction test, secret scan, backup/restore test, `scripts/test-security.sh` (7c); docs in `docs/security/`, ADR-0013 | ✅ no critical/high finding open |
| 8 | Capacitor Android (can be moved to right after 1) | installs and runs on a device |
| 8b | **Billing** (web checkout + Play Billing), plans and feature gating | payment events idempotent, tested in sandbox |
| 9–10 | iOS preparation, AWS reference, LGPD documents, docs | someone else can follow them |

## 12. Environment check for the next phases

Docker and Compose are present, so the local stack is possible. **Android SDK is not installed** (JDK 21 is): Phase 8 needs Android Studio or command-line
tools first. iOS needs macOS. Ports in use by this project today: 8080 (phone server), 8765/8766 (screenshot helpers, temporary).

## 13. Limits of this diagnosis

- Screenshots are headless Chrome at the stated widths; I did not verify on a physical device or in a WebView.
- The XSS review is a targeted scan plus a probe, not a complete audit (R4).
- No performance or accessibility measurement beyond the existing contrast test and the 6-width mobile check.
- PDF ingestion was validated by hand with real files (not part of the repository) and with an invented fixture in the automated suite.
