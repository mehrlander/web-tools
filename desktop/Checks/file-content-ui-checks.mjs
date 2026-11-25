import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const at=new Date().toISOString(),encoder=new TextEncoder();
const flush=async()=>{for(let n=0;n<4;n++)await new Promise(resolve=>setImmediate(resolve));};
const fileRoute=(path,root='outputs')=>'#'+new URLSearchParams({view:'files',root,file:path});
const selectedRoot=doc=>doc.querySelector('[data-file-root][aria-selected="true"]')?.dataset.fileRoot;
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};

async function fixture(hash,{repositoryStatus=503}={}){
  const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/?private=discard'+hash,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,doc=w.document,requests=[],created=[],revoked=[],copied=[],timers=new Map(),historyWrites=[];
  const state={status:200,mime:'image/png',bytes:new Uint8Array([137,80,78,71]),length:null,hold:null,oversized:false,cancelled:0};
  let timerId=0;
  w.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;};w.clearTimeout=id=>timers.delete(id);
  w.scrollTo=()=>{};w.AbortController=AbortController;w.TextDecoder=TextDecoder;w.Blob=Blob;
  w.matchMedia=()=>({matches:false});
  for(const method of ['pushState','replaceState']){const original=w.history[method].bind(w.history);w.history[method]=(...args)=>{historyWrites.push({method,url:args[2]});return original(...args);};}
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)}});
  w.URL.createObjectURL=blob=>{const url='blob:https://fixture.example.ts.net/'+created.length;created.push({url,blob});return url;};
  w.URL.revokeObjectURL=url=>revoked.push(url);
  const entry=(name,kind='file')=>({name,kind,gitState:null,bytes:kind==='file'?4:null,modifiedAt:at,role:null});
  w.fetch=async(raw,options={})=>{
    const url=new URL(raw,w.location),method=options.method||'GET';requests.push({url,method,...options});
    if(url.pathname==='/api/v1/repositories')return {ok:repositoryStatus===200,status:repositoryStatus,headers:new Headers(),json:async()=>({schemaVersion:1,machineName:'Lenovo',observedAt:at,refreshing:[],repositories:[]})};
    if(url.pathname==='/api/v1/files'){
      const path=url.searchParams.get('path'),root=url.searchParams.get('root')||'gh';
      const entries=root==='downloads'?(path?[entry('photo.png')]:[entry('Photos','folder'),entry('existing.png')]):path==='run'?[entry('validation.png'),entry('<img onerror=x>.txt')]:[entry(root==='outputs'?'run':'project','folder')];
      return {ok:true,status:200,headers:new Headers(),json:async()=>({schemaVersion:1,path,rootName:root==='downloads'?'Downloads':root==='outputs'?'Assistant outputs':'gh',state:'ready',observedAt:at,partial:false,notice:null,entries})};
    }
    assert.equal(url.pathname,'/api/v1/files/content');
    const status=state.status,mime=state.mime,bytes=state.bytes,oversized=state.oversized;
    if(method==='GET'&&state.hold)await state.hold;
    const body=method==='HEAD'?null:new ReadableStream({
      start(controller){controller.enqueue(bytes);if(!oversized)controller.close();},
      cancel(){state.cancelled++;},
    });
    return {ok:status===200,status,headers:new Headers({'Content-Type':mime,'Content-Length':String(state.length??bytes.byteLength)}),body};
  };
  w.eval(read('../../lib/kits/title-tip.js'));w.eval(read('../phone/local-files.js'));w.eval(read('../phone/repositories.js'));
  w.eval(read('../../lib/kits/swipe-deck.js'));w.eval(read('../phone/views.js'));
  await flush();
  const click=selector=>{assert.ok(doc.querySelector(selector),selector);doc.querySelector(selector).click();};
  const settle=async()=>{for(let n=0;n<5;n++){for(const [id,timer] of [...timers])if(!timer.delay){timers.delete(id);timer.fn();}await flush();}};
  const route=async hash=>{w.history.replaceState(null,'',hash);w.dispatchEvent(new w.PopStateEvent('popstate'));await settle();};
  const poll=async()=>{w.dispatchEvent(new w.Event('online'));await flush();};
  const travel=async direction=>{w.history[direction]();await settle();};
  return {dom,w,doc,state,requests,created,revoked,copied,historyWrites,click,settle,route,travel,poll,close:()=>w.close()};
}

