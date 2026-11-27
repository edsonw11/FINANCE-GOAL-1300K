/**
 * domain/quick-entry.js
 * Responsibility: understands a short Portuguese sentence ("Gastei 85,90 no mercado hoje",
 * "Recebi 5.000 de salário dia 5", "Paguei 230 de internet no cartão", "Aporte de 1.000 no
 * Tesouro Selic em 10/11") with fixed rules, no AI. Returns what it understood and what is still
 * missing; it never invents an account, category, date or value. The result only fills the form.
 */
import { tt } from '../core/i18n.js';
import { addDay, daysInMonth, pad2 } from '../core/dates.js';
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { normalizeText } from '../core/text-normalize.js';
import { m2 } from '../core/format.js';
import { S } from './store.js';
import { active } from './accounts.js';
import { suggestFromHistory } from './import-history.js';
const VERBS={gastei:'despesa',paguei:'despesa',comprei:'despesa',gasto:'despesa',despesa:'despesa',recebi:'receita',ganhei:'receita',receita:'receita',recebimento:'receita',entrou:'receita',aporte:'aporte',aportei:'aporte',investi:'aporte'};
const TYPE_WORD={despesa:'tx.quick.typeExpense',receita:'tx.quick.typeIncome',aporte:'tx.quick.typeContribution'};
const DAY_WORDS={hoje:0,ontem:-1,anteontem:-2};
const SOURCES={cartao:'cartao',credito:'cartao',pix:'caixa',dinheiro:'caixa',debito:'caixa',vr:'beneficio',va:'beneficio'};
const FILLER=new Set(['de','do','da','dos','das','no','na','nos','nas','em','com','o','a','os','as','um','uma','para','pra','por','reais','real','e','r$']);
const isMoneyToken=t=>/^(r\$)?\d[\d.,]*$/i.test(t);
const hasSeparator=t=>/[.,]/.test(t)||/^r\$/i.test(t);
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
function pickCategory(desc,type){
  const nd=normalizeText(desc);if(!nd)return null;
  const cats=((S.cats||{})[type]||[]).filter(c=>!c.off).map(c=>({name:c.name,n:normalizeText(c.name)}));
  const hit=cats.filter(c=>c.n===nd||(' '+nd+' ').includes(' '+c.n+' ')).sort((a,b)=>b.n.length-a.n.length)[0];
  return hit?{cat:hit.name,from:'catalog'}:null;
}
function matchAccounts(words){
  const w=words.map(normalizeText).filter(Boolean);if(!w.length)return [];
  return active().filter(a=>{const n=normalizeText(a.name);return w.every(x=>n.includes(x))||n.includes(w.join(' '));});
}
// now: today's ISO date. Returns {type, value, date, desc, cat, fonte, acc, missing[], notes[], summary}
export function parseQuickEntry(text,now){
  const tokens=String(text||'').trim().split(/\s+/).filter(Boolean).map(t=>t.replace(/[.,;!?]+$/,'')),r={type:null,value:0,date:now,desc:'',cat:'',fonte:'',acc:'',missing:[],notes:[],summary:''};
  const used=new Set(),year=now.slice(0,4),noRollback=year+'-12-31';
  const norm=tokens.map(normalizeText);
  tokens.forEach((t,i)=>{const n=norm[i];
    if(VERBS[n]&&!r.type){r.type=VERBS[n];used.add(i);}
    else if(n in DAY_WORDS){r.date=addDay(now,DAY_WORDS[n]);used.add(i);}
    else if(/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(t)){const d=parseBrDate(t,noRollback);if(d){r.date=d;used.add(i);}else{r.missing.push('date');r.notes.push(tt('tx.quick.noDate',{text:t}));used.add(i);}}
    else if(n==='dia'&&i+1<tokens.length&&/^\d{1,2}$/.test(tokens[i+1])){
      const d=+tokens[i+1];used.add(i);used.add(i+1);
      if(d>=1&&d<=daysInMonth(+year,+now.slice(5,7)-1))r.date=now.slice(0,8)+pad2(d);else{r.missing.push('date');r.notes.push(tt('tx.quick.noDay',{day:d}));}}
    else if(SOURCES[n]){r.fonte=SOURCES[n];used.add(i);
      if(n==='cartao'&&i+1<tokens.length&&!FILLER.has(norm[i+1])&&!VERBS[norm[i+1]]&&!isMoneyToken(tokens[i+1])&&!(norm[i+1] in DAY_WORDS)&&norm[i+1]!=='dia'&&!/\//.test(tokens[i+1])){r.notes.push(tt('tx.quick.cardNote',{name:tokens[i+1]}));used.add(i+1);}}
  });
  tokens.forEach((t,i)=>{if(/^r\$$/i.test(t))used.add(i);}); // a lone "R$" is just the currency mark
  // value: prefer a number with R$ or separators; else the first plain number (not after "dia")
  const cands=tokens.map((t,i)=>({t,i})).filter(({t,i})=>!used.has(i)&&isMoneyToken(t)&&!(i>0&&norm[i-1]==='dia'));
  const pick=cands.find(c=>hasSeparator(c.t))||cands[0],v=pick?parseAmount(pick.t):null;
  if(v&&v>0){r.value=v;used.add(pick.i);if(cands.length>1)r.notes.push(tt('tx.quick.manyNumbers',{value:pick.t}));}
  // what is left is the description; "de/no/em..." are dropped only at its edges ("Feira do bairro" keeps its "do")
  const left=tokens.map((t,i)=>({t,n:norm[i],i})).filter(x=>!used.has(x.i));
  while(left.length&&FILLER.has(left[0].n))left.shift();
  while(left.length&&FILLER.has(left[left.length-1].n))left.pop();
  const leftWords=left.map(x=>x.t);
  if(!r.type){r.type='despesa';r.missing.push('type');r.notes.push(tt('tx.quick.noType'));}
  if(!r.value)r.missing.push('value');
  if(r.type==='aporte'){
    const c=matchAccounts(leftWords.filter((w,k)=>!FILLER.has(left[k].n)));
    if(c.length===1)r.acc=c[0].id;
    else{r.missing.push('acc');r.notes.push(c.length?tt('tx.quick.which',{names:c.map(a=>a.name).join(tt('tx.quick.listOr'))}):tt('tx.quick.noAccount'));}
  }else{
    r.desc=cap(leftWords.join(' '));
    const byName=pickCategory(r.desc,r.type);
    const hist=!byName?suggestFromHistory(r.desc,r.type):null;
    if(byName)r.cat=byName.cat;
    else if(hist&&hist.exact){r.cat=hist.cat;r.notes.push(tt('tx.quick.histCat',{cat:hist.cat}));}
    else{r.missing.push('cat');if(hist)r.notes.push(tt('tx.quick.histMaybe',{cat:hist.cat}));}
  }
  r.summary=[TYPE_WORD[r.type]?tt(TYPE_WORD[r.type]):r.type,r.value?m2(r.value):tt('tx.quick.noValue'),r.type==='aporte'?'':r.cat||r.desc,r.date===now?tt('tx.quick.today'):r.date.split('-').reverse().join('/')].filter(Boolean).join(' · ');
  return r;
}
