/**
 * ui/components/sheet.js
 * Responsibility: the single detail panel of the app. A modal dialog on desktop and a bottom sheet
 * on phones, with a stack of views (list -> item -> edit) and a back button.
 * A view is {render(body,foot) -> {title,sub}|null, leave(), static}. render() returning null means
 * "nothing left to show" (for example, the record was deleted) and the view is popped.
 * Static views (the transaction form) are drawn once and are not redrawn by refresh().
 */
export const Sheet=(()=>{
  const stack=[];
  const el=id=>document.getElementById(id);
  function draw(){
    const v=stack[stack.length-1];
    if(!v)return close();
    const body=el('shBody'),foot=el('shFoot');
    if(!v.static||!v._drawn){
      foot.innerHTML='';
      const r=v.render(body,foot);
      if(!r){stack.pop();if(v.leave)v.leave();return draw();}
      v._head=r;v._drawn=true;
    }
    el('shTitle').innerHTML=v._head.title||'';
    el('shSub').innerHTML=v._head.sub||'';el('shSub').hidden=!v._head.sub;
    el('shBack').hidden=stack.length<2;
    foot.hidden=!foot.childElementCount;
  }
  function leaveAll(){while(stack.length){const v=stack.pop();if(v.leave)v.leave();}}
  function open(view){leaveAll();stack.push(view);const d=el('sheet');el('shBody').scrollTop=0;draw();if(!d.open)d.showModal();}
  function push(view){if(!stack.length)return open(view);const v=stack[stack.length-1];if(v.static&&v.leave){v.leave();v._drawn=false;}
    stack.push(view);el('shBody').scrollTop=0;draw();}
  function pop(){const v=stack.pop();if(v&&v.leave)v.leave();if(!stack.length)return close();el('shBody').scrollTop=0;draw();}
  function refresh(){if(!el('sheet').open||!stack.length)return;const v=stack[stack.length-1];if(v.static)return;
    const top=el('shBody').scrollTop;draw();el('shBody').scrollTop=top;}
  function close(){leaveAll();const d=el('sheet');if(d.open)d.close();}
  const depth=()=>stack.length,top=()=>stack[stack.length-1];
  function bind(){
    const d=el('sheet');
    el('shClose').onclick=close;el('shBack').onclick=pop;
    // Esc, Android back gesture and backdrop tap close the sheet
    // the close event arrives later (async): ignore it if the sheet was opened again meanwhile
    d.addEventListener('close',()=>{if(!d.open)leaveAll();});
    d.addEventListener('cancel',e=>{if(stack.length>1){e.preventDefault();pop();}});
    d.addEventListener('click',e=>{if(e.target===d)close();});
  }
  return {open,push,pop,refresh,close,depth,top,bind};
})();
