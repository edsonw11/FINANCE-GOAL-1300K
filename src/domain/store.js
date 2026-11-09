/**
 * domain/store.js
 * Responsibility: Application state (S) and localStorage persistence: seed, load, save, migrations.
 */
const seed=()=>({v:2,goal:1300000,rate:12.5,planned:0,nid:1,
  accounts:[{id:'nu',name:'Nubank'},{id:'in',name:'Inter'},{id:'s28',name:'Tesouro Selic 2028'},{id:'s31',name:'Tesouro Selic 2031'}],
  snaps:[['nu',157062.83,true,159830.14],['in',154796,true],['s28',395040,true],['s31',423375,true]].map(([acc,value,est,gross])=>gross?({date:'2026-11-06',acc,value,est,gross}):({date:'2026-11-06',acc,value,est})),
  tx:[]});
// Santander was emptied: moves the balance to Nubank and archives the account (once)
function migrate(){
  const sa=S.accounts.find(a=>a.id==='sa'),nu=S.accounts.find(a=>a.id==='nu');
  if(!sa||sa.archived||!nu)return;
  const d=today(),vSa=balance('sa',d).v,vNu=balance('nu',d).v;
  S.snaps=S.snaps.filter(s=>!(s.date===d&&(s.acc==='sa'||(vSa>0.005&&s.acc==='nu'))));
  if(vSa>0.005)S.snaps.push({date:d,acc:'nu',value:vNu+vSa,est:false});
  S.snaps.push({date:d,acc:'sa',value:0,est:false});
  sa.archived=true;save();
}
function load(){try{const r=JSON.parse(localStorage.getItem(STORAGE_KEY));if(r&&r.v===2)return r;}catch(e){}return seed();}
var _al=null;
function save(){_al=null;localStorage.setItem(STORAGE_KEY,JSON.stringify(S));}
let S=load(), cur=mOf(today()), type='despesa', filt='todos', q='', editId=null;
