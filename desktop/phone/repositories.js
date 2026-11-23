(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const scrollPosition=()=>window.NowViews?.scrollPosition('files')??window.scrollY;
  const restoreScroll=top=>window.NowViews?.scrollTo?window.NowViews.scrollTo(top,'files'):window.scrollTo(0,top);
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
    queue:svg('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'),
    observation:svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    repository:svg('<path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2V5Zm0 12h16M8 3v14"/>'),
    more:svg('<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'),
    external:svg('<path d="M14 4h6v6M20 4 10 14M10 4H5v16h15V14"/>')};
  const valid=value=>value?.schemaVersion===1&&Number.isFinite(Date.parse(value.observedAt))&&Array.isArray(value.repositories)&&value.repositories.length<=256
    &&Array.isArray(value.refreshing)&&value.repositories.every(r=>/^[a-f0-9]{24}$/.test(r.key)&&typeof r.name==='string'&&Array.isArray(r.checkouts)&&r.checkouts.length<=256
      &&r.checkouts.every(c=>/^[a-f0-9]{24}$/.test(c.key)&&typeof c.name==='string'&&typeof c.branch==='string'&&c.tracked&&window.NowLocalFiles.valid(c.localFiles,c.key)));
  let data,progress=null,active=false,connected=false,pending=false,timer,staleTimer,etag='',failed=false,denied=false,sending='',message='',selected='',selectedRoot='downloads',selectedFile='',popup=null;
  let pollController,liveEpoch=0;
  const positions=new Map();
  const locations=new Map(),blockedLocations=new Set();
  const locationRoots=['downloads','gh','outputs'];
  let pendingFilePosition;
  const routeKey=()=>selectedRoot+'\0'+(selectedFile?'file:'+selectedFile:'folder:'+selected);
  const fresh=()=>connected&&navigator.onLine!==false&&data&&Date.now()-Date.parse(data.observedAt)<45000;
  const repoFor=checkout=>data?.repositories.find(r=>r.checkouts.some(c=>c.key===checkout.key));
  const checkoutFor=key=>data?.repositories.flatMap(r=>r.checkouts).find(c=>c.key===key);
  const safeUrl=repo=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo?.url||'')?repo.url:null;
  const apiConnected=()=>connected&&navigator.onLine!==false;
  const liveProgress=()=>apiConnected()?progress:null;
  const busy=repo=>sending==='all'||sending===repo?.key||apiConnected()&&data?.refreshing.includes(repo?.key);
  const checkAge=repo=>repo?.checkedAt?'GitHub checked '+ago(repo.checkedAt)+' ('+stamp(repo.checkedAt)+').':'GitHub has not been checked.';
  const mainSyncReasons={
    'fetch-stale':'the GitHub fetch was no longer fresh',
    'invalid-source':'the GitHub source could not be validated',
    'no-default-worktree':'no local default-branch folder was found',
    'ambiguous-default-worktree':'the default-branch folder could not be selected unambiguously',
    'identity-changed':'the repository or branch changed during the check',
    'refs-changed':'Git references changed during the check',
    'git-unavailable':'Git was unavailable',
    'git-operation':'another Git operation was in progress',
    'updater-busy':'another automatic update was in progress',
    'local-changes':'the folder had local changes',
    'ignored-collision':'ignored local data would be overwritten',
    'index-flags':'special Git index settings require review',
    'sparse-checkout':'the folder uses a sparse checkout',
    'local-commits':'the local branch had commits outside the fetched default branch',
    'history-unavailable':'the commit history could not be compared',
    'active-session':'session activity was detected in the folder',
    'activity-unavailable':'session activity could not be checked',
    'activity-uncertain':'session activity could not be matched confidently',
    'fetch-failed':'the GitHub fetch failed',
    'update-unavailable':'the update result could not be confirmed',
    'merge-failed':'the update command did not finish successfully',
    'verification-failed':'the resulting checkout could not be verified',
    'post-update-changes':'local changes were detected after the update'
  };
  function mainSyncDetail(repo,checkout){
    const value=repo?.mainSync;
    if(!value||!['current','updated','blocked','failed'].includes(value.state)||!utc(value.checkedAt)
      ||value.updatedAt!=null&&!utc(value.updatedAt)||value.reason!=null&&(typeof value.reason!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(value.reason)))return null;
    const folder=value.folder;
    if(folder!=null&&(typeof folder!=='string'||!folder.length||folder.length>256||/[\\/\u0000-\u001f:]/.test(folder)||['.','..'].includes(folder)))return null;
    const defaultBranch=checkout?.main?.branch,onDefault=checkout&&checkout.branch!=='(detached)'&&(checkout.branch===defaultBranch||!defaultBranch&&checkout.branchStatus?.state==='main');
    if(folder!=null&&(folder!==checkout?.name||!onDefault))return null;
    if(folder==null&&['current','updated'].includes(value.state))return null;
    const subject=folder?'Default folder '+folder:'Repository automatic update',action=folder?'Automatic update of '+folder:'Repository automatic update';
    const reason=Object.hasOwn(mainSyncReasons,value.reason)?mainSyncReasons[value.reason]:'a safe update could not be confirmed';
    const summary=value.state==='current'?subject+' was current at the automatic check.':value.state==='updated'?subject+' was updated automatically.':action+' '+(value.state==='blocked'?'was blocked':'failed')+': '+reason+'.';
    const checked='Automatic check '+ago(value.checkedAt)+' ('+stamp(value.checkedAt)+').';
    const updated=value.updatedAt?'Last automatic update '+ago(value.updatedAt)+' ('+stamp(value.updatedAt)+').':'';
    return {folder,summary,time:[checked,updated].filter(Boolean).join(' '),text:[summary,checked,updated].filter(Boolean).join(' '),attention:['blocked','failed'].includes(value.state)};
  }
  const utc=value=>typeof value==='string'&&/(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)>0&&Date.parse(value)<=Date.now()+30000;
  function syncJob(value,phase){
    if(!value||typeof value!=='object'||!/^[a-f0-9]{24}$/.test(value.key)||!['check','update'].includes(value.mode)||!utc(value.queuedAt))return null;
    const started=value.startedAt,finished=value.finishedAt,outcome=value.outcome;
    if(started!==null&&(!utc(started)||Date.parse(started)<Date.parse(value.queuedAt))
      ||finished!==null&&(!utc(finished)||!started||Date.parse(finished)<Date.parse(started)))return null;
    if(phase==='queued'&&(started!==null||finished!==null||outcome!==null)
      ||phase==='active'&&(!started||finished!==null||outcome!==null)
      ||phase==='finished'&&(!started||!finished||!['checked','failed','unconfirmed'].includes(outcome)))return null;
    return {key:value.key,mode:value.mode,queuedAt:value.queuedAt,startedAt:started,finishedAt:finished,outcome};
  }
  function syncMetadata(value){
    if(!value||typeof value!=='object'||!Array.isArray(value.queued)||!Array.isArray(value.awaitingObservation)
      ||value.queued.length>256||value.awaitingObservation.length>256||typeof value.scanning!=='boolean'
      ||value.scanStartedAt!==null&&!utc(value.scanStartedAt)||value.scanning&&!value.scanStartedAt)return null;
    const active=value.active===null?null:syncJob(value.active,'active'),lastCompleted=value.lastCompleted===null?null:syncJob(value.lastCompleted,'finished');
    const queued=value.queued.map(job=>syncJob(job,'queued')),awaitingObservation=value.awaitingObservation.map(job=>syncJob(job,'finished'));
    if(value.active!==null&&!active||value.lastCompleted!==null&&!lastCompleted||queued.some(job=>!job)||awaitingObservation.some(job=>!job))return null;
    const keys=[...(active?[active]:[]),...queued,...awaitingObservation].map(job=>job.key);
    if(new Set(keys).size!==keys.length)return null;
    return {active,queued,awaitingObservation,lastCompleted,scanning:value.scanning,scanStartedAt:value.scanStartedAt};
  }
  const repoName=key=>data?.repositories.find(repo=>repo.key===key)?.name.split('/').at(-1)||'Repository';
  const elapsed=value=>{const seconds=Math.max(0,Math.floor((Date.now()-Date.parse(value))/1000));return seconds<60?seconds+'s':Math.floor(seconds/60)+'m';};
  function syncAttention(){
    return (data?.repositories||[]).flatMap(repo=>{
      const checkout=repo.mainSync?.folder?repo.checkouts.find(row=>row.name===repo.mainSync.folder):repo.checkouts[0];
      const detail=mainSyncDetail(repo,checkout);
      return detail?.attention?[{repo,checkout,detail}]:[];
    });
  }
  const guidance=reason=>({
    'active-session':'Finish the active work before the next automatic check.',
    'activity-uncertain':'Review session activity before updating this folder.',
    'activity-unavailable':'Restore session readings before an automatic update can proceed.',
    'local-changes':'Review the local files first. Automatic updates preserve local work.',
    'ignored-collision':'Move or review the colliding local data before updating.',
    'local-commits':'Review the local commits before updating this folder.',
    'index-flags':'Review the Git index settings in this folder.',
    'sparse-checkout':'Review the sparse checkout before updating.',
    'git-operation':'Let the current Git operation finish; a later scheduled check can retry.',
    'updater-busy':'Let the current automatic check finish.',
    'fetch-failed':'Check the laptop’s GitHub connection. A later scheduled check can retry.',
    'git-unavailable':'Check Git on the laptop, then let the scheduled check retry.',
    'no-default-worktree':'Keep a clean default-branch folder available for automatic updates.',
    'ambiguous-default-worktree':'Review which default-branch folder should be kept current.',
    'post-update-changes':'Review the folder and its local changes before continuing.'
  })[reason]||'Review the folder before updating. A later scheduled check will recheck safety.';
  function syncFolder(repo,checkout,label,focus){
    const target=checkout||repo?.checkouts.find(row=>row.branch===row.main?.branch)||repo?.checkouts[0];
    if(!target)return `<span class="min-w-0 break-words">${escape(label)}</span>`;
    return `<a data-folder="${escape(target.name)}" data-focus="${escape(focus)}" href="${escape(folderRoute(target.name,'gh'))}" class="min-w-0 break-words text-emerald-800 underline decoration-emerald-200 underline-offset-2">${escape(label)}</a>`;
  }
  function syncPanel(){
    if(popup?.type!=='sync')return '';
    const sync=liveProgress(),attention=syncAttention(),observation=data?'Folder observation '+ago(data.observedAt)+' ('+stamp(data.observedAt)+').':'No folder observation available.';
    const line=(job,label,time)=>{const repo=data?.repositories.find(row=>row.key===job.key);return `<li class="flex items-start justify-between gap-3 py-1.5"><span class="min-w-0">${syncFolder(repo,null,repoName(job.key),'sync:job:'+job.key)}<span class="block text-[11px] text-stone-500">${escape(job.mode==='update'?'Automatic check':'Manual GitHub check')}</span></span><span class="shrink-0 text-right text-[11px] text-stone-500">${escape(label)}<span class="block">${escape(time)}</span></span></li>`;};
    const completed=sync?.lastCompleted,outcome=completed&&({checked:'Check finished',failed:'Check failed',unconfirmed:'Result unconfirmed'})[completed.outcome];
    return `<section id="repository-sync-panel" data-popup="sync:all" role="region" aria-label="Repository sync" class="absolute left-0 top-full z-30 mt-1 w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs leading-5 shadow-lg"><h2 class="font-medium text-stone-900">Repository sync</h2><p class="text-[11px] text-stone-500">${escape(observation)}</p>`
      +(!sync?`<p class="py-2 text-stone-600">${apiConnected()?'Live sync status unavailable.':'Saved observations. Current sync activity is unavailable.'}</p>`:`<ul class="divide-y divide-stone-100">${sync.active?line(sync.active,'Checking',elapsed(sync.active.startedAt)):''}${sync.queued.map(job=>line(job,'Queued',ago(job.queuedAt))).join('')}${sync.awaitingObservation.map(job=>line(job,'Awaiting reading',ago(job.finishedAt))).join('')}</ul>${sync.scanning?`<p class="py-1 text-stone-600">Reading folders · ${escape(elapsed(sync.scanStartedAt))}</p>`:''}${!sync.active&&!sync.queued.length&&!sync.awaitingObservation.length&&!sync.scanning?'<p class="py-1 text-stone-600">No check running.</p>':''}${completed?`<p class="mt-1 border-t border-stone-100 pt-2 text-stone-600">${escape(outcome)} · ${escape(repoName(completed.key))}<span class="block text-[11px] text-stone-500">${escape(ago(completed.finishedAt)+' ('+stamp(completed.finishedAt)+')')}</span></p>`:''}`)
      +(attention.length?`<h3 class="mt-2 border-t border-stone-100 pt-2 font-medium text-amber-800">Needs attention · ${attention.length}</h3><ul class="divide-y divide-stone-100">${attention.map(({repo,checkout,detail})=>`<li class="py-2">${syncFolder(repo,checkout,repo.name.split('/').at(-1),'sync:attention:'+repo.key)}<p class="text-amber-800">${escape(detail.summary)}</p><p class="text-[11px] text-stone-500">${escape(detail.time)}</p><p class="mt-1 text-stone-600">${escape(guidance(repo.mainSync.reason))}</p></li>`).join('')}</ul>`:'')
      +'<p class="mt-2 border-t border-stone-100 pt-2 text-[11px] text-stone-500">Manual Check GitHub refreshes comparisons only. A completed check does not mean a folder was updated.</p></section>';
  }
  function syncStrip(){
    const sync=liveProgress(),attention=syncAttention(),open=popup?.type==='sync';
    const label=sync?.active?'Checking '+repoName(sync.active.key)+' · '+elapsed(sync.active.startedAt):sync?.scanning?'Reading folders · '+elapsed(sync.scanStartedAt):sync?.awaitingObservation.length?'Awaiting folder reading':sync?.queued.length?'Checks queued':sync?'No check running':apiConnected()?'Sync status unavailable':'Saved sync status';
    const queued=sync?.queued.length||0,waiting=sync?.awaitingObservation.length||0;
    const title=[label,queued?queued+' queued':'',waiting?waiting+' awaiting reading':'',attention.length?attention.length+' need attention':''].filter(Boolean).join('. ');
    return `<div class="relative mt-2"><button data-sync-strip data-focus="all:sync" aria-label="${escape(title)}" aria-expanded="${open}" aria-controls="repository-sync-panel" class="flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-[11px] text-stone-600 focus-visible:outline-2 focus-visible:outline-sky-700"><span class="shrink-0 ${sync?.active?'motion-safe:animate-spin':''}">${icons.refresh}</span><span class="min-w-0 flex-1 truncate">${escape(label)}</span>${queued?`<span class="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">${icons.queue}${queued}</span>`:''}${waiting?`<span class="inline-flex shrink-0 items-center gap-0.5 tabular-nums" aria-hidden="true">${icons.observation}${waiting}</span>`:''}${attention.length?`<span class="inline-flex shrink-0 items-center gap-0.5 text-amber-700" aria-hidden="true">${icons.warning}${attention.length}</span>`:''}</button>${syncPanel()}</div>`;
  }
  function syncSignal(repo,checkout){
    const sync=liveProgress();if(!sync||!repo||selectedRoot!=='gh'||selected||selectedFile)return '';
    const phase=sync.active?.key===repo.key?'checking':sync.queued.some(job=>job.key===repo.key)?'queued':sync.awaitingObservation.some(job=>job.key===repo.key)?'awaiting':null;
    if(!phase)return '';
    const label=({checking:'Checking GitHub',queued:'GitHub check queued',awaiting:'Check finished; awaiting folder reading'})[phase]+' for '+repoName(repo.key);
    return `<button data-sync-phase="${phase}" data-sync-key="${repo.key}" data-focus="${checkout.key}:sync" aria-label="${escape(label)}" aria-haspopup="true" aria-expanded="${popup?.type==='sync'}" aria-controls="repository-sync-panel" class="inline-flex min-h-10 w-6 shrink-0 items-center justify-center text-sky-700 ${phase==='checking'?'motion-safe:animate-pulse':''}">${phase==='checking'?icons.refresh:phase==='queued'?icons.queue:icons.observation}</button>`;
  }
  function connection(){
    if(!active)return;
    el('connection').textContent=denied?'Access unavailable':apiConnected()?'Connected':data?'Saved':failed?'Offline':'Connecting…';
    el('connection').removeAttribute('title');
    el('connection').setAttribute('aria-label',apiConnected()?'Connected to '+(data?.machineName||'the laptop'):data?'Saved laptop observation from '+stamp(data.observedAt):el('connection').textContent);
  }
  function comparison(value,key,compact=false){
    const checkout=checkoutFor(key.split(':')[0]),repo=checkout&&repoFor(checkout),update=mainSyncDetail(repo,checkout),upstream=checkout?.upstream?.startsWith('origin/')?checkout.upstream.slice(7):'',age=checkAge(repo)+(repo?.notice?' '+repo.notice:'')+(upstream&&upstream!==value?.branch?' Configured upstream: GitHub '+upstream+'.':'')+(update?.folder?' '+update.text:'');
    const warning=tip=>`<span data-commit="${key}:state" tabindex="0" data-title-tip="${escape(tip)}" aria-label="${escape(tip)}" class="inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center text-amber-700">${icons.warning}</span>`;
    if(compact&&repo?.notice)return warning(age);
    if(compact&&value?.ahead===0&&value?.behind===0)return '';
    if(Number.isInteger(value?.ahead)&&Number.isInteger(value?.behind))return `<span class="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium tabular-nums">${['ahead','behind'].filter(direction=>!compact||value[direction]).map(direction=>{
      const n=value[direction],label=compact&&n>=1000?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n).toLowerCase():n.toLocaleString(),tip=`${n.toLocaleString()} ${n===1?'commit':'commits'} ${direction==='ahead'?'ahead of':'behind'} GitHub ${value.branch||'tracking branch'}. ${age}`;
      return `<span data-commit="${key}:${direction}" tabindex="0" data-title-tip="${escape(tip)}" aria-label="${escape(tip)}" class="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center gap-0.5 ${n?direction==='ahead'?'text-[color:var(--color-success,#047857)]':'text-amber-700':'text-stone-500'}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3" aria-hidden="true"><path d="${direction==='ahead'?'M8 13V3m-4 4 4-4 4 4':'M8 3v10m-4-4 4 4 4-4'}"/></svg><span aria-hidden="true">${label}</span></span>`;
    }).join('')}</span>`;
    const target='GitHub '+(value?.branch||'tracking branch');
    const tip=({'no-upstream':'No tracked GitHub branch is configured.','unrelated-history':`The local branch and ${target} have separate commit histories.`,'incomplete-history':`Limited history prevents comparison with ${target}.`,'remote-missing':`${target} was absent at the last check.`,'not-checked':`${target} has not been checked.`,'fetch-needed':`Check GitHub to compare with ${target}.`})[value?.state]||`Could not compare with ${target}.`;
    return warning(tip+' '+age);
  }
  function branchControl(checkout,asRepository=false){
    const meta=checkout.branchStatus||{},state=asRepository?'main':meta.state||'unknown';
    const kind=({main:['branch','text-stone-500','Default branch'],snapshot:['check','text-sky-700','Default-branch snapshot'],open:['pull','text-sky-700','Open pull request'],merged:['merged','text-violet-700','Merged pull request'],incorporated:['check','text-emerald-700','Included in GitHub default branch'],review:['branch','text-amber-700','Branch needs review']})[state]||['branch','text-stone-400','Branch status not checked'];
    const open=popup?.type==='branch'&&popup.key===checkout.key,repo=repoFor(checkout),url=safeUrl(repo),update=mainSyncDetail(repo,checkout);
    const href=url&&Number.isInteger(meta.number)&&meta.number>0&&meta.url===url+'/pull/'+meta.number?meta.url:null;
    const detail=state==='snapshot'?'Detached copy of GitHub '+(checkout.main?.branch||'default branch')+'.':state==='review'?meta.pullRequestState==='merged'?'The PR merged; local history still needs review.':meta.pullRequestState==='closed'?'The PR closed without merging.':'No pull request found for this branch.':'';
    const known=Number.isInteger(checkout.tracked.ahead)&&Number.isInteger(checkout.tracked.behind),sync=known?checkout.tracked.ahead===0&&checkout.tracked.behind===0?'In sync':checkout.tracked.ahead.toLocaleString()+' ahead · '+checkout.tracked.behind.toLocaleString()+' behind':'Comparison unavailable';
    const iconTone=asRepository?(update?.attention?'text-amber-700':'text-emerald-700'):kind[1];
    const label=kind[2]+' for '+checkout.branch+' in '+checkout.name+(update?'. '+update.text:'');
    return `<span class="relative inline-flex shrink-0 ${asRepository?'self-stretch items-center':''}"><button data-branch-signal="${checkout.key}" data-focus="${checkout.key}:branch" aria-label="${escape(label)}" aria-expanded="${open}" aria-haspopup="true" aria-controls="branch-${checkout.key}" class="inline-flex ${asRepository?'min-h-10 w-6':'size-5'} ${iconTone} shrink-0 items-center justify-center ${open?'rounded bg-stone-100 ring-1 ring-current':''}">${icons[asRepository?'repository':kind[0]]}</button>`
      +`<span id="branch-${checkout.key}" data-popup="branch:${checkout.key}" ${open?'':'hidden'} role="region" aria-label="Branch status for ${escape(checkout.name)}" class="absolute left-0 ${asRepository?'top-10':'top-6'} z-30 block w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-normal leading-5 shadow-lg"><span class="block font-medium ${kind[1]}">${kind[2]}</span>`
      +(asRepository?`<span class="block font-medium text-stone-800">${escape(checkout.name)}</span><span class="block text-stone-600">${escape(checkout.branch)}</span>`:'')
      +(meta.title?`<span class="mt-1 block text-stone-700">${escape(meta.title)}</span>`:'')
      +(href?`<a href="${href}" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-8 items-center gap-1 text-sky-800">PR ${meta.number}${icons.external}</a>`:'')
      +(detail?`<span class="block text-stone-600">${escape(detail)}</span>`:'')
      +`<span class="block text-stone-600">${escape(checkout.tracked.branch?'Compared with GitHub '+checkout.tracked.branch:'No GitHub comparison target')}</span>`
      +(asRepository?`<span class="block text-stone-600">${escape(sync)}</span>${repo?.notice?`<span class="block text-amber-800">${escape(repo.notice)}</span>`:''}`:'')
      +(update?`<span data-main-sync class="mt-1 block border-t border-stone-100 pt-1 ${update.attention?'text-amber-800':'text-stone-600'}">${escape(update.summary)}</span><span class="block text-[10px] text-stone-500">${escape(update.time)}</span>`:'')
      +(asRepository?`<span class="mt-1 block border-t border-stone-100 pt-1 text-[10px] text-stone-500">${escape(checkAge(repo))}</span>`:'')
      +(!asRepository&&meta.checkedAt?`<span class="mt-1 block border-t border-stone-100 pt-1 text-[10px] text-stone-500">Checked ${escape(ago(meta.checkedAt))}</span>`:'')
      +'</span></span>';
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
    return `<div class="relative flex shrink-0 items-center">${syncSignal(repo,checkout)}${status(checkout)}${url?`<button data-menu="${checkout.key}" data-focus="${checkout.key}:menu" aria-label="Actions for ${escape(checkout.name)}" aria-haspopup="menu" aria-expanded="${popup?.type==='menu'&&popup.key===checkout.key}" aria-controls="menu-${checkout.key}" class="flex min-h-10 w-10 shrink-0 items-center justify-center ${stale?'text-amber-700':'text-stone-500'} ${popup?.type==='menu'&&popup.key===checkout.key?'rounded-md bg-stone-100':''}">${icons.more}</button><div id="menu-${checkout.key}" data-popup="menu:${checkout.key}" ${popup?.type==='menu'&&popup.key===checkout.key?'':'hidden'} role="menu" aria-label="Actions for ${escape(checkout.name)}" class="absolute right-1 top-10 z-30 w-48 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"><button role="menuitem" data-fetch="${repo.key}" data-anchor="${checkout.key}" data-focus="${checkout.key}:fetch" ${fresh()&&!sending&&!working?'':'disabled'} class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-sky-800 hover:bg-stone-50 disabled:text-stone-400">${icons.refresh}Check GitHub</button><a role="menuitem" data-github="${checkout.key}" data-focus="${checkout.key}:github" href="${href}" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-sky-800 hover:bg-stone-50">${icons.external}Open on GitHub</a></div>`:''}${statusPanel(checkout)}${resultPanel(checkout.key)}</div>`;
  }
  function resultPanel(key){return popup?.type==='result'&&popup.key===key?`<div data-popup="result:${key}" role="status" class="absolute right-1 top-10 z-30 w-52 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-lg">${escape(message)}</div>`:'';}
  function rootTools(){
    const working=sending||apiConnected()&&data?.refreshing.length;
    return `<div class="relative"><button data-fetch="all" data-anchor="all" data-focus="all:fetch" aria-label="Check all repositories on GitHub" aria-busy="${Boolean(working)}" ${fresh()&&!working&&data.repositories.some(r=>safeUrl(r))?'':'disabled'} class="flex size-10 shrink-0 items-center justify-center text-stone-500 disabled:text-stone-400"><span class="${working?'animate-spin':''}">${icons.refresh}</span></button>${resultPanel('all')}</div>`;
  }
  function refresh(){window.NowLocalFiles.refresh();}
  function positionPanels(){
    if(!active||!popup)return;
    const panel=el('repositories').querySelector('[data-popup]:not([hidden])');if(!panel)return;
    panel.style.top='';panel.style.bottom='';
    panel.style.overflowY='auto';
    if(popup.type==='sync'){const anchor=[...el('repositories').querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===(popup.anchor||'all:sync'))||el('repositories').querySelector('[data-sync-strip]');const rect=anchor?.getBoundingClientRect();panel.style.position='fixed';panel.style.left='12px';const below=innerHeight-(rect?.bottom||60)-12,above=(rect?.top||60)-64;if(below<240&&above>below){panel.style.top='auto';panel.style.bottom=Math.max(12,innerHeight-(rect?.top||60)+4)+'px';panel.style.maxHeight=Math.max(120,above-8)+'px';}else{panel.style.top=Math.max(60,Math.min(rect?.bottom+4||60,innerHeight-140))+'px';panel.style.maxHeight=Math.max(120,innerHeight-parseFloat(panel.style.top)-12)+'px';}return;}
    panel.style.maxHeight=Math.max(120,innerHeight-80)+'px';
    const rect=panel.getBoundingClientRect();if(rect.height&&rect.bottom>innerHeight-8){panel.style.top='auto';panel.style.bottom='100%';}
  }
  function setPopup(type,key,restore=false,metric=''){
    if(!type&&!popup)return;
    const prior=popup;popup=type?{type,key,metric}:null;refresh();
    if(restore&&prior){const focus=prior.type==='sync'?prior.anchor||'all:sync':prior.key+':'+(prior.type==='status'?'signal:'+prior.metric:prior.type==='branch'?'branch':prior.key==='all'?'fetch':'menu');(el('repositories').querySelector(`[data-focus="${focus}"]`)||(prior.type==='sync'?el('repositories').querySelector('[data-sync-strip]'):null))?.focus({preventScroll:true});}
  }
  function render(){
    if(!active)return;
    if(!data&&denied){window.NowLocalFiles.stop(true);window.TitleTip?.close();el('repositories').innerHTML='<p class="px-3 py-4 text-sm text-stone-500">Access unavailable. Connect with your Tailscale account.</p>';connection();return;}
    if(data)el('machine').textContent=data.machineName;
    window.NowLocalFiles.render(data||{repositories:[]},selected,fresh(),{root:selectedRoot,file:selectedFile});connection();
    clearTimeout(staleTimer);if(fresh())staleTimer=setTimeout(render,Math.max(1,45000-(Date.now()-Date.parse(data.observedAt))));
  }
  function suspendProgress(){connected=false;progress=null;etag='';liveEpoch++;pollController?.abort();pollController=null;pending=false;}
  async function poll(){
    clearTimeout(timer);if(!active||pending||document.hidden)return;pending=true;
    const epoch=liveEpoch,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);pollController=controller;
    try{
      const response=await fetch('/api/v1/repositories',{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
      if(epoch!==liveEpoch||!active||document.hidden)return;
      denied=response.status===403;if(denied){data=undefined;progress=null;etag='';localStorage.removeItem('web-tools-repositories-snapshot');}
      if(response.status!==304){if(!response.ok)throw new Error();const value=await response.json();if(!valid(value))throw new Error();if(epoch!==liveEpoch||!active||document.hidden)return;progress=syncMetadata(value.sync);data={...value};delete data.sync;etag=response.headers.get('ETag')||'';try{localStorage.setItem('web-tools-repositories-snapshot',JSON.stringify({...data,refreshing:[]}));}catch{}}
      connected=true;failed=false;
    }catch{if(epoch===liveEpoch){connected=false;progress=null;etag='';failed=true;}}
    finally{clearTimeout(timeout);if(pollController===controller){pending=false;pollController=null;}if(epoch===liveEpoch){route();if(active&&!document.hidden)timer=setTimeout(poll,failed?15000:3000);}}
  }
  async function fetchRepo(key,anchor){
    if(!fresh()||sending||document.hidden)return;sending=key;popup=null;message='';render();
    const path=selected,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
    try{const response=await fetch('/api/v1/repositories/'+key+'/fetch',{method:'POST',headers:{'X-WebTools-Action':'1'},cache:'no-store',signal:controller.signal});message=response.status===202?'GitHub check queued.':response.status===409?'Already checking GitHub.':'GitHub check unavailable.';
      if(response.status===403){data=undefined;progress=null;etag='';denied=true;connected=false;localStorage.removeItem('web-tools-repositories-snapshot');}
    }catch{message='Could not confirm the GitHub check.';connected=false;progress=null;}
    finally{clearTimeout(timeout);sending='';if(active&&path===selected&&data)popup={type:'result',key:anchor};render();poll();}
  }
  function route(enter=false){
    if(!active)return;
    const params=new URLSearchParams(location.hash.slice(1));if(!['files','repositories'].includes(params.get('view')))return;
    // Existing folder, file and checkout links predate named roots and mean gh.
    const legacy=params.get('view')==='repositories'||['folder','file','checkout','filter'].some(key=>params.has(key));
    const root=params.get('root')||(legacy?'gh':'downloads'),file=params.get('file')||'',key=params.get('checkout');
    const next=file?file.split('/').slice(0,-1).join('/'):params.get('folder')??(root==='gh'?checkoutFor(key)?.name:null)??'';
    if(next!==selected||root!==selectedRoot||file!==selectedFile){
      if(!enter)positions.set(routeKey(),scrollPosition());
      selected=next;selectedRoot=root;selectedFile=file;popup=null;window.TitleTip?.close();
      const top=positions.get(routeKey())||0;pendingFilePosition=selectedFile?{key:routeKey(),top}:undefined;
      render();restoreScroll(top);
    }else {
      if(enter)pendingFilePosition=selectedFile?{key:routeKey(),top:positions.get(routeKey())||0}:undefined;
      render();if(enter)restoreScroll(positions.get(routeKey())||0);
    }
    window.NowLocalFiles.setFilter(params.get('filter')||'all');
    rememberLocation();
    window.NowViews?.refreshContext?.();
  }
  function folderRoute(path,root=selectedRoot,filter='all'){
    const params=new URLSearchParams({view:'files',root});if(path)params.set('folder',path);if(filter!=='all')params.set('filter',filter);
    return '#'+params;
  }
  function openFolder(path,filter='all',root=selectedRoot){
    if(!selectedFile&&path===selected&&root===selectedRoot&&filter===window.NowLocalFiles.filter()){refresh();return;}
    const hash=folderRoute(path,root,filter);
    history.pushState({localFiles:true,filesBack:location.hash},'',hash);route();
  }
  function openFile(path){
    const params=new URLSearchParams({view:'files',root:selectedRoot});params.set('file',path);
    history.pushState({localFiles:true,filesBack:location.hash},'','#'+params);route();
  }
  function rememberLocation(verified=false){
    if(!active||!locationRoots.includes(selectedRoot))return;
    if(verified)blockedLocations.delete(selectedRoot);
    if(blockedLocations.has(selectedRoot))return;
    const params=new URLSearchParams({view:'files',root:selectedRoot});
    if(selectedFile)params.set('file',selectedFile);
    else {if(selected)params.set('folder',selected);const filter=window.NowLocalFiles.filter();if(filter!=='all')params.set('filter',filter);}
    locations.set(selectedRoot,'#'+params);
  }
  function clearLocations(){locations.clear();positions.clear();pendingFilePosition=undefined;for(const root of locationRoots)blockedLocations.add(root);}
  function fileLayout(ready=false){
    if(!active||!selectedFile)return;
    const key=routeKey();
    if(!ready){if(pendingFilePosition?.key!==key)pendingFilePosition={key,top:scrollPosition()};return;}
    if(pendingFilePosition?.key===key){const {top}=pendingFilePosition;pendingFilePosition=undefined;restoreScroll(top);}
  }
  function switchRoot(root){
    if(!locationRoots.includes(root)||root===selectedRoot)return;
    rememberLocation();
    history.pushState({localFiles:true},'',locations.get(root)||folderRoute('',root));route();
    el('repositories').querySelector(`[data-file-root="${root}"]`)?.focus({preventScroll:true});
  }
  function isParent(hash,path){
    if(typeof hash!=='string')return false;
    const params=new URLSearchParams(hash.replace(/^#/,''));
    const legacy=params.get('view')==='repositories'||['folder','file','checkout','filter'].some(key=>params.has(key));
    const root=params.get('root')||(legacy?'gh':'downloads');
    const folder=params.get('folder')??(root==='gh'?checkoutFor(params.get('checkout'))?.name:null)??'';
    return ['files','repositories'].includes(params.get('view'))&&root===selectedRoot&&!params.get('file')&&folder===path;
  }
  function back(){
    if(!selectedFile&&!selected)return;
    const parent=selectedFile?selected:selected.split('/').slice(0,-1).join('/');
    if(history.state?.localFiles&&isParent(history.state.filesBack,parent)){history.back();return;}
    history.replaceState(null,'',folderRoute(parent));route();
  }
  document.addEventListener('click',event=>{
    if(!active)return;
    const locationTab=event.target.closest('[data-file-root]');
    if(locationTab){switchRoot(locationTab.dataset.fileRoot);return;}
    const syncTrigger=event.target.closest('[data-sync-strip],[data-sync-phase]');if(syncTrigger){setPopup(popup?.type==='sync'?null:'sync','all');if(popup?.type==='sync'){popup.anchor=syncTrigger.dataset.focus;positionPanels();}return;}
    const button=event.target.closest('[data-menu],[data-signal],[data-branch-signal],[data-fetch],[data-github],[data-inventory]');
    if(button?.dataset.branchSignal){const key=button.dataset.branchSignal;setPopup(popup?.type==='branch'&&popup.key===key?null:'branch',key);return;}
    if(button?.dataset.menu){const key=button.dataset.menu;setPopup(popup?.type==='menu'&&popup.key===key?null:'menu',key);return;}
    if(button?.dataset.signal){const key=button.dataset.signal,metric=button.dataset.metric;setPopup(popup?.type==='status'&&popup.key===key&&popup.metric===metric?null:'status',key,false,metric);return;}
    if(button?.dataset.fetch&&!button.disabled){fetchRepo(button.dataset.fetch,button.dataset.anchor);return;}
    if(button?.dataset.github){setPopup(null);return;}
    if(button?.dataset.inventory){const [key,filter]=button.dataset.inventory.split(':');const c=checkoutFor(key);if(c){setPopup(null);openFolder(c.name,filter);}return;}
    if(event.target.closest('#repository-back')){back();return;}
    const folder=event.target.closest('[data-folder]');if(folder){popup=null;openFolder(folder.dataset.folder);return;}
    const file=event.target.closest('[data-file]');if(file){popup=null;openFile(file.dataset.file);return;}
    if(!event.target.closest('[data-popup]'))setPopup(null);
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    const trigger=event.target.closest('[data-menu]');
    if(trigger&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setPopup('menu',trigger.dataset.menu);const items=[...el('menu-'+trigger.dataset.menu).querySelectorAll('[role=menuitem]:not(:disabled)')];(event.key==='ArrowUp'?items.at(-1):items[0])?.focus({preventScroll:true});return;}
    if(!popup){if(selectedFile&&event.key==='Escape'){event.preventDefault();back();}return;}
    if(event.key==='Escape'){event.preventDefault();setPopup(null,null,true);return;}
    if(popup.type!=='menu'||!event.target.closest('[role=menu]'))return;
    if(event.key==='Tab'){setPopup(null,null,true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
    const items=[...el('menu-'+popup.key).querySelectorAll('[role=menuitem]:not(:disabled)')],index=items.indexOf(document.activeElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);suspendProgress();render();if(!document.hidden)poll();});
  window.addEventListener('popstate',()=>route());window.addEventListener('hashchange',()=>route());
  window.addEventListener('online',poll);window.addEventListener('offline',()=>{suspendProgress();render();});
  window.addEventListener('resize',positionPanels);window.addEventListener('scroll',positionPanels,{passive:true});
  try{const prior=JSON.parse(localStorage.getItem('web-tools-repositories-snapshot'));if(valid(prior)){data={...prior,refreshing:[]};delete data.sync;}}catch{}
  function context(){
    if(selectedRoot!=='gh')return null;
    const checkout=data?.repositories.flatMap(r=>r.checkouts).filter(c=>selected===c.name||selected.startsWith(c.name+'/')).sort((a,b)=>b.name.length-a.name.length)[0];
    const repo=checkout&&repoFor(checkout),url=safeUrl(repo);
    if(!url)return null;
    const comparison=checkout.tracked,path=selected.slice(checkout.name.length).replace(/^\//,'');
    const established=comparison?.branch&&['current','ahead','behind','diverged','incomplete-history','fetch-needed','unrelated-history','unavailable'].includes(comparison.state);
    const ref=established?comparison.branch:null;
    const localOnly=(checkout.localFiles?.entries||[]).some(entry=>{
      const prefix=entry.path.replace(/\/$/,'');
      return entry.kind==='folder'&&['ignored','untracked'].includes(entry.gitState)&&(path===prefix||path.startsWith(prefix+'/'));
    });
    const trackedPath=!path||!localOnly&&comparison.ahead===0&&checkout.changed===0&&checkout.branch===ref&&window.NowLocalFiles.gitState?.(selected)==='tracked';
    return {repo:new URL(url).pathname.slice(1),ref,path:trackedPath?path:null};
  }
  window.NowRepositories={syncStrip,syncSignal,connection,comparison,branchControl,tools,rootTools,positionPanels,context,rememberLocation,clearLocations,fileLayout,version:()=>JSON.stringify([popup,sending,message,data,apiConnected(),progress,progress?.active?elapsed(progress.active.startedAt):null,progress?.scanning?elapsed(progress.scanStartedAt):null]),setActive:value=>{const prior=active;if(prior!==value)suspendProgress();if(prior&&!value)positions.set(routeKey(),scrollPosition());active=value;clearTimeout(timer);clearTimeout(staleTimer);if(active){route(!prior);poll();}else {popup=null;window.TitleTip?.close();window.NowLocalFiles.stop();window.NowLocalFiles.header(false,false);}}};
})();
