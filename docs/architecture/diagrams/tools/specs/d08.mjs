/**
 * specs/d08.mjs
 * Responsibility: diagram 08, the report pipeline: how the monthly report is built and where it ends (the browser prints it; there is no server-side PDF).
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '08-report-generation',
  pages: [{
    name: 'In the browser', slug: 'browser',
    title: 'Everfox: Pipeline of the Monthly Report',
    subtitle: 'Built in the page from the state; the PDF is made by the browser\'s own print dialog (Save as PDF). The same data can be asked of the API (second page).',
    lanes: [
      lane('s1', '1. Ask', 'api', [
        n('r-btn', 'Print button', 'The person prints the month on screen.', 'src/ui/views/settings.js', 'bindSettings'),
        n('r-mail', 'E-mail button', 'Opens the mail program with a subject and a short text.', 'src/ui/views/report-print.js', 'reportMailUrl'),
      ]),
      lane('s2', '2. Compute', 'dom', [
        n('r-build', 'buildReport', 'Every number of the report in one place: month result, last 6 months, biggest groups and expenses, goal.', 'src/domain/report.js', 'buildReport'),
      ]),
      lane('s3', '3. Write the content', 'svc', [
        n('r-html', 'reportHtml', 'The page of the report in plain language.', 'src/ui/views/report-html.js', 'reportHtml'),
        n('r-fill', 'renderReport', 'Fills the print-only box of the page.', 'src/ui/views/report-print.js', 'renderReport'),
        n('r-text', 'reportText', 'The short text for the e-mail.', 'src/ui/views/report-text.js', 'reportMailUrl'),
      ]),
      lane('s4', '4. Deliver', 'out', [
        n('r-css', 'Print styles', 'Only the report is shown when printing.', 'src/styles/10-print.css', undefined),
        n('r-pdf', 'Browser print dialog', 'The person saves it as a PDF or prints it. The app does not write a PDF file itself.', 'src/ui/views/report-print.js', 'renderReport'),
      ]),
    ],
    edges: [
      e('r-btn', 'r-build'),
      e('r-mail', 'r-build'),
      e('r-build', 'r-html'),
      e('r-html', 'r-fill'),
      e('r-build', 'r-text', 'e-mail'),
      e('r-fill', 'r-css'),
      e('r-css', 'r-pdf'),
    ],
  }, {
    name: 'On the API', slug: 'api',
    title: 'Everfox: Monthly Report on the API (Pro)',
    subtitle: 'JSON only. A Pro feature: a person on a plan without report.monthly gets 403 feature_locked.',
    lanes: [
      lane('s1', '1. Request', 'api', [
        n('q-route', 'GET /api/v1/months/:month/report', 'Month as yyyy-mm; optional today=yyyy-mm-dd for a person whose day differs from the server\'s.', 'backend/src/legacy/months.controller.ts', 'report'),
      ]),
      lane('s2', '2. Check', 'dec', [
        n('q-guard', 'FeatureGuard', 'The plan must have report.monthly, read from the database on every call.', 'backend/src/plans/guards.ts', 'FeatureGuard', 'IMPLEMENTED', 'dec'),
      ]),
      lane('s3', '3. Compute', 'dom', [
        n('q-rules', 'FinanceRulesService.compute', 'Loads the stored state, completes it from the blank state, runs the shared buildReport. Nothing is saved.', 'backend/src/legacy/finance-rules.service.ts', 'compute'),
      ]),
      lane('s4', '4. Answer', 'out', [
        n('q-json', 'Report data (JSON)', 'The same numbers the page prints; no file is generated.', 'src/domain/report.js', 'buildReport'),
      ]),
    ],
    edges: [
      e('q-route', 'q-guard'),
      e('q-guard', 'q-rules', 'allowed'),
      e('q-rules', 'q-json'),
    ],
  }],
};
