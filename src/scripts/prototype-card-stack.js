// THROWAWAY. Ported from portfolio/experiments/card-stack-motion.html (motion 3).
// Preserve the user-selected kinetics; state and listeners live only on this route.
let stop = () => {};
function init() {
 stop();
 if (!document.body.classList.contains('stack-prototype')) return;
 const controller=new AbortController();
 const listen=(target,event,handler)=>target.addEventListener(event,handler,{signal:controller.signal});
 const cards=[...document.querySelectorAll('.stack-sizer .deck-card')].map(node=>node.innerHTML);
 const picks=[...document.querySelectorAll('[data-case-pick]')];
 const letters=picks.map(node=>node.dataset.name);
 const shortcutToggle=document.querySelector('[data-shortcuts-toggle]');
 // Keep the selected full-length motion even when keys interrupt a swap.
 const swapDuration=480;
 let active=0,busy=false,queued=null,lastPair=[0,1];
 let animations=[],extras=[],runToken=0,settlingTarget=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let magnetic={freeze:()=> 'none',resume:()=>{},cancel:()=>{}};
function initMagnetic(){
 const front=document.getElementById('preview'),deck=document.querySelector('.deck');
 const hit=deck;hit.classList.add('magnetic-hit');front.classList.add('magnetic-card');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 let inside=false,x=0,y=0,frame=0,press=null,drag=null,dragFrame=0;
 const enabled=()=>fine.matches&&!reduced.matches;
 function paint(){
  frame=0;if(busy||press)return;
  const hover=inside&&enabled();
  front.style.transition=enabled()?`transform ${hover?160:520}ms cubic-bezier(.22,.61,.36,1)`:'none';
  front.style.willChange=hover?'transform':'';
  front.style.transform=hover?`perspective(1200px) translate3d(${x*20}px,${y*16}px,24px) rotateX(${y*6}deg) rotateY(${-x*8}deg)`:'none';
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint)}
 function track(e){
  if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
  if(!enabled())return;
  const r=hit.getBoundingClientRect();inside=true;
  x=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));
  y=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));if(!press)schedule();
 }
 function freeze(){const pose=getComputedStyle(front).transform;cancelAnimationFrame(frame);frame=0;front.style.transition='none';front.style.transform='none';front.style.willChange='';return pose}
 function beginDrag(){
  const pose=freeze(),r=hit.getBoundingClientRect();
  preserveFocus(active);
  busy=true;++runToken;queued=null;
  drag={from:active,to:(active+1)%4,dx:0,dy:0,pose,threshold:Math.max(80,Math.min(140,Math.min(r.width,r.height)*.25))};
  drag.out=layer(drag.from,5);drag.under=layer(drag.to,4);
  drag.out.style.transform=pose;drag.under.style.transform='translate(18px,18px) scale(.985)';
  front.style.visibility='hidden';hit.dataset.dragging='true';
 }
 function drawDrag(){
  dragFrame=0;if(!drag)return;
  const d=drag,ratio=Math.hypot(d.dx,d.dy)/d.threshold,progress=Math.min(1,ratio);
  // One continuous curve across the release threshold, with no scale plateau.
  // Color previews the next case gradually, but stays below a complete blend while held.
  setCaseBlend(d.from,d.to,.7*(1-Math.exp(-ratio*.7)),true);
  const recession=1-Math.exp(-ratio);
  d.scale=1-.22*recession;
  // Keep the ease-in fade, stretched across six times the drag distance.
  const opacityRatio=ratio/6;
  d.opacity=Math.exp(-.52*opacityRatio*opacityRatio);
  d.transform=`translate3d(${d.dx}px,${d.dy}px,0) rotate(${Math.max(-10,Math.min(10,d.dx*.035))}deg) ${d.pose==='none'?'':d.pose} scale(${d.scale})`;
  d.out.style.transform=d.transform;
  d.out.style.opacity=d.opacity;
  d.underTransform=`translate(${18*(1-progress)}px,${18*(1-progress)}px) scale(${.985+.015*progress})`;
  d.under.style.transform=d.underTransform;
 }
 function move(e){
  track(e);if(!press||press.id!==e.pointerId)return;
  const dx=e.clientX-press.x,dy=e.clientY-press.y;
  if(!drag){
   if(Math.hypot(dx,dy)<7)return;
   // Let vertical touch movement continue scrolling the page.
   if(press.type==='touch'&&Math.abs(dy)>Math.abs(dx)){end(e,true);return;}
   beginDrag();
  }
  drag.dx=dx;drag.dy=dy;
  if(e.cancelable)e.preventDefault();
  if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);
 }
 async function finishDrag(commit){
  if(!drag)return;
  cancelAnimationFrame(dragFrame);dragFrame=0;drawDrag();
  const d=drag;drag=null;hit.removeAttribute('data-dragging');
  const token=runToken;settlingTarget=commit?d.to:d.from;setCaseColor(settlingTarget);
  if(commit){
   lastPair=[d.from,d.to];
   const length=Math.max(1,Math.hypot(d.dx,d.dy)),r=hit.getBoundingClientRect();
   const travel=Math.max(Math.max(r.width,r.height)*1.05,length+Math.max(r.width,r.height)*.65);
   const exitX=d.dx/length*travel,exitY=d.dy/length*travel;
   await Promise.all([
    animate(d.out,[
     {transform:d.transform,opacity:d.opacity},
     {transform:`translate3d(${exitX}px,${exitY}px,0) rotate(${Math.sign(d.dx)*13}deg) scale(${d.scale*.9})`,opacity:0}
    ],360),
    animate(d.under,[{transform:d.underTransform},{transform:'translate(0,0) scale(1)'}],300)
   ]);
  }else{
   await Promise.all([
    animate(d.out,[{transform:d.transform,opacity:d.opacity},{transform:'translate(0,0) rotate(0deg)',opacity:1}],280),
    animate(d.under,[{transform:d.underTransform,opacity:1},{transform:'translate(18px,18px) scale(.985)',opacity:0}],280)
   ]);
  }
  if(token!==runToken)return;
  settle(commit?d.to:d.from);clearMotion();settlingTarget=null;busy=false;magnetic.resume();

  const next=queued;queued=null;if(next!==null&&next!==active)swap(next);
 }
 function end(e,cancel=false){
  if(!press||e&&press.id!==e.pointerId)return;
  const pointer=press.id;press=null;
  if(drag){const distance=Math.hypot(drag.dx,drag.dy);finishDrag(!cancel&&distance>=drag.threshold)}else schedule();
  if(hit.hasPointerCapture(pointer))hit.releasePointerCapture(pointer);
 }
 listen(hit,'pointerdown',e=>{
  if(busy||press||reduced.matches||!e.isPrimary||e.button!==0||e.target.closest('a'))return;
  press={id:e.pointerId,x:e.clientX,y:e.clientY,type:e.pointerType};
  hit.setPointerCapture(e.pointerId);
 });
 listen(hit,'pointerenter',track);listen(hit,'pointermove',move);
 listen(hit,'pointerup',e=>end(e));
 listen(hit,'pointercancel',e=>end(e,true));
 listen(hit,'lostpointercapture',e=>end(e,true));
 listen(hit,'pointerleave',()=>{inside=false;if(!press)schedule()});
 listen(hit,'dragstart',e=>e.preventDefault());
 const cancel=()=>{inside=false;end(null,true);schedule()};
 listen(window,'blur',cancel);listen(window,'resize',cancel);
 listen(window,'keydown',e=>{if(e.key==='Escape')cancel()});
 listen(document,'visibilitychange',()=>{if(document.hidden)cancel()});
 const disable=()=>{
  cancelAnimationFrame(frame);frame=0;
  inside=false;const pointer=press?.id;press=null;
  if(drag){const original=drag.from;drag=null;++runToken;cancelAnimationFrame(dragFrame);dragFrame=0;clearMotion();busy=false;queued=null;settle(original);hit.removeAttribute('data-dragging')}
  if(pointer!==undefined&&hit.hasPointerCapture(pointer))hit.releasePointerCapture(pointer);
  front.style.transition='none';front.style.transform='none';front.style.willChange='';
 };
 listen(reduced,'change',disable);listen(fine,'change',disable);
 magnetic={freeze,resume:schedule,cancel:disable};
}

