# AGENTS.md: Everfox, the complete handoff for the next AI agent

Read this file first, all of it. It says what the project is, how it is built, what was done and why, the rules you must follow, how to verify your work, how to extend each part, and what is still open. Facts marked **[code]** were read in the source when this file was written (2026-11-25). **The code wins over this file**: if they disagree, trust the code and fix this file.

Contents: 1 Product · 2 Repository map · 3 Architecture · 4 Backend · 5 Data model · 6 Security · 7 Android · 8 Tests and CI · 9 Commands · 10 Owner's rules · 11 Documentation as code (the diagrams) · 12 How to extend · 13 History · 14 Open work · 15 Traps · 16 Glossary

---

## 1. Product

Everfox is a personal finance app. The owner's goal is an invested net worth of R$ 1.3 million, tracked with a projection and scenarios. It also does monthly cash flow (income, expenses, contributions), credit card invoices by cycle, spending analysis, a portfolio with average cost, imports of bank files (CSV, OFX, digital PDF statements, B3 brokerage notes) and a monthly report.

- Owner: Edson, a Portuguese speaker who practises English in the conversations (section 10). The UI text is Portuguese.
- Repository: github.com/edsonw11/FINANCE-GOAL-1300K. Working branch: `feat/ux-audit-improvements`.
- It is **offline first**: the data lives on the device (localStorage key `metaapp.v2`). The API and sync are optional and exist for the web app; the Android app has no login or sync yet.
- **Not in the product** (searched in `src`, `backend`, `services`, `scripts`; nothing found): market data or quote services, OpLab, Bolsai, Open Finance, Tesouro Direto API, payments or billing. Plans and feature locks exist as data and a guard; nothing charges. The monthly report PDF is made by the browser's print dialog.

## 2. Repository map

```
index.html                 markup of the 7 tabs and dialogs (one page)
src/app.js                 bootstrap: wires everything, no rules, no HTML
src/core/                  pure helpers: config, DOM helpers, format, dates, money (integer cents), text-normalize
src/domain/                the rules and the state: 55 files, no DOM, no toast, no render
src/sync/                  web sync client: outbox, records, apply, api-client, runner
src/ui/                    screens (views/), components/, charts/, app-lock/, native-bridge.js, render.js
src/styles/                13 CSS files in cascade order
vendor/pdfjs/              pdf.js, only to read the text of digital PDFs (local, no network)
dist/                      the one-file build (scripts/build.py); CI fails if it is not the build of src/
backend/                   the API (NestJS) with its own package.json, prisma/, test/
android/ , capacitor.config.json , mobile/www/ (generated)   the Android shell
services/telegram-apk/     developer tool: sends the debug APK to a Telegram chat (not part of the app)
scripts/                   dev.sh, mobile.sh, build.py, smoke.sh, secret-scan.sh, device tests, lib/device.mjs
dev/                       local Keycloak realm and PostgreSQL setup for docker compose
tests/                     unit/ (46 files), fixtures/, smoke*.js (end to end), mobile-check.js
docs/architecture/         00-current-state.md, decisions/ADR-0001..0014, diagrams/ (section 11)
docs/security/             threat-model.md, security-test-plan.md, security-findings.md
```

## 3. Architecture

Layers of the browser app, enforced by `tests/unit/architecture.test.js` **[code]**:

```
ui  ->  domain  ->  core            (sync/ sits beside ui and calls domain)
```

