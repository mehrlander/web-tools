import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const dom = new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,now=new Date().toISOString(),earlier=s=>new Date(Date.now()-s*1000).toISOString();
Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
let copied='',pageTop=0,offline=false,denied=false,replyFetches=0,fetches=0,checks=0,lastHeaders;
let syncPosts=0,syncStatus=202,syncHold=false,syncRelease,lastSyncOptions;
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
Object.defineProperty(w,'scrollY',{configurable:true,get:()=>pageTop});
w.scrollTo=(x,y)=>{pageTop=typeof x==='object'?x.top:y;};
w.AbortController=AbortController;
const timers=new Map();let timerId=0;
w.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;};w.clearTimeout=id=>timers.delete(id);
const item=(key,state,provider='Gemini')=>({key,id:key,kind:'errand',provider,location:'Laptop',title:key,state,detail:'',at:now,createdAt:now,needsAttention:false,isNew:false,url:null});
let snapshot={schemaVersion:1,machineName:'Fixture laptop',observedAt:now,sources:{queueAvailable:true,recordsConnected:true,recordsSyncedAt:now,workerState:'detected',cloudCapturedAt:now,notices:[]},items:[
 {...item('session:Codex:local','working','Codex'),id:'local',kind:'session',title:'Working <img src=x onerror=alert(1)>',detail:'**Checking** the queue',work:{through:now,agents:2,members:['child'],segments:[{id:'one',headline:'Current work',summary:'Reduced spacing and checked navigation.',at:now,generatedAt:now,evidence:['2 file edits']}] }},
 {...item('errand:second','queued'),id:'second',createdAt:earlier(20)}, {...item('errand:first','queued'),id:'first',createdAt:earlier(90)},
 item('accepted','claimed'),{...item('failed','failed'),needsAttention:true},
 {...item('cloud:cloud','idle','Claude'),id:'cloud',kind:'cloud',location:'Cloud',title:'Cloud work',url:'https://mehrlander.github.io/web-tools/app/?view=sessions&session=cloud',sessionUrl:'https://claude.ai/code/session_fixture',turn:{prompt:'Please inspect the queue.',response:'**A fresh reply** <b>untrusted</b>',startedAt:earlier(60),updatedAt:now,lastTool:'Read'},checkpoint:{summary:'An older checkpoint',headline:'Prior work',at:earlier(300),turns:[{turn:1,headline:'Result',summary:'Finished the work',files:2,pushes:1,agents:1}],links:[{label:'home #72',url:'https://github.com/mehrlander/home/pull/72'},{label:'bad',url:'javascript:alert(1)'}]}},
 {...item('result','complete'),title:'A complete result',url:'javascript:alert(1)'}, {...item('quiet','quiet','Codex'),kind:'session'},
 {...item('declined','declined'),title:'An unanswered request'}, {...item('cloud:unknown','unknown','Claude'),kind:'cloud',title:'A recorded session'}
],changes:[{key:'archived',id:'change-one',provider:'Claude',title:'Removed from current feed',state:'working',at:earlier(40),detail:'Historical update',location:'Cloud'},{key:'session:Codex:child',id:'child',provider:'Codex',title:'Delegated child',state:'working',at:now,detail:'Child update',location:'Laptop'}],events:[{id:'event',sessionId:'cloud',provider:'Claude',at:earlier(20),state:'working',detail:'Read the changed files'}],usage:[]};
w.fetch=async(path,options={})=>{fetches++;lastHeaders=options.headers;if(offline)throw Error('Offline');if(denied)return{ok:false,status:403};if(path==='/api/v1/sync/retry'){syncPosts++;lastSyncOptions=options;if(syncHold)await new Promise(resolve=>{syncRelease=resolve;});return{ok:syncStatus===202,status:syncStatus,json:async()=>({accepted:syncStatus===202,retryAfterSeconds:15})};}if(path.startsWith('/api/v1/results/')){replyFetches++;return{ok:true,json:async()=>({reply:'Result <script>alert(1)</script>'})};}return{ok:true,status:200,headers:{get:()=> 'etag'},json:async()=>structuredClone(snapshot)};};
for(const path of ['../../lib/kits/claude-mark.js','../../lib/kits/assistant-mark.js','../../lib/kits/panel-tip.js','../shared/phone-info.js','../shared/now-shared.js','../shared/usage-view.js','../shared/recent-usage.js','../../node_modules/marked/lib/marked.umd.js','../../node_modules/dompurify/dist/purify.min.js','../phone/reading.js','../phone/views.js','../phone/phone.js'])w.eval(read(path));
const css=doc.createElement('style');css.textContent=read('../phone/phone-ui.css');doc.head.append(css);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const check=(value,message)=>{assert.ok(value,message);checks++;};
const click=selector=>{const node=doc.querySelector(selector);assert.ok(node,selector);node.click();};
const refresh=async()=>{await w.NowPhone.refresh();await flush();};
const clearDetail=()=>{w.history.replaceState(null,'','#view=now');w.dispatchEvent(new w.PopStateEvent('popstate'));};
const row=key=>[...doc.querySelectorAll('#content [data-item]')].find(n=>n.dataset.item===key);
const pick=key=>row(key)?.querySelector('[data-pick]');
doc.addEventListener('click',e=>{if(e.target.closest('a[target=_blank]'))e.preventDefault();},true);
await flush();
check(w.NowPhone&&typeof w.NowPhone.refresh==='function'&&typeof w.NowPhone.openSession==='function'&&w.NowPhone.snapshot().items[0].work.segments.length===1,'The public phone API exposes refresh, session navigation, and the original rich snapshot without flattening evidence.');
check(doc.querySelectorAll('#assistants [data-assistant]').length===3&&!doc.querySelector('#assistants [role=progressbar]')&&!doc.querySelector('[data-inspect],[data-inline]'),'Now opens to assistant filters and compact rows, with no quota graphics or inline accordions.');
check(doc.querySelectorAll('#content [data-launch]').length===doc.querySelectorAll('#content [data-item]').length&&doc.querySelectorAll('#assistants [data-provider-menu]').length===3,'Each row and provider has its own conventional options trigger.');
check(!doc.querySelector('#content img')&&row('session:Codex:local').textContent.includes('Reduced spacing and checked navigation.')&&row('session:Codex:local').textContent.includes('2 agents'),'Work summaries and delegated counts stay visible as escaped text.');
check(row('cloud:cloud').querySelector('.phone-meta').classList.contains('text-xs')&&row('cloud:cloud').querySelector('.phone-meta').classList.contains('leading-5')&&row('cloud:cloud').querySelector('[data-location=Cloud]').getAttribute('aria-label')==='Cloud','Metadata retains its 12px utility tier and readable line height, with an accessible cloud location mark.');
check([...doc.querySelectorAll('[aria-label=Waiting] [data-pick]')].map(n=>n.dataset.pick).join(',')==='errand:first,errand:second','The waiting queue keeps its oldest-first request order.');
check(row('failed').querySelector('[data-status]').getAttribute('aria-label')==='Needs review: failed'&&row('accepted').querySelector('[data-status]').getAttribute('aria-label').includes('Accepted')&&row('quiet').querySelector('[data-status]').getAttribute('aria-label')==='No recent update','Failure, acceptance, and quiet states do not become requests for a reply or fabricated running work.');
check(row('session:Codex:local').closest('section').getAttribute('aria-label')==='In progress'
 &&row('accepted').closest('section').getAttribute('aria-label')==='Accepted'
 &&row('quiet').closest('section').getAttribute('aria-label')==='No recent update',
 'Only observed working sessions are grouped as In progress; acceptance and missing updates remain separate observations.');
