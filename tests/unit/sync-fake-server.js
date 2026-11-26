/**
 * tests/unit/sync-fake-server.js
 * Responsibility: a small in-memory server that keeps the contract of POST /sync/push and GET /sync/changes (ids chosen by the device, idempotent mutations, tombstones, one version counter), for the sync tests.
 */
function createServer(){
  const s={version:0,rows:new Map(),answers:new Map(),state:null,down:false,unauthorized:false,pushes:0,reject:()=>null};
  const fail=()=>{if(s.unauthorized)throw {kind:'unauthorized'};if(s.down)throw {kind:'offline'};};
  const apply=m=>{
    const forced=s.reject(m);if(forced)return {status:'rejected',reason:forced};
    if(m.resource==='state'){
      if(m.op!=='put')return {status:'rejected',reason:'invalid_data'};
      s.state={version:++s.version,body:m.data.body,id:m.id};return {status:'applied',version:s.state.version};
    }
    const row=s.rows.get(m.id);
    if(m.op==='delete'){if(row&&!row.deleted){row.deleted=true;row.version=++s.version;}return {status:'applied',version:null};}
    if(row&&row.deleted)return {status:'superseded',reason:'deleted'};
    const key=m.data.legacyKey;
    if(key!==null&&key!==undefined)for(const [id,r] of s.rows)if(id!==m.id&&!r.deleted&&r.resource===m.resource&&r.legacyKey===key)return {status:'rejected',reason:'invalid_data'};
    if(row&&JSON.stringify(row.body)===JSON.stringify(m.data.body))return {status:'applied',version:row.version};
    s.rows.set(m.id,{resource:m.resource,id:m.id,body:m.data.body,legacyKey:key??null,deleted:false,version:++s.version});
    return {status:'applied',version:s.version};
  };
  const api={
    async push(mutations){
      fail();s.pushes++;
      const results=[];let stopped=false;
      for(const m of mutations){
        if(stopped){results.push({mutationId:m.mutationId,status:'skipped'});continue;}
        const seen=s.answers.get(m.mutationId),out=seen||apply(m);
        s.answers.set(m.mutationId,out);results.push({mutationId:m.mutationId,...out});
        if(out.status==='rejected')stopped=true;
      }
      return {results};
    },
    async changes(cursor,limit=1000){
      fail();
      const after=+cursor,all=[];
      for(const r of s.rows.values())if(r.version>after)all.push({resource:r.resource,id:r.id,version:r.version,deleted:r.deleted,data:r.deleted?null:{body:r.body,legacyKey:r.legacyKey}});
      if(s.state&&s.state.version>after)all.push({resource:'state',id:s.state.id,version:s.state.version,deleted:false,data:{body:s.state.body}});
      all.sort((a,b)=>a.version-b.version);
      const page=all.slice(0,limit),last=page[page.length-1];
      return {changes:page,cursor:String(last?last.version:after),hasMore:all.length>limit};
    },
  };
  s.api=api;
  s.live=resource=>[...s.rows.values()].filter(r=>r.resource===resource&&!r.deleted);
  return s;
}
module.exports={createServer};