- `core` and `domain` never touch the DOM, `toast` or `render`.
- The UI never changes the state directly. It calls `runCommand(fn)` (`src/ui/components/command.js`), which runs the domain command inside `transact()` (`src/domain/store.js`): snapshot, run, save, roll back on error.
- The state is one object `S` (global singleton in the browser) saved to localStorage. Money is integer cents (`src/core/money.js`).
- **The same rule files run in the API**: `backend/src/domain/domain-runtime.ts` (`loadDomain`) loads `src/core` and `src/domain`, so the browser and the server cannot disagree on a month result (ADR-0001, ADR-0006, ADR-0011). The API passes the state in explicitly, because the singleton cannot be shared between people.
- Sync (ADR-0008, ADR-0010, ADR-0012): the state is split into records with a fingerprint (`src/sync/records.js`); a change becomes an outbox entry (`outbox.js`); `runner.js` pushes in batches of 100 (`POST /api/v1/sync/push`), then pulls (`GET /api/v1/sync/changes?cursor=`); `apply.js` merges pulled changes without echoing them back. Mutations are idempotent by `mutationId`; a push answers one result per mutation: `applied`, `superseded`, `rejected` or `skipped`. A rejected mutation goes to a review list. Failures (offline, unauthorized, server) leave the outbox untouched and show on the sync card.

Where each rule lives (domain, `src/domain/`): month result `month-result.js`, month summary `month-summary.js`, credit card `card-cycle.js` / `card-invoices.js` / `card-status.js` / `invoice-payment.js`, goal and wealth `goal-projection.js`, portfolio `portfolio.js`, imports `import-*.js` (reader, csv, ofx, pdf, classify, duplicates, commit), quick entry `quick-entry.js`, report `report.js`, state recovery `state-recovery.js` (unreadable data is kept aside, one copy per day).

## 4. Backend

NestJS 12 on Fastify 5, Prisma 7 with the pg adapter, PostgreSQL 18, `openid-client` 6, `zod` for config. Entry: `backend/src/main.ts`, app factory `backend/src/create-app.ts` (`createApp`).

Modules (`backend/src/`): `auth` (OIDC authorization code flow with PKCE against Keycloak; opaque session cookie, only a hash is stored; `GET /api/v1/me`), `sync`, `accounts`, `legacy` (month rules, import/export of a whole state), `plans` (plans, feature locks, admin, audit log), `health`, `web` (serves the browser app from an allow-list), `security` (guards, rate limiter), plus `config`, `database`, `records`, `users`, `http`, `logging`.

Global guards, in this order: `AddressRateLimitGuard`, `CsrfGuard`, `AuthGuard`, `PersonRateLimitGuard`, `AdminGuard`, `FeatureGuard`. Every route except the public ones needs a login; writes also need the app's origin and the CSRF header.

Routes (21 entries; the full list with rules is `docs/architecture/diagrams/analysis/api-catalog.md`, generated from the controllers):

| Group | Routes |
|---|---|
| Pages | `GET /`, `/index.html`, `/src/*`, `/vendor/*` (allow-list, 404 otherwise) |
| Health | `GET /health/live`, `GET /health/ready` (database answers within a timeout) |
| Auth | `GET /auth/login?returnTo`, `GET /auth/callback`, `POST /auth/logout`, `GET /api/v1/me` |
| Sync | `POST /api/v1/sync/push` (120 per minute per person), `GET /api/v1/sync/changes` |
| Accounts | `GET /api/v1/accounts`, `GET|PUT|DELETE /api/v1/accounts/:id` |
| Legacy | `POST /api/v1/import/legacy-state?replace` (25 MB, 6 per hour), `GET /api/v1/export/legacy-state`, `GET /api/v1/months/:month/{summary,result,report}` (report needs feature `report.monthly`) |
| Admin | `GET /api/v1/admin/plans`, `PUT|DELETE /api/v1/admin/plans/:planId/features/:key`, `PUT /api/v1/admin/users/:userId/plan` (all audited) |

Configuration (`backend/src/config/env.schema.ts`, validated with zod; error messages never print the received value): `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `HEALTH_CHECK_TIMEOUT_MS`, `DATABASE_URL`, `APP_BASE_URL` (an origin, no path), `OIDC_ISSUER`, `OIDC_INTERNAL_URL` (optional, for the docker network), `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (at least 16 characters), `SESSION_TTL_HOURS` (default 168), `SESSION_IDLE_MINUTES` (default 4320), `RATE_LIMIT_FACTOR` (production must leave it at 1). The local development passwords and client secret are constants in that file and in the dev realm; **they must never reach production**. Other variables read in code: `DOMAIN_ROOT`, `WEB_ROOT`.

