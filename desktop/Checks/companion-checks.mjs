import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {get,createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

const fixture = await mkdtemp(join(tmpdir(),'web-tools-companion-check-'));
const token = randomBytes(32).toString('hex');
await writeFile(join(fixture,'companion-access.json'),JSON.stringify({LocalToken:token,TailscaleLogin:'owner@example.test',PhoneUrl:'https://fixture.example.ts.net/'}));
await writeFile(join(fixture,'settings.json'),JSON.stringify({RepositoriesRoot:join(fixture,'missing-checkout')}));
const port = 47832;
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
  check((await request('/vendor/assistant-mark.js',owner)).ok && (await request('/',owner)).ok,'The phone assets are served from the same private origin.');
  check((await request('/vendor/marked.js',owner)).ok && (await request('/vendor/purify.js',owner)).ok && (await request('/reading.js',owner)).ok,'The formatted detail renderer and its existing Markdown dependencies are served from the private origin.');
  const controls={...owner,Origin:`http://127.0.0.1:${port}`,'X-WebTools-Action':'1'};
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
