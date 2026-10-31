import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const handlers = new Map(), stores = new Map();
let network = 200, claimed = false, checks = 0;
const check = (value,message) => { assert.ok(value,message); checks++; };
const caches = {
  keys:async()=>[...stores.keys()], delete:async key=>stores.delete(key),
  open:async key=>{
    if (!stores.has(key)) stores.set(key,new Map());
    const entries=stores.get(key);
    return {put:async(path,response)=>entries.set(path,response),match:async path=>entries.get(path)?.clone()};
  }
};
const worker = vm.createContext({URL,Response,caches,fetch:async path=>{
  if (network === 'offline') throw new Error('Offline');
  return new Response(network === 200 ? 'Interface '+(typeof path === 'string' ? path : new URL(path.url).pathname) : 'Server response',{status:network});
},self:{location:{origin:'https://fixture.example.ts.net'},addEventListener:(name,fn)=>handlers.set(name,fn),skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}}});
vm.runInContext(readFileSync(new URL('../phone/sw.js',import.meta.url),'utf8'),worker);
async function lifecycle(name) { let job; handlers.get(name)({waitUntil:promise=>{job=promise;}}); await job; }
async function request(path,method='GET') {
  let response;
  handlers.get('fetch')({request:{url:new URL(path,'https://fixture.example.ts.net').href,method},respondWith:promise=>{response=promise;}});
  return response;
}
stores.set('another-app',new Map()); stores.set('web-tools-now-shell-old',new Map());
await lifecycle('install'); await lifecycle('activate');
check(claimed && stores.has('another-app') && !stores.has('web-tools-now-shell-old'),'Activation only removes this app’s older interface caches.');
const entries=[...stores].filter(([key])=>key.startsWith('web-tools-now-shell-')).flatMap(([,values])=>[...values.keys()]);
check(entries.includes('/') && entries.includes('/computer.js') && entries.every(key=>!key.startsWith('/api/')),'Only explicit interface assets enter Cache Storage.');
check(await request('/api/v1/now') === undefined && await request('/api/v1/computer') === undefined && await request('/api/v1/results/example') === undefined,'Private API requests always bypass the worker.');
check(await request('/phone.js','POST') === undefined && await request('https://foreign.example/phone.js') === undefined,'Write requests and other origins bypass the interface worker.');
network='offline';
check((await(await request('/?version=2')).text()).includes('Interface /'),'A saved interface can reload offline despite a cache-busting page query.');
check((await(await request('/computer.js')).text()).includes('Interface /computer.js'),'The Computer interface can load offline.');
network=502;
check((await(await request('/')).text()).includes('Interface /'),'A temporary proxy/server failure preserves access to the saved interface.');
for (const status of [403,404]) {
  network=status;
  const response=await request('/');
  check(response.status === status && (await response.text()) === 'Server response','An HTTP '+status+' response never falls back to cached interface assets.');
}
network=200;
check((await(await request('/')).text()).includes('Interface /'),'Network delivery resumes when the server recovers.');
console.log(`${checks} offline interface and access-boundary checks passed.`);
