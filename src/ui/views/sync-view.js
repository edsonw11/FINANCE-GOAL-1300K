/**
 * ui/views/sync-view.js
 * Responsibility: Settings → "Conta e sincronização": sign-in, the pending count, the "Sincronizar" button and the review list. Connects the sync to the app's state.
 * Hidden when there is no API to talk to (the page opened as a file or from a plain static server): the app then works exactly as before.
 */
import { t } from '../../core/i18n.js';
import { $, esc } from '../../core/dom.js';
import { STORAGE_KEY } from '../../core/config.js';
import { S, adoptRemoteState, onSave } from '../../domain/store.js';
import { createApiClient, loginUrl } from '../../sync/api-client.js';
import { createSync, metaStore } from '../../sync/runner.js';
import { toast } from '../toast.js';
import { render } from '../render.js';
import { isNative } from '../native-bridge.js';
const DEBOUNCE_MS=400;
const api=createApiClient((...a)=>fetch(...a));
let sync=null;
// checking | unavailable | signed_out | signed_in | other_account
const syncView={state:'checking',user:null,busy:false};
const uuid=()=>crypto.randomUUID();
const when=ms=>ms?new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):t('set.sync.never');
const REASONS={key_conflict:'set.sync.reasonKeyConflict',invalid_data:'set.sync.reasonInvalidData',not_found:'set.sync.reasonNotFound',unknown_resource:'set.sync.reasonUnknownResource'};

export function renderSync(){
  const card=$('syncCard');if(!card)return;
  const hide=syncView.state==='checking'||syncView.state==='unavailable';
  card.hidden=$('syncTitle').hidden=hide;
  const badge=$('syncBadge');
  if(hide){badge.hidden=true;return;}
  const st=sync?sync.status():{pending:0,pendingItems:0,review:0,lastSyncAt:null};
  // what the person sees is records (an expense), not the settings entry that carries the id counter along with it
  const n=st.pendingItems||(st.pending?1:0);
  let html;
  if(syncView.state==='signed_out'){
    html=`<div class="help m0">${t('set.sync.signedOutHelp')}</div>
      <div class="row mt-10"><a class="btn pri" id="syncLogin" href="${loginUrl(location.pathname)}">${t('set.sync.login')}</a></div>`;
  }else if(syncView.state==='other_account'){
    html=`<div class="banner"><span>${t('set.sync.otherAccount',{email:esc(syncView.user.email||t('set.sync.noEmail'))})}</span></div>
      <div class="row mt-10"><button class="btn" id="syncLogout">${t('set.sync.logout')}</button></div>`;
  }else{
    const plan=syncView.user.plan==='pro'?'PRO':t('set.sync.planFree');
    html=`<div class="help m0">${t('set.sync.connected',{who:esc(syncView.user.email||syncView.user.displayName||t('set.sync.yourAccount')),plan:esc(plan)})}</div>
      <div class="row mt-10"><button class="btn pri" id="syncNow"${syncView.busy?' disabled':''}>${syncView.busy?t('set.sync.syncing'):t('set.sync.syncNow')}</button><button class="btn" id="syncLogout">${t('set.sync.logout')}</button></div>
      <div class="help" id="syncStatus">${n?t('set.sync.statusPending',{count:n,when:when(st.lastSyncAt)}):t('set.sync.statusDone',{when:when(st.lastSyncAt)})}</div>`;
    if(st.review){
      const items=sync.reviewItems().slice(0,20).map(i=>`<li>${esc(i.resource||i.ref||t('set.sync.item'))}: ${esc(REASONS[i.reason]?t(REASONS[i.reason]):i.reason)}</li>`).join('');
      html+=`<div class="banner mt-10"><span>${t('set.sync.review',{count:st.review})}<ul>${items}</ul></span><button class="btn sm" id="syncClear">${t('set.sync.understood')}</button></div>`;
    }
  }
  $('syncBody').innerHTML=html;
  // signed in: the sync state; signed out: a shortcut to sign in (a link, so it also works when the script is slow)
  badge.hidden=syncView.state!=='signed_in'&&syncView.state!=='signed_out';
  badge.classList.toggle('warn',syncView.state==='signed_in'&&(!!n||!!st.review));
  if(syncView.state==='signed_out'){badge.textContent=t('set.sync.badgeLogin');badge.href=loginUrl(location.pathname);badge.title=t('set.sync.badgeLoginTitle');}
  else if(!badge.hidden){badge.removeAttribute('href');badge.removeAttribute('title');badge.textContent=syncView.busy?t('set.sync.badgeSyncing'):n?t('set.sync.badgePending',{count:n}):t('set.sync.badgeUpToDate');}
  const now=$('syncNow');if(now)now.onclick=()=>syncView.go(true);
  const out=$('syncLogout');if(out)out.onclick=signOut;
  const clr=$('syncClear');if(clr)clr.onclick=()=>{sync.clearReview();renderSync();};
}

async function runSync(manual){
  if(!sync||syncView.busy||syncView.state!=='signed_in')return;
  syncView.busy=true;renderSync();
  const r=await sync.run();
  syncView.busy=false;
  if(r.reason==='unauthorized'){syncView.state='signed_out';}
  renderSync();
  if(manual||!r.ok&&r.reason==='unauthorized')toast(r.ok?t('set.sync.done'):t(MESSAGES[r.reason]||MESSAGES.error));
}
const MESSAGES={
  offline:'set.sync.msgOffline',
  unauthorized:'set.sync.msgUnauthorized',
  server:'set.sync.msgServer',
  error:'set.sync.msgError',
  not_signed_in:'set.sync.msgNotSignedIn',
};
async function signOut(){await api.logout();syncView.state='signed_out';syncView.user=null;renderSync();}

export async function bindSync(){
  // inside the Android shell there is no API on this origin (and the login is cookie based): the app works offline there until the phone has its own sign-in
  if(typeof fetch!=='function'||location.protocol==='file:'||isNative()){syncView.state='unavailable';return;}
  const me=await api.me();
  syncView.state=me.state;syncView.user=me.user||null;
  if(me.state==='signed_in'){
    let changed=false;
    sync=createSync({api,store:metaStore(localStorage,STORAGE_KEY+'.sync'),getState:()=>S,
      setState:next=>{changed=true;adoptRemoteState(next);},newId:uuid,newMutationId:uuid,now:()=>Date.now()});
    const bound=sync.bind(me.user.id);
    if(!bound.ok){syncView.state='other_account';sync=null;}
    else{
      let timer=null;
      onSave(()=>{clearTimeout(timer);timer=setTimeout(()=>{sync.capture();renderSync();},DEBOUNCE_MS);});
      const go=async manual=>{changed=false;await runSync(manual);if(changed)render();};
      window.addEventListener('online',()=>go(false));
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')go(false);});
      syncView.go=go;go(false);
    }
  }
  renderSync();
}
