(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const ago=value=>{const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':Math.floor(minutes/1440)+'d ago';};
  const valid=value=>value?.schemaVersion===1 && Number.isFinite(Date.parse(value.observedAt)) && Array.isArray(value.repositories) && value.repositories.length<=256
    && Array.isArray(value.refreshing) && value.repositories.every(r=>/^[a-f0-9]{24}$/.test(r.key) && typeof r.name==='string' && Array.isArray(r.checkouts) && r.checkouts.length<=256 && r.checkouts.every(c=>/^[a-f0-9]{24}$/.test(c.key)&&typeof c.name==='string'&&typeof c.branch==='string'&&c.main&&c.tracked&&window.NowLocalFiles?.valid(c.localFiles,c.key)!==false));
  let data,active=false,connected=false,pending=false,timer,staleTimer,etag='',failed=false,denied=false,message='',sending='',menu='',help=false;
  let selected='';const positions=new Map();
  const fresh=()=>connected&&navigator.onLine!==false&&data&&Date.now()-Date.parse(data.observedAt)<45000;
  const url=repo=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.url||'')?repo.url:null;
  function connection(){
    if(!active)return;
    el('connection').textContent=denied?'Access unavailable':fresh()?'Live':data?'Saved':failed?'Offline':'Connecting…';
    el('connection').removeAttribute('title');
    el('connection').setAttribute('aria-label',fresh()?'Connected to '+(data.machineName||'the laptop'):data?'Saved laptop observation from '+stamp(data.observedAt):el('connection').textContent);
  }
  function comparison(value,key){
    if(Number.isInteger(value?.ahead)&&Number.isInteger(value?.behind)){
      return `<span class="inline-flex items-center gap-2 tabular-nums">${['ahead','behind'].map(direction=>{
        const count=value[direction],tip=`${count.toLocaleString()} ${count===1?'commit':'commits'} ${direction==='ahead'?'ahead of':'behind'} GitHub ${value.branch||'default branch'}.`;
        return `<span data-commit="${key}:${direction}" tabindex="0" data-title-tip="${escape(tip)}" data-title-tip-bare aria-label="${escape(tip)}" class="inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center gap-0.5 ${direction==='ahead'&&count?'text-emerald-700':'text-stone-600'}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3.5" aria-hidden="true"><path d="${direction==='ahead'?'M8 13V3m-4 4 4-4 4 4':'M8 3v10m-4-4 4 4 4-4'}"/></svg><span aria-hidden="true">${count.toLocaleString()}</span></span>`;
      }).join('')}</span>`;
    }
    return `<span class="text-stone-500">${escape(({'not-checked':'Not checked','no-upstream':'No GitHub tracking branch','remote-missing':'Branch missing on GitHub','fetch-needed':'Check needed','incomplete-history':'Limited history','unrelated-history':'Separate histories'})[value?.state]||'Comparison unavailable')}</span>`;
  }
  const refresh='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-3.5 shrink-0" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.3 8a7 7 0 0 1 11.6-3L20 8M4 16l3.1 3A7 7 0 0 0 18.7 16"/></svg>';
  const branch='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" class="mt-1 size-3 shrink-0 text-stone-500" aria-hidden="true"><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/><path d="M4 4.5v7M12 4.5A5 5 0 0 1 7 9.5H4"/></svg>';
  const external='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
  function row(repo){
    const href=url(repo),name=repo.name.replace(/^[^/]+\//,''),busy=sending===repo.key||sending==='all'||fresh()&&data.refreshing.includes(repo.key);
    const details=repo.checkouts.map(c=>{
      const same=c.tracked.branch&&c.tracked.branch===c.main.branch;
      const changes=c.changed===null||c.untracked===null?'Local status unavailable':[c.changed?c.changed+' changed '+(c.changed===1?'file':'files'):'',c.untracked?c.untracked+' untracked '+(c.untracked===1?'file':'files'):'',c.conflicts?c.conflicts+' conflicts':''].filter(Boolean).join(' · ');
      const implicit=c.tracked.branch===c.branch,localBranch=escape(c.branch==='(detached)'?'Detached checkout':c.branch||'Branch unavailable');
      const line=(label,value,local=false,kind='tracked')=>`<div class="flex min-w-0 flex-wrap items-center gap-x-1.5"><dt class="flex min-w-0 items-start gap-1.5 text-stone-600">${local?branch:''}<span class="min-w-0 break-all">${label}</span></dt><dd>${comparison(value,c.key+':'+kind)}</dd></div>`;
      return `<li data-checkout="${c.key}" class="min-w-0 py-1.5 first:pt-0 last:pb-0">${repo.checkouts.length===1&&c.name===name?'':`<p class="break-words text-xs leading-5"><span class="text-stone-500">Checkout · </span><span class="font-medium">${escape(c.name)}</span></p>`}<dl class="text-xs leading-5">${implicit||!c.tracked.branch?line(localBranch,c.tracked,true):`<div class="flex items-start gap-1.5">${branch}<dt class="break-all text-stone-600">${localBranch}</dt></div>${line(escape('vs GitHub '+c.tracked.branch),c.tracked)}`}${same?'':line(escape(c.main.branch?'vs GitHub '+c.main.branch:'vs GitHub default'),c.main,false,'main')}</dl>${changes?`<p class="text-xs leading-5 ${c.conflicts?'text-red-800':'text-amber-800'}">${escape(changes)}</p>`:''}${window.NowLocalFiles?.preview(c)||''}</li>`;
    }).join('');
    const checked=repo.checkedAt?ago(repo.checkedAt).replace('just now','now'):'not checked',old=repo.checkedAt&&Date.now()-Date.parse(repo.checkedAt)>600000;
    return `<article data-repository="${repo.key}" class="relative border-b border-stone-200 bg-white px-3 pb-2"><div class="flex min-h-8 items-center gap-2 pr-8"><h2 class="min-w-0 flex-1 break-words text-sm font-semibold">${escape(name)}</h2><span data-github-time class="shrink-0 text-[11px] ${old?'text-amber-800':'text-stone-600'}" aria-label="${repo.checkedAt?'GitHub last checked '+escape(stamp(repo.checkedAt)):'GitHub not checked'}">GitHub · ${escape(checked)}</span>${href?`<button data-menu="${repo.key}" aria-label="Actions for ${escape(repo.name)}" aria-haspopup="menu" aria-expanded="${menu===repo.key}" aria-controls="repo-menu-${repo.key}" class="absolute right-0 top-0 flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"><svg viewBox="0 0 24 24" fill="currentColor" class="size-5" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button><div id="repo-menu-${repo.key}" data-repo-menu="${repo.key}" ${menu===repo.key?'':'hidden'} role="menu" aria-label="Actions for ${escape(repo.name)}" class="absolute right-1 top-11 z-20 w-52 max-w-[calc(100vw-0.5rem)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"><button role="menuitem" data-fetch="${repo.key}" ${fresh()&&!sending&&!busy?'':'disabled'} class="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-sky-800 hover:bg-stone-50 disabled:text-stone-400"><span class="block font-medium">${busy?'Checking GitHub…':'Check GitHub now'}</span></button><a role="menuitem" data-github="${repo.key}" href="${href}" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm text-sky-800 hover:bg-stone-50">Open on GitHub ${external}</a></div>`:''}</div>${repo.notice?`<p class="mb-1 text-xs text-amber-800">${escape(repo.notice)}</p>`:''}<ul class="divide-y divide-stone-100">${details}</ul></article>`;
  }
  function render(){
    if(!active)return;
    const viewport={x:scrollX,y:scrollY},focus=document.activeElement,helpFocus=focus?.id==='repository-info',action=['menu','fetch','github','files','commit'].find(key=>focus?.dataset[key]),key=action&&focus.dataset[action],tip=el('repositories').querySelector('[data-commit][aria-describedby="wt-title-tip"]')?.dataset.commit;
    if(!data){window.TitleTip?.close();el('repositories').innerHTML=`<p class="px-3 py-4 text-sm text-stone-500">${denied?'Access unavailable. Connect with your Tailscale account.':failed?'Repository readings unavailable. Waiting for the laptop.':'Reading local checkouts…'}</p>`;connection();return;}
    el('machine').textContent=data.machineName;
    if(selected){
      window.NowLocalFiles.render(data,selected,fresh());
      if(scrollX!==viewport.x||scrollY!==viewport.y)scrollTo(viewport.x,viewport.y);
      connection();return;
    }
    window.NowLocalFiles?.header(false);
    const count=data.repositories.reduce((sum,r)=>sum+r.checkouts.length,0),busy=fresh()&&data.refreshing.length>0||sending;
    el('repositories').innerHTML=`<div class="relative px-3"><div class="flex min-h-11 items-center justify-between gap-1"><div class="flex min-w-0 items-center"><p class="text-xs text-stone-600">${data.repositories.length} repos · ${count} checkouts</p><button id="repository-info" aria-label="About repository checks" aria-expanded="${help}" aria-controls="repository-help" class="flex size-8 shrink-0 items-center justify-center text-stone-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-3.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg></button></div><button data-fetch="all" aria-label="Check all repositories on GitHub" aria-busy="${Boolean(busy)}" ${fresh()&&!busy&&data.repositories.some(r=>url(r))?'':'disabled'} class="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-sky-800 disabled:text-stone-400"><span class="${busy?'animate-spin':''}">${refresh}</span>Check GitHub</button></div><div id="repository-help" ${help?'':'hidden'} role="note" class="absolute left-3 right-3 top-10 z-20 rounded-xl border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-600 shadow-lg"><p>Live: connected to the laptop.</p><p>A checkout is a local working folder.</p><p>Comparisons count commits. File edits appear separately.</p><p>GitHub checks run automatically. Check GitHub refreshes those comparisons; local branches and files stay unchanged.</p></div>${!fresh()?'<p class="pb-1 text-xs text-amber-800">Saved data · GitHub checks unavailable.</p>':''}${data.notice?`<p class="pb-1 text-xs text-amber-800">${escape(data.notice)}</p>`:''}<p role="status" class="empty:hidden pb-1 text-[11px] text-sky-800">${escape(message)}</p></div>${data.repositories.map(row).join('')}${!count?'<p class="px-3 py-3 text-sm text-stone-500">No local checkouts observed.</p>':''}`;
    if(helpFocus)el('repository-info')?.focus({preventScroll:true});
    if(action)[...el('repositories').querySelectorAll(`[data-${action}]`)].find(n=>n.dataset[action]===key&&!n.disabled)?.focus({preventScroll:true});
    if(tip){const trigger=[...el('repositories').querySelectorAll('[data-commit]')].find(n=>n.dataset.commit===tip);if(trigger)window.TitleTip?.open(trigger);else window.TitleTip?.close();}
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
  function setHelp(value,restore=false){
    help=value;if(el('repository-help'))el('repository-help').hidden=!help;
    el('repository-info')?.setAttribute('aria-expanded',String(help));
    if(restore)el('repository-info')?.focus({preventScroll:true});
  }
  function remember(){positions.set(selected,scrollY);}
  function route(enter=false){
    if(!active)return;
    const params=new URLSearchParams(location.hash.slice(1));if(params.get('view')!=='repositories')return;
    const key=params.get('checkout')||'',next=/^[a-f0-9]{24}$/.test(key)?key:'';
    if(next!==selected){if(!enter)remember();selected=next;setMenu('');setHelp(false);window.TitleTip?.close();render();scrollTo(0,positions.get(selected)||0);}
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
    if(event.target.closest('#repository-info')){setMenu('');setHelp(!help);return;}
    if(!event.target.closest('#repository-help'))setHelp(false);
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
    if(help&&event.key==='Escape'){event.preventDefault();setHelp(false,true);return;}
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
  window.NowRepositories={connection,setActive:value=>{const prior=active;if(prior&&!value)remember();active=value;clearTimeout(timer);clearTimeout(staleTimer);if(active){route(!prior);poll();}else {setMenu('');setHelp(false);window.TitleTip?.close();window.NowLocalFiles?.header(false,false);}}};
})();