Repositories have contract tests (`backend/test/contracts/*.contract.ts`) that run against an in-memory fake and the real PostgreSQL, so a fake cannot drift from the real thing.

## 5. Data model

PostgreSQL, `backend/prisma/schema.prisma` **[code]**: money as BIGINT cents, a `user_id` on every row.

| Model | Role |
|---|---|
| `AppUser` | the person (OIDC subject, e-mail, plan) |
| `Session`, `AuthFlow` | login sessions (hash only) and the PKCE flow in progress |
| `Record` | one row per record of the person's state; the body is JSON (money and dates are **not** typed columns) |
| `UserState` | the person's whole state (legacy import/export) |
| `SyncCursor`, `SyncMutation` | the change cursor and the log that makes pushes idempotent |
| `Plan`, `PlanFeature` | plans and the features each one has |
| `AuditLog` | admin changes |

On the device: one JSON state under `metaapp.v2`, an outbox, a last-backup mark, and the app-lock settings.

## 6. Security (read `docs/security/threat-model.md` before touching auth, sync or imports)

- Sessions: opaque cookie, hash stored, a hard lifetime and an idle lifetime. CSRF: origin check plus a header. Rate limits per address and per person, **in memory per instance** (several instances multiply them).
- The API connects to the database with a data-only role (grants in `backend/prisma/roles/grants.sql`); migrations run with another role.
- The browser app has its own CSP (`tests/page-csp.txt`, tested in the real WebView: an inline script must be refused). Imported files are untrusted content: a stored XSS in the list was found and fixed (`tests/smoke-xss.js`).
- Logs are redacted (`backend/src/config/redact.ts`). `scripts/secret-scan.sh` scans the tracked files in CI. **Never commit a secret**, and never put one in a document, a test or a diagram.
- Android: `FLAG_SECURE`, no cloud backup, own CSP, app lock (section 7).
- The Telegram bot token of the APK tool was once exposed in a conversation; the owner was told to revoke it with `/revoke`. The token lives only in an ignored `.env`.

## 7. Android shell

Capacitor 8; package `com.everfox.app` (the final `appId` is **not decided**; confirm before any Play upload). `MainActivity.java` registers `AppLockPlugin` before the bridge starts and re-resolves the status-bar icon style on theme change. The page is the same as the web app, offline.

App lock (ADR-0014 section 10, committed in `95891d4`): `src/ui/app-lock/` (`lock-policy`, `lock-gateway`, `lock-screen`, `lock-events`, `app-lock`), `src/ui/views/lock-settings.js`, `android/.../AppLockPlugin.java` (BiometricPrompt: fingerprint, face or phone PIN), `androidx.biometric:biometric:1.1.0`. The lock asks again after 30 seconds away. `src/ui/native-bridge.js` maps Back and screen reading, including the `locked` state. Share-sheet backup: `shareTextFile` in the same file. Confirmed working on the owner's phone.

Not done on Android: sign-in and sync (needs a system-browser login, an app link and a token in the Android Keystore, with its own threat model), a portrait lock for phones.

## 8. Tests and CI

| Layer | Where | Run |
|---|---|---|
| Browser unit tests | `tests/unit/*.test.js` (46 files; architecture, golden calculations, app lock, sync, imports) | `npm run test:unit` |
| End to end (headless Chrome) | `tests/smoke.js`, `smoke-sync.js`, `smoke-xss.js`, `smoke-native.js` (fake native layer in `tests/fixtures/fake-native.js`) | `npm run test:e2e` |
| Phone widths | `tests/mobile-check.js` | `npm run test:mobile` |
| Backend unit | `backend/test/unit` | `cd backend && npm test` |
| Backend integration (real PostgreSQL and Keycloak) | `backend/test/integration` | `cd backend && npm run test:integration` |
| Real device or emulator | `scripts/device-test.mjs`, `device-test-lock.mjs` | `npm run mobile:test`, `npm run mobile:test-lock` |
| Services | `services/telegram-apk/test/` | `npm run test:services` |

