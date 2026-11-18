/**
 * domain/import-classify.js
 * Responsibility: decides what a raw entry of a statement is: a balance line (dropped), an income,
 * an expense, or something that must NOT become income/expense on its own (card bill payment,
 * transfer between own accounts, refund). A transfer between the user's own accounts has its own type: it
 * is kept apart (domain/transfers.js) so the other side can be recognised in the other bank's statement. Also reads installments ("PARC 03/10") and suggests a
 * category for the obvious cases (fees, salary). Pure rules over text; never touches the data.
 */
import { normalizeText } from '../core/text-normalize.js';
import { mentionsOwnName } from './own-names.js';
export const IMPORT_TYPE={expense:'despesa',income:'receita',contribution:'aporte',ownTransfer:'transferencia',ignore:'ignorar'};
export const IGNORE_REASON={invoicePayment:'pagamento_fatura',transfer:'transferencia',refund:'estorno',redemption:'resgate',yield:'rendimento'};
export const REASON_TEXT={
  pagamento_fatura:'Pagamento de fatura: já está nas compras do cartão. Registre em “Pagar fatura” para não contar duas vezes.',
  transferencia:'Parece movimentação entre suas contas ou investimento, não é receita nem despesa.',
  estorno:'Estorno ou crédito no cartão: o app não tem lançamento negativo. Registre como receita só se quiser.',
  resgate:'Resgate ou saída do investimento: não é gasto nem receita. O saldo se atualiza na aba Patrimônio.',
  rendimento:'Rendimento, imposto ou taxa do investimento: já está no saldo, não é um lançamento.'};
export const FLAG_TEXT={
  'maybe-transfer':'Pix/TED/transferência: confirme se é gasto ou renda de verdade e não uma transferência sua.',
  'installment-unsure':'Parece uma parcela, mas o texto não diz “parcela”. Confirme.',
  'check-aporte':'Parece um aporte (dinheiro indo para um investimento). Escolha o investimento de destino ou mude o tipo.',
  'sign-guess':'O PDF não mostra se é entrada ou saída: deduzi pelo texto. Confirme.',
  'two-amounts':'A linha do PDF tinha dois valores: usei o primeiro (o segundo costuma ser o saldo).',
  'transfer-pair':'O outro lado desta transferência parece já estar salvo como receita ou despesa.'};
