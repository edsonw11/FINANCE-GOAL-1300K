# Regression strategy

Run the smallest set that covers the change, and `npm run check` before every push.

| You changed | Run at least | Why |
|---|---|---|
| `src/core/money.js`, `dates.js` | `npm run test:unit` (all) | Every module calls them. `finance-invariants` and `golden` fail first if a total moves. |
| Month, card, invoice or balance rules (`month-*`, `card-cycle`, `invoices`, `accounts`, `portfolio`) | `card-cycle-rules`, `invoice-of-purchase`, `accounts-gross`, `portfolio-realized`, `month-result`, `calc-audit`, `golden`, `finance-invariants` | These recompute results independently of the code. |
| Import (`import-*`, `src/ui/views/pdf-text.js`) | `import-*` unit tests, `import-roundtrip`, then the e2e Android-shell import run | The e2e run is the only check that the PDF reader starts under the real CSP. |
| `scripts/build-mobile.py`, the CSP, `vendor/pdfjs` | `mobile-build` unit test, `npm run test:e2e`, then `scripts/mobile.sh test` on a device | A policy mistake shows only in a browser that enforces it. |
| `src/domain/store.js` (`migrate`, `onSave`, `adoptRemoteState`) | `store`, `store-hooks`, `sync-runner` | State loss risk. |
| Sync (`src/sync/*`, `backend/src/sync`) | `sync-*`, `api-client`, backend unit and integration | Contract between app and API. |
| Anything under `src/` | `npm run build` and commit `dist/` | CI fails on `git diff --exit-code -- dist/`. |
| Backend input, plans or security | `cd backend && npx vitest run test/unit` | Includes `parse-input`, `account-schemas`, `entitlements`, security HTTP tests. |

Rules for new work: write the test first when fixing a bug, and prove it by breaking the code on purpose (or with `tools/mutation-lite.cjs`) before trusting it. A surviving mutation means a missing test or an equivalent change: read it, do not ignore it.
