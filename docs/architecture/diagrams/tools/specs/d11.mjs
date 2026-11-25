/**
 * specs/d11.mjs
 * Responsibility: diagram 11, how the product is run and tested: entry points, ports, configuration names and commands.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '11-runtime-environment',
  pages: [{
    title: 'Everfox: Runtime and Environment',
    subtitle: 'Names of settings only; values and secrets are never written here.',
    lanes: [
      lane('web', 'Browser app', 'api', [
        n('e-src', 'Source, served by any static server', 'scripts/serve.sh serves the folder on port 8000; ES modules need http, not file://.', 'scripts/serve.sh', 'http.server'),
        n('e-dist', 'Single-file build', 'npm run build bundles src/ into dist/finance_goal_1300k.html (opens from file://) and dist/index.html.', 'tools/module-graph.cjs', 'moduleOrder'),
        n('e-test', 'Tests', 'npm run test:unit (plain Node), npm run test:e2e (headless Chrome smokes), npm run test:mobile (widths), npm run check (everything).', 'tests/run-unit.js', 'readdirSync'),
      ], { col: 0 }),
      lane('stack', 'Full local stack (Docker)', 'svc', [
        n('e-up', 'npm run dev:up', 'Starts db (127.0.0.1:5433), keycloak (8081), migrate, api (3000) and loads demo data.', 'scripts/dev.sh', 'up'),
        n('e-api', 'API entry point', 'backend/src/main.ts reads the environment once, builds the app and listens; shutdown on SIGTERM and SIGINT.', 'backend/src/main.ts', 'registerGracefulShutdown'),
        n('e-env', 'Settings (names)', 'DATABASE_URL, MIGRATE_DATABASE_URL, NODE_ENV, HOST, PORT, LOG_LEVEL, HEALTH_CHECK_TIMEOUT_MS, APP_BASE_URL, OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET.', 'backend/.env.example', 'DATABASE_URL'),
        n('e-be', 'Backend tests', 'npm test in backend/ with a real PostgreSQL and a real Keycloak (the CI job "backend").', 'backend/package.json', 'test'),
      ], { col: 1 }),
      lane('and', 'Android', 'infra', [
        n('e-apk', 'npm run mobile:apk', 'Builds the page for the shell (own CSP), copies it into android/, builds the debug APK. ANDROID_HOME defaults to ~/Android/Sdk.', 'scripts/mobile.sh', 'apk'),
        n('e-emu', 'Emulator tests', 'npm run mobile:test and mobile:test-lock drive the real app on a virtual phone with adb and the DevTools protocol.', 'scripts/device-test.mjs', 'step'),
        n('e-send', 'npm run apk:send -- --build', 'Builds, then asks before sending the APK to a Telegram chat.', 'services/telegram-apk/send-apk.mjs', 'main'),
      ], { col: 2 }),
    ],
    edges: [],
    notes: ['CI (.github/workflows/ci.yml) runs four jobs on every push: check, backend, stack, android.'],
  }],
};
