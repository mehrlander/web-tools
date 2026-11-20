import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,now=new Date().toISOString(),at=days=>new Date(Date.now()-days*86400000).toISOString();
const job=(id,provider,state,days=0)=>({id,key:'errand:'+id,kind:'errand',provider,state,title:id,detail:'',location:provider==='Claude'?'Cloud':'Laptop',createdAt:at(days),at:now,claimedAt:state==='claimed'?now:null,url:'https://mehrlander.github.io/web-tools/app/?view=stage&errand='+id});
let snapshot={schemaVersion:1,observedAt:now,syncedAt:now,queueAvailable:true,recordsConnected:true,items:[
  job('gemini-wait','Gemini','queued',1),{...job('claude-first','Claude','queued',3),title:'Inspect public dashboards'},
  {...job('codex-wait','Codex','queued',2),title:'Review budget files'},
  job('codex-claimed','Codex','claimed'),job('gemini-reply','Gemini','reply'),
  job('claude-done','Claude','complete'),{...job('codex-failed','Codex','failed'),detail:'A check failed'},
  {...job('gemini-done','Gemini','complete'),url:'javascript:alert(1)'},
  job('bad/id','Codex','queued'),{...job('other','Grok','queued')}
]};
let offline=false,denied=false,resultCalls=0,checks=0;
let clipboardDenied=false,clipboardDeferred=false,rejectClipboard;
const clipboardAttempts=[],clipboardWrites=[],networkRequests=[];
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{
  clipboardAttempts.push(text);
  if(clipboardDeferred)await new Promise((resolve,reject)=>{rejectClipboard=reject;});
  if(clipboardDenied)throw Error('Clipboard denied');
  clipboardWrites.push(text);
}}});
let report='## Findings\n\n**Useful report**\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))';
w.AbortController=AbortController;w.scrollTo=()=>{};
const timers=new Map();let tid=0;
w.setTimeout=(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;};w.clearTimeout=id=>timers.delete(id);
w.fetch=async (path,options={})=>{
  networkRequests.push({path,method:options.method||'GET'});
  if(offline)throw Error('Offline');
  if(denied)return {ok:false,status:403};
  if(path.startsWith('/api/v1/results/')){resultCalls++;return {ok:true,json:async()=>({reply:report})};}
  assert.equal(path,'/api/v1/errands');
  return {ok:true,status:200,headers:{get:()=>''},json:async()=>structuredClone(snapshot)};
};
w.eval(read('../../lib/kits/claude-mark.js'));w.eval(read('../../lib/kits/assistant-mark.js'));
w.eval(read('../shared/now-shared.js'));w.eval(read('../../node_modules/marked/lib/marked.umd.js'));
w.eval(read('../../node_modules/dompurify/dist/purify.min.js'));w.eval(read('../phone/reading.js'));
w.eval(read('../shared/errands-view.js'));w.eval(read('../../lib/kits/swipe-deck.js'));w.eval(read('../phone/views.js'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const click=selector=>{const node=doc.querySelector(selector);assert.ok(node,selector);node.click();};
const rows=()=>[...doc.querySelectorAll('[data-er-row]')].map(n=>n.dataset.erRow);
const contexts=[],setContext=w.NowViews.setContext;
w.NowViews.setContext=item=>{contexts.push(item);setContext?.(item);};
click('[data-view=errands]');
check(!doc.querySelector('#panel-errands').inert&&doc.querySelector('#panel-now').inert&&doc.querySelector('#view-title').textContent==='Errands','The title dropdown opens a separate focused queue.');
check(JSON.stringify(rows())===JSON.stringify(['claude-first','codex-wait','gemini-wait']),'Waiting work spans all three vendors, oldest first, without invalid IDs or unknown vendors.');
check(doc.querySelectorAll('[data-er-provider]').length===3&&w.NowErrands.state().counts.waiting===3,'Vendor filters expose waiting counts.');
check(clipboardAttempts.length===0,'Loading the queue and its controls never writes to the clipboard.');
click('[data-er-provider=Codex]');check(rows().join()==='codex-wait','A vendor filter focuses its waiting errands.');
click('[data-er-provider=Codex]');check(rows().length===3,'Tapping the selected vendor restores all three.');
click('[data-er-menu=gemini-wait]');
check(!doc.querySelector('.erl-menu [data-er-handoff]'),'Automatically polled Gemini work has no manual-start handoff.');
click('[data-er-menu=codex-wait]');
const beforeCopyReads=networkRequests.length,beforeCopyCalls=clipboardAttempts.length;
click('[data-er-handoff=codex-wait]');
check(clipboardAttempts.length===beforeCopyCalls+1,'A tap writes its ready-made work prompt directly, before any asynchronous read can lose the iPhone gesture.');
await flush();
const codexPrompt=clipboardWrites.at(-1);
check(codexPrompt.includes('codex-wait')&&codexPrompt.includes('Review budget files')&&codexPrompt.includes('Codex')&&codexPrompt.includes('Laptop')
  &&codexPrompt.includes('mehrlander/web-tools-private@background:errands/requests/codex-wait.json')
  &&codexPrompt.includes('codex_errand.py'),
  'The Codex handoff identifies the exact saved errand, its laptop venue and its documented runner.');
check(/(?:re.?read|recheck|check|inspect)/i.test(codexPrompt)&&/claim/i.test(codexPrompt)
  &&/(?:duplicate|already|no longer|still waiting)/i.test(codexPrompt),
  'The handoff requires a current-state check before work and guards against taking an already handled errand.');
check(networkRequests.length===beforeCopyReads,'Copying a handoff uses the observed identity without another request or queue mutation.');
click('[data-er-menu=claude-first]');click('[data-er-handoff=claude-first]');await flush();
const cloudPrompt=clipboardWrites.at(-1);
check(cloudPrompt.includes('Claude')&&cloudPrompt.includes('Cloud')&&cloudPrompt.includes('claude-first')&&cloudPrompt.includes('Inspect public dashboards')
  &&cloudPrompt.includes('mehrlander/web-tools-private@background:errands/requests/claude-first.json')
  &&cloudPrompt.includes('agent_errand.py --agent claude'),
  'The Claude handoff preserves its cloud venue and selects the Claude runner for the exact request.');
const claudeRequest=snapshot.items.find(item=>item.id==='claude-first');
claudeRequest.location='Laptop';await w.NowErrands.refresh();
click('[data-er-menu=claude-first]');click('[data-er-handoff=claude-first]');await flush();
check(clipboardWrites.at(-1).includes('Laptop')&&!clipboardWrites.at(-1).includes('Cloud'),
  'A laptop Claude errand does not receive a cloud-only handoff.');
claudeRequest.location='Cloud';
const codexRequest=snapshot.items.find(item=>item.id==='codex-wait'),originalTitle=codexRequest.title;
codexRequest.title='Review </textarea><img src=x onerror=alert(1)> & <script>bad()</script>';
await w.NowErrands.refresh();clipboardDenied=true;
click('[data-er-menu=codex-wait]');click('[data-er-handoff=codex-wait]');await flush();
const manualPrompt=doc.querySelector('.erl-panel textarea[data-er-prompt]');
check(manualPrompt&&!doc.querySelector('.erl-panel').hidden&&manualPrompt.readOnly
  &&manualPrompt.value===clipboardAttempts.at(-1)&&manualPrompt.value.includes(codexRequest.title),
  'Clipboard denial offers the full same prompt as readonly text for manual copying.');
check(manualPrompt.selectionStart===0&&manualPrompt.selectionEnd===manualPrompt.value.length
  &&!doc.querySelector('.erl-panel img,.erl-panel script'),
  'Manual-copy text is selected in full and hostile-looking titles stay literal text.');
await w.NowErrands.refresh();
check(!doc.querySelector('.erl-panel').hidden&&doc.querySelector('.erl-panel textarea[data-er-prompt]')?.value===manualPrompt.value,
  'An automatic refresh preserves the manual-copy prompt instead of replacing it with request metadata.');
doc.querySelector('.erl-panel').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
clipboardDenied=false;codexRequest.title=originalTitle;await w.NowErrands.refresh();
clipboardDeferred=true;
const pendingCopy=()=>{
  rejectClipboard=null;click('[data-er-menu=codex-wait]');click('[data-er-handoff=codex-wait]');
  assert.equal(typeof rejectClipboard,'function');return rejectClipboard;
};
const rejectAfterLeaving=pendingCopy();click('[data-view=now]');
const outsideRoute=w.location.hash;
rejectAfterLeaving(Error('Permission dismissed later'));await flush();
check(doc.querySelector('.erl-panel').hidden&&doc.querySelector('.erl-menu').hidden
  &&doc.querySelector('#view-title').textContent==='Now'&&w.location.hash===outsideRoute,
  'A delayed clipboard denial after leaving Errands cannot reopen its panel or change navigation.');
click('[data-view=errands]');await flush();
const rejectAfterDismissal=pendingCopy();doc.body.click();
const dismissedRoute=w.location.hash;
rejectAfterDismissal(Error('Permission dismissed later'));await flush();
check(doc.querySelector('.erl-panel').hidden&&doc.querySelector('.erl-menu').hidden
  &&doc.querySelector('#view-title').textContent==='Errands'&&w.location.hash===dismissedRoute,
  'A delayed clipboard denial respects a dismissed menu without resurrecting manual-copy content.');
const rejectAfterAnotherMenu=pendingCopy();click('[data-er-menu=claude-first]');
const otherMenuRoute=w.location.hash;
rejectAfterAnotherMenu(Error('Permission dismissed later'));await flush();
check(doc.querySelector('.erl-panel').hidden&&!doc.querySelector('.erl-menu').hidden
  &&doc.querySelector('.erl-menu [data-er-handoff=claude-first]')
  &&doc.querySelector('[data-er-menu=claude-first]').getAttribute('aria-expanded')==='true'
  &&w.location.hash===otherMenuRoute,
  'A delayed clipboard denial leaves the newly opened errand menu and current navigation intact.');
doc.body.click();
const rejectAfterReopening=pendingCopy();doc.body.click();click('[data-er-menu=codex-wait]');
const reopenedRoute=w.location.hash;
rejectAfterReopening(Error('Permission dismissed later'));await flush();
check(doc.querySelector('.erl-panel').hidden&&!doc.querySelector('.erl-menu').hidden
  &&doc.querySelector('.erl-menu [data-er-handoff=codex-wait]')
  &&doc.querySelector('[data-er-menu=codex-wait]').getAttribute('aria-expanded')==='true'
  &&w.location.hash===reopenedRoute,
  'A late clipboard denial from a dismissed menu cannot replace a newly opened menu for the same errand.');
doc.body.click();clipboardDeferred=false;
for(const change of [{state:'claimed'},{state:'complete'},{provider:'Gemini'}]){
  click('[data-er-tab=waiting]');click('[data-er-menu=codex-wait]');
  const staleButton=doc.querySelector('[data-er-handoff=codex-wait]'),before=clipboardAttempts.length;
  Object.assign(codexRequest,change);await w.NowErrands.refresh();
  (doc.querySelector('[data-er-handoff=codex-wait]')||staleButton).click();await flush();
  check(clipboardAttempts.length===before&&doc.querySelector('.erl-menu').hidden,
    `A menu opened before ${change.state||'a vendor change'} cannot copy a stale work prompt.`);
  codexRequest.state='queued';codexRequest.provider='Codex';await w.NowErrands.refresh();
}
click('[data-er-tab=taken]');click('[data-er-menu=codex-claimed]');
check(!doc.querySelector('.erl-menu [data-er-handoff]'),'Taken-on errands do not offer a second work handoff.');
click('[data-er-pick=codex-claimed]');
check(contexts.at(-1)?.id==='codex-claimed','Opening an errand shares the selected saved item with the active view header.');
check(doc.querySelector('.erl-panel').textContent.includes('continued execution is not confirmed')||doc.querySelector('.erl-panel').textContent.includes('Continued execution is not confirmed'),'A claim does not masquerade as running work.');
check(doc.querySelector('.erl-panel').textContent.includes('Taken on')&&doc.querySelector('.erl-panel').textContent.includes('Laptop'),'Claim time and execution venue are available in detail.');
doc.querySelector('.erl-panel').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(doc.querySelector('.erl-panel').hidden&&doc.activeElement.dataset.erPick==='codex-claimed','Escape closes detail and restores row focus without scrolling.');
check(contexts.at(-1)===null,'Closing an errand detail clears its header context.');
click('[data-er-tab=results]');
check(doc.querySelector('[data-er-provider=Codex] small').textContent==='1'
  && doc.querySelector('[data-er-provider=Codex] small').getAttribute('aria-label')==='1 results',
  'Vendor counts follow the selected queue state instead of reporting waiting counts beside results.');
click('[data-er-menu=claude-done]');
check(!doc.querySelector('.erl-menu [data-er-handoff]'),'Finished errands keep result actions without offering a new work handoff.');
click('[data-er-copy=claude-done]');await flush();
check(clipboardWrites.at(-1)==='claude-done','Existing title copying remains available for results.');
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
// Real worker replies concatenate early progress, structured output and a final outcome.
report='The script was launched.\n\n🟡 **Pending:** Waiting for the script.\n\n```json\n'+JSON.stringify([
  {name:'report.xlsx',bytes:2500000,error:null},{name:'<img src=x onerror=alert(1)>.xlsx',bytes:7500000,error:null}
])+'\n```\n\nBoth files were saved without errors.\n\n⚫ **Done:** Saved both files.';
snapshot.items.push(job('files-result','Gemini','complete'));await w.NowErrands.refresh();
click('[data-er-tab=results]');click('[data-er-pick=files-result]');await flush();
check(doc.querySelector('.erl-data-summary')?.textContent==='2 files 10.0 MB'
  &&doc.querySelectorAll('.erl-data-list li').length===2&&!doc.querySelector('.erl-report pre'),
  'Recognized file JSON becomes a compact file list with a count and total size.');
check(doc.querySelector('.erl-report').firstElementChild.textContent==='Both files were saved without errors.'
  &&!doc.querySelector('.erl-report').textContent.includes('Pending:'),
  'An explicit final outcome leads a settled result instead of a superseded pending update.');
check(!doc.querySelector('.erl-data img')&&doc.querySelector('.erl-data-name').textContent==='report.xlsx'
  &&doc.querySelector('.erl-record').href.includes('files-result'),
  'Filenames remain escaped and the original saved result stays available.');
report='```json\n'+JSON.stringify([{name:'failed.xlsx',bytes:0,error:'Access denied <script>bad()</script>'}])+'\n```';
snapshot.items.push(job('file-error','Codex','failed'));await w.NowErrands.refresh();
click('[data-er-pick=file-error]');await flush();
check(doc.querySelector('.erl-data-summary').textContent.includes('1 with errors')
  &&doc.querySelector('.erl-data-error').textContent.includes('Access denied')&&!doc.querySelector('.erl-data script'),
  'Reported file failures stay visible and their messages cannot become markup.');
report='```json\n'+JSON.stringify([{project:'Project <b>one</b>',tableau:['https://example.test/dashboard','javascript:alert(1)'],links:11,error:null}])+'\n```';
snapshot.items.push(job('project-result','Gemini','complete'));await w.NowErrands.refresh();
click('[data-er-pick=project-result]');await flush();
check(doc.querySelector('.erl-project-list strong').textContent==='Project <b>one</b>'
  &&doc.querySelectorAll('.erl-project-list a').length===1
  &&doc.querySelector('.erl-project-list a').href==='https://example.test/dashboard',
  'Dashboard JSON becomes readable project rows with safe HTTPS destinations only.');
report='```json\n{"unknown":"still data"}\n```\n\n```js\nconst answer = 42;\n```';
snapshot.items.push(job('code-result','Claude','complete'));await w.NowErrands.refresh();
click('[data-er-pick=code-result]');await flush();
check(doc.querySelectorAll('.erl-report pre').length===2
  &&doc.querySelector('.erl-report').textContent.includes('const answer = 42;'),
  'Unrecognized JSON and intentional source code remain normal code blocks.');
report='Cancelled by owner';
snapshot.items.push({...job('cancelled-result','Codex','declined'),url:'https://mehrlander.github.io/web-tools/app/?repo=mehrlander/web-tools-private&ref=background&view=files&file=errands%2Fresults%2Fcancelled-result.json'});
await w.NowErrands.refresh();click('[data-er-pick=cancelled-result]');await flush();
check(doc.querySelector('[data-er-row=cancelled-result] .erl-declined')?.getAttribute('aria-label')==='Declined'
  &&doc.querySelector('.erl-panel .erl-declined')&&!doc.querySelector('.erl-panel .erl-complete,.erl-panel .erl-failed')
  &&doc.querySelector('.erl-report')?.textContent.trim()==='Cancelled by owner',
  'A declined result keeps its neutral status and saved cancellation reason instead of claiming completion or failure.');
click('[data-er-menu=cancelled-result]');
check(doc.querySelector('.erl-menu a')?.textContent.includes('Open result')&&!doc.querySelector('.erl-menu [data-er-handoff]'),
  'Declined errands keep their saved result link and cannot be handed off as waiting work.');
check(w.NowView.sessionActions(snapshot.items.find(item=>item.id==='cancelled-result')).includes('Open result'),
  'Shared errand actions identify a decline as a saved result.');
click('[data-er-pick=cancelled-result]');
const currentView=w.NowViews.current,beforeInactive=contexts.length;
w.NowViews.current=()=> 'now';await w.NowErrands.refresh();w.NowViews.current=currentView;
check(contexts.length===beforeInactive,'An inactive errand refresh cannot replace another panel header context.');
snapshot.items=snapshot.items.filter(item=>item.id!=='cancelled-result');await w.NowErrands.refresh();
check(contexts.at(-1)===null&&doc.querySelector('.erl-panel').hidden,'Removing the selected saved errand clears its detail and header context.');
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
click('[data-view=now]');check(doc.querySelector('#panel-errands').inert&&doc.querySelector('.erl-panel').hidden,'Leaving Errands closes its transient panels.');
check(networkRequests.every(request=>request.method==='GET'),'Queue navigation, handoffs and report reading make no network mutations.');
async function routeFixture(hash){
  const frame=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/'+hash,runScripts:'outside-only',pretendToBeVisual:true});
  const win=frame.window,document=win.document;
  const data={schemaVersion:1,observedAt:now,syncedAt:now,queueAvailable:true,recordsConnected:true,items:[
    job('gemini-wait','Gemini','queued',1),{...job('codex-wait','Codex','queued',2),title:'Budget review'},job('claude-done','Claude','complete'),
    {...job('codex-done','Codex','complete'),title:'Budget result'}]};
  win.scrollTo=()=>{};win.AbortController=AbortController;
  win.fetch=async path=>({ok:true,status:200,headers:{get:()=>''},json:async()=>path.startsWith('/api/v1/results/')?{reply:'Saved result'}:structuredClone(data)});
  for(const path of ['../shared/now-shared.js','../../node_modules/marked/lib/marked.umd.js','../../node_modules/dompurify/dist/purify.min.js','../phone/reading.js','../shared/errands-view.js','../phone/views.js'])win.eval(read(path));
  await flush();
  const press=selector=>{const node=document.querySelector(selector);assert.ok(node,selector);node.click();};
  const search=value=>{const input=document.querySelector('[data-er-search]');input.value=value;input.dispatchEvent(new win.Event('input',{bubbles:true}));};
  const enter=hash=>{win.history.pushState(null,'',hash);win.NowViews.setView('errands',false);};
  const visible=()=>[...document.querySelectorAll('[data-er-row]')].map(node=>node.dataset.erRow);
  return {frame,win,document,press,search,enter,visible};
}
const destination='#view=errands&provider=gemini&tab=waiting';
const cold=await routeFixture(destination);
try{
  check(cold.win.NowViews.current()==='errands'&&cold.win.NowErrands.state().provider==='Gemini'&&cold.win.NowErrands.state().tab==='waiting'
    &&cold.visible().join(',')==='gemini-wait'&&cold.document.querySelector('[data-er-provider=Gemini]').getAttribute('aria-pressed')==='true',
    'A cold notice URL selects Gemini Waiting directly, without a provider-toggle gesture.');
  const length=cold.win.history.length;cold.win.NowViews.setView('errands',false);cold.win.NowErrands.setActive(true);await flush();
  check(cold.win.NowErrands.state().provider==='Gemini'&&cold.visible().join(',')==='gemini-wait'&&cold.win.history.length===length,
    'Repeated qualified entry remains idempotent and creates no extra history steps.');
}finally{await flush();cold.frame.window.close();}

const routed=await routeFixture('#view=now');
try{
  const {win,document,press,search,enter,visible}=routed;
  win.NowViews.scrollTo(133);enter(destination);const entryLength=win.history.length;
  win.history.back();await new Promise(resolve=>setTimeout(resolve,25));
  check(win.NowViews.current()==='now'&&win.location.hash==='#view=now'&&win.NowViews.scrollPosition()===133,
    'A qualified queue link returns to the originating Now panel in one Back step with its scroll retained.');
  win.history.forward();await new Promise(resolve=>setTimeout(resolve,25));
  check(win.NowViews.current()==='errands'&&win.NowErrands.state().provider==='Gemini'&&visible().join(',')==='gemini-wait',
    'Forward reapplies the qualified Gemini Waiting route.');
  press('[data-er-provider=Gemini]');press('[data-er-provider=Claude]');press('[data-er-tab=results]');search('done');
  press('[data-er-pick=claude-done]');await flush();
  check(!document.querySelector('.erl-panel').hidden,'The route regression starts with a real selected result and stale facets.');
  enter(destination);
  check(win.NowErrands.state().provider==='Gemini'&&win.NowErrands.state().tab==='waiting'&&win.NowErrands.state().query===''
    &&visible().join(',')==='gemini-wait'&&document.querySelector('.erl-panel').hidden&&document.querySelector('.erl-menu').hidden,
    'Notice entry clears an old provider, Results tab, search and selected result before showing Gemini Waiting.');
  press('[data-er-menu=gemini-wait]');win.NowErrands.setActive(true);await flush();
  check(document.querySelector('.erl-menu').hidden&&win.NowErrands.state().provider==='Gemini',
    'Reactivating an explicit route clears a stale action menu without toggling its provider off.');
  const beforeControls=win.history.length;press('[data-er-provider=Gemini]');press('[data-er-provider=Codex]');press('[data-er-tab=results]');search('budget');
  let params=new URLSearchParams(win.location.hash.slice(1));
  check(win.history.length===beforeControls&&params.get('provider')==='codex'&&params.get('tab')==='results'&&params.get('q')==='budget'
    &&visible().join(',')==='codex-done',
    'Overview controls replace their route facets without adding Back steps or leaving the banner’s old selection in the URL.');
  win.history.back();await new Promise(resolve=>setTimeout(resolve,25));
  win.history.forward();await new Promise(resolve=>setTimeout(resolve,25));
  check(win.NowErrands.state().provider==='Codex'&&win.NowErrands.state().tab==='results'&&win.NowErrands.state().query==='budget'
    &&visible().join(',')==='codex-done',
    'Forward restores the overview’s edited facets rather than the original banner selection.');
  win.history.replaceState(null,'','#view=errands');win.NowErrands.setActive(true);await flush();
  check(win.NowErrands.state().provider==='Codex'&&win.NowErrands.state().query==='budget',
    'An unqualified Errands route preserves the existing filter state.');
  enter('#view=errands&provider=unknown&tab=bogus&q='+('x'.repeat(201)));
  check(win.NowErrands.state().provider===''&&win.NowErrands.state().tab==='waiting'&&win.NowErrands.state().query===''
    &&visible().length===2,
    'Invalid explicit facets safely fall back to all providers, Waiting and empty search.');
  enter('#view=errands&provider=CODEX&tab=results&q=budget');
  check(win.NowErrands.state().provider==='Codex'&&win.NowErrands.state().query==='budget'&&visible().join(',')==='codex-done',
    'Validated provider values normalize to canonical labels and a bounded query is applied.');
  search('z'.repeat(201));params=new URLSearchParams(win.location.hash.slice(1));
  check(win.NowErrands.state().query.length===200&&params.get('q').length===200,'Search controls keep stamped queries within the same 200-character route bound.');
  win.location.hash=destination;await new Promise(resolve=>setTimeout(resolve,25));
  check(win.NowErrands.state().provider==='Gemini'&&win.NowErrands.state().tab==='waiting'&&win.NowErrands.state().query===''
    &&visible().join(',')==='gemini-wait',
    'A native hash navigation reapplies explicit facets while the Errands view is already selected.');
  check(entryLength===2,'The notice destination uses one route entry from the original Now view.');
}finally{await flush();routed.frame.window.close();}

dom.window.close();console.log(`${checks} focused errand checks passed.`);
