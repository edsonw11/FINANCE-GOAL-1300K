/**
 * Allocation targets by investment type and the tower grouped by type.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('allocation');
  run(`S=blankState();S.accounts=[{id:'a1',name:'CDB'},{id:'a2',name:'Tesouro'},{id:'a3',name:'Ações'},{id:'a4',name:'FIIs'}];
    S.snaps=[{date:'2026-10-01',acc:'a1',value:3000,est:false},{date:'2026-10-01',acc:'a2',value:3000,est:false},
             {date:'2026-10-01',acc:'a3',value:3000,est:false},{date:'2026-10-01',acc:'a4',value:1000,est:false}]`);
  eq('type of account',[run("typeOfAccount('CDB').id"),run("typeOfAccount('Ações').id"),run("typeOfAccount('FIIs').id")],['_fixed','acao','fii']);
  const st=run("allocationStatus('2026-10-20')");
  eq('no target: only the current shares',[st.targeted,st.rows.map(r=>[r.id,r.share,r.level])],[false,[['_fixed',0.6,'none'],['acao',0.3,'none'],['fii',0.1,'none']]]);
  ok('set a target',!run("setTarget('_fixed',50)").error);
  run("setTarget('acao',30)");run("setTarget('fii',20)");
  const s2=run("allocationStatus('2026-10-20')");
  eq('gaps and money to move',s2.rows.map(r=>[r.id,r.level,r.money]),[['_fixed','over',-1000],['acao','on',0],['fii','under',1000]]);
  ok('total over 100% is refused',!!run("setTarget('etf',10)").error);
  ok('unknown type is refused',!!run("setTarget('xx',10)").error);
  ok('negative is refused',!!run("setTarget('fii',-1)").error);
  run("setTarget('fii',0)");
  eq('0 removes the target',run("Object.keys(S.targets)"),['_fixed','acao']);
  run("setTarget('etf',20)");
  eq('a type with a target and no balance still appears',run("allocationStatus('2026-10-20').rows.find(r=>r.id==='etf').money"),2000);
  eq('clear',run("clearTargets();Object.keys(S.targets).length"),0);
  return res;};
