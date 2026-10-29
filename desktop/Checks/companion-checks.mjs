import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {get} from 'node:http';
import {fileURLToPath} from 'node:url';

const fixture = await mkdtemp(join(tmpdir(),'web-tools-companion-check-'));
const token = randomBytes(32).toString('hex');
await writeFile(join(fixture,'companion-access.json'),JSON.stringify({LocalToken:token,TailscaleLogin:'owner@example.test',PhoneUrl:'https://fixture.example.ts.net/'}));
await writeFile(join(fixture,'settings.json'),JSON.stringify({RepositoriesRoot:join(fixture,'missing-checkout')}));
const port = 47832;
const executable = fileURLToPath(new URL('../Companion/bin/Release/net8.0-windows/WebTools.Companion.dll',import.meta.url));
const child = spawn('dotnet',[executable], {env:{...process.env,WEBTOOLS_COMPANION_DATA:fixture,WEBTOOLS_COMPANION_PORT:String(port)},windowsHide:true,stdio:'pipe'});
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
  check((await request('/')).status === 403,'The phone page also requires owner access.');
  check((await request('/api/v1/now',{'Tailscale-User-Login':'other@example.test'})).status === 403,'Another Tailscale identity cannot read the owner activity.');
  check((await request('/api/v1/desktop',owner)).status === 403,'The phone identity cannot read the desktop snapshot.');
  const native = await request('/api/v1/desktop',local);
  check(native.ok && (await native.json()).snapshot.places,'The local desktop bearer can read its native snapshot.');
  const first = await request('/api/v1/now',owner);
  const phone = await first.json();
  check(first.ok && phone.schemaVersion === 1 && Array.isArray(phone.items),'The owner receives the versioned phone projection.');
  check(Array.isArray(phone.usage) && (await request('/usage-view.js',owner)).ok,'The private phone API and assets expose the normalized usage view.');
  const serialized = JSON.stringify(phone);
  check(!serialized.includes(token) && !serialized.includes('repositoriesRoot') && !serialized.includes('workspace') && !serialized.includes('downloads'), 'The phone response omits credentials, configuration and filesystem fields.');
  check(first.headers.get('cache-control') === 'no-store' && first.headers.get('content-security-policy').includes("frame-ancestors 'none'"),'Private responses disable caching and framing.');
  check((await request('/api/v1/now',{...owner,'If-None-Match':first.headers.get('etag')})).status === 304,'An unchanged observation supports conditional polling.');
  check((await request('/api/v1/now',owner,'POST')).status === 405,'The companion rejects write requests.');
  check((await request('/api/v1/now',{...owner,Origin:'https://foreign.example'})).status === 403,'Foreign-origin requests are denied without CORS.');
  const foreignHost = await new Promise((resolve,reject) => get(`http://127.0.0.1:${port}/api/v1/now`,{headers:{...local,Host:'foreign.example'}},response => { response.resume(); resolve(response.statusCode); }).on('error',reject));
  check(foreignHost === 403,'An unexpected host cannot bypass the local boundary.');
  check((await request('/companion-access.json',owner)).status === 404 && (await request('/api/v1/results/missing',owner)).status === 404,'Settings and arbitrary result paths are unavailable.');
  check((await request('/vendor/assistant-mark.js',owner)).ok && (await request('/',owner)).ok,'The phone assets are served from the same private origin.');
  check((await request('/vendor/marked.js',owner)).ok && (await request('/vendor/purify.js',owner)).ok && (await request('/reading.js',owner)).ok,'The formatted detail renderer and its existing Markdown dependencies are served from the private origin.');
  await new Promise(resolve => setTimeout(resolve,2300));
  const later = await (await request('/api/v1/now',owner)).json();
  check(new Date(later.observedAt) > new Date(phone.observedAt),'Collection continues between requests with no desktop process.');
  console.log(`${checks} companion access and API checks passed.`);
} finally {
  child.kill();
  if (child.exitCode === null) await new Promise(resolve => child.once('exit',resolve));
  if (dirname(resolve(fixture)) === resolve(tmpdir()) && fixture.includes('web-tools-companion-check-')) await rm(fixture,{recursive:true,force:true});
}
