/**
 * sync/runner.js
 * Responsibility: one sync run: send the outbox, then pull what changed; keeps the outbox safe when the network or the login fails. No DOM, no storage of its own.
 */
import { applyChanges } from './apply.js';
import { emptyMeta, queueChanges, wireEntry } from './outbox.js';

export const BATCH=100;
/** The sync bookkeeping lives under one storage key, next to the app's own data. */
export function metaStore(storage,key){
  return {
    load(){try{const m=JSON.parse(storage.getItem(key));return m&&m.v===1?{...emptyMeta(),...m}:emptyMeta();}catch(e){return emptyMeta();}},
    save(meta){storage.setItem(key,JSON.stringify(meta));},
  };
}

/**
 * deps: {api:{push(mutations), changes(cursor)}, store, getState(), setState(state), newId(), newMutationId(), now()}
 * The api throws an object {kind:'offline'|'unauthorized'|'server'} when it cannot answer; the outbox is then kept as it is.
 */
export function createSync(deps){
  const {api,store,getState,setState,newId,newMutationId,now}=deps;
  let running=null;
  const ids={newId,newMutationId};
  const capture=()=>{const before=store.load(),after=queueChanges(before,getState(),ids);store.save(after);return after;};

  // The app can save (and so queue changes) while a request is in flight, so the bookkeeping is read again after every wait, never kept across one.
  async function pull(){
    for(;;){
      const cursor=store.load().cursor;
      const page=await api.changes(cursor);
      const applied=applyChanges(getState(),store.load(),page.changes);
      const m=applied.meta;m.cursor=page.cursor;
      if(page.changes.length>0)setState(applied.state);
      store.save(m);
      if(!page.hasMore)break;
    }
    store.save({...store.load(),merged:true});
  }

  async function push(){
    for(;;){
      const before=store.load();
      if(before.outbox.length===0)return;
      const batch=before.outbox.slice(0,BATCH);
      for(const e of batch)e.attempted=true;
      store.save(before); // a send is starting: from now on the server may have these
      const {results}=await api.push(batch.map(wireEntry));
      const byId=new Map(results.map(r=>[r.mutationId,r]));
      const m=store.load();let done=0;
      for(const e of batch){
        const r=byId.get(e.mutationId);
        if(!r||r.status==='skipped')continue;
        m.outbox=m.outbox.filter(x=>x.mutationId!==e.mutationId);done++;
        if(r.status==='rejected')m.review.push({reason:r.reason,resource:e.resource,id:e.id,op:e.op,data:e.data});
      }
      store.save(m);
      if(done===0)throw {kind:'server'}; // an answer that settles nothing: stop, the outbox stays
    }
  }

  async function runOnce(){
    let m=capture();
    if(!m.userId)return {ok:false,reason:'not_signed_in'};
    try{
      if(!m.merged)await pull();       // the first time: look at what the server has before sending, so the same record is not made twice
      capture();
      await push();
      await pull();
      m=capture();
      m.lastSyncAt=now();store.save(m);
      return {ok:true,pending:m.outbox.length,review:m.review.length};
    }catch(e){
      return {ok:false,reason:(e&&e.kind)||'error',pending:store.load().outbox.length};
    }
  }
  return {
    capture,
    /** Binds the bookkeeping to the signed-in person. Another person on the same device is refused: their data must not go to this account. */
    bind(userId){
      const m=store.load();
      if(m.userId&&m.userId!==userId)return {ok:false,reason:'other_account'};
      if(!m.userId)store.save({...m,userId});
      return {ok:true};
    },
    reviewItems(){return store.load().review;},
    clearReview(){store.save({...store.load(),review:[]});},
    run(){return running??=runOnce().finally(()=>{running=null;});},
    status(){const m=store.load();return {pending:m.outbox.length,pendingItems:m.outbox.filter(e=>e.resource!=='state').length,review:m.review.length,lastSyncAt:m.lastSyncAt,signedIn:!!m.userId};},
  };
}
