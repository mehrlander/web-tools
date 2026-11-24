import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,timers=new Map(),requests=[],repositoryGates=[];
let id=0,top=0,offline=false,denied=false,hold,checks=0,postStatus=202,repositoryStatus=200,repositoryJsonReads=0;
const at=new Date().toISOString(),repoKey='a'.repeat(24),key='b'.repeat(24),otherKey='c'.repeat(24);
const comp=(state,ahead,behind,branch='feature/work')=>({state,ahead,behind,branch});
const c={key,name:'project',branch:'feature/work',changed:2,untracked:1,conflicts:0,tracked:comp('diverged',2,4),main:comp('behind',0,61,'main'),localFiles:{key,name:'project',state:'ready',observedAt:at,partial:false,notice:null,entries:[
 {key:'d'.repeat(24),path:'exports/',kind:'folder',gitState:'ignored',bytes:34000000,files:12,modifiedAt:at,partial:false,role:null},
 {key:'e'.repeat(24),path:'node_modules/',kind:'folder',gitState:'ignored',bytes:240000000,files:18400,modifiedAt:at,partial:false,role:'Dependencies'},
 {key:'f'.repeat(24),path:'note.md',kind:'file',gitState:'untracked',bytes:12,files:1,modifiedAt:at,partial:false,role:null}
]}};
const other={key:otherKey,name:'project-other',branch:'other',changed:0,untracked:0,conflicts:0,tracked:comp('no-upstream',null,null,null),main:comp('incomplete-history',null,null,'main')};
const repo={key:repoKey,name:'fixture/project',url:'https://github.com/fixture/project',checkedAt:at,notice:null,checkouts:[c,other]};
c.upstream='origin/main';c.branchStatus={state:'open',number:4,url:'https://github.com/fixture/project/pull/4',title:'Review <local> work',checkedAt:at,pullRequestState:'open'};
const data={schemaVersion:1,machineName:'Laptop',observedAt:at,refreshing:[],repositories:[repo]};
const listing=path=>({schemaVersion:1,rootName:'repos',path,state:'ready',observedAt:at,partial:false,notice:null,entries:(path?['exports','node_modules']:['project','project-other','ordinary']).map(name=>({name,kind:'folder',gitState:path?'ignored':null,bytes:null,modifiedAt:at,role:null}))});
w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};w.clearTimeout=k=>timers.delete(k);
Object.defineProperty(w,'scrollY',{get:()=>top});w.scrollTo=(_x,y)=>{top=y;};w.AbortController=AbortController;
w.matchMedia=()=>({matches:false});w.eval(read('../../lib/kits/title-tip.js'));
w.fetch=async(path,options={})=>{
 requests.push({path,...options});if(offline)throw new Error();
 if(options.method==='POST'){if(hold)await hold;if(postStatus===202)data.refreshing=[repoKey];return{ok:!denied&&postStatus===202,status:denied?403:postStatus};}
 const files=path.startsWith('/api/v1/files'),status=denied?403:files?200:repositoryStatus;
 if(!files&&repositoryGates.length)await repositoryGates.shift();
 return{ok:status===200,status,headers:{get:name=>name==='ETag'&&!files?'"fixture-repositories"':''},json:async()=>{
  if(!files){repositoryJsonReads++;assert.notEqual(status,304,'A 304 response has no JSON body.');}
  return structuredClone(files?listing(new URL(path,w.location).searchParams.get('path')):data);
 }};
};
w.eval(read('../phone/local-files.js'));w.eval(read('../phone/repositories.js'));w.eval(read('../../lib/kits/swipe-deck.js'));w.eval(read('../phone/views.js'));
const position=()=>w.NowViews.scrollPosition(w.NowViews.current());
const setTop=value=>w.NowViews.scrollTo(value,w.NowViews.current());
const flush=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const click=selector=>{assert.ok(doc.querySelector(selector),selector);doc.querySelector(selector).click();};
const poll=async()=>{w.dispatchEvent(new w.Event('online'));await flush();};
const row=()=>doc.querySelector(`[data-checkout="${key}"]`),menu=()=>doc.querySelector('#menu-'+key),signal=()=>doc.querySelector('#status-'+key);
const indicator=direction=>row().querySelector(`[data-commit="${key}:files:${direction}"]`);
check(!requests.length,'Files does not collect outside its view.');
setTop(250);click('[data-view=files]');await flush();
click('[data-file-root="gh"]');await flush();
check(w.location.hash==='#view=files&root=gh'&&doc.querySelector('#view-title').textContent==='Files'&&doc.querySelector('#repository-back').hidden&&!doc.querySelector('#panel-files').inert,'Repository folders open through their explicit Files root.');
check(!doc.querySelector('[data-view=repositories],[data-files],#repository-info')&&doc.querySelectorAll('[data-repository]').length===1&&doc.querySelectorAll('[data-checkout]').length===2&&doc.getElementById('workfolders-'+repoKey).hidden&&doc.getElementById('workfolders-other').hidden,'Files shows one repository row with secondary folders and ordinary files collapsed.');
check(indicator('ahead').getAttribute('data-title-tip').includes('2 commits ahead of GitHub feature/work.')&&indicator('behind').getAttribute('data-title-tip').includes('GitHub checked just now')&&!doc.querySelector('[data-commit*=":main:"]'),'Each branch shows one comparison whose tooltip includes its target and GitHub check age.');
check(indicator('ahead').className.includes('--color-success')&&indicator('behind').classList.contains('text-amber-700'),'Ahead and behind counts carry restrained semantic colors.');
check(indicator('behind').getAttribute('data-title-tip').includes('Configured upstream: GitHub main.'),'The comparison discloses a different configured upstream while targeting the matching branch.');
click(`[data-branch-signal="${key}"]`);const branchPanel=()=>doc.querySelector('#branch-'+key);
check(!branchPanel().hidden&&branchPanel().textContent.includes('Open pull request')&&branchPanel().querySelector('a').href==='https://github.com/fixture/project/pull/4'&&branchPanel().textContent.includes('Review <local> work')&&!branchPanel().querySelector('local'),'A compact branch icon opens safe, explicit PR context without an inline status label.');
row().querySelector('[data-branch-signal]').focus();setTop(160);await poll();
check(!branchPanel().hidden&&doc.activeElement.dataset.branchSignal===key&&position()===160,'Branch context, focus and scroll survive automatic updates.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(branchPanel().hidden&&doc.activeElement.dataset.branchSignal===key,'Escape dismisses branch context and restores its source icon.');
c.branchStatus.state='merged';c.branchStatus.pullRequestState='merged';await poll();
check(row().querySelector('[data-branch-signal]').classList.contains('text-violet-700')&&row().querySelector('[data-branch-signal]').getAttribute('aria-label').includes('Merged'),'Merged work has a distinct icon color and accessible state.');
c.branchStatus.state='review';c.branchStatus.url='javascript:alert(1)';await poll();click(`[data-branch-signal="${key}"]`);
check(branchPanel().textContent.includes('local history still needs review')&&!branchPanel().querySelector('a'),'Post-merge review remains distinct and unsafe PR links are omitted.');
c.branchStatus={state:'incorporated',checkedAt:at};await poll();check(branchPanel().textContent.includes('Included in GitHub default branch'),'Work already incorporated without a PR has its own explanation.');
c.branchStatus.state='snapshot';c.main.branch='<img src=x onerror=x>';await poll();check(branchPanel().textContent.includes('<img src=x onerror=x>')&&!branchPanel().querySelector('img,[onerror]'),'Snapshot branch names remain literal text in the detail panel.');c.main.branch='main';
delete c.branchStatus;await poll();check(branchPanel().textContent.includes('Branch status not checked'),'Saved observations without lifecycle metadata remain honest.');
click('#local-observed');setTop(0);
check([...row().querySelectorAll('[data-metric]')].map(n=>n.textContent).join(',')==='2,1,2'&&!row().querySelector('[data-folder]').textContent.includes('changed'),'Separate compact counts expose changed tracked files, untracked files and ignored inventory entries without row labels.');
check(row().querySelector('[data-metric=changed]').getAttribute('aria-label').includes('2 changed tracked files')&&row().querySelector('[data-metric=untracked]').getAttribute('aria-label').includes('1 untracked file')&&row().querySelector('[data-metric=ignored]').getAttribute('aria-label').includes('2 ignored inventory entries'),'Each file count identifies its own unit and folder for assistive technology.');
const unknown=doc.querySelector(`[data-commit="${otherKey}:files:state"]`);
check(unknown.textContent===''&&unknown.querySelector('svg')&&unknown.getAttribute('data-title-tip').includes('No tracked GitHub branch is configured.'),'An unknown comparison is a touch-explained symbol without commentary in the row.');
check(!doc.querySelector(`[data-checkout="${otherKey}"] [data-signal]`)&&doc.querySelector('#menu-'+otherKey+' a').href==='https://github.com/fixture/project','A clean folder omits the local-status icon and an untracked branch opens its repository.');
other.changed=null;await poll();click(`[data-signal="${otherKey}"]`);check(doc.querySelector('#status-'+otherKey).textContent.includes('Local status unavailable'),'Unknown local state has an explanatory status panel.');
other.changed=0;other.localFiles={key:otherKey,name:other.name,state:'unavailable',observedAt:at,partial:false,entries:[],notice:null};await poll();check(doc.querySelector('#status-'+otherKey).textContent.includes('Local inventory unavailable'),'An unavailable inventory has meaningful detail instead of an empty popover.');
other.localFiles=null;await poll();
click(`[data-signal="${key}"]`);
check(!signal().hidden&&signal().textContent.includes('2 changed tracked files')&&signal().textContent.includes('1 untracked file')&&signal().textContent.includes('Ignored · 2 folders'),'The local status icon opens exact counts and inventory shortcuts.');
click(`[data-signal="${key}"][data-metric=untracked]`);check(!signal().hidden&&row().querySelector('[data-metric=untracked]').getAttribute('aria-expanded')==='true'&&row().querySelector('[data-metric=changed]').getAttribute('aria-expanded')==='false','Switching category keeps the shared detail panel open and marks its current source.');
doc.querySelector(`[data-focus="${key}:signal:untracked"]`).focus();doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(signal().hidden&&doc.activeElement.dataset.metric==='untracked','Escape restores focus to the category that opened the panel.');
c.changed=5379;c.untracked=5378;await poll();
check(row().querySelector('[data-metric=changed]').textContent==='5.4k'&&row().querySelector('[data-metric=untracked]').textContent==='5.4k'&&row().querySelector('[data-metric=changed]').getAttribute('aria-label').includes('5,379'),'Large face counts stay short while accessible labels retain exact totals.');
click(`[data-signal="${key}"][data-metric=changed]`);check(signal().textContent.includes('5,379 changed tracked files')&&signal().textContent.includes('5,378 untracked files'),'Compacted categories retain separate exact totals in the panel.');
c.changed=2;c.untracked=1;await poll();
setTop(160);doc.querySelector(`[data-focus="${key}:ignored"]`).focus();c.changed=3;await poll();
check(!signal().hidden&&signal().textContent.includes('3 changed tracked files')&&row().querySelector('[data-metric=changed]').textContent==='3'&&doc.activeElement.dataset.focus===key+':ignored'&&position()===160,'Polling updates face and panel counts while preserving the open panel, focus and scroll.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(signal().hidden&&doc.activeElement.dataset.signal===key,'Escape dismisses the status panel and restores its icon focus.');
c.conflicts=1;await poll();check(row().querySelector('[data-signal]').classList.contains('text-red-700'),'Conflicts are distinguished with red.');
c.conflicts=0;c.changed=0;c.untracked=0;await poll();check(row().querySelectorAll('[data-signal]').length===1&&row().querySelector('[data-signal]').classList.contains('text-stone-500')&&row().querySelector('[data-signal]').textContent==='2','An ignored-only inventory counts its two observed folders, without counting their contents or showing zero categories.');
c.localFiles.partial=true;await poll();click(`[data-signal="${key}"]`);check(signal().textContent.includes('Partial inventory')&&row().querySelector('[data-metric=ignored]').textContent==='≥2'&&row().querySelector('[data-metric=ignored]').getAttribute('aria-label').includes('At least 2'),'Incomplete inventory counts remain visibly qualified as lower bounds.');
click(`[data-menu="${key}"]`);
check(signal().hidden&&!menu().hidden&&menu().querySelectorAll('[role=menuitem]').length===2&&menu().textContent==='Check GitHubOpen on GitHub','The separate vertical menu has two plain actions without explanatory subitems.');
check([...row().querySelectorAll('[data-menu] circle')].every(n=>n.getAttribute('cx')==='12'),'The action menu uses vertical dots.');
check(menu().querySelector('a').href==='https://github.com/fixture/project/tree/feature%2Fwork','Open on GitHub goes to the corresponding tracked branch.');
setTop(160);menu().querySelector('[data-fetch]').focus();await poll();
check(!menu().hidden&&doc.activeElement.dataset.focus===key+':fetch'&&position()===160,'An action menu and its keyboard focus survive automatic updates.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));check(doc.activeElement.dataset.github===key,'Keyboard navigation reaches the branch link.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(menu().hidden&&doc.activeElement.dataset.menu===key,'Escape restores the action trigger without scrolling.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));check(doc.activeElement.dataset.fetch===repoKey,'Arrow Down opens the action menu.');
click('#local-observed');check(menu().hidden,'An outside tap dismisses the menu.');
indicator('behind').focus();setTop(160);await poll();check(doc.activeElement.dataset.commit===key+':files:behind'&&doc.querySelector('#wt-title-tip').hasAttribute('data-open')&&position()===160,'Count tooltips keep their anchor and focus during polling.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
repo.checkedAt=new Date(Date.now()-900000).toISOString();await poll();
check(row().querySelector('[data-menu]').classList.contains('text-amber-700')&&indicator('behind').getAttribute('data-title-tip').includes('15m ago'),'An older GitHub check appears as an amber action icon, with its age in the arrow detail.');
repo.notice='Last GitHub check unavailable.';await poll();check(indicator('behind').getAttribute('data-title-tip').includes(repo.notice),'Failed check context remains available without a row banner.');
repo.url='javascript:alert(1)';await poll();check(!row().querySelector('[data-menu],a'),'An unsafe GitHub origin cannot create an action or link.');
repo.url='https://github.com/fixture/project';repo.notice=null;repo.checkedAt=at;await poll();
w.history.replaceState(null,'','#view=repositories&checkout='+key);w.dispatchEvent(new w.HashChangeEvent('hashchange'));await flush();
check(new URLSearchParams(w.location.hash.slice(1)).get('view')==='files'&&doc.querySelector('#local-breadcrumb').textContent==='repos/project','Previously shared checkout links land in the corresponding Files folder.');
click('#repository-back');await flush();check(w.location.hash==='#view=files&root=gh'&&doc.querySelector('#repository-back').hidden,'Back from a direct old link reaches the repository root, without changing to Downloads.');
click(`[data-signal="${key}"]`);click(`[data-inventory="${key}:ignored"]`);await flush();
check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='project'&&new URLSearchParams(w.location.hash.slice(1)).get('filter')==='ignored'&&doc.querySelector('[data-file-filter=ignored]').getAttribute('aria-pressed')==='true','The status shortcut opens that folder directly in its ignored inventory.');
check(doc.querySelector('#folder-actions [data-menu]')&&doc.querySelector('#folder-actions [data-signal]'),'The current working folder keeps actions in its breadcrumb area.');
click('[data-file-filter=all]');await poll();check(doc.querySelector('[data-file-filter=all]').getAttribute('aria-pressed')==='true'&&!new URLSearchParams(w.location.hash.slice(1)).has('filter'),'A selected filter persists through updates without being reset by the route.');
click('[data-folder=""]');await flush();
let release;hold=new Promise(r=>{release=r;});click(`[data-menu="${key}"]`);click(`[data-focus="${key}:fetch"]`);click('[data-fetch=all]');
check(requests.filter(r=>r.method==='POST').length===1,'Overlapping taps cannot queue duplicate checks.');
const request=requests.find(r=>r.method==='POST');check(request.path==='/api/v1/repositories/'+repoKey+'/fetch'&&request.headers['X-WebTools-Action']==='1'&&!request.body,'The check reuses the discovered repository key and existing deliberate-action header.');
release();hold=null;await flush();check(doc.querySelector('[role=status][data-popup]')?.textContent==='GitHub check queued.'&&doc.querySelector('[data-fetch=all] .animate-spin'),'A queued check has quiet action feedback and a real progress icon.');
data.refreshing=[];await poll();postStatus=500;click('[data-fetch=all]');await flush();check(doc.querySelector('[role=status][data-popup]')?.textContent==='GitHub check unavailable.','A failed manual check reports its result without claiming the local folder changed.');
const beforeMainSync=structuredClone(c),syncChecked=new Date(Date.now()-120000).toISOString(),syncUpdated=new Date(Date.now()-180000).toISOString();
const postCount=requests.filter(r=>r.method==='POST').length;
c.branch='main';c.upstream='origin/main';c.tracked=comp('current',0,0,'main');c.main=comp('current',0,0,'main');c.branchStatus={state:'main'};
delete repo.mainSync;await poll();click(`[data-branch-signal="${key}"]`);
const primaryIcon=()=>row().querySelector(`[data-branch-signal="${key}"]`);
check(!indicator('ahead')&&!indicator('behind')&&!branchPanel().querySelector('[data-main-sync]')&&!primaryIcon().getAttribute('aria-label').includes('automatic'),
 'A legacy snapshot keeps zero differences hidden without claiming an automatic update was observed.');
repo.mainSync=null;await poll();check(!branchPanel().querySelector('[data-main-sync]'),'A null optional update result remains unknown.');
repo.mainSync={state:'updated',reason:null,folder:c.name,checkedAt:syncChecked,updatedAt:syncUpdated};
primaryIcon().focus();setTop(160);await poll();
check(!branchPanel().hidden&&!indicator('ahead')&&!indicator('behind')&&branchPanel().textContent.includes('Default folder project was updated automatically.')
 &&branchPanel().textContent.includes('Automatic check')&&branchPanel().textContent.includes('Last automatic update')&&branchPanel().textContent.includes('GitHub checked')
 &&primaryIcon().getAttribute('aria-label').includes('Default folder project was updated automatically.')&&doc.activeElement===primaryIcon()&&position()===160,
 'A successful zero-count update remains accessible through the existing repository icon, with independent times and polling focus retained.');
repo.mainSync={...repo.mainSync,state:'current',updatedAt:null};await poll();
check(branchPanel().textContent.includes('was current at the automatic check')&&!branchPanel().textContent.includes('was updated automatically'),
 'An already-current folder is distinguished from an observed automatic update.');
repo.mainSync={...repo.mainSync,state:'blocked',reason:'active-session'};c.tracked=comp('behind',0,4,'main');await poll();
check(primaryIcon().classList.contains('text-amber-700')&&indicator('behind').textContent==='4'
 &&indicator('behind').getAttribute('data-title-tip').includes('session activity was detected')&&indicator('behind').getAttribute('aria-label').includes('Automatic check')
 &&branchPanel().textContent.includes('Automatic update of project was held')&&!row().querySelector('[data-menu]').classList.contains('text-amber-700'),
 'A protected folder with a behind comparison retains its amber repository icon and comparison counts without changing GitHub-check freshness.');
repo.mainSync={...repo.mainSync,state:'failed',reason:'update-unavailable'};await poll();
check(primaryIcon().classList.contains('text-amber-700')&&branchPanel().textContent.includes('update result could not be confirmed'),
 'An unconfirmed update reports a separate failed outcome without claiming success.');
click(`[data-menu="${key}"]`);check(menu().querySelectorAll('[role=menuitem]').length===2&&menu().textContent==='Check GitHubOpen on GitHub',
 'Automatic update details add no explanatory rows or new actions to the existing menu.');
click(`[data-workfolders="${repoKey}"]`);click(`[data-branch-signal="${otherKey}"]`);
check(!doc.querySelector('#branch-'+otherKey).querySelector('[data-main-sync]')&&!doc.querySelector(`[data-branch-signal="${otherKey}"]`).getAttribute('aria-label').includes('automatic'),
 'A group update result is not presented as an update to another work folder.');
repo.mainSync={...repo.mainSync,folder:other.name,state:'updated',reason:null};other.branchStatus={state:'main'};await poll();
check(!doc.querySelector('[data-main-sync]'),'A stale branch-state label cannot attach a default-folder success to a known feature branch.');
delete other.branchStatus;repo.mainSync={...repo.mainSync,folder:c.name,state:'blocked',reason:'constructor'};await poll();click(`[data-branch-signal="${key}"]`);
check(branchPanel().textContent.includes('a safe update could not be confirmed')&&!branchPanel().textContent.includes('native code'),
 'An unfamiliar reason, including a prototype property name, receives fixed generic wording.');
for(const value of [{...repo.mainSync,state:'updating'},{...repo.mainSync,checkedAt:'not a time'},{...repo.mainSync,updatedAt:'not a time'},
 {...repo.mainSync,reason:'<img src=x onerror=alert(1)>'},{...repo.mainSync,state:'updated',reason:null,folder:null}]){
 repo.mainSync=value;await poll();
 check(!branchPanel().querySelector('[data-main-sync]')&&primaryIcon().classList.contains('text-amber-700')&&indicator('behind').textContent==='4',
  'Malformed optional update metadata leaves the valid repository observation and comparison readable.');
}
Object.assign(c,beforeMainSync);repo.mainSync={state:'blocked',reason:'activity-unavailable',folder:null,checkedAt:syncChecked,updatedAt:null};await poll();
check(branchPanel().textContent.includes('Repository automatic update was blocked: session activity could not be checked.')
 &&!branchPanel().textContent.includes('Default folder project was updated'),
 'A result without a selected default folder uses repository-wide wording in the fallback branch popup.');
delete repo.mainSync;await poll();
check(requests.filter(r=>r.method==='POST').length===postCount,'Observing automatic-update metadata never initiates a manual fetch or update action.');

const syncStrip=()=>doc.querySelector('[data-sync-strip]');
const syncPanel=()=>doc.querySelector('[data-popup="sync:all"]');
const phase=value=>doc.querySelector(`[data-sync-phase="${value}"][data-sync-key="${repoKey}"]`);
const queuedAt=new Date(Date.now()-180000).toISOString(),startedAt=new Date(Date.now()-120000).toISOString(),finishedAt=new Date(Date.now()-60000).toISOString();
const finishedStamp=new Date(finishedAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const job=changes=>({key:repoKey,mode:'check',queuedAt,startedAt:null,finishedAt:null,outcome:null,...changes});
const sync=changes=>({active:null,queued:[],awaitingObservation:[],lastCompleted:null,scanning:false,scanStartedAt:null,...changes});
const panelOpen=()=>syncPanel()&&!syncPanel().hidden;
const running=()=>doc.querySelector('[data-sync-phase],[data-sync-strip] [class*="animate-spin"]');
const syncPosts=requests.filter(r=>r.method==='POST').length;
click('#local-observed');data.refreshing=[];data.observedAt=new Date(Date.now()-600000).toISOString();
data.sync=sync({queued:[job()],scanning:true,scanStartedAt:startedAt});await poll();
check(syncStrip()&&syncStrip().dataset.focus==='all:sync'&&phase('queued')&&!phase('checking')&&doc.querySelector('[data-fetch=all]').disabled,
 'A live queued job remains visible over a stale folder snapshot without enabling a manual GitHub check.');
check(doc.querySelector('#connection').textContent==='Connected','A successful API connection is distinct from the age of its folder observation.');
const originalRectangle=w.HTMLElement.prototype.getBoundingClientRect;
try{
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.matches('[data-sync-phase]')?new w.DOMRect(280,510,24,40):originalRectangle.call(this);};
 phase('queued').focus();click(`[data-sync-phase="queued"][data-sync-key="${repoKey}"]`);
 check(panelOpen()&&syncPanel().style.position==='fixed'&&(parseFloat(syncPanel().style.top)>=500||syncPanel().style.top==='auto'&&parseFloat(syncPanel().style.bottom)>0&&parseFloat(syncPanel().style.bottom)<w.innerHeight-100),
  'A lower-row phase opens the shared sync panel beside or above its actual source instead of the offscreen root strip.');
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 check(!panelOpen()&&doc.activeElement.dataset.syncKey===repoKey&&position()===160,
  'Escape dismisses a row-opened sync panel and returns focus to its phase control without scrolling.');
}finally{w.HTMLElement.prototype.getBoundingClientRect=originalRectangle;}
const secondaryWasCollapsed=doc.getElementById('workfolders-'+repoKey).hidden;
if(secondaryWasCollapsed)click(`[data-workfolders="${repoKey}"]`);
try{
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.matches('[data-sync-phase]')?new w.DOMRect(280,this.closest('[data-checkout]')?.dataset.checkout===otherKey?420:130,24,40):originalRectangle.call(this);};
 const secondary=doc.querySelector(`[data-checkout="${otherKey}"] [data-sync-phase]`),secondaryFocus=secondary.dataset.focus;
 secondary.focus();secondary.click();await poll();
 const anchored=panelOpen()&&parseFloat(syncPanel().style.top)>=400&&doc.activeElement.dataset.focus===secondaryFocus;
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 check(anchored&&!panelOpen()&&doc.activeElement.dataset.focus===secondaryFocus&&secondaryFocus.includes(otherKey)&&position()===160,
  'An expanded secondary work folder keeps its own sync anchor and focus through polling and Escape, rather than resolving the primary row.');
}finally{w.HTMLElement.prototype.getBoundingClientRect=originalRectangle;}
if(secondaryWasCollapsed)click(`[data-workfolders="${repoKey}"]`);
click('[data-sync-strip]');
check(panelOpen()&&syncPanel().getAttribute('role')==='region'&&syncPanel().getAttribute('aria-label')==='Repository sync'
 &&/queued/i.test(syncPanel().textContent)&&/Folder observation/i.test(syncPanel().textContent)&&/scann|reading/i.test(syncPanel().textContent),
 'The compact strip opens one focused panel separating queue, scan and folder-observation information.');
check(!/%|\bETA\b/i.test(syncPanel().textContent),'The rolling queue reports no percentage or invented completion estimate.');
data.sync=sync({active:job({mode:'update',startedAt})});await poll();
check(phase('checking')&&!phase('queued')&&panelOpen()&&syncPanel().textContent.includes('project')&&!/was updated automatically/i.test(syncPanel().textContent),
 'An active automatic attempt is shown as checking, without claiming that the folder has been updated.');
check(/checking|automatic|update/i.test(phase('checking').getAttribute('aria-label')||'')&&(phase('checking').getAttribute('aria-label')||'').includes('project'),
 'The per-repository phase has a touch and accessible explanation naming its repository.');
syncStrip().focus();setTop(160);await poll();
check(panelOpen()&&doc.activeElement===syncStrip()&&position()===160,'Live queue polling preserves the open sync panel, trigger focus and reading position.');
// JSDOM has no layout: model a tall popup whose native scroll range depends on
// its current height, including clamping when a resize enlarges its viewport.
const panelScroll=new WeakMap(),panelContentHeight=960;
const elementPrototype=w.Element.prototype,stylePrototype=Object.getPrototypeOf(doc.createElement('div').style);
const panelProperties=Object.fromEntries(['scrollTop','clientHeight','scrollHeight'].map(name=>[name,Object.getOwnPropertyDescriptor(elementPrototype,name)]));
const originalMaxHeight=Object.getOwnPropertyDescriptor(stylePrototype,'maxHeight');
const panelViewport=panel=>Math.min(panelContentHeight,parseFloat(panel.style.maxHeight)||panelContentHeight);
const clampPanelScroll=panel=>{const value=Math.max(0,Math.min(panelScroll.get(panel)||0,panelContentHeight-panelViewport(panel)));panelScroll.set(panel,value);return value;};
try{
 for(const name of ['scrollTop','clientHeight','scrollHeight'])Object.defineProperty(elementPrototype,name,{
  configurable:true,get(){return this.id==='repository-sync-panel'?(name==='scrollTop'?clampPanelScroll(this):name==='clientHeight'?panelViewport(this):panelContentHeight):panelProperties[name].get.call(this);},
  ...(name==='scrollTop'?{set(value){if(this.id!=='repository-sync-panel')return panelProperties.scrollTop.set.call(this,value);panelScroll.set(this,Number(value));clampPanelScroll(this);}}:{})
 });
 Object.defineProperty(stylePrototype,'maxHeight',{...originalMaxHeight,set(value){originalMaxHeight.set.call(this,value);const panel=syncPanel();if(panel?.style===this)clampPanelScroll(panel);}});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.matches('[data-sync-strip]')?new w.DOMRect(12,280,340,32):originalRectangle.call(this);};
 w.dispatchEvent(new w.Event('resize'));
 const scrolledPanel=syncPanel(),focusedLink=scrolledPanel.querySelector('[data-focus]');
 focusedLink.focus();scrolledPanel.scrollTop=180;
 assert.equal(scrolledPanel.scrollTop,180,'The constrained popup must have a nonzero scroll range before polling.');
 await poll();
 check(syncPanel()!==scrolledPanel&&panelOpen()&&syncPanel().scrollTop===180
  &&doc.activeElement.dataset.focus===focusedLink.dataset.focus&&syncPanel().contains(doc.activeElement)&&position()===160,
  'Polling preserves the sync popup scroll and focused link when its replacement initially has no height constraint.');
 const bottom=syncPanel().scrollHeight-syncPanel().clientHeight;
 syncPanel().scrollTop=bottom;w.dispatchEvent(new w.Event('resize'));
 check(syncPanel().scrollTop===bottom,'Repositioning an open sync popup preserves its bottom scroll position.');
 await poll();
 check(panelOpen()&&syncPanel().scrollTop===bottom&&syncPanel().contains(doc.activeElement)
  &&doc.activeElement.dataset.focus===focusedLink.dataset.focus&&position()===160,
  'A later poll preserves the sync popup bottom position, focused link and Files reading position.');
}finally{
 for(const [name,descriptor] of Object.entries(panelProperties))Object.defineProperty(elementPrototype,name,descriptor);
 Object.defineProperty(stylePrototype,'maxHeight',originalMaxHeight);
 w.HTMLElement.prototype.getBoundingClientRect=originalRectangle;
}
const jsonBefore304=repositoryJsonReads;repositoryStatus=304;await poll();
check(phase('checking')&&panelOpen()&&repositoryJsonReads===jsonBefore304
 &&requests.filter(r=>r.path==='/api/v1/repositories').at(-1).headers['If-None-Match']==='"fixture-repositories"',
 'A successful 304 heartbeat retains current in-memory progress without reading a nonexistent response body.');
repositoryStatus=200;
const checked=job({startedAt,finishedAt,outcome:'checked'});data.sync=sync({awaitingObservation:[checked],lastCompleted:checked});await poll();
check(phase('awaiting')&&!phase('checking')&&!phase('queued')&&panelOpen()&&/awaiting|waiting for.*(?:reading|observation)/i.test(syncPanel().textContent),
 'A finished check awaiting the next folder reading remains distinct from an executing job.');
check(syncPanel().textContent.includes(finishedStamp)&&/checked|check finished|check completed/i.test(syncPanel().textContent)&&!/was updated automatically/i.test(syncPanel().textContent),
 'A completed check exposes its recorded outcome without turning check completion into an update claim.');
data.sync=sync({lastCompleted:checked});await poll();
check(!phase('awaiting')&&!phase('checking')&&panelOpen()&&/check finished/i.test(syncPanel().textContent)&&syncPanel().textContent.includes(finishedStamp),'A published observation clears the awaiting phase while retaining the last completed check.');
for(const outcome of ['failed','unconfirmed']){
 data.sync=sync({lastCompleted:{...checked,outcome}});await poll();
 check(outcome==='failed'?/failed|unavailable/i.test(syncPanel().textContent):/unconfirmed|could not confirm|not confirmed/i.test(syncPanel().textContent),
  'The last completed check distinguishes a failed or unconfirmed outcome from a successful check.');
}
data.sync=sync();c.tracked=comp('behind',0,74);await poll();
check(!/74.*(?:attention|blocked|failed)|(?:attention|blocked|failed).*74/i.test(syncStrip().getAttribute('aria-label')||''),
 'A numerical behind count does not become an automatic-update attention count.');
repo.mainSync={state:'blocked',reason:'active-session',folder:null,checkedAt:syncChecked,updatedAt:null};await poll();
check(/1 protected/i.test(syncStrip().getAttribute('aria-label')||'')&&!/need attention/i.test(syncStrip().getAttribute('aria-label')||'')
 &&syncPanel().textContent.includes('session activity was detected')&&/finish|pause|wait|close|review/i.test(syncPanel().textContent),
 'A validated active-session guard contributes one protected count and useful next-step guidance.');
const folderLink=[...syncPanel().querySelectorAll('[data-folder],a[href]')].find(n=>n.dataset.folder===c.name||n.getAttribute('href')?.includes('folder='+c.name));
check(folderLink,'The attention panel offers a direct route to the actual work folder.');
if(folderLink){
 folderLink.focus();const focusKey=folderLink.dataset.focus;await poll();
 check(panelOpen()&&syncPanel().contains(doc.activeElement)&&(!focusKey||doc.activeElement.dataset.focus===focusKey)&&position()===160,
  'A focused protected-folder link stays inside its open panel during polling without scrolling.');
}
const beforeHealth=structuredClone(c),protectedCases=['active-session','local-changes','ignored-collision','index-flags','sparse-checkout','local-commits','git-operation','updater-busy'];
c.branch='main';c.upstream='origin/main';c.tracked=comp('current',0,0,'main');c.main=comp('current',0,0,'main');c.branchStatus={state:'main'};
for(const reason of protectedCases){
 repo.mainSync={state:'blocked',reason,folder:c.name,checkedAt:syncChecked,updatedAt:null};await poll();
 check(syncStrip().querySelector('[data-sync-count="protected"]')?.textContent==='1'&&!syncStrip().querySelector('[data-sync-count="attention"]')
  &&syncPanel().querySelector('[data-sync-group="protected"]')?.textContent.includes('Last comparison with GitHub main: current.')
  &&primaryIcon().classList.contains('text-emerald-700')&&primaryIcon().getAttribute('aria-label').includes('Protected.'),
  'An aligned folder stays current and separately protected for the explicit guard: '+reason);
}
check(!syncStrip().textContent.includes('protected')&&!syncStrip().textContent.includes('attention')
 &&syncStrip().querySelector('[data-sync-count="protected"]').getAttribute('aria-hidden')==='true'
 &&/1 protected/.test(syncStrip().getAttribute('aria-label'))&&!syncPanel().querySelector('details,summary,[aria-expanded]'),
 'The strip uses a quiet shield with a count and an accessible total, while the tap panel stays flat without expanders.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check(!panelOpen()&&doc.activeElement===syncStrip(),'Escape restores the strip after viewing protected-folder details.');
click('[data-sync-strip]');
const guardedLink=syncPanel().querySelector('[data-sync-group="protected"] [data-folder]');guardedLink.focus();setTop(160);await poll();
check(panelOpen()&&doc.activeElement.dataset.focus===guardedLink.dataset.focus&&position()===160,
 'A protected-folder detail link preserves keyboard focus and Files scroll during polling.');
click(`[data-branch-signal="${key}"]`);
check(branchPanel().textContent.includes('In sync')&&branchPanel().textContent.includes('Protected')
 &&branchPanel().textContent.includes('was held')&&!branchPanel().textContent.includes('was updated automatically'),
 'Tapping the existing repository icon shows current comparison and protection separately without an update claim.');
click('[data-sync-strip]');
for(const reason of ['activity-unavailable','activity-uncertain','invalid-source','identity-changed','refs-changed','history-unavailable','fetch-stale','no-default-worktree','ambiguous-default-worktree','constructor','new-unknown-reason']){
 repo.mainSync={state:'blocked',reason,folder:c.name,checkedAt:syncChecked,updatedAt:null};await poll();
 check(syncStrip().querySelector('[data-sync-count="attention"]')?.textContent==='1'&&!syncStrip().querySelector('[data-sync-count="protected"]')
  &&syncPanel().querySelector('[data-sync-group="attention"]')&&primaryIcon().classList.contains('text-amber-700')&&!syncPanel().textContent.includes('native code'),
  'An uncertain, unavailable, invalid or unfamiliar check stays in Needs attention: '+reason);
}
repo.mainSync={state:'failed',reason:'index-flags',folder:c.name,checkedAt:syncChecked,updatedAt:null};await poll();
check(syncStrip().querySelector('[data-sync-count="attention"]')?.textContent==='1'&&!syncStrip().querySelector('[data-sync-count="protected"]'),
 'A failed outcome stays in Needs attention even when its reason also names a known protection guard.');
repo.mainSync={state:'blocked',reason:'index-flags',folder:c.name,checkedAt:syncChecked,updatedAt:null};
for(const comparison of [comp('unrelated-history',0,0,'main'),comp('not-checked',0,0,'main'),comp('current',null,null,'main'),comp('current',0,1,'main'),comp('current',-1,0,'main')]){
 c.tracked=comparison;await poll();
 check(primaryIcon().classList.contains('text-amber-700')&&syncPanel().querySelector('[data-sync-group="protected"]').textContent.includes('GitHub comparison unavailable.')
  &&!primaryIcon().getAttribute('aria-label').includes('main: current.'),
  'Protection does not turn an unknown, unrelated or inconsistent comparison into a current claim: '+JSON.stringify(comparison));
}
c.tracked=comp('behind',0,4,'main');await poll();
check(primaryIcon().classList.contains('text-amber-700')&&indicator('behind').textContent==='4'
 &&syncPanel().querySelector('[data-sync-group="protected"]').textContent.includes('0 ahead · 4 behind'),
 'A protected folder can still be behind, and its numeric warning and detailed comparison remain visible.');
c.tracked=comp('current',0,0,'main');repo.checkedAt=new Date(Date.now()-900000).toISOString();await poll();
check(primaryIcon().classList.contains('text-amber-700')&&syncPanel().textContent.includes('GitHub checked 15m ago'),
 'A protected folder retains the stale-check warning even when its last comparison was current.');
repo.checkedAt=at;
const mixedReasons=['fetch-failed','fetch-failed','fetch-failed','active-session','active-session','active-session','index-flags','index-flags','activity-unavailable','local-changes'];
const mixedRepositories=mixedReasons.map((reason,index)=>{
 const extra=structuredClone(repo),hex=(index+1).toString(16);extra.key=hex.repeat(24);extra.name='fixture/health-'+index;
 extra.checkouts=[{...structuredClone(c),key:(index+16).toString(16).repeat(12),name:'health-'+index,localFiles:null}];
 extra.mainSync={state:reason==='fetch-failed'?'failed':'blocked',reason,folder:extra.checkouts[0].name,checkedAt:syncChecked,updatedAt:null};return extra;
});
data.repositories=mixedRepositories;await poll();
check(syncStrip().querySelector('[data-sync-count="attention"]')?.textContent==='4'&&syncStrip().querySelector('[data-sync-count="protected"]')?.textContent==='6'
 &&/4 need attention/.test(syncStrip().getAttribute('aria-label'))&&/6 protected/.test(syncStrip().getAttribute('aria-label'))
 &&syncPanel().querySelectorAll('[data-sync-group="attention"] > li').length===4&&syncPanel().querySelectorAll('[data-sync-group="protected"] > li').length===6,
 'Ten mixed outcomes separate into four checks needing attention and six protected folders, with matching face counts, accessible totals and flat detail groups.');
check(syncPanel().querySelector('[data-sync-group="attention"]').textContent.includes('the GitHub check failed')
 &&syncPanel().textContent.includes('Checks run in queue order.')&&!syncPanel().textContent.includes('the GitHub fetch failed'),
 'Failure details describe the GitHub check honestly and queue order is explained without a completion deadline or an internet-outage claim.');
data.repositories=[repo];Object.assign(c,beforeHealth);delete repo.mainSync;await poll();

delete repo.mainSync;data.refreshing=[repoKey];data.sync=sync({active:job({startedAt})});await poll();
const cached=JSON.parse(w.localStorage.getItem('web-tools-repositories-snapshot'));
check(!cached.sync&&(!cached.refreshing||cached.refreshing.length===0),'Saved repository observations omit live queue progress and busy keys.');
data.refreshing=[];
w.dispatchEvent(new w.Event('offline'));await flush();
check(!running()&&doc.querySelector('#connection').textContent==='Saved','An offline event immediately removes running claims and spinners while keeping saved folders readable.');
await poll();check(phase('checking'),'A successful current API response can establish live progress again after reconnecting.');
offline=true;await poll();check(!running()&&row(),'A failed API response removes live-progress claims without discarding the valid folder snapshot.');
offline=false;await poll();
for(const [caseIndex,malformed] of [null,'<img src=x onerror=alert(1)>',sync({queued:'not a queue'}),sync({scanning:'yes'}),
 sync({active:job({key:'<img src=x>',startedAt})}),sync({active:job({startedAt:'not a timestamp'})}),
 sync({active:job({startedAt,finishedAt,outcome:'checked'})}),sync({queued:Array.from({length:257},()=>job())})].entries()){
 data.sync=malformed;await poll();
 check(row()&&!phase('checking')&&!phase('queued')&&!phase('awaiting')&&!doc.querySelector('#repositories img,#repositories [onerror]'),
  'Malformed optional sync metadata is ignored while the valid base observation stays readable: '+JSON.stringify({caseIndex,row:Boolean(row()),phases:[...doc.querySelectorAll('[data-sync-phase]')].map(n=>n.dataset.syncPhase),unsafeNodes:doc.querySelectorAll('#repositories img,#repositories [onerror]').length}));
}
data.sync=sync({active:job({startedAt})});await poll();
const cacheDom=new JSDOM(read('../phone/index.html'),{url:'https://cache.example.ts.net/#view=files&root=gh',runScripts:'outside-only',pretendToBeVisual:true});
try{
 const cw=cacheDom.window;let cacheTimer=0;
 cw.setTimeout=()=>++cacheTimer;cw.clearTimeout=()=>{};cw.scrollTo=()=>{};cw.AbortController=AbortController;cw.matchMedia=()=>({matches:false});
 cw.localStorage.setItem('web-tools-repositories-snapshot',JSON.stringify({...data,observedAt:at,refreshing:[repoKey]}));
 cw.fetch=async path=>path.startsWith('/api/v1/files')?{ok:true,status:200,json:async()=>listing(new URL(path,cw.location).searchParams.get('path'))}:new Promise(()=>{});
 cw.eval(read('../../lib/kits/title-tip.js'));cw.eval(read('../phone/local-files.js'));cw.eval(read('../phone/repositories.js'));cw.eval(read('../../lib/kits/swipe-deck.js'));cw.eval(read('../phone/views.js'));await flush();
 check(cw.document.querySelector('[data-checkout]')&&!cw.document.querySelector('[data-sync-phase],[data-sync-strip] [class*="animate-spin"]'),
  'A cold load may show cached folders but never trusts a persisted active job or busy key before a live response.');
}finally{cacheDom.window.close();}
let releaseSuspended,releaseResumed;
repositoryGates.push(new Promise(resolve=>{releaseSuspended=resolve;}));w.dispatchEvent(new w.Event('online'));await flush();
click('[data-view=now]');repositoryGates.push(new Promise(resolve=>{releaseResumed=resolve;}));click('[data-view=files]');await flush();
check(!running()&&row(),'Returning to Files keeps cached folders readable without reviving live progress before its new response.');
releaseSuspended();await flush();
check(!running(),'A late response started before leaving Files cannot reactivate its old running state.');
releaseResumed();await flush();check(phase('checking'),'Only the current response re-establishes live progress after returning to Files.');
let hidden=false;Object.defineProperty(doc,'hidden',{configurable:true,get:()=>hidden});
repositoryGates.push(new Promise(resolve=>{releaseSuspended=resolve;}));w.dispatchEvent(new w.Event('online'));await flush();
hidden=true;doc.dispatchEvent(new w.Event('visibilitychange'));await flush();
repositoryGates.push(new Promise(resolve=>{releaseResumed=resolve;}));hidden=false;doc.dispatchEvent(new w.Event('visibilitychange'));await flush();
check(!running()&&row(),'Resuming a hidden document waits for a new response before displaying live queue phases.');
releaseSuspended();await flush();check(!running(),'A response suspended before the document was hidden cannot revive progress on resume.');
releaseResumed();await flush();check(phase('checking'),'The resumed document accepts its own current live response.');
delete doc.hidden;
denied=true;await poll();
check(!running()&&!w.localStorage.getItem('web-tools-repositories-snapshot')&&doc.querySelector('#connection').textContent==='Access unavailable',
 'Access denial clears live queue state and saved private observations immediately.');
denied=false;delete data.sync;data.observedAt=at;Object.assign(c,beforeMainSync);await poll();
click('#local-observed');setTop(160);
click('[data-folder="project"]');await flush();check(!syncStrip(),'The repository-root sync strip does not clutter a browsed subfolder.');
click('[data-folder=""]');await flush();setTop(160);
check(requests.filter(r=>r.method==='POST').length===syncPosts,'Viewing live progress, outcomes, blockers and folder routes never initiates Git actions.');

offline=true;await poll();const before=requests.length;click('[data-fetch=all]');
check(requests.length===before&&doc.querySelector('[data-fetch=all]').disabled&&doc.querySelector('#connection').textContent==='Saved','Saved observations remain readable but cannot start a GitHub check.');
click('[data-view=now]');check(position()===250,'Now retains its independent reading position.');click('[data-view=files]');await flush();check(position()===160,'The folder root retains its reading position.');
offline=false;data.observedAt=new Date(Date.now()-60000).toISOString();await poll();check(doc.querySelector('[data-fetch=all]').disabled,'Stale local observations cannot enable actions.');
data.observedAt=at;denied=true;await poll();check(!w.localStorage.getItem('web-tools-repositories-snapshot')&&!w.localStorage.getItem('web-tools-files-snapshot')&&doc.querySelector('#connection').textContent==='Access unavailable','Access denial clears saved private observations.');
console.log(`${checks} Files status, comparison, action and privacy checks passed.`);dom.window.close();