check(row('cloud:unknown').closest('section').getAttribute('aria-label')==='Other recent'&&row('cloud:unknown').querySelector('[data-status]').getAttribute('aria-label')==='Recorded'
 &&row('declined').querySelector('[data-status]').getAttribute('aria-label')==='Declined'&&!row('declined').closest('[aria-label="Needs you"]'),
 'Unknown session state remains Recorded, and an explicitly declined request is terminal without becoming a failure.');
check(row('quiet').querySelector('time').dataset.titleTip.includes('Observed '),'Relative activity ages retain a touch-reachable exact timestamp.');
const timestampRoute=w.location.hash,timestamp=row('quiet').querySelector('time');timestamp.click();
check(w.location.hash===timestampRoute&&!doc.querySelector('#overview').hidden&&doc.querySelector('#detail').hidden,
 'Tapping an exact-time title-tip keeps the originating list and route available.');
timestamp.innerHTML='<span>Observed time</span>';timestamp.firstElementChild.click();
check(w.location.hash===timestampRoute&&doc.querySelector('#detail').hidden,'A nested target inside a title-tip also stays out of whole-row navigation.');
row('session:Codex:local').querySelector('[data-summary]').click();
check(new URLSearchParams(w.location.hash.slice(1)).get('session')==='session:Codex:local'&&doc.querySelector('#overview').hidden,
 'Tapping ordinary row-body text still opens the focused session reader.');clearDetail();
check(row('archived')&&row('archived').querySelector('[data-status]').getAttribute('aria-label')==='Recorded'&&!row('session:Codex:child'),'Recent history retains journal-only records and removes delegated child duplicates.');
const preservedRow=row('cloud:cloud');await refresh();
check(row('cloud:cloud')===preservedRow,'Unchanged polling preserves existing tappable rows.');
for(const [provider,url] of [['codex','https://chatgpt.com/'],['gemini','https://antigravity.google.com/'],['claude','https://claude.ai/code']]){click(`[data-provider-menu=${provider}]`);const link=doc.querySelector(`#phone-session-menu [data-provider-link=${provider}]`);check(link?.href===url&&link.target==='_blank'&&link.rel.includes('noopener')&&!doc.querySelector('[data-assistant] a'),provider+' options offer a safe provider launch separately from filtering.');}
check(doc.querySelector('#phone-session-menu [data-provider-status]').textContent.includes('Idle')&&doc.querySelector('#phone-session-menu [data-provider-status]').textContent.includes('Recorded'),
 'Provider options expose the words behind compact status counts to touch readers.');
