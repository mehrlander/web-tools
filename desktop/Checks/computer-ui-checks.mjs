import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const dom = new JSDOM(read('../phone/index.html'),{url:'https://laptop.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w = dom.window, doc = w.document;
const now = new Date().toISOString();
let computer = {schemaVersion:1,machineName:'Laptop',observedAt:now,windowsObservedAt:now,sessionState:'unlocked',remoteSession:false,cpuPercent:12.5,memoryPercent:60,memoryUsedGb:9.6,memoryTotalGb:16,batteryPercent:85,pluggedIn:true,charging:true,applications:[
  {key:'chrome',name:'Chrome',icon:'data:image/png;base64,aGVsbG8=',windows:[{key:'1',title:'Web Tools',minimized:false,inFront:true},{key:'2',title:'<img src=x onerror=alert(1)>',minimized:true,inFront:false}]},
  {key:'terminal',name:'Terminal',icon:'javascript:alert(1)',windows:[{key:'3',title:'Build',minimized:true,inFront:false}]}
]};
let offline = false, denied = false, top = 0, computerReads = 0, checks = 0;
const timers = new Map(); let nextTimer = 0;
w.setTimeout = (fn,delay) => { timers.set(++nextTimer,{fn,delay}); return nextTimer; };
w.clearTimeout = id => timers.delete(id);
Object.defineProperty(w,'scrollY',{get:()=>top});
w.scrollTo = (_x,y) => {top=y;};
w.AbortController = AbortController;
w.fetch = async path => {
  if (offline) throw new Error('Offline');
  if (path === '/api/v1/computer') { computerReads++; return {ok:!denied,status:denied?403:200,headers:{get:()=> 'computer-etag'},json:async()=>structuredClone(computer)}; }
  return {ok:true,status:200,headers:{get:()=> 'now-etag'},json:async()=>({schemaVersion:1,machineName:'Laptop',observedAt:now,sources:{notices:[],queueAvailable:true,recordsConnected:true},items:[],events:[]})};
};
w.eval(read('../../lib/kits/claude-mark.js'));
w.eval(read('../../lib/kits/assistant-mark.js'));
w.eval(read('../shared/now-shared.js'));
w.eval(read('../phone/computer.js'));
w.eval(read('../phone/phone.js'));
const flush = () => new Promise(resolve => setImmediate(resolve));
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const click = selector => { const node=doc.querySelector(selector); assert.ok(node,selector); node.click(); };
const poll = async () => { w.dispatchEvent(new w.Event('online')); await flush(); };
await flush();
check(computerReads === 0 && doc.querySelector('#computer').hidden,'Computer sampling is requested by the phone only while its view is open.');
click('#view-picker'); check(!doc.querySelector('#view-menu').hidden,'The compact title opens view choices.');
top = 280; click('[data-view=computer]'); await flush();
check(w.location.hash === '#view=computer' && doc.querySelector('#view-title').textContent === 'Computer' && doc.querySelector('#assistants').hidden && doc.querySelector('#content').hidden && !doc.querySelector('#computer').hidden,'Computer is a separate view without an extra full-width tab strip.');
check(doc.querySelector('#computer').textContent.includes('Chrome') && doc.querySelector('#computer').textContent.includes('3 windows') && doc.querySelector('#computer').textContent.includes('9.6 / 16 GB'),'Applications group their windows and show compact whole-machine measurements.');
check(doc.querySelectorAll('#computer img').length === 1 && !doc.querySelector('#computer [onerror]') && doc.querySelector('#windows-chrome').textContent.includes('<img'),'Only bounded PNG icons are accepted and window titles render as text.');
click('[data-computer-app=chrome]');
check(!doc.querySelector('#windows-chrome').hidden && doc.querySelector('#windows-chrome').textContent.includes('Minimized'),'Tapping an application reveals titles, including minimized windows.');
top = 240; doc.querySelector('[data-computer-app=chrome]').focus(); computer.cpuPercent=24; await poll();
check(top === 240 && !doc.querySelector('#windows-chrome').hidden && doc.activeElement.dataset.computerApp === 'chrome','Polling preserves open rows, keyboard focus and page position.');
check(doc.querySelector('#computer').textContent.includes('24%') && !doc.querySelector('#connection').textContent.includes('Checking'),'Measurements update quietly without a checking flash.');
computer.sessionState='locked'; computer.notice='Computer locked. Showing the last observed windows.'; computer.windowsObservedAt=new Date(Date.now()-600000).toISOString(); await poll();
check(doc.querySelector('#computer').textContent.includes('Computer locked') && !doc.querySelector('#computer').textContent.includes('In front') && doc.querySelector('[data-computer-app=chrome]'),'Locked observations retain the prior list without claiming the foreground window is current.');
computer.sessionState='disconnected'; computer.remoteSession=true; computer.notice='Windows session disconnected. Showing the last observed windows.'; await poll();
check(doc.querySelector('#computer').textContent.includes('Session disconnected') && doc.querySelector('#computer').textContent.includes('Remote desktop'),'Remote session and disconnection are explicit Windows states.');
offline=true; await poll();
check(doc.querySelector('#computer').textContent.includes('Last seen') && doc.querySelector('[data-computer-app=chrome]') && !doc.querySelector('#connection').textContent.includes('Live'),'Lost contact retains a labeled last observation, never a live claim.');
click('#remote-picker');
check(!doc.querySelector('#remote-menu').hidden && doc.querySelector('#remote-connect').href === 'rdp://full%20address=s:laptop.example.ts.net' && doc.querySelector('a[href^="shortcuts:"]').href === 'shortcuts://run-shortcut?name=Windows%20App','The offline interface retains a credential-free private RDP link and documented Shortcut fallback.');
doc.querySelector('#remote-connect').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(doc.querySelector('#remote-menu').hidden && doc.activeElement.id === 'remote-picker','Escape closes the remote menu and restores focus.');
click('#view-picker'); click('[data-view=now]'); await flush();
check(top === 280 && !doc.querySelector('#content').hidden && !doc.querySelector('#assistants').hidden && doc.querySelector('#computer').hidden,'Returning to Now restores its previous reading position and assistant strip.');
click('#view-picker'); click('[data-view=computer]'); await flush();
check(top === 240,'Returning to Computer restores its own position.');
offline=false; computer.notice=null; computer.sessionState='unlocked'; computer.observedAt=new Date(Date.now()-60000).toISOString(); await poll();
check(!doc.querySelector('#connection').textContent.includes('Live') && doc.querySelector('#computer').textContent.includes('readings paused'),'A responding server with an old snapshot never appears live.');
computer.observedAt=now; computer.batteryPercent=null; computer.cpuPercent=null; await poll();
check(doc.querySelector('#computer').textContent.includes('CPU…') && doc.querySelector('#computer').textContent.includes('Battery…') && !doc.querySelector('#computer').textContent.includes('null%'),'Unreported measurements are unavailable rather than fabricated zeros.');
denied=true; await poll();
check(!w.localStorage.getItem('web-tools-computer-snapshot') && !doc.querySelector('[data-computer-app]'),'An explicit access denial removes the saved Computer observation.');
console.log(`${checks} Computer navigation, privacy, freshness and interaction checks passed.`);
dom.window.close();
