/**
 * ui/app-lock/lock-screen.js
 * Responsibility: the lock screen itself, a full-screen modal dialog (#lockDlg): show it, hide it, put a message on it, and report the "Unlock" button.
 * A modal dialog sits in the top layer, so it covers every other dialog and sheet; Back / Esc cannot close it.
 */
export function lockScreen(doc=document){
  const dlg=()=>doc.getElementById('lockDlg');
  return {
    isOpen(){const d=dlg();return !!(d&&d.open);},
    show(){const d=dlg();if(d&&!d.open)d.showModal();},
    hide(){const d=dlg();if(d&&d.open)d.close();},
    message(text){const m=doc.getElementById('lockMsg');if(m)m.textContent=text||'';},
    /** The dialog's cancel event (Esc, system Back) must not close it; the button runs `fn`. */
    bind(fn){
      const d=dlg(),b=doc.getElementById('lockRetry');
      if(d)d.addEventListener('cancel',e=>e.preventDefault());
      if(b)b.onclick=fn;
    },
  };
}
