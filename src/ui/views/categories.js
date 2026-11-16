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
import { S } from '../../domain/store.js';
import { catUse } from '../../domain/categories.js';
import { addCategories, addCategory, deleteCategoryAt, renameCategoryAt, setCategoryEnabled, setCategoryGroup, setCategoryIcon, setGroupIcon } from '../../domain/category-commands.js';
import { toast } from '../toast.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
// one category line: switch, icon, name, usage and delete (+ the group field for expenses)
function categoryRow(t,c,i){const u=catUse(t,c.name),use=`${u.n} lanç. · ${f0(u.v)}`;
  const line=`<div class="row cat-line${t==='despesa'?' exp':''}"><label class="sw" title="${c.off?'Desativada: não aparece nas listas de lançamento':'Ativa: aparece nas listas de lançamento'}"><input type="checkbox" data-co="${t}|${i}" ${c.off?'':'checked'}><span></span></label><div class="row cat-fields${c.off?' off':''}"><input class="ci icon-in" data-ci="${t}|${i}" value="${esc(c.icon)}" maxlength="4" aria-label="Ícone"><input class="ci grow" data-cn="${t}|${i}" value="${esc(c.name)}" aria-label="Nome"><span class="mut cat-use">${use}</span></div><button class="btn sm dng" data-cd="${t}|${i}" aria-label="Excluir ${esc(c.name)}">Excluir</button></div>`;
  // on phones the usage moves to this second line so the name keeps its width
  if(t!=='despesa')return line+`<div class="cat-sub"><span class="mut">${use}</span></div>`;
  return line+`<div class="cat-grp"><span>Grupo</span><input class="ci" list="groupList" data-cg="${i}" value="${esc(c.group||'')}" placeholder="Sem grupo (digite para criar)" aria-label="Grupo de ${esc(c.name)}"><span class="mut cat-use-sm">${use}</span></div>`;
}
// expenses are shown by group: header (editable icon) and the categories inside it
function expenseSections(){
  const list=S.cats.despesa.map((c,i)=>({c,i})),groups=(S.groups||[]).filter(g=>list.some(x=>x.c.group===g.name));
  const head=(ic,name,items,budget)=>{const v=items.reduce((a,x)=>a+catUse('despesa',x.c.name).v,0);
    return `<div class="cat-gh">${ic}<b>${esc(name)}</b><span class="mut">${items.length} categoria(s) · ${f0(v)}</span>${budget===undefined?'':`<label class="bud-in"><span>Orçamento/mês</span><input class="ci" data-money data-gb="${esc(name)}" value="${budget?m2(budget):''}" placeholder="sem limite" aria-label="Orçamento mensal de ${esc(name)}"></label>`}</div>`;};
  const sec=groups.map(g=>{const items=list.filter(x=>x.c.group===g.name);
    return head(`<input class="ci icon-in sm" data-gi="${esc(g.name)}" value="${esc(g.icon)}" maxlength="4" aria-label="Ícone do grupo ${esc(g.name)}">`,g.name,items,budgetOf(g.name))+items.map(x=>categoryRow('despesa',x.c,x.i)).join('');});
  const lone=list.filter(x=>!x.c.group||!groups.some(g=>g.name===x.c.group));
  if(lone.length)sec.push(head('','Sem grupo',lone)+lone.map(x=>categoryRow('despesa',x.c,x.i)).join(''));
  return `<datalist id="groupList">${(S.groups||[]).map(g=>`<option value="${esc(g.name)}">`).join('')}</datalist>`+sec.join('');
}
export function renderCategories(){
  const TT={despesa:'Despesas',receita:'Receitas'};
  $('catPage').innerHTML=['despesa','receita'].map(t=>{
    const list=S.cats[t];
    return `<div class="card"><div class="list-title">${TT[t]} <span class="mut title-note">· ${list.length} categorias</span></div>`+
      (t==='despesa'?'<div class="help mb4">Cada categoria fica num grupo (ex.: Luz, Água e Gás em Moradia; Academia em Saúde). O Resumo e a análise somam por grupo.</div>'+expenseSections():list.map((c,i)=>categoryRow(t,c,i)).join(''))+
      `<div class="row cat-new"><input class="ci icon-in" id="ne_${t}" placeholder="🏷️" maxlength="4" aria-label="Ícone da nova categoria"><input class="ci grow" id="nn_${t}" placeholder="Nova categoria (ex.: Uber)"><button class="btn sm pri" data-ca="${t}">Adicionar</button></div></div>`;}).join('');
  const at=v=>{const [t,i]=v.split('|');return [t,+i];};
  document.querySelectorAll('[data-co]').forEach(el=>el.onchange=()=>{const [t,i]=at(el.dataset.co),on=el.checked;
    runCommand(()=>setCategoryEnabled(t,i,on),{ok:r=>on?'✅ “'+r.name+'” ativada':'Categoria “'+r.name+'” desativada (não aparece mais nas listas)'});});
  document.querySelectorAll('[data-ci]').forEach(el=>el.onchange=()=>{const [t,i]=at(el.dataset.ci);runCommand(()=>setCategoryIcon(t,i,el.value));});
  document.querySelectorAll('[data-cn]').forEach(el=>el.onchange=()=>{const [t,i]=at(el.dataset.cn),old=S.cats[t][i].name;
    const r=runCommand(()=>renameCategoryAt(t,i,el.value),{ok:r=>r.unchanged?'':'✅ Renomeada para “'+r.name+'” (lançamentos atualizados)',onError:()=>{el.value=old;}});
    if(r&&r.unchanged)el.value=old;});
  document.querySelectorAll('[data-ca]').forEach(b=>b.onclick=()=>{const t=b.dataset.ca;
    runCommand(()=>addCategory(t,$('nn_'+t).value,$('ne_'+t).value),{ok:r=>'✅ Categoria “'+r.name+'” criada'+(r.group?' no grupo '+r.group:'')});});
  document.querySelectorAll('[data-cg]').forEach(el=>el.onchange=()=>{const i=+el.dataset.cg;
    runCommand(()=>setCategoryGroup(i,el.value),{ok:r=>r.group?'✅ “'+r.name+'” agora está em '+r.group:'“'+r.name+'” ficou sem grupo'});});
  document.querySelectorAll('[data-gb]').forEach(el=>el.onchange=()=>{const g=el.dataset.gb;
    runCommand(()=>setBudget(g,parseMoney(el.value)),{ok:r=>r.value?'✅ Orçamento de '+g+': '+f2(r.value)+'/mês':'Orçamento de '+g+' removido'});});
  document.querySelectorAll('[data-gi]').forEach(el=>el.onchange=()=>runCommand(()=>setGroupIcon(el.dataset.gi,el.value)));
  document.querySelectorAll('[data-cd]').forEach(b=>b.onclick=()=>{const [t,i]=at(b.dataset.cd),c=S.cats[t][i],u=catUse(t,c.name);
    if(S.cats[t].length<=1)return toast('⚠️ Mantenha pelo menos uma categoria');
    if(u.n===0){askConfirm({title:'Excluir categoria',html:'Deseja excluir a categoria <b>“'+esc(c.name)+'”</b>? Ela não tem lançamentos.',ok:'Excluir',danger:true})
      .then(r=>{if(r)runCommand(()=>deleteCategoryAt(t,i,null),{ok:'Categoria excluída'});});return;}
    pendingCategoryDelete={t,i};
    $('catDlgText').textContent='“'+c.name+'” tem '+u.n+' lançamento(s) ('+f2(u.v)+'). Para onde eles devem ir?';
    $('catTo').innerHTML=S.cats[t].filter((x,k)=>k!==i).map(x=>`<option value="${esc(x.name)}">${esc(x.icon)} ${esc(x.name)}</option>`).join('');
    $('catDlg').showModal();});
}
function renderSug(){
  const has=n=>S.cats.despesa.some(c=>c.name.toLowerCase()===n.toLowerCase());
  $('sugList').innerHTML=SUGGESTED_CATEGORIES.map(([g,items])=>`<div class="sug-h">${g}</div>`+
    items.map(([n,i,rec],k)=>`<label class="sug-opt${has(n)?' has':''}"><input type="checkbox" data-sg="${n}|${i}" ${has(n)?'checked disabled':rec?'checked':''} class="w-auto"><span>${i} ${esc(n)}</span>${has(n)?'<span class="mut fs12">já existe</span>':rec?'':'<span class="mut fs12">opcional</span>'}</label>`).join('')).join('');
}
let pendingCategoryDelete=null;
export function bindCategories(){
$('sugOpen').onclick=()=>{renderSug();$('sugDlg').showModal();};
$('sugCancel').onclick=()=>$('sugDlg').close();
$('sugOk').onclick=()=>{const list=[...document.querySelectorAll('[data-sg]:not(:disabled)')].filter(el=>el.checked).map(el=>{const [name,icon]=el.dataset.sg.split('|');return {name,icon};});
  $('sugDlg').close();runCommand(()=>addCategories(list),{ok:r=>r.added?'✅ '+r.added+' categoria(s) adicionada(s)':'Nenhuma categoria nova selecionada'});};
$('catCancel').onclick=()=>$('catDlg').close();
$('catForm').onsubmit=e=>{e.preventDefault();$('catOk').click();};
$('catOk').onclick=()=>{if(!pendingCategoryDelete)return;const {t,i}=pendingCategoryDelete,to=$('catTo').value;if(!to)return;
  $('catDlg').close();runCommand(()=>deleteCategoryAt(t,i,to),{ok:r=>'✅ Lançamentos movidos para “'+r.movedTo+'”'});};
}