click('[data-provider-menu=claude]');click('[data-assistant=gemini]');
check(!row('cloud:cloud')&&row('accepted')&&doc.querySelector('[data-assistant=gemini]').getAttribute('aria-label').includes('waiting'),'One provider filter scopes queues, attention and recent history while counts retain their state meaning.');
click('[data-assistant=gemini]');
click('[data-launch="cloud:cloud"]');
check(doc.querySelector('#phone-session-menu [data-session-link]')?.href==='https://claude.ai/code/session_fixture'&&doc.querySelector('#phone-session-menu [data-external]')?.href===snapshot.items.find(i=>i.id==='cloud').url,'The options menu preserves exact provider-session and saved Web Tools destinations.');
click('[data-launch="session:Codex:local"]');
check(doc.querySelector('#phone-session-menu [data-session-home]')?.href==='https://chatgpt.com/'&&!doc.querySelector('#phone-session-menu [data-session-link]')&&doc.querySelector('#phone-session-menu').textContent.includes('Direct mobile thread link unavailable'),'Mobile Codex uses an honest searchable fallback rather than a fabricated thread link.');
click('[data-copy-title="session:Codex:local"]');await flush();
check(copied===snapshot.items[0].title&&doc.querySelector('[data-copy-title]').textContent==='Copied','Copy title uses the original searchable session title.');
doc.querySelector('[data-copy-title]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(doc.querySelector('#phone-session-menu').hidden&&doc.activeElement.dataset.launch==='session:Codex:local','Escape closes options and restores its own trigger focus.');
click('[data-launch=result]');check(!doc.querySelector('#phone-session-menu [data-external]'),'An unsafe saved destination is omitted from options.');
click('[data-launch=result]');w.NowViews.scrollTo(260);
pick('cloud:cloud').click();
check(w.location.hash==='#view=now&session=cloud%3Acloud'&&doc.querySelector('#overview').hidden&&!doc.querySelector('#detail').hidden&&pageTop===0&&doc.querySelector('#detail [data-back]').textContent==='← Now','Tapping a row opens its focused detail screen through the same-app session route with an accurate Now return label.');
check(doc.querySelector('#detail [data-facet=reply]').getAttribute('aria-selected')==='true'&&doc.querySelector('#detail [role=tabpanel] strong').textContent==='A fresh reply'&&!doc.querySelector('#detail [role=tabpanel] b'),'The focused reader defaults to the formatted latest reply and keeps raw HTML escaped.');
check(doc.querySelector('#detail [role=tabpanel]').classList.contains('text-[17px]')&&row('cloud:cloud').querySelector('.phone-row-title').classList.contains('text-sm'),
 'Focused reading uses a comfortable content tier while the scanning list retains its compact title tier.');
const readingSample=doc.createElement('div');readingSample.innerHTML=w.NowReading.markdown('# A heading\n\nInline `code`.\n\n```js\nconst value = 1;\n```');
check(readingSample.querySelector('h1').classList.contains('text-xl')&&readingSample.querySelector('pre').classList.contains('text-[13px]')&&readingSample.querySelector('p code').classList.contains('text-[13px]'),
 'Rendered Markdown preserves a heading hierarchy and a readable code tier in focused details.');
check([...doc.querySelectorAll('#detail [data-facet]')].map(n=>n.dataset.facet).join(',')==='reply,summary,prompt,activity'&&!doc.querySelector('#detail [role=tabpanel]').textContent.includes('Please inspect'),'The reader retains Reply, Summary, Prompt and Activity while showing one focused section.');
click('#detail [data-facet=prompt]');
check(doc.querySelector('#detail [role=tabpanel]').textContent.includes('Please inspect')&&!doc.querySelector('#detail [role=tabpanel]').textContent.includes('A fresh reply'),'Selecting Prompt does not stack another section underneath.');
click('#detail [data-facet=summary]');
check([...doc.querySelectorAll('#detail a')].some(a=>a.href==='https://github.com/mehrlander/home/pull/72')&&![...doc.querySelectorAll('#detail a')].some(a=>a.textContent==='bad'),'Published checkpoint evidence retains validated pull-request links only.');
click('#detail [data-facet=activity]');
check(doc.querySelector('#detail [role=tabpanel]').textContent.includes('Read the changed files')&&doc.querySelector('#detail [role=tabpanel]').textContent.includes('Read'),'Activity retains observed events and the last tool rather than only a flattened summary.');
pageTop=340;doc.querySelector('#detail [data-facet=activity]').focus();snapshot.items.find(i=>i.id==='cloud').turn.lastTool='Write';await refresh();
check(pageTop===340&&doc.activeElement.dataset.facet==='activity'&&doc.querySelector('#detail [role=tabpanel]').textContent.includes('Write'),'Live updates preserve the selected detail section, tab focus, and global reading position.');
clearDetail();
check(!doc.querySelector('#overview').hidden&&w.NowViews.scrollPosition()===260&&doc.activeElement.dataset.pick==='cloud:cloud','Returning from details restores the Now panel position and originating row focus.');
click('[data-assistant=codex]');w.NowViews.scrollTo(190);pick('session:Codex:local').click();
const sessionHistory=w.history.length;
check(doc.querySelector('#detail [data-session-step="-1"]').disabled&&!doc.querySelector('#detail [data-session-step="1"]').disabled
 &&w.history.state.nowSessionTrail.filter==='codex'&&w.history.state.nowSessionTrail.keys.join(',')==='session:Codex:local,quiet',
 'Neighboring sessions follow the originating filtered list and mark its boundaries.');
click('#detail [data-session-step="1"]');
check(new URLSearchParams(w.location.hash.slice(1)).get('session')==='quiet'&&w.history.length===sessionHistory&&doc.querySelector('#detail').textContent.includes('No recent update'),
 'Next replaces the focused session without adding Back steps or calling a quiet session working.');
snapshot.items.push({...item('new-neighbor','working','Codex'),kind:'session'});snapshot.items.find(i=>i.key==='quiet').detail='A saved observation, with no new update.';
doc.querySelector('#detail [data-session-step="-1"]').focus();await refresh();
check(w.history.state.nowSessionTrail.keys.length===2&&doc.activeElement.dataset.sessionStep==='-1'&&doc.querySelector('#detail [aria-label="Neighboring sessions"]').textContent.includes('2/2'),
 'Polling preserves the frozen neighbor order and focused navigation control while the live list changes.');
click('#detail [data-session-step="-1"]');clearDetail();
check(doc.querySelector('[data-assistant=codex]').getAttribute('aria-pressed')==='true'&&!row('cloud:cloud')&&w.NowViews.scrollPosition()===190&&doc.activeElement.dataset.pick==='session:Codex:local',
 'Leaving neighboring-session reading restores the original filter, panel scroll and entry-row focus.');
snapshot.items=snapshot.items.filter(i=>i.key!=='new-neighbor');click('[data-assistant=codex]');
click('[data-status="session:Codex:local"]');
check(doc.querySelector('#detail [data-facet=activity]').getAttribute('aria-selected')==='true'&&doc.querySelector('#detail [role=tabpanel]').textContent.includes('2 delegated agents'),'The compact status control opens the existing Activity evidence, including delegated work.');
clearDetail();w.NowPhone.openSession('result');await flush();
check(doc.querySelector('#detail [data-reply]').textContent.includes('<script>')&&!doc.querySelector('#detail [data-reply] script')&&replyFetches===1,'Errand results load safely inside the same focused reader.');
const replyNode=doc.querySelector('#detail [data-reply]');await refresh();
check(replyFetches===1&&doc.querySelector('#detail [data-reply]')===replyNode,'Unchanged selected results do not refetch or flash loading content.');
clearDetail();w.NowPhone.openSession('declined');await flush();
check(doc.querySelector('#detail [data-reply]')&&doc.querySelector('#detail').textContent.includes('Declined')&&replyFetches===2,
 'Declined requests retain their recorded result in the focused reader without implying completion or failure.');
offline=true;await refresh();
check(doc.querySelector('#detail-connection').textContent.includes('Laptop unreachable')&&doc.querySelector('#detail [data-reply]'),'Offline detail reading retains the result with an explicit unreachable state.');
offline=false;snapshot.observedAt=earlier(60);await refresh();
check(doc.querySelector('#connection').textContent.includes('Activity paused'),'A responding server with old observations is not labeled live.');
snapshot.observedAt=new Date().toISOString();await refresh();check(doc.querySelector('#connection').textContent.includes('Laptop live'),'Fresh observations recover automatically.');
clearDetail();denied=true;await refresh();check(doc.querySelector('#connection').textContent.includes('Access unavailable'),'Access denial remains distinct from an ordinary unreachable laptop.');denied=false;await refresh();
check(w.localStorage.getItem('web-tools-now-snapshot')?.includes('Please inspect'),'The complete observation snapshot is retained for offline use.');
let archive={available:true,observedAt:now,sessions:[{id:'cloud',provider:'claude',agentSessionId:'session_fixture',title:'Cloud work',sessionUrl:'https://claude.ai/code/session_fixture',usageAt:now,contextTokens:500000,inputTokens:10,outputTokens:3000,cacheReadTokens:20,cacheWriteTokens:30,measuredSteps:1,reloads:0},{id:'missing',provider:'claude',title:'Only in usage metadata',usageAt:now,contextTokens:800000,inputTokens:1,outputTokens:0,cacheReadTokens:2,cacheWriteTokens:3}]};
let forwarded,usageRefreshes=0;
w.NowPhoneUsage={sessionUsage:()=>archive,recentRows:()=>[{identity:'cloud:missing'},{identity:'cloud:cloud'}],update:value=>{forwarded=value;},refresh:()=>{usageRefreshes++;}};
w.dispatchEvent(new w.Event('nowusagearchivechange'));
check(forwarded===w.NowPhone.snapshot()&&row('cloud:cloud').querySelector('[data-session-tokens]')?.textContent.includes('3k')&&!row('session:Codex:local').querySelector('[data-session-tokens]'),'The archive bridge receives the rich snapshot and adds output badges only where recorded usage is known.');
doc.querySelector('[data-session-tokens="cloud:cloud"]').focus();archive.sessions[0].outputTokens=4000;w.dispatchEvent(new w.Event('nowusagearchivechange'));
check(doc.activeElement.dataset.sessionTokens==='cloud:cloud'&&doc.activeElement.textContent.includes('4k'),'Archive-only updates refresh token counts while preserving badge focus.');
click('[data-session-tokens="cloud:cloud"]');
check(doc.querySelector('#phone-info-card[aria-modal="false"]').textContent.includes('4,000')&&doc.querySelector('#phone-info-card').textContent.includes('500,000')&&doc.querySelector('#phone-info-card').textContent.includes('Subagent calls are excluded')&&!doc.querySelector('dialog'),
 'An anchored nonmodal token card separates output, input/cache counts and last input context while leaving the list available.');
click('#phone-info-card [data-wt-panel-tip-close]');
check(!doc.querySelector('#phone-info-card')&&doc.activeElement.dataset.sessionTokens==='cloud:cloud','Closing token details returns focus to the exact metric without changing the session route.');
w.NowViews.setView('usage');w.NowPhone.openSession('cloud:missing');
check(w.NowViews.current()==='now'&&doc.querySelector('#detail h2').textContent==='Only in usage metadata'&&doc.querySelector('#detail').textContent.includes('Recorded')&&!doc.querySelector('#detail').textContent.includes('Working'),'A cache-list link opens a metadata-only session as recorded within the same app.');
check(w.history.state.originView==='usage'&&doc.querySelector('#detail [data-back]').textContent==='← Usage','Opening from the Usage cache list records its origin and labels the existing history Back action accordingly.');
const usageSessionHistory=w.history.length;click('#detail [data-session-step="1"]');
check(new URLSearchParams(w.location.hash.slice(1)).get('session')==='cloud:cloud'&&w.history.length===usageSessionHistory
 &&w.history.state.originView==='usage'&&doc.querySelector('#detail [data-back]').textContent==='← Usage'
 &&w.history.state.nowSessionTrail.keys.join(',')==='cloud:missing,cloud:cloud',
 'Usage-origin neighbors follow the cache list order and keep a direct Back path to Usage.');
w.history.replaceState(null,'','#view=now&session=cloud%3Amissing');w.dispatchEvent(new w.PopStateEvent('popstate'));
check(doc.querySelector('#detail [data-back]').textContent==='← Now','A direct session route without an originating history entry keeps Now as the safe return destination.');
clearDetail();snapshot.observedAt=new Date().toISOString();snapshot.sources.workerState='absent';snapshot.sources.notices=['A source is stale.'];await refresh();
check(doc.querySelector('#notice [data-queue-notice]').textContent.includes('2 Gemini errands waiting')&&doc.querySelector('#notice [data-worker-status]').textContent.includes('Daemon not detected')&&doc.querySelector('#notice').textContent.includes('A source is stale.'),'Missing-worker notices expose the real Gemini queue count and worker action while retaining other source notices.');
snapshot.sources.recordsConnected=false;await refresh();check(doc.querySelector('#content').textContent.includes('Waiting · Saved queue'),'A saved errand queue remains explicitly labeled.');
snapshot.sources.queueAvailable=false;snapshot.items=snapshot.items.filter(i=>!['queued','claimed'].includes(i.state));await refresh();click('[data-assistant=gemini]');
check(doc.querySelector('#content').textContent.includes('Queue unavailable')&&!doc.querySelector('#content').textContent.includes('Queue clear'),'An unavailable queue is never presented as empty.');click('[data-assistant=gemini]');
snapshot.sources.workerState='detected';snapshot.sources.workerActivity={kind:'topics',headline:'Summarising two sessions',at:earlier(30)};await refresh();click('[data-pick="worker:gemini"]');
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Detected')&&doc.querySelector('#detail').textContent.includes('does not confirm a running task'),'Daemon detail keeps process evidence separate from execution state.');
clearDetail();const before=fetches;await w.NowPhone.refresh();await flush();
check(fetches>before&&!lastHeaders?.['If-None-Match'],'The public refresh API forces a fresh activity snapshot without a conditional response.');
Object.defineProperty(doc,'hidden',{value:true,configurable:true});doc.dispatchEvent(new w.Event('visibilitychange'));
check(![...timers.values()].some(t=>t.delay===2000),'Polling pauses when the app is hidden.');
Object.defineProperty(doc,'hidden',{value:false,configurable:true});const resumed=fetches;doc.dispatchEvent(new w.Event('visibilitychange'));await flush();check(fetches>resumed,'Returning to the app immediately refreshes observations.');
check(!doc.querySelector('[data-review]')&&!/Since you last looked|Mark shown seen/.test(doc.querySelector('#content').textContent),'Modern rows preserve recent history without acknowledgement controls.');

const signal=(key,title,prompt,response)=>({...item(key,'working','Claude'),id:key,kind:'cloud',location:'Cloud',title,detail:'Using Bash',turn:{prompt,response,startedAt:earlier(30),updatedAt:earlier(10),lastTool:'Bash'}});
const firstSignal=signal('cloud:signal-one','First related observation','First member prompt','First member reply');
const secondSignal=signal('cloud:signal-two','Second related observation','Second member prompt','Second member reply');
const topicGroup={...signal('cloud:group','Original canonical title','Canonical prompt','Canonical answer'),activityKey:firstSignal.key,members:[firstSignal,secondSignal],memberCount:31,
 checkpoint:{headline:'Earlier title',summary:'An earlier conversation summary',at:earlier(300),analyzedAt:now,topicsPartial:true,topics:[
  {topic:'First open topic',status:'open',waitsOn:'owner',waiting:'Choose the branch',basis:'record',evidence:'The reply asks for a choice',first:0,last:0,spans:[{start:1,end:1}]},
  {topic:'Latest completed topic',status:'done',first:1,last:3,spans:[{start:2,end:4}]},
  {topic:'Unclassified topic',status:null,first:2,last:2,spans:[{start:3,end:3}]},
  {topic:'Dropped aside',status:'dropped',minor:true,first:4,last:4}]},
 work:{through:earlier(600),segments:[{headline:'Retrospective work',summary:'An old work summary generated today',generatedAt:now}]}};
const actionOnly={...item('cloud:action-only','quiet','Claude'),kind:'cloud',title:'Action only',detail:'Turn has no recent activity report',turn:{lastTool:'Read'}};
snapshot.items=[topicGroup,actionOnly];snapshot.changes=[{...firstSignal}];snapshot.events=[{id:'member-event',sessionId:firstSignal.id,provider:'Claude',at:now,state:'working',detail:'Member-specific observed activity'}];
await refresh();
check(row(topicGroup.key).querySelector('.phone-row-title').textContent==='Latest completed topic'
 &&!row(topicGroup.key).querySelector('.phone-row-title').textContent.includes('First open'),
 'The latest recorded non-aside agenda stretch leads instead of an arbitrary unfinished topic.');
const recordedTopics=topicGroup.checkpoint.topics;topicGroup.checkpoint.topics=recordedTopics.map(topic=>({...topic,spans:[]}));await refresh();
check(row(topicGroup.key).querySelector('.phone-row-title').textContent==='Earlier title',
 'A fallback topic list without agenda spans cannot manufacture a latest topic from its ordinal order.');
topicGroup.checkpoint.topics=recordedTopics;await refresh();
check(row(topicGroup.key).querySelector('[data-summary]').textContent.includes('Canonical answer')
 &&!row(topicGroup.key).querySelector('[data-summary]').textContent.includes('old work summary')
 &&(row(topicGroup.key).querySelector('[data-summary]').compareDocumentPosition(row(topicGroup.key).querySelector('.phone-meta'))&w.Node.DOCUMENT_POSITION_FOLLOWING),
 'Conversation source times outrank retrospective analysis times, and useful preview text precedes secondary activity metadata.');
const stablePreview=row(topicGroup.key).querySelector('[data-summary]').textContent;
topicGroup.state='quiet';topicGroup.detail='Turn has no recent activity report';await refresh();
check(row(topicGroup.key).querySelector('[data-summary]').textContent===stablePreview
 &&row(topicGroup.key).closest('section').getAttribute('aria-label')==='No recent update',
 'A quiet heartbeat retains the substantive reply and does not turn a recorded owner-wait topic into runtime attention.');
topicGroup.state='working';topicGroup.detail='Prompt received';await refresh();
check(row(topicGroup.key).querySelector('[data-summary]').textContent===stablePreview
 &&row(topicGroup.key).closest('section').getAttribute('aria-label')==='In progress',
 'A new working signal cannot replace useful context with Prompt received or hide active work behind an old topic wait.');
check(row(actionOnly.key).querySelector('[data-summary]').textContent==='Last activity: Used Read',
 'With no substantive summary or reply, the last known tool is explicitly qualified as last activity.');
check(!row(firstSignal.key)&&!row(secondSignal.key)&&doc.querySelectorAll('#content [data-item]').length===2,
 'Related signals remain one visible group even when a member also appears in the journal.');
const topicRoute=w.location.hash;click('[data-topic-context="cloud:group"]');
check(w.location.hash===topicRoute&&doc.querySelector('#phone-info-card').textContent.includes('Waits on you')
 &&doc.querySelector('#phone-info-card').textContent.includes('Choose the branch')&&doc.querySelector('#phone-info-card').textContent.includes('The reply asks for a choice')
 &&doc.querySelector('#phone-info-card [data-topic-status=dropped] strong').classList.contains('line-through')
 &&!doc.querySelector('#phone-info-card [data-topic-name="Unclassified topic"]').querySelector('span'),
 'The anchored topic card gives waiting reasons and evidence, distinguishes dropped work, and leaves unknown disposition blank.');
check(doc.querySelector('#phone-info-card').textContent.includes('Showing 3 of 31')&&doc.querySelector('#phone-info-card').textContent.includes('Some topic details omitted.')
 &&!doc.querySelector('#content').textContent.includes('Some topic details omitted.'),
 'Bounded observations and partial topic details are disclosed inside the topic panel, without adding prose to the scanning list.');
click('[data-related-session="cloud:signal-one"]');
check(new URLSearchParams(w.location.hash.slice(1)).get('session')===firstSignal.key
 &&doc.querySelector('#detail [role=tabpanel]').textContent.includes('First member reply')
 &&w.history.state.nowSessionTrail.keys.join(',')==='cloud:group,cloud:action-only',
 'Opening a member from the list preserves its own reply, old key and the originating group neighbor order.');
clearDetail();pick(topicGroup.key).click();
check(doc.querySelector('#detail h2').textContent==='Latest completed topic'&&doc.querySelector('#detail').textContent.includes('Original canonical title')
 &&doc.querySelector('#detail [role=tabpanel]').textContent.includes('Canonical answer'),
 'Grouped detail leads with topic context while keeping the original session title and canonical reply.');
click('#detail [data-facet=prompt]');check(doc.querySelector('#detail [role=tabpanel]').textContent.trim()==='Canonical prompt','The canonical bookmark retains its own prompt.');
click('#detail [data-facet=activity]');
check(doc.querySelector('#detail [role=tabpanel]').textContent.includes('Activity from First related observation')
 &&doc.querySelector('#detail [role=tabpanel]').textContent.includes('Member-specific observed activity')
 &&doc.querySelector('#detail [role=tabpanel]').textContent.includes('Bash'),
 'Fresh grouped activity names its actual member and uses that member’s turn and event evidence.');
const relatedHistory=w.history.length;click('#detail [data-related-session="cloud:signal-one"]');
check(w.history.length===relatedHistory&&doc.querySelector('#detail [data-back]').textContent==='← Now',
 'Selecting a member inside grouped detail adds no intermediate Back step.');
clearDetail();w.history.replaceState(null,'','#view=now&session='+encodeURIComponent(secondSignal.key));w.dispatchEvent(new w.PopStateEvent('popstate'));
check(doc.querySelector('#detail [role=tabpanel]').textContent.includes('Second member reply'),'An existing member bookmark resolves the original member reply.');
click('#detail [data-facet=prompt]');check(doc.querySelector('#detail [role=tabpanel]').textContent.trim()==='Second member prompt','An existing member bookmark resolves the original member prompt.');clearDetail();
snapshot.items=[firstSignal,secondSignal,actionOnly];snapshot.changes=[];await refresh();click('[data-assistant=claude]');w.NowViews.scrollTo(277);
w.NowPhoneUsage.recentRows=()=>[{identity:firstSignal.key},{identity:secondSignal.key}];w.NowViews.setView('usage');w.NowPhone.openSession(firstSignal.key);
const warmHistory=w.history.length;snapshot.items=[topicGroup,actionOnly];await refresh();
check(w.history.length===warmHistory&&w.history.state.originView==='usage'&&doc.querySelector('#detail [data-back]').textContent==='← Usage'
 &&doc.querySelector('#detail [role=tabpanel]').textContent.includes('First member reply'),
 'Warm regrouping preserves an already-open member’s Usage origin and original reply.');
clearDetail();
check(w.NowViews.scrollPosition()===277&&doc.querySelector('[data-assistant=claude]').getAttribute('aria-pressed')==='true'&&doc.activeElement.dataset.pick===topicGroup.key,
 'Regrouping normalizes old trail and return keys while preserving the originating filter and scroll.');
const omitted={key:'cloud:omitted',id:'omitted',provider:'Claude',location:'Cloud',title:'Original omitted observation',detail:'Original lightweight activity evidence',at:earlier(50)};
topicGroup.relatedKeys=[omitted.key];topicGroup.sessionUrl='https://claude.ai/code/session_shared';snapshot.changes=[omitted];await refresh();
check(!row(omitted.key)&&row(topicGroup.key),'A grouped omitted-body journal key is hidden under its canonical row instead of returning as a duplicate.');
w.NowPhone.openSession(omitted.key);
check(doc.querySelector('#detail h2').textContent===omitted.title&&doc.querySelector('#detail [role=tabpanel]').textContent.includes(omitted.detail)
 &&!doc.querySelector('#detail [data-facet=prompt]')&&!doc.querySelector('#detail [data-facet=reply]'),
 'A capped member bookmark opens its own lightweight journal Activity without borrowing canonical Prompt or Reply.');
clearDetail();archive.sessions.push({id:'metadata-record',provider:'claude',title:'Metadata own identity',sessionUrl:topicGroup.sessionUrl,usageAt:now,contextTokens:100,outputTokens:1});
w.NowPhone.openSession('cloud:metadata-record');
check(doc.querySelector('#detail h2').textContent==='Metadata own identity'&&!doc.querySelector('#detail [data-facet=prompt]')&&!doc.querySelector('#detail [data-facet=reply]'),
 'A different metadata record sharing a provider URL cannot inherit the canonical conversation body.');clearDetail();
clearDetail();snapshot.observedAt=new Date().toISOString();snapshot.items=[item('errand:gemini-one','queued'),item('errand:codex-one','queued','Codex'),{...item('manual','queued'),kind:'session'},item('gemini-accepted','claimed')];snapshot.changes=[];
snapshot.sources={...snapshot.sources,workerState:'absent',queueAvailable:true,recordsConnected:true,notices:['Saved <a data-evil="yes" href="https://evil.example/">notice</a>'],workerReports:[{kind:'error',headline:'Session cache could not be published',at:earlier(3600)}]};await refresh();
let queueLink=doc.querySelector('#notice [data-queue-notice]');
check(queueLink.textContent.includes('1 Gemini errand waiting')&&queueLink.getAttribute('href')==='#view=errands&provider=gemini&tab=waiting'
 &&doc.querySelector('#notice [data-worker-status]').getAttribute('href')==='#view=now&session=worker%3Agemini'
 &&!doc.querySelector('#notice [data-evil]')&&doc.querySelector('#notice').textContent.includes('<a data-evil'),
 'The warning counts only queued Gemini errands, exposes shareable queue/status routes, and never converts server notices into links.');
queueLink.focus();snapshot.items.push(item('errand:gemini-two','queued'));await refresh();
check(doc.activeElement.dataset.queueNotice==='gemini'&&doc.activeElement.textContent.includes('2 Gemini errands waiting'),'A queue-count refresh retains keyboard focus on the notice action.');
snapshot.sources.workerState='detected';await refresh();
check(!doc.querySelector('#notice [data-queue-notice]')&&doc.activeElement.id==='view-picker','A detected worker clears the warning and safely returns focus from a removed action.');
snapshot.sources.workerState='unknown';await refresh();check(!doc.querySelector('#notice [data-queue-notice]'),'Unknown worker presence does not become a false offline warning.');
snapshot.sources.workerState='absent';snapshot.sources.recordsConnected=false;await refresh();
check(doc.querySelector('#notice').textContent.includes('Saved queue'),'A cached waiting count retains its saved-queue qualification.');
snapshot.sources.recordsConnected=true;offline=true;await refresh();
check(doc.querySelector('#notice').textContent.includes('Saved queue and daemon status')&&!doc.querySelector('#notice [data-worker-status]').textContent.includes('Daemon not detected'),'A failed transport qualifies cached worker and queue observations even when the saved GitHub status was connected.');
offline=false;snapshot.observedAt=earlier(30);await refresh();
check(doc.querySelector('#notice').textContent.includes('Saved queue and daemon status'),'A stale snapshot is qualified independently of successful transport and recorded GitHub connectivity.');
snapshot.observedAt=new Date().toISOString();
snapshot.sources.recordsConnected=true;await refresh();click('[data-assistant=codex]');w.NowViews.scrollTo(222);
const queueHistory=w.history.length;click('#notice [data-queue-notice]');await flush();
check(w.NowViews.current()==='errands'&&w.location.hash==='#view=errands&provider=gemini&tab=waiting'&&w.history.length===queueHistory+1&&doc.activeElement.id==='view-picker','The notice opens one history entry for Gemini Waiting and moves focus to visible navigation when the queue controller is absent.');
const queueBack=new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));w.history.back();
for(let pass=0;pass<5;pass++){for(const[id,task]of [...timers])if(!task.delay){timers.delete(id);task.fn();}await flush();}
await queueBack;await flush();
check(w.NowViews.current()==='now'&&doc.querySelector('[data-assistant=codex]').getAttribute('aria-pressed')==='true'&&w.NowViews.scrollPosition()===222,'Back from the queue retains the original Now provider filter and scroll.');
click('#notice [data-worker-status]');
check(doc.querySelector('#detail h2').textContent==='Gemini errand daemon'&&doc.activeElement===doc.querySelector('#detail h2')&&doc.querySelector('#detail').textContent.includes('Gemini connection')
 &&doc.querySelector('#detail').textContent.includes('Last report')&&doc.querySelector('#detail').textContent.includes('Session cache could not be published')
 &&doc.querySelector('#detail').textContent.indexOf('Waiting')<doc.querySelector('#detail').textContent.indexOf('Recent reports'),
 'Daemon status identifies the errand process, shows its dated safe report, and places waiting work before report history.');
