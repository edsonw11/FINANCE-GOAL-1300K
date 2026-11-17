/**
 * ui/invoice-name.js
 * Responsibility: the one name of a card invoice used on every screen: "Fatura de dez/26",
 * named after the month it is due (the same invoice has the same name in Resumo, Cartão and Pagar fatura).
 */
import { formatDateBR, mShort } from '../core/dates.js';
import { dueDateOf } from '../domain/card-cycle.js';
export const invoiceName=fm=>'Fatura de '+mShort(fm);
export const invoiceNameDue=fm=>invoiceName(fm)+' · vence '+formatDateBR(dueDateOf(fm));
