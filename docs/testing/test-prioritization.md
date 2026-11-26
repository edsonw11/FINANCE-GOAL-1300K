# Risk prioritisation

| Priority | Criterion used for this project | Examples (and their state) |
|---|---|---|
| **P0 critical** | A wrong amount shown or saved, lost or corrupted data, or a feature dead for a whole platform | month result and report totals (G10, protected); which invoice a purchase lands on (G04, G05, protected); realised result of the portfolio (G01, protected); the state the sync merges is saved (G02, protected); import under the Android CSP (G16, protected) |
| **P1 high** | A main feature breaks or two screens disagree, or input is accepted that should be refused | import classification and duplicates (G07, G08, G09); settings (G11); API client (G12); gross totals (G06); backend input checks and entitlements (G19-G21) |
| **P2 medium** | A secondary screen or a message is wrong | review list of the sync (G13); how amounts and months are written (G14); the 56 screen modules (G25, open) |
| **P3 low** | Rare cases or test data | demo data (G15, open); backend line coverage (G24, open) |

## What was weighed

- **Impact:** this is a personal finance app. A wrong number is worse than a crash, so every calculation that ends on a screen or in a saved record is P0 or P1.
- **Frequency:** month result, invoices and import run every time the app is used.
- **Hard to see by hand:** the card cycle (a purchase on the closing day goes to another invoice, with weekends moving the closing) and sums with cents are exactly what a person does not recompute. They were checked by independent oracles and as properties.
- **Already protected elsewhere:** projection, golden calculations and the report agreement already had independent checks, so they were not duplicated.
- **Cost:** tests that need PostgreSQL, Keycloak or a phone were left to CI and to the device suite.
