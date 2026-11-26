# ADR-0008 · Offline first: the phone keeps working without a network and syncs later

Status: Accepted (2026-11-25). Requested by the product owner: someone buys something with no signal, adds the expense, and it must reach the server later.

## Context
Today the app saves on the device (localStorage) and works with no network. Moving the data to a server (Phases 4 and 5) must not make the server a requirement to record an expense: the phone is the place where expenses are entered, and it is often offline.

## Decision: local first, with an outbox
1. **The device always saves first.** Adding, editing or deleting a record writes to the local copy at once and puts one entry in an **outbox** (a persistent queue). The screen never waits for the network.
2. **The outbox is sent when it can be**: when the network returns, when the app is opened or comes to the foreground, after a login, and by a visible **"Sincronizar"** button. The screen shows how many entries are pending ("3 pendentes") and the last successful sync.
3. **An entry leaves the outbox only after the server confirms it.** Closing the app, a crash, a failed request or an expired login never lose data. If the login expired, the outbox stays and the user logs in again; nothing is discarded.
4. **Writes are idempotent.** Every record gets its id **on the device** (UUID) and every outbox entry has its own mutation id. Sending the same entry twice (a retry after a timeout) changes nothing the second time and returns the same answer.
5. **Pull after push.** After sending, the device asks for what changed on the server since its last cursor (`GET /api/v1/sync/changes?cursor=...`), so a second device sees the expense. The cursor is a server-side monotonic version, not a clock (phones have wrong clocks).
6. **Conflicts** (the same record edited on two devices while offline): expenses are mostly created once and rarely edited, so the rule is simple and visible: per-field **last writer by server arrival**, and **a delete wins over an edit**. Deleted records are kept as tombstones (`deleted_at`) so the delete reaches every device. If a rule cannot decide (for example a transfer whose other side was deleted), the record goes to a "to review" list instead of being silently changed.
7. **Order is kept**: outbox entries are sent in the order they were made, one batch at a time; a failed entry stops the batch (later entries may depend on it) and is shown with its reason. A permanently rejected entry (validation) is moved to "to review" with the user's data intact, never dropped.

## What this requires from the API (applied from Phase 3 on)
- **Ids chosen by the client:** `PUT /api/v1/<resource>/:id` creates or updates (idempotent), not `POST` that makes the server choose. An id that already belongs to **another user** answers like "not found" and never overwrites or reveals it (tested).
- **Every synced table has** `user_id`, `created_at`, `updated_at`, `deleted_at` (tombstone) and a `version` (server counter) so changes can be listed by cursor.
- **A batch endpoint** `POST /api/v1/sync/push` (many mutations, each with its mutation id, each answered separately) so a long offline session is not hundreds of requests.
- **Money stays in integer cents** on the wire, so the same expense has the same value on every device.

## Where it lands in the plan
| Phase | What |
|---|---|
| 3 | the owned-resource slice already uses client ids, idempotent `PUT`, tombstones and per-user scoping |
| 4 | `version`/cursor, `sync/push`, `sync/changes`, conflict rules, all with tests (two devices, retries, duplicates, offline edits) |
| 5 | the web app: local store + outbox + status badge + "Sincronizar" button, storage adapter already exists as the injection point |
| 8 | the phone app: Capacitor Network plugin (online/offline events) and sync when the app returns to the foreground. iOS does not allow reliable background sync, so sync on open and on the button is the guaranteed path |

## Trust set up online, proof made offline
Insurance and banking apps that issue a token with no signal work like this: the device receives a key while online, and later proves
itself without the network; the other side checks the proof when it can. The same idea fits here in three steps, from cheapest to most optional:
1. **Offline unlock (Phase 8):** a PIN or biometric opens the local copy with no server. The server session is only needed to sync.
2. **An expired session never blocks recording:** the user keeps adding records; the outbox waits for the next login (decision 3 above).
3. **Device-signed mutations (evaluate in Phases 4 and 7, optional hardening):** the device registers once while online (a key pair kept in the
   Keystore/Secure Enclave), and signs each outbox entry. The server checks the signature on sync, so it knows the entry came from that registered
   device and was not changed in transit or in the queue. It also lets one lost device be revoked without logging out the others.
   It is not needed to make the feature work, and adds key handling and recovery cases, so it is decided with the threat model, not before.

## Limits to be honest about
- A device that is offline for a very long time may find its session expired: it logs in again; the outbox is kept.
- Two devices editing the **same** record offline resolve by the rules above, not by magic; the "to review" list exists for the cases the rules cannot decide.
- The local copy on the phone is user data: it needs the platform's secure storage in Phase 8 (Phase 7 threat model).
- localStorage has a small quota; if the outbox grows, the phone app moves to SQLite/IndexedDB (decided in Phase 5, with a size measurement).
