/** Brazilian dates and money amounts as bank files write them, and the text helpers used to match descriptions. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('import-values');
  const d=(t,ref)=>run(`parseBrDate(${JSON.stringify(t)},${JSON.stringify(ref||'2026-11-10')})`);
  const a=t=>run(`parseAmount(${JSON.stringify(t)})`);
  // dates
  eq('dd/mm/yyyy',d('05/11/2026'),'2026-11-05');
  eq('dd/mm/yy',d('05/11/26'),'2026-11-05');
  eq('dd-mm-yyyy and dd.mm.yyyy',[d('05-11-2026'),d('05.11.2026')],['2026-11-05','2026-11-05']);
  eq('ISO',d('2026-11-05'),'2026-11-05');
  eq('ISO with time keeps the written day',d('2026-11-05T23:59:00-03:00'),'2026-11-05');
  eq('OFX yyyymmdd',d('20261105'),'2026-11-05');
  eq('OFX with time and zone keeps the written day',d('20261105235959[-3:BRT]'),'2026-11-05');
  eq('no year: this year when not in the future',d('05/11','2026-11-10'),'2026-11-05');
  eq('no year: a future date means last year',d('25/12','2026-11-10'),'2025-12-25');
  eq('29/02 only in leap years',[d('29/02/2028'),d('29/02/2027')],['2028-02-29',null]);
  eq('invalid dates',[d('32/01/2026'),d('31/04/2026'),d('abc'),d(''),d('13/13/2026')],[null,null,null,null,null]);
  // money
  eq('R$ 1.234,56',a('R$ 1.234,56'),1234.56);
  eq('plain comma decimal',a('12,5'),12.5);
  eq('dot decimal',a('12.50'),12.5);
  eq('dot thousands only',a('1.234'),1234);
  eq('US format',a('1,234.56'),1234.56);
  eq('negative: leading minus',a('-12,50'),-12.5);
  eq('negative: minus after R$',a('R$ -12,50'),-12.5);
  eq('negative: trailing minus',a('12,50-'),-12.5);
  eq('negative: parentheses',a('(12,50)'),-12.5);
  eq('trailing D is a debit, C a credit',[a('12,50 D'),a('12,50 C')],[-12.5,12.5]);
  eq('millions',a('1.234.567,89'),1234567.89);
  eq('not an amount',[a(''),a('abc'),a('R$')],[null,null,null]);
  // text
  eq('normalizeText removes accents and punctuation',run("normalizeText('  Padaria São-João, Ltda. ')"),'padaria sao joao ltda');
  eq('descriptionKey keeps the merchant, drops the noise',run("descriptionKey('COMPRA NO DEBITO - MERCADO EXTRA 1234')"),'mercado extra');
  eq('the key keeps at most three words',run("descriptionKey('Mercado Extra')===descriptionKey('MERCADO EXTRA 998 SAO PAULO')"),false);
  eq('textHash is stable and differs',run("[textHash('a')===textHash('a'),textHash('a')===textHash('b'),textHash('a').length]"),[true,false,16]);
  return res;};
