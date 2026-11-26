# Test audit (what existed, and how good it is)

Date: 2026-11-26. Scope: the whole repository (browser app, API, Android shell, Telegram service). Numbers come from runs made during the audit; nothing is estimated.

## 1. Inventory of the test suites

| Suite | Where | Framework | Size at the start of the audit | Runs against |
|---|---|---|---|---|
| Browser unit | `tests/unit/*.test.js`, runner `tests/run-unit.js` | own harness (`tests/unit/harness.js`: the core and domain files are loaded into one `vm` context with an in-memory storage) | 50 files, 4,580 assertions | no browser, no network |
| End to end, source | `tests/smoke.js` (65 steps), `smoke-sync.js` (5), `smoke-xss.js` (8) | headless Chrome, page driven by DOM events (`scripts/smoke.sh`) | 78 steps | the real page, a scripted API |
| End to end, `dist/` | `tests/smoke.js` inside the single-file build | headless Chrome over `file://` | 65 steps | the built file |
| End to end, Android build | `tests/smoke-native.js` (23 steps, two runs: normal and locked) | headless Chrome + scripted Capacitor | 23 steps | `mobile/www` with its own CSP |
| Phone widths | `tests/mobile-check.js` | headless Chrome | 6 widths | the page |
| Backend unit | `backend/test/unit` (35 files, 454 `it`) | Vitest 4 + SWC | 830 passed, 1 timing failure under load (section 4) | Nest app in memory (fakes) |
| Backend contract | `backend/test/contracts` (9 files, 98 `it`) | Vitest | same contract run on the in-memory fake and on PostgreSQL | fake and real DB |
| Backend integration | `backend/test/integration` (15 files, 93 `it`) | Vitest | needs PostgreSQL 18 and Keycloak: run by CI (`backend` job), **not run in this audit** | real DB, real Keycloak |
| Services | `services/telegram-apk/test` (5 files) | `node --test` | passes in `npm run check` | a fake Telegram |
| On a device | `scripts/device-test.mjs`, `device-test-lock.mjs` | DevTools protocol + adb | **not run in this audit** (no `adb` on the PATH of this session) | phone or emulator |

No test is skipped, disabled or marked `only` (searched: `.skip`, `.only`, `.todo`, `xit`, `xdescribe`).

## 2. How the unit suite is built, and what its numbers mean

- The harness strips the `import`/`export` of core and domain files and runs them as one script, so any top-level function can be called from a test with `run('fn(...)')`. This keeps tests fast (the whole browser unit suite takes about 5 s) but means the ES-module wiring is checked only by the end-to-end suites.
- Three files inflate the assertion count and are structure checks, not behaviour checks: `modules` (2,893), `architecture` (450, the layer rule) and `no-inline-styles` (182). Without them about 1,200 assertions are left. **Do not read the total as the number of behaviours checked.**
- Coverage is not configured anywhere. V8 function coverage was gathered for this audit with `NODE_V8_COVERAGE` (section 5); line and branch coverage are not available for the browser code (the harness rewrites the files, so offsets do not map back), and the backend has no coverage package installed.

## 3. Evaluation per group (9 questions of the brief)

