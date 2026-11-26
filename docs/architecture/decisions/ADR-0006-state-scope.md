# ADR-0006 · Running the domain against a given state (`withState`)

Status: Accepted (2026-11-24). Refines ADR-0001 ("the state is passed as a parameter").

## Context
The domain reads the global state `S` in 41 modules (185 reads), and 30 UI modules call it. The server must run the same
rules for many users, so each call has to see the data of one user only.

## Options
1. **Add a `state` parameter to every domain function.** This means about 185 reads and several hundred call sites in the UI
   and tests. Not one result changes, but there is a real chance of passing the wrong object somewhere.
2. **Scoped state, `withState(state, fn)` in `domain/store.js`.** It sets the state in force, runs `fn`, and always puts the
   previous state back (`finally`). The domain code does not change.

## Decision
Option 2.
- `withState` swaps the storage for a no-op one, so `transact()` inside it saves nowhere. Persisting the result is the
  caller's job (the server repository).
- It clears the invoice allocation cache, the only state-derived cache, on entry and on exit.
- It returns `{result, state}`, where `state` is the one in force at the end, because a command may replace it (backup import).
- It accepts **synchronous `fn` only** and refuses a promise result. JavaScript runs one synchronous call to the end, so
  two requests can never share a state. The server must load the state, call `withState`, then save, with no `await` inside.

## Consequences
+ The change is small and behaviour-neutral. The golden file is unchanged, and `tests/unit/state-scope.test.js` proves
  isolation: results, writes, the cache, errors, nesting and misuse. Each guard was checked by mutation, so removing it
  makes a test fail.
+ The browser keeps working exactly as before. It never calls `withState`.
− Hidden coupling remains: a function reads `S` instead of declaring it. Lint keeps the DOM out of the domain, and
  the server must use `withState`. Any new module-level cache must be cleared in `withState` too (see `invalidateAllocation`).
− If the server ever needs async rules, use option 1 for those modules or `AsyncLocalStorage`.
