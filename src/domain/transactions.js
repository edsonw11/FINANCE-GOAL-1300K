/**
 * domain/transactions.js
 * Responsibility: Transaction queries: by month/type, contributions, category parts, future series.
 */
const txIn=(m,type,upto)=>S.tx.filter(t=>t.type===type&&mOf(t.date)===m&&(!upto||t.date<=upto));
const contributionsInMonth=m=>sum(txIn(m,'aporte',asOf(m)).map(t=>t.value));
// category parts of a transaction: the informed splits + the remainder in the main category
const catParts=t=>{const ex=t.splits||[];const rest=t.value-sum(ex.map(s=>s.value));return ex.concat(rest>0.004?[{cat:t.cat,value:rest}]:[]);};
// "equal" future transactions (same Repeat series; for old ones, same data)
const futureSiblings=t=>{
  if(t.type==='fatura')return [];
  if(t.serie)return S.tx.filter(x=>x.serie===t.serie&&x.id!==t.id&&x.date>t.date);
  return S.tx.filter(x=>x.id!==t.id&&!x.serie&&x.type===t.type&&x.date>t.date&&mOf(x.date)!==mOf(t.date)&&x.cat===t.cat&&(x.desc||'')===(t.desc||'')&&(x.fonte||'')===(t.fonte||'')&&(x.acc||'')===(t.acc||'')&&Math.abs(x.value-t.value)<0.005);
};