const first=await fixture(fileRoute('run/validation.png'));
try{
  const {w,doc,requests,created,revoked,copied,click,settle,state,poll}=first;
  check(doc.querySelector('#file-preview img')?.src===created[0].url,'A fresh outputs deep link previews the image without repository metadata.');
  check(requests.some(r=>r.method==='HEAD'&&r.url.searchParams.get('root')==='outputs')&&requests.some(r=>r.method==='GET'&&r.url.pathname.endsWith('/content')),'The preview checks protected metadata and fetches its actual bytes.');
  check(new URL(doc.querySelector('#file-download').href).searchParams.get('download')==='1','Download requests an attachment through the protected content API.');
  check(selectedRoot(doc)==='outputs'&&!doc.querySelector('#repository-back').hidden,'The selected location tab and Back reflect a direct file link.');
  const tabs=[...doc.querySelectorAll('[data-file-root]')],panel=doc.getElementById('file-location-panel');
  check(tabs.map(tab=>tab.dataset.fileRoot).join(',')==='downloads,gh,outputs'&&tabs.every(tab=>tab.getAttribute('role')==='tab'&&tab.getAttribute('aria-controls')==='file-location-panel')
    &&tabs.filter(tab=>tab.tabIndex===0).length===1&&doc.querySelector('[role=tablist]')?.getAttribute('aria-label')==='File locations'
    &&panel?.getAttribute('role')==='tabpanel'&&panel.getAttribute('aria-labelledby')===tabs.find(tab=>tab.getAttribute('aria-selected')==='true').id,
    'File previews retain three sibling location tabs and one labelled content panel with a single keyboard entry point.');
  click('[data-file-copy]');await flush();
  const copiedUrl=new URL(copied[0]),params=new URLSearchParams(copiedUrl.hash.slice(1));
  check(copiedUrl.search===''&&!copiedUrl.username&&!copiedUrl.password&&[...params.keys()].join(',')==='view,root,file'&&params.get('file')==='run/validation.png','Copy link retains only the view, named root and relative file, without incidental query data.');
  check(doc.querySelector('#file-status').textContent==='Link copied','Copy has an accessible completion status.');
  check(Object.keys(w.localStorage).every(key=>!w.localStorage.getItem(key).includes('data:image'))&&!w.localStorage.getItem('web-tools-files-snapshot'),'File bodies and preview URLs do not enter persistent browser storage.');
  const old=created[0].url;click('#repository-back');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='run'&&new URLSearchParams(w.location.hash.slice(1)).get('root')==='outputs'&&doc.querySelector('[data-file="run/validation.png"]'),'Back from a fresh file link opens its parent in the same named root.');
  check(revoked.includes(old)&&!doc.querySelector('#file-preview'),'Leaving a file revokes its image URL and removes its content.');
  w.NowViews.scrollTo(135,'files');click('[data-file="run/validation.png"]');await settle();
  doc.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await settle();
  check(w.NowViews.scrollPosition('files')===135&&new URLSearchParams(w.location.hash.slice(1)).get('folder')==='run','Escape restores the folder and its reading position.');
  click('[data-file-root="gh"]');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('root')==='gh'&&doc.querySelector('[data-folder="project"]'),'Selecting repository folders carries their explicit root and can list without repository status metadata.');
  click('[data-file-root="outputs"]');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='run'&&w.NowViews.scrollPosition('files')===135,'Returning to a location restores its last folder and reading position.');
  click('[data-file="run/validation.png"]');await settle();
  state.status=403;await poll();
  check(!doc.querySelector('#file-preview img')&&doc.querySelector('#file-actions').hidden&&doc.querySelector('#file-status').textContent==='Access unavailable'&&revoked.length===created.length,'An access denial clears the previous preview, revokes its URL and hides content actions.');
  state.status=200;click('[data-file-root="gh"]');await settle();click('[data-file-root="outputs"]');await settle();
  check(!new URLSearchParams(w.location.hash.slice(1)).has('file')&&!new URLSearchParams(w.location.hash.slice(1)).has('folder')&&doc.querySelector('[data-folder="run"]'),
    'A denied private file is not restored from location memory after switching away and back.');
  check(requests.filter(r=>r.url.pathname.endsWith('/content')).every(r=>r.cache==='no-store'&&['GET','HEAD'].includes(r.method)),'Content reads bypass HTTP cache and issue no writes.');
}finally{first.close();}

