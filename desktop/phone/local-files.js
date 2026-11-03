(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ago=value=>{const n=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return n<1?'just now':n<60?n+'m ago':n<1440?Math.floor(n/60)+'h ago':Math.floor(n/1440)+'d ago';};
  const stamp=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const size=(value,partial=false)=>{
    if(!Number.isFinite(value))return 'Not measured';
    if(value===0&&partial)return 'Partial';
    let n=value,unit=0;const units=['B','KB','MB','GB','TB'];while(n>=1000&&unit<4){n/=1000;unit++;}
    return (partial?'≥ ':'')+n.toLocaleString([],{maximumFractionDigits:n<10&&unit?1:0})+' '+units[unit];
  };
  const folder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-emerald-700" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/></svg>';
  const file='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-emerald-700" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5M8 12h8M8 16h6"/></svg>';
  const arrow='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" class="size-3 shrink-0" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>';
  let current='',filter='all',query='',inventory,live=false,signature='';
  function valid(value,key){
    return value==null||value.key===key&&['ready','unavailable'].includes(value.state)&&Number.isFinite(Date.parse(value.observedAt))
      &&Array.isArray(value.entries)&&value.entries.length<=256&&value.entries.every(e=>/^[a-f0-9]{24}$/.test(e.key)&&typeof e.path==='string'&&e.path.length<=512
        &&['folder','file'].includes(e.kind)&&['ignored','untracked'].includes(e.gitState)&&(e.bytes===null||Number.isFinite(e.bytes)&&e.bytes>=0)
        &&(e.files===null||Number.isInteger(e.files)&&e.files>=0)&&(e.modifiedAt===null||Number.isFinite(Date.parse(e.modifiedAt))));
  }
  function preview(checkout){
    const value=checkout.localFiles,entries=value?.entries||[];if(!value)return '';
    if(value?.state==='ready'&&!value.partial&&!entries.length)return '';
    const folders=entries.filter(e=>e.kind==='folder').slice(0,3);
    return `${folders.length?`<ul class="mt-1">${folders.map(e=>`<li class="flex min-h-6 items-center gap-1.5 text-xs">${folder}<span class="min-w-0 flex-1 break-all line-clamp-2" title="${escape(e.path)}">${escape(e.path)}</span><span class="shrink-0 text-[10px] text-stone-500">${e.gitState==='ignored'?'Ignored':'Untracked'}</span><span class="shrink-0 text-[11px] text-stone-500">${size(e.bytes,e.partial)}</span></li>`).join('')}</ul>`:''}<button data-files="${checkout.key}" class="flex min-h-8 w-full items-center justify-between gap-2 text-left text-xs text-emerald-800"><span>All local files</span><span class="ml-auto text-[11px] text-stone-500">${value.state!=='ready'?'Unavailable':entries.length.toLocaleString()+' entries'}</span>${arrow}</button>`;
  }
  function header(show,active=true){
    if(el('repository-back'))el('repository-back').hidden=!show;
    if(el('app-mark'))el('app-mark').hidden=show;
    if(active){el('view-title').textContent=show?'Local files':'Repositories';document.title=(show?'Local files':'Repositories')+' | Web Tools';}
  }
  function renderResults(){
    const target=el('local-results');if(!target)return;
    const entries=inventory?.entries||[],counts={all:entries.length,ignored:entries.filter(e=>e.gitState==='ignored').length,untracked:entries.filter(e=>e.gitState==='untracked').length};
    for(const button of document.querySelectorAll('[data-file-filter]')){const key=button.dataset.fileFilter;button.setAttribute('aria-pressed',String(key===filter));button.classList.toggle('bg-white',key===filter);button.classList.toggle('shadow-sm',key===filter);button.textContent=({all:'All',ignored:'Ignored',untracked:'Untracked'})[key]+' '+counts[key];}
    const shown=entries.filter(e=>(filter==='all'||e.gitState===filter)&&e.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const next=JSON.stringify([inventory,filter,query,live]);if(next===signature)return;signature=next;
    if(!inventory){target.innerHTML='<p class="px-3 py-3 text-sm text-stone-500">Reading local file metadata…</p>';return;}
    if(inventory.state!=='ready'){target.innerHTML='<p class="px-3 py-3 text-sm text-stone-500">Local file inventory unavailable.</p>';return;}
    const sections=['ignored','untracked'].map(state=>{
      const group=shown.filter(e=>e.gitState===state);if(!group.length)return '';
      const bytes=group.filter(e=>Number.isFinite(e.bytes)),total=bytes.reduce((n,e)=>n+e.bytes,0),partial=inventory.partial||group.some(e=>e.partial||e.bytes===null);
      return `<section><div class="flex items-center justify-between gap-2 border-y border-stone-200 bg-stone-100 px-3 py-1.5 text-[11px] text-stone-500"><h2>${state==='ignored'?'Ignored':'Untracked'} · ${group.length} ${group.length===1?'entry':'entries'}</h2><span>${bytes.length?size(total,partial):'Not measured'}</span></div>${group.map(e=>`<div class="flex items-center gap-2 border-b border-stone-100 bg-white px-3 py-2">${e.kind==='folder'?folder:file}<div class="min-w-0 flex-1"><p class="break-all text-[13px] font-medium">${escape(e.path)}${e.role?`<span class="ml-1 text-[10px] font-normal text-stone-500">${escape(e.role)}</span>`:''}</p><p class="mt-0.5 text-[11px] text-stone-500">${e.kind==='folder'?(e.files===null?'File count unavailable':(e.partial?'≥ ':'')+e.files.toLocaleString()+' '+(e.files===1?'file':'files')):''}${e.kind==='folder'&&e.modifiedAt?' · ':''}${e.modifiedAt?'Modified '+escape(ago(e.modifiedAt)):''}</p></div><span class="shrink-0 text-xs text-stone-600">${size(e.bytes,e.partial)}</span></div>`).join('')}</section>`;
    }).join('');
    target.innerHTML=sections||`<p class="px-3 py-3 text-sm text-stone-500">${query?'No matching entries.':filter!=='all'?'No '+filter+' entries in this scan.':inventory.partial?'No entries available in this incomplete scan.':'No ignored or untracked entries observed.'}</p>`;
  }
  function render(snapshot,key,isLive){
    header(true);live=isLive;
    const repo=snapshot.repositories.find(r=>r.checkouts.some(c=>c.key===key)),checkout=repo?.checkouts.find(c=>c.key===key);
    if(current!==key||!el('local-results')){
      if(current!==key){filter='all';query='';}current=key;signature='';
      el('repositories').innerHTML=`<div class="bg-white px-3 pb-2 pt-2"><h2 id="local-repo" class="text-sm font-semibold"></h2><p id="local-checkout" class="mt-0.5 break-all text-[11px] text-stone-500"></p><p id="local-observed" class="mt-1 text-[10px] text-stone-500"></p></div><div class="bg-white px-3 pb-2"><div class="flex rounded-lg bg-stone-200 p-0.5" role="group" aria-label="Local file type">${['all','ignored','untracked'].map(k=>`<button data-file-filter="${k}" aria-pressed="${filter===k}" class="min-h-8 flex-1 rounded-md px-2 text-xs">${k}</button>`).join('')}</div><input data-local-search aria-label="Find local files" type="search" placeholder="Find files or folders" class="mt-2 h-8 w-full rounded-md border border-stone-200 bg-stone-50 px-2 text-xs" value="${escape(query)}"></div><p id="local-notice" class="empty:hidden px-3 py-1.5 text-[11px] text-amber-800"></p><div id="local-results"></div><p class="px-3 pt-2 text-[10px] leading-4 text-stone-500">Names and metadata only · Sizes marked ≥ are partial.</p>`;
    }
    el('local-repo').textContent=repo?.name||'Checkout no longer observed';
    el('local-checkout').textContent=checkout?'Checkout · '+checkout.name+' · '+checkout.branch:'';
    inventory=checkout?.localFiles;
    el('local-observed').textContent=inventory?(isLive?'Inventory observed ':'Saved inventory · Observed ')+ago(inventory.observedAt):'Waiting for the laptop inventory';
    el('local-observed').title=inventory?stamp(inventory.observedAt):'';
    el('local-notice').textContent=inventory?.notice||'';
    if(!checkout){el('local-results').innerHTML='<p class="px-3 py-3 text-sm text-stone-500">Return to Repositories to choose an observed checkout.</p>';return;}
    renderResults();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-file-filter]');if(!button||!el('local-results'))return;
    filter=button.dataset.fileFilter;renderResults();
  });
  document.addEventListener('input',event=>{if(event.target.matches('[data-local-search]')){query=event.target.value;renderResults();}});
  window.NowLocalFiles={valid,preview,render,header};
})();
