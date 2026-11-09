/**
 * domain/card-invoices.js
 * Responsibility: Invoices: which purchases belong to each invoice, undetailed amount, open invoices.
 */
// Each invoice automatically absorbs the card purchases already entered (oldest first, up to the invoice amount).
// If purchases are checked manually (items), that choice replaces the automatic one.
function alloc(){
  if(_al)return _al;
  const fs=S.tx.filter(t=>t.type==='fatura').sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),used=new Set(),map={};
  fs.forEach(f=>{if(f.items){map[f.id]=f.items.filter(id=>S.tx.some(x=>x.id===id));map[f.id].forEach(id=>used.add(id));}});
  fs.forEach(f=>{if(f.items)return;let acc=0;const arr=[];
    S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&!used.has(t.id)&&dueMonth(t.date)===invoiceMonthOf(f)).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id)
      .forEach(t=>{if(acc+t.value<=f.value+0.004){acc+=t.value;arr.push(t.id);used.add(t.id);}});
    map[f.id]=arr;});
  return _al={map,used};
}
const openCard=(upto,ex)=>{const {map,used}=alloc();const mine=new Set(ex?map[ex]||[]:[]);
  return S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&(!used.has(t.id)||mine.has(t.id))&&(!upto||t.date<=upto));};
const invoiceItems=t=>(alloc().map[t.id]||[]).map(id=>S.tx.find(x=>x.id===id)).filter(Boolean);
const invoiceUndetailed=t=>Math.max(0,t.value-sum(invoiceItems(t).map(x=>x.value)));
const undetailedInMonth=m=>sum(txIn(m,'fatura').map(invoiceUndetailed));
function payableInvoices(){
  const fms=new Set(S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao').map(t=>dueMonth(t.date)));
  return [...fms].sort().map(fm=>{const its=S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&dueMonth(t.date)===fm),
    total=sum(its.map(t=>t.value)),paid=sum(S.tx.filter(t=>t.type==='fatura'&&invoiceMonthOf(t)===fm).map(t=>t.value));
    return {fm,n:its.length,total,paid,rest:Math.round((total-paid)*100)/100};}).filter(f=>f.rest>0.005);
}
function payableItems(fm){return openCard(null,null).filter(t=>dueMonth(t.date)===fm).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);}
