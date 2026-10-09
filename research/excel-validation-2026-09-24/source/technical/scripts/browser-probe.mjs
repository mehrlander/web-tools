import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const require = createRequire('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../outputs/excel-validation');
const revision = '5109699ac5eea3ca510947859ff9e5cb3980676e';
const workbook = await readFile(path.join(out, 'demonstration-workbooks.xlsx'));
const requests = [], errors = [];
const server = createServer(async (req,res) => {
  try { const body = await readFile(path.join(here, 'data-view.html')); res.writeHead(200, {'content-type':'text/html'});res.end(body); }
  catch {res.writeHead(404);res.end();}
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.addInitScript({content:await readFile('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip/dist/jszip.min.js','utf8')});
  page.on('request',r=> requests.push(r.url()));
  page.on('pageerror',e=> errors.push(String(e)));
  page.on('console',m=> {if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*', async route => {
    const url = route.request().url();
    if(url.startsWith(origin)) return route.continue();
    const u = new URL(url);
    if(url === `https://raw.githubusercontent.com/mehrlander/web-tools/${revision}/docs/examples/demonstration-workbooks.xlsx`) return route.fulfill({contentType:'application/octet-stream',body:workbook});
    let local = null, api = false;
    if(u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/'+revision+'/lib/')) local = path.basename(u.pathname);
    if(u.hostname === 'api.github.com' && u.pathname.includes('/contents/lib/')) {local=path.basename(u.pathname);api=true;}
    if(url.includes('combine/npm/daisyui')) local='styles.css';
    if(url.includes('combine/npm/@tailwindcss/browser')) local='theme-runtime.js';
    if(u.hostname === 'unpkg.com') local = url.includes('collapse')?'collapse.js':'alpine.js';
    if(url.includes('jszip@3.10.1')) return route.fulfill({contentType:'text/javascript',body:await readFile('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip/dist/jszip.min.js')});
    if(local) {
      try {
        const body = await readFile(path.join(here,local));
        if(api) return route.fulfill({contentType:'application/json',body:JSON.stringify({name:local,path:u.pathname.split('/contents/')[1],encoding:'base64',content:body.toString('base64'),size:body.length})});
        return route.fulfill({contentType:local.endsWith('.css')?'text/css':'text/javascript',body});
      } catch {}
    }
    errors.push('UNMAPPED '+url);
    return route.fulfill({status:404,body:'Not part of local test cache'});
  });
  await page.route('**/repos/mehrlander/web-tools/contents/docs/examples/demonstration-workbooks.xlsx*', route=>route.fulfill({contentType:'application/json',body:JSON.stringify({name:'demonstration-workbooks.xlsx',path:'docs/examples/demonstration-workbooks.xlsx',size:workbook.length,encoding:'base64',content:workbook.toString('base64'),sha:crypto.createHash('sha1').update(Buffer.from(`blob ${workbook.length}\0`)).update(workbook).digest('hex')})}));
  const url = `${origin}/data-view.html?use=${revision}&src=${encodeURIComponent(`mehrlander/web-tools@${revision}:docs/examples/demonstration-workbooks.xlsx`)}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('[data-sheet="root"]',{timeout:30000});
  await page.waitForSelector('[data-sheet="stage"] table',{timeout:30000});
  await writeFile(path.join(here,'browser-initial-snapshot.txt'),await page.locator('body').innerText());
  console.log('LOADED', url);
  console.log(await page.locator('[data-sheet="tabs"]').innerText());
  await page.screenshot({path:path.join(out,'browser-raw-data.png')});
  await page.getByRole('button',{name:'PivotSummary',exact:true}).click();
  await page.screenshot({path:path.join(out,'browser-pivot-summary.png')});
  const pivotText = await page.locator('[data-sheet="stage"] table').innerText();
  await page.locator('[data-sheet="stage"] > div').evaluate(el => {el.scrollLeft=el.scrollWidth;});
  await page.screenshot({path:path.join(out,'browser-pivot-summary-right.png')});
  await page.locator('summary[title="Where this file also lives"]').click();
  const rawLink = page.getByRole('link',{name:'Raw',exact:true});
  const rawHref = await rawLink.getAttribute('href');
  const downloadPromise = page.waitForEvent('download',{timeout:5000});
  await rawLink.click();
  const download = await downloadPromise.catch(()=>null);
  const downloadedFile = path.join(here,'browser-downloaded-workbook.xlsx');
  if(download) await download.saveAs(downloadedFile);
  const downloaded = download ? await readFile(downloadedFile) : null;
  const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
  const loaded = await page.evaluate(()=> window.__loadedScripts?.map(s=>({path:s.path,status:s.status})));
  const compact = {revision,browserVersion:browser.version(),viewport:{width:1440,height:1000,deviceScaleFactor:1},page:'Original pages/data-view.html at pinned revision; served at localhost with use=revision and src=the pinned workbook',inputSha256:sha256(workbook),inputBytes:workbook.length,download:{action:'Where this file also lives > Raw',href:rawHref,status:download?'downloaded':'inconclusive',suggestedFilename:download?.suggestedFilename()??null,sha256:downloaded?sha256(downloaded):null,matchesInput:downloaded?sha256(downloaded)===sha256(workbook):null,transport:download?'Original Raw link navigated in browser; request fulfilled with previously downloaded exact GitHub fixture bytes because browser outbound network is denied. This proves link target and browser delivery under local transport, not a fresh remote fetch.':'Clicked the original Raw link but the source page emitted no download event in 5 seconds. Target opens separately. No downloaded workbook was obtained, so browser download identity is unverified.'},transport:{appAssets:'Exact pinned GitHub lib sources retrieved with curl; API/raw requests fulfilled from local copies without modifying source',workbook:'Exact pinned contents API request fulfilled with base64 of original downloaded bytes',vendorAssets:'Original CDN CSS/runtime cached locally; Alpine.js fetched from unpkg, collapse 3.15.12 from jsDelivr; JSZip 3.10.1 preloaded as original repository visual test does',limitations:'Phosphor icon CSS/font requests unavailable; navigation chrome icons missing, cell content unaffected'},targets:[{sheet:'RawData',table:'Financials',ref:'B5:N30'},{sheet:'PivotSummary',pivot:'FinancialPivot',ref:'B5:O19',source:'RawData!B5:N30'}],captures:['browser-raw-data.png','browser-pivot-summary.png','browser-pivot-summary-right.png'],loaded,pivotText};
  await writeFile(path.join(out,'browser-evidence.json'),JSON.stringify(compact,null,2));
  await writeFile(path.join(here,'browser-evidence.json'),JSON.stringify({...compact,url,requests,errors,snapshot:await page.locator('body').innerText()},null,2));
  console.log('DOWNLOAD',JSON.stringify(compact.download));
} catch(e) {
  await writeFile(path.join(here,'browser-failure.json'),JSON.stringify({error:String(e),requests,errors},null,2));
  console.error(String(e));
  process.exitCode=1;
} finally {await browser.close();server.close();}
