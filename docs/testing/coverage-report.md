# Coverage report

Date: 2026-11-26. Measured, not estimated. Command: `node tools/coverage.cjs` (V8 coverage collected with `NODE_V8_COVERAGE`, reported by c8; c8 is not a project dependency, the tool fetches it on demand).

## Method and why it is reliable enough

The unit harness (`tests/unit/harness.js`) strips `import`/`export` lines and runs the sources inside a `vm` context, so V8 offsets no longer match the files. `tools/coverage.cjs` solves this without touching production code or the build: it copies the sources, replaces the stripped statements with blanks of the same length (offsets are preserved) and maps the V8 data back to the real files. Nothing in `src/` or the build changes.

## Limits (read before quoting the numbers)

- "Branches" are V8 **blocks**, not Istanbul branches. A one-line `a?b:c` can count as one block. Treat the branch figure as an indicator, not as a proof that both sides of each decision were exercised.
- Line coverage says the line ran, not that the result was checked. That is why mutation testing is the main quality evidence (see mutation-survivors.md).
- `src/ui/views` (56 modules) is **not** reached by the unit suite; it is exercised only by the headless end to end suites (`scripts/smoke.sh`, `tests/smoke-native-import.js`), whose coverage is not measured. Its 0.97 % below is the unit suite only.

## Results (unit suite)

| Layer | Statements / lines | Branches (V8 blocks) | Functions |
|---|---|---|---|
| `src/core` | 100 % | 93.07 % | 97.61 % |
| `src/domain` | 99.95 % | 91.16 % | 99.35 % |
| `src/sync` | 100 % | 97.22 % | 100 % |
| `src/ui` (non-view) | 34.59 % | 85.33 % | 50 % |
| `src/ui/views` | 0.97 % | 26.66 % | 5.17 % |
| all files | 51.11 % | 89.77 % | 85.65 % |

The "all files" line is dragged down by the views; the logic layers (`core`, `domain`, `sync`) are at about 100 % of lines.

## Weakest logic modules (branches)

`import-split.js` 76 %, `spending-stats.js` 75 %, `categories.js` 80 %, `import-reader.js` 81 %, `start-steps.js` 83 %, `import-ofx.js` 84 %, `category-commands.js` 84 %, `brokerage-note.js` 85 %. All have 100 % of lines run; the missing blocks are default values and rarely taken sides of conditions.

Non-view UI: `toast.js` 79 % lines (timer paths, covered by e2e).

## Functions never executed by unit tests

Only DOM-only code in `src/ui` (covered by e2e). Before the audit: 23 functions; after: 4 in the logic layers plus the views.

## What to do next

Cover the weakest branches above only where they hold a decision that matters (import splitting, spending statistics); do not chase 100 %. A real fix for the views is to measure coverage inside the headless browser run (Chrome DevTools coverage), which was not attempted here.
