/**
 * tests/fixtures/fake-api.js
 * Responsibility: a scripted API for the browser smoke test of the sync card: replaces fetch before the app starts (me, push, changes, logout). Test-only.
 */
(function(){
  const hash=new URLSearchParams(location.hash.slice(1));
  const fake={version:0,rows:new Map(),pushes:[],down:false,signedIn:!hash.has('signedout'),logouts:0,
    // what "another device" did: the app finds it on the next sync
    addRemote(resource,id,body,legacyKey){fake.rows.set(id,{resource,id,version:++fake.version,deleted:false,data:{body,legacyKey:legacyKey??null}});}};
  window.__fake=fake;
  const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'content-type':'application/json'}});
  window.fetch=async(url,init={})=>{
    if(fake.down)throw new TypeError('network down');
    const u=new URL(url,location.href),method=init.method||'GET';
    if(u.pathname==='/api/v1/me')return fake.signedIn?json({id:'11111111-1111-4111-8111-111111111111',email:'ana@example.test',displayName:'Ana',plan:'free',features:{}}):json({},401);
    if(!fake.signedIn)return json({},401);
    if(u.pathname==='/auth/logout'&&method==='POST'){fake.logouts++;fake.signedIn=false;return json({ok:true});}
    if(u.pathname==='/api/v1/sync/push'&&method==='POST'){
      const {mutations}=JSON.parse(init.body);
      return json({results:mutations.map(m=>{
        fake.pushes.push(m);
        if(m.resource!=='state'){
          if(m.op==='delete'){const r=fake.rows.get(m.id);if(r){r.deleted=true;r.version=++fake.version;}}
          else fake.rows.set(m.id,{resource:m.resource,id:m.id,version:++fake.version,deleted:false,data:m.data});
        }
        return {mutationId:m.mutationId,status:'applied',version:fake.version};})});
    }
    if(u.pathname==='/api/v1/sync/changes'){
      const after=+u.searchParams.get('cursor'),changes=[...fake.rows.values()].filter(r=>r.version>after).sort((a,b)=>a.version-b.version)
        .map(r=>({resource:r.resource,id:r.id,version:r.version,deleted:r.deleted,data:r.deleted?null:r.data}));
      return json({changes,cursor:String(changes.length?changes[changes.length-1].version:after),hasMore:false});
    }
    return json({},404);
  };
})();