CI (`.github/workflows/ci.yml`), jobs `check`, `backend`, `stack`, `android`: `npm audit --audit-level=high`, secret scan, lint, typecheck, unit tests, **build then `git diff --exit-code -- dist/`** (so a change in `src/` needs the rebuilt `dist/` committed), e2e and phone widths; backend typecheck, tests, build, migrations on an empty database, integration tests; the whole stack with `scripts/dev.sh up` and `check`; the debug APK (checked to hold the app, its own policy and no cloud backup).

Testing standard from the owner: many tests, SOLID and SRP in the tests too, and **mutation proof**: after writing a test, break the code on purpose and confirm the test fails. A surviving mutation means the test or the code is redundant (it happened with a redundant guard in the app lock: the guard was removed and tests for the real event orders were added).

## 9. Commands

```bash
npm run check                  # lint, typecheck, unit, services, build, e2e, phone widths
npm run lint | typecheck | test:unit | test:e2e | test:mobile | build
npm run dev:up | dev:down | dev:reset | dev:seed | dev:status | dev:check   # whole stack in docker compose (db 5433, keycloak 8081, api 3000)
npm run mobile:doctor | mobile:web | mobile:sync | mobile:apk | mobile:emulator | mobile:test | mobile:test-lock
npm run apk:check              # checks the Telegram setup
npm run apk:send -- --build    # builds the debug APK and sends it (only with the owner's OK)
cd backend && npm run check    # backend typecheck, tests, build
```

`scripts/mobile.sh` defaults `ANDROID_HOME` to `~/Android/Sdk`. Debug APK path: `android/app/build/outputs/apk/debug/app-debug.apk`. Local sign-in for the demo is in `README.md` (development only). If npm fails with `EINTEGRITY`, the global cache is corrupted: pass `--cache "$(mktemp -d)"`.

## 10. The owner's rules (follow exactly)

1. **Never commit or push without authorization.** A standing authorization exists only when the owner gives it for the current work; ask again for new work. When authorized: commits **without a co-author line** (this overrides any default attribution), the right type (`fix` only for a real bug; security work is `chore`), one commit per phase, push after each commit, then watch CI: `curl -s "https://api.github.com/repos/edsonw11/FINANCE-GOAL-1300K/actions/runs?branch=feat/ux-audit-improvements&per_page=1"`, parse with `json.loads(..., strict=False)` and wait until the head sha is `completed` and `success`. Never commit secrets.
2. **Phase gate**: after each phase, report and **wait for the explicit OK** before the next one.
3. **Design**: SOLID, one responsibility per class or module, depend on abstractions, small units, many tests, mutation proof (section 8).
4. **Language**: code, comments, documents and file names in **English**. Only the UI text and the keys of persisted data stay in Portuguese. Replies to the owner are in **Portuguese** and end with a short "Dica de inglês": brief corrections of the owner's English, never interrupting the work. The owner mixes Portuguese and English on purpose; understand the intent and carry on.
5. No Telegram post of the APK and no Play Store publication without the owner's go-ahead.
6. Documentation-only tasks must not change application code.
7. Report faithfully: failing tests with their output, skipped steps said as skipped, and never claim something was done (an import into Miro, a device test) that was not.

## 11. Documentation as code: the architecture diagrams

13 diagrams, 20 pages, in `docs/architecture/diagrams/` (index: its `README.md`). They are **generated from one specification per diagram**, so Draw.io, Mermaid, images and analysis files cannot drift apart. Never edit generated files by hand.

| # | Diagram | # | Diagram |
|---|---|---|---|
| 01 | Executive overview | 08 | Report generation (browser, API) |
| 02 | High-level architecture | 09 | Data model (database, device) |
| 03 | Components (frontend, backend) | 10 | Error handling |
| 04 | Flows (add expense, import, sync run) | 11 | Runtime environment |
| 05 | Sequences (login, sync, report) | 12 | API endpoints |
| 06 | External integrations | 13 | Future evolution (PROPOSAL only) |
| 07 | Financial analysis engine (rules) | | |

