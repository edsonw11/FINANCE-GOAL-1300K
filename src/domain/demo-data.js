/**
 * domain/demo-data.js
 * Responsibility: test data (the last 12 months, ending now) marked with demo:true, so it can be removed
 * (all of it: records, trades, accounts it created) without touching the user's real records. Deterministic (seeded random).
 */
import { S } from './store.js';
import { ensureCat } from './categories.js';
import { addDemoExtras, demoDate, demoMonths } from './demo-extras.js';
import { invalidateAllocation } from './card-invoices.js';
export const hasDemoData=()=>S.tx.some(t=>t.demo)||(S.trades||[]).some(t=>t.demo);
// takes away EVERYTHING the test data created: records, trades, the accounts it made and their balances
export function removeDemoData(){
  const n=S.tx.filter(t=>t.demo).length;
  S.tx=S.tx.filter(t=>!t.demo);
  S.trades=(S.trades||[]).filter(t=>!t.demo);
  const gone=new Set(S.accounts.filter(a=>a.demo).map(a=>a.id));
  S.accounts=S.accounts.filter(a=>!a.demo);S.snaps=S.snaps.filter(s=>!gone.has(s.acc));
  invalidateAllocation();return n;
}
export function addDemoData(){
  removeDemoData();
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  /** @type {[string, string, number, number, number][]} */
  const base=[['Moradia','Condomínio',685,0,5],['Internet','Internet',120,0,10],['Luz','Conta de luz',190,.25,15],['Mercado','Mercado',880,.18,8],['Mercado','Mercado',420,.3,22],
    ['Transporte','Combustível',260,.25,12],['Saúde','Plano e farmácia',340,.3,18],['Restaurantes','Restaurantes e delivery',300,.4,20],['Lazer','Lazer e passeios',240,.5,25],['Assinaturas','Streaming e apps',95,.05,3]];
  demoMonths().forEach((m,k)=>{const g=1+k*0.012; // slow rise of ~1.2% per month
    base.forEach(([cat,desc,v,var_,day])=>{ensureCat('despesa',cat);
      const val=Math.round(v*(cat==='Moradia'||cat==='Internet'||cat==='Assinaturas'?(1+k*0.004):g)*(1+(rnd()*2-1)*var_)*100)/100;
      S.tx.push({id:S.nid++,type:'despesa',date:demoDate(m,day),value:val,desc,cat,fonte:'caixa',demo:true});});
    if(k===3||k===7){ensureCat('despesa','Imprevistos / Outros');S.tx.push({id:S.nid++,type:'despesa',date:demoDate(m,27),value:Math.round((500+rnd()*700)*100)/100,desc:'Imprevisto (teste)',cat:'Imprevistos / Outros',fonte:'caixa',demo:true});}});
  addDemoExtras();
  invalidateAllocation();
  return S.tx.filter(t=>t.demo).length;
}
