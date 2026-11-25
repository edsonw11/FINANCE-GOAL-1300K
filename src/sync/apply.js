/**
 * sync/apply.js
 * Responsibility: puts what the server reports (changes pulled from it) into the local state and bookkeeping, without echoing it back. Pure functions.
 */
import { LISTS, LISTS_MARK, fingerprint, keyOf, listOfKind, refOf, splitState } from './records.js';

const clone=v=>JSON.parse(JSON.stringify(v));
// 'a12', 't7', 'tr3' and plain numbers come from the counter `nid`: a device must not hand out a number another device already used
const counterOf=key=>{const m=/^(?:a|t|tr)?(\d+)$/.exec(String(key));return m?+m[1]:0;};

/**
 * Applies a page of changes. Returns {state, meta, conflicts}; neither input is changed.
 * - a record waiting to be sent here wins over the server's version (the last writer by arrival decides when it is sent);
 * - a delete wins over a waiting edit (ADR-0008);
 * - the same key under another id: on the first merge on this device it is the same record (adopted); later it is a clash, kept for the person to review.
 */
export function applyChanges(state,meta,changes){
  const next=clone(state),m={...meta,ids:{...meta.ids},known:{...meta.known},outbox:meta.outbox.map(e=>({...e})),review:[...meta.review]};
  const firstMerge=!meta.merged;
  const touched=new Set();
  const byId=new Map(Object.entries(m.ids).map(([ref,id])=>[id,ref]));
  const waiting=id=>m.outbox.findIndex(e=>e.id===id);
  for(const c of changes){
    if(c.resource==='state'){
      if(c.deleted||!c.data)continue;
      const waitingAt=m.outbox.findIndex(e=>e.resource==='state');
      // settings waiting to be sent win, except on the first merge: a new device must never overwrite the account's settings with its blank ones
      if(waitingAt>=0){if(!firstMerge)continue;m.outbox.splice(waitingAt,1);}
      const body=c.data.body,keep={},counter=+next.nid||1;
      for(const n of Object.keys(LISTS))if(Array.isArray(next[n]))keep[n]=next[n];
      for(const k of Object.keys(next))delete next[k];
      for(const [k,v] of Object.entries(body))if(k!==LISTS_MARK)next[k]=clone(v);
      Object.assign(next,keep);
      if(body.nid!==undefined||counter>1)next.nid=Math.max(+body.nid||1,counter); // the counter only goes up
      for(const n of Array.isArray(body[LISTS_MARK])?body[LISTS_MARK]:[])if(Object.hasOwn(LISTS,n)&&!Array.isArray(next[n]))next[n]=[];
      m.settingsFp=splitState(next).settingsFp;
      continue;
    }
    const kind=c.resource,name=listOfKind(kind);
    if(!name)continue;
    if(c.deleted){
      const ref=byId.get(c.id);if(!ref)continue;
      const at=waiting(c.id);if(at>=0)m.outbox.splice(at,1);
      const key=ref.slice(ref.indexOf(':')+1);
      next[name]=(next[name]||[]).filter(b=>keyOf(kind,b)!==key);
      delete m.ids[ref];delete m.known[ref];byId.delete(c.id);
      continue;
    }
    const body=c.data&&c.data.body,key=keyOf(kind,body);
    if(key===null)continue;
    const ref=refOf(kind,key),fp=fingerprint(body),localId=m.ids[ref];
    if(localId&&localId!==c.id){
      if(!firstMerge){m.review.push({reason:'key_conflict',ref,resource:kind,id:c.id,body:clone(body)});continue;}
      // the same record this device already had: adopt the server's id; what was waiting for the old id now goes under the new one
      for(const e of m.outbox)if(e.id===localId)e.id=c.id;
      byId.delete(localId);m.ids[ref]=c.id;byId.set(c.id,ref);
      const at=waiting(c.id);
      if(at>=0&&m.outbox[at].data&&fingerprint(m.outbox[at].data.body)===fp){m.outbox.splice(at,1);m.known[ref]=fp;}
      continue;
    }
    if(waiting(c.id)>=0){m.ids[ref]=c.id;byId.set(c.id,ref);continue;}
    const list=next[name]||(next[name]=[]);
    const at=list.findIndex(b=>keyOf(kind,b)===key);
    if(at>=0)list[at]=clone(body);else list.push(clone(body));
    m.ids[ref]=c.id;m.known[ref]=fp;byId.set(c.id,ref);touched.add(ref);
    if(kind!=='snap'&&kind!=='import')next.nid=Math.max(+next.nid||1,counterOf(key)+1);
  }
  return {state:next,meta:m,conflicts:m.review.length-meta.review.length};
}
