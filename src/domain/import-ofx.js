/**
 * domain/import-ofx.js
 * Responsibility: reads an OFX file (SGML 1.x with unclosed tags, or XML 2.x) into raw entries
 * {date, desc, amount, id, raw, line} plus whether it is a bank or a credit card statement.
 * Dates keep the calendar day written in the file (no timezone shift). Balances are not
 * transactions and are never read (only <STMTTRN> blocks are).
 */
import { parseBrDate } from '../core/import-values.js';
import { roundMoney } from '../core/money.js';
export const looksLikeOfx=t=>/^\s*OFXHEADER|<OFX[\s>]/i.test(String(t||'').slice(0,4000));
const decode=s=>s.replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const tag=(block,name)=>{const m=block.match(new RegExp('<'+name+'>([^<\\r\\n]*)','i'));return m?decode(m[1]):'';};
export function parseOfx(text){
  text=String(text||'');
  const kind=/<CCSTMTRS>|<CREDITCARDMSGSRS/i.test(text)?'card':'bank';
  const accountId=tag(text,'ACCTID'),entries=[],bad=[];
  const parts=text.split(/<STMTTRN>/i).slice(1);
  parts.forEach((p,i)=>{
    const block=p.split(/<\/STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>/i)[0];
    const date=parseBrDate(tag(block,'DTPOSTED')),parsed=parseFloat(tag(block,'TRNAMT').replace(',','.')),amount=roundMoney(parsed);
    if(!date||!isFinite(parsed)){bad.push(i+1);return;}
    if(amount===0)return; // nothing moved
    const name=tag(block,'NAME'),memo=tag(block,'MEMO'),desc=memo&&memo!==name?[name,memo].filter(Boolean).join(' - '):name;
    entries.push({date,desc,amount,id:tag(block,'FITID'),raw:[tag(block,'TRNTYPE'),tag(block,'DTPOSTED'),tag(block,'TRNAMT'),desc].filter(Boolean).join(' | '),line:i+1});
  });
  return {kind,accountId,entries,unreadable:bad.length,found:parts.length};
}
