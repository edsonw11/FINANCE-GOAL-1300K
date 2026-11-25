# ADR-0012 · The web app syncs with the API (Phase 5)

Status: Accepted (2026-11-29). Implements the client side of [ADR-0008](ADR-0008-offline-first-sync.md) on top of [ADR-0010](ADR-0010-sync-and-plans.md) and [ADR-0011](ADR-0011-records-and-shared-rules.md).

## Decision
- **The sync is a layer beside the app** (`src/sync/`, no DOM, no direct state access). The domain and the screens are unchanged: the app still saves to localStorage first and works with no server.
- **How a change is noticed:** after every save the sync compares the state with what the server is known to have (a fingerprint per record) and queues the difference in an **outbox**
  (put or delete per record, one entry for the settings). Nothing in the domain has to say what changed.
- **Sending:** the outbox goes to `POST /api/v1/sync/push` in order, up to 100 per request, then the app pulls `GET /api/v1/sync/changes` from its cursor.
  An entry leaves the outbox only when the server answers for it. Offline, a lost login, a crash or a lost answer lose nothing: the same entry is sent again and the server answers the same.
  The bookkeeping is read again after every network wait, because the app may save while a request is in flight (a test found this: an edit made during a send was lost).
- **Identity of a record:** the server's id is a UUID made on the device; the app's own key (`id`, the import hash, or day|account for a balance) is the **legacy key**. A device finds a server record by that key.
- **First sync on a device:** it looks at the server before sending. The same key under another id is the same record (adopted, no duplicate); a record that exists only here is sent; the account's **settings win** over a new device's blank ones.
  After that first merge, the same key under another id is a **clash**.
- **Clashes** (two offline devices gave the same number to two different records) go to a **review list** with the person's data intact; nothing is overwritten and nothing is renumbered
  (ids are referenced by transfers, series and accounts, so renumbering safely needs the domain's help: later). To make clashes rare, a device raises its counter past every number it receives.
- **A delete wins over an edit.** A deleted record gives its legacy key back, so the number can be used again (found by the tests against the real server).
- **Another person on the same device is refused:** the bookkeeping belongs to the person who signed in first; nothing is sent or received until the person decides (the screen offers "Sair").
- **One wire shape for every kind:** accounts moved onto the same record resource as the other kinds (`{body, legacyKey}`); sync applies the same per-kind rules as an import.

## The screen
Settings → "Conta e sincronização" and a small badge in the header, both **hidden when there is no API** (page opened as a file, or from a plain static server): the app then behaves exactly as before.
Signed out: an "Entrar" button (to `/auth/login`). Signed in: who, plan, "N pendentes" (records, not internal entries), last sync, "Sincronizar", "Sair", and the review list with "Entendi".
It syncs when the page opens, when the network returns, when the tab comes back, and on the button. Failures say what happened and that nothing was lost.

## Same origin
The API serves the app (`/`, `/src/*`, `/vendor/*`) from an allowlist built at startup, so cookies are first-party and no CORS is needed. The image carries the app under `/app/web`.
There is no content-security-policy yet (Phase 7); the page still has inline code in the built single file.

## Limits, said plainly
- The review list shows what happened but offers no "keep mine / keep theirs" yet: the person's local data is never changed, and the item stays visible until acknowledged.
- Settings are one document: the last writer wins as a whole (the id counter only ever goes up).
- localStorage has a small quota: 3000 transactions are fine; the phone app (Phase 8) moves to a database if measurements say so.
- A real login against Keycloak in a real browser was not scripted; the login itself is covered by the integration tests with Keycloak, and the screen by a browser test with a scripted API.
