/**
 * ui/views/sync-view.js
 * Responsibility: Settings → "Conta e sincronização": sign-in, the pending count, the "Sincronizar" button and the review list. Connects the sync to the app's state.
 * Hidden when there is no API to talk to (the page opened as a file or from a plain static server): the app then works exactly as before.
 */
import { $, esc } from '../../core/dom.js';
import { STORAGE_KEY } from '../../core/config.js';
import { S, adoptRemoteState, onSave } from '../../domain/store.js';
import { createApiClient, loginUrl } from '../../sync/api-client.js';
import { createSync, metaStore } from '../../sync/runner.js';
import { toast } from '../toast.js';
import { render } from '../render.js';
const DEBOUNCE_MS=400;
const api=createApiClient((...a)=>fetch(...a));
let sync=null;
// checking | unavailable | signed_out | signed_in | other_account
const syncView={state:'checking',user:null,busy:false};
const uuid=()=>crypto.randomUUID();
const when=ms=>ms?new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'ainda não';
const REASONS={key_conflict:'o mesmo número foi usado em outro aparelho',invalid_data:'o servidor não aceitou este item',not_found:'o item pertence a outra conta',unknown_resource:'tipo desconhecido'};

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
    html=`<div class="help m0">Entre para guardar seus dados na sua conta e usar em outros aparelhos. O que já está neste aparelho continua aqui e sobe na primeira sincronização.</div>
      <div class="row mt-10"><a class="btn pri" id="syncLogin" href="${loginUrl(location.pathname)}">Entrar</a></div>`;
  }else if(syncView.state==='other_account'){
    html=`<div class="banner"><span>⚠️ Este aparelho já está ligado a outra conta (${esc(syncView.user.email||'sem e-mail')} acabou de entrar). Para não misturar dados, nada foi enviado nem recebido.</span></div>
      <div class="row mt-10"><button class="btn" id="syncLogout">Sair</button></div>`;
  }else{
    const plan=syncView.user.plan==='pro'?'PRO':'Gratuito';
    html=`<div class="help m0">Conectado como <b>${esc(syncView.user.email||syncView.user.displayName||'sua conta')}</b> · plano ${esc(plan)}</div>
      <div class="row mt-10"><button class="btn pri" id="syncNow"${syncView.busy?' disabled':''}>${syncView.busy?'Sincronizando…':'🔄 Sincronizar'}</button><button class="btn" id="syncLogout">Sair</button></div>
      <div class="help" id="syncStatus">${n?`<b>${n}</b> pendente${n>1?'s':''} · `:'Tudo enviado · '}última sincronização: ${when(st.lastSyncAt)}</div>`;
    if(st.review){
      const items=sync.reviewItems().slice(0,20).map(i=>`<li>${esc(i.resource||i.ref||'item')}: ${esc(REASONS[i.reason]||i.reason)}</li>`).join('');
      html+=`<div class="banner mt-10"><span>⚠️ ${st.review} ${st.review>1?'itens precisam':'item precisa'} de revisão. Seus dados neste aparelho não foram alterados.<ul>${items}</ul></span><button class="btn sm" id="syncClear">Entendi</button></div>`;
    }
  }
  $('syncBody').innerHTML=html;
  badge.hidden=syncView.state!=='signed_in';
  if(!badge.hidden){badge.textContent=syncView.busy?'☁️ sincronizando…':n?`☁️ ${n} pendente${n>1?'s':''}`:'☁️ em dia';badge.classList.toggle('warn',!!n||!!st.review);}
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
  if(manual||!r.ok&&r.reason==='unauthorized')toast(r.ok?'✅ Sincronizado':MESSAGES[r.reason]||MESSAGES.error);
}
const MESSAGES={
  offline:'⚠️ Sem conexão. Suas alterações ficam guardadas e serão enviadas depois.',
  unauthorized:'⚠️ Sua sessão terminou. Entre de novo; nada foi perdido.',
  server:'⚠️ O servidor não respondeu direito. Tente de novo em instantes.',
  error:'⚠️ Não foi possível sincronizar agora.',
  not_signed_in:'⚠️ Entre na sua conta para sincronizar.',
};
async function signOut(){await api.logout();syncView.state='signed_out';syncView.user=null;renderSync();}

export async function bindSync(){
  if(typeof fetch!=='function'||location.protocol==='file:'){syncView.state='unavailable';return;}
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
