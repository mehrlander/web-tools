import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const dom = new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const {window} = dom, doc = window.document;
const now = new Date().toISOString(), earlier = seconds => new Date(Date.now()-seconds*1000).toISOString();
const item = (key,state,provider = 'Gemini') => ({key,id:key,kind:'errand',provider,location:'Laptop',title:key,state,detail:'',at:now,createdAt:now,needsAttention:false,isNew:false,url:null});
let snapshot = {schemaVersion:1,machineName:'Fixture laptop',observedAt:now,scanMilliseconds:8,sources:{queueAvailable:true,recordsConnected:true,recordsSyncedAt:now,workerState:'detected',cloudCapturedAt:now,notices:[]},items:[
  {...item('local','working','Codex'),kind:'session',title:'Working <img src=x onerror=alert(1)>',detail:'Checking the queue'},
  {...item('second','queued'),createdAt:earlier(20)}, {...item('first','queued'),createdAt:earlier(90)},
  item('accepted','claimed'), {...item('cloud','recorded','Claude'),kind:'cloud',location:'Cloud',detail:'Recorded: choice needed',needsAttention:true,url:'https://mehrlander.github.io/web-tools/app/?view=sessions&session=cloud'},
  {...item('result','complete'),title:'A complete result',url:'javascript:alert(1)'}
],events:[]};
const timers = new Map(); let nextTimer = 0, unavailable = false, fetches = 0, replyFetches = 0, checks = 0;
window.setTimeout = (fn,delay) => { timers.set(++nextTimer,{fn,delay}); return nextTimer; };
window.clearTimeout = id => timers.delete(id);
window.scrollTo = () => {};
window.AbortController = AbortController;
window.fetch = async path => {
  fetches++;
  if (unavailable) throw new Error('Offline');
  if (path.startsWith('/api/v1/results/')) { replyFetches++; return {ok:true,json:async () => ({reply:'Result <script>alert(1)</script>'})}; }
  return {ok:true,status:200,headers:{get:() => 'etag'},json:async () => structuredClone(snapshot)};
};
window.eval(read('../../lib/kits/claude-mark.js'));
window.eval(read('../../lib/kits/assistant-mark.js'));
window.eval(read('../phone/phone.js'));
const flush = () => new Promise(resolve => setImmediate(resolve));
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const click = selector => { const node = doc.querySelector(selector); assert.ok(node,selector); node.click(); };
async function poll() { const current = [...timers].find(([,timer]) => timer.delay >= 2000 && timer.delay !== 6000); assert.ok(current,'Poll scheduled'); timers.delete(current[0]); current[1].fn(); await flush(); }
await flush();
check(doc.querySelectorAll('#assistants svg').length === 3,'The phone view shows the three shared assistant marks.');
check(doc.querySelector('#connection').textContent.includes('Laptop live'),'A fresh observation has steady local live status.');
check(doc.querySelector('#content').textContent.includes('Needs you') && doc.querySelector('#content').textContent.includes('Recorded: choice needed'),'Cloud attention remains a recorded state.');
check(!doc.querySelector('#content img'),'Untrusted session titles render as text.');
click('[data-tab=queue]');
const queue = [...doc.querySelectorAll('#content [data-pick]')];
check(queue[0].dataset.pick === 'first' && queue[1].dataset.pick === 'second','The waiting queue follows request order.');
check(doc.querySelector('#content').textContent.includes('Accepted by worker'),'Claims remain distinct from observed execution.');
snapshot.sources.recordsConnected = false;
await poll();
check(doc.querySelector('#content').textContent.includes('Saved queue'),'An offline record source labels the saved queue.');
snapshot.sources.queueAvailable = false; snapshot.items = snapshot.items.filter(i => !['queued','claimed'].includes(i.state));
await poll();
check(doc.querySelector('#content').textContent.includes('Queue unavailable') && doc.querySelector('#queue-count').textContent === '?','An unavailable queue never appears clear.');
click('[data-tab=recent]'); click('[data-pick=result]'); await flush();
check(doc.querySelector('#overview').hidden && !doc.querySelector('#detail').hidden,'Selecting a result opens its phone detail view.');
check(doc.querySelector('#reply').textContent.includes('<script>') && !doc.querySelector('#reply script'),'Result content renders safely as text.');
check(!doc.querySelector('#detail a'),'Unsafe external URLs are omitted.');
const replyNode = doc.querySelector('#reply');
await poll();
check(replyFetches === 1 && doc.querySelector('#reply') === replyNode,'Unchanged polling preserves the selected reply and avoids a loading flash.');
unavailable = true; await poll();
check(doc.querySelector('#detail-connection').textContent.includes('Laptop unreachable'),'An unreachable laptop is explicit in the detail view.');
check(!doc.querySelector('#detail').hidden && doc.querySelector('#reply').textContent.includes('Result'),'Losing contact preserves the selected result.');
unavailable = false; snapshot.observedAt = earlier(60); await poll();
check(doc.querySelector('#connection').textContent.includes('Activity paused'),'A responding server with old observations is not live.');
snapshot.observedAt = new Date().toISOString(); await poll();
check(doc.querySelector('#connection').textContent.includes('Laptop live'),'Fresh activity recovers automatically after an outage.');
Object.defineProperty(doc,'hidden',{value:true,configurable:true}); doc.dispatchEvent(new window.Event('visibilitychange'));
const before = fetches;
check(![...timers.values()].some(t => t.delay === 2000),'Polling pauses when the page is hidden.');
Object.defineProperty(doc,'hidden',{value:false,configurable:true}); doc.dispatchEvent(new window.Event('visibilitychange')); await flush();
check(fetches > before,'Returning to the phone page refreshes immediately.');
console.log(`${checks} phone interaction checks passed.`);
dom.window.close();