```
docs/architecture/diagrams/
  NN-name.drawio           editable in diagrams.net, one tab per page
  mermaid/*.mmd            Mermaid, one file per page (parse with Mermaid 11)
  miro/png, svg, pdf       images for Miro (PNG at 2x)
  miro/MIRO-IMPORT-GUIDE.md, miro/presentation-guide.md
  analysis/                architecture-inventory, business-rules, integrations, api-catalog, data-model, known-limitations, traceability-matrix (all generated)
  tools/                   the generator
```

Generator (`tools/`): `specs/d01..d13.mjs` are the **only place to edit content** (lanes, nodes, edges; helpers in `specs/helpers.mjs`); `layout.mjs` places lanes as columns (`LANE_W=300`, `NODE_W=260`, `LANE_GAP=90`) and picks connector sides; `to-drawio.mjs`, `to-mermaid.mjs`, `to-svg.mjs` write the formats; `trace.mjs` checks the code; `analysis-docs.mjs` writes the analysis files; `build.mjs` runs it all; `export-images.sh` makes PNG and PDF with headless Chrome; `validate.py` checks the Draw.io files (run it with `python3 -I`).

Invariants:

- Every node has `src` (file) and `sym` (symbol). **The build fails if the file or the symbol does not exist.** The traceability matrix records the evidence as `file:line` (240 components traced). A node marked IMPLEMENTED needs a source file.
- Status vocabulary: IMPLEMENTED, PARTIAL, NOT CONFIRMED, NOT IDENTIFIED, LEGACY, PROPOSAL, MOCK. Colours only group by role (API blue, service purple, domain green, external orange, infrastructure grey, decision yellow, error red). A colour is never a status.
- Never draw something that is not in the code. Absent things (market data, OpLab, Bolsai, Open Finance) are drawn as NOT IDENTIFIED. Future work is drawn only in diagram 13, as PROPOSAL.
- Layout rules: arrows connect only neighbouring lanes; a node must be last in its lane to leave downwards; sequence pages use lifelines.

Workflow after a code change:

```bash
# 1. edit docs/architecture/diagrams/tools/specs/dNN.mjs
node docs/architecture/diagrams/tools/build.mjs            # fails if a file or symbol is gone
bash docs/architecture/diagrams/tools/export-images.sh     # PNG and PDF (needs google-chrome)
python3 -I docs/architecture/diagrams/tools/validate.py    # Draw.io structure
# 2. look at the PNG of every page you changed
```

Miro does not read `.drawio`. Routes: drag the PNG, SVG or PDF; or open the `.drawio` in diagrams.net, File > Export as > VSDX, then Miro's Import diagram (editable); or paste a `.mmd`. **No import into Miro was ever performed or tested: never claim it.** `to-svg.mjs` is the source of the images and is not the Draw.io renderer, so connector routes differ slightly. The `mermaid-cli` command hung on the owner's machine; the Mermaid files were checked with the `mermaid` package's parser in headless Chrome.

Result when written: 13 diagrams, 20 pages, 240 traced components, 21 route entries, 128 files in the folder. Integrations found: Keycloak, PostgreSQL, the Android system, the Telegram Bot API (developer tool) and the vendored pdf.js. Visual spot checks done: 12, 03 frontend, 04 sync. Pages 06, 09, 10 and 13 were not looked at after the last layout change.

## 12. How to extend

