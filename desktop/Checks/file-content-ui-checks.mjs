import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const at=new Date().toISOString(),encoder=new TextEncoder();
const flush=async()=>{for(let n=0;n<4;n++)await new Promise(resolve=>setImmediate(resolve));};
const fileRoute=(path,root='outputs')=>'#'+new URLSearchParams({view:'files',root,file:path});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};

async function fixture(hash,{repositoryStatus=503}={}){
  const dom=new JSDOM(read('../phone/index.html'),{url:'https://fixture.example.ts.net/?private=discard'+hash,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,doc=w.document,requests=[],created=[],revoked=[],copied=[],timers=new Map();
  const state={status:200,mime:'image/png',bytes:new Uint8Array([137,80,78,71]),length:null,hold:null,oversized:false,cancelled:0};
  let timerId=0;
  w.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;};w.clearTimeout=id=>timers.delete(id);
  w.scrollTo=()=>{};w.AbortController=AbortController;w.TextDecoder=TextDecoder;w.Blob=Blob;
  w.matchMedia=()=>({matches:false});
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)}});
  w.URL.createObjectURL=blob=>{const url='blob:https://fixture.example.ts.net/'+created.length;created.push({url,blob});return url;};
  w.URL.revokeObjectURL=url=>revoked.push(url);
  const entry=(name,kind='file')=>({name,kind,gitState:null,bytes:kind==='file'?4:null,modifiedAt:at,role:null});
  w.fetch=async(raw,options={})=>{
    const url=new URL(raw,w.location),method=options.method||'GET';requests.push({url,method,...options});
    if(url.pathname==='/api/v1/repositories')return {ok:repositoryStatus===200,status:repositoryStatus,headers:new Headers(),json:async()=>({schemaVersion:1,machineName:'Laptop',observedAt:at,refreshing:[],repositories:[]})};
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
  return {dom,w,doc,state,requests,created,revoked,copied,click,settle,route,poll,close:()=>w.close()};
}

const first=await fixture(fileRoute('run/validation.png'));
try{
  const {w,doc,requests,created,revoked,copied,click,settle,state,poll}=first;
  check(doc.querySelector('#file-preview img')?.src===created[0].url,'A fresh outputs deep link previews the image without repository metadata.');
  check(requests.some(r=>r.method==='HEAD'&&r.url.searchParams.get('root')==='outputs')&&requests.some(r=>r.method==='GET'&&r.url.pathname.endsWith('/content')),'The preview checks protected metadata and fetches its actual bytes.');
  check(new URL(doc.querySelector('#file-download').href).searchParams.get('download')==='1','Download requests an attachment through the protected content API.');
  check(doc.querySelector('[data-file-root]').value==='outputs'&&!doc.querySelector('#repository-back').hidden,'The root picker and Back reflect a direct file link.');
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
  const picker=doc.querySelector('[data-file-root]');picker.value='gh';picker.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('root')==='gh'&&doc.querySelector('[data-folder="project"]'),'Selecting repository folders carries their explicit root and can list without repository status metadata.');
  const nextPicker=doc.querySelector('[data-file-root]');nextPicker.value='outputs';nextPicker.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();
  click('[data-folder="run"]');await settle();click('[data-file="run/validation.png"]');await settle();
  state.status=403;await poll();
  check(!doc.querySelector('#file-preview img')&&doc.querySelector('#file-actions').hidden&&doc.querySelector('#file-status').textContent==='Access unavailable'&&revoked.length===created.length,'An access denial clears the previous preview, revokes its URL and hides content actions.');
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
  await race.route('#view=files&root=outputs&folder=run');
  release();await race.settle();
  check(!race.doc.querySelector('#file-preview')&&race.created.length===0&&race.requests.some(r=>r.method==='GET'&&r.signal.aborted),'A late body response cannot reopen a file after navigation.');
}finally{race.close();}

const downloads=await fixture('#view=files');
try{
  const {w,doc,requests,click,settle,copied}=downloads;
  check(doc.querySelector('[data-file-root]').value==='downloads'&&doc.querySelector('[data-file-root] option').value==='downloads'&&doc.querySelector('[data-file="existing.png"]'),'The Files entry opens existing Downloads files without repository metadata or publishing.');
  check(requests.some(r=>r.url.pathname==='/api/v1/files'&&r.url.searchParams.get('root')==='downloads'),'The Downloads listing uses its fixed named root.');
  w.NowViews.scrollTo(88,'files');click('[data-file="existing.png"]');await settle();
  check(new URLSearchParams(w.location.hash.slice(1)).get('root')==='downloads'&&doc.querySelector('#file-preview img'),'Opening an existing Downloads file retains the root and existing preview behavior.');
  click('[data-file-copy]');await flush();
  const copiedRoute=new URLSearchParams(new URL(copied[0]).hash.slice(1));
  check(copiedRoute.get('root')==='downloads'&&copiedRoute.get('file')==='existing.png','Copied Downloads links name the existing file directly.');
  click('#repository-back');await settle();
  check(doc.querySelector('[data-file-root]').value==='downloads'&&w.NowViews.scrollPosition('files')===88,'Back restores the Downloads list and reading position.');
  click('[data-folder="Photos"]');await settle();click('[data-file="Photos/photo.png"]');await settle();
  click('[data-file-copy]');await flush();
  const fresh=await fixture(new URL(copied.at(-1)).hash);
  try{
    check(fresh.doc.querySelector('[data-file-root]').value==='downloads'&&fresh.doc.querySelector('#file-preview img'),'A copied Downloads file link opens directly in a fresh context.');
    fresh.click('#repository-back');await fresh.settle();
    const parent=new URLSearchParams(fresh.w.location.hash.slice(1));
    check(parent.get('root')==='downloads'&&parent.get('folder')==='Photos'&&fresh.doc.querySelector('[data-file="Photos/photo.png"]'),'Back from a direct Downloads file opens its actual parent in Downloads.');
  }finally{fresh.close();}
  check(requests.every(r=>r.method==='GET'||r.method==='HEAD'),'Browsing existing Downloads files issues only reads.');
}finally{downloads.close();}

for(const hash of ['#view=files&folder=project','#view=files&checkout=legacy','#view=repositories']){
  const legacy=await fixture(hash);
  try{check(legacy.doc.querySelector('[data-file-root]').value==='gh','Legacy repository and rootless folder/checkout routes retain the gh root.');}
  finally{legacy.close();}
}
const legacyFile=await fixture('#view=files&file=project%2FREADME.md');
try{
  check(legacyFile.doc.querySelector('[data-file-root]').value==='gh'&&legacyFile.requests.some(r=>r.method==='HEAD'&&r.url.searchParams.get('root')==='gh'),'A previously copied rootless file link retains the repository root.');
  legacyFile.click('[data-file-copy]');await flush();
  check(new URLSearchParams(new URL(legacyFile.copied[0]).hash.slice(1)).get('root')==='gh','New copies of legacy repository file links make the root explicit.');
}finally{legacyFile.close();}

console.log(`${checks} file preview, root routing, bounded read and privacy checks passed.`);
