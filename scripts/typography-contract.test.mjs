import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTypography } from './typography-contract.mjs';
const element=(tag,size,weight=400,extra={})=>({tag,selector:tag,text:'Example',size,weight,classes:[],rendered:true,inH1:tag==='h1',...extra});
const snapshot=(width,elements)=>({path:'/',width,theme:'light',elements});
const good=(width=1200)=>snapshot(width,[element('h1',width<810?20:36,300),element('h2',width<810?18:20,500),element('h3',16,700),element('p',16),element('figcaption',12)]);
test('the independently specified desktop and mobile hierarchy passes',()=>{
 for(const width of [1200,810,809,390])assert.deepEqual(validateTypography(good(width)),[]);
});
test('H2 cannot borrow the 12px metadata role or the 36px display role',()=>{
 for(const size of [12,36]){const s=good();s.elements[1].size=size;assert.ok(validateTypography(s).some(v=>v.rule==='heading-size'));}
});
test('H3 is 16px bold on both sides of the breakpoint',()=>{
 for(const width of [1200,390])for(const [size,weight] of [[20,500],[18,500],[16,400]]){
  const s=good(width);Object.assign(s.elements[2],{size,weight});assert.ok(validateTypography(s).some(v=>v.rule==='heading-size'||v.rule==='heading-weight'));
 }
});
test('mobile H1 and H2 shift independently; body, H3 and captions do not',()=>{
 for(const [index,size] of [[0,36],[1,20],[2,18],[3,18],[4,16]]){const s=good(390);s.elements[index].size=size;assert.ok(validateTypography(s).length);}
});
test('exactly one rendered H1 is required',()=>{
 const missing=good();missing.elements.shift();assert.ok(validateTypography(missing).some(v=>v.rule==='h1-count'));
 const extra=good();extra.elements.push(element('h1',36));assert.ok(validateTypography(extra).some(v=>v.rule==='h1-count'));
});
test('display-sized text outside H1 is rejected, but an inline H1 link is allowed',()=>{
 const s=good();s.elements.push(element('a',36,300,{inH1:true}));assert.deepEqual(validateTypography(s),[]);
 s.elements.push(element('strong',36,300));assert.ok(validateTypography(s).some(v=>v.rule==='display-placement'));
});
test('body and explanatory text cannot evade their size by selecting another valid token',()=>{
 const s=good();s.elements.push(element('p',20,500,{classes:['type-title']}),element('span',16,400,{classes:['type-body-small']}));
 const errors=validateTypography(s);assert.ok(errors.some(v=>v.rule==='body-size'));assert.ok(errors.some(v=>v.rule==='role-size'));
});
test('hidden card templates are checked, while hidden H1 duplicates do not count as rendered H1s',()=>{
 const s=good();s.elements.push(element('h1',36,300,{rendered:false}),element('h3',20,500,{rendered:false}));
 assert.ok(!validateTypography(s).some(v=>v.rule==='h1-count'));assert.ok(validateTypography(s).some(v=>v.rule==='heading-size'));
});
test('unclassified off-scale text is rejected and an empty native checkbox is excluded',()=>{
 const s=good();s.elements.push(element('span',15));assert.ok(validateTypography(s).some(v=>v.rule==='text-scale'));
 s.elements.pop();s.elements.push(element('input',13.3333,400,{text:''}));assert.deepEqual(validateTypography(s),[]);
});
test('inline heading text cannot escape its heading size',()=>{
 const s=good();s.elements.push(element('a',16,400,{inH1:true,headingTag:'h1',inheritedRole:'type-body'}));
 assert.ok(validateTypography(s).some(v=>v.rule==='heading-size'));
});
test('unclassed descendants must still follow their inherited text role',()=>{
 const s=good();s.elements.push(element('span',20,400,{inheritedRole:'type-body'}));
 assert.ok(validateTypography(s).some(v=>v.rule==='role-size'));
});
