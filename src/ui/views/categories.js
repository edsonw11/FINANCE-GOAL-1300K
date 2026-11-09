/**
 * ui/views/categorias.js
 * Responsibility: Categories tab: create, rename, enable/disable and delete; suggestions.
 */
function renderCategories(){
  const TT={despesa:'Despesas',receita:'Receitas'};
  $('catPage').innerHTML=['despesa','receita'].map(t=>{
    const list=S.cats[t];
    return `<div class="card"><div style="font-weight:700;margin-bottom:10px">${TT[t]} <span class="mut" style="font-weight:500;font-size:13px">· ${list.length} categorias</span></div>`+
      list.map((c,i)=>{const u=catUse(t,c.name);
        return `<div class="row" style="gap:8px;margin-bottom:8px;align-items:center;flex-wrap:nowrap"><label class="sw" title="${c.off?'Desativada: não aparece nas listas de lançamento':'Ativa: aparece nas listas de lançamento'}"><input type="checkbox" data-co="${t}|${i}" ${c.off?'':'checked'}><span></span></label><div class="row" style="gap:8px;flex:1;min-width:0;flex-wrap:nowrap;align-items:center;${c.off?'opacity:.5':''}"><input class="ci" data-ci="${t}|${i}" value="${esc(c.icon)}" maxlength="4" style="width:54px;text-align:center" aria-label="Ícone"><input class="ci" data-cn="${t}|${i}" value="${esc(c.name)}" style="flex:1;min-width:0" aria-label="Nome"><span class="mut" style="font-size:12.5px;white-space:nowrap;min-width:92px;text-align:right">${u.n} lanç. · ${f0(u.v)}</span></div><button class="btn sm dng" data-cd="${t}|${i}">apagar</button></div>`;}).join('')+
      `<div class="row" style="gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);align-items:center;flex-wrap:nowrap"><input class="ci" id="ne_${t}" placeholder="🏷️" maxlength="4" style="width:54px;text-align:center" aria-label="Ícone da nova categoria"><input class="ci" id="nn_${t}" placeholder="Nova categoria (ex.: Uber)" style="flex:1;min-width:0"><button class="btn sm pri" data-ca="${t}">Adicionar</button></div></div>`;}).join('');
  const split=v=>v.split('|');
  document.querySelectorAll('[data-co]').forEach(el=>el.onchange=()=>{const [t,i]=split(el.dataset.co),c=S.cats[t][+i];c.off=!el.checked;if(!c.off)delete c.off;save();render();toast(el.checked?'✅ “'+c.name+'” ativada':'Categoria “'+c.name+'” desativada (não aparece mais nas listas)');});
  document.querySelectorAll('[data-ci]').forEach(el=>el.onchange=()=>{const [t,i]=split(el.dataset.ci);S.cats[t][+i].icon=el.value.trim()||'🏷️';save();render();});
  document.querySelectorAll('[data-cn]').forEach(el=>el.onchange=()=>{const [t,i]=split(el.dataset.cn),c=S.cats[t][+i],nn=el.value.trim();
    if(!nn||nn===c.name){el.value=c.name;return;}
    if(S.cats[t].some((x,k)=>k!==+i&&x.name.toLowerCase()===nn.toLowerCase())){el.value=c.name;return toast('⚠️ Já existe uma categoria com esse nome. Para juntar as duas, apague uma e mova os lançamentos.');}
    renameCat(t,c.name,nn);c.name=nn;save();render();toast('✅ Renomeada para “'+nn+'” (lançamentos atualizados)');});
  document.querySelectorAll('[data-ca]').forEach(b=>b.onclick=()=>{const t=b.dataset.ca,nn=$('nn_'+t).value.trim(),ic=$('ne_'+t).value.trim()||'🏷️';
    if(!nn)return toast('⚠️ Digite o nome da categoria');
    if(S.cats[t].some(x=>x.name.toLowerCase()===nn.toLowerCase()))return toast('⚠️ Essa categoria já existe');
    S.cats[t].push({name:nn,icon:ic});save();render();toast('✅ Categoria “'+nn+'” criada');});
  document.querySelectorAll('[data-cd]').forEach(b=>b.onclick=()=>{const [t,i]=split(b.dataset.cd),c=S.cats[t][+i],u=catUse(t,c.name);
    if(S.cats[t].length<=1)return toast('⚠️ Mantenha pelo menos uma categoria');
    if(u.n===0){if(confirm('Apagar a categoria “'+c.name+'”?')){S.cats[t].splice(+i,1);save();render();toast('Categoria apagada');}return;}
    pendingCategoryDelete={t,i:+i};
    $('catDlgText').textContent='“'+c.name+'” tem '+u.n+' lançamento(s) ('+f2(u.v)+'). Para onde eles devem ir?';
    $('catTo').innerHTML=S.cats[t].filter((x,k)=>k!==+i).map(x=>`<option value="${esc(x.name)}">${esc(x.icon)} ${esc(x.name)}</option>`).join('');
    $('catDlg').showModal();});
}
function renderSug(){
  const has=n=>S.cats.despesa.some(c=>c.name.toLowerCase()===n.toLowerCase());
  $('sugList').innerHTML=SUGGESTED_CATEGORIES.map(([g,items])=>`<div style="font-size:12px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px">${g}</div>`+
    items.map(([n,i,rec],k)=>`<label style="display:flex;gap:10px;align-items:center;margin:0 0 6px;font-size:14.5px;color:var(--ink);font-weight:500;cursor:${has(n)?'default':'pointer'}"><input type="checkbox" data-sg="${n}|${i}" ${has(n)?'checked disabled':rec?'checked':''} style="width:auto"><span>${i} ${esc(n)}</span>${has(n)?'<span class="mut" style="font-size:12px">já existe</span>':rec?'':'<span class="mut" style="font-size:12px">opcional</span>'}</label>`).join('')).join('');
}
let pendingCategoryDelete=null;
function bindCategories(){
$('sugOpen').onclick=()=>{renderSug();$('sugDlg').showModal();};
$('sugCancel').onclick=()=>$('sugDlg').close();
$('sugOk').onclick=()=>{let n=0;document.querySelectorAll('[data-sg]:not(:disabled)').forEach(el=>{if(!el.checked)return;const [name,ic]=el.dataset.sg.split('|');
  if(!S.cats.despesa.some(c=>c.name.toLowerCase()===name.toLowerCase())){S.cats.despesa.push({name,icon:ic});n++;}});
  save();$('sugDlg').close();render();toast(n?'✅ '+n+' categoria(s) adicionada(s)':'Nenhuma categoria nova selecionada');};
$('catCancel').onclick=()=>$('catDlg').close();
$('catForm').onsubmit=e=>{e.preventDefault();$('catOk').click();};
$('catOk').onclick=()=>{if(!pendingCategoryDelete)return;const {t,i}=pendingCategoryDelete,c=S.cats[t][i],to=$('catTo').value;if(!to)return;
  renameCat(t,c.name,to);S.cats[t].splice(i,1);save();$('catDlg').close();render();toast('✅ Lançamentos movidos para “'+to+'”');};
}
