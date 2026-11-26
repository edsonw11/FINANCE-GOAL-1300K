/**
 * sync/api-client.js
 * Responsibility: talks to the API (push, changes, who am I) and turns every failure into the few kinds the sync understands. fetch is injected.
 */
const JSON_HEADERS={'content-type':'application/json','x-everfox-csrf':'1'};
/** @param {typeof fetch} fetchFn @param {string} [base] */
export function createApiClient(fetchFn,base=''){
  async function call(method,path,body){
    let res;
    try{res=await fetchFn(base+path,{method,credentials:'same-origin',headers:JSON_HEADERS,body:body===undefined?undefined:JSON.stringify(body)});}
    catch(e){throw {kind:'offline'};}
    if(res.status===401)throw {kind:'unauthorized'};
    if(!res.ok)throw {kind:'server',status:res.status};
    try{return await res.json();}catch(e){throw {kind:'server',status:res.status};}
  }
  return {
    push:mutations=>call('POST','/api/v1/sync/push',{mutations}),
    changes:cursor=>call('GET','/api/v1/sync/changes?cursor='+encodeURIComponent(cursor)+'&limit=1000'),
    /** {state:'signed_in',user} | {state:'signed_out'} | {state:'unavailable'}: unavailable = no API here (a file, a static server, no network). */
    async me(){
      try{const user=await call('GET','/api/v1/me');return user&&typeof user.id==='string'?{state:'signed_in',user}:{state:'unavailable'};}
      catch(e){return e&&e.kind==='unauthorized'?{state:'signed_out'}:{state:'unavailable'};}
    },
    async logout(){try{await call('POST','/auth/logout');return true;}catch(e){return false;}},
  };
}
export const loginUrl=(returnTo='/')=>'/auth/login?returnTo='+encodeURIComponent(returnTo);