snapshot.observedAt=new Date(Date.now()+1).toISOString();await refresh();
check(doc.activeElement===doc.querySelector('#detail h2'),'Refreshing the daemon observation retains the opened heading focus.');
doc.querySelector('#detail [data-back]').focus();snapshot.observedAt=new Date().toISOString();await refresh();
check(doc.activeElement===doc.querySelector('#detail [data-back]'),'Refreshing daemon detail also retains Back-button focus.');
doc.querySelector('#detail [data-status]').focus();snapshot.observedAt=new Date(Date.now()+1).toISOString();await refresh();
check(doc.activeElement===doc.querySelector('#detail [data-status]'),'Refreshing daemon detail retains queue-row status-button focus.');
doc.querySelector('#detail [data-launch]').focus();snapshot.observedAt=new Date().toISOString();await refresh();
check(doc.activeElement===doc.querySelector('#detail [data-launch]'),'Refreshing daemon detail retains queue-row options focus.');
snapshot.items=snapshot.items.filter(value=>!['session','cloud'].includes(value.kind));
const geminiUpdate=earlier(60);
snapshot.items.push({...item('gemini-session','idle'),kind:'session',at:geminiUpdate},
 {...item('future-session','working'),kind:'session',at:new Date(Date.now()+3600000).toISOString()},
 {...item('invalid-session','working'),kind:'session',at:'invalid'},
 {...item('old-session','working'),kind:'session',at:earlier(90000)},
 {...item('claude-session','working','Claude'),kind:'cloud'});
