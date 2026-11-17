/**
 * Custody statement (broker balance snapshot): recognised, read, applied as a balance snapshot only.
 * Text is made up (same layout as a real one, invented values).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-custody');
  const J=JSON.stringify;
  const text=['Extrato de Custódia','Custódia em: 06/11/2026','Resumo da posição consolidada','Tipo de investimento Saldo bruto (R$) IR (R$) IOF (R$) Saldo líquido (R$)',
    'Caixinhas 1.000,00 20,00 1,00 979,00','Total geral 1.000,00 20,00 1,00 979,00','Custódia em Caixinhas','Total 1.000,00 20,00 1,00 979,00'].join('\n');
  run("S=seed();S.tx=[];");
  eq('not a custody statement',run(`parseCustody('05/11 PADARIA 12,50')`),null);
  eq('reads date and totals',run(`parseCustody(${J(text)})`),{date:'2026-11-06',gross:1000,ir:20,iof:1,net:979,name:'Caixinhas'});
  // the PDF reader marks far apart columns with " | " (real Nubank layout: label and amounts in columns)
  const cell=(str,x,y)=>({str,x,y,w:str.length*5,size:9});
  const lines=run(`linesFromItems(${J([cell('Extrato de Custódia',40,800),cell('Custódia em: 06/11/2026',480,800),
    cell('Total geral',60,600),cell('1.000,00',200,600),cell('20,00',300,600),cell('1,00',400,600),cell('979,00',500,600)])})`);
  ok('the reader keeps the columns apart',lines.some(l=>/Total geral \| 1\.000,00 \|/.test(l)));
  eq('totals read across column marks',run(`parseCustody(${J(lines.join('\n'))})`),{date:'2026-11-06',gross:1000,ir:20,iof:1,net:979,name:'Investimentos'});
  ok('missing total is reported',!!run(`parseCustody('Extrato de Custódia Custódia em: 06/11/2026').error`));
  const before=run('S.tx.length');
  run(`applyCustody(parseCustody(${J(text)}),'nu')`);
  eq('snapshot saved with net and gross',run("S.snaps.filter(s=>s.acc==='nu'&&s.date==='2026-11-06').map(s=>[s.value,s.gross])"),[[979,1000]]);
  run(`applyCustody(parseCustody(${J(text)}),'nu')`);
  eq('same statement again replaces the same day (no duplicate)',run("S.snaps.filter(s=>s.acc==='nu'&&s.date==='2026-11-06').length"),1);
  eq('no transaction is created',run('S.tx.length'),before);
  eq('refuses an unknown account',run(`applyCustody(parseCustody(${J(text)}),'zzz')`),{error:'Escolha a conta de investimento'});
  eq('balance reflects the statement',run("currentBalance('nu','2026-11-06')"),979);
  // suggested account name and the new account command
  const nu=text.replace('Extrato de Custódia','Extrato de Custódia NU INVESTIMENTOS S.A.');
  eq('account name from the broker and the first kind of the summary',run(`parseCustody(${J(nu)}).name`),'Nubank Caixinhas');
  eq('unknown broker and kind: a plain name',run("custodyAccountName('extrato de custodia total geral 1,00')"),'Investimentos');
  const n0=run('S.accounts.length');
  const made=run(`applyCustodyToNewAccount(parseCustody(${J(nu)}),'Nubank Caixinhas')`);
  eq('creates the account and saves the balance in it',[run('S.accounts.length')-n0,run(`S.accounts.find(a=>a.id===${J(made.acc)}).name`),run(`S.snaps.filter(s=>s.acc===${J(made.acc)}).map(s=>s.value)`)],[1,'Nubank Caixinhas',[979]]);
  ok('an empty name is refused, nothing created',!!run(`applyCustodyToNewAccount(parseCustody(${J(nu)}),'  ')`).error&&run('S.accounts.length')-n0===1);
  return res;};
