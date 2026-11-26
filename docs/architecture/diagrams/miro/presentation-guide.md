# Presentation guide

Twenty minutes, in this order. Each step says what to say and what to prove from the code.

| # | Diagram | Message (one sentence) | Time |
|---|---|---|---|
| 1 | 01 Executive overview | Everfox is an offline-first finance app: the page, the rules and the data live on the phone; the API is optional. | 2 min |
| 2 | 02 High-level architecture | One browser app, one Android shell, one NestJS API with a security layer in front of every module. | 2 min |
| 3 | 03 Components (frontend, backend) | Four layers in the browser (core, domain, ui, sync); the API runs the same domain files. | 3 min |
| 4 | 04 Flows | What happens when you add an expense, import a file and sync. | 3 min |
| 5 | 05 Sequences | Login (OIDC with PKCE), sync and the report, call by call. | 3 min |
| 6 | 06 Integrations | Only Keycloak and PostgreSQL. No market data, no broker API (NOT IDENTIFIED). | 1 min |
| 7 | 07 and 08 Rules and report | Month result, credit card, goal, portfolio; the report is built in the page and printed by the browser. | 2 min |
| 8 | 09 Data model | PostgreSQL records are JSON bodies; the device keeps one state under `metaapp.v2`. | 1 min |
| 9 | 10 Error handling and 12 API | The guards in order and the error answers; every route with its rule. | 2 min |
| 10 | 11 Runtime and 13 Evolution | What runs where today, what limits it, and the proposals (not implemented). | 1 min |

Tips:

- Colours are a convention (legend in every image). The status in each box is the truth: IMPLEMENTED, PARTIAL, NOT CONFIRMED, NOT IDENTIFIED, LEGACY, PROPOSAL, MOCK.
- Every box has a file and symbol. If someone doubts a box, open `analysis/traceability-matrix.md` and show the line.
- Do not say that Everfox has market data, Open Finance or billing: the code has none (diagram 06 and 13).
