/**
 * Which CSV column is what (domain/import-csv.js detectCsvMapping): by header name, and by content when the header says nothing. Added after a mutation run showed that
 * a value column in first position and a header such as "Data lançamento" were not checked.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-csv-columns');
  const J=JSON.stringify,map=rows=>run(`detectCsvMapping(${J(rows)})`);
  const pick=m=>({date:m.date,desc:m.desc,value:m.value,complete:m.complete,hasHeader:m.hasHeader});
  eq('the usual order: date, description, value',pick(map([['Data','Descrição','Valor'],['05/11/2026','PADARIA','-12,50']])),{date:0,desc:1,value:2,complete:true,hasHeader:true});
  eq('without a header, a value column in the FIRST position is found (index 0 is a column, not "missing")',
    pick(map([['-12,50','05/11/2026','PADARIA SAMPLE'],['-30,00','06/11/2026','LOJA SAMPLE'],['-8,10','07/11/2026','FEIRA SAMPLE']])),{date:1,desc:2,value:0,complete:true,hasHeader:false});
  eq('with a header, a value column in first position is found too',pick(map([['Valor','Data','Histórico'],['-12,50','05/11/2026','PADARIA']])),{date:1,desc:2,value:0,complete:true,hasHeader:true});
  eq('"Data lançamento" is the date and is not taken as the description although it contains "lançamento"',
    pick(map([['Data lançamento','Histórico','Valor'],['05/11/2026','PADARIA','-12,50']])),{date:0,desc:1,value:2,complete:true,hasHeader:true});
  eq('"Data do lançamento" (as written by some banks) is the date too, and "Histórico" the description',
    pick(map([['Data do lançamento','Histórico','Valor'],['05/11/2026','PADARIA','-12,50']])),{date:0,desc:1,value:2,complete:true,hasHeader:true});
  eq('"Data da compra" is also recognised as the date',pick(map([['Data da compra','Estabelecimento','Valor'],['05/11/2026','LOJA','-9,90']])).date,0);
  eq('separate debit and credit columns are recognised',(()=>{const m=map([['Data','Descrição','Débito','Crédito'],['05/11/2026','PADARIA','12,50',''],['06/11/2026','SALARIO','','100,00']]);return [m.debit,m.credit,m.complete];})(),[2,3,true]);
  eq('without a header the columns are guessed from the content',pick(map([['05/11/2026','PADARIA SAMPLE','-12,50'],['06/11/2026','LOJA SAMPLE','-30,00'],['07/11/2026','FEIRA SAMPLE','-8,10']])),{date:0,desc:1,value:2,complete:true,hasHeader:false});
  eq('a file with no date at all is not complete',map([['a','b'],['c','d']]).complete,false);
  eq('an empty file is not complete',map([]).complete,false);
  ok('the same column is never given two jobs',(()=>{const m=map([['Data','Valor','Histórico'],['05/11/2026','-12,50','PADARIA']]);return new Set([m.date,m.value,m.desc]).size===3;})());
  // ---- found by the second mutation round: each case below fails when the named decision is changed
  const rows=(...r)=>r;
  eq('an empty file has no header',map([]).hasHeader,false);
  eq('an unrelated column before the description is not taken as the description',pick(map(rows(['Data','Categoria','Descrição','Valor'],['05/11/2026','Mercado','PADARIA','-12,50']))),{date:0,desc:2,value:3,complete:true,hasHeader:true});
  eq('a header value column keeps its place: a numeric "Saldo" column after it is not preferred',pick(map(rows(['Data','Descrição','Valor','Saldo'],['05/11/2026','PADARIA','-12,50','900,00']))).value,2);
  eq('a header value column in first position is kept too',pick(map(rows(['Valor','Data','Descrição','Saldo'],['-12,50','05/11/2026','PADARIA','900,00']))).value,0);
  eq('debit and credit columns (even in first position) are not replaced by a guessed value column',(m=>[m.value,m.debit,m.credit])(map(rows(['Débito','Crédito','Data','Descrição','Saldo'],['12,50','','05/11/2026','PADARIA','900,00']))),[-1,0,1]);
  eq('without a header, a text column after the value is not taken as the value',pick(map(rows(['05/11/2026','-12,50','PADARIA SAMPLE'],['06/11/2026','-30,00','LOJA SAMPLE'],['07/11/2026','-8,10','FEIRA SAMPLE']))).value,1);
  eq('a column that is mostly (4 of 5) numbers is the value; 3 of 5 is not',
    [pick(map(rows(['05/11/2026','A SAMPLE','-1,00'],['05/11/2026','B SAMPLE','-2,00'],['05/11/2026','C SAMPLE','-3,00'],['05/11/2026','D SAMPLE','-4,00'],['05/11/2026','E SAMPLE','pendente']))).value,
     pick(map(rows(['05/11/2026','A SAMPLE','-1,00'],['05/11/2026','B SAMPLE','-2,00'],['05/11/2026','C SAMPLE','-3,00'],['05/11/2026','D SAMPLE','pendente'],['05/11/2026','E SAMPLE','pendente']))).value],[2,-1]);
  eq('an empty first column is not taken as the date',pick(map(rows(['','05/11/2026','A SAMPLE','-1,00'],['','06/11/2026','B SAMPLE','-2,00']))).date,1);
  const kindRows=rows(['D','05/11/2026','PADARIA SAMPLE','12,50'],['C','06/11/2026','SALARIO SAMPLE','100,00'],['D','07/11/2026','FEIRA SAMPLE','8,10']);
  const kmap=map(kindRows);
  eq('a D/C column in first position is found and gives the sign',[kmap.kind,run(`csvEntries(${J(kindRows)},${J(kmap)},'2026-11-20')`).entries.map(e=>e.amount)],[0,[-12.5,100,-8.1]]);
  eq('4 of 5 D/C values is enough to be the kind column',map(rows(['D','05/11/2026','A SAMPLE','1,00'],['C','05/11/2026','B SAMPLE','1,00'],['D','05/11/2026','C SAMPLE','1,00'],['C','05/11/2026','D SAMPLE','1,00'],['X','05/11/2026','E SAMPLE','1,00'])).kind,0);
  eq('a free text column that is not D/C is not the kind column',map(rows(['05/11/2026','A SAMPLE','1,00','Mercado'],['06/11/2026','B SAMPLE','2,00','Lazer'],['07/11/2026','C SAMPLE','3,00','Casa'])).kind,-1);
  eq('with two D/C-like columns the first one wins',map(rows(['D','C','05/11/2026','A SAMPLE','1,00'],['C','D','06/11/2026','B SAMPLE','2,00'],['D','C','07/11/2026','C SAMPLE','3,00'])).kind,0);
  eq('complete with only a debit column',(m=>m.complete)(map(rows(['Data','Descrição','Débito'],['05/11/2026','A','1,00']))),true);
  eq('complete with only a credit column',(m=>m.complete)(map(rows(['Data','Descrição','Crédito'],['05/11/2026','A','1,00']))),true);
  eq('complete with a debit column in first position (index 0)',(m=>m.complete)(map(rows(['Débito','Data','Descrição'],['1,00','05/11/2026','A']))),true);
  eq('complete with a credit column in first position (index 0)',(m=>m.complete)(map(rows(['Crédito','Data','Descrição'],['1,00','05/11/2026','A']))),true);
  eq('a value column without any date is not complete',map(rows(['Descrição','Valor'],['PADARIA','-12,50'])).complete,false);
  eq('a debit column alone in first position is not replaced by a guessed value column',(m=>[m.value,m.debit])(map(rows(['Débito','Data','Descrição','Saldo'],['12,50','05/11/2026','PADARIA','900,00']))),[-1,0]);
  eq('a credit column alone in first position is not replaced by a guessed value column',(m=>[m.value,m.credit])(map(rows(['Crédito','Data','Descrição','Saldo'],['12,50','05/11/2026','PADARIA','900,00']))),[-1,0]);
  eq('without a header, a second column of dates is not taken as the value',pick(map(rows(['05/11/2026','-12,50','PADARIA SAMPLE','06/11/2026'],['06/11/2026','-30,00','LOJA SAMPLE','07/11/2026'],['07/11/2026','-8,10','FEIRA SAMPLE','08/11/2026']))).value,1);
  const entriesOf=(rws)=>{const m=map(rws);return run(`csvEntries(${J(rws)},${J(m)},'2026-11-20')`);};
  eq('a small debit (0.50) is an expense of 0.50',entriesOf(rows(['Data','Descrição','Débito','Crédito'],['05/11/2026','A SAMPLE','0,50','']),).entries.map(e=>e.amount),[-0.5]);
  eq('a row with neither a debit nor a credit is skipped as "no value"',entriesOf(rows(['Data','Descrição','Débito','Crédito'],['05/11/2026','A SAMPLE','',''],['06/11/2026','B SAMPLE','1,00',''])).skipped.noValue,1);
  eq('the description column in first position is read',entriesOf(rows(['Descrição','Data','Valor'],['PADARIA SAMPLE','05/11/2026','-12,50'])).entries.map(e=>e.desc),['PADARIA SAMPLE']);
  eq('a debit of 0,00 with an empty credit is an empty line, not a missing value',(r=>[r.skipped.empty,r.skipped.noValue])(entriesOf(rows(['Data','Descrição','Débito','Crédito'],['05/11/2026','A SAMPLE','0,00',''],['06/11/2026','B SAMPLE','1,00','']))),[1,0]);
  eq('an identifier column in first position is read',entriesOf(rows(['Id','Data','Descrição','Valor'],['TX-1','05/11/2026','A SAMPLE','-1,00'])).entries.map(e=>e.id),['TX-1']);
  return res;};
