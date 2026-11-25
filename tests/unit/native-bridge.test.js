/**
 * The Android shell: how the app knows it is inside one, and how a backup leaves the phone.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,ok,res}=suite('native-bridge');
  const N=await import(pathToFileURL(path.join(root,'src','ui','native-bridge.js')).href);
  // a scripted Capacitor: records what was asked of the plugins
  const fake=(over={})=>{const calls=[];const cap={isNativePlatform:()=>true,calls,Plugins:{
    Filesystem:{writeFile:async o=>{calls.push(['write',o]);return {uri:'file:///cache/'+o.path};}},
    Share:{share:async o=>{calls.push(['share',o]);}}}};
    return Object.assign(cap,over);};

  eq('no Capacitor object: a browser',N.isNative(undefined),false);
  eq('Capacitor on the web (the library without a shell)',N.isNative({isNativePlatform:()=>false}),false);
  eq('Capacitor inside the shell',N.isNative({isNativePlatform:()=>true}),true);
  eq('an object that is not Capacitor',N.isNative({}),false);
  eq('isNativePlatform that is not a function',N.isNative({isNativePlatform:true}),false);

  let c=fake();
  eq('a backup is written to the cache, then shared by the file address',await N.shareTextFile('{"a":1}','b.json',c),{ok:true});
  eq('the file is written as text in the cache',c.calls[0],['write',{path:'b.json',data:'{"a":1}',directory:'CACHE',encoding:'utf8'}]);
  eq('the share sheet gets the address of that file',c.calls[1][1].url,'file:///cache/b.json');
  eq('write happens before share',c.calls.map(x=>x[0]),['write','share']);

  c=fake();c.Plugins.Share.share=async()=>{throw new Error('Share canceled');};
  eq('closing the share sheet is a cancel, not an error',await N.shareTextFile('x','b.json',c),{ok:false,cancelled:true});
  c=fake();c.Plugins.Filesystem.writeFile=async()=>{throw new Error('disk full');};
  eq('a write failure is reported with its reason',await N.shareTextFile('x','b.json',c),{ok:false,error:'disk full'});
  c=fake();c.Plugins.Filesystem.writeFile=async()=>{throw 'plain string';};
  eq('a thrown string is reported too',await N.shareTextFile('x','b.json',c),{ok:false,error:'plain string'});
  ok('after a write failure nothing is shared',!c.calls.some(x=>x[0]==='share'));

  eq('outside the shell it does nothing',await N.shareTextFile('x','b.json',{isNativePlatform:()=>false,Plugins:{}}),{ok:false,error:'sharing is not available here'});
  eq('without Capacitor it does nothing',await N.shareTextFile('x','b.json',undefined),{ok:false,error:'sharing is not available here'});
  c=fake();delete c.Plugins.Share;
  eq('a missing plugin is reported (not a crash)',await N.shareTextFile('x','b.json',c),{ok:false,error:'sharing is not available here'});
  c=fake();c.Plugins.Filesystem=undefined;
  eq('a missing filesystem plugin is reported too',await N.shareTextFile('x','b.json',c),{ok:false,error:'sharing is not available here'});

  // ---- the Back button ----
  const scr=(o={})=>Object.assign({confirmOpen:false,dialogOpen:false,sheetOpen:false,sheetDepth:1,tab:'resumo'},o);
  eq('Back with nothing open on the summary leaves the app',N.backAction(scr()),'exit');
  eq('Back on another tab goes to the summary first',N.backAction(scr({tab:'lanc'})),'home');
  eq('Back with no tab known (nothing selected) leaves',N.backAction(scr({tab:''})),'exit');
  eq('Back closes a sheet',N.backAction(scr({sheetOpen:true})),'sheet-close');
  eq('Back inside a sheet one level down goes up one level',N.backAction(scr({sheetOpen:true,sheetDepth:2})),'sheet-back');
  eq('Back closes another dialog before the sheet under it',N.backAction(scr({sheetOpen:true,dialogOpen:true})),'dialog-close');
  eq('Back answers the confirmation before anything else',N.backAction(scr({sheetOpen:true,dialogOpen:true,confirmOpen:true,tab:'cfg'})),'confirm-cancel');
  eq('an open sheet beats the tab rule',N.backAction(scr({sheetOpen:true,tab:'cfg'})),'sheet-close');

  // a page made of plain objects: only what readScreen and doBack touch
  const page=(o={})=>{const clicks=[],closed=[];const els={};
    for(const id of ['confirmDlg','itemDlg','sugDlg','catDlg','sheet'])els[id]={id,open:!!(o.open||[]).includes(id),close(){this.open=false;closed.push(id);}};
    els.shBack={hidden:!o.deep};
    const sel={'#cfCancel':'cfCancel','#shBack':'shBack','#shClose':'shClose','#nav [data-t=resumo]':'home','#nav button.on':null};
    return {clicks,closed,els,getElementById:id=>els[id]||null,
      querySelector:q=>q==='#nav button.on'?(o.tab?{dataset:{t:o.tab}}:null):(q in sel?{click:()=>clicks.push(sel[q])}:null)};};
  eq('readScreen: nothing open, no tab selected',N.readScreen(page()),{confirmOpen:false,dialogOpen:false,sheetOpen:false,sheetDepth:1,tab:'resumo'});
  eq('readScreen: sheet open two levels deep on the Ajustes tab',N.readScreen(page({open:['sheet'],deep:true,tab:'cfg'})),{confirmOpen:false,dialogOpen:false,sheetOpen:true,sheetDepth:2,tab:'cfg'});
  eq('readScreen: a confirmation over a sheet',N.readScreen(page({open:['sheet','confirmDlg']})).confirmOpen,true);
  eq('readScreen: any of the other dialogs counts',[ 'itemDlg','sugDlg','catDlg'].map(d=>N.readScreen(page({open:[d]})).dialogOpen),[true,true,true]);
  let pg=page();N.doBack('confirm-cancel',pg);N.doBack('sheet-back',pg);N.doBack('sheet-close',pg);N.doBack('home',pg);
  eq('doBack presses the app\'s own controls',pg.clicks,['cfCancel','shBack','shClose','home']);
  pg=page({open:['sugDlg','sheet']});N.doBack('dialog-close',pg);
  eq('doBack closes the open dialog, not the sheet',[pg.closed,pg.els.sheet.open],[['sugDlg'],true]);
  pg=page();N.doBack('dialog-close',pg);N.doBack('home',{querySelector:()=>null});
  eq('doBack with nothing to act on does nothing',pg.closed,[]);
  let exits=0;const withApp=(extra={})=>Object.assign(fake(),{Plugins:{App:Object.assign({exitApp:()=>{exits++;}},extra)}});
  N.doBack('exit',page(),withApp());eq('doBack exit leaves the app through the plugin',exits,1);
  N.doBack('exit',page(),{Plugins:{}});N.doBack('exit',page(),undefined);eq('doBack exit without the plugin does not crash',exits,1);

  // the listener
  let handler;const cap2=withApp({addListener:(name,fn)=>{eq('the listener is for the Back button',name,'backButton');handler=fn;}});
  eq('bindNativeBack listens inside the shell',N.bindNativeBack(page(),cap2),true);
  pg=page({open:["sheet"],tab:"cfg"});N.bindNativeBack(pg,cap2);handler();
  eq('a Back press closes the sheet and the app stays',[pg.clicks,exits],[['shClose'],1]);
  pg=page({tab:'resumo'});N.bindNativeBack(pg,cap2);handler();
  eq('a Back press on the summary with nothing open leaves',exits,2);
  eq('bindNativeBack does nothing in a browser',N.bindNativeBack(page(),{isNativePlatform:()=>false,Plugins:{App:{addListener(){throw new Error('no');}}}}),false);
  eq('bindNativeBack without the plugin does nothing',N.bindNativeBack(page(),fake()),false);
  eq('bindNativeBack without Capacitor does nothing',N.bindNativeBack(page(),undefined),false);
  return res;};
