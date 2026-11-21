import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir,symlink,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {get,createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

const fixture = await mkdtemp(join(tmpdir(),'web-tools-companion-check-'));
const token = randomBytes(32).toString('hex');
await writeFile(join(fixture,'companion-access.json'),JSON.stringify({LocalToken:token,TailscaleLogin:'owner@example.test',PhoneUrl:'https://fixture.example.ts.net/'}));
const folderRoot=join(fixture,'repositories');
await mkdir(join(folderRoot,'project','nested'),{recursive:true});
await mkdir(join(folderRoot,'project','.git'));
await writeFile(join(folderRoot,'project','note.txt'),'PRIVATE CONTENT');
await writeFile(join(fixture,'outside.txt'),'PRIVATE OUTSIDE');
await symlink(fixture,join(folderRoot,'junction'),'junction');
const outputsRoot=join(fixture,'outputs');
await mkdir(join(outputsRoot,'project'),{recursive:true});
await writeFile(join(outputsRoot,'project','note.txt'),'OUTPUT NOTE');
const unicodeText='# Caf\u00e9 result\n\nA file named with spaces and \u00e9.\n';
await writeFile(join(outputsRoot,'r\u00e9sult with spaces.md'),unicodeText);
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
await writeFile(join(folderRoot,'project','picture.png'),picture);
for(const [name,bytes] of [
  ['photo.jpeg',Buffer.from([255,216,255,224,0,2,255,217])],
  ['pixel.gif',Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')],
  ['pixel.webp',Buffer.from('524946460400000057454250','hex')],
  ['fake.png',Buffer.from('<svg onload="alert(1)"></svg>')],
  ['unsafe.html',Buffer.from('<script>alert(1)</script>')],
  ['unsafe.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')],
  ['unsafe.js',Buffer.from('alert(1)')],
  ['unsafe.xml',Buffer.from('<root/>')],
  ['invalid.txt',Buffer.from([255,254,0,1])],
  ['empty.txt',Buffer.alloc(0)],
  ['limit.txt',Buffer.alloc(1024*1024,120)],
  ['oversized.txt',Buffer.alloc(1024*1024+1,120)],
]) await writeFile(join(folderRoot,'project',name),bytes);
const largePath=join(folderRoot,'project','large.bin'),largeHandle=await open(largePath,'w');
await largeHandle.truncate(64*1024*1024);await largeHandle.close();
let fileLink=false;
try {await symlink(join(fixture,'outside.txt'),join(folderRoot,'project','linked.txt'),'file');fileLink=true;}
catch(error){if(process.platform!=='win32'||error.code!=='EPERM')throw error;console.log('Skipped file-symlink check: this Windows account cannot create file symlinks.');}
await writeFile(join(fixture,'settings.json'),JSON.stringify({RepositoriesRoot:folderRoot}));
// Parallel sessions can run companion checks on the same laptop.
const reservation=createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
const mediaActions=[];
let mediaState={sessionAvailable:true,source:'Fixture player',title:'Fixture track',artist:'Artist',album:'Album',playbackStatus:'Playing',positionSeconds:12,endSeconds:120,canPlayPause:true,canGoPrevious:false,canGoNext:true};
let mediaMode='normal', actionMode='normal';
const bridge=createServer((req,res)=>{
  if(req.url==='/api/status') {
    if(mediaMode==='redirect') {res.writeHead(302,{Location:'/unexpected'});res.end();return;}
    if(mediaMode==='oversized') {res.end('x'.repeat(20000));return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mediaState));return;
  }
  if(req.method==='POST' && req.url.startsWith('/api/action/')) {
    mediaActions.push(req.url);
    if(actionMode==='timeout') {setTimeout(()=>res.end('{"ok":true}'),4000);return;}
    res.end('{"ok":true}');return;
  }
  mediaActions.push('unexpected:'+req.url);res.writeHead(404);res.end();
});
await new Promise(resolve=>bridge.listen(0,'127.0.0.1',resolve));
const bridgePort=bridge.address().port;
const executable = fileURLToPath(new URL('../Companion/bin/Release/net8.0-windows/WebTools.Companion.dll',import.meta.url));
const child = spawn('dotnet',[executable], {env:{...process.env,WEBTOOLS_COMPANION_DATA:fixture,WEBTOOLS_COMPANION_PORT:String(port),WEBTOOLS_TEST_STEREO_PORT:String(bridgePort)},windowsHide:true,stdio:'pipe'});
let errors = '';
child.stderr.on('data',chunk => { errors += chunk; });
let checks = 0;
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const local = {Authorization:'Bearer '+token};
const owner = {'Tailscale-User-Login':'owner@example.test'};
const request = (path,headers = {},method = 'GET') => fetch(`http://127.0.0.1:${port}${path}`,{headers,method});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Companion exited: '+errors);
    try { if ((await request('/api/v1/now',local)).status === 200) { ready = true; break; } } catch { }
    await new Promise(resolve => setTimeout(resolve,100));
  }
  check(ready,'The background collector produces an activity snapshot without a desktop window.');
  check((await request('/api/v1/now')).status === 403,'Anonymous local requests cannot read activity.');
  check((await request('/api/v1/computer')).status === 403 && (await request('/api/v1/computer',{'Tailscale-User-Login':'other@example.test'})).status === 403,'Computer readings share the owner-only access boundary.');
  check((await request('/')).status === 403,'The phone page also requires owner access.');
  check((await request('/api/v1/now',{'Tailscale-User-Login':'other@example.test'})).status === 403,'Another Tailscale identity cannot read the owner activity.');
  check((await request('/api/v1/desktop',owner)).status === 403,'The phone identity cannot read the desktop snapshot.');
  const native = await request('/api/v1/desktop',local);
  check(native.ok && (await native.json()).snapshot.places,'The local desktop bearer can read its native snapshot.');
  const first = await request('/api/v1/now',owner);
  const phone = await first.json();
  const errandResponse=await request('/api/v1/errands',owner), errands=await errandResponse.json();
  check(errandResponse.ok && errands.schemaVersion===1 && Array.isArray(errands.items)
    && typeof errands.queueAvailable==='boolean','The owner can read the dedicated assistant queue.');
  check((await request('/api/v1/errands')).status===403
    && (await request('/api/v1/errands',{'Tailscale-User-Login':'other@example.test'})).status===403,
    'Errand history shares the owner-only boundary.');
  check((await request('/api/v1/errands',{...owner,'If-None-Match':errandResponse.headers.get('etag')})).status===304
    && (await request('/api/v1/errands',owner,'POST')).status===405,'The queue supports conditional reads without work-initiation actions.');
  check((await request('/errands-view.js',owner)).ok,'The shared queue interface is a private companion asset.');
  check(first.ok && phone.schemaVersion === 1 && Array.isArray(phone.items),'The owner receives the versioned phone projection.');
  check(Array.isArray(phone.usage) && (await request('/usage-view.js',owner)).ok,'The private phone API and assets expose the normalized usage view.');
  const computerResponse = await request('/api/v1/computer',owner), computer = await computerResponse.json();
  check(computerResponse.ok && computer.schemaVersion === 1 && Array.isArray(computer.applications) && computer.sessionState === 'unknown' && computer.cpuPercent === null,'The separate Computer projection uses explicit unavailable readings in an isolated fixture.');
  check(!JSON.stringify(computer).includes(token) && !JSON.stringify(computer).includes('repositoriesRoot') && !JSON.stringify(computer).includes('commandLine'),'Computer readings omit credentials, commands and settings.');
  check((await request('/api/v1/computer',{...owner,'If-None-Match':computerResponse.headers.get('etag')})).status === 304,'Computer polling supports unchanged observations.');
  check((await request('/api/v1/computer',owner,'POST')).status === 405,'The Computer route offers no machine control actions.');
  check((await request('/computer.js',owner)).ok && (await request('/sw.js',owner)).ok,'The Computer view and offline interface worker are explicit private assets.');
  const serialized = JSON.stringify(phone);
  check(!serialized.includes(token) && !serialized.includes('repositoriesRoot') && !serialized.includes('workspace') && !serialized.includes('downloads'), 'The phone response omits credentials, configuration and filesystem fields.');
  check(first.headers.get('cache-control') === 'no-store' && first.headers.get('content-security-policy').includes("frame-ancestors 'none'"),'Private responses disable caching and framing.');
  check((await request('/api/v1/now',{...owner,'If-None-Match':first.headers.get('etag')})).status === 304,'An unchanged observation supports conditional polling.');
  check((await request('/api/v1/now',owner,'POST')).status === 405,'The activity API remains read-only.');
  check((await request('/api/v1/now',{...owner,Origin:'https://foreign.example'})).status === 403,'Foreign-origin requests are denied without CORS.');
  const foreignHost = await new Promise((resolve,reject) => get(`http://127.0.0.1:${port}/api/v1/now`,{headers:{...local,Host:'foreign.example'}},response => { response.resume(); resolve(response.statusCode); }).on('error',reject));
  check(foreignHost === 403,'An unexpected host cannot bypass the local boundary.');
  check((await request('/companion-access.json',owner)).status === 404 && (await request('/api/v1/results/missing',owner)).status === 404,'Settings and arbitrary result paths are unavailable.');
  const rootPage=await request('/',owner);
  check((await request('/vendor/assistant-mark.js',owner)).ok && rootPage.ok,'The phone assets are served from the same private origin.');
  check(/(?:^|;)\s*img-src[^;]*\bblob:/.test(rootPage.headers.get('content-security-policy')||''),'The private parent page permits raster preview object URLs.');
  check((await request('/vendor/marked.js',owner)).ok && (await request('/vendor/purify.js',owner)).ok && (await request('/reading.js',owner)).ok,'The formatted detail renderer and its existing Markdown dependencies are served from the private origin.');
  const controls={...owner,Origin:`http://127.0.0.1:${port}`,'X-WebTools-Action':'1'};
  check(['errands','sessions','summaries'].every(key=>phone.sources.sync?.[key] && ['unknown','refreshing','ok','error'].includes(phone.sources.sync[key].state))
    &&Array.isArray(phone.sources.syncNotices),'The phone exposes separately classified feed health and exact safe legacy notices.');
  for(const headers of [owner,{...owner,Origin:controls.Origin},{...owner,'X-WebTools-Action':'1'},{...controls,Origin:'https://foreign.example'},{...controls,'Sec-Fetch-Site':'cross-site'}, {...controls,'Tailscale-User-Login':'other@example.test'}])
    check((await request('/api/v1/sync/retry',headers,'POST')).status===403,'Sync retry requires owner access, deliberate-action header and same origin.');
  check((await request('/api/v1/sync/retry',controls)).status===405
    &&(await request('/api/v1/sync/retry?feed=all',controls,'POST')).status===403,
    'Sync retry has no GET side effects and rejects query parameters.');
  check((await fetch(`http://127.0.0.1:${port}/api/v1/sync/retry`,{method:'POST',headers:controls,body:'arbitrary'})).status===403,
    'Sync retry rejects request bodies.');
  const syncRetry=await request('/api/v1/sync/retry',controls,'POST'),syncReply=await syncRetry.json();
  check(syncRetry.status===503&&syncReply.accepted===false&&syncReply.retryAfterSeconds===0,
    'An isolated missing activity checkout returns a safe unavailable retry response without reading a real repository.');
  const repositoryResponse=await request('/api/v1/repositories',owner), repositoryData=await repositoryResponse.json();
  check(repositoryResponse.ok && repositoryData.repositories.length===0 && repositoryData.refreshing.length===0,'Isolated API fixtures never discover or fetch the real checkout estate.');
  check((await request('/api/v1/repositories')).status===403 && (await request('/api/v1/repositories',{'Tailscale-User-Login':'other@example.test'})).status===403,'Repository observations share the owner-only access boundary.');
  check((await request('/api/v1/repositories',{...owner,'If-None-Match':repositoryResponse.headers.get('etag')})).status===304,'Repository polling supports conditional observations.');
  for(const headers of [owner,{...controls,Origin:'https://foreign.example'},{...controls,'Sec-Fetch-Site':'cross-site'}])
    check((await request('/api/v1/repositories/all/fetch',headers,'POST')).status===403,'Repository fetches require the deliberate-action header and same origin.');
  check((await request('/api/v1/repositories/missing/fetch',controls,'POST')).status===404 && (await request('/api/v1/repositories/all/fetch',controls,'POST')).status===404,'Unknown or empty repository selections cannot start a Git process.');
  check((await request('/api/v1/repositories/all/pull',controls,'POST')).status===405 && (await request('/api/v1/repositories',owner,'POST')).status===405,'Repository routes offer no pull or branch integration actions.');
  check((await request('/repositories.js',owner)).ok && repositoryResponse.headers.get('cache-control')==='no-store','Repository assets are explicit and private observations are not HTTP cached.');
  check((await request('/local-files.js',owner)).ok && (await request('/local-files.js')).status===403,'The local-files interface shares the existing private asset boundary.');
  check((await request('/vendor/title-tip.js',owner)).ok && (await request('/vendor/title-tip.js')).status===403,'The shared commit tooltip is an explicit private asset.');
  check((await request('/api/v1/files')).status===403&&(await request('/api/v1/files',{'Tailscale-User-Login':'other@example.test'})).status===403,'Folder names require the same owner access as activity.');
  const rootFiles=await request('/api/v1/files',owner);
  assert.equal(rootFiles.status,200,'The configured root listing is available.');
  const rootListing=await rootFiles.json();
  check(rootFiles.ok&&rootListing.rootName==='repositories'&&rootListing.entries.length===1&&rootListing.entries[0].name==='project'&&rootFiles.headers.get('cache-control')==='no-store','The explorer lists only direct children of its configured root and skips junctions.');
  const projectFiles=await request('/api/v1/files?path=project',owner);
  assert.equal(projectFiles.status,200,'The project folder listing is available.');
  const projectListing=await projectFiles.json();
  check(projectFiles.ok&&projectListing.entries.some(e=>e.name==='note.txt')&&!projectListing.entries.some(e=>e.name==='.git')&&!JSON.stringify(projectListing).includes('PRIVATE')&&!JSON.stringify(projectListing).includes(folderRoot),'Directory responses contain relative names and metadata, without contents or administrative files.');
  for(const path of ['..','../outside.txt','project/../..','project/.git','project/.GIT/config','project/.git.','project/.. /outside','project\\nested','C:/Windows','project/note.txt:stream'])
    check((await request('/api/v1/files?path='+encodeURIComponent(path),owner)).status===400,'Invalid or administrative folder paths are rejected.');
  check((await request('/api/v1/files?path=junction',owner)).status===403&&(await request('/api/v1/files?path=missing',owner)).status===404,'Links and missing folders cannot be traversed.');
  check((await request('/api/v1/files?path=project/note.txt',owner)).status===404&&(await request('/api/v1/files?path=project&other=x',owner)).status===400&&(await request('/api/v1/files?path=project&path=elsewhere',owner)).status===400,'File reads, extra parameters and duplicate paths are not accepted.');
  check((await request('/api/v1/files',owner,'POST')).status===405&&(await request('/api/v1/files',{...owner,Origin:'https://foreign.example'})).status===403,'The folder API shares the same-origin read-only boundary.');
  const contentChecksBefore=checks;
  const contentUrl=(path,root='gh',extra='')=>'/api/v1/files/content?'+new URLSearchParams({root,path})+extra;
  const downloadSandbox=/(?:^|;)\s*sandbox\s+allow-downloads\s*(?:;|$)/;
  const outputsResponse=await request('/api/v1/files?root=outputs',owner);
  assert.equal(outputsResponse.status,200,'The outputs listing is available.');
  const outputsListing=await outputsResponse.json();
  check(outputsResponse.ok&&outputsListing.rootName==='outputs'&&outputsListing.entries.some(e=>e.name==='r\u00e9sult with spaces.md')
    &&!JSON.stringify(outputsListing).includes(fixture),'The second named root lists its own relative names without exposing a physical root.');
  for(const root of ['gh','outputs','gh']){
    const response=await request('/api/v1/files?'+new URLSearchParams({root,path:'project'}),owner);
    assert.equal(response.status,200,'The selected root folder listing is available.');
    const value=await response.json();
    check(response.ok&&value.entries.some(e=>e.name==='note.txt')&&value.entries.some(e=>e.name==='picture.png')===(root==='gh'),
      'Folder cache entries remain isolated by named root.');
  }
  for(const method of ['GET','HEAD']){
    for(const headers of [{},{'Tailscale-User-Login':'other@example.test'},{...owner,Origin:'https://foreign.example'}]){
      check((await request(contentUrl('project/note.txt'),headers,method)).status===403,'Content '+method+' keeps the owner and same-origin access boundary.');
      check((await request(contentUrl('project/note.txt','gh','&download=1'),headers,method)).status===403,'Downloads keep the same access boundary as previews.');
    }
    const response=await request(contentUrl('project/note.txt'),local,method);
    check(response.ok&&response.headers.get('content-type')==='text/plain; charset=utf-8'
      &&(await response.text())===(method==='HEAD'?'':'PRIVATE CONTENT'),'The existing local bearer can read '+method+' content without a token in the URL.');
  }
  const note=await request(contentUrl('project/note.txt'),owner);
  check(note.ok&&await note.text()==='PRIVATE CONTENT'&&note.headers.get('cache-control')==='no-store'
    &&note.headers.get('x-content-type-options')==='nosniff'&&note.headers.get('referrer-policy')==='no-referrer'
    &&downloadSandbox.test(note.headers.get('content-security-policy')||'')&&note.headers.get('content-security-policy').includes("frame-ancestors 'none'")
    &&note.headers.get('content-security-policy').includes("base-uri 'none'")&&note.headers.get('content-security-policy').includes("form-action 'none'"),
    'An owner preview has exact file text and the private response headers.');
  const outputNote=await request(contentUrl('project/note.txt','outputs'),owner);
  check(outputNote.ok&&await outputNote.text()==='OUTPUT NOTE','The same relative content path resolves separately in outputs.');
  const unicodeResponse=await request(contentUrl('r\u00e9sult with spaces.md','outputs'),owner);
  check(unicodeResponse.ok&&await unicodeResponse.text()===unicodeText&&unicodeResponse.headers.get('content-type')==='text/plain; charset=utf-8',
    'Unicode and spaced names deliver Markdown source as inert text.');
  const imageResponse=await request(contentUrl('project/picture.png'),owner);
  check(imageResponse.ok&&imageResponse.headers.get('content-type')==='image/png'
    &&Buffer.from(await imageResponse.arrayBuffer()).equals(picture),'A signed raster image is delivered byte for byte.');
  check(imageResponse.headers.get('content-security-policy').includes("style-src 'unsafe-inline'")
    &&!note.headers.get('content-security-policy').includes('style-src'),
    'Only verified raster previews permit the native image viewer inline styles.');
  for(const [name,type] of [['photo.jpeg','image/jpeg'],['pixel.gif','image/gif'],['pixel.webp','image/webp']]){
    const response=await request(contentUrl('project/'+name),owner,'HEAD');
    check(response.ok&&response.headers.get('content-type')===type&&!(await response.arrayBuffer()).byteLength,'The raster allowlist recognizes '+type+' for HEAD.');
  }
  for(const name of ['fake.png','unsafe.html','unsafe.svg','unsafe.js','unsafe.xml','invalid.txt','oversized.txt']){
    const response=await request(contentUrl('project/'+name),owner,'HEAD');
    check(response.ok&&response.headers.get('content-type')==='application/octet-stream'
      &&response.headers.get('content-disposition')?.startsWith('attachment;'),'Active, mismatched, invalid or oversized content downloads instead of running inline: '+name);
  }
  const textLimit=await request(contentUrl('project/limit.txt'),owner,'HEAD');
  check(textLimit.ok&&textLimit.headers.get('content-type')==='text/plain; charset=utf-8'&&Number(textLimit.headers.get('content-length'))===1024*1024,
    'A text file at the preview byte limit remains previewable.');
  const oversized=await request(contentUrl('project/oversized.txt'),owner,'HEAD');
  check(Number(oversized.headers.get('content-length'))===1024*1024+1,'HEAD reports the original length of a text file beyond the preview limit.');
  const empty=await request(contentUrl('project/empty.txt'),owner);
  check(empty.ok&&empty.headers.get('content-type')==='text/plain; charset=utf-8'&&empty.headers.get('content-length')==='0'&&await empty.text()==='',
    'An empty text file has a zero-length preview.');
  const download=await request(contentUrl('project/picture.png','gh','&download=1'),owner);
  check(download.ok&&download.headers.get('content-type')==='application/octet-stream'&&download.headers.get('content-disposition')?.startsWith('attachment;')
    &&downloadSandbox.test(download.headers.get('content-security-policy')||'')&&!download.headers.get('content-security-policy').includes('style-src')
    &&Buffer.from(await download.arrayBuffer()).equals(picture),
    'An explicit download preserves the original bytes and permits a browser save without enabling scripts or same-origin sandbox access.');
  for(const [range,start,end] of [['bytes=0-7',0,7],['bytes=-4',picture.length-4,picture.length-1]]){
    const response=await request(contentUrl('project/picture.png'),{...owner,Range:range});
    check(response.status===206&&response.headers.get('content-range')===`bytes ${start}-${end}/${picture.length}`
      &&Buffer.from(await response.arrayBuffer()).equals(picture.subarray(start,end+1)),'Raster byte ranges return their exact requested slice.');
  }
  const rangedHead=await request(contentUrl('project/picture.png'),{...owner,Range:'bytes=0-7'},'HEAD');
  check(rangedHead.status===206&&rangedHead.headers.get('content-length')==='8'&&!(await rangedHead.arrayBuffer()).byteLength,'A ranged HEAD has range headers and no body.');
  const outsideRange=await request(contentUrl('project/picture.png'),{...owner,Range:'bytes=999999-'});
  check(outsideRange.status===416&&outsideRange.headers.get('content-range')===`bytes */${picture.length}`,'An unsatisfiable byte range returns the file length without bytes.');
  const malformedRange=await request(contentUrl('project/picture.png'),{...owner,Range:'bytes=not-a-range'});
  check(malformedRange.status===200&&Buffer.from(await malformedRange.arrayBuffer()).equals(picture),'A malformed Range falls back to a complete framework file response.');
  for(const path of ['','..','../outside.txt','project/../outside.txt','/project/note.txt','project//note.txt','project/.git/config',
    'project/.GIT/config','project/.git.','project/note.txt:stream','project\\note.txt','C:/Windows/win.ini','project/NUL.txt','project/CON','project/note.txt '])
    check((await request(contentUrl(path),owner)).status===400,'Invalid, administrative and device file paths are rejected: '+JSON.stringify(path));
  for(const path of ['project','missing.txt','project/missing.txt'])
    check((await request(contentUrl(path),owner)).status===404,'Directories and missing files do not become content reads.');
  check((await request(contentUrl('junction/outside.txt'),owner)).status===403,'Content delivery never follows a directory junction.');
  if(fileLink)check((await request(contentUrl('project/linked.txt'),owner)).status===403,'Content delivery never follows a file symlink.');
  for(const suffix of ['?root=unknown&path=project/note.txt','?root=&path=project/note.txt','?root=gh&root=outputs&path=project/note.txt',
    '?path=project/note.txt&path=elsewhere','?path=project/note.txt&download=0','?path=project/note.txt&download=1&download=1','?path=project/note.txt&other=x','?root=gh'])
    check((await request('/api/v1/files/content'+suffix,owner)).status===400,'Content queries reject unknown roots, duplicate fields, extra fields and invalid download flags.');
  for(const suffix of ['?root=unknown','?root=','?root=gh&root=outputs','?root=gh&path=&path=elsewhere','?root=gh&other=x'])
    check((await request('/api/v1/files'+suffix,owner)).status===400,'Folder queries accept only the two fixed named roots and unique known fields.');
  check((await request(contentUrl('../outside.txt','outputs'),owner)).status===400,'The outputs root cannot escape into companion settings or sibling files.');
  const failure=await request(contentUrl('missing.txt'),owner);
  check(!(await failure.text()).includes(fixture),'File failures never expose a physical root.');
  check((await request(contentUrl('project/note.txt'),owner,'POST')).status===405,'Content routes remain read-only.');
  const abort=new AbortController(),transfer=await fetch(`http://127.0.0.1:${port}${contentUrl('project/large.bin')}`,{headers:owner,signal:abort.signal});
  const reader=transfer.body.getReader();await reader.read();abort.abort();await reader.cancel().catch(()=>{});
  let released=false;
  for(let attempt=0;attempt<50;attempt++){
    try{const handle=await open(largePath,'r+');await handle.close();released=true;break;}
    catch(error){if(!['EACCES','EPERM','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,20));}
  }
  check(released,'Aborting a streamed download releases the file handle for a writer.');
  console.log(`${checks-contentChecksBefore} rooted file content checks passed.`);
  const command='/api/v1/devices/stereo/';
  check((await request('/devices.js',owner)).ok && (await request('/views.js',owner)).ok,'Devices and shared navigation are explicit private assets.');
  check((await request('/api/v1/devices')).status===403 && (await request(command+'mute',{},'POST')).status===403,'Anonymous requests cannot read devices or control media.');
  check((await request(command+'mute',{'Tailscale-User-Login':'other@example.test',Origin:controls.Origin,'X-WebTools-Action':'1'},'POST')).status===403,'Other Tailscale identities cannot control media.');
  const mediaResponse=await request('/api/v1/devices',owner);
  assert.equal(mediaResponse.status,200,'The device observation is available.');
  const media=await mediaResponse.json();
  check(media.reachable && media.sessionAvailable && media.title==='Fixture track' && media.playbackState==='playing' && media.positionSeconds===12,'The fixed loopback adapter normalizes a media observation.');
  check(!JSON.stringify(media).includes(token) && !JSON.stringify(media).includes('127.0.0.1'),'The device projection omits access secrets and upstream addresses.');
  for(const headers of [owner,{...owner,Origin:controls.Origin},{...owner,'X-WebTools-Action':'1'},{...controls,Origin:'https://foreign.example'},{...controls,'Sec-Fetch-Site':'cross-site'}])
    check((await request(command+'mute',headers,'POST')).status===403,'Media actions reject absent Origin/header and cross-site browser requests.');
  const getControl=await request(command+'mute',controls,'GET'), optionsControl=await request(command+'mute',controls,'OPTIONS');
  assert.equal(getControl.status,405,'GET status');assert.equal(optionsControl.status,405,'OPTIONS status');
  check(mediaActions.length===0,'GET and preflight cannot trigger playback.');
  check((await request(command+'mute?target=elsewhere',controls,'POST')).status===403,'A caller cannot add a proxy target or other query.');
  check((await fetch(`http://127.0.0.1:${port}${command}mute`,{method:'POST',headers:controls,body:'arbitrary'})).status===403,'Media actions reject request bodies.');
  check((await request(command+'launch',controls,'POST')).status===404 && (await request(command+'previous',controls,'POST')).status===409 && mediaActions.length===0,'Unknown actions and unavailable capabilities never reach the player.');
  for(const action of ['play-pause','next','volume-down','mute','volume-up'])
    check((await request(command+action,controls,'POST')).status===200,'An authorized '+action+' reaches only its fixed media endpoint.');
  check(mediaActions.length===5 && mediaActions.every(path=>path.startsWith('/api/action/')),'Each accepted control is forwarded once with no arbitrary path.');
  mediaState.sessionAvailable=false;
  check((await request(command+'play-pause',controls,'POST')).status===409 && (await request(command+'volume-up',{...local,'X-WebTools-Action':'1'},'POST')).status===200,'No-session playback is blocked; the local bearer can still adjust laptop volume.');
  mediaState.error='SECRET native failure';
  const unavailable=await(await request('/api/v1/devices',owner)).json();
  check(!unavailable.reachable && !JSON.stringify(unavailable).includes('SECRET'),'Native errors are sanitized into an unavailable observation.');
  delete mediaState.error;
  for(const mode of ['redirect','oversized']) {mediaMode=mode;check(!(await(await request('/api/v1/devices',owner)).json()).reachable,'The adapter rejects '+mode+' upstream responses.');}
  mediaMode='normal';actionMode='timeout';
  const count=mediaActions.length;
  const pendingAction=request(command+'mute',controls,'POST');
  for(let attempt=0;attempt<50 && mediaActions.length===count;attempt++) await new Promise(resolve=>setTimeout(resolve,20));
  check((await request(command+'mute',controls,'POST')).status===409,'Overlapping actions are rejected rather than queued.');
  check((await pendingAction).status===502 && mediaActions.length===count+1,'A timed-out toggle is reported as unconfirmed and never retried.');
  await new Promise(resolve => setTimeout(resolve,2300));
  const later = await (await request('/api/v1/now',owner)).json();
  check(new Date(later.observedAt) > new Date(phone.observedAt),'Collection continues between requests with no desktop process.');
  console.log(`${checks} companion access and API checks passed.`);
} finally {
  bridge.closeAllConnections();await new Promise(resolve=>bridge.close(resolve));
  child.kill();
  if (child.exitCode === null) await new Promise(resolve => child.once('exit',resolve));
  if (dirname(resolve(fixture)) === resolve(tmpdir()) && fixture.includes('web-tools-companion-check-')) await rm(fixture,{recursive:true,force:true});
}