const text=await fixture('#view=files&root=outputs&folder=run');
try{
  text.state.mime='text/plain; charset=utf-8';text.state.bytes=encoder.encode('<script>unsafe()</script> & private text');
  text.click('[data-file="run/<img onerror=x>.txt"]');await text.settle();
  check(text.doc.querySelector('h2').textContent==='<img onerror=x>.txt'&&!text.doc.querySelector('#repositories [onerror]'),'Untrusted filenames remain text in the reader header.');
  check(text.doc.querySelector('#file-preview pre')?.textContent==='<script>unsafe()</script> & private text'&&!text.doc.querySelector('#file-preview script'),'Plain text is decoded into textContent rather than interpreted as markup.');
  check(Object.keys(text.w.localStorage).every(key=>!text.w.localStorage.getItem(key).includes('private text')),'Text preview contents stay out of persistent storage.');
  text.state.length=1;text.state.bytes=new Uint8Array(1024*1024+1);text.state.oversized=true;await text.poll();
  check(!text.doc.querySelector('#file-preview pre')&&!text.doc.querySelector('#file-actions').hidden&&text.state.cancelled===1,'A file that grows beyond the preview cap cancels its body stream and retains Download.');
  text.state.status=404;await text.poll();
  check(text.doc.querySelector('#file-status').textContent==='File not found'&&text.doc.querySelector('#file-actions').hidden,'A missing file cannot leave stale content or download controls visible.');
}finally{text.close();}

const binary=await fixture('#view=files&root=outputs&folder=run');
try{
  binary.state.mime='text/html';binary.state.bytes=encoder.encode('<script>unsafe()</script>');
  binary.click('[data-file="run/validation.png"]');await binary.settle();
  check(!binary.doc.querySelector('#file-actions').hidden&&!binary.doc.querySelector('#file-preview').childElementCount&&binary.requests.filter(r=>r.url.pathname.endsWith('/content')).every(r=>r.method==='HEAD'),'Active and unsupported formats get download actions without reading or rendering their bodies.');
}finally{binary.close();}

const race=await fixture('#view=files&root=outputs&folder=run');
try{
  let release;race.state.hold=new Promise(resolve=>release=resolve);
  race.click('[data-file="run/validation.png"]');await flush();
  race.click('[data-file-root="downloads"]');await race.settle();
  release();await race.settle();
  check(selectedRoot(race.doc)==='downloads'&&!race.doc.querySelector('#file-preview')&&race.created.length===0&&race.requests.some(r=>r.method==='GET'&&r.signal.aborted),'A late body response cannot leak its preview into another location tab.');
}finally{race.close();}

