/**
 * ui/components/stack-table.js
 * Responsibility: on phones, tables with class "stack" become a list of cards. Each cell gets
 * the column title (data-label) so the CSS can show "Label: value" lines.
 */
export function stackTables(root){
  (root||document).querySelectorAll('table.stack').forEach(tb=>{
    let heads=[];
    tb.querySelectorAll('tr').forEach(tr=>{
      const ths=tr.querySelectorAll('th');
      if(ths.length&&!tr.querySelector('td')){heads=[...ths].map(th=>th.textContent.trim());return;}
      [...tr.children].forEach((td,i)=>{if(td.tagName==='TD'&&!td.hasAttribute('data-label')&&heads[i])td.setAttribute('data-label',heads[i]);});
    });
  });
}
