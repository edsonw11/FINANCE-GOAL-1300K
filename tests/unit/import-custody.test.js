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
  eq('reads date and totals',run(`parseCustody(${J(text)})`),{date:'2026-11-06',gross:1000,ir:20,iof:1,net:979});
  ok('missing total is reported',!!run(`parseCustody('Extrato de Custódia Custódia em: 06/11/2026').error`));
  const before=run('S.tx.length');
  run(`applyCustody(parseCustody(${J(text)}),'nu')`);
  eq('snapshot saved with net and gross',run("S.snaps.filter(s=>s.acc==='nu'&&s.date==='2026-11-06').map(s=>[s.value,s.gross])"),[[979,1000]]);
  run(`applyCustody(parseCustody(${J(text)}),'nu')`);
  eq('same statement again replaces the same day (no duplicate)',run("S.snaps.filter(s=>s.acc==='nu'&&s.date==='2026-11-06').length"),1);
  eq('no transaction is created',run('S.tx.length'),before);
  eq('refuses an unknown account',run(`applyCustody(parseCustody(${J(text)}),'zzz')`),{error:'Escolha a conta de investimento'});
  eq('balance reflects the statement',run("currentBalance('nu','2026-11-06')"),979);
  return res;};
