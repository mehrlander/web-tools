import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const require=createRequire('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../../outputs/excel-validation');
const revision='5109699ac5eea3ca510947859ff9e5cb3980676e';
const liveOnly=process.argv.includes('--live-only');
const workbook=await readFile(path.join(out,'demonstration-workbooks.xlsx'));
const rawUrl=`https://raw.githubusercontent.com/mehrlander/web-tools/${revision}/docs/examples/demonstration-workbooks.xlsx`;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile(path.join(here,'data-view.html')));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={revision,browserVersion:browser.version(),viewport:{width:1440,height:1000,deviceScaleFactor:1},specimenSha256:sha256(workbook),specimenBytes:workbook.length,rawUrl,appTransport:'Original pinned data-view.html and app source unchanged; dependency reads served from previously retrieved exact-revision local cache.',attempts:[]};
try {
  for(const transport of liveOnly?['live-network']:['live-network','local-same-url']){
    const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const attempt={transport,requests:[],responses:[],failures:[],downloads:[],pages:[]};
    const seen=new WeakSet();
    let finishDownload;
    const delivered=new Promise(r=>{finishDownload=r;});
    const saves=[];
    const attach=p=>{
      if(seen.has(p))return;
      seen.add(p);attempt.pages.push({initialUrl:p.url()});
      p.on('download',d=>{
        const task=(async()=>{
          const target=path.join(out,`roundtrip-${transport}-downloaded.xlsx`);
          try {
            await d.saveAs(target);
            const bytes=await readFile(target);
            attempt.downloads.push({url:d.url(),suggestedFilename:d.suggestedFilename(),file:path.basename(target),bytes:bytes.length,sha256:sha256(bytes),matchesSpecimen:sha256(bytes)===sha256(workbook),failure:await d.failure()});
          }catch(e){attempt.downloads.push({url:d.url(),error:String(e)});}
          finishDownload();
        })();
        saves.push(task);
      });
    };
    context.on('page',attach);
    context.on('request',r=>{if(r.url()===rawUrl)attempt.requests.push({url:r.url(),method:r.method(),resourceType:r.resourceType(),navigation:r.isNavigationRequest()});});
    context.on('requestfailed',r=>{if(r.url()===rawUrl)attempt.failures.push({url:r.url(),error:r.failure()?.errorText});});
    context.on('response',r=>{if(r.url()===rawUrl)attempt.responses.push({url:r.url(),status:r.status(),headers:r.headers()});});
    await context.addInitScript({content:await readFile('C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip/dist/jszip.min.js','utf8')});
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith(origin))return route.continue();
      if(url===rawUrl){
        if(transport==='live-network')return route.continue();
        attempt.fulfilledBody={source:'Original previously downloaded GitHub fixture',bytes:workbook.length,sha256:sha256(workbook),contentType:'application/octet-stream'};
        return route.fulfill({contentType:'application/octet-stream',body:workbook});
      }
      const u=new URL(url);
      if(u.pathname.includes('/contents/docs/examples/demonstration-workbooks.xlsx'))return route.fulfill({contentType:'application/json',body:JSON.stringify({name:'demonstration-workbooks.xlsx',path:'docs/examples/demonstration-workbooks.xlsx',size:workbook.length,encoding:'base64',content:workbook.toString('base64')})});
      let local=null,api=false;
      if(u.hostname==='raw.githubusercontent.com'&&u.pathname.includes('/'+revision+'/lib/'))local=path.basename(u.pathname);
      if(u.hostname==='api.github.com'&&u.pathname.includes('/contents/lib/')){local=path.basename(u.pathname);api=true;}
      if(url.includes('combine/npm/daisyui'))local='styles.css';
      if(url.includes('combine/npm/@tailwindcss/browser'))local='theme-runtime.js';
      if(u.hostname==='unpkg.com')local=url.includes('collapse')?'collapse.js':'alpine.js';
      if(local){
        try{const body=await readFile(path.join(here,local));
          if(api)return route.fulfill({contentType:'application/json',body:JSON.stringify({name:local,path:u.pathname.split('/contents/')[1],encoding:'base64',content:body.toString('base64'),size:body.length})});
          return route.fulfill({contentType:local.endsWith('.css')?'text/css':'text/javascript',body});
        }catch{}
      }
      return route.fulfill({status:404,body:'Outside the local validation cache'});
    });
    try {
      const page=await context.newPage();attach(page);
      await page.goto(`${origin}/data-view.html?use=${revision}&src=${encodeURIComponent(`mehrlander/web-tools@${revision}:docs/examples/demonstration-workbooks.xlsx`)}`,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('[data-sheet="stage"] table',{timeout:15000});
      await page.locator('summary[title="Where this file also lives"]').click();
      const raw=page.getByRole('link',{name:'Raw',exact:true});
      attempt.link={href:await raw.getAttribute('href'),target:await raw.getAttribute('target')};
      await page.screenshot({path:path.join(out,`roundtrip-${transport}-raw-menu.png`)});
      await raw.click();
      await Promise.race([delivered,new Promise(r=>setTimeout(r,5000))]);
      await Promise.allSettled(saves);
      attempt.result=attempt.downloads.length?'downloaded':attempt.failures.length?'network-failed':'no-download-observed';
    }catch(e){attempt.error=String(e);attempt.result='error';}
    finally{await context.close();}
    report.attempts.push(attempt);
    console.log(JSON.stringify(attempt));
  }
}finally{
  await browser.close();server.close();
  await writeFile(path.join(out,liveOnly?'roundtrip-live-evidence.json':'roundtrip-evidence.json'),JSON.stringify(report,null,2));
}
