(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ago=value=>{const n=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return n<1?'just now':n<60?n+'m ago':n<1440?Math.floor(n/60)+'h ago':Math.floor(n/1440)+'d ago';};
  const size=value=>{if(!Number.isFinite(value))return '';let n=value,i=0;const units=['B','KB','MB','GB','TB'];while(n>=1000&&i<4){n/=1000;i++;}return n.toLocaleString([],{maximumFractionDigits:n<10&&i?1:0})+' '+units[i];};
  const folder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-emerald-700" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/></svg>';
  const file='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-stone-500" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5"/></svg>';
  const arrow='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" class="size-3 shrink-0 text-stone-500" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>';
  let current=null,filter='all',query='',listing,snapshot,live=false,active=false,timer,controller,failed=false,denied=false,signature='';
  const cache=new Map();
  function valid(value,key){
    return value==null||value.key===key&&['ready','unavailable'].includes(value.state)&&Number.isFinite(Date.parse(value.observedAt))
      &&Array.isArray(value.entries)&&value.entries.length<=256&&value.entries.every(e=>/^[a-f0-9]{24}$/.test(e.key)&&typeof e.path==='string'&&e.path.length<=512
        &&['folder','file'].includes(e.kind)&&['ignored','untracked'].includes(e.gitState)&&(e.bytes===null||Number.isFinite(e.bytes)&&e.bytes>=0)
        &&(e.files===null||Number.isInteger(e.files)&&e.files>=0)&&(e.modifiedAt===null||Number.isFinite(Date.parse(e.modifiedAt))));
  }
  function validListing(value,path){
    return value?.schemaVersion===1&&value.path===path&&typeof value.rootName==='string'&&value.state==='ready'
      &&Number.isFinite(Date.parse(value.observedAt))&&Array.isArray(value.entries)&&value.entries.length<=2000
      &&value.entries.every(e=>typeof e.name==='string'&&e.name.length>0&&!/[\\/]/.test(e.name)&&e.name!=='.'&&e.name!=='..'&&e.name.toLowerCase()!=='.git'
        &&['folder','file'].includes(e.kind)&&[null,'tracked','ignored','untracked'].includes(e.gitState)
        &&(e.bytes===null||Number.isFinite(e.bytes)&&e.bytes>=0));
  }
  function header(show,enabled=true){
    if(el('repository-back')){el('repository-back').hidden=!show;el('repository-back').setAttribute('aria-label','Back');}
    if(el('app-mark'))el('app-mark').hidden=show;
    if(enabled){el('view-title').textContent='Files';document.title='Files | Web Tools';}
  }
  const checkouts=()=>snapshot?.repositories.flatMap(r=>r.checkouts)||[];
  function branchLine(checkout){
    if(!checkout)return '';
    const name=checkout.branch==='(detached)'?checkout.branchStatus?.state==='snapshot'?(checkout.main?.branch||'Default branch')+' snapshot':'Detached commit':checkout.branch||'Branch unavailable';
    return `<div class="flex min-w-0 items-center gap-x-2 pl-6 pr-3 text-xs leading-5 text-stone-600"><span class="flex min-w-0 flex-1 items-start gap-1">${window.NowRepositories.branchControl(checkout)}<span data-file-branch="${checkout.key}" tabindex="0" data-title-tip="${escape(name)}" data-title-tip-bare class="min-w-0 truncate">${escape(name)}</span></span>${window.NowRepositories.comparison(checkout.tracked,checkout.key+':files')}</div>`;
  }
  function localInventory(){
    if(!current||!['ignored','untracked'].includes(filter))return;
    const checkout=checkouts().find(c=>c.name===current.split('/')[0]),value=checkout?.localFiles;
    if(value?.state!=='ready')return;
    const prefix=current.slice(checkout.name.length).replace(/^\//,'');
    const entries=value.entries.filter(e=>e.gitState===filter).map(e=>({...e,path:e.path.replace(/\/$/,'')}))
      .filter(e=>!prefix||e.path.startsWith(prefix+'/'))
      .map(e=>({...e,name:prefix?e.path.slice(prefix.length+1):e.path}));
    return entries.length?{...value,entries}:undefined;
  }
  function results(){
    if(!active||!el('local-results'))return;
    const viewport={x:scrollX,y:scrollY},focus=document.activeElement,key=focus?.dataset.folder,commit=focus?.dataset.commit,branchFocus=focus?.dataset.fileBranch,toolFocus=focus?.dataset.focus,tip=document.querySelector('[data-commit][aria-describedby="wt-title-tip"]')?.dataset.commit,branchTip=document.querySelector('[data-file-branch][aria-describedby="wt-title-tip"]')?.dataset.fileBranch;
    const inventory=denied?undefined:localInventory(),source=denied?undefined:inventory||listing,items=source?.entries||[],shown=items.filter(e=>(filter==='all'||e.gitState===filter)&&e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const filters=el('file-filters');filters.hidden=!current||!items.some(e=>e.gitState);
    for(const button of filters.querySelectorAll('button')){const selected=button.dataset.fileFilter===filter;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('bg-white',selected);button.classList.toggle('shadow-sm',selected);}
    const fresh=live&&!failed&&source&&Date.now()-Date.parse(source.observedAt)<(inventory?180000:45000);
    el('local-observed').textContent=denied?'Access unavailable':source?(fresh?'':'Saved · ')+ago(source.observedAt)+' · '+(source.partial?'≥ ':'')+items.length+' '+(items.length===1?'item':'items'):failed?'Folder unavailable':'Reading folder…';
    el('local-notice').textContent=source?.notice||'';
    const root=listing?.rootName||'gh',parts=current?current.split('/'):[];
    el('local-breadcrumb').innerHTML=`<button data-folder="" class="min-h-9 shrink-0 font-medium text-emerald-800" ${!parts.length?'aria-current="location"':''}>${folder}<span>${escape(root)}</span></button>`+parts.map((p,i)=>`<span aria-hidden="true" class="text-stone-400">/</span><button data-folder="${escape(parts.slice(0,i+1).join('/'))}" ${i===parts.length-1?'aria-current="location"':''} class="min-h-9 min-w-0 break-all text-left ${i===parts.length-1?'font-medium text-stone-800':'text-emerald-800'}">${escape(p)}</button>`).join('');
    el('local-context').innerHTML=branchLine(checkouts().find(c=>c.name===current));
    el('folder-actions').innerHTML=current?window.NowRepositories.tools(checkouts().find(c=>c.name===current.split('/')[0])):window.NowRepositories.rootTools();
    const next=JSON.stringify([source,filter,query,failed,denied,window.NowRepositories.version()]);
    if(next!==signature){
      signature=next;
      el('local-results').innerHTML=!source?`<p class="px-3 py-3 text-sm text-stone-500">${denied?'Folder access unavailable.':failed?'Could not read this folder.':'Reading files and folders…'}</p>`:shown.map(e=>{
        const path=(current?current+'/':'')+e.name,checkout=!current?checkouts().find(c=>c.name===e.name):null;
        const badge=e.gitState&&filter==='all'?`<span class="shrink-0 rounded px-1 text-[10px] ${e.gitState==='ignored'?'bg-stone-100 text-stone-600':e.gitState==='untracked'?'bg-amber-50 text-amber-800':'text-stone-500'}">${({tracked:'Tracked',ignored:'Ignored',untracked:'Untracked'})[e.gitState]}</span>`:'';
        const parent=inventory&&e.name.includes('/')?e.name.slice(0,e.name.lastIndexOf('/')):'',name=parent?e.name.slice(parent.length+1):e.name;
        const parentLine=parent?`<span class="block break-all text-[11px] font-normal leading-4 text-stone-600">${escape(parent)}</span>`:'';
        const measurement=inventory&&e.kind==='folder'?`<span class="block text-[11px] font-normal text-stone-500">${e.files===null?'':(e.partial?'≥ ':'')+e.files+' '+(e.files===1?'file':'files')+' · '}${e.partial&&Number.isFinite(e.bytes)?'≥ ':''}${size(e.bytes)||'Size unavailable'}</span>`:'';
        const content=`${e.kind==='folder'?folder:file}<span class="min-w-0 flex-1 break-all text-sm ${e.kind==='folder'?'font-medium':''}">${escape(name)}${parentLine}${measurement}</span>${badge}${e.role?`<span class="shrink-0 text-[10px] text-stone-500">${escape(e.role)}</span>`:''}${e.kind==='folder'?(checkout?'':arrow):`<span class="shrink-0 text-[11px] text-stone-500">${size(e.bytes)}</span>`}`;
        return `<div ${checkout?`data-checkout="${checkout.key}"`:''} class="border-b border-stone-100 bg-white pl-3 ${checkout?'pb-1':'pr-3'}"><div class="flex min-w-0 items-center">${e.kind==='folder'?`<button data-folder="${escape(path)}" class="flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1 text-left active:bg-stone-50" aria-label="Open folder ${escape(e.name)}">${content}</button>`:`<div class="flex min-h-9 min-w-0 flex-1 items-center gap-2 py-1">${content}</div>`}${window.NowRepositories.tools(checkout)}</div>${branchLine(checkout)}</div>`;
      }).join('')||`<p class="px-3 py-3 text-sm text-stone-500">${query?'No matching names in this folder.':filter!=='all'?'No '+filter+' entries in this folder.':'No visible files or folders.'}</p>`;
    }
    if(key!==undefined)[...document.querySelectorAll('[data-folder]')].find(n=>n.dataset.folder===key)?.focus({preventScroll:true});
    if(commit)[...document.querySelectorAll('[data-commit]')].find(n=>n.dataset.commit===commit)?.focus({preventScroll:true});
    if(branchFocus)[...document.querySelectorAll('[data-file-branch]')].find(n=>n.dataset.fileBranch===branchFocus)?.focus({preventScroll:true});
    if(toolFocus)[...document.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===toolFocus&&!n.disabled)?.focus({preventScroll:true});
    if(tip){const target=[...document.querySelectorAll('[data-commit]')].find(n=>n.dataset.commit===tip);if(target)window.TitleTip?.open(target);else window.TitleTip?.close();}
    if(branchTip){const target=[...document.querySelectorAll('[data-file-branch]')].find(n=>n.dataset.fileBranch===branchTip);if(target)window.TitleTip?.open(target);else window.TitleTip?.close();}
    if(scrollX!==viewport.x||scrollY!==viewport.y)scrollTo(viewport.x,viewport.y);
    window.NowRepositories.positionPanels();requestAnimationFrame(()=>window.NowRepositories.positionPanels());
  }
  async function poll(){
    clearTimeout(timer);if(!active||document.hidden||controller)return;
    const path=current,request=new AbortController();controller=request;const timeout=setTimeout(()=>request.abort(),13000);
    try{
      const response=await fetch('/api/v1/files?path='+encodeURIComponent(path),{cache:'no-store',signal:request.signal});
      if(!active||current!==path||controller!==request)return;
      if(response.status===403){cache.clear();listing=undefined;denied=true;localStorage.removeItem('web-tools-files-snapshot');localStorage.removeItem('web-tools-files-root');}
      if(!response.ok)throw new Error();
      const value=await response.json();if(!validListing(value,path))throw new Error();
      if(!active||current!==path||controller!==request)return;
      listing=value;denied=false;failed=false;
      if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(path,value);
      try{localStorage.setItem('web-tools-files-snapshot',JSON.stringify(value));if(!path)localStorage.setItem('web-tools-files-root',JSON.stringify(value));}catch{}
    }catch{if(active&&current===path&&controller===request)failed=true;}
    finally{clearTimeout(timeout);if(controller===request){controller=null;if(active&&current===path){results();timer=setTimeout(poll,failed?15000:10000);}}}
  }
  function render(value,path,isLive){
    snapshot=value;live=isLive;header(Boolean(path));
    if(current!==path||!el('local-results')){
      stop();active=true;current=path;filter='all';query='';signature='';failed=false;denied=false;listing=cache.get(path);
      el('repositories').innerHTML=`<div class="border-b border-stone-200 bg-white px-3 pb-2"><div class="flex min-w-0 items-start"><nav id="local-breadcrumb" aria-label="Folder path" class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-xs [&>button]:inline-flex [&>button]:items-center [&>button]:gap-1.5"></nav><div id="folder-actions" class="-mr-3 shrink-0"></div></div><div id="local-context"></div><div class="flex items-center gap-2"><input data-local-search aria-label="Find in this folder" type="search" placeholder="Find in this folder" class="h-8 min-w-0 flex-1 rounded-md border border-stone-200 bg-stone-50 px-2 text-base"><span id="local-observed" class="shrink-0 text-[10px] text-stone-500"></span></div><div id="file-filters" hidden class="mt-1.5 flex rounded-lg bg-stone-200 p-0.5" role="group" aria-label="Git file status">${['all','tracked','untracked','ignored'].map(k=>`<button data-file-filter="${k}" aria-pressed="${k===filter}" class="min-h-7 flex-1 rounded-md px-1.5 text-xs">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div><p id="local-notice" class="empty:hidden pt-1 text-[11px] text-amber-800"></p></div><div id="local-results"></div>`;
      results();poll();
    }else {active=true;results();if(!timer&&!controller)poll();}
  }
  function stop(clear=false){
    active=false;clearTimeout(timer);timer=undefined;controller?.abort();controller=null;
    if(clear){cache.clear();listing=undefined;localStorage.removeItem('web-tools-files-snapshot');localStorage.removeItem('web-tools-files-root');}
  }
  function setFilter(value){if(active&&['all','tracked','untracked','ignored'].includes(value)&&filter!==value){filter=value;results();}}
  document.addEventListener('click',event=>{const button=event.target.closest('[data-file-filter]');if(active&&button){const params=new URLSearchParams(location.hash.slice(1));if(button.dataset.fileFilter==='all')params.delete('filter');else params.set('filter',button.dataset.fileFilter);history.replaceState(history.state,'','#'+params);setFilter(button.dataset.fileFilter);}});
  document.addEventListener('input',event=>{if(active&&event.target.matches('[data-local-search]')){query=event.target.value;results();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();else clearTimeout(timer);});
  window.addEventListener('online',poll);
  for(const key of ['web-tools-files-root','web-tools-files-snapshot'])try{const prior=JSON.parse(localStorage.getItem(key));if(validListing(prior,key==='web-tools-files-root'?'':prior?.path))cache.set(prior.path,prior);}catch{}
  window.NowLocalFiles={valid,render,header,stop,setFilter,filter:()=>filter,refresh:()=>{signature='';results();}};
})();