const downloads=await fixture('#view=files');
try{
  const {w,doc,requests,click,settle,copied}=downloads;
  check(selectedRoot(doc)==='downloads'&&doc.querySelector('[data-file-root="downloads"]').textContent.trim()==='Downloads'&&doc.querySelector('[data-file="existing.png"]'),'The Files entry opens existing Downloads files without repository metadata or publishing.');
  check(requests.some(r=>r.url.pathname==='/api/v1/files'&&r.url.searchParams.get('root')==='downloads'),'The Downloads listing uses its fixed named root.');
  w.NowViews.scrollTo(88,'files');click('[data-file="existing.png"]');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('root')==='downloads'&&doc.querySelector('#file-preview img'),'Opening an existing Downloads file retains the root and existing preview behavior.');
  click('[data-file-copy]');await flush();
  const copiedRoute=new URLSearchParams(new URL(copied[0]).hash.slice(1));
  check(copiedRoute.get('root')==='downloads'&&copiedRoute.get('file')==='existing.png','Copied Downloads links name the existing file directly.');
  click('#repository-back');await settle();
  check(selectedRoot(doc)==='downloads'&&w.NowViews.scrollPosition('files')===88,'Back restores the Downloads list and reading position.');
  click('[data-folder="Photos"]');await settle();click('[data-file="Photos/photo.png"]');await settle();
  click('[data-file-copy]');await flush();
  const fresh=await fixture(new URL(copied.at(-1)).hash);
  try{
    check(selectedRoot(fresh.doc)==='downloads'&&fresh.doc.querySelector('#file-preview img'),'A copied Downloads file link opens directly in a fresh context.');
    fresh.click('#repository-back');await fresh.settle();
    const parent=new URLSearchParams(fresh.w.location.hash.slice(1));
    check(parent.get('root')==='downloads'&&parent.get('folder')==='Photos'&&fresh.doc.querySelector('[data-file="Photos/photo.png"]'),'Back from a direct Downloads file opens its actual parent in Downloads.');
  }finally{fresh.close();}
  check(requests.every(r=>r.method==='GET'||r.method==='HEAD'),'Browsing existing Downloads files issues only reads.');
}finally{downloads.close();}

const locations=await fixture('#view=files');
try{
  const {w,doc,click,settle,route,travel,requests,historyWrites}=locations;
  Object.defineProperty(w,'innerWidth',{configurable:true,value:320});
  check([...doc.querySelectorAll('[data-file-root]')].map(tab=>tab.textContent.trim()).join('|')==='Downloads|Repositories|Outputs'
    &&doc.querySelector('[data-file-root="outputs"]').getAttribute('aria-label')==='Assistant outputs',
    'The three concise location labels retain the full Assistant outputs accessible name at a narrow viewport.');
  const initialHash=w.location.hash,initialCalls=requests.length;
  doc.querySelector('[data-file-root="downloads"]').focus();
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  check(doc.activeElement.dataset.fileRoot==='gh'&&selectedRoot(doc)==='downloads'&&w.location.hash===initialHash&&requests.length===initialCalls,
    'Arrow navigation moves tab focus without selecting a new location or issuing a file request.');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
  check(doc.activeElement.dataset.fileRoot==='outputs'&&selectedRoot(doc)==='downloads','End focuses the last location without activating it.');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
  check(doc.activeElement.dataset.fileRoot==='downloads','Home focuses the first location.');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  check(doc.activeElement.dataset.fileRoot==='outputs','Left Arrow wraps keyboard focus to the last location.');
  doc.activeElement.click();await settle();
  check(selectedRoot(doc)==='outputs'&&doc.activeElement.dataset.fileRoot==='outputs','Activating a keyboard-focused location preserves focus after the content shell changes.');
  const writes=historyWrites.length,calls=requests.length,hash=w.location.hash;
  click('[data-file-root="outputs"]');await settle();
  check(historyWrites.length===writes&&requests.length===calls&&w.location.hash===hash,'Selecting the active location does not reset its route, refresh, or duplicate browser history.');
  click('[data-file-root="downloads"]');await settle();click('[data-folder="Photos"]');await settle();
  w.NowViews.scrollTo(66,'files');click('[data-file="Photos/photo.png"]');await settle();w.NowViews.scrollTo(42,'files');
  click('[data-file-root="outputs"]');await settle();click('[data-folder="run"]');await settle();click('[data-file="run/validation.png"]');await settle();w.NowViews.scrollTo(92,'files');
  click('[data-file-root="downloads"]');await settle();
  check(selectedRoot(doc)==='downloads'&&new URLSearchParams(w.location.hash.slice(1)).get('file')==='Photos/photo.png'
    &&doc.querySelector('#file-preview img')&&w.NowViews.scrollPosition('files')===42,
    'Returning to a location restores its exact open file and reading position.');
  const returnedImage=doc.querySelector('#file-preview img');
  w.NowViews.scrollTo(0,'files');returnedImage.dispatchEvent(new w.Event('load'));
  const restoredAfterLayout=w.NowViews.scrollPosition('files')===42;
  w.NowViews.scrollTo(57,'files');returnedImage.dispatchEvent(new w.Event('load'));
  check(restoredAfterLayout&&w.NowViews.scrollPosition('files')===57,
    'An image load restores a saved position after placeholder clamping, and a repeated load never rewinds subsequent reading.');
  await travel('back');
  check(selectedRoot(doc)==='outputs'&&new URLSearchParams(w.location.hash.slice(1)).get('file')==='run/validation.png'&&w.NowViews.scrollPosition('files')===92,
    'Browser Back retraces a location switch and restores the prior file.');
  await travel('forward');
  check(selectedRoot(doc)==='downloads'&&new URLSearchParams(w.location.hash.slice(1)).get('file')==='Photos/photo.png','Browser Forward restores the next location and file.');
  await route(fileRoute('existing.png','downloads'));
  check(new URLSearchParams(w.location.hash.slice(1)).get('file')==='existing.png'&&doc.querySelector('#file-preview img'),
    'An explicit file deep link takes precedence over the location’s remembered file.');
  click('[data-file-root="gh"]');await settle();click('[data-folder="project"]');await settle();w.NowViews.scrollTo(118,'files');
  click('[data-file-root="outputs"]');await settle();click('[data-file-root="gh"]');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('folder')==='project'&&w.NowViews.scrollPosition('files')===118,
    'A location also remembers a folder and its reading position.');
  click('#repository-back');await settle();
  const parent=new URLSearchParams(w.location.hash.slice(1));
  check(parent.get('root')==='gh'&&!parent.has('file')&&!parent.has('folder')&&selectedRoot(doc)==='gh',
    'In-app parent Back stays in the selected root after restoring a folder from another location.');
  await travel('back');
  check(selectedRoot(doc)==='outputs'&&new URLSearchParams(w.location.hash.slice(1)).get('file')==='run/validation.png',
    'Browser Back remains distinct from parent navigation and can return to the preceding location.');
  await route('#view=files&root=outputs&folder=run');
  check(!new URLSearchParams(w.location.hash.slice(1)).has('file')&&doc.querySelector('[data-file="run/validation.png"]'),
    'An explicit folder route is not replaced by a remembered file preview.');
  click('[data-folder=""]');await settle();
  check(selectedRoot(doc)==='outputs'&&!new URLSearchParams(w.location.hash.slice(1)).has('folder')&&doc.querySelector('[data-folder="run"]'),
    'The root breadcrumb returns only to the top of its selected sibling location.');
}finally{locations.close();}

