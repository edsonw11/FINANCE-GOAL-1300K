/**
 * specs/d01.mjs
 * Responsibility: diagram 01, the executive overview: what Everfox is, what goes in, what comes out.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '01-executive-overview',
  pages: [{
    title: 'Everfox: System Overview',
    subtitle: 'Personal finance app: follow a net-worth goal (default R$ 1,300,000), monthly cash flow, credit card invoices and investments. Works offline in the browser and in an Android app; cloud sync is optional (web only).',
    lanes: [
      lane('in', '1. Inputs', 'api', [
        n('in-manual', 'Manual entry', 'The + button form, or one short Portuguese sentence such as "Gastei 85,90 no mercado hoje".', 'src/domain/quick-entry.js', 'parseQuickEntry'),
        n('in-import', 'Bank files', 'OFX, CSV and digital PDF (statements and card invoices); B3 brokerage notes.', 'src/domain/import-reader.js', 'readImportFile'),
        n('in-backup', 'Backup file', 'A JSON file exported earlier is restored.', 'src/ui/views/backup.js', 'bindBackup'),
      ], { col: 0, row: 0 }),
      lane('app', '2. Everfox app (on the device)', 'dom', [
        n('app-rules', 'Rules', 'Month result, card invoices, goal projection, portfolio, budgets, emergency reserve.', 'src/domain/month-result.js', 'monthResult'),
        n('app-state', 'Local state', 'One JSON in the browser storage (key metaapp.v2) with an automatic copy of the previous day.', 'src/domain/store.js', 'transact'),
      ], { col: 1, row: 0 }),
      lane('out', '3. Outputs', 'out', [
        n('out-screens', 'Screens', 'Numbers, charts and lists: Summary, Lançamentos, Cartão, Patrimônio, Análise, Categorias, Ajustes.', 'src/ui/render.js', 'render'),
        n('out-report', 'Monthly report', 'Printed or saved as PDF by the browser, or sent as an e-mail summary.', 'src/ui/views/report-print.js', 'renderReport'),
        n('out-backup', 'Backup file', 'JSON saved by the browser, or shared through the Android share sheet.', 'src/ui/native-bridge.js', 'shareTextFile'),
        n('out-apk', 'Android app', 'The same app inside a Capacitor shell: offline, with an app lock (fingerprint or phone PIN).', 'android/app/src/main/java/com/everfox/app/MainActivity.java', 'MainActivity'),
      ], { col: 2, row: 0 }),
      lane('cloud', 'Optional cloud (web app only)', 'svc', [
        n('cl-sync', 'Sync client', 'Sends what changed offline, then pulls what changed elsewhere.', 'src/sync/runner.js', 'createSync'),
        n('cl-api', 'API (NestJS)', 'Login, sync, accounts, month rules, plans.', 'backend/src/create-app.ts', 'createApp'),
        n('cl-db', 'PostgreSQL', 'Records, user state, sessions, plans.', 'backend/prisma/schema.prisma', 'model Record', 'IMPLEMENTED', 'infra'),
      ], { col: 1, row: 1 }),
      lane('idp', 'Identity', 'ext', [
        n('cl-id', 'Keycloak (OIDC)', 'The identity provider that logs the person in.', 'backend/src/auth/openid-client.provider.ts', 'OpenIdClientProvider'),
      ], { col: 2, row: 1 }),
    ],
    edges: [
      e('in-manual', 'app-rules', 'validate and build'),
      e('in-import', 'app-rules', 'read, classify'),
      e('in-backup', 'app-state', 'restore'),
      e('app-rules', 'app-state', 'transact'),
      e('app-state', 'out-screens', 'render'),
      e('app-rules', 'out-report', 'report data'),
      e('app-state', 'cl-sync', 'optional', { dashed: true }),
      e('cl-sync', 'cl-api', 'HTTPS', { dashed: true }),
      e('cl-api', 'cl-db', 'Prisma'),
      e('cl-api', 'cl-id', 'OIDC', { kind: 'ext' }),
    ],
    notes: ['In the Android app the cloud part is switched off: the app keeps its data on the phone (ADR-0014). No market data, price or Open Finance service is called: balances and prices are typed or imported.'],
  }],
};