snapshot.observedAt=new Date().toISOString();await refresh();
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Not detected')
 &&doc.querySelector('[data-gemini-observation] time').dataset.at===geminiUpdate
 &&doc.querySelector('#detail').textContent.includes('Not checked'),
 'A missing daemon and a real recent Gemini session update remain separate observations without claiming connection health.');
check(doc.querySelector('[data-daemon-observation] time').dataset.at===snapshot.observedAt,
 'The daemon observation carries the snapshot time independently of the older report time.');
snapshot.sources.workerState='detected';await refresh();
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Detected')&&doc.querySelector('#detail').textContent.includes('Not checked'),
 'Daemon detection does not imply a working Gemini connection.');
offline=true;await refresh();
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Saved observation')&&doc.querySelector('[data-gemini-observation]').textContent.includes('Saved observation'),
 'Offline daemon and Gemini observations are both explicitly saved.');
offline=false;snapshot.observedAt=earlier(30);await refresh();
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Saved observation'),
 'Successful transport does not make a stale daemon snapshot current.');
snapshot.sources.workerState='unknown';snapshot.observedAt=new Date().toISOString();snapshot.items=snapshot.items.filter(value=>value.key!=='gemini-session');await refresh();
check(doc.querySelector('[data-daemon-observation]').textContent.includes('Status unavailable')
 &&!doc.querySelector('[data-gemini-observation] time')&&doc.querySelector('[data-gemini-observation]').textContent.includes('No session update')
 &&doc.querySelector('#detail').textContent.includes('Not checked'),
 'An unknown process and no valid recent Gemini session do not become a provider outage; errand, other-provider, future, invalid and old dates are excluded.');
