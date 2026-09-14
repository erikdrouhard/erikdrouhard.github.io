// Selected-work stack, promoted from the motion-3 homepage prototype.
// Preserve the approved kinetics; state and listeners are scoped to stack pages.
// Accepted card kinetics. These are motion poses, not the site's layout scale.
const motion = {
 hoverIn: 160, hoverOut: 520, perspective: 1200,
 hoverX: 20, hoverY: 16, hoverZ: 24, tiltX: 6, tiltY: 8,
 backingOffset: 18, backingScale: .985, entryY: 30, entryScale: .965,
 exitY: -95, exitScale: .96, exitFraction: .7,
 commitOut: 360, commitIn: 300, cancel: 280,
 dragThresholdMin: 80, dragThresholdMax: 140, dragThresholdRatio: .25,
 dragStart: 7, touchAxisRatio: 1.15, flickMinDistance: 24, flickMinSpeed: .45, flickSampleWindow: 90,
 blendLimit: .7, blendRate: .7, recessionScale: .22,
 fadeDistance: 6, fadeRate: .52, dragTiltMax: 10, dragTiltGain: .035,
 travelRatio: 1.05, travelExtra: .65, releaseTilt: 13, releaseScale: .9,
 entryOpacity: .45, frontLayer: 5, backingLayer: 4,

};
const restPose = 'translate(0,0) scale(1)';
const backingPose = (progress=0) => `translate(${motion.backingOffset*(1-progress)}px,${motion.backingOffset*(1-progress)}px) scale(${motion.backingScale+(1-motion.backingScale)*progress})`;
const entryPose = () => `translate(${motion.backingOffset}px,${motion.entryY}px) scale(${motion.entryScale})`;
const exitPose = (pose='none') => `translateY(${motion.exitY}px) ${pose==='none'?'':pose} scale(${motion.exitScale})`;
let stop = () => {};
function init() {
 stop();
 if (!document.body.classList.contains('stack-prototype')) return;
 const controller=new AbortController();
 const listen=(target,event,handler,options={})=>target.addEventListener(event,handler,{...options,signal:controller.signal});
 const cardNodes=[...document.querySelectorAll('.stack-sizer .deck-card')];
 const cards=cardNodes.map(node=>node.innerHTML);
 const caseLinks=cardNodes.map(node=>node.querySelector('.stack-read')?.href);
 const picks=[...document.querySelectorAll('[data-case-pick]')];
 const letters=picks.map(node=>node.dataset.name);
 const shortcutToggle=document.querySelector('[data-shortcuts-toggle]');
 // Keep the selected full-length motion even when keys interrupt a swap.
 const motionStyle=getComputedStyle(document.body);
 const swapDuration=()=>{
  const rawDuration=motionStyle.getPropertyValue('--stack-swap-duration').trim();
  return parseFloat(rawDuration)*(rawDuration.endsWith('ms')?1:1000)||0;
 };
 const easing=motionStyle.getPropertyValue('--stack-easing').trim();
 let active=0,busy=false,queued=null,lastPair=[0,1];
 let animations=[],extras=[],runToken=0,settlingTarget=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let magnetic={freeze:()=> 'none',resume:()=>{},cancel:()=>{}};
function initMagnetic(){
 const front=document.getElementById('preview'),deck=document.querySelector('.deck');
 const hit=deck;hit.classList.add('magnetic-hit');front.classList.add('magnetic-card');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 let inside=false,x=0,y=0,frame=0,press=null,drag=null,dragFrame=0,suppressClick=false;
 const touches=new Set();
 const enabled=()=>fine.matches&&!reduced.matches;
 function paint(){
  frame=0;if(busy||press)return;
  const hover=inside&&enabled();
  front.style.transition=enabled()?`transform ${hover?motion.hoverIn:motion.hoverOut}ms ${easing}`:'none';
  front.style.willChange=hover?'transform':'';
  front.style.transform=hover?`perspective(${motion.perspective}px) translate3d(${x*motion.hoverX}px,${y*motion.hoverY}px,${motion.hoverZ}px) rotateX(${y*motion.tiltX}deg) rotateY(${-x*motion.tiltY}deg)`:'none';
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
  let takeover=null;
  // A fresh gesture can take over while the previous card is still settling.
  // Resolve that selection first so rapid flicks never get dropped by `busy`.
  if(busy){
   const target=queued??settlingTarget??active;
   const incoming=extras.findLast(node=>Number(node.dataset.caseIndex)===target);
   if(incoming){const style=getComputedStyle(incoming);takeover={pose:style.transform,opacity:Number(style.opacity)}}
   ++runToken;clearMotion();queued=null;settlingTarget=null;busy=false;settle(target);
  }
  const currentPose=freeze(),pose=takeover?.pose??currentPose,r=hit.getBoundingClientRect();
  preserveFocus(active);
  busy=true;++runToken;queued=null;
  drag={from:active,to:(active+1)%4,dx:0,dy:0,pose,baseOpacity:takeover?.opacity??1,threshold:Math.max(motion.dragThresholdMin,Math.min(motion.dragThresholdMax,Math.min(r.width,r.height)*motion.dragThresholdRatio))};
  drag.out=layer(drag.from,motion.frontLayer);drag.under=layer(drag.to,motion.backingLayer);
  drag.out.style.transform=pose;drag.out.style.opacity=drag.baseOpacity;drag.under.style.transform=backingPose();
  front.style.visibility='hidden';hit.dataset.dragging='true';suppressClick=true;
  hit.setPointerCapture(press.id);
 }
 function drawDrag(){
  dragFrame=0;if(!drag)return;
  const d=drag,ratio=Math.hypot(d.dx,d.dy)/d.threshold,progress=Math.min(1,ratio);
  // One continuous curve across the release threshold, with no scale plateau.
  // Color previews the next case gradually, but stays below a complete blend while held.
  setCaseBlend(d.from,d.to,motion.blendLimit*(1-Math.exp(-ratio*motion.blendRate)),true);
  const recession=1-Math.exp(-ratio);
  d.scale=1-motion.recessionScale*recession;
  // Keep the ease-in fade, stretched across six times the drag distance.
  const opacityRatio=ratio/motion.fadeDistance;
  d.opacity=(d.baseOpacity+(1-d.baseOpacity)*progress)*Math.exp(-motion.fadeRate*opacityRatio*opacityRatio);
  d.transform=`translate3d(${d.dx}px,${d.dy}px,0) rotate(${Math.max(-motion.dragTiltMax,Math.min(motion.dragTiltMax,d.dx*motion.dragTiltGain))}deg) ${d.pose==='none'?'':d.pose} scale(${d.scale})`;
  d.out.style.transform=d.transform;
  d.out.style.opacity=d.opacity;
  d.underTransform=backingPose(progress);
  d.under.style.transform=d.underTransform;
 }
 function sample(e){
  // Velocity comes from the recent release window, never the whole gesture.
  // A drag held still before release must not retain an earlier flick's speed.
  press.samples.push({x:e.clientX,time:e.timeStamp});
  press.samples=press.samples.filter(point=>e.timeStamp-point.time<=motion.flickSampleWindow);
 }
 function move(e){
  if(!press||press.id!==e.pointerId)return;
  const dx=e.clientX-press.x,dy=e.clientY-press.y;
  sample(e);
  if(!drag){
   if(Math.hypot(dx,dy)<motion.dragStart)return;
   if(press.type==='touch'){
    // Decide direction before taking capture. Native pan-y and pinch-zoom
    // remain available, and diagonal movement cannot steal a vertical scroll.
    if(Math.abs(dy)>Math.abs(dx)*motion.touchAxisRatio){end(e,true);return;}
    if(Math.abs(dx)<Math.abs(dy)*motion.touchAxisRatio)return;
   }
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
   const travel=Math.max(Math.max(r.width,r.height)*motion.travelRatio,length+Math.max(r.width,r.height)*motion.travelExtra);
   const exitX=d.dx/length*travel,exitY=d.dy/length*travel;
   await Promise.all([
    animate(d.out,[
     {transform:d.transform,opacity:d.opacity},
     {transform:`translate3d(${exitX}px,${exitY}px,0) rotate(${Math.sign(d.dx)*motion.releaseTilt}deg) scale(${d.scale*motion.releaseScale})`,opacity:0}
    ],motion.commitOut),
    animate(d.under,[{transform:d.underTransform},{transform:restPose}],motion.commitIn)
   ]);
  }else{
   await Promise.all([
    animate(d.out,[{transform:d.transform,opacity:d.opacity},{transform:'translate(0,0) rotate(0deg)',opacity:1}],motion.cancel),
    animate(d.under,[{transform:d.underTransform,opacity:1},{transform:backingPose(),opacity:0}],motion.cancel)
   ]);
  }
  if(token!==runToken)return;
  settle(commit?d.to:d.from);clearMotion();settlingTarget=null;busy=false;magnetic.resume();

  const next=queued;queued=null;if(next!==null&&next!==active)swap(next);
 }
 function end(e,cancel=false){
  if(!press||e&&press.id!==e.pointerId)return;
  const pointer=press.id;
  let commit=false;
  if(drag){
   if(e&&!cancel){
    // Include pointerup coordinates: the final movement need not have had its
    // own pointermove event, particularly on a quick touch release.
    drag.dx=e.clientX-press.x;drag.dy=e.clientY-press.y;sample(e);
   }
   const touch=press.type==='touch';
   const distance=touch?Math.abs(drag.dx):Math.hypot(drag.dx,drag.dy);
   const first=press.samples[0],last=press.samples.at(-1);
   const elapsed=last.time-first.time;
   const velocity=elapsed>0?(last.x-first.x)/elapsed:0;
   const flick=touch&&distance>=motion.flickMinDistance&&Math.abs(velocity)>=motion.flickMinSpeed&&Math.sign(velocity)===Math.sign(drag.dx);
   commit=!cancel&&(distance>=drag.threshold||flick);
  }
  press=null;
  if(drag)finishDrag(commit);else schedule();
  if(hit.hasPointerCapture(pointer))hit.releasePointerCapture(pointer);
 }
 // Observe all touches, including a second finger landing outside the card.
 // Cancel the card gesture before the browser handles a pinch.
 listen(window,'pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  touches.add(e.pointerId);
  if(touches.size>1)end(null,true);
 },{capture:true});
 listen(hit,'pointerdown',e=>{
  if(press||reduced.matches||!e.isPrimary||e.button!==0||touches.size>1)return;
  suppressClick=false;
  if(e.pointerType!=='touch'&&e.target.closest('a'))return;
  press={id:e.pointerId,x:e.clientX,y:e.clientY,type:e.pointerType,samples:[{x:e.clientX,time:e.timeStamp}]};
 });
 listen(hit,'pointerenter',track);listen(hit,'pointermove',track);
 listen(window,'pointermove',move,{passive:false});
 listen(window,'pointerup',e=>{touches.delete(e.pointerId);end(e)});
 listen(window,'pointercancel',e=>{touches.delete(e.pointerId);end(e,true)});
 // Touch initially captures the child under the finger. Transferring that
 // implicit capture to the deck emits a bubbling lost event from the child.
 listen(hit,'lostpointercapture',e=>{if(e.target===hit&&!hit.hasPointerCapture(e.pointerId))end(e,true)});
 listen(hit,'pointerleave',()=>{inside=false;if(!press)schedule()});
 listen(hit,'click',e=>{
  // A swipe beginning over the link is still a swipe. Keep an untouched tap
  // native; suppress only the compatibility click generated by a real drag.
  if(suppressClick&&e.detail!==0){e.preventDefault();e.stopPropagation();suppressClick=false;}
 },{capture:true});
 listen(hit,'dragstart',e=>e.preventDefault());
 const cancel=()=>{inside=false;touches.clear();end(null,true);schedule()};
 listen(window,'blur',cancel);listen(window,'resize',cancel);
 listen(window,'keydown',e=>{if(e.key==='Escape')cancel()});
 listen(document,'visibilitychange',()=>{if(document.hidden)cancel()});
 const disable=()=>{
  cancelAnimationFrame(frame);frame=0;
  inside=false;touches.clear();const pointer=press?.id;press=null;
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
document.querySelectorAll('[data-case-pick]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.casePick)===selected));
 const rail=document.querySelector('.stack-tabs');
 if(rail.scrollWidth>rail.clientWidth){
  const button=picks[selected].getBoundingClientRect(),bounds=rail.getBoundingClientRect();
  // Reveal the selected item horizontally without moving the page vertically.
  if(button.left<bounds.left)rail.scrollLeft+=button.left-bounds.left;
  else if(button.right>bounds.right)rail.scrollLeft+=button.right-bounds.right;
 }
}
function preserveFocus(i){
 const front=document.getElementById('preview');
 if(front.contains(document.activeElement))picks[i].focus({preventScroll:true});
}
function settle(i){preserveFocus(i);const front=document.getElementById('preview');front.innerHTML=content(i);front.dataset.caseIndex=i;front.style.visibility='';active=i;updateTabs();document.getElementById('stack-status').textContent=`${letters[i]}, case ${i+1} of ${cards.length}`}
function clearMotion(){animations.forEach(a=>a.cancel());extras.forEach(e=>e.remove());animations=[];extras=[];document.getElementById('preview').style.visibility=''}
function layer(i,z){const node=document.createElement('article');node.className='card deck-card motion-layer';node.dataset.caseIndex=i;node.innerHTML=content(i);node.style.zIndex=z;node.setAttribute('aria-hidden','true');node.inert=true;document.querySelector('.deck').append(node);extras.push(node);return node}
function animate(node,frames,ms,opts={}){const a=node.animate(frames,{duration:ms,easing,fill:'both',...opts});animations.push(a);return a.finished.catch(()=>{})}
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
 const token=runToken,duration=swapDuration();
 busy=true;settlingTarget=to;lastPair=[active,to];updateTabs(to);
 document.getElementById('preview').style.visibility='hidden';
 const jobs=[];let found=false;
 poses.forEach((pose,i)=>{
  const node=layer(pose.index,i+motion.frontLayer),selected=pose.index===to;
  node.style.transformOrigin=pose.origin;
  found=found||selected;
  const from={transform:pose.transform,opacity:pose.opacity};
  const target=selected?{transform:restPose,opacity:1}:
   {transform:exitPose(pose.transform),opacity:0};
  jobs.push(animate(node,[from,target],selected?duration:duration*motion.exitFraction));
 });
 if(!found){
  const incoming=layer(to,motion.backingLayer);
  jobs.push(animate(incoming,[{transform:entryPose(),opacity:0},
   {transform:restPose,opacity:1}],duration));
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
 const hoverPose=magnetic.freeze();busy=true;const token=++runToken,duration=swapDuration();
 settlingTarget=to;updateTabs(to);
 const front=document.getElementById('preview');
 const outgoing=layer(from,motion.frontLayer),incoming=layer(to,motion.backingLayer);front.style.visibility='hidden';
 const jobs=[animate(outgoing,[{transform:hoverPose==='none'?'translateY(0) scale(1)':hoverPose,opacity:1},{transform:exitPose(),opacity:0}],duration*motion.exitFraction),animate(incoming,[{transform:entryPose(),opacity:motion.entryOpacity},{transform:restPose,opacity:1}],duration)];
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
  if(!shortcutToggle.checked||e.defaultPrevented||e.repeat||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
  if(e.target instanceof Element&&(e.target.closest('input,textarea,select,[role="textbox"]')||e.target.isContentEditable))return;
  if(e.key==='Enter'){
   // Native controls keep their Enter action. Elsewhere, open the latest choice
   // immediately, including while its full-length swap animation is running.
   if(e.target instanceof Element&&e.target.closest('a,button,summary,[role="button"],[role="link"]'))return;
   const href=caseLinks[queued??settlingTarget??active];
   if(href){e.preventDefault();window.location.assign(href)}
   return;
  }
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
