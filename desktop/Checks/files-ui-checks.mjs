import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,timers=new Map(),requests=[];
let id=0,top=0,offline=false,denied=false,checks=0,hold;
const at=new Date().toISOString(),key='a'.repeat(24),comp={branch:'work',state:'behind',ahead:0,behind:6};
const checkout={key,name:'project',branch:'work',changed:0,untracked:0,conflicts:0,tracked:comp,main:{...comp,branch:'main',behind:61}};
checkout.localFiles={key,name:'project',state:'ready',observedAt:at,partial:false,notice:null,entries:[
 {key:'c'.repeat(24),path:'cache/',kind:'folder',gitState:'ignored',bytes:2400,files:2,modifiedAt:at,partial:false,role:'Cache'},
 {key:'d'.repeat(24),path:'src/deep-cache/',kind:'folder',gitState:'ignored',bytes:5000,files:3,modifiedAt:at,partial:false,role:null}
]};
const snapshot={schemaVersion:1,machineName:'Laptop',observedAt:at,refreshing:[],repositories:[{key:'b'.repeat(24),name:'fixture/project',url:'https://github.com/fixture/project',checkedAt:at,checkouts:[checkout]}]};
const entry=(name,kind='folder',gitState=null)=>({name,kind,gitState,bytes:kind==='file'?128:null,modifiedAt:at,role:null});
const listing=(path,entries)=>({schemaVersion:1,rootName:'repos',path,state:'ready',observedAt:at,entries,partial:false,notice:null});
const folders=new Map([
 ['',listing('',[entry('ordinary'),entry('project'),entry('AGENTS.md','file')])],
 ['project',listing('project',[entry('cache','folder','ignored'),entry('src','folder','tracked'),entry('note.md','file','untracked'),entry('README.md','file','tracked')])],
 ['project/cache',listing('project/cache',[entry('x.txt','file','ignored')])],
 ['project/src',listing('project/src',[entry('<img onerror=x>.txt','file','tracked')])]
]);
w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};w.clearTimeout=k=>timers.delete(k);
Object.defineProperty(w,'scrollY',{get:()=>top});w.scrollTo=(_x,y)=>{top=y;};w.AbortController=AbortController;
w.matchMedia=()=>({matches:false});w.eval(read('../../lib/kits/title-tip.js'));
w.fetch=async(path,options={})=>{
 requests.push({path,...options});if(offline)throw new Error();
 const isFiles=path.startsWith('/api/v1/files'),folder=isFiles?new URL(path,w.location).searchParams.get('path'):null;
 if(isFiles&&hold)await hold;
 return {ok:!denied,status:denied?403:200,headers:{get:()=>''},json:async()=>structuredClone(isFiles?folders.get(folder):snapshot)};
};
w.eval(read('../phone/local-files.js'));w.eval(read('../phone/repositories.js'));w.eval(read('../phone/views.js'));
const flush=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const click=selector=>{assert.ok(doc.querySelector(selector),selector);doc.querySelector(selector).click();};
const poll=async()=>{w.dispatchEvent(new w.Event('online'));await flush();};
click('[data-view=files]');await flush();top=220;
click('[data-folder=""]');await flush();
check(w.location.hash==='#view=files'&&doc.querySelector('#view-title').textContent==='Files','Files has a root route within the shared app shell.');
check(doc.querySelector('#local-breadcrumb').textContent==='repos'&&doc.querySelector('[data-folder=project]')&&doc.querySelector('[data-folder=ordinary]'),'The root shows actual sibling folders, including non-Git folders, under its real root name.');
check(doc.querySelector('#local-results').textContent.includes('work')&&doc.querySelectorAll('[data-commit]').length===2&&!doc.querySelector('#local-results').textContent.includes('61'),'Working folders show their selected branch and only its tracked synchronization pair.');
check(doc.querySelector('#file-filters').hidden,'Git filters are omitted at the estate root.');
top=160;click('[data-folder=project]');await flush();
check(doc.querySelector('#local-breadcrumb').textContent==='repos/project'&&!doc.querySelector('#file-filters').hidden&&doc.querySelectorAll('#local-results>div').length===4,'Opening a folder replaces the directory listing and shows its breadcrumb and Git filters.');
click('[data-file-filter=ignored]');check(doc.querySelector('#local-results').textContent.includes('cache')&&!doc.querySelector('#local-results').textContent.includes('README'),'Ignored filtering selects the immediate ignored entries.');
check(doc.querySelector('[data-folder="project/src/deep-cache"]')&&doc.querySelector('#local-results').textContent.includes('3 files · 5 KB'),'Ignored filtering retains nested inventory entries and measured folder metadata.');
click('[data-folder="project/cache"]');await flush();
check(doc.querySelector('#local-breadcrumb').textContent==='repos/project/cache'&&doc.querySelector('#local-results').textContent.includes('x.txt'),'Ignored directories can be browsed normally.');
click('[data-folder=project]');await flush();click('[data-file-filter=all]');
const search=doc.querySelector('[data-local-search]');search.value='note';search.dispatchEvent(new w.Event('input',{bubbles:true}));search.focus();top=90;
folders.get('project').observedAt=new Date().toISOString();await poll();
check(doc.querySelector('[data-local-search]')===search&&doc.activeElement===search&&search.value==='note'&&top===90&&doc.querySelector('#local-results').textContent.includes('note.md')&&!doc.querySelector('#local-results').textContent.includes('README'),'Background updates preserve search, keyboard focus and reading position.');
search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));click('[data-folder="project/src"]');await flush();
check(doc.querySelector('#local-results').textContent.includes('<img onerror=x>.txt')&&!doc.querySelector('#local-results img,[onerror]'),'Untrusted filenames render as escaped text.');
click('#repository-back');
for(let n=0;n<5;n++){for(const [key,value] of [...timers])if(!value.delay){timers.delete(key);value.fn();}await flush();}
check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='project'&&top===90,'Back restores the preceding folder and its own scroll position.');
click('[data-folder=""]');await flush();
const indicator=doc.querySelector('[data-commit]');indicator.focus();top=130;await poll();
check(doc.activeElement.dataset.commit===indicator.dataset.commit&&doc.querySelector('#wt-title-tip').hasAttribute('data-open')&&top===130,'Explorer branch tooltips and focus stay anchored through repository polling.');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));

