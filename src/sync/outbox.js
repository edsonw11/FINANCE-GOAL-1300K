/**
 * sync/outbox.js
 * Responsibility: the sync bookkeeping (what the server knows, what is waiting to be sent) and the step that turns a changed state into outbox entries. Pure functions.
 */
import { legacyKeyOf, splitState } from './records.js';

/** meta: {userId, cursor, merged, ids: ref->uuid, known: ref->fingerprint, settingsFp, outbox: [entry], review: [item], lastSyncAt} */
export const emptyMeta=()=>({v:1,userId:null,cursor:'0',merged:false,ids:{},known:{},settingsFp:null,outbox:[],review:[],lastSyncAt:null});
// an entry: {mutationId, resource, op:'put'|'delete', id, data, attempted}; `attempted` = a send started, so the server may have it
export const wireEntry=e=>({mutationId:e.mutationId,resource:e.resource,op:e.op,id:e.id,...(e.data!==undefined?{data:e.data}:{})});

/**
 * Compares the state with what is known and queues the difference. Returns a new meta (the old one is not changed).
 * ids = {newId(), newMutationId()}. Editing a record that was never sent updates its waiting entry; deleting one that was never sent cancels it.
 */
export function queueChanges(meta,state,ids){
  const next={...meta,ids:{...meta.ids},known:{...meta.known},outbox:meta.outbox.map(e=>({...e}))};
  const {records,settings,settingsFp}=splitState(state);
  const waiting=id=>next.outbox.findIndex(e=>e.id===id&&!e.attempted);
  const push=(resource,op,id,data)=>{
    const at=op==='put'?waiting(id):-1;
    if(at>=0&&next.outbox[at].op==='put'){next.outbox[at].data=data;return;}
    next.outbox.push({mutationId:ids.newMutationId(),resource,op,id,...(data!==undefined?{data}:{}),attempted:false});
  };
  for(const [ref,r] of records){
    if(next.known[ref]===r.fp)continue;
    const id=next.ids[ref]??(next.ids[ref]=ids.newId());
    push(r.kind,'put',id,{body:r.body,legacyKey:legacyKeyOf(r.kind,r.body)});
    next.known[ref]=r.fp;
  }
  for(const ref of Object.keys(next.known)){
    if(records.has(ref))continue;
    const id=next.ids[ref];
    delete next.known[ref];delete next.ids[ref];
    if(!id)continue;
    const at=waiting(id);
    if(at>=0&&next.outbox[at].op==='put'){next.outbox.splice(at,1);continue;} // never sent: nothing to tell the server
    push(ref.slice(0,ref.indexOf(':')),'delete',id);
  }
  if(next.userId&&next.settingsFp!==settingsFp){
    const at=next.outbox.findIndex(e=>e.resource==='state'&&!e.attempted);
    if(at>=0)next.outbox[at].data={body:settings};
    else next.outbox.push({mutationId:ids.newMutationId(),resource:'state',op:'put',id:next.userId,data:{body:settings},attempted:false});
    next.settingsFp=settingsFp;
  }
  return next;
}
export const pendingCount=meta=>meta.outbox.length;
