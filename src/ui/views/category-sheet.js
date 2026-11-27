/**
 * ui/views/category-sheet.js
 * Responsibility: detail of one expense group (e.g. Moradia = condomínio + luz + água + gás) or of
 * one category inside it: total, average, highest and lowest month, the split by category
 * (tap one to drill down) and each month expandable to the records behind it.
 */
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { esc } from '../../core/dom.js';
import { f0, f2 } from '../../core/format.js';
import { mShort } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { icon } from '../../domain/categories.js';
import { categoriesOfGroup, groupIcon, groupOf } from '../../domain/category-groups.js';
import { categoryItems, groupItems, spendingWindow } from '../../domain/spending.js';
import { ui } from '../ui-state.js';
import { Sheet } from '../components/sheet.js';
import { infoRow, txRow } from '../components/breakdown.js';
import { periodOf } from './month-details.js';
// what the sheet is about: a group (default) or a single category
const LEVEL={
  group:name=>({items:m=>groupItems(m,name),icon:groupIcon(name),cats:categoriesOfGroup(name),
    sub:n=>n>1?t('set.sheet.last12Cats',{n}):t('set.sheet.last12')}),
  cat:name=>({items:m=>categoryItems(m,name),icon:icon('despesa',name),cats:[name],
    sub:()=>groupOf(name)!==name?t('set.sheet.catOfGroup',{group:esc(displayName(groupOf(name)))}):t('set.sheet.last12')})};
const pct=x=>Math.abs(x*100).toFixed(0)+'%';
const chip=(l,v,sub,c)=>`<div class="ct"><div class="ct-k">${l}</div><div class="ct-v${c?' tone-'+c:''}">${v}</div><div class="ct-s">${sub}</div></div>`;
// "Por categoria": closed-month totals of each category of the group (only when there is more than one)
function categorySplit(cats,w){
  const rows=cats.map(c=>({c,v:sumMoney(w.ci.map(k=>sumMoney(categoryItems(w.ms[k],c).map(i=>i.value))))})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v);
  if(rows.length<2)return '';
  const tot=sumMoney(rows.map(r=>r.v)),n=w.ci.length||1;
  return `<div class="bd-gh"><span>${t('set.sheet.byCategory')}</span><span class="mut">${t('set.sheet.closedMonths')}</span></div><div class="lst">`+
    rows.map(r=>infoRow({icon:icon('despesa',r.c),title:esc(displayName(r.c)),sub:t('set.sheet.catShare',{pct:pct(r.v/tot),avg:f0(r.v/n)}),value:f2(r.v),attrs:`data-subcat="${esc(r.c)}"`})).join('')+'</div>';
}
function spendingView(name,level,openM){
  const opened=new Set(openM?[openM]:[]),L=LEVEL[level](name);
  return {render(body){
    const w=spendingWindow(ui.cur),nowM=w.nowM;
    const rowsD=w.ms.map((m,k)=>({m,k,items:L.items(m),part:m===nowM,closed:w.ci.includes(k)})).map(r=>({...r,v:sumMoney(r.items.map(i=>i.value))}));
    const cl=rowsD.filter(r=>r.closed),tot=sumMoney(cl.map(r=>r.v)),pos=cl.filter(r=>r.v>0);
    const hi=pos.length?pos.reduce((a,b)=>b.v>a.v?b:a):null,lo=pos.length?pos.reduce((a,b)=>b.v<a.v?b:a):null,avg=cl.length?tot/cl.length:0;
    const mx=Math.max(...rowsD.map(r=>r.v),1);
    let prevV=null;
    const months=rowsD.map(r=>{
      let cmp='';
      if(prevV!==null&&prevV>0){const d=r.v-prevV;cmp=Math.abs(d)<1?t('set.sheet.sameAsPrev'):t(d>0?'set.sheet.cmpUp':'set.sheet.cmpDown',{value:f0(Math.abs(d)),pct:pct(d/prevV)});}
      prevV=r.v;
      const tag=hi&&r.m===hi.m&&pos.length>1?' <span class="tag despesa">'+t('set.sheet.highest')+'</span>':lo&&r.m===lo.m&&pos.length>1?' <span class="tag pay-vr">'+t('set.sheet.lowest')+'</span>':'';
      return `<details class="cm" data-cmm="${r.m}" ${opened.has(r.m)?'open':''}><summary><span class="cm-m">${periodOf(r.m)}${r.part?' <span class="mut">'+t('set.sheet.inProgress')+'</span>':''}${tag}<span class="cm-s">${t('set.sheet.txCount',{n:r.items.length})}${cmp?' · '+cmp:''}</span></span><span class="cm-bar${r.part?' part':''}"><i style="width:${r.v/mx*100}%"></i></span><b>${r.v?f2(r.v):'—'}</b></summary>
        <div class="lst">${r.items.map(i=>txRow(i.t,{value:i.value,sign:'−',title:i.t.type==='fatura'?t('set.sheet.invoiceNoDetail'):undefined})).join('')||'<div class="empty sm">'+t('set.sheet.noSpending')+'</div>'}</div></details>`;}).reverse();
    const split=level==='group'?categorySplit(L.cats,w):'';
    body.innerHTML=`<div class="cts">${chip(t('set.sheet.total'),f0(tot),t('set.sheet.closedCount',{n:cl.length}))}${chip(t('set.sheet.avgMonth'),f0(avg),t('set.sheet.closedMonths'))}${chip(t('set.sheet.max'),hi?f0(hi.v):'—',hi?mShort(hi.m):'','des')}${chip(t('set.sheet.min'),lo?f0(lo.v):'—',lo?mShort(lo.m):'','rec')}</div>
      ${split}
      <div class="help ${split?'mt-12 mb8':'mb8-only'}">${t('set.sheet.help')}</div>
      ${months.join('')}
      <div class="bd-gh mt-12"><span>${t('set.sheet.closedTotal')}</span><b>${f2(tot)}</b></div>`;
    body.querySelectorAll('details.cm').forEach(d=>d.ontoggle=()=>{d.open?opened.add(d.dataset.cmm):opened.delete(d.dataset.cmm);});
    body.querySelectorAll('[data-subcat]').forEach(el=>el.onclick=()=>Sheet.push(spendingView(el.dataset.subcat,'cat')));
    return {title:L.icon+' '+esc(displayName(name)),sub:L.sub(L.cats.length)};
  }};
}
// opens the detail of a group (the analysis and the summary list work by group)
export function openGroup(group,m){ui.selectedInsightCategory=group;const v=spendingView(group,'group',m);Sheet.depth()?Sheet.push(v):Sheet.open(v);}
