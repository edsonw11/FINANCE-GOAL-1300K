/**
 * domain/demo-data.js
 * Responsibility: test data (Dec/2025 to Oct/2026) marked with demo:true, so it can be removed
 * without touching the user's real records. Deterministic (seeded random).
 */
import { mIdx, mKey } from '../core/dates.js';
import { S } from './store.js';
import { ensureCat } from './categories.js';
import { invalidateAllocation } from './card-invoices.js';
export const hasDemoData=()=>S.tx.some(t=>t.demo);
export function removeDemoData(){const n=S.tx.filter(t=>t.demo).length;S.tx=S.tx.filter(t=>!t.demo);invalidateAllocation();return n;}
export function addDemoData(){
  removeDemoData();
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const base=[['Moradia','Condomínio',685,0,5],['Internet','Internet',120,0,10],['Luz','Conta de luz',190,.25,15],['Mercado','Mercado',880,.18,8],['Mercado','Mercado',420,.3,22],
    ['Transporte','Combustível',260,.25,12],['Saúde','Plano e farmácia',340,.3,18],['Restaurantes','Restaurantes e delivery',300,.4,20],['Lazer','Lazer e passeios',240,.5,25],['Assinaturas','Streaming e apps',95,.05,3]];
  let n=0;
  for(let k=0;k<11;k++){const m=mKey(mIdx('2025-12')+k),g=1+k*0.012; // slow rise of ~1.2% per month
    base.forEach(([cat,desc,v,var_,day])=>{ensureCat('despesa',cat);
      const val=Math.round(v*(cat==='Moradia'||cat==='Internet'||cat==='Assinaturas'?(1+k*0.004):g)*(1+(rnd()*2-1)*var_)*100)/100;
      S.tx.push({id:S.nid++,type:'despesa',date:m+'-'+String(day).padStart(2,'0'),value:val,desc,cat,fonte:'caixa',demo:true});n++;});
    if(k===3||k===7){ensureCat('despesa','Imprevistos / Outros');S.tx.push({id:S.nid++,type:'despesa',date:m+'-27',value:Math.round((500+rnd()*700)*100)/100,desc:'Imprevisto (teste)',cat:'Imprevistos / Outros',fonte:'caixa',demo:true});n++;}}
  invalidateAllocation();
  return n;
}