| Group | Files | Class | Why |
|---|---|---|---|
| Money and month rules: `month-result`, `month-summary`, `calc-audit`, `golden`, `projection`, `spending`, `budgets-bills-filter`, `report` | 8 | **ADEQUADO** | `calc-audit` and `golden` recompute results independently (golden numbers are in `docs/architecture/baseline/golden-calculations.json`); `report` checks that the report equals the screens. |
| Card: `dates-card-cycle`, `card-invoices` | 2 | **INCOMPLETO** at the start | Only the purchase-to-invoice mapping was checked; `cycleStart`, `nearestDueMonth`, `invoiceOfPurchase` never ran. Completed by `card-cycle-rules` and `invoice-of-purchase`. |
| Import: `import-readers`, `import-values`, `import-pdf`, `import-custody`, `import-flow`, `transfers` | 6 | **ADEQUADO** | Real layouts with made-up values, signs, duplicates, own transfers, idempotence. |
| Import, classification and duplicates | 0 | **sem teste direto** at the start | `classifyEntry`, `parseInstallment`, `markDuplicates` were reached only through `import-flow`. Added `import-classify`, `import-duplicates`. |
| Portfolio: `portfolio` | 1 | **INCOMPLETO** | Positions covered, `realizedTotal` (the realised result) never ran. Added `portfolio-realized` with a hand calculation. |
| Persistence: `store`, `state-recovery`, `state-scope` | 3 | **INCOMPLETO** | Rollback and recovery covered; `adoptRemoteState`, `onSave`, `migrate` never ran. Added `store-hooks`. |
| Sync client: `sync-records`, `sync-apply`, `sync-runner` | 3 | **ADEQUADO** | A fake server with the real contract (idempotent mutations, tombstones, cursor), two devices, retries, rejection. Missing `reviewItems`, `clearReview`, `pendingCount`: added. `api-client` had no test: added. |
| App lock (6 files) | 6 | **ADEQUADO** | Policy, events, gateway, screen, settings; mutation-checked when written. One test left a timer that crashed the runner when the machine was slow: fixed (section 4). |
| Structure: `modules`, `architecture`, `no-inline-styles`, `escape`, `contrast` | 5 | **ADEQUADO** (as guards) | They protect layering, escaping and CSS rules; they say nothing about money. |
| Browser end to end (65 + 5 + 8 steps) | 3 | **ADEQUADO** | Drive the page like a person; the only protection of the 56 screen modules. Cannot be measured for coverage. |
| Android build | `smoke-native` | **INCOMPLETO** until this week | Started the app under its CSP but opened no file. The PDF reader was broken on the phone and no test saw it. Fixed by `smoke-native-import` and `mobile-build`. |
| Backend unit (HTTP with fakes) | 35 | **ADEQUADO** | Real Nest app, real guards, fake repositories; contract tests keep the fakes honest. Gap: a few pure units had no direct test (`parseInput`, account schemas, `EntitlementsService`): added. |
| Backend integration | 15 | **ADEQUADO** (not re-run here) | Real PostgreSQL and Keycloak, IDOR, migrations, role grants. |

Nothing was classified FALHANDO except the timing case below, and nothing is DESATUALIZADO or REDUNDANTE. No test was removed.

## 4. Defects found in the tests themselves

1. **`tests/unit/app-lock-settings.test.js`** (written in the previous phase) left the toast's hide timer pending (3.2 s) and then deleted its fake `document`. When the suite ran longer than 3.2 s the timer fired and the whole runner crashed with `ReferenceError: document is not defined`. It stayed hidden because the suite used to finish in 4 s. Fixed: the test clears the toast timers before removing the fake page.
2. **`backend/test/unit/http/security.http.test.ts` "the app files and the health checks are never counted"** sends 2,600 requests with the default 5 s budget. On this machine (load average 25 on 14 cores) it timed out in two full-suite runs and passes alone in about 3 s. This is an environment-sensitive test, not a defect of the application. Fixed: an explicit 60 s budget for that one test; the assertions are unchanged.
3. **`smoke-native` did not open a file** (see section 3), the reason the Android PDF failure was not caught.

## 5. Function coverage of the browser unit suite (V8, `src/core`, `src/domain`, `src/sync`, top-level `src/ui`)

| Moment | Named functions | Never executed |
|---|---|---|
| `HEAD` (commit `ae21ae8`) | 422 | 23 |
| Start of the audit | 429 | 21 |
| After the audit | 429 | 4 |

The 4 left are `css` (`src/core/dom.js`), `notify` (app lock) and two toast closures: DOM code that the end-to-end suites exercise. Function coverage says a function ran, not that its decisions were checked; the mutation results (final report) are the better measure.
