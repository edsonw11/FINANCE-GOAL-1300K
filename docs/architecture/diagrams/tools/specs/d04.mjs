/**
 * specs/d04.mjs
 * Responsibility: diagram 04, the end-to-end flows: add an expense, import a bank file, one sync run. Only steps found in the code.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '04-end-to-end-flow',
  pages: [{
    name: 'Add an expense', slug: 'add-expense',
    title: 'Everfox: Flow of Adding an Expense',
    subtitle: 'From the + button to the new number on the Summary. Nothing leaves the device in this flow.',
    lanes: [
      lane('s1', '1. Open', 'api', [n('a-open', 'Open the form', 'The + button opens the form in a sheet; the date starts as today.', 'src/ui/views/item-dialog.js', 'openItem')]),
      lane('s2', '2. Fill', 'api', [
        n('a-fill', 'Fill the form', 'Value, date, category, account. Optional help: a short sentence fills the form (nothing is saved until Salvar), and a past description offers its category (never applied alone).', 'src/domain/quick-entry.js', 'parseQuickEntry'),
      ]),
      lane('s3', '3. Validate', 'dec', [
        n('a-valid', 'Valid?', 'Value above zero, a date, a destination for an aporte, splits not above the total.', 'src/domain/transaction-builder.js', 'validateTransaction', 'IMPLEMENTED', 'dec'),
        n('a-err', 'Message under the field', 'The form stays open with what was typed.', 'src/ui/components/field-error.js', undefined, 'IMPLEMENTED', 'err'),
      ]),
      lane('s4', '4. Save', 'dom', [
        n('a-build', 'Build the record', 'Copies the form into a transaction; a monthly series or an edit with future siblings.', 'src/domain/transaction-builder.js', 'saveTransaction'),
        n('a-tx', 'transact()', 'Runs the change and saves; if saving fails the change is undone.', 'src/domain/store.js', 'transact'),
      ]),
      lane('s5', '5. React', 'out', [
        n('a-render', 'Redraw', 'render() redraws the screens from the new state.', 'src/ui/render.js', 'render'),
        n('a-budget', 'Budget warning', 'Saving an expense over its group budget warns.', 'src/domain/budgets.js', 'budgetAlerts'),
        n('a-undo', 'Toast with Desfazer', 'The record can be brought back.', 'src/ui/toast.js', 'toast'),
      ]),
    ],
    edges: [
      e('a-open', 'a-fill'),
      e('a-fill', 'a-valid', 'Salvar'),
      e('a-valid', 'a-err', 'no', { kind: 'err' }),
      e('a-valid', 'a-build', 'yes'),
      e('a-build', 'a-tx'),
      e('a-tx', 'a-render', 'saved'),
      e('a-render', 'a-budget'),
      e('a-budget', 'a-undo'),
    ],
  }, {
    name: 'Import a bank file', slug: 'import',
    title: 'Everfox: Flow of Importing a Bank File',
    subtitle: 'OFX, CSV or digital PDF becomes drafts the person reviews; only the confirmation writes to the state.',
    lanes: [
      lane('s1', '1. Pick the file', 'api', [
        n('i-pick', 'Choose a file', 'The file input of the Importar panel.', 'src/ui/views/import-load.js', 'loadImportFile'),
        n('i-lim', 'Size and type checks', 'Up to 2 MB (PDF 10 MB, 40 pages, 3000 entries); csv, ofx, qfx, txt, pdf only.', 'src/domain/import-reader.js', 'IMPORT_LIMITS'),
      ]),
      lane('s2', '2. Read', 'dom', [
        n('i-pdf', 'PDF text', 'pdf.js (a vendored copy) extracts the text of a digital PDF; photos and scans are refused.', 'src/ui/views/pdf-text.js', 'pdfText'),
        n('i-read', 'Choose the reader by content', 'OFX, CSV or PDF statement / card invoice become raw entries.', 'src/domain/import-reader.js', 'readImportFile'),
      ]),
      lane('s3', '3. Classify', 'dom', [
        n('i-class', 'What is each entry?', 'Balance lines dropped; income, expense, own transfer, aporte, or ignore (invoice payment, refund, redemption, yield).', 'src/domain/import-classify.js', 'IMPORT_TYPE'),
        n('i-dup', 'Possible duplicates', 'Marks drafts that may already exist.', 'src/domain/import-duplicates.js', 'markDuplicates'),
      ]),
      lane('s4', '4. Review', 'api', [
        n('i-review', 'Review screen', 'Edit a row, remove one, divide across categories, select or deselect.', 'src/ui/views/import-review.js', 'reviewHtml'),
        n('i-ok', 'Confirm?', 'The confirmation shows the totals first.', 'src/ui/views/import-confirm.js', undefined, 'IMPLEMENTED', 'dec'),
      ]),
      lane('s5', '5. Commit', 'out', [
        n('i-commit', 'commitImport', 'The only place where reviewed drafts become transactions, inside transact().', 'src/domain/import-commit.js', 'commitImport'),
        n('i-res', 'Result per item', 'Saved, skipped and kept-unsaved items are listed; the same file again adds nothing.', 'src/ui/views/import-result.js', undefined),
      ]),
    ],
    edges: [
      e('i-pick', 'i-lim'),
      e('i-lim', 'i-pdf', 'pdf'),
      e('i-pdf', 'i-read'),
      e('i-read', 'i-class'),
      e('i-class', 'i-dup'),
      e('i-dup', 'i-review'),
      e('i-review', 'i-ok'),
      e('i-ok', 'i-commit', 'yes'),
      e('i-commit', 'i-res'),
    ],
  }, {
    name: 'One sync run', slug: 'sync-run',
    title: 'Everfox: Flow of One Sync Run (web app)',
    subtitle: 'Offline first: the outbox keeps what was not confirmed. Not part of the Android app yet.',
    lanes: [
      lane('s1', '1. A change is saved', 'api', [n('y-save', 'Saved state', 'Every save tells its listeners.', 'src/domain/store.js', 'onSave')]),
      lane('s2', '2. Queue', 'dom', [
        n('y-split', 'Split into records', 'The state is split like the server does, each record with a fingerprint.', 'src/sync/records.js', 'splitState'),
        n('y-queue', 'Outbox entries', 'Only what changed since the last run becomes an entry.', 'src/sync/outbox.js', 'queueChanges'),
      ]),
      lane('s3', '3. Push', 'svc', [
        n('y-push', 'Send in batches of 100', 'POST /api/v1/sync/push; entries are marked as attempted first.', 'src/sync/runner.js', 'BATCH'),
        n('y-rej', 'Rejected?', 'A rejected mutation goes to the review list; the batch stops there.', 'src/sync/runner.js', 'review', 'IMPLEMENTED', 'dec'),
      ]),
      lane('s4', '4. Pull', 'svc', [
        n('y-pull', 'Ask for changes after the cursor', 'GET /api/v1/sync/changes, page by page until no more.', 'src/sync/api-client.js', 'createApiClient'),
        n('y-apply', 'Merge into the state', 'applyChanges puts them in without echoing them back.', 'src/sync/apply.js', 'applyChanges'),
      ]),
      lane('s5', '5. Failure', 'err', [
        n('y-fail', 'offline, unauthorized or server', 'During the push or the pull. The outbox stays as it is; the person sees the state on the sync card.', 'src/ui/views/sync-view.js', 'renderSync'),
      ]),
    ],
    edges: [
      e('y-save', 'y-split'),
      e('y-split', 'y-queue'),
      e('y-queue', 'y-push'),
      e('y-push', 'y-rej'),
      e('y-rej', 'y-pull', 'no / handled'),
      e('y-pull', 'y-apply'),
      e('y-pull', 'y-fail', 'any step fails', { kind: 'err', dashed: true }),
    ],
  }],
};
