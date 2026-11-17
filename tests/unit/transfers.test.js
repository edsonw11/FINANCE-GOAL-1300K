/**
 * Transfers between the user's own accounts: the user's names, classification of Pix/TED to or from
 * them, keeping transfers apart from income/expense, recognising the other side in another bank's
 * statement (in any order), fixing a side that was saved as an expense, and idempotency.
 * Names, banks and values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('transfers');
  const J=JSON.stringify;
  const fresh=()=>run(`S=seed();S.tx=[];S.imports=[];S.transfers=[];S.ownNames=[];S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();`);
  const read=(name,lines)=>run(`globalThis.R=readImportFile({name:${J(name)},text:${J(['Data;Descrição;Valor'].concat(lines).join('\n'))}},{today:'2026-11-20'});R`);
  const types=()=>run("R.drafts.map(d=>[d.desc,d.type])");
  const commit=()=>run("commitImport(R.drafts,{fileHash:'h'+Math.random(),fileName:'x.csv',at:'2026-11-20'})");
  fresh();
  // ---- names
  ok('a single word is refused (too many false matches)',!!run("addOwnName('Maria')").error);
  eq('name saved',run("addOwnName('Maria Souza Lima')"),{name:'Maria Souza Lima'});
  ok('same name twice is refused (accents and case ignored)',!!run("addOwnName('MARIA SOUZA LIMA')").error);
  const m=d=>run(`mentionsOwnName(${J(d)},ownNames())`);
  eq('matches the name as banks print it',[m('PIX ENVIADO Maria Souza Lima'),m('PIX RECEBIDO MARIA S LIMA'),m('TED MARIA DE SOUZA LIMA'),m('Transferência para maria lima')],[true,true,true,true]);
  eq('does not match other people',[m('PIX ENVIADO Maria Oliveira'),m('PIX ENVIADO Joao Lima'),m('LIMA MARIA')],[false,false,false]);
  // ---- Santander: salary 30.000 in, then 3 Pix of 10.000 to my other banks
  read('santander.csv',['05/11/2026;TED CONTA SALARIO MARIA SOUZA LIMA;30.000,00',
    '06/11/2026;PIX ENVIADO Maria Souza Lima;-10.000,00','06/11/2026;PIX ENVIADO MARIA S LIMA;-10.000,00','06/11/2026;PIX ENVIADO Maria Lima;-10.000,00',
    '07/11/2026;PIX ENVIADO Padaria do Ze;-50,00']);
  eq('salary in my name stays income; Pix to me is a transfer; Pix to others is an expense',run("R.drafts.map(d=>d.type)"),['receita','transferencia','transferencia','transferencia','despesa']);
  eq('transfers are not selected as transactions and have no category',run("R.drafts.filter(d=>d.type==='transferencia').map(d=>[d.selected,d.cat])"),[[false,''],[false,''],[false,'']]);
  eq('overview counts them apart',run("(o=>[o.transfers,o.transferTotal,o.selected.count])(importOverview(R.drafts))"),[3,30000,2]);
  let c=commit();
  eq('commit: 2 transactions, 3 transfers kept',[c.saved,c.transfers,run('S.tx.length'),run('S.transfers.length')],[2,3,2,3]);
  eq('month: income 30.000, expenses only the bakery',run("(s=>[s.income.total,s.expenses.total])(monthSummary('2026-11'))"),[30000,50]);
  // ---- Nubank (no name on the line): the other side is recognised by value, direction and date
  read('nubank.csv',['07/11/2026;Transferência recebida;10.000,00','08/11/2026;Compra mercado;-200,00']);
  eq('the 10.000 in becomes the other side of a kept transfer',types(),[['Transferência recebida','transferencia'],['Compra mercado','despesa']]);
  eq('pair points to the Santander side',run("R.drafts[0].pair&&[R.drafts[0].pair.kind,R.drafts[0].pair.date]"),['transfer','2026-11-06']);
  c=commit();
  eq('kept and linked to its pair',[c.transfers,run("S.transfers.filter(t=>t.pair).length")],[1,2]);
  // ---- Bradesco: second 10.000 pairs with another (unpaired) Santander Pix, not the one already used
  read('bradesco.csv',['06/11/2026;TED RECEBIDA;10.000,00']);
  eq('next unpaired side',[types()[0][1],run("R.drafts[0].pair.id")!==run("S.transfers.find(t=>t.dir==='in').pair")],['transferencia',true]);
  commit();
  // ---- too far apart or other value: no pair
  read('inter.csv',['20/11/2026;PIX RECEBIDO;10.000,00','06/11/2026;PIX RECEBIDO;9.999,00']);
  eq('no pair beyond 3 days or with another value',run("R.drafts.map(d=>[d.type,!!d.pair])"),[['receita',false],['receita',false]]);
  // ---- same file again: nothing kept twice
  read('santander.csv',['05/11/2026;TED CONTA SALARIO MARIA SOUZA LIMA;30.000,00','06/11/2026;PIX ENVIADO Maria Souza Lima;-10.000,00']);
  eq('already kept transfer is a confirmed duplicate',run("R.drafts.map(d=>d.dup&&d.dup.level)"),['confirmed','confirmed']);
  const n0=run('S.transfers.length');commit();
  eq('importing it again keeps nothing new',run('S.transfers.length'),n0);
  // ---- the other order: the Santander side was saved as an expense (no name set back then)
  fresh();
  read('santander.csv',['06/11/2026;PIX ENVIADO JOAQUIM;-5.000,00']);commit();
  eq('saved as expense (it could be a payment to someone)',run("S.tx.map(t=>[t.type,t.value])"),[['despesa',5000]]);
  read('inter.csv',['07/11/2026;PIX RECEBIDO;5.000,00']);
  eq('the new side points to the saved expense, still income until the user says so',run("[R.drafts[0].type,R.drafts[0].pair.kind,R.drafts[0].flags.includes('transfer-pair')]"),['receita','record',true]);
  run("Object.assign(R.drafts[0],{type:'transferencia',selected:false,fixPair:true})");
  c=commit();
  eq('fix both: the expense becomes a transfer, the month has no fake expense or income',
    [c.fixedPairs,run('S.tx.length'),run('S.transfers.length'),run("S.transfers.every(t=>t.pair)"),run("(s=>[s.income.total,s.expenses.total])(monthSummary('2026-11'))")],[1,0,2,true,[0,0]]);
  // ---- a card statement never turns a line into an own transfer
  fresh();run("addOwnName('Maria Souza Lima')");
  run(`globalThis.R=readImportFile({name:'fatura-cartao.csv',text:${J('Data;Descrição;Valor\n05/11/2026;LOJA MARIA SOUZA LIMA ME;120,00')}},{today:'2026-11-20',kind:'card'});R`);
  eq('card: a shop with my name is still a purchase',run("R.drafts[0].type"),'despesa');
  eq('removing a name',[run("removeOwnName('Maria Souza Lima').name"),run('ownNames().length')],['Maria Souza Lima',0]);
  eq('"Apagar tudo" keeps the names (a preference, like the goal)',run("blankState({goal:1,rate:1,ownNames:['A B']}).ownNames"),['A B']);
  return res;};