snapshot.sources.workerState='absent';
clearDetail();snapshot.items=snapshot.items.filter(value=>value.kind!=='errand'||value.provider!=='Gemini'||value.state!=='queued');await refresh();
check(!doc.querySelector('#notice [data-queue-notice]'),'Manual Gemini sessions and other vendors’ queued errands do not create a Gemini worker warning.');
snapshot.observedAt=new Date().toISOString();snapshot.sources.recordsConnected=false;snapshot.sources.workerState='absent';snapshot.items.push(item('fresh-daemon-saved-queue','queued'));await refresh();
check(doc.querySelector('[data-worker-status]').textContent.includes('Daemon not detected')&&doc.querySelector('#notice').textContent.includes('Saved queue')
 &&!doc.querySelector('#notice').textContent.includes('Saved queue and daemon status'),
 'Failed GitHub sync qualifies the queue without mislabeling a fresh independent daemon observation as saved.');
click('#notice [data-worker-status]');
check(doc.querySelector('#detail').textContent.includes('Saved queue')&&!doc.querySelector('[data-daemon-observation]').textContent.includes('Saved observation'),
 'Daemon detail separately labels cached queue counts without weakening the fresh local process observation.');clearDetail();
snapshot.sources.workerState='detected';snapshot.sources.recordsConnected=true;
const historySuccess=earlier(1200),historyAttempt=earlier(60),historyCapture=earlier(7200);
const legacySync='Cloud sync unavailable; showing saved session records.';
snapshot.sources.cloudCapturedAt=historyCapture;snapshot.sources.notices=[legacySync,'1 unreadable activity record was omitted.'];snapshot.sources.syncNotices=[legacySync];
snapshot.sources.sync={errands:{state:'ok',attemptedAt:earlier(5),succeededAt:earlier(4),errorCode:null},sessions:{state:'error',attemptedAt:historyAttempt,succeededAt:historySuccess,errorCode:'timeout'},summaries:{state:'ok',attemptedAt:earlier(10),succeededAt:earlier(9),errorCode:null}};
await refresh();
check(!doc.querySelector('[data-queue-notice]')&&doc.querySelector('[data-sync-status=sessions]').textContent.includes('Session history timed out')
 &&!doc.querySelector('#notice').textContent.includes(legacySync)&&doc.querySelector('#notice').textContent.includes('1 unreadable activity record'),
 'A detected daemon clears the false alarm while structured history failure replaces only its duplicate legacy notice.');
