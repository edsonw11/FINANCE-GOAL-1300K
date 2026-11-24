# ADR-0005 · Tooling: lint and types without reformatting the existing code

Status: Accepted (2026-11-24)

## Decision
- **ESLint 10** (flat config) with correctness rules only: unused code, `eqeqeq`, no DOM in `src/domain`, no implicit globals.
- **TypeScript 7 `--checkJs`** on `core` + `domain` now (no emit, no build step); `src/ui` added module by module later.
- **Prettier is not run on the existing code:** it would rewrite every line of the compact style and the diff would hide real changes.
  New packages (backend, apps) use Prettier from the start. `.editorconfig` for basics everywhere.
- Packages from the **public npm registry** (project `.npmrc`), exact versions, lockfile committed; CI runs `npm ci` + `npm audit`.
- **CI (GitHub Actions)**: lint, typecheck, unit, build (fails if `dist/` is stale), e2e and phone widths; actions pinned by commit SHA; read-only token; no secrets.

## Consequences
First run fixed 38 lint findings (dead code, rethrown errors without cause) and 22 type findings (tuple types, date arithmetic), all behaviour-neutral (golden test unchanged).