for(const hash of ['#view=files&folder=project','#view=files&checkout=legacy','#view=repositories']){
  const legacy=await fixture(hash);
  try{check(selectedRoot(legacy.doc)==='gh','Legacy repository and rootless folder/checkout routes retain the gh root.');}
  finally{legacy.close();}
}
const legacyFile=await fixture('#view=files&file=project%2FREADME.md');
try{
  check(selectedRoot(legacyFile.doc)==='gh'&&legacyFile.requests.some(r=>r.method==='HEAD'&&r.url.searchParams.get('root')==='gh'),'A previously copied rootless file link retains the repository root.');
  legacyFile.click('[data-file-copy]');await flush();
  check(new URLSearchParams(new URL(legacyFile.copied[0]).hash.slice(1)).get('root')==='gh','New copies of legacy repository file links make the root explicit.');
}finally{legacyFile.close();}

const hostileRoot='outputs" data-injected="yes';
const hostile=await fixture(fileRoute('validation.png',hostileRoot));
try{
  const panel=hostile.doc.getElementById('file-location-panel');
  check(panel?.getAttribute('aria-labelledby')==='file-location-'+hostileRoot&&!hostile.doc.querySelector('[data-injected]'),
    'A root from a copied URL remains an escaped label reference rather than introducing markup.');
}finally{hostile.close();}

console.log(`${checks} file preview, root routing, bounded read and privacy checks passed.`);