click('#notice [data-sync-status=sessions]');
check(w.location.hash==='#view=now&session=status%3Async'&&doc.querySelector('#detail h2').textContent==='Connection status'
 &&doc.querySelector('[data-sync-feed=errands]').textContent.includes('Up to date')&&doc.querySelector('[data-sync-feed=sessions]').textContent.includes('Delayed'),
 'A feed-specific notice opens separate feed health instead of declaring every connection unavailable.');
const historyTimes=[...doc.querySelectorAll('[data-sync-feed=sessions] time[data-at]')].map(node=>node.dataset.at);
check(historyTimes.join(',')===[historySuccess,historyAttempt,historyCapture].join(','),
 'History last-success, last-attempt and published-capture dates retain their separate meanings.');
click('#detail [data-worker-status]');
check(doc.querySelector('#detail h2').textContent==='Gemini errand daemon'&&doc.querySelector('#detail [data-back]').textContent==='← Back',
 'A daemon drilldown from Connection status labels its nested history return accurately.');
const statusBack=new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));click('#detail [data-back]');
for(let pass=0;pass<5;pass++){for(const[id,task]of [...timers])if(!task.delay){timers.delete(id);task.fn();}await flush();}await statusBack;await flush();
check(doc.querySelector('#detail h2').textContent==='Connection status','Back from daemon detail returns to its originating connection page.');
doc.querySelector('#detail h2').focus();snapshot.observedAt=new Date().toISOString();await refresh();
check(doc.activeElement===doc.querySelector('#detail h2'),'Connection-status polling preserves heading focus.');
snapshot.sources.sync.sessions.errorCode='C:/private/secret';snapshot.sources.sync.sessions.label='<img src=x>';await refresh();
check(!doc.querySelector('#detail').textContent.includes('C:/private/secret')&&!doc.querySelector('#detail img')&&doc.querySelector('[data-sync-feed=sessions] h3').textContent==='Session history',
 'Unknown feed errors and arbitrary label fields cannot leak diagnostics or overwrite fixed display labels.');
