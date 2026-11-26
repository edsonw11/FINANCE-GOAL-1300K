# Testing documentation

Everfox is tested at four levels. This folder records the audit of those tests (2026-11-26), what is protected, and what is not.

| Document | What it holds |
|---|---|
| [test-audit.md](test-audit.md) | Inventory of every test suite and a verdict for each (ADEQUADO, INCOMPLETO, ...). |
| [test-coverage-gaps.md](test-coverage-gaps.md) | The gaps found, by component, and how they were found. |
| [test-implementation-plan.md](test-implementation-plan.md) | The plan: each test, what it protects, what bug it prevents. |
| [test-prioritization.md](test-prioritization.md) | Risk classes P0 to P3. |
| [critical-business-rules.md](critical-business-rules.md) | The rules that handle money, and which test protects each. Open questions for the owner. |
| [regression-strategy.md](regression-strategy.md) | Which tests to run for which kind of change. |
| [final-quality-report.md](final-quality-report.md) | Results with real numbers, limits, remaining risks (rounds 1 and 2). |
| [mutation-survivors.md](mutation-survivors.md) | Every surviving mutant: killed by a test, or why it is equivalent. |
| [id-counter.md](id-counter.md) | The id counter `nid`: how it works, what was wrong, the fix and its tests. |
| [owner-decisions.md](owner-decisions.md) | The decisions Q1 to Q5 and Q8 (old and new behaviour, tests); the two behaviour changes of round 3. |
| [commit-review.md](commit-review.md) | Critical review of the working tree and of the proposed commits. |
| [coverage-report.md](coverage-report.md) | Line, branch and function coverage of the unit suite, how it was measured, and its limits. |
| [backend-integration.md](backend-integration.md) | How CI runs the integration tests, how they were run here (throwaway database), order checks. |
| [statement-fixtures.md](statement-fixtures.md) | Strategy and drop-in fixtures for bank statements; limits. |
| [e2e-gaps.md](e2e-gaps.md) | What the end to end suites drive and what they do not. |
| [device-checklist.md](device-checklist.md) | What ran on the emulator, and the manual checklist for a real phone. |
| [reliability-review.md](reliability-review.md) | Time zones, fake clock, order, flakiness, weak assertions. |

## Running

| Command | What it runs |
|---|---|
| `npm run test:unit` | Browser unit suite (`tests/unit`, a `vm` harness). Seconds. |
| `npm run test:e2e` | `scripts/smoke.sh`: headless Chrome on the source, the sync card, XSS, the Android shell with its CSP (including CSV, OFX and PDF imports), and `dist/`. |
| `npm run test:mobile` | Phone widths and the Android environment script. |
| `npm run check` | Lint, typecheck, unit, build check, e2e and mobile. |
| `cd backend && npx vitest run test/unit` | Backend unit suite. Integration tests need a database (not run in this audit). |
| `node tools/mutation-lite.cjs --per-file 8 --out r.json src/domain/x.js` | Mutation check of chosen files on a copy of the repository. `--lines 12,40` runs every mutant on those lines. |
| `node tools/coverage.cjs` | Line, branch and function coverage of the unit suite (fetches c8 into a temporary folder; writes `coverage/`, git-ignored). |
| `FAKE_NOW=2028-02-29T12:00:00 NODE_OPTIONS="--require $PWD/tools/fake-clock-preload.cjs" node tests/run-unit.js` | The unit suite on another day, to find tests that depend on today's date. |
| `scripts/send-apk.sh` | Build the debug APK and send it to Telegram (asks first). |
| `scripts/mobile.sh test` | On-device test (real phone or emulator, `adb` needed). Not run in this audit. |
