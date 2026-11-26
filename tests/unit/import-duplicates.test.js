/**
 * Duplicate marking of import drafts: a confirmed duplicate has a key that was already imported (or repeats in the file); a possible one is a manual record
 * with the same type and value on the same day, or one day apart with a shared word. Saved records are never changed.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-duplicates');
  const J=JSON.stringify;
  const draft=(o)=>Object.assign({type:'despesa',date:'2026-11-05',value:12.5,desc:'PADARIA SAMPLE',key:null},o);
  const mark=(tx,drafts)=>run(`(()=>{S=seed();S.tx=${J(tx)};const D=${J(drafts)};markDuplicates(D);return D.map(d=>d.dup);})()`);
  const saved=(o)=>Object.assign({id:1,type:'despesa',date:'2026-11-05',value:12.5,desc:'PADARIA SAMPLE',cat:'Mercado'},o);
  eq('an empty book marks nothing',mark([],[draft()]),[null]);
  eq('same key already imported: confirmed, names the saved record',mark([saved({imp:'K1'})],[draft({key:'K1',value:99})]).map(d=>d&&d.level),['confirmed']);
  ok('the text says "Já importado" with the date',/Já importado: “PADARIA SAMPLE” de 05\/11\/2026/.test(mark([saved({imp:'K1'})],[draft({key:'K1'})])[0].text));
  eq('the same key twice in the file: the second is confirmed',mark([],[draft({key:'A'}),draft({key:'A',value:1})]).map(d=>d&&d.level),[null,'confirmed']);
  ok('the file repeat has its own text',/Repetido no arquivo/.test(mark([],[draft({key:'A'}),draft({key:'A'})])[1].text));
  eq('same type, value and day on a manual record: possible',mark([saved()],[draft()]).map(d=>d&&d.level),['possible']);
  ok('the possible text names the saved record and invites the user to decide',/Parecido com “PADARIA SAMPLE”/.test(mark([saved()],[draft()])[0].text)&&/Marque para importar/.test(mark([saved()],[draft()])[0].text));
  eq('one day apart with a shared word: possible',mark([saved({date:'2026-11-04'})],[draft()]).map(d=>d&&d.level),['possible']);
  eq('one day apart with no shared word: not a duplicate',mark([saved({date:'2026-11-04',desc:'OUTRA COISA'})],[draft()]),[null]);
  eq('two days apart: not a duplicate',mark([saved({date:'2026-11-03'})],[draft()]),[null]);
  eq('a different value is not a duplicate',mark([saved({value:12.51})],[draft()]),[null]);
  eq('a different type is not a duplicate',mark([saved({type:'receita'})],[draft()]),[null]);
  eq('the value is compared in cents (no float noise)',mark([saved({value:0.1+0.2})],[draft({value:0.3})]).map(d=>d&&d.level),['possible']);
  eq('a draft that will not be saved (ignored) is never a possible duplicate',mark([saved()],[draft({type:'ignorar'})]),[null]);
  eq('a draft without a date is never a possible duplicate',mark([saved()],[draft({date:''})]),[null]);
  eq('a draft of another type (a contribution) does not match an expense',mark([saved()],[draft({type:'aporte'})]),[null]);
  eq('the markers are reset on every call',run(`(()=>{S=seed();S.tx=[];const D=[{type:'despesa',date:'2026-11-05',value:1,desc:'X',key:null,dup:{level:'confirmed'}}];markDuplicates(D);return D[0].dup;})()`),null);
  eq('saved records are not changed',run(`(()=>{S=seed();S.tx=${J([saved({imp:'K1'})])};const before=JSON.stringify(S.tx);markDuplicates([${J(draft({key:'K1'}))}]);return JSON.stringify(S.tx)===before;})()`),true);
  eq('transfers saved apart are not matched',mark([saved({type:'transferencia'})],[draft({type:'despesa'})]),[null]);
  eq('two saved records share a key: the FIRST one is the one named',/PRIMEIRO/.test(mark([saved({id:1,imp:'K9',desc:'PRIMEIRO'}),saved({id:2,imp:'K9',desc:'SEGUNDO'})],[draft({key:'K9'})])[0].text),true);
  eq('a draft of a type that is never saved (transfer, ignored) is not compared with saved records',mark([saved()],[draft({type:'transferencia'}),draft({type:'ignorar'})]),[null,null]);
  eq('a draft without a date is not compared with saved records',mark([saved()],[draft({date:''})]),[null]);
  return res;};
