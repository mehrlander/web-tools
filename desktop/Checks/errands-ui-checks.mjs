import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,now=new Date().toISOString(),at=days=>new Date(Date.now()-days*86400000).toISOString();
const job=(id,provider,state,days=0)=>({id,key:'errand:'+id,kind:'errand',provider,state,title:id,detail:'',location:provider==='Claude'?'Cloud':'Laptop',createdAt:at(days),at:now,claimedAt:state==='claimed'?now:null,url:'https://mehrlander.github.io/web-tools/app/?view=stage&errand='+id});
let snapshot={schemaVersion:1,observedAt:now,syncedAt:now,queueAvailable:true,recordsConnected:true,items:[
  job('gemini-wait','Gemini','queued',1),job('claude-first','Claude','queued',3),job('codex-wait','Codex','queued',2),
  job('codex-claimed','Codex','claimed'),job('gemini-reply','Gemini','reply'),
  job('claude-done','Claude','complete'),{...job('codex-failed','Codex','failed'),detail:'A check failed'},
  {...job('gemini-done','Gemini','complete'),url:'javascript:alert(1)'},
  job('bad/id','Codex','queued'),{...job('other','Grok','queued')}
]};
let offline=false,denied=false,resultCalls=0,checks=0;
w.AbortController=AbortController;w.scrollTo=()=>{};
const timers=new Map();let tid=0;
w.setTimeout=(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;};w.clearTimeout=id=>timers.delete(id);
w.fetch=async path=>{
  if(offline)throw Error('Offline');
  if(denied)return {ok:false,status:403};
  if(path.startsWith('/api/v1/results/')){resultCalls++;return {ok:true,json:async()=>({reply:'## Findings\n\n**Useful report**\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))'})};}
  assert.equal(path,'/api/v1/errands');
  return {ok:true,status:200,headers:{get:()=>''},json:async()=>structuredClone(snapshot)};
};
w.eval(read('../../lib/kits/claude-mark.js'));w.eval(read('../../lib/kits/assistant-mark.js'));
w.eval(read('../shared/now-shared.js'));w.eval(read('../../node_modules/marked/lib/marked.umd.js'));
w.eval(read('../../node_modules/dompurify/dist/purify.min.js'));w.eval(read('../phone/reading.js'));
w.eval(read('../shared/errands-view.js'));w.eval(read('../phone/views.js'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const click=selector=>{const node=doc.querySelector(selector);assert.ok(node,selector);node.click();};
const rows=()=>[...doc.querySelectorAll('[data-er-row]')].map(n=>n.dataset.erRow);
click('[data-view=errands]');
check(!doc.querySelector('#errands').hidden&&doc.querySelector('#content').hidden&&doc.querySelector('#view-title').textContent==='Errands','The title dropdown opens a separate focused queue.');
check(JSON.stringify(rows())===JSON.stringify(['claude-first','codex-wait','gemini-wait']),'Waiting work spans all three vendors, oldest first, without invalid IDs or unknown vendors.');
check(doc.querySelectorAll('[data-er-provider]').length===3&&w.NowErrands.state().counts.waiting===3,'Vendor filters expose waiting counts.');
click('[data-er-provider=Codex]');check(rows().join()==='codex-wait','A vendor filter focuses its waiting errands.');
click('[data-er-provider=Codex]');check(rows().length===3,'Tapping the selected vendor restores all three.');
click('[data-er-tab=taken]');click('[data-er-pick=codex-claimed]');
check(doc.querySelector('.erl-panel').textContent.includes('continued execution is not confirmed')||doc.querySelector('.erl-panel').textContent.includes('Continued execution is not confirmed'),'A claim does not masquerade as running work.');
check(doc.querySelector('.erl-panel').textContent.includes('Taken on')&&doc.querySelector('.erl-panel').textContent.includes('Laptop'),'Claim time and execution venue are available in detail.');
doc.querySelector('.erl-panel').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(doc.querySelector('.erl-panel').hidden&&doc.activeElement.dataset.erPick==='codex-claimed','Escape closes detail and restores row focus without scrolling.');
click('[data-er-tab=results]');
check(doc.querySelector('[data-er-provider=Codex] small').textContent==='1'
  && doc.querySelector('[data-er-provider=Codex] small').getAttribute('aria-label')==='1 results',
  'Vendor counts follow the selected queue state instead of reporting waiting counts beside results.');
click('[data-er-pick=claude-done]');await flush();
check(doc.querySelector('.erl-report h2')?.textContent==='Findings'&&doc.querySelector('.erl-report strong')?.textContent==='Useful report','Reports render Markdown instead of raw markup.');
check(!doc.querySelector('.erl-report script,.erl-report a[href^="javascript:"]')&&resultCalls===1,'Result rendering rejects executable markup and unsafe links, with one on-demand read.');
const panel=doc.querySelector('.erl-panel');panel.scrollTop=80;doc.querySelector('#errands').scrollTop=120;
await w.NowErrands.refresh();check(!panel.hidden&&panel.scrollTop===80&&doc.querySelector('#errands').scrollTop===120&&resultCalls===1,'Polling preserves selected report, report scroll and list scroll.');
const realClock=w.Date.now;w.Date.now=()=>realClock()+40000;await w.NowErrands.refresh();
check(doc.querySelector('.erl-notice')?.textContent.includes('Saved queue')&&!panel.hidden&&panel.scrollTop===80&&doc.querySelector('#errands').scrollTop===120,'An unchanged observation becomes visibly saved as its clock ages, preserving the open report and scroll.');
w.Date.now=realClock;await w.NowErrands.refresh();
click('[data-er-menu=codex-failed]');await w.NowErrands.refresh();
check(!doc.querySelector('.erl-menu').hidden&&doc.querySelector('.erl-menu a').textContent.includes('Open result'),'An open three-dot menu survives refresh.');
click('[data-er-menu=gemini-done]');check(!doc.querySelector('.erl-menu a'),'Unsafe saved destinations never become links.');
click('[data-er-tab=results]');const search=doc.querySelector('[data-er-search]');search.focus();search.value='failed';search.dispatchEvent(new w.Event('input',{bubbles:true}));
check(rows().join()==='codex-failed'&&doc.activeElement.hasAttribute('data-er-search'),'Result search retains focus and selection.');
click('[data-er-tab=waiting]');offline=true;await w.NowErrands.refresh();
check(doc.querySelector('.erl-notice').textContent.includes('Saved queue')&&rows().length===3,'A connection failure preserves the saved queue with a visible warning.');
offline=false;snapshot.items=[];await w.NowErrands.refresh();
check(doc.querySelector('.erl-empty').textContent.includes('No errands waiting'),'A connected empty queue is explicitly clear.');
snapshot.notice='2 unreadable activity records <img src=x>';await w.NowErrands.refresh();
check(doc.querySelector('.erl-notice').textContent.includes('unreadable activity records')&&!doc.querySelector('.erl-notice img')&&doc.querySelector('.erl-empty').textContent.includes('available records'),'Unreadable records stay visible without presenting an incomplete queue as clear.');
snapshot.notice=null;snapshot.queueAvailable=false;await w.NowErrands.refresh();
check(doc.querySelector('.erl-notice').textContent==='Queue unavailable'&&!doc.querySelector('.erl-empty').textContent.includes('No errands waiting'),'A missing queue never appears as zero waiting.');
denied=true;await w.NowErrands.refresh();
check(doc.querySelector('.erl-notice').textContent==='Access unavailable'&&!w.NowErrands.state().available,'An owner-access denial clears private observations.');
check(w.NowErrands.summaryHtml().includes('data-open-errands'),'Now has a compact queue entry point.');
click('[data-view=now]');check(doc.querySelector('#errands').hidden&&doc.querySelector('.erl-panel').hidden,'Leaving Errands closes its transient panels.');
dom.window.close();console.log(`${checks} focused errand checks passed.`);
