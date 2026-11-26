# The id counter (`nid`): investigation and fix

Round 3, 2026-11-26.

## How it works

- **Where it lives.** `S.nid` in the app state (`src/domain/store.js`): `seed()` and `blankState()` start it at 1. It is saved with the rest of the state in the browser storage (`metaapp.v2`) and is part of the settings document that the sync sends to the server (the server stores it as an ordinary setting; it has no counter of its own).
- **How it is used.** Every new thing takes `S.nid++`: a transaction (a number), an account (`'a' + n`), a trade (`'t' + n`), a transfer (`'tr' + n`), the series number of a repeated record (`serie`), a demo record. about 20 places in `src/domain` and `src/sync` (list: `grep -rn nid src`).
- **How it is recovered.** On start the state is read by `readState` (browser storage) and `readBackup` (the automatic copy); a backup file goes through `importBackup`; the server's settings document goes through `applyChanges`. Records pulled from the server lift the counter past their own key (`counterOf`, in `src/sync/apply.js`).
- **Concurrency.** None inside one page: JavaScript runs one task at a time and `S.nid++` is synchronous. Two browser tabs on the same storage each keep their own copy of the counter in memory and each save the whole state: the last save wins, so the other tab's new records are lost, and both tabs could have given the same id to different records. This is a limit of the one-state-in-one-storage design, not of the counter. It is documented here, not changed.

## What was wrong (confirmed by tests that failed first)

`src/domain/state-recovery.js` accepted any state with `v: 2`, and `importBackup` accepted any `v: 2` file with a `tx` list, without looking at `nid`. `applyChanges` could leave `nid` undefined when the server's settings document had no counter and the local counter was 1.

| Counter in the data | Before | Consequence |
|---|---|---|
| missing, `undefined` | next id is `NaN` (stored as `null`) | every new record has `id: null`; they cannot be told apart, an edit or a delete hits the first one |
| `null` (what `NaN` becomes in JSON) | first id `0`, then 1, 2 | id `0` is falsy: code that tests `if (id)` skips it |
| `0`, negative, fractional, text | ids `0`, `-4`, `2.5`, or string concatenation (`'abc1'`) | invalid ids |
| beyond 2^53 | `n + 1 === n`: the same id forever | all new records share one id |
| lower than an id in use (a backup edited by hand, a partial restore) | new ids reuse existing ones | a new record **overwrites** or hides an old one on the next sync (the server key is the id) |

Reaching this needs an unusual file or document, not normal use; but the damage (duplicate or lost records, failed import) is silent, so it was worth closing.

## The fix

`src/core/id-counter.js` (pure, 40 lines): `repairIdCounter(state)` makes `nid` a safe integer of at least 1 that is past every number used by an account, transaction (and its `serie`), trade or transfer id. A state whose counter is already right is returned untouched, so existing data and the id formats do not change. It is applied at the four doors: `readState`/`readBackup` (storage and the daily copy), `importBackup` (backup file) and `adoptRemoteState` (what the sync merged). `applyChanges` (the sync layer may only import from the sync layer) now always sets a counter of at least 1.

## Tests

`tests/unit/id-counter.test.js` (56 assertions): the plain counter; a counter that is missing, null, NaN, 0, negative, fractional, text, empty, beyond the safe range, infinite; lower than the ids in use; ids of every kind; storage, backup, automatic copy, server document and pulled records; a restart (save, load, add); a new record never takes an old id. A mutation run on the module: 23 of 26 mutants killed, the 3 left are equivalent (`>= 1` against `>= 2` with a floor of 1; `<` against `<=` assigning the same value).

## Left as it is

- Two tabs on one storage (above).
- An id that is a string that is not numbered (`'nu'`) is ignored by the floor, as designed.
- Nothing else depends on the counter value: the server never reads it.
