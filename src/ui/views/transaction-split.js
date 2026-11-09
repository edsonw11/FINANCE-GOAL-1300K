/**
 * ui/views/lancamentos-split.js
 * Responsibility: Form: split a transaction across categories.
 */
// ---- split a transaction across categories ----
let splitRows=[];
function resetSplit(){splitRows=[];$('splitBox').style.display='none';$('splitHint').textContent='';}
function updateSplitSum(){
  const tot=parse($('fVal').value),rest=tot-sum(splitRows.map(r=>r.val||0));
  $('splitSum').innerHTML=tot>0?`Resto em <b>${esc($('fCat').value.trim()||(type==='receita'?'Outros':'Imprevistos / Outros'))}</b>: <b class="${rest<0?'neg':''}">${f2(rest)}</b>`:'';
}
function drawSplit(){
  $('splitRows').innerHTML=splitRows.map((r,i)=>`<div class="row" style="margin-bottom:6px"><div class="f" style="flex:2"><input data-sc="${i}" list="catList" placeholder="Categoria da parte (ex.: Saúde)" value="${esc(r.cat)}"></div><div class="f"><input data-sv="${i}" inputmode="decimal" placeholder="Valor (ex.: 99,90)" value="${r.val?m2(r.val):''}"></div><button type="button" class="btn sm dng" data-sx="${i}">remover</button></div>`).join('');
  document.querySelectorAll('[data-sc]').forEach(el=>el.oninput=()=>{splitRows[+el.dataset.sc].cat=el.value;});
  document.querySelectorAll('[data-sv]').forEach(el=>{el.oninput=()=>{splitRows[+el.dataset.sv].val=parse(el.value);updateSplitSum();};el.onblur=()=>{const v=parse(el.value);if(v)el.value=m2(v);};});
  document.querySelectorAll('[data-sx]').forEach(el=>el.onclick=()=>{splitRows.splice(+el.dataset.sx,1);if(!splitRows.length)$('splitBox').style.display='none';drawSplit();});
  updateSplitSum();
}
function openSplit(){$('splitBox').style.display='';if(!splitRows.length)splitRows.push({cat:'',val:0});drawSplit();}
