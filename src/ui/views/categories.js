/**
 * ui/views/categories.js
 * Responsibility: Categories tab: create, rename, enable/disable, group and delete; group icon and
 * monthly budget; suggestions.
 */
import { SUGGESTED_CATEGORIES } from '../../core/config.js';
import { $, esc } from '../../core/dom.js';
import { f0, f2, m2 } from '../../core/format.js';
import { parseMoney } from '../../core/money.js';
import { budgetOf, setBudget } from '../../domain/budgets.js';
import { t } from '../../core/i18n.js';
import { displayName, storedName } from '../../core/stored-names.js';
import { S } from '../../domain/store.js';
import { catUse } from '../../domain/categories.js';
import { addCategories, addCategory, deleteCategoryAt, renameCategoryAt, setCategoryEnabled, setCategoryGroup, setCategoryIcon, setGroupIcon } from '../../domain/category-commands.js';
import { toast } from '../toast.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { moreMenu, bindMoreMenus } from '../components/more-menu.js';
const NEW_GROUP='__new_group';
// groups the user opened stay open when the page is drawn again (every change redraws it)
const openGroups=new Set();
// one category line: switch, icon, name, usage and delete (+ the group field for expenses)
function categoryRow(ty,c,i){const u=catUse(ty,c.name),use=t('set.cat.use',{n:u.n,value:f0(u.v)});
  const line=`<div class="row cat-line${ty==='despesa'?' exp':''}"><label class="sw" title="${c.off?t('set.cat.offTitle'):t('set.cat.onTitle')}"><input type="checkbox" data-co="${ty}|${i}" ${c.off?'':'checked'}><span></span></label><div class="row cat-fields${c.off?' off':''}"><input class="ci icon-in" data-ci="${ty}|${i}" value="${esc(c.icon)}" maxlength="4" aria-label="${t('set.cat.iconLabel')}"><input class="ci grow" data-cn="${ty}|${i}" value="${esc(displayName(c.name))}" aria-label="${t('set.cat.nameLabel')}"><span class="mut cat-use">${use}</span></div>${moreMenu([{label:t('set.cat.delete'),attrs:`data-cd="${ty}|${i}"`,danger:true}],t('set.cat.moreActions',{name:esc(displayName(c.name))}))}</div>`;
  // on phones the usage moves to this second line so the name keeps its width
  if(ty!=='despesa')return line+`<div class="cat-sub"><span class="mut">${use}</span></div>`;
  return line+`<div class="cat-grp"><span>${t('set.cat.group')}</span><select class="ci" data-cg="${i}" aria-label="${t('set.cat.groupOf',{name:esc(displayName(c.name))})}"><option value="">${t('set.cat.noGroup')}</option>${(S.groups||[]).map(g=>`<option value="${esc(g.name)}"${g.name===c.group?' selected':''}>${esc(displayName(g.name))}</option>`).join('')}<option value="${NEW_GROUP}">${t('set.cat.newGroup')}</option></select><span class="mut cat-use-sm">${use}</span></div>`;
}
// expenses are shown by group: header (editable icon) and the categories inside it
function expenseSections(){
  const list=S.cats.despesa.map((c,i)=>({c,i})),groups=(S.groups||[]).filter(g=>list.some(x=>x.c.group===g.name));
  const head=(ic,name,items,budget)=>{const v=items.reduce((a,x)=>a+catUse('despesa',x.c.name).v,0);
    return `<summary class="cat-gh">${ic}<b>${esc(displayName(name))}</b><span class="mut">${t('set.cat.groupSummary',{n:items.length,value:f0(v)})}</span>${budget===undefined?'':`<label class="bud-in"><span>${t('set.cat.budgetPerMonth')}</span><input class="ci" data-money data-gb="${esc(name)}" value="${budget?m2(budget):''}" placeholder="${t('set.cat.noLimit')}" aria-label="${t('set.cat.budgetOf',{name:esc(displayName(name))})}"></label>`}</summary>`;};
  const sec=groups.map(g=>{const items=list.filter(x=>x.c.group===g.name);
    return `<details class="cat-det" data-gd="${esc(g.name)}"${openGroups.has(g.name)?' open':''}>`+head(`<input class="ci icon-in sm" data-gi="${esc(g.name)}" value="${esc(g.icon)}" maxlength="4" aria-label="${t('set.cat.groupIconOf',{name:esc(displayName(g.name))})}">`,g.name,items,budgetOf(g.name))+items.map(x=>categoryRow('despesa',x.c,x.i)).join('')+'</details>';});
  const lone=list.filter(x=>!x.c.group||!groups.some(g=>g.name===x.c.group));
  if(lone.length)sec.push(`<details class="cat-det" data-gd=""${openGroups.has('')?' open':''}>`+head('',t('set.cat.noGroup'),lone)+lone.map(x=>categoryRow('despesa',x.c,x.i)).join('')+'</details>');
  return sec.join('');
}
export function renderCategories(){
  const TT={despesa:t('set.cat.expenses'),receita:t('set.cat.income')};
  $('catPage').innerHTML=['despesa','receita'].map(ty=>{
    const list=S.cats[ty];
    return `<div class="card"><div class="list-title">${TT[ty]} <span class="mut title-note">${t('set.cat.count',{n:list.length})}</span></div>`+
      (ty==='despesa'?'<div class="help mb4">'+t('set.cat.groupHelp')+'</div>'+expenseSections():list.map((c,i)=>categoryRow(ty,c,i)).join(''))+
      `<div class="row cat-new"><input class="ci icon-in" id="ne_${ty}" placeholder="🏷️" maxlength="4" aria-label="${t('set.cat.newIconLabel')}"><input class="ci grow" id="nn_${ty}" placeholder="${t('set.cat.newPlaceholder')}"><button class="btn sm pri" data-ca="${ty}">${t('set.cat.add')}</button></div></div>`;}).join('');
  bindMoreMenus($('catPage'));
  document.querySelectorAll('[data-gd]').forEach(d=>d.ontoggle=()=>{if(d.open)openGroups.add(d.dataset.gd);else openGroups.delete(d.dataset.gd);});
  const at=v=>{const [ty,i]=v.split('|');return [ty,+i];};
  document.querySelectorAll('[data-co]').forEach(el=>el.onchange=()=>{const [ty,i]=at(el.dataset.co),on=el.checked;
    runCommand(()=>setCategoryEnabled(ty,i,on),{ok:r=>on?t('set.cat.enabled',{name:r.name}):t('set.cat.disabled',{name:r.name})});});
  document.querySelectorAll('[data-ci]').forEach(el=>el.onchange=()=>{const [ty,i]=at(el.dataset.ci);runCommand(()=>setCategoryIcon(ty,i,el.value));});
  document.querySelectorAll('[data-cn]').forEach(el=>el.onchange=()=>{const [ty,i]=at(el.dataset.cn),old=S.cats[ty][i].name;
    const r=runCommand(()=>renameCategoryAt(ty,i,storedName(el.value)),{ok:r=>r.unchanged?'':t('set.cat.renamed',{name:displayName(r.name)}),onError:()=>{el.value=displayName(old);}});
    if(r&&r.unchanged)el.value=displayName(old);});
  document.querySelectorAll('[data-ca]').forEach(b=>b.onclick=()=>{const ty=b.dataset.ca;
    runCommand(()=>addCategory(ty,storedName($('nn_'+ty).value),$('ne_'+ty).value),{ok:r=>r.group?t('set.cat.createdInGroup',{name:displayName(r.name),group:displayName(r.group)}):t('set.cat.created',{name:displayName(r.name)})});});
  // a group is picked from the list; "Novo grupo…" swaps the list for a text field, and what is typed there is the new group's name
  const bindGroupField=el=>el.onchange=()=>{const i=+el.dataset.cg;
    if(el.value===NEW_GROUP){const inp=document.createElement('input');inp.className='ci';inp.dataset.cg=i;inp.placeholder=t('set.cat.newGroupPlaceholder');inp.setAttribute('aria-label',el.getAttribute('aria-label'));
      el.replaceWith(inp);bindGroupField(inp);inp.focus();return;}
    runCommand(()=>setCategoryGroup(i,storedName(el.value)),{ok:r=>r.group?t('set.cat.movedToGroup',{name:displayName(r.name),group:displayName(r.group)}):t('set.cat.leftGroup',{name:displayName(r.name)})});};
  document.querySelectorAll('[data-cg]').forEach(bindGroupField);
  document.querySelectorAll('[data-gb]').forEach(el=>el.onchange=()=>{const g=el.dataset.gb;
    runCommand(()=>setBudget(g,parseMoney(el.value)),{ok:r=>r.value?t('set.cat.budgetSet',{group:displayName(g),value:f2(r.value)}):t('set.cat.budgetRemoved',{group:displayName(g)})});});
  document.querySelectorAll('[data-gi]').forEach(el=>el.onchange=()=>runCommand(()=>setGroupIcon(el.dataset.gi,el.value)));
  document.querySelectorAll('[data-cd]').forEach(b=>b.onclick=()=>{const [ty,i]=at(b.dataset.cd),c=S.cats[ty][i],u=catUse(ty,c.name);
    if(S.cats[ty].length<=1)return toast(t('set.cat.keepOne'));
    if(u.n===0){askConfirm({title:t('set.cat.deleteTitle'),html:t('set.cat.deleteHtml',{name:esc(displayName(c.name))}),ok:t('set.cat.delete'),danger:true})
      .then(r=>{if(r)runCommand(()=>deleteCategoryAt(ty,i,null),{ok:t('set.cat.deleted')});});return;}
    pendingCategoryDelete={t:ty,i};
    $('catDlgText').textContent=t('set.cat.moveQuestion',{name:displayName(c.name),n:u.n,value:f2(u.v)});
    $('catTo').innerHTML=S.cats[ty].filter((x,k)=>k!==i).map(x=>`<option value="${esc(x.name)}">${esc(x.icon)} ${esc(displayName(x.name))}</option>`).join('');
    $('catDlg').showModal();});
}
function renderSug(){
  const has=n=>S.cats.despesa.some(c=>c.name.toLowerCase()===n.toLowerCase());
  $('sugList').innerHTML=SUGGESTED_CATEGORIES.map(([g,items])=>`<div class="sug-h">${esc(displayName(g))}</div>`+
    items.map(([n,i,rec],k)=>`<label class="sug-opt${has(n)?' has':''}"><input type="checkbox" data-sg="${n}|${i}" ${has(n)?'checked disabled':rec?'checked':''} class="w-auto"><span>${i} ${esc(displayName(n))}</span>${has(n)?'<span class="mut fs12">'+t('set.cat.exists')+'</span>':rec?'':'<span class="mut fs12">'+t('set.cat.optional')+'</span>'}</label>`).join('')).join('');
}
let pendingCategoryDelete=null;
export function bindCategories(){
$('sugOpen').onclick=()=>{renderSug();$('sugDlg').showModal();};
$('sugCancel').onclick=()=>$('sugDlg').close();
$('sugOk').onclick=()=>{const list=[...document.querySelectorAll('[data-sg]:not(:disabled)')].filter(el=>el.checked).map(el=>{const [name,icon]=el.dataset.sg.split('|');return {name,icon};});
  $('sugDlg').close();runCommand(()=>addCategories(list),{ok:r=>r.added?t('set.cat.addedMany',{count:r.added}):t('set.cat.addedNone')});};
$('catCancel').onclick=()=>$('catDlg').close();
$('catForm').onsubmit=e=>{e.preventDefault();$('catOk').click();};
$('catOk').onclick=()=>{if(!pendingCategoryDelete)return;const {t:ty,i}=pendingCategoryDelete,to=$('catTo').value;if(!to)return;
  $('catDlg').close();runCommand(()=>deleteCategoryAt(ty,i,to),{ok:r=>t('set.cat.movedTx',{name:displayName(r.movedTo)})});};
}
