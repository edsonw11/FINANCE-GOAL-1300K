# ADR-0002 · Frontend: keep the current web app, ship Android/iOS with Capacitor

Status: Accepted (2026-11-24)

## Context
The web UI (76 modules, responsive, validated on a phone, 65-step e2e test, baseline screenshots) is good; the brief forbids gratuitous redesign.

## Decision
- **Keep the vanilla ES-module UI.** No React rewrite. Add type checking (`tsc --checkJs`, extended to `src/ui` gradually) and an API client
  generated from the OpenAPI contract. The UI already talks only to domain commands, which is where the API client plugs in.
- **Capacitor** wraps the same web app for Android (right after Phase 1b) and iOS later (needs macOS/Xcode).
- Working product name **Everfox**; application id to be decided (placeholder `com.everfox.app`, not registered anywhere).

## Consequences
+ No visual/functional regression risk from a rewrite; one codebase for web and apps. − No component framework: discipline (tests, lint, module rules) replaces it.
Alternatives: React+TS+Vite (high cost, no user value now), React Native/Flutter (rewrites the UI twice).
