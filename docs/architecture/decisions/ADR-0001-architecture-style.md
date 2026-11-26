# ADR-0001 · Architecture style: modular monolith, shared domain

Status: Accepted (2026-11-24; owner accepted the Phase 0 recommendations) · Context: [00-current-state.md](../00-current-state.md)

## Context
Public, paid product (D1). Today all rules live in `src/domain` (pure JS, 2,420 lines, 4,000+ assertions, a golden file of results).
The product needs a server (several users, one source of truth, billing) and must not re-implement and drift from the tested rules.

## Decision
- **One backend: a modular monolith in TypeScript on Node 20+**, modules by domain (accounts, transactions, categories, card, transfers,
  budgets, investments, imports, reports, identity, billing, audit). No microservices.
- **Framework: NestJS on the Fastify adapter.** Modules and dependency injection map to the domains; guards give one place to enforce
  authentication and ownership on every endpoint; first-party OpenAPI generation. Fastify keeps it fast and lean.
- **The rules are shared, not rewritten:** `src/domain` becomes a package used by the browser and by the server. Prerequisite: the state is
  passed as a parameter instead of the global `S` (Phase 1b), behaviour-neutral, proven by `tests/unit/golden.test.js`. Done as a scoped state, see ADR-0006.
- REST under `/api/v1`, OpenAPI as the contract; the web client is generated from it.

## Consequences
+ No rule drift; the golden file is the acceptance test of the server too. + One deployable unit (simpler ops, cheaper).
− The domain must stay framework-free (enforced by lint and the architecture test). − NestJS adds decorators/boilerplate (accepted for the structure it gives).

Alternatives: Fastify alone (lighter, but auth/DI/OpenAPI wiring by hand), rewrite rules in the backend (drift risk), microservices (premature).
