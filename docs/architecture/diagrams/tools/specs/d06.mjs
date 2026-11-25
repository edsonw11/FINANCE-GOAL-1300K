/**
 * specs/d06.mjs
 * Responsibility: diagram 06, integrations and data sources: what talks to what outside the code base, and what was searched for and not found.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '06-external-integrations',
  pages: [{
    title: 'Everfox: Integrations and Data Sources',
    subtitle: 'The app itself calls no third-party service. The API calls one identity provider and one database. Prices, balances and market data are typed or imported from files.',
    lanes: [
      lane('who', 'Who calls', 'svc', [
        n('w-oidc', 'OpenIdClientProvider', 'At login (authorization request, code exchange) and logout (end-session address). Errors: a failed start answers 503; a failed callback ends in the login-failed page; a missing end-session address is null, logout still works.', 'backend/src/auth/openid-client.provider.ts', 'OpenIdClientProvider'),
        n('w-prisma', 'PrismaService', 'Every request that reads or writes data. Connects on first use, so the API can start before the database. Ready check has a timeout.', 'backend/src/database/prisma.service.ts', 'PrismaService'),
        n('w-share', 'shareTextFile and AppLockPlugin', 'Android only: share sheet (backup file) and BiometricPrompt (app lock). A cancelled sheet or prompt is an answer, not an error.', 'src/ui/native-bridge.js', 'shareTextFile'),
        n('w-tg', 'Telegram APK service', 'Developer tool, not part of the app: sends the debug APK to a chat. Token only from an ignored .env; errors never print it.', 'services/telegram-apk/lib/telegram.mjs', 'createTelegram'),
        n('w-pdf', 'pdf.js (vendored copy)', 'Reads the text of a PDF in the page, from a local file; no network.', 'src/ui/views/pdf-text.js', 'pdfText'),
      ], { col: 0 }),
      lane('ext', 'External system or platform', 'ext', [
        n('x-kc', 'Keycloak (OIDC)', 'Identity provider. Local: Docker Compose, development realm. Endpoint comes from OIDC_ISSUER.', 'docker-compose.yml', 'keycloak:'),
        n('x-pg', 'PostgreSQL 18', 'The only database. Local: Docker Compose, port 5433 on the host. Limits: one instance, no hosted copy yet.', 'docker-compose.yml', 'postgres:'),
        n('x-and', 'Android system', 'BiometricPrompt (fingerprint, face or phone PIN), share sheet, file cache.', 'android/app/src/main/java/com/everfox/app/AppLockPlugin.java', 'AppLockPlugin'),
        n('x-tg', 'Telegram Bot API', 'api.telegram.org: getMe, getChat, sendMessage, sendDocument (50 MB limit).', 'services/telegram-apk/lib/telegram.mjs', 'DEFAULT_API'),
        n('x-pdfjs', 'No network', 'The PDF library ships inside the repository.', 'vendor/pdfjs/pdf.min.mjs', undefined),
      ], { col: 1 }),
      lane('none', 'Searched and not found', 'err', [
        n('z-mkt', 'Market data and prices', 'No call to any price, quote or fundamentals service in src, backend, services or scripts.', undefined, undefined, 'NOT IDENTIFIED'),
        n('z-brk', 'Brokers, OpLab, Bolsai, Open Finance, Tesouro Direto', 'No code or configuration refers to them. Investments are typed, or read from files (OFX, CSV, PDF, B3 brokerage notes).', undefined, undefined, 'NOT IDENTIFIED'),
        n('z-pay', 'Payments and billing', 'Plans exist as data and a guard; there is no payment provider.', 'backend/src/plans/features.ts', 'FEATURES', 'PARTIAL'),
      ], { col: 2 }),
    ],
    edges: [
      e('w-oidc', 'x-kc', 'OIDC', { kind: 'ext' }),
      e('w-prisma', 'x-pg', 'Prisma'),
      e('w-share', 'x-and', 'Capacitor plugins', { kind: 'ext' }),
      e('w-tg', 'x-tg', 'HTTPS multipart', { kind: 'ext' }),
      e('w-pdf', 'x-pdfjs', 'local file', { dashed: true }),
    ],
    notes: ['GitHub Actions (.github/workflows/ci.yml) runs the checks and builds the debug APK; it is not called by the running app.'],
  }],
};
