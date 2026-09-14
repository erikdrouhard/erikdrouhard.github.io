/** Erik's explicit hierarchy, 2026-09-14. Independent of tokens.css: reading
 * expected sizes from the implementation would let a token edit approve itself.
 * No baseline, ignored selectors, or update-snapshot escape hatch.
 */
export const TYPOGRAPHY_WIDTHS = [1200, 810, 809, 390];
export function validateTypography(snapshot) {
  const mobile = snapshot.width < 810;
  const h1 = mobile ? 20 : 36, h2 = mobile ? 18 : 20;
  const roles = {'type-display':h1,'type-section':h2,'type-title':h2,'type-support':16,'type-label':16,'type-body':16,'type-body-small':12,'type-meta':12};
  const issues = [];
  const add=(e,rule,expected,actual)=>issues.push({path:snapshot.path,width:snapshot.width,theme:snapshot.theme,selector:e.selector,text:e.text?.slice(0,100),rule,expected,actual});
  const headings=snapshot.elements.filter(e=>e.tag==='h1'&&e.rendered);
  if(headings.length!==1)add({selector:'document',text:''},'h1-count',1,headings.length);
  for(const e of snapshot.elements){
    if(!e.text?.trim())continue; // A native checkbox's unused font is not text.
    const expectedHeading={h1,h2,h3:16}[e.headingTag||e.tag];
    if(expectedHeading!==undefined&&e.size!==expectedHeading)add(e,'heading-size',expectedHeading,e.size);
    if(e.tag==='h3'&&e.weight!==700)add(e,'heading-weight',700,e.weight);
    for(const role of new Set([...(e.classes||[]),e.inheritedRole].filter(Boolean))){
      if(role in roles&&e.size!==roles[role])add(e,'role-size',`${role}: ${roles[role]}px`,e.size);
      if(['type-support','type-label'].includes(role)&&e.weight!==700)add(e,'role-weight',`${role}: 700`,e.weight);
    }
    const explanatory=(e.classes||[]).some(c=>['type-meta','type-body-small'].includes(c))||e.tag==='figcaption';
    const body=['p','li','dd','blockquote'].includes(e.tag);
    if(explanatory&&e.size!==12)add(e,'explanatory-size',12,e.size);
    else if(body&&!explanatory&&e.size!==16)add(e,'body-size',16,e.size);
    if(e.size===h1&&!e.inH1)add(e,'display-placement','H1 or its inline children',e.tag);
    if(![h1,h2,16,12].includes(e.size))add(e,'text-scale',[h1,h2,16,12].join('/'),e.size);
  }
  return issues;
}

/** Pure read of the live DOM and computed styles, shared by browser runners.
 * Checks hidden templates too; only the rendered H1 count ignores hidden copies.
 * Text embedded in image/SVG assets, pseudo quote glyphs, and browser UI are not
 * semantic HTML headings/body/captions. They remain in the separate font audit.
 */
export function collectTypography() {
  const pathFor=el=>{if(el.id)return '#'+CSS.escape(el.id);const parts=[];for(let n=el;n&&n!==document.body;n=n.parentElement){let p=n.localName;if(n.id){parts.unshift('#'+CSS.escape(n.id));break;}const peers=[...n.parentElement.children].filter(x=>x.localName===n.localName);if(peers.length>1)p+=`:nth-of-type(${peers.indexOf(n)+1})`;parts.unshift(p);}return parts.join(' > ');};
  return {path:location.pathname,width:innerWidth,theme:document.documentElement.dataset.theme,elements:[...document.body.querySelectorAll('*')].filter(e=>!e.closest('script,style,noscript,template,svg,astro-dev-toolbar,.motion-layer')).filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||e.matches('h1,h2,h3,p,li,dd,blockquote,figcaption,[class*="type-"]')).map(e=>{
    const s=getComputedStyle(e);let inheritedRole;for(let n=e;n;n=n.parentElement){const role=[...n.classList].find(c=>c.startsWith('type-'));if(role){inheritedRole=role;break;}}let rendered=true;for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n);if(n.hidden||c.display==='none'||c.visibility==='hidden'||c.visibility==='collapse'){rendered=false;break;}}
    return {tag:e.localName,selector:pathFor(e),text:e.textContent.replace(/\s+/g,' ').trim(),classes:[...e.classList],size:parseFloat(s.fontSize),weight:parseFloat(s.fontWeight),rendered,inheritedRole,headingTag:e.closest('h1,h2,h3')?.localName,inH1:!!e.closest('h1')};
  })};
}
