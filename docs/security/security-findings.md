# Security findings (Phase 7)

Severity: critical / high / medium / low. Status: closed or open (with the reason).

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | high | **Stored XSS in the transaction list.** `renderTransactions` put the category (text the person, an import or another device controls) into the row's second line without escaping. A category such as `<img src=x onerror=…>` created an element on the Lançamentos list. Found by the new XSS scenario on its first run. The page CSP would have blocked inline handlers, but the markup injection (and any attribute/link/form it can build) was real. Fix: the line is escaped (`src/ui/views/transaction-list.js`). | closed |
| F-02 | high | The API connected to PostgreSQL as the owner (superuser inside the container): one injection would have meant control of the database. Fix: owner role for migrations only; the API uses `everfox_app` with row privileges only; PUBLIC lost CONNECT on the app database and on `postgres` (Phase 7b). | closed |
| F-03 | low | `style-src 'unsafe-inline'`: the app sets inline styles. Scripts stay locked by hashes. | open (accepted, R2) |
| F-04 | low | Rate limiter is per instance, in memory, and drops the oldest keys when 50 000 are tracked. | open (accepted, R1) |
| F-05 | info | The sign-in route had no limit of its own: added 20/min per address (Phase 7a). | closed |

No critical or high finding is open (the gate of Phase 7).
