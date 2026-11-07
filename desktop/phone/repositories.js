(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ago=value=>{const n=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return n<1?'just now':n<60?n+'m ago':n<1440?Math.floor(n/60)+'h ago':Math.floor(n/1440)+'d ago';};
  const stamp=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0" aria-hidden="true">${path}</svg>`;
  const icons={refresh:svg('<path d="M20 7v5h-5M4 17v-5h5M5.3 8a7 7 0 0 1 11.6-3L20 8M4 16l3.1 3A7 7 0 0 0 18.7 16"/>'),
    warning:svg('<path d="m12 3 10 18H2L12 3ZM12 9v5m0 3v1"/>'),
    changes:svg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5M8 12h6m-3-3v6m-3 3h6"/>'),
    untracked:svg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5M8 14h8m-4-4v8"/>'),
    local:svg('<path d="M3 7V5h7l2 2h9v13H3ZM8 12h8m-8 4h5"/>'),
    branch:svg('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10v2a5 5 0 0 1-5 5H6"/>'),
    pull:svg('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10m12 0V9a4 4 0 0 0-4-4h-2m3-3-3 3 3 3"/>'),
    merged:svg('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10v2a5 5 0 0 1-5 5H6"/><path d="m12 11-3 3 3 3"/>'),
    check:svg('<path d="m5 12 4 4L19 6"/>'),
    more:svg('<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'),
    external:svg('<path d="M14 4h6v6M20 4 10 14M10 4H5v16h15V14"/>')};
  const valid=value=>value?.schemaVersion===1&&Number.isFinite(Date.parse(value.observedAt))&&Array.isArray(value.repositories)&&value.repositories.length<=256
    &&Array.isArray(value.refreshing)&&value.repositories.every(r=>/^[a-f0-9]{24}$/.test(r.key)&&typeof r.name==='string'&&Array.isArray(r.checkouts)&&r.checkouts.length<=256
      &&r.checkouts.every(c=>/^[a-f0-9]{24}$/.test(c.key)&&typeof c.name==='string'&&typeof c.branch==='string'&&c.tracked&&window.NowLocalFiles.valid(c.localFiles,c.key)));
  let data,active=false,connected=false,pending=false,timer,staleTimer,etag='',failed=false,denied=false,sending='',message='',selected='',popup=null;
  const positions=new Map();
  const fresh=()=>connected&&navigator.onLine!==false&&data&&Date.now()-Date.parse(data.observedAt)<45000;
  const repoFor=checkout=>data?.repositories.find(r=>r.checkouts.some(c=>c.key===checkout.key));
  const checkoutFor=key=>data?.repositories.flatMap(r=>r.checkouts).find(c=>c.key===key);
  const safeUrl=repo=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo?.url||'')?repo.url:null;
  const busy=repo=>sending==='all'||sending===repo?.key||fresh()&&data.refreshing.includes(repo?.key);
  const checkAge=repo=>repo?.checkedAt?'GitHub checked '+ago(repo.checkedAt)+' ('+stamp(repo.checkedAt)+').':'GitHub has not been checked.';
  function connection(){
    if(!active)return;
    el('connection').textContent=denied?'Access unavailable':fresh()?'Live':data?'Saved':failed?'Offline':'Connecting…';
    el('connection').removeAttribute('title');
    el('connection').setAttribute('aria-label',fresh()?'Connected to '+(data.machineName||'the laptop'):data?'Saved laptop observation from '+stamp(data.observedAt):el('connection').textContent);
  }
  function comparison(value,key){
    const checkout=checkoutFor(key.split(':')[0]),repo=checkout&&repoFor(checkout),upstream=checkout?.upstream?.startsWith('origin/')?checkout.upstream.slice(7):'',age=checkAge(repo)+(repo?.notice?' '+repo.notice:'')+(upstream&&upstream!==value?.branch?' Configured upstream: GitHub '+upstream+'.':'');
    if(Number.isInteger(value?.ahead)&&Number.isInteger(value?.behind))return `<span class="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium tabular-nums">${['ahead','behind'].map(direction=>{
      const n=value[direction],tip=`${n.toLocaleString()} ${n===1?'commit':'commits'} ${direction==='ahead'?'ahead of':'behind'} GitHub ${value.branch||'tracking branch'}. ${age}`;
      return `<span data-commit="${key}:${direction}" tabindex="0" data-title-tip="${escape(tip)}" data-title-tip-bare aria-label="${escape(tip)}" class="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center gap-0.5 ${n?direction==='ahead'?'text-[color:var(--color-success,#047857)]':'text-amber-700':'text-stone-500'}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3" aria-hidden="true"><path d="${direction==='ahead'?'M8 13V3m-4 4 4-4 4 4':'M8 3v10m-4-4 4 4 4-4'}"/></svg><span aria-hidden="true">${n.toLocaleString()}</span></span>`;
    }).join('')}</span>`;
    const target='GitHub '+(value?.branch||'tracking branch');
    const tip=({'no-upstream':'No tracked GitHub branch is configured.','unrelated-history':`The local branch and ${target} have separate commit histories.`,'incomplete-history':`Limited history prevents comparison with ${target}.`,'remote-missing':`${target} was absent at the last check.`,'not-checked':`${target} has not been checked.`,'fetch-needed':`Check GitHub to compare with ${target}.`})[value?.state]||`Could not compare with ${target}.`;
    return `<span data-commit="${key}:state" tabindex="0" data-title-tip="${escape(tip+' '+age)}" data-title-tip-bare aria-label="${escape(tip)}" class="inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center text-amber-700">${icons.warning}</span>`;
  }
  function branchControl(checkout){
    const meta=checkout.branchStatus||{},state=meta.state||'unknown';
    const kind=({main:['branch','text-stone-500','Default branch'],snapshot:['check','text-sky-700','Default-branch snapshot'],open:['pull','text-sky-700','Open pull request'],merged:['merged','text-violet-700','Merged pull request'],incorporated:['check','text-emerald-700','Included in GitHub default branch'],review:['branch','text-amber-700','Branch needs review']})[state]||['branch','text-stone-400','Branch status not checked'];
    const open=popup?.type==='branch'&&popup.key===checkout.key,repo=repoFor(checkout),url=safeUrl(repo);
    const href=url&&Number.isInteger(meta.number)&&meta.number>0&&meta.url===url+'/pull/'+meta.number?meta.url:null;
    const detail=state==='snapshot'?'Detached copy of GitHub '+(checkout.main?.branch||'default branch')+'.':state==='review'?meta.pullRequestState==='merged'?'The PR merged; local history still needs review.':meta.pullRequestState==='closed'?'The PR closed without merging.':'No pull request found for this branch.':'';
    return `<span class="relative inline-flex shrink-0"><button data-branch-signal="${checkout.key}" data-focus="${checkout.key}:branch" aria-label="${escape(kind[2]+' for '+checkout.branch+' in '+checkout.name)}" aria-expanded="${open}" aria-haspopup="true" aria-controls="branch-${checkout.key}" class="inline-flex size-5 shrink-0 items-center justify-center ${kind[1]} ${open?'rounded bg-stone-100 ring-1 ring-current':''}">${icons[kind[0]]}</button><span id="branch-${checkout.key}" data-popup="branch:${checkout.key}" ${open?'':'hidden'} role="region" aria-label="Branch status for ${escape(checkout.name)}" class="absolute left-0 top-6 z-30 block w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-normal leading-5 shadow-lg"><span class="block font-medium ${kind[1]}">${kind[2]}</span>${meta.title?`<span class="mt-1 block text-stone-700">${escape(meta.title)}</span>`:''}${href?`<a href="${href}" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-8 items-center gap-1 text-sky-800">PR ${meta.number}${icons.external}</a>`:''}${detail?`<span class="block text-stone-600">${escape(detail)}</span>`:''}<span class="block text-stone-600">${escape(checkout.tracked.branch?'Compared with GitHub '+checkout.tracked.branch:'No GitHub comparison target')}</span>${meta.checkedAt?`<span class="mt-1 block border-t border-stone-100 pt-1 text-[10px] text-stone-500">Checked ${escape(ago(meta.checkedAt))}</span>`:''}</span></span>`;
  }
  function status(checkout){
    const changed=checkout.changed,untracked=checkout.untracked,conflicts=checkout.conflicts||0,local=checkout.localFiles,ignored=(local?.entries||[]).filter(e=>e.gitState==='ignored');
    const compact=n=>n<1000?n.toLocaleString():new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n).toLowerCase();
    const metric=(kind,icon,n,label,tone,partial=false)=>{
      const open=popup?.type==='status'&&popup.key===checkout.key&&popup.metric===kind;
      return `<button data-signal="${checkout.key}" data-metric="${kind}" data-focus="${checkout.key}:signal:${kind}" aria-label="${escape(label+' in '+checkout.name)}" aria-haspopup="true" aria-expanded="${open}" aria-controls="status-${checkout.key}" class="inline-flex min-h-10 min-w-7 shrink-0 items-center justify-center gap-0.5 px-0.5 ${open?'rounded-md bg-stone-100':''} ${tone} [&>svg]:size-3.5">${icon}${n===null?'':`<span aria-hidden="true" class="text-[11px] font-medium tabular-nums">${partial?'≥':''}${compact(n)}</span>`}</button>`;
    };
    return [
      changed||conflicts?metric('changed',conflicts?icons.warning:icons.changes,changed||conflicts,(changed||conflicts).toLocaleString()+' changed tracked '+((changed||conflicts)===1?'file':'files')+(conflicts?'; '+conflicts.toLocaleString()+' '+(conflicts===1?'conflict':'conflicts'):''),conflicts?'text-red-700':'text-amber-700'):'',
      untracked?metric('untracked',icons.untracked,untracked,untracked.toLocaleString()+' untracked '+(untracked===1?'file':'files'),'text-emerald-700'):'',
      ignored.length?metric('ignored',icons.local,ignored.length,(local.partial?'At least ':'')+ignored.length.toLocaleString()+' ignored inventory '+(ignored.length===1?'entry':'entries')+(local.partial?'; incomplete inventory':''),'text-stone-500',local.partial):'',
      changed===null||untracked===null||local?.state==='unavailable'?metric('unavailable',icons.warning,null,[changed===null||untracked===null?'Local status unavailable':'',local?.state==='unavailable'?'Local inventory unavailable':''].filter(Boolean).join('; '),'text-amber-700'):''
    ].join('');
  }
  function statusPanel(checkout){
    const count=(n,word)=>n.toLocaleString()+' '+word+(n===1?'':'s');
    const local=checkout.localFiles,entries=local?.entries||[],ignored=entries.filter(e=>e.gitState==='ignored'),untracked=entries.filter(e=>e.gitState==='untracked');
    const inventoryCount=rows=>{const folders=rows.filter(e=>e.kind==='folder').length,files=rows.length-folders;return [folders?count(folders,'folder'):'',files?count(files,'file'):''].filter(Boolean).join(', ');};
    const link=(state,label)=>`<button data-inventory="${checkout.key}:${state}" data-focus="${checkout.key}:${state}" class="flex min-h-9 w-full items-center justify-between gap-3 text-left text-xs text-emerald-800"><span>${escape(label)}</span><span aria-hidden="true">›</span></button>`;
    return `<div id="status-${checkout.key}" data-popup="status:${checkout.key}" ${popup?.type==='status'&&popup.key===checkout.key?'':'hidden'} role="region" aria-label="Local status for ${escape(checkout.name)}" class="absolute right-1 top-10 z-30 w-56 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-lg">${checkout.conflicts?`<p class="py-1 text-xs font-medium text-red-700">${count(checkout.conflicts,'conflict')}</p>`:''}${checkout.changed?`<p class="py-1 text-xs text-amber-800">${checkout.changed.toLocaleString()} changed tracked ${checkout.changed===1?'file':'files'}</p>`:''}${local?.state==='unavailable'?'<p class="py-1 text-xs text-amber-700">Local inventory unavailable</p>':''}${checkout.changed===null||checkout.untracked===null?'<p class="py-1 text-xs text-stone-500">Local status unavailable</p>':''}${checkout.untracked||untracked.length?link('untracked',checkout.untracked?checkout.untracked.toLocaleString()+' untracked '+(checkout.untracked===1?'file':'files'):'Untracked · '+inventoryCount(untracked)):''}${ignored.length?link('ignored','Ignored · '+(local.partial?'≥ ':'')+inventoryCount(ignored)):''}${entries.length?`<p class="border-t border-stone-100 pt-1 text-[10px] text-stone-500">${local.partial?'Partial inventory · ':''}${escape(ago(local.observedAt))}</p>`:''}</div>`;
  }
  function tools(checkout){
    if(!checkout)return '';
    const repo=repoFor(checkout),url=safeUrl(repo),working=busy(repo),stale=repo?.notice||!repo?.checkedAt||Date.now()-Date.parse(repo.checkedAt)>600000;
    const branch=checkout.tracked.branch&&checkout.tracked.state!=='remote-missing'?checkout.tracked.branch:null;
    const href=url&&(branch?url+'/tree/'+encodeURIComponent(branch):url);
    return `<div class="relative flex shrink-0 items-center">${status(checkout)}${url?`<button data-menu="${checkout.key}" data-focus="${checkout.key}:menu" aria-label="Actions for ${escape(checkout.name)}" aria-haspopup="menu" aria-expanded="${popup?.type==='menu'&&popup.key===checkout.key}" aria-controls="menu-${checkout.key}" class="flex min-h-10 w-10 shrink-0 items-center justify-center ${stale?'text-amber-700':'text-stone-500'} ${popup?.type==='menu'&&popup.key===checkout.key?'rounded-md bg-stone-100':''}">${icons.more}</button><div id="menu-${checkout.key}" data-popup="menu:${checkout.key}" ${popup?.type==='menu'&&popup.key===checkout.key?'':'hidden'} role="menu" aria-label="Actions for ${escape(checkout.name)}" class="absolute right-1 top-10 z-30 w-48 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"><button role="menuitem" data-fetch="${repo.key}" data-anchor="${checkout.key}" data-focus="${checkout.key}:fetch" ${fresh()&&!sending&&!working?'':'disabled'} class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-sky-800 hover:bg-stone-50 disabled:text-stone-400">${icons.refresh}Check GitHub</button><a role="menuitem" data-github="${checkout.key}" data-focus="${checkout.key}:github" href="${href}" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-sky-800 hover:bg-stone-50">${icons.external}Open on GitHub</a></div>`:''}${statusPanel(checkout)}${resultPanel(checkout.key)}</div>`;
  }
  function resultPanel(key){return popup?.type==='result'&&popup.key===key?`<div data-popup="result:${key}" role="status" class="absolute right-1 top-10 z-30 w-52 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-lg">${escape(message)}</div>`:'';}
  function rootTools(){
    const working=sending||fresh()&&data?.refreshing.length;
    return `<div class="relative"><button data-fetch="all" data-anchor="all" data-focus="all:fetch" aria-label="Check all repositories on GitHub" aria-busy="${Boolean(working)}" ${fresh()&&!working&&data.repositories.some(r=>safeUrl(r))?'':'disabled'} class="flex size-10 shrink-0 items-center justify-center text-stone-500 disabled:text-stone-400"><span class="${working?'animate-spin':''}">${icons.refresh}</span></button>${resultPanel('all')}</div>`;
  }
  function refresh(){window.NowLocalFiles.refresh();}
  function positionPanels(){
    if(!active||!popup)return;
    const panel=el('repositories').querySelector('[data-popup]:not([hidden])');if(!panel)return;
    panel.style.top='';panel.style.bottom='';
    panel.style.maxHeight=Math.max(120,innerHeight-80)+'px';panel.style.overflowY='auto';
    const rect=panel.getBoundingClientRect();if(rect.height&&rect.bottom>innerHeight-8){panel.style.top='auto';panel.style.bottom='100%';}
  }
  function setPopup(type,key,restore=false,metric=''){
    if(!type&&!popup)return;
    const prior=popup;popup=type?{type,key,metric}:null;refresh();
    if(restore&&prior)el('repositories').querySelector(`[data-focus="${prior.key}:${prior.type==='status'?'signal:'+prior.metric:prior.type==='branch'?'branch':prior.key==='all'?'fetch':'menu'}"]`)?.focus({preventScroll:true});
  }
  function render(){
    if(!active)return;
    if(!data){window.NowLocalFiles.stop(denied);window.TitleTip?.close();el('repositories').innerHTML=`<p class="px-3 py-4 text-sm text-stone-500">${denied?'Access unavailable. Connect with your Tailscale account.':failed?'Folder readings unavailable. Waiting for the laptop.':'Reading local folders…'}</p>`;connection();return;}
    el('machine').textContent=data.machineName;
    window.NowLocalFiles.render(data,selected,fresh());connection();
    clearTimeout(staleTimer);if(fresh())staleTimer=setTimeout(render,Math.max(1,45000-(Date.now()-Date.parse(data.observedAt))));
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
    finally{clearTimeout(timeout);pending=false;route();if(active&&!document.hidden)timer=setTimeout(poll,failed?15000:3000);}
  }
  async function fetchRepo(key,anchor){
    if(!fresh()||sending||document.hidden)return;sending=key;popup=null;message='';render();
    const path=selected,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
    try{const response=await fetch('/api/v1/repositories/'+key+'/fetch',{method:'POST',headers:{'X-WebTools-Action':'1'},cache:'no-store',signal:controller.signal});message=response.status===202?'GitHub check queued.':response.status===409?'Already checking GitHub.':'GitHub check unavailable.';
      if(response.status===403){data=undefined;etag='';denied=true;connected=false;localStorage.removeItem('web-tools-repositories-snapshot');}
    }catch{message='Could not confirm the GitHub check.';connected=false;}
    finally{clearTimeout(timeout);sending='';if(active&&path===selected&&data)popup={type:'result',key:anchor};render();poll();}
  }
  function route(enter=false){
    if(!active)return;
    const params=new URLSearchParams(location.hash.slice(1));if(!['files','repositories'].includes(params.get('view')))return;
    const key=params.get('checkout'),next=params.get('folder')??checkoutFor(key)?.name??'';
    if(next!==selected){if(!enter)positions.set(selected,scrollY);selected=next;popup=null;window.TitleTip?.close();render();scrollTo(0,positions.get(selected)||0);}
    else {render();if(enter)scrollTo(0,positions.get(selected)||0);}
    window.NowLocalFiles.setFilter(params.get('filter')||'all');
  }
  function openFolder(path,filter='all'){
    if(path===selected&&filter===window.NowLocalFiles.filter()){refresh();return;}
    const params=new URLSearchParams({view:'files'});if(path)params.set('folder',path);if(filter!=='all')params.set('filter',filter);
    history.pushState({localFiles:true},'','#'+params);route();
  }
  function back(){
    if(history.state?.localFiles){history.back();return;}
    const parent=selected.split('/').slice(0,-1).join('/');history.replaceState(null,'','#view=files'+(parent?'&folder='+encodeURIComponent(parent):''));route();
  }
  document.addEventListener('click',event=>{
    if(!active)return;
    const button=event.target.closest('[data-menu],[data-signal],[data-branch-signal],[data-fetch],[data-github],[data-inventory]');
    if(button?.dataset.branchSignal){const key=button.dataset.branchSignal;setPopup(popup?.type==='branch'&&popup.key===key?null:'branch',key);return;}
    if(button?.dataset.menu){const key=button.dataset.menu;setPopup(popup?.type==='menu'&&popup.key===key?null:'menu',key);return;}
    if(button?.dataset.signal){const key=button.dataset.signal,metric=button.dataset.metric;setPopup(popup?.type==='status'&&popup.key===key&&popup.metric===metric?null:'status',key,false,metric);return;}
    if(button?.dataset.fetch&&!button.disabled){fetchRepo(button.dataset.fetch,button.dataset.anchor);return;}
    if(button?.dataset.github){setPopup(null);return;}
    if(button?.dataset.inventory){const [key,filter]=button.dataset.inventory.split(':');const c=checkoutFor(key);if(c){setPopup(null);openFolder(c.name,filter);}return;}
    if(event.target.closest('#repository-back')){back();return;}
    const folder=event.target.closest('[data-folder]');if(folder){popup=null;openFolder(folder.dataset.folder);return;}
    if(!event.target.closest('[data-popup]'))setPopup(null);
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    const trigger=event.target.closest('[data-menu]');
    if(trigger&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setPopup('menu',trigger.dataset.menu);const items=[...el('menu-'+trigger.dataset.menu).querySelectorAll('[role=menuitem]:not(:disabled)')];(event.key==='ArrowUp'?items.at(-1):items[0])?.focus({preventScroll:true});return;}
    if(!popup)return;
    if(event.key==='Escape'){event.preventDefault();setPopup(null,null,true);return;}
    if(popup.type!=='menu'||!event.target.closest('[role=menu]'))return;
    if(event.key==='Tab'){setPopup(null,null,true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
    const items=[...el('menu-'+popup.key).querySelectorAll('[role=menuitem]:not(:disabled)')],index=items.indexOf(document.activeElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
  window.addEventListener('popstate',()=>route());window.addEventListener('hashchange',()=>route());
  window.addEventListener('online',poll);window.addEventListener('offline',()=>{connected=false;render();});
  window.addEventListener('resize',positionPanels);window.addEventListener('scroll',positionPanels,{passive:true});
  try{const prior=JSON.parse(localStorage.getItem('web-tools-repositories-snapshot'));if(valid(prior))data=prior;}catch{}
  window.NowRepositories={connection,comparison,branchControl,tools,rootTools,positionPanels,version:()=>JSON.stringify([popup,sending,message,data]),setActive:value=>{const prior=active;if(prior&&!value)positions.set(selected,scrollY);active=value;clearTimeout(timer);clearTimeout(staleTimer);if(active){route(!prior);poll();}else {popup=null;window.TitleTip?.close();window.NowLocalFiles.stop();window.NowLocalFiles.header(false,false);}}};
})();
