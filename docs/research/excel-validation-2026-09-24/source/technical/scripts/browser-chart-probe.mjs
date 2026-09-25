import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import crypto from 'node:crypto';
const require=createRequire('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const here=path.dirname(fileURLToPath(import.meta.url)), out=path.resolve(here,'../../outputs/excel-validation');
const revision='5109699ac5eea3ca510947859ff9e5cb3980676e';
const fixture=process.argv[2];
if(!fixture)throw new Error('Pass the exact local chart fixture path.');
const bytes=await readFile(fixture), b64=bytes.toString('base64');
const envelope={kind:'data-view/1',title:'Native Excel chart validation fixture',items:[{name:path.basename(fixture),content:'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+b64}]};
const gz=gzipSync(Buffer.from(JSON.stringify(envelope))).toString('base64url');
const server=createServer(async(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile(path.join(here,'data-view.html')));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={revision,fixture:path.basename(fixture),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),browserVersion:browser.version(),viewport:{width:1440,height:1000,deviceScaleFactor:1},inputPath:'Original data-view.html #gz data-view/1 local envelope, exact fixture bytes in data URI; no fictional remote source.',transport:'Original pinned app source files supplied from local cache. No app code modified.',sheets:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await context.addInitScript({content:await readFile('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip/dist/jszip.min.js','utf8')});
 await context.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith(origin))return route.continue();const u=new URL(url);
  let local=null,api=false;
  if(u.hostname==='raw.githubusercontent.com'&&u.pathname.includes('/'+revision+'/lib/'))local=path.basename(u.pathname);
  if(u.hostname==='api.github.com'&&u.pathname.includes('/contents/lib/')){local=path.basename(u.pathname);api=true;}
  if(url.includes('combine/npm/daisyui'))local='styles.css';
  if(url.includes('combine/npm/@tailwindcss/browser'))local='theme-runtime.js';
  if(u.hostname==='unpkg.com')local=url.includes('collapse')?'collapse.js':'alpine.js';
  if(local){try{const body=await readFile(path.join(here,local));if(api)return route.fulfill({contentType:'application/json',body:JSON.stringify({name:local,path:u.pathname.split('/contents/')[1],encoding:'base64',content:body.toString('base64'),size:body.length})});return route.fulfill({contentType:local.endsWith('.css')?'text/css':'text/javascript',body});}catch{}}
  return route.fulfill({status:404,body:'Outside local validation cache'});
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(`${origin}/data-view.html?use=${revision}#gz=${gz}`,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-sheet="stage"]',{timeout:15000});
 await page.waitForSelector('[data-sheet="tabs"] button',{timeout:15000});
 const sheets=await page.locator('[data-sheet="tabs"] button').allTextContents();
 for(const name of sheets){
  await page.getByRole('button',{name,exact:true}).click();
  const stage=page.locator('[data-sheet="stage"]');
  const capture='roundtrip-chart-browser-'+name.replace(/[^a-zA-Z0-9_-]/g,'-').toLowerCase()+'.png';
  await page.screenshot({path:path.join(out,capture)});
  report.sheets.push({name,capture,text:await stage.innerText(),canvas:await stage.locator('canvas').count(),svg:await stage.locator('svg').count(),images:await stage.locator('img').count()});
 }
 report.parser=await page.evaluate(async base64=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const parsed=await xlsxKit.readZip(bytes);
  return {drawings:Object.keys(parsed.xl.drawings||{}),chartModelKeys:Object.keys(parsed.xl).filter(k=>/chart/i.test(k)),sheets:Object.values(parsed.xl.sheets).map(s=>({name:s.name,images:s.images?.length||0,rows:s.rows?.length||0}))};
 },b64);
 report.loaded=await page.evaluate(()=>window.__loadedScripts?.map(s=>({path:s.path,status:s.status})));
 report.delivery=await page.evaluate(()=>{
  const v=document.getElementById('dv-viewer')?.__viewer;
  return {local:!v?.fileUrls?.length,fileUrls:v?.fileUrls||[],availableModes:v?.availableModes?.map(m=>({id:m.id,label:m.label})),visibleDownloadLinks:[...document.querySelectorAll('a[download]')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,download:e.download,href:e.getAttribute('href')})),visibleSaveButtons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&/save|download|export/i.test(e.textContent+' '+e.title)).map(e=>({text:e.textContent,title:e.title}))};
 });
 report.delivery.interpretation='The local envelope has no original-file GitHub/Raw/CDN links and the Sheet view offers no XLSX download or rebuild action. Source inspection of viewer.js 2143-2147 shows the Structure/Extract Save action writes a .extract.json data envelope, not an XLSX workbook; it is not a workbook round trip.';
 console.log(JSON.stringify(report));
}catch(e){report.error=String(e);console.error(String(e));process.exitCode=1;}
finally{await browser.close();server.close();await writeFile(path.join(out,'roundtrip-chart-browser-evidence.json'),JSON.stringify(report,null,2));}