export const OWN_TRANSFER_TEXT='Transferência entre suas contas: não é receita nem despesa. Fica guardada para o app reconhecer o outro lado quando você importar o outro banco.';
const BALANCE=/^(saldo|total|subtotal|sub total)\b|\bsaldo (anterior|final|inicial|do dia|disponivel|parcial|em conta|total)\b/;
const INVOICE_PAYMENT=/\b(pagamento (de )?fatura|pgto fatura|pag fatura|pagto fatura|pagamento recebido|pagamento efetuado|pagamento on ?line|fatura cartao|pagamento cartao|pagto cartao|credito pagamento|pagamento da fatura)\b/;
const OWN_TRANSFER=/\b(transferencia entre contas|transf(erencia)? (entre )?contas|mesma titularidade|poupanca)\b/;
const INVEST_WORDS=/\b(rentab|rentabilidade|aplicacao|aplic automatica|aplic financeira|investimento|rdb|cdb|lci|lca|tesouro|caixinha|cofrinho|aporte)\b/;
const REDEMPTION=/\b(resgate|saque|retirada)\b/;
const YIELD_OR_TAX=/\b(rendimentos?|juros|dividendos?|jcp|cupom|bonificacao|ir|iof|imposto|taxa|custodia)\b/;
const MAYBE_TRANSFER=/\b(pix|ted|doc|transferencia|transf)\b/;
export const looksLikeTransfer=desc=>MAYBE_TRANSFER.test(normalizeText(desc));
const REFUND=/\b(estorno|reembolso|devolucao|cancelamento)\b/;
const FEES=/\b(tarifa|juros|iof|anuidade|multa|encargos|mora)\b/;
export const SALARY_WORDS=/\b(salario|folha de pagamento|folha pgto|proventos|vencimentos|pagto salario)\b/;
export const isBalanceLine=desc=>BALANCE.test(normalizeText(desc));
// "PARC 03/10", "parcela 3 de 10" (sure) or a bare "03/10" at the end (unsure). Returns {n, of, sure} or null
export function parseInstallment(desc){
  const s=String(desc||'').toLowerCase();
  let m=s.match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de|-)\s*(\d{1,2})/);
  if(m&&+m[1]>=1&&+m[1]<=+m[2]&&+m[2]<=60)return {n:+m[1],of:+m[2],sure:true};
  m=s.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})\s*$/);
  if(m&&+m[1]>=1&&+m[1]<=+m[2]&&+m[2]>=2&&+m[2]<=24)return {n:+m[1],of:+m[2],sure:false};
  return null;
}
// flow: 'out' (money left) | 'in' (money came), decided by the reader from the sign convention of the file.
// kind: 'bank' | 'card' | 'invest'. ctx.ownNames: the user's names (a Pix to or from them is an own transfer).
// Returns {drop:true} or {type, reason, flags, cat, installment}
export function classifyEntry(entry,flow,kind,ctx){
  const n=normalizeText(entry.desc);
  if(BALANCE.test(n))return {drop:true};
  const r={type:flow==='out'?IMPORT_TYPE.expense:IMPORT_TYPE.income,reason:null,flags:[],cat:'',installment:parseInstallment(entry.desc)};
  if(INVOICE_PAYMENT.test(n)){r.type=IMPORT_TYPE.ignore;r.reason=IGNORE_REASON.invoicePayment;return r;}
  if(kind==='invest'){ // statement of an investment: money in is a contribution; the rest is not a transaction of the app
    const ignore=reason=>{r.type=IMPORT_TYPE.ignore;r.reason=reason;return r;};
    if(flow==='out'||REDEMPTION.test(n))return ignore(IGNORE_REASON.redemption);
    if(YIELD_OR_TAX.test(n))return ignore(IGNORE_REASON.yield);
    r.type=IMPORT_TYPE.contribution;return r;
  }
  if(OWN_TRANSFER.test(n)&&kind==='bank'){r.type=IMPORT_TYPE.ownTransfer;return r;}
  if(OWN_TRANSFER.test(n)||(flow==='in'&&(REDEMPTION.test(n)||(INVEST_WORDS.test(n)&&kind==='bank')))){r.type=IMPORT_TYPE.ignore;r.reason=IGNORE_REASON.transfer;return r;}
  if(flow==='out'&&kind==='bank'&&INVEST_WORDS.test(n)){r.type=IMPORT_TYPE.contribution;r.flags.push('check-aporte');return r;}
  // a salary credited in the user's name is still income ("TED CONTA SALARIO MARIA SOUZA")
  if(kind==='bank'&&!SALARY_WORDS.test(n)&&mentionsOwnName(entry.desc,(ctx||{}).ownNames)){r.type=IMPORT_TYPE.ownTransfer;return r;}
  if(kind==='card'&&flow==='in'){r.type=IMPORT_TYPE.ignore;r.reason=IGNORE_REASON.refund;return r;}
  if(REFUND.test(n)&&flow==='in'){r.type=IMPORT_TYPE.ignore;r.reason=IGNORE_REASON.refund;return r;}
  if(MAYBE_TRANSFER.test(n)&&kind==='bank')r.flags.push('maybe-transfer');
  if(r.installment&&!r.installment.sure)r.flags.push('installment-unsure');
  if(r.type===IMPORT_TYPE.expense&&FEES.test(n))r.cat='Tarifas bancárias e juros';
  if(r.type===IMPORT_TYPE.income&&SALARY_WORDS.test(n))r.cat='Salário';
  return r;
}
