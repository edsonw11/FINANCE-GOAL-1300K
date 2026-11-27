/**
 * ui/invoice-name.js
 * Responsibility: the one name of a card invoice used on every screen: "Fatura de dez/26",
 * named after the month it is due (the same invoice has the same name in Resumo, Cartão and Pagar fatura).
 */
import { t } from '../core/i18n.js';
import { formatDateBR, mShort } from '../core/dates.js';
import { dueDateOf } from '../domain/card-cycle.js';
export const invoiceName=fm=>t('tx.invoice.name',{month:mShort(fm)});
export const invoiceNameDue=fm=>t('tx.invoice.nameDue',{name:invoiceName(fm),date:formatDateBR(dueDateOf(fm))});
