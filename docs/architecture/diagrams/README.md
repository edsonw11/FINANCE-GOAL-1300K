# Everfox architecture diagrams

13 diagrams (20 pages), generated from one specification per diagram so that the Draw.io, Mermaid, image and analysis files always agree. Every box points at a file and a symbol in the code; the build fails when one does not exist.

| # | Diagram | Pages |
|---|---|---|
| 01 | Executive overview | 1 |
| 02 | High-level architecture | 1 |
| 03 | Internal components | 2 (frontend, backend) |
| 04 | End-to-end flows | 3 (add expense, import, sync run) |
| 05 | Sequence diagrams | 3 (login, sync, report) |
| 06 | External integrations | 1 |
| 07 | Financial analysis engine (rules and calculations) | 1 |
| 08 | Report generation | 2 (browser, API) |
| 09 | Data model | 2 (database, device) |
| 10 | Error handling | 1 |
| 11 | Runtime environment | 1 |
| 12 | API endpoints | 1 |
| 13 | Future evolution | 1 |

## Folders

- `*.drawio`: editable in diagrams.net, one file per diagram, one tab per page.
- `mermaid/`: Mermaid text, one file per page.
- `miro/png`, `miro/svg`, `miro/pdf`: images for Miro (see `miro/MIRO-IMPORT-GUIDE.md`; Miro does not read `.drawio`).
- `analysis/`: architecture inventory, business rules, integrations, API catalogue, data model, known limitations and the traceability matrix (all generated).
- `tools/`: the generator and the validator.

## Status vocabulary

IMPLEMENTED, PARTIAL, NOT CONFIRMED, NOT IDENTIFIED, LEGACY, PROPOSAL, MOCK. Colours only group by role (API, service, domain, external, infrastructure, decision, error).

## Rebuild

```bash
node docs/architecture/diagrams/tools/build.mjs
bash docs/architecture/diagrams/tools/export-images.sh
python3 -I docs/architecture/diagrams/tools/validate.py
```