function content(i){return cards[i]}

function setCaseBlend(from,to,amount=0,dragging=false){
 const mix=Math.max(0,Math.min(1,amount));
 document.documentElement.toggleAttribute('data-color-dragging',dragging);
 document.body.style.setProperty('--stack-pigment',`color-mix(in oklab, var(--stack-color-${from}) ${(1-mix)*100}%, var(--stack-color-${to}))`);
 document.querySelectorAll('.stack-ambient i').forEach((node,i)=>{
  const weight=from===to?(i===from?1:0):i===from?1-mix:i===to?mix:0;
  node.style.setProperty('--weight',weight);
 });

}
function setCaseColor(index){
 document.documentElement.dataset.activeCase=index;
 setCaseBlend(index,index);
}
function updateTabs(selected=active){setCaseColor(selected);
 document.getElementById('stack-count').textContent=`0${selected+1} / 04`;
document.querySelectorAll('[data-case-pick]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.casePick)===selected))}
function preserveFocus(i){
 const front=document.getElementById('preview');
 if(front.contains(document.activeElement))picks[i].focus({preventScroll:true});
}
function settle(i){preserveFocus(i);const front=document.getElementById('preview');front.innerHTML=content(i);front.dataset.caseIndex=i;front.style.visibility='';active=i;updateTabs();document.getElementById('stack-status').textContent=`${letters[i]}, case ${i+1} of ${cards.length}`}
function clearMotion(){animations.forEach(a=>a.cancel());extras.forEach(e=>e.remove());animations=[];extras=[];document.getElementById('preview').style.visibility=''}
function layer(i,z){const node=document.createElement('article');node.className='card deck-card motion-layer';node.dataset.caseIndex=i;node.innerHTML=content(i);node.style.zIndex=z;node.setAttribute('aria-hidden','true');node.inert=true;document.querySelector('.deck').append(node);extras.push(node);return node}
function animate(node,frames,ms,opts={}){const a=node.animate(frames,{duration:ms,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both',...opts});animations.push(a);return a.finished.catch(()=>{})}
async function retargetKeyboard(to){
 preserveFocus(to);
 // Capture every visible card before canceling, so a new key never resets its pose.
 const poses=extras.filter(node=>node.isConnected).map(node=>{
  const style=getComputedStyle(node);
  return {index:Number(node.dataset.caseIndex),transform:style.transform,
   opacity:Number(style.opacity),origin:style.transformOrigin,z:Number(style.zIndex)};
 }).sort((a,b)=>a.z-b.z);
 magnetic.cancel();++runToken;clearMotion();queued=null;
 if(reduced.matches){busy=false;settlingTarget=null;settle(to);return}
 const token=runToken,duration=swapDuration;
 busy=true;settlingTarget=to;lastPair=[active,to];updateTabs(to);
 document.getElementById('preview').style.visibility='hidden';
 const jobs=[];let found=false;
 poses.forEach((pose,i)=>{
  const node=layer(pose.index,i+5),selected=pose.index===to;
  node.style.transformOrigin=pose.origin;
  found=found||selected;
  const from={transform:pose.transform,opacity:pose.opacity};
  const target=selected?{transform:'translate(0,0) scale(1)',opacity:1}:
   {transform:`translateY(-95px) ${pose.transform==='none'?'':pose.transform} scale(.96)`,opacity:0};
  jobs.push(animate(node,[from,target],selected?duration:duration*.7));
 });
 if(!found){
  const incoming=layer(to,4);
  jobs.push(animate(incoming,[{transform:'translate(18px,30px) scale(.965)',opacity:0},
   {transform:'translate(0,0) scale(1)',opacity:1}],duration));
 }

 await Promise.all(jobs);if(token!==runToken)return;
 settle(to);clearMotion();settlingTarget=null;busy=false;magnetic.resume();

 const next=queued;queued=null;if(next!==null&&next!==active)swap(next);
}
async function swap(to,{keyboard=false}={}){
 if(keyboard&&busy)return retargetKeyboard(to);
 if(busy){queued=to;return}
 if(to===active)return;
 preserveFocus(to);
 const from=active;lastPair=[from,to];queued=null;
 if(reduced.matches){settle(to);return}
 const hoverPose=magnetic.freeze();busy=true;const token=++runToken,duration=swapDuration;
 settlingTarget=to;updateTabs(to);
 const front=document.getElementById('preview');
 const outgoing=layer(from,5),incoming=layer(to,4);front.style.visibility='hidden';
 const jobs=[animate(outgoing,[{transform:hoverPose==='none'?'translateY(0) scale(1)':hoverPose,opacity:1},{transform:'translateY(-95px) scale(.96)',opacity:0}],duration*.7),animate(incoming,[{transform:'translate(18px,30px) scale(.965)',opacity:.45},{transform:'translate(0,0) scale(1)',opacity:1}],duration)];
 await Promise.all(jobs);if(token!==runToken)return;
 settle(to);clearMotion();settlingTarget=null;busy=false;magnetic.resume();
 const next=queued;queued=null;if(next!==null&&next!==active)swap(next);
}

 document.querySelector('.stack-tabs').hidden=false;
 document.querySelector('.stack-help').hidden=false;
 document.getElementById('preview').hidden=false;
 const sizer=document.querySelector('.stack-sizer');
 sizer.inert=true;sizer.setAttribute('aria-hidden','true');
 document.body.classList.add('stack-ready');
 settle(0);initMagnetic();
 listen(shortcutToggle,'change',()=>{
  picks.forEach((button,i)=>{
   if(shortcutToggle.checked)button.setAttribute('aria-keyshortcuts',String(i+1));
   else button.removeAttribute('aria-keyshortcuts');
  });
 });
 picks.forEach((button,i)=>listen(button,'click',()=>swap(i,{keyboard:true})));
 listen(window,'keydown',e=>{
  if(!shortcutToggle.checked||e.defaultPrevented||e.repeat||e.isComposing||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.target instanceof Element&&(e.target.closest('input,textarea,select,[role="textbox"]')||e.target.isContentEditable))return;
  const index=['1','2','3','4'].indexOf(e.key);if(index<0)return;
  e.preventDefault();swap(index,{keyboard:true});
 });
 listen(reduced,'change',()=>{
  if(reduced.matches&&busy){++runToken;const target=queued??settlingTarget??lastPair[1];queued=null;clearMotion();settlingTarget=null;busy=false;settle(target)}
 });
 stop=()=>{
  controller.abort();magnetic.cancel();++runToken;clearMotion();
  document.documentElement.removeAttribute('data-color-dragging');
  document.documentElement.removeAttribute('data-active-case');
  stop=()=>{};
 };
}
document.addEventListener('astro:page-load',init);
document.addEventListener('astro:before-swap',()=>stop());
