/**
 * ui/views/import-mapping.js
 * Responsibility: the "which column is what" panel for CSV files. Shown when the columns could not be
 * recognised, or when the user wants to adjust them. Builds a column mapping and hands it to the
 * caller; reading again is done by import-load.js.
 */
import { esc } from '../../core/dom.js';
const FIELDS=[['date','Data'],['desc','Descrição'],['value','Valor (com sinal)'],['credit','Entradas (opcional)'],['debit','Saídas (opcional)']];
const colLabel=(rows,m,i)=>m.hasHeader?(rows[0][i]||'Coluna '+(i+1)):'Coluna '+(i+1)+(rows[0]?' ('+String(rows[0][i]||'').slice(0,18)+')':'');
export function mappingHtml(read){
  const rows=read.rows||[],m=read.mapping||{hasHeader:true},width=Math.max(0,...rows.slice(0,20).map(r=>r.length));
  const opts=sel=>'<option value="-1">— não tem —</option>'+Array.from({length:width},(_,i)=>`<option value="${i}"${sel===i?' selected':''}>${esc(colLabel(rows,m,i))}</option>`).join('');
  const preview=rows.slice(0,4).map(r=>`<tr>${r.slice(0,width).map(c=>`<td>${esc(String(c).slice(0,24))}</td>`).join('')}</tr>`).join('');
  return `<div class="imp-map"><p class="help">${esc(read.error||'Confira quais colunas do arquivo são a data, a descrição e o valor.')}</p>
    <div class="imp-prev"><table><tbody>${preview}</tbody></table></div>
    <label class="check-opt"><input type="checkbox" id="mapHeader"${m.hasHeader?' checked':''}> A primeira linha é o cabeçalho</label>
    <div class="formgrid mt-10">${FIELDS.map(([k,l])=>`<div><label for="map_${k}">${l}</label><select id="map_${k}" data-map="${k}">${opts(m[k]===undefined?-1:m[k])}</select></div>`).join('')}</div></div>`;
}
// reads the selects -> mapping object, or null when date or amount is still missing
export function readMapping(root){
  const m={hasHeader:root.querySelector('#mapHeader').checked,kind:-1,id:-1};
  root.querySelectorAll('[data-map]').forEach(s=>{m[s.dataset.map]=+s.value;});
  m.complete=m.date>=0&&(m.value>=0||m.debit>=0||m.credit>=0);
  return m.complete?m:null;
}
