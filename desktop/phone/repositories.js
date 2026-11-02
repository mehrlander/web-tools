(() => {
  'use strict';
  const el=id=>document.getElementById(id), expanded=new Set();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const ago=value=>{const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':Math.floor(minutes/1440)+'d ago';};
  const valid=value=>value?.schemaVersion===1 && Number.isFinite(Date.parse(value.observedAt)) && Array.isArray(value.repositories) && value.repositories.length<=256
    && Array.isArray(value.refreshing) && value.repositories.every(r=>/^[a-f0-9]{24}$/.test(r.key) && typeof r.name==='string' && Array.isArray(r.checkouts) && r.checkouts.length<=256 && r.checkouts.every(c=>/^[a-f0-9]{24}$/.test(c.key)&&typeof c.name==='string'&&typeof c.branch==='string'&&c.main&&c.tracked));
  let data,active=false,connected=false,pending=false,timer,staleTimer,etag='',failed=false,denied=false,message='',sending='';
  const fresh=()=>connected&&navigator.onLine!==false&&data&&Date.now()-Date.parse(data.observedAt)<45000;
  const url=repo=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.url||'')?repo.url:null;
  function connection(){
    if(!active)return;
    el('connection').textContent=denied?'Access unavailable':fresh()?'Laptop live':data?'Last seen':failed?'Offline':'Connecting…';
    el('connection').title=data?'Local checkouts observed '+stamp(data.observedAt):'Reading local checkouts';
  }
  function comparison(value){
    if(Number.isInteger(value?.ahead)&&Number.isInteger(value?.behind))return value.ahead||value.behind?`${value.ahead?`<span class="text-amber-800">↑ ${value.ahead.toLocaleString()}</span>`:''}${value.ahead&&value.behind?' · ':''}${value.behind?`<span class="text-sky-800">↓ ${value.behind.toLocaleString()}</span>`:''}`:'<span class="text-emerald-800">In sync</span>';
    return `<span class="text-stone-500">${escape(({'not-checked':'Not checked','no-upstream':'No tracked branch','remote-missing':'Branch absent on GitHub','fetch-needed':'Fetch needed','incomplete-history':'Shallow history','unrelated-history':'Unrelated history'})[value?.state]||'Unavailable')}</span>`;
  }
  function status(repo){
    const checks=repo.checkouts,tracked=checks.map(c=>c.tracked);
    if(!url(repo))return ['Local repository','text-stone-500 bg-stone-100'];
    if(checks.some(c=>c.conflicts>0))return ['Conflicts','text-red-800 bg-red-50'];
    if(tracked.some(c=>c.state==='diverged'))return ['Diverged','text-amber-800 bg-amber-50'];
    if(checks.some(c=>c.changed>0||c.untracked>0))return ['Local changes','text-amber-800 bg-amber-50'];
    if(tracked.some(c=>c.state==='ahead'))return ['Ahead','text-amber-800 bg-amber-50'];
    if(tracked.some(c=>c.state==='behind'))return ['Behind','text-sky-800 bg-sky-50'];
    if(!repo.checkedAt)return ['Not checked','text-stone-500 bg-stone-100'];
    if(repo.notice||Date.now()-Date.parse(repo.checkedAt)>600000)return ['Last comparison','text-stone-500 bg-stone-100'];
    if(tracked.every(c=>c.state==='current'))return ['Branch synced','text-emerald-800 bg-emerald-50'];
    return ['Review','text-stone-500 bg-stone-100'];
  }
  const external='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
  function row(repo){
    const [label,tone]=status(repo),href=url(repo),busy=!!sending||fresh()&&data.refreshing.includes(repo.key);
    const main=repo.checkouts.find(c=>c.branch===c.main.branch)||repo.checkouts[0];
    const summary=repo.checkouts.length===1?`<span class="truncate">${escape(main.main.branch||'GitHub')}</span><span class="shrink-0">${comparison(main.main)}</span>`:`<span>${repo.checkouts.length} checkouts</span><span class="truncate">${repo.checkouts.filter(c=>c.main.behind>0).length} behind ${escape(main.main.branch||'main')}</span>`;
    const details=repo.checkouts.map(c=>{
      const same=c.tracked.branch&&c.tracked.branch===c.main.branch;
      const changes=c.changed===null?'Local status unavailable':[c.changed?c.changed+' changed':'',c.untracked?c.untracked+' untracked':'',c.conflicts?c.conflicts+' conflicts':''].filter(Boolean).join(' · ')||'No uncommitted changes';
      return `<li class="border-t border-stone-100 py-2"><div class="flex items-start justify-between gap-2"><span class="min-w-0"><span class="block break-words text-xs font-medium">Checkout · ${escape(c.name)}</span><span class="block break-all text-[11px] text-stone-500">${escape(c.branch==='(detached)'?'Detached checkout':c.branch||'Branch unavailable')}</span></span></div><p class="mt-1 text-[11px] ${c.changed||c.untracked?'text-amber-800':'text-stone-500'}">${escape(changes)}</p><dl class="mt-1 space-y-0.5 text-[11px]"><div class="flex justify-between gap-2"><dt class="min-w-0 break-all text-stone-500">${same?'Tracked + ':''}${c.main.branch?escape(c.main.branch):'GitHub default branch'}</dt><dd class="shrink-0">${comparison(c.main)}</dd></div>${same?'':`<div class="flex justify-between gap-2"><dt class="min-w-0 break-all text-stone-500">${escape(c.upstream||'Tracked branch')}</dt><dd class="shrink-0">${comparison(c.tracked)}</dd></div>`}</dl></li>`;
    }).join('');
    return `<article class="border-b border-stone-100 bg-white"><div class="flex items-stretch"><button data-repo="${repo.key}" aria-expanded="${expanded.has(repo.key)}" aria-controls="repo-${repo.key}" class="min-h-14 min-w-0 flex-1 px-3 py-2 text-left active:bg-stone-50"><span class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="break-words text-sm font-medium">${escape(repo.name.replace(/^[^/]+\//,''))}</span><span class="rounded px-1 text-[10px] ${tone}">${label}</span></span><span class="mt-1 flex gap-2 text-[11px] text-stone-500">${summary}<span class="ml-auto shrink-0 text-[10px]" title="${repo.checkedAt?escape(stamp(repo.checkedAt)):'Not checked'}">${repo.checkedAt?'GitHub '+escape(ago(repo.checkedAt)):'Unchecked'}</span></span></button><button data-fetch="${repo.key}" aria-label="Fetch GitHub for ${escape(repo.name)}" ${fresh()&&href&&!busy?'':'disabled'} class="min-h-11 min-w-11 shrink-0 px-2 text-xs text-sky-800 disabled:text-stone-400">${busy?'Fetching…':'Fetch'}</button>${href?`<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escape(repo.name)} on GitHub" class="flex min-h-11 w-11 shrink-0 items-center justify-center text-stone-500">${external}</a>`:''}</div><div id="repo-${repo.key}" ${expanded.has(repo.key)?'':'hidden'} class="px-3 pb-2">${repo.notice?`<p class="pb-1 text-[11px] text-amber-800">${escape(repo.notice)}</p>`:''}<ul>${details}</ul>${repo.checkouts.some(c=>c.main.branch&&c.branch!==c.main.branch)?'<p class="mt-1 text-[11px] text-stone-500">Feature branches can differ from the default branch. Squash merges can retain different commit IDs.</p>':''}</div></article>`;
  }
  function render(){
    if(!active)return;
    const viewport={x:scrollX,y:scrollY},focus=document.activeElement,action=focus?.dataset.repo?'repo':focus?.dataset.fetch?'fetch':null,key=action&&focus.dataset[action];
    if(!data){el('repositories').innerHTML=`<p class="px-3 py-4 text-sm text-stone-500">${denied?'Access unavailable. Connect with your Tailscale account.':failed?'Repository readings unavailable. Waiting for the laptop.':'Reading local checkouts…'}</p>`;connection();return;}
    el('machine').textContent=data.machineName;
    const count=data.repositories.reduce((sum,r)=>sum+r.checkouts.length,0),busy=fresh()&&data.refreshing.length>0||sending;
    el('repositories').innerHTML=`<div class="px-3 py-2"><div class="flex items-center justify-between gap-2"><p class="text-xs text-stone-600">${data.repositories.length} repos · ${count} checkouts</p><button data-fetch="all" ${fresh()&&!busy&&data.repositories.some(r=>url(r))?'':'disabled'} class="min-h-11 text-xs font-medium text-sky-800 disabled:text-stone-400">${busy?'Fetching '+data.refreshing.length+'…':'Fetch GitHub'}</button></div><p class="text-[11px] leading-4 text-stone-500">Fetch refreshes GitHub data; working branches and files stay unchanged.</p><p class="mt-0.5 text-[11px] text-stone-500">↑ Local-only · ↓ GitHub-only commits, versus the named branch.</p>${!fresh()?'<p class="mt-1 text-xs text-amber-800">Saved observation · Fetch unavailable while offline.</p>':''}${data.notice?`<p class="mt-1 text-xs text-amber-800">${escape(data.notice)}</p>`:''}<p role="status" class="empty:hidden mt-1 text-[11px] text-sky-800">${escape(message)}</p></div>${data.repositories.map(row).join('')}${!count?'<p class="px-3 py-3 text-sm text-stone-500">No local checkouts observed.</p>':''}`;
    if(action)[...el('repositories').querySelectorAll(`[data-${action}]`)].find(n=>n.dataset[action]===key&&!n.disabled)?.focus({preventScroll:true});
    if(scrollX!==viewport.x||scrollY!==viewport.y)scrollTo(viewport.x,viewport.y);
    connection();clearTimeout(staleTimer);if(fresh())staleTimer=setTimeout(render,Math.max(1,45000-(Date.now()-Date.parse(data.observedAt))));
  }
  async function poll(){
    clearTimeout(timer);if(!active||pending||document.hidden)return;pending=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
    try{
      const response=await fetch('/api/v1/repositories',{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
      denied=response.status===403;if(denied){data=undefined;etag='';localStorage.removeItem('web-tools-repositories-snapshot');}
      if(response.status!==304){if(!response.ok)throw new Error();const value=await response.json();if(!valid(value))throw new Error();data=value;etag=response.headers.get('ETag')||'';try{localStorage.setItem('web-tools-repositories-snapshot',JSON.stringify(data));}catch{}}
      connected=true;failed=false;
    }catch{connected=false;failed=true;}
    finally{clearTimeout(timeout);pending=false;render();if(active&&!document.hidden)timer=setTimeout(poll,failed?15000:3000);}
  }
  async function fetchRepo(key){
    if(!fresh()||sending||document.hidden)return;sending=key;message='';render();
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
    try{const response=await fetch('/api/v1/repositories/'+key+'/fetch',{method:'POST',headers:{'X-WebTools-Action':'1'},cache:'no-store',signal:controller.signal});message=response.status===202?'Fetch queued. Working files and branches stay as they are.':response.status===409?'Already fetching.':'Fetch unavailable.';
      if(response.status===403){data=undefined;etag='';denied=true;connected=false;localStorage.removeItem('web-tools-repositories-snapshot');}
    }catch{message='Could not confirm the fetch request.';connected=false;}
    finally{clearTimeout(timeout);sending='';render();poll();}
  }
  document.addEventListener('click',event=>{if(!active)return;const button=event.target.closest('[data-repo],[data-fetch]');if(button?.dataset.repo){const key=button.dataset.repo;expanded.has(key)?expanded.delete(key):expanded.add(key);button.setAttribute('aria-expanded',String(expanded.has(key)));el('repo-'+key).hidden=!expanded.has(key);}if(button?.dataset.fetch&&!button.disabled)fetchRepo(button.dataset.fetch);});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
  window.addEventListener('online',poll);window.addEventListener('offline',()=>{connected=false;render();});
  try{const prior=JSON.parse(localStorage.getItem('web-tools-repositories-snapshot'));if(valid(prior))data=prior;}catch{}
  window.NowRepositories={connection,setActive:value=>{active=value;clearTimeout(timer);clearTimeout(staleTimer);if(active){render();poll();}}};
})();
