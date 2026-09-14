#!/usr/bin/env node
/** Browser-level typography gate; zero accepted violations. Dev mode deliberately
 * includes unpublished prototypes. Use --url only for a server you intend to test.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPOGRAPHY_WIDTHS, collectTypography, validateTypography } from './typography-contract.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dynamic={'prototype/[study].astro':['/prototype/card-stack/','/prototype/card-stack-right/']};
function discover(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const path=join(dir,e.name);if(e.isDirectory())return e.name==='.archive'?[]:discover(path);
 if(!/\.(astro|mdx|md|html)$/.test(e.name))return [];
 const rel=relative(join(root,'src/pages'),path).replaceAll('\\','/');
 if(rel.includes('[')){if(!dynamic[rel])throw Error(`Uncovered dynamic page ${rel}: add its concrete test routes.`);return dynamic[rel];}
 return ['/'+rel.replace(/\.(astro|mdx|md|html)$/,'').replace(/(^|\/)index$/,'').replace(/\/$/,'')+'/'].map(x=>x==='//'?'/':x);
});}
const routes=discover(join(root,'src/pages')).sort();
let server,browser,base,serverOutput='';
const args=process.argv.slice(2), index=args.indexOf('--url');
const reportDir=mkdtempSync(join(tmpdir(),'portfolio-typography-'));
const results={startedAt:new Date().toISOString(),routes,widths:TYPOGRAPHY_WIDTHS,snapshots:[],issues:[]};
try{
 if(index!==-1){if(!args[index+1])throw Error('--url needs an origin');base=new URL(args[index+1]).origin;}
 else{
  const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});const port=socket.address().port;await new Promise(r=>socket.close(r));
  base=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,[join(root,'node_modules/astro/astro.js'),'dev','--host','127.0.0.1','--port',String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',x=>serverOutput+=x);server.stderr.on('data',x=>serverOutput+=x);
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const response=await fetch(base,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('Astro test server did not become ready. '+serverOutput);
 }
 results.base=base;browser=await chromium.launch();
 for(const theme of ['light','dark']){
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.addInitScript(value=>localStorage.setItem('ed-theme',value),theme);
  const page=await context.newPage();
  for(const width of TYPOGRAPHY_WIDTHS){await page.setViewportSize({width,height:1000});
   for(const route of routes){
    const response=await page.goto(base+route,{waitUntil:'networkidle'});if(!response?.ok())throw Error(`${route}: HTTP ${response?.status()}`);
    await page.evaluate(()=>document.fonts.ready);
    if(route==='/'||route.startsWith('/prototype/'))await page.locator('body.stack-ready').waitFor();
    const data=await page.evaluate(collectTypography);
    if(data.theme!==theme||data.width!==width)throw Error(`Wrong capture environment: ${route}`);
    results.snapshots.push(data);results.issues.push(...validateTypography(data));
   }
  }
  await context.close();
 }
 writeFileSync(join(reportDir,'results.json'),JSON.stringify(results,null,2));
 const counts=new Map();for(const i of results.issues){const key=i.path+' | '+i.rule;counts.set(key,(counts.get(key)||0)+1);}
 for(const [key,count] of counts)console.log(`${count} violations: ${key}`);
 console.log(`\nTypography: ${results.issues.length?'FAIL':'PASS'} — ${results.snapshots.length} page/viewport/theme snapshots, ${results.issues.length} violations.`);
 console.log(`Complete selectors, text, expected/actual values: ${join(reportDir,'results.json')}`);
 process.exitCode=results.issues.length?1:0;
}catch(error){console.error('Typography harness failed:',error.message);process.exitCode=2;}
finally{await browser?.close();server?.kill();}
