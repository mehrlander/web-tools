(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const ago=value=>{const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':Math.floor(minutes/1440)+'d ago';};
  const valid=value=>value?.schemaVersion===1 && Number.isFinite(Date.parse(value.observedAt)) && Array.isArray(value.repositories) && value.repositories.length<=256
    && Array.isArray(value.refreshing) && value.repositories.every(r=>/^[a-f0-9]{24}$/.test(r.key) && typeof r.name==='string' && Array.isArray(r.checkouts) && r.checkouts.length<=256 && r.checkouts.every(c=>/^[a-f0-9]{24}$/.test(c.key)&&typeof c.name==='string'&&typeof c.branch==='string'&&c.main&&c.tracked&&window.NowLocalFiles?.valid(c.localFiles,c.key)!==false));
  let data,active=false,connected=false,pending=false,timer,staleTimer,etag='',failed=false,denied=false,message='',sending='',menu='';
  let selected='';const positions=new Map();
  const fresh=()=>connected&&navigator.onLine!==false&&data&&Date.now()-Date.parse(data.observedAt)<45000;
  const url=repo=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.url||'')?repo.url:null;
  function connection(){
    if(!active)return;
    el('connection').textContent=denied?'Access unavailable':fresh()?'Laptop live':data?'Last seen':failed?'Offline':'Connecting…';
    el('connection').title=data?'Local checkouts observed '+stamp(data.observedAt):'Reading local checkouts';
  }
  function comparison(value){
    if(Number.isInteger(value?.ahead)&&Number.isInteger(value?.behind))return value.ahead||value.behind?`${value.ahead?`<span class="text-amber-800">↑ ${value.ahead.toLocaleString()}</span>`:''}${value.ahead&&value.behind?' · ':''}${value.behind?`<span class="text-sky-800">↓ ${value.behind.toLocaleString()}</span>`:''}`:'<span class="text-emerald-800">In sync</span>';
    return `<span class="text-stone-500">${escape(({'not-checked':'Not checked','no-upstream':'No tracked branch','remote-missing':'Branch absent on GitHub','fetch-needed':'Check needed','incomplete-history':'Shallow history','unrelated-history':'Unrelated history'})[value?.state]||'Unavailable')}</span>`;
  }
  const external='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
  function row(repo){
    const href=url(repo),name=repo.name.replace(/^[^/]+\//,''),busy=sending===repo.key||sending==='all'||fresh()&&data.refreshing.includes(repo.key);
    const details=repo.checkouts.map(c=>{
      const same=c.tracked.branch&&c.tracked.branch===c.main.branch;
      const changes=c.changed===null||c.untracked===null?'Local status unavailable':[c.changed?c.changed+' changed '+(c.changed===1?'file':'files'):'',c.untracked?c.untracked+' untracked '+(c.untracked===1?'file':'files'):'',c.conflicts?c.conflicts+' conflicts':''].filter(Boolean).join(' · ');
      const reference=same?'GitHub '+escape(c.main.branch):c.tracked.branch&&c.tracked.branch!==c.branch?'GitHub '+escape(c.tracked.branch):'GitHub branch';
      return `<li data-checkout="${c.key}" class="min-w-0 py-1.5 first:pt-0 last:pb-0"><p class="break-words text-xs leading-5">${repo.checkouts.length===1&&c.name===name?'':`<span class="text-[10px] text-stone-500">Checkout · </span><span class="font-medium">${escape(c.name)}</span><span class="text-stone-500"> · </span>`}<span class="text-stone-500">${escape(c.branch==='(detached)'?'Detached checkout':c.branch||'Branch unavailable')}</span></p><dl class="text-xs leading-5"><div class="flex flex-wrap gap-x-2"><dt class="break-all text-stone-500" title="${escape(c.upstream||'No tracked branch')}">${reference}</dt><dd>${comparison(c.tracked)}</dd></div>${same?'':`<div class="flex flex-wrap gap-x-2"><dt class="break-all text-stone-500">${escape(c.main.branch?'GitHub '+c.main.branch:'GitHub default')}</dt><dd>${comparison(c.main)}</dd></div>`}</dl>${changes?`<p class="text-xs leading-5 ${c.conflicts?'text-red-800':'text-amber-800'}">${escape(changes)}</p>`:''}${window.NowLocalFiles?.preview(c)||''}</li>`;
    }).join('');
    const checked=repo.checkedAt?(repo.notice||Date.now()-Date.parse(repo.checkedAt)>600000?'Last check ':'Checked ')+ago(repo.checkedAt):'Not checked';
    return `<article data-repository="${repo.key}" class="relative border-b border-stone-200 bg-white px-3 pb-2"><div class="flex min-h-8 items-center gap-2 pr-11"><h2 class="min-w-0 flex-1 break-words text-sm font-semibold">${escape(name)}</h2><span class="shrink-0 text-[10px] text-stone-500" title="${repo.checkedAt?escape(stamp(repo.checkedAt)):'No successful GitHub check'}">${busy?'Checking…':escape(checked)}</span>${href?`<button data-menu="${repo.key}" aria-label="Actions for ${escape(repo.name)}" aria-haspopup="menu" aria-expanded="${menu===repo.key}" aria-controls="repo-menu-${repo.key}" class="absolute right-3 top-0 flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"><svg viewBox="0 0 24 24" fill="currentColor" class="size-5" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button><div id="repo-menu-${repo.key}" data-repo-menu="${repo.key}" ${menu===repo.key?'':'hidden'} role="menu" aria-label="Actions for ${escape(repo.name)}" class="absolute right-3 top-11 z-20 w-52 max-w-[calc(100vw-1.5rem)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"><button role="menuitem" data-fetch="${repo.key}" ${fresh()&&!sending&&!busy?'':'disabled'} class="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-sky-800 hover:bg-stone-50 disabled:text-stone-400"><span class="block font-medium">${busy?'Checking GitHub…':'Check GitHub now'}</span></button><a role="menuitem" data-github="${repo.key}" href="${href}" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm text-sky-800 hover:bg-stone-50">Open on GitHub ${external}</a></div>`:''}</div>${repo.notice?`<p class="mb-1 text-xs text-amber-800">${escape(repo.notice)}</p>`:''}<ul class="divide-y divide-stone-100">${details}</ul></article>`;
  }
  function render(){
    if(!active)return;
    const viewport={x:scrollX,y:scrollY},focus=document.activeElement,action=['menu','fetch','github','files'].find(key=>focus?.dataset[key]),key=action&&focus.dataset[action];
    if(!data){el('repositories').innerHTML=`<p class="px-3 py-4 text-sm text-stone-500">${denied?'Access unavailable. Connect with your Tailscale account.':failed?'Repository readings unavailable. Waiting for the laptop.':'Reading local checkouts…'}</p>`;connection();return;}
    el('machine').textContent=data.machineName;
    if(selected){
      window.NowLocalFiles.render(data,selected,fresh());
      if(scrollX!==viewport.x||scrollY!==viewport.y)scrollTo(viewport.x,viewport.y);
      connection();return;
    }
    window.NowLocalFiles?.header(false);
    const count=data.repositories.reduce((sum,r)=>sum+r.checkouts.length,0),busy=fresh()&&data.refreshing.length>0||sending;
    el('repositories').innerHTML=`<div class="px-3 py-2"><div class="flex items-center justify-between gap-2"><p class="text-xs text-stone-600">${data.repositories.length} repos · ${count} checkouts</p><button data-fetch="all" ${fresh()&&!busy&&data.repositories.some(r=>url(r))?'':'disabled'} class="min-h-11 text-xs font-medium text-sky-800 disabled:text-stone-400">${busy?'Checking GitHub…':'Check all repos'}</button></div><p class="text-[11px] leading-4 text-stone-500">Comparisons refresh automatically; checks leave local branches and files unchanged.</p><p class="mt-0.5 text-[11px] text-stone-500">↑ Ahead · ↓ Behind the named GitHub branch, in commits.</p>${!fresh()?'<p class="mt-1 text-xs text-amber-800">Saved observation · Checking unavailable while offline.</p>':''}${data.notice?`<p class="mt-1 text-xs text-amber-800">${escape(data.notice)}</p>`:''}<p role="status" class="empty:hidden mt-1 text-[11px] text-sky-800">${escape(message)}</p></div>${data.repositories.map(row).join('')}${!count?'<p class="px-3 py-3 text-sm text-stone-500">No local checkouts observed.</p>':''}`;
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
    try{const response=await fetch('/api/v1/repositories/'+key+'/fetch',{method:'POST',headers:{'X-WebTools-Action':'1'},cache:'no-store',signal:controller.signal});message=response.status===202?'GitHub check queued. Local branches and files stay unchanged.':response.status===409?'Already checking GitHub.':'GitHub check unavailable.';
      if(response.status===403){data=undefined;etag='';denied=true;connected=false;localStorage.removeItem('web-tools-repositories-snapshot');}
    }catch{message='Could not confirm the GitHub check request.';connected=false;}
    finally{clearTimeout(timeout);sending='';render();poll();}
  }
  function setMenu(key,restore=false){
    const previous=menu;menu=key;
    el('repositories').querySelectorAll('[data-repo-menu]').forEach(node=>{node.hidden=node.dataset.repoMenu!==menu;});
    el('repositories').querySelectorAll('[data-menu]').forEach(node=>{node.setAttribute('aria-expanded',String(node.dataset.menu===menu));if(restore&&node.dataset.menu===previous)node.focus({preventScroll:true});});
  }
  function remember(){positions.set(selected,scrollY);}
  function route(enter=false){
    if(!active)return;
    const params=new URLSearchParams(location.hash.slice(1));if(params.get('view')!=='repositories')return;
    const key=params.get('checkout')||'',next=/^[a-f0-9]{24}$/.test(key)?key:'';
    if(next!==selected){if(!enter)remember();selected=next;setMenu('');render();scrollTo(0,positions.get(selected)||0);}
    else {render();if(enter)scrollTo(0,positions.get(selected)||0);}
  }
  function openFiles(key){
    if(!data?.repositories.some(r=>r.checkouts.some(c=>c.key===key)))return;
    history.pushState({localFiles:true},'','#view=repositories&checkout='+key);route();
  }
  function back(){
    if(history.state?.localFiles){history.back();return;}
    history.replaceState(null,'','#view=repositories');route();
  }
  document.addEventListener('click',event=>{
    if(!active)return;
    if(event.target.closest('#repository-back')){back();return;}
    const files=event.target.closest('[data-files]');if(files){openFiles(files.dataset.files);return;}
    const button=event.target.closest('[data-menu],[data-fetch],[data-github]');
    if(button?.dataset.menu){setMenu(menu===button.dataset.menu?'':button.dataset.menu);return;}
    if(button?.dataset.fetch&&!button.disabled){const key=button.dataset.fetch;setMenu('',true);fetchRepo(key);return;}
    if(button?.dataset.github){setMenu('',true);return;}
    if(!event.target.closest('[data-repo-menu]'))setMenu('');
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    const trigger=event.target.closest('[data-menu]');
    if(trigger&&['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();setMenu(trigger.dataset.menu);
      const items=[...el('repo-menu-'+menu).querySelectorAll('[role=menuitem]:not(:disabled)')];
      (event.key==='ArrowUp'?items.at(-1):items[0])?.focus({preventScroll:true});return;
    }
    if(!menu)return;
    if(event.key==='Escape'){event.preventDefault();setMenu('',true);return;}
    if(event.key==='Tab'){setMenu('',true);return;}
    if(!event.target.closest('[data-repo-menu]')||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const items=[...el('repo-menu-'+menu).querySelectorAll('[role=menuitem]:not(:disabled)')],index=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
  window.addEventListener('popstate',()=>route());window.addEventListener('hashchange',()=>route());
  window.addEventListener('online',poll);window.addEventListener('offline',()=>{connected=false;render();});
  try{const prior=JSON.parse(localStorage.getItem('web-tools-repositories-snapshot'));if(valid(prior))data=prior;}catch{}
  window.NowRepositories={connection,setActive:value=>{const prior=active;if(prior&&!value)remember();active=value;clearTimeout(timer);clearTimeout(staleTimer);if(active){route(!prior);poll();}else {setMenu('');window.NowLocalFiles?.header(false,false);}}};
})();
