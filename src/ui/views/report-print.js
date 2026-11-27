/**
 * ui/views/report-print.js
 * Responsibility: the printed report (PDF). Fills the print-only box with the report of the month on screen
 * right before the browser prints (the "Imprimir / PDF" buttons and Ctrl+P alike), so it is never stale.
 * On screen the box is hidden; when printing it is the only thing shown (styles/10-print.css).
 * Also opens the mail program with the subject and a short text of the same report (a web page cannot attach
 * a file or send mail by itself, so the PDF is attached by the user).
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { today } from '../../core/dates.js';
import { buildReport } from '../../domain/report.js';
import { ui } from '../ui-state.js';
import { reportHtml } from './report-html.js';
import { reportMailUrl } from './report-text.js';
import { toast } from '../toast.js';
export function renderReport(){$('printReport').innerHTML=reportHtml(buildReport(ui.cur,today()));}
// a link clicked by code: the mail program opens without leaving the app
export function sendReportMail(){
  const a=document.createElement('a');a.href=reportMailUrl(buildReport(ui.cur,today()));document.body.appendChild(a);a.click();a.remove();
  toast(t('set.report.mailToast'));
}
export function bindReportPrint(){window.addEventListener('beforeprint',renderReport);const b=$('mailBtn');if(b)b.onclick=sendReportMail;}