- **A new domain rule**: write the failing test in `tests/unit/`, add it in `src/domain/` (no DOM), expose it through a command if it changes state, call it from a view through `runCommand`. If the API uses it, `domain-runtime.ts` already loads it. Update `docs/architecture/diagrams/tools/specs/d07.mjs` (and 03).
- **A new screen or card**: a module in `src/ui/views/`, markup in `index.html`, styles in `src/styles/` (the right numbered file), wire it in `src/app.js`. Run `npm run build` and commit `dist/` too.
- **A new endpoint**: controller method in the right module, a zod schema for the body, a guard decision (public or not, feature, admin), a contract or integration test, then `specs/d12.mjs`, `d10.mjs` if it adds an error path, and rebuild the diagrams (the catalogue is generated). Mind the rate limits.
- **A new synced resource**: a `SyncResource` (`backend/src/sync/sync-resource.ts`, see `accounts/account-sync.resource.ts`), the record split in `src/sync/records.js`, a device-sync contract test.
- **A new integration**: add the adapter behind an interface, keep the secret in the environment only, document it in `specs/d06.mjs` and its threat in `docs/security/threat-model.md`, write an ADR in `docs/architecture/decisions/`.
- **A new native plugin**: register it in `MainActivity.onCreate` before `super.onCreate`, add the JS gateway in `src/ui/`, a fake in `tests/fixtures/fake-native.js`, and a device test.
- **A decision that is hard to reverse**: write the next ADR (`ADR-0015-...md`), in English, with context, decision and consequences.

## 13. History (why things are the way they are)

Phases (details in `00-current-state.md` and the ADRs): 0 diagnosis and golden calculations; 1 to 3 structure, tooling, backend skeleton; 4 and 5 login, sessions, sync, plans; 6 one command for the whole environment (`dev.sh`); 7 security (XSS fix, log redaction, secret scan, backup/restore test, threat model); 8 Android shell and emulator tests; the Telegram APK service; the app lock. Latest commits: `95891d4` app lock (biometric or phone PIN), `f7a7e33` `ANDROID_HOME` default, `d4422cf` docs for `apk:send`, `90973fd` Telegram APK service, `b2a294f` Android emulator tests, `e626e05` Android shell.

Problems found while building the app lock, kept because they will happen again: the phone's keyguard appears after setting a PIN and swallows the typed digits (the device script now dismisses it and asserts it is gone); the first Back press only closes the PIN keyboard (the script presses Back up to 3 times); one ANR was seen once and not reproduced in three full runs (the test now fails on any ANR of the app).

Decisions to keep: the rules are shared, not duplicated; offline first; no framework rewrite; Android before the backend host; the API is not hosted yet.

## 14. Open work (ask the owner which to start; do not start two)

1. Sign-in and sync on Android (system browser, app link, Keystore token, threat model first).
2. Host the API and the web app (phases 9 and 10 of the plan, AWS reference; set `trustProxy` on purpose; `RATE_LIMIT_FACTOR` stays 1).
3. Billing (phase 8b): web checkout and Play Billing mapped to plans.
4. Typed columns and command endpoints (phase 4b-2).
5. Shared rate-limit store when more than one instance runs; metrics, traces and error reporting (only logs exist now).
6. A portrait lock for phones; confirm the `appId` before a Play upload.
7. Open the diagram pages 06, 09, 10 and 13 and look at them; do the VSDX route into Miro with the owner and report what happened.

## 15. Traps

- `dist/` must be rebuilt and committed with any change in `src/`, or CI fails.
- Rate limits are per instance, in memory.
- Records are JSON bodies; SQL cannot use money or dates as columns yet.
- The browser state is a global singleton; do not copy that into the API.
- zsh: quote globs (`--include='*.js'`); the CI poll needs `json.loads(..., strict=False)`.
- `python3 -I` for scripts that read untrusted files; keep scripts out of the directory that holds downloaded files.
- The npm global cache may be corrupted (`EINTEGRITY`): use a temporary `--cache`.
- Do not trust a colour in a diagram as a status; read the status line in the box.

## 16. Glossary

Outbox: changes waiting to be sent. Cursor: the last change number a device has seen. Record: one synced piece of the state. Plan and feature: a plan has features; a locked one is shown as PRO and the API answers 403 `feature_locked`. Lane: a column of a diagram. Spec: the file that defines a diagram. Trace: the proof that a box exists in the code. Phase gate: stop and wait for the owner's OK after each phase.