const postsBeforeStale=syncPosts;
for(const seconds of [16,36]) {
  snapshot.observedAt=earlier(seconds);await refresh();
  const retry=doc.querySelector('[data-sync-retry]');
  retry.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await flush();
  check(retry.disabled&&doc.querySelector('#detail [role=status]').textContent==='Wait for a fresh laptop observation before retrying.'
    &&!doc.querySelector('#detail [role=status]').textContent.includes('Reconnect')&&syncPosts===postsBeforeStale,
    'A connected '+seconds+'-second-old observation waits for fresh data and cannot send a retry POST, even through a synthetic click.');
}
snapshot.observedAt=new Date().toISOString();await refresh();
snapshot.sources.sync.sessions.errorCode='timeout';await refresh();syncHold=true;click('[data-sync-retry]');click('[data-sync-retry]');
check(syncPosts===1&&lastSyncOptions.method==='POST'&&lastSyncOptions.headers['X-WebTools-Action']==='1'&&!lastSyncOptions.body&&doc.querySelector('[data-sync-retry]').disabled,
 'Retry uses one protected, bodyless same-origin POST and suppresses repeated taps while pending.');
syncHold=false;syncRelease();for(let pass=0;pass<4;pass++)await flush();
check(doc.querySelector('#detail [role=status]').textContent.includes('Refresh requested')&&doc.querySelector('[data-sync-retry]').disabled,
 'An accepted retry reports a request rather than claiming completion, and keeps the action on cooldown.');
const clientNow=w.Date.now;w.Date.now=()=>clientNow()+20000;snapshot.observedAt=new Date(Date.now()+20000).toISOString();syncStatus=409;await refresh();click('[data-sync-retry]');for(let pass=0;pass<4;pass++)await flush();
check(syncPosts===2&&doc.querySelector('#detail [role=status]').textContent.includes('already in progress'),
 'A concurrent automatic refresh returns useful busy feedback without issuing a duplicate job.');
w.Date.now=()=>clientNow()+40000;snapshot.observedAt=new Date(Date.now()+40000).toISOString();syncStatus=429;await refresh();click('[data-sync-retry]');for(let pass=0;pass<4;pass++)await flush();
check(syncPosts===3&&doc.querySelector('#detail [role=status]').textContent.includes('wait briefly')&&doc.querySelector('[data-sync-retry]').disabled,
 'Rate-limited retries preserve the server cooldown with clear feedback.');
w.Date.now=clientNow;snapshot.observedAt=earlier(30);await refresh();
check(doc.querySelector('[data-sync-retry]').disabled&&doc.querySelector('#detail [role=status]').textContent==='Wait for a fresh laptop observation before retrying.',
  'A stale observation takes priority over feedback from an earlier retry request.');
w.Date.now=clientNow;snapshot.observedAt=new Date().toISOString();offline=true;await refresh();
check(doc.querySelector('[data-sync-retry]').disabled&&doc.querySelector('[data-sync-feed=sessions]').textContent.includes('Saved observation')
  &&doc.querySelector('#detail [role=status]').textContent==='Reconnect to the laptop to request a refresh.',
 'Offline connection status qualifies saved feed observations and disables actions without replaying writes.');
offline=false;await refresh();clearDetail();doc.querySelector('#notice [data-sync-status=sessions]').focus();
for(const value of Object.values(snapshot.sources.sync)){value.state='ok';value.errorCode=null;value.succeededAt=new Date().toISOString();}await refresh();
check(!doc.querySelector('#notice [data-sync-status]')&&doc.activeElement.id==='view-picker',
 'Successful recovery removes only the feed warning and returns focus from its removed action.');
click('#view-picker');doc.querySelector('#view-menu [data-sync-status]').focus();doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
check(doc.activeElement.hasAttribute('data-interface-refresh'),'Menu keyboard navigation includes the new Connection status item in its normal order.');
click('#view-menu [data-sync-status]');
check(doc.querySelector('#detail h2').textContent==='Connection status'&&doc.querySelector('#view-menu').hidden,
 'Connection status remains available from the view menu after warnings clear.');
clearDetail();w.NowViews.setView('files');click('#view-picker');click('#view-menu [data-sync-status]');
check(doc.querySelector('#detail [data-back]').textContent==='← Files','A status page opened from Files identifies its actual return view.');
snapshot.sources.sync.sessions.state='refreshing';snapshot.sources.sync.sessions.errorCode='timeout';await refresh();
check(doc.querySelector('[data-sync-feed=sessions]').textContent.includes('Refreshing')&&doc.querySelector('[data-sync-retry]').disabled,
 'An in-progress retry keeps its prior error context and prevents overlapping requests.');
const filesBack=new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));click('#detail [data-back]');
for(let pass=0;pass<5;pass++){for(const[id,task]of [...timers])if(!task.delay){timers.delete(id);task.fn();}await flush();}await filesBack;await flush();
check(w.NowViews.current()==='files'&&doc.activeElement.id==='view-picker','Back from connection detail restores visible navigation focus in the originating Files view.');
console.log(`${checks} phone interaction checks passed.`);
dom.window.close();