const mainCopy={...checkout,key:'e'.repeat(24),name:'project-main',branch:'main',localFiles:null,tracked:{...comp,branch:'main',behind:0}};
const taskCopy={...checkout,key:'f'.repeat(24),name:'project-review',branch:'review',localFiles:null};
snapshot.repositories[0].checkouts.push(mainCopy,taskCopy);
folders.get('').entries.push(entry('project-main'),entry('project-review'));
folders.set('project-review',listing('project-review',[entry('README.md','file','tracked')]));
await poll();
const groupKey=snapshot.repositories[0].key,group=()=>doc.getElementById('workfolders-'+groupKey),toggle=()=>doc.querySelector('[data-workfolders="'+groupKey+'"]');
check(doc.querySelectorAll('[data-repository]').length===1&&doc.querySelector('[data-folder=project-main]').textContent.trim()==='project','The root shows one repository row, opening its main folder instead of its feature folder.');
check(doc.querySelector('[data-checkout="'+mainCopy.key+'"] [data-file-branch]').textContent.includes('project-main · main'),'A differently named main folder remains visible alongside its branch.');
check(group().hidden&&toggle().textContent.trim()==='2'&&toggle().getAttribute('aria-expanded')==='false','Secondary folders start collapsed under an icon and exact count.');
check(doc.getElementById('workfolders-other').hidden&&doc.querySelector('[data-workfolders=other]').textContent.includes('Other files'),'Ordinary folders and root files are grouped separately and collapsed.');
toggle().click();toggle().focus();top=165;await poll();
check(!group().hidden&&toggle().getAttribute('aria-expanded')==='true'&&doc.activeElement.dataset.focus===groupKey+':workfolders'&&top===165,'Background updates preserve group expansion, trigger focus and reading position.');
click('[data-folder=project-review]');await flush();
check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='project-review'&&doc.querySelector('#local-context').textContent.includes('review'),'A grouped task folder opens its real path and selected branch.');
click('[data-folder=""]');await flush();
check(!group().hidden,'Returning to the root retains the chosen group expansion.');
toggle().click();
const rootSearch=doc.querySelector('[data-local-search]');rootSearch.value='review';rootSearch.dispatchEvent(new w.Event('input',{bubbles:true}));
check(!group().hidden&&group().querySelector('[data-folder=project-review]')&&!group().querySelector('[data-folder=project]'),'Searching reveals a matching secondary folder without showing unrelated secondary folders.');
toggle().click();check(group().hidden,'A search-expanded group can still be collapsed deliberately.');
rootSearch.value='';rootSearch.dispatchEvent(new w.Event('input',{bubbles:true}));
check(group().hidden,'Clearing search restores the collapsed root.');
click('[data-workfolders=other]');check(!doc.getElementById('workfolders-other').hidden&&doc.querySelector('[data-folder=ordinary]'),'Other files remain available through their own group.');

offline=true;await poll();check(doc.querySelector('#local-observed').textContent.includes('Saved')&&doc.querySelector('[data-folder=project]'),'A lost connection labels and retains the observed folder listing.');
const reloaded=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/#view=files',runScripts:'outside-only',pretendToBeVisual:true}),saved=reloaded.window;
saved.localStorage.setItem('web-tools-repositories-snapshot',w.localStorage.getItem('web-tools-repositories-snapshot'));
saved.localStorage.setItem('web-tools-files-root',w.localStorage.getItem('web-tools-files-root'));
saved.localStorage.setItem('web-tools-files-snapshot',JSON.stringify(folders.get('project/src')));
saved.scrollTo=()=>{};saved.setTimeout=()=>1;saved.clearTimeout=()=>{};saved.AbortController=AbortController;saved.matchMedia=()=>({matches:false});saved.fetch=async()=>{throw new Error('Offline');};
saved.eval(read('../../lib/kits/title-tip.js'));saved.eval(read('../phone/local-files.js'));saved.eval(read('../phone/repositories.js'));saved.eval(read('../phone/views.js'));await flush();
check(saved.document.querySelector('[data-folder=project]')&&saved.document.querySelector('#local-observed').textContent.includes('Saved'),'An offline reload opens the saved root even when a deeper folder was last visited.');
reloaded.window.close();
offline=false;denied=true;await poll();
check(!w.localStorage.getItem('web-tools-files-snapshot')&&!w.localStorage.getItem('web-tools-files-root')&&!w.localStorage.getItem('web-tools-repositories-snapshot')&&!doc.querySelector('[data-folder=project]'),'An access denial discards saved private root, folder and repository observations.');
denied=false;await poll();click('[data-view=now]');
check(doc.querySelector('#repositories').hidden,'Leaving Files returns to the selected main view.');
check(requests.every(r=>!r.method||r.method==='GET'),'Browsing only issues read requests.');
console.log(`${checks} explorer routing, filtering, refresh and privacy checks passed.`);dom.window.close();
