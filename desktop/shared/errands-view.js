/* A read-only assistant queue, shared by the installed phone and layout preview. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const providers = ['Codex','Gemini','Claude'];
  const paths = {
    waiting:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    claimed:'M8 12v-5a2 2 0 0 1 4 0v4m0-4a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v6c0 4-3 6-7 6-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l1 1',
    complete:'m5 12 4 4L19 6', failed:'m12 3 10 18H2Zm0 6v5m0 3h.01',
    reply:'M3 12h4l3-8 4 16 3-8h4', laptop:'M5 4h14v12H5Zm-3 16h20',
    cloud:'M7 18a5 5 0 0 1-1-10 7 7 0 0 1 13 2 4 4 0 0 1-1 8Z',
    more:'M12 5h.01M12 12h.01M12 19h.01', errands:'M8 5H5v16h14V5h-3M8 3h8v4H8Zm0 9h8m-8 4h5',
    back:'m14 5-7 7 7 7', open:'M14 4h6v6M20 4 10 14M10 4H4v16h16v-6',
    file:'M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h6'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name==='more'?3:1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.waiting}"/></svg>`;
  const mark = provider => window.assistantMark?.svg(provider.toLowerCase(),{cls:'erl-mark'}) || `<span class="erl-monogram">${esc(provider[0])}</span>`;
  const stamp = value => Number.isFinite(Date.parse(value)) && Date.parse(value)>0 ? new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not recorded';
  const age = value => {
    const at = Date.parse(value); if (!Number.isFinite(at) || at<=0) return '';
    const minutes = Math.max(0,Math.floor((Date.now()-at)/60000));
    return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':new Date(at).toLocaleDateString([], {month:'short',day:'numeric'});
  };
  const group = item => item.state==='queued'?'waiting':['claimed','reply'].includes(item.state)?'taken':'results';
  const label = item => ({queued:'Waiting',claimed:'Taken on',reply:'Reply arriving',complete:'Complete',failed:'Needs review'})[item.state] || 'Recorded';
  const glyph = item => item.state==='queued'?'waiting':item.state;
  const valid = item => item?.kind==='errand' && providers.includes(item.provider) && /^[A-Za-z0-9][A-Za-z0-9.-]{0,95}$/.test(item.id) && !item.id.includes('..');
  const safe = value => {
    const url = window.NowView?.safeLink(value);
    return url?.startsWith('https://mehrlander.github.io/web-tools/') ? url : '';
  };
  let root, snapshot=null, connected=false, denied=false, pending=false, timer, etag='', signature='', active=false;
  let provider='', tab='waiting', query='', selected='', menuId='', resultVersion=0;
  const reports=new Map(), requests=new Map();
  const items = () => (snapshot?.items || []).filter(valid);
  const find = id => items().find(item=>item.id===id);
  const counts = list => ({waiting:list.filter(i=>group(i)==='waiting').length,taken:list.filter(i=>group(i)==='taken').length,results:list.filter(i=>group(i)==='results').length});
  const filtered = () => items().filter(i=>(!provider||i.provider===provider) && (!query||[i.title,i.detail].join(' ').toLowerCase().includes(query.toLowerCase())));
  const visible = () => filtered().filter(i=>group(i)===tab).sort((a,b)=>tab==='waiting'
    ? Date.parse(a.createdAt)-Date.parse(b.createdAt) || a.id.localeCompare(b.id)
    : Date.parse(b.at)-Date.parse(a.at) || a.id.localeCompare(b.id));
  const available = () => !!snapshot?.queueAvailable && !denied;
  const stale = () => !connected || Date.now()-Date.parse(snapshot?.observedAt)>30000 || !snapshot?.recordsConnected;

  const bytes = value => value<1000?`${value} B`:value<1e6?`${(value/1000).toFixed(1)} KB`:`${(value/1e6).toFixed(1)} MB`;
  const https = value => {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  function structuredResult(value){
    if(!Array.isArray(value)||!value.length||value.length>100||!value.every(row=>row&&typeof row==='object'&&!Array.isArray(row)))return '';
    const fileRows=value.every(row=>typeof row.name==='string'&&row.name.trim()&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&(row.error==null||typeof row.error==='string'));
    if(fileRows){
      const total=value.reduce((sum,row)=>sum+row.bytes,0),errors=value.filter(row=>row.error).length;
      if(!Number.isSafeInteger(total))return '';
      return `<section class="erl-data" aria-label="Reported files"><div class="erl-data-summary">${value.length} ${value.length===1?'file':'files'} <span>${esc(bytes(total))}${errors?` · ${errors} with errors`:''}</span></div><ul class="erl-data-list">${value.map(row=>`<li><span class="erl-data-icon ${row.error?'erl-failed':''}" aria-label="${row.error?'Reported error':'File reported'}">${svg(row.error?'failed':'file')}</span><span class="erl-data-name">${esc(row.name)}${row.error?`<span class="erl-data-error">${esc(row.error)}</span>`:''}</span><span class="erl-data-size">${esc(bytes(row.bytes))}</span></li>`).join('')}</ul></section>`;
    }
    const projectRows=value.every(row=>typeof row.project==='string'&&Array.isArray(row.tableau)&&row.tableau.every(link=>typeof link==='string')&&Number.isSafeInteger(row.links)&&row.links>=0&&(row.error==null||typeof row.error==='string'));
    if(projectRows)return `<section class="erl-data" aria-label="Reported projects"><div class="erl-data-summary">${value.length} ${value.length===1?'project':'projects'}</div><ul class="erl-project-list">${value.map(row=>`<li><strong>${esc(row.project)}</strong><span class="erl-project-links">${row.tableau.map(https).filter(Boolean).map(link=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Tableau ${svg('open')}</a>`).join('')}<span>${row.links} ${row.links===1?'link':'links'}</span></span>${row.error?`<span class="erl-data-error">${esc(row.error)}</span>`:''}</li>`).join('')}</ul></section>`;
    return '';
  }
  function reportHtml(body,item){
    const host=document.createElement('div');
    host.innerHTML=window.NowReading?.markdown(body)||`<p>${esc(body)}</p>`;
    const converted=[];
    for(const pre of host.querySelectorAll('pre')){
      try{
        const html=structuredResult(JSON.parse(pre.textContent));if(!html)continue;
        const node=document.createElement('div');node.innerHTML=html;const data=node.firstElementChild;
        pre.replaceWith(data);converted.push(data);
      }catch{/* Unknown or incomplete JSON remains an ordinary code block. */}
    }
    // Some worker replies concatenate an interim update and the final result.
    // Only trim that prefix when explicit Pending/Done markers bracket known data.
    if(item.state==='complete'&&converted.length){
      const nodes=[...host.children],first=nodes.indexOf(converted[0]),last=nodes.indexOf(converted.at(-1));
      const pending=nodes.findIndex(n=>n.localName==='p'&&/^\s*(?:🟡\s*)?Pending:/u.test(n.textContent));
      const done=nodes.findLastIndex(n=>n.localName==='p'&&/^\s*(?:⚫\s*)?Done:/u.test(n.textContent));
      if(pending>=0&&pending<first&&done>last){
        const outcome=nodes.slice(last+1,done).find(n=>n.localName==='p'&&n.textContent.trim());
        if(outcome){nodes.slice(0,first).forEach(n=>n.remove());nodes[done].remove();host.prepend(outcome);}
      }
    }
    return host.innerHTML;
  }

  const style=document.createElement('style'); style.textContent=`
  .erl{color:#292524;font:inherit;overflow-anchor:none}.erl *{box-sizing:border-box}.erl button,.erl input{font:inherit}.erl button{cursor:pointer}.erl svg{width:17px;height:17px;flex:none;display:inline-block;vertical-align:middle}.erl button:focus-visible,.erl a:focus-visible{outline:2px solid #287f72;outline-offset:2px}.erl-controls{position:sticky;top:0;z-index:3;background:#f5f5f4;border-bottom:1px solid #e7e5e4;padding:9px 12px 8px}.erl-providers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-bottom:8px}.erl-provider{display:flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:4px;border:0;border-radius:7px;background:transparent;font-weight:600!important}.erl-provider[aria-pressed=true]{background:#e3e9e6}.erl .erl-mark{width:19px;height:19px}.erl-provider small{font-size:11px;font-weight:400;color:#78716c;font-variant-numeric:tabular-nums}.erl-codex{color:#248c78}.erl-gemini{color:#286dba}.erl-claude{color:#b77750}.erl-tabs{display:flex;border-radius:8px;background:#e7e7e3;padding:2px;gap:2px}.erl-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;border:0;border-radius:6px;background:transparent;min-height:28px;font-size:12px;color:#57534e;white-space:nowrap}.erl-tabs button[aria-selected=true]{background:#fff;box-shadow:0 1px 3px #0002;color:#292524;font-weight:600}.erl-tabs small{font:inherit;font-size:10px;font-weight:400;font-variant-numeric:tabular-nums;color:#78716c}.erl-search{width:100%;min-height:32px;border:1px solid #deddd8;border-radius:7px;padding:5px 9px;background:#fff;margin-top:8px;font-size:12px!important}.erl-notice{padding:7px 12px;font-size:11px;background:#fffbeb;color:#854d0e;border-bottom:1px solid #fde68a}.erl-row{display:grid;grid-template-columns:minmax(0,1fr) 32px;background:#fff;border-bottom:1px solid #efeeeb;align-items:start}.erl-pick{display:grid;grid-template-columns:21px minmax(0,1fr);gap:8px;border:0;background:none;text-align:left;padding:11px 0 11px 12px;color:inherit;min-width:0;width:100%}.erl-title{font-size:14px;font-weight:550;line-height:1.4;text-wrap:pretty;overflow-wrap:anywhere}.erl-meta{display:flex;align-items:center;gap:6px;font-size:10px;color:#78716c;min-height:21px;font-variant-numeric:tabular-nums}.erl-meta svg{width:13px;height:13px}.erl-state{display:inline-flex;align-items:center;color:#568d83}.erl-failed{color:#b45309}.erl-queued{color:#8e7528}.erl-meta time{margin-left:2px}.erl-message{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:#78716c;line-height:1.45;margin-top:2px}.erl-more{width:32px;height:42px;display:flex;align-items:center;justify-content:center;border:0;background:none;color:#78716c;padding:0}.erl-empty{padding:25px 16px;text-align:center;color:#78716c;font-size:13px}.erl-empty svg{display:block;width:24px;height:24px;margin:0 auto 7px;opacity:.65}.erl-foot{font-size:10px;color:#78716c;padding:9px 12px}.erl-menu,.erl-panel{position:fixed;z-index:60;background:white;border:1px solid #e7e5e4;box-shadow:0 6px 20px #0002;border-radius:12px;padding:5px;overflow:auto;overscroll-behavior:contain;overflow-anchor:none}.erl-menu a,.erl-menu button{display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:40px;text-align:left;text-decoration:none;color:#28635a;font-size:13px;background:none;border:0;width:100%;border-radius:7px}.erl-menu a:hover,.erl-menu button:hover{background:#f5f5f4}.erl-panel{padding:12px;width:calc(100vw - 24px);max-height:60dvh;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.erl-panel h2{font-size:14px;margin:0 0 5px;font-weight:600}.erl-dates{display:flex;flex-wrap:wrap;gap:2px 12px;margin:8px 0;font-size:11px;color:#78716c}.erl-dates span{white-space:nowrap}.erl-report{margin-top:10px;border-top:1px solid #e7e5e4;padding-top:10px}.erl-report p,.erl-report ul,.erl-report ol,.erl-report pre,.erl-report blockquote{margin:7px 0}.erl-report h1,.erl-report h2,.erl-report h3{font-size:13px;margin:12px 0 4px;font-weight:650}.erl-report ul,.erl-report ol{padding-left:20px}.erl-report ul{list-style:disc}.erl-report ol{list-style:decimal}.erl-report pre{padding:8px;background:#f5f5f4;overflow:auto;font-size:11px}.erl-report a{color:#28635a;text-decoration:underline}.erl-report table{display:block;overflow:auto;border-collapse:collapse}.erl-report th,.erl-report td{padding:4px;border-bottom:1px solid #e7e5e4}.erl-panel a.erl-record{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:#28635a;text-decoration:none;font-size:12px}.erl-entry{display:flex;align-items:center;gap:7px;width:100%;min-height:35px;padding:5px 12px;background:#f5f5f4;border:0;border-block:1px solid #e7e5e4;color:#57534e;font:inherit;font-size:12px;cursor:pointer}.erl-entry svg{width:16px;height:16px}.erl-entry .erl-entry-count{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:11px;font-variant-numeric:tabular-nums}.erl-entry strong{font-weight:500}.erl [hidden]{display:none!important}
  .erl-data{margin:10px 0}.erl-data-summary{display:flex;align-items:baseline;gap:9px;font-size:13px;font-weight:600}.erl-data-summary span{font-size:11px;font-weight:400;color:#78716c}.erl-report .erl-data-list,.erl-report .erl-project-list{list-style:none;padding:0;margin:5px 0}.erl-data-list li{display:grid;grid-template-columns:17px minmax(0,1fr) auto;align-items:start;gap:7px;padding:7px 0;border-top:1px solid #efeeeb}.erl-data-icon{color:#568d83;line-height:1.5}.erl-data-icon svg{width:16px;height:16px}.erl-data-name{overflow-wrap:anywhere;min-width:0}.erl-data-size{white-space:nowrap;color:#78716c;font-size:11px;padding-top:2px;font-variant-numeric:tabular-nums}.erl-data-error{display:block;color:#b45309;margin-top:3px}.erl-project-list li{padding:8px 0;border-top:1px solid #efeeeb}.erl-project-list strong{font-weight:550}.erl-project-links{display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;margin-top:3px;font-size:11px;color:#78716c}.erl-project-links a{display:inline-flex;align-items:center;gap:3px}.erl-project-links svg{width:12px;height:12px}
  .erl-data-icon.erl-failed{color:#b45309}
  `; document.head.append(style);
  const menu=document.createElement('aside'), panel=document.createElement('aside');
  menu.className='erl erl-menu'; menu.hidden=true; menu.setAttribute('role','menu');menu.setAttribute('aria-label','Errand actions');
  panel.className='erl erl-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Errand details');panel.tabIndex=-1;
  document.body.append(menu,panel);
  const replace = (node,html) => {if(node.innerHTML!==html)node.innerHTML=html;};
  function summaryHtml(){
    const c=counts(items());
    return `<button class="erl-entry" data-open-errands>${svg('errands')}<strong>Errands</strong><span class="erl-entry-count">${!available()?'Queue unavailable':`${svg('waiting')}${c.waiting}<span>waiting${stale()?' · saved':''}</span>${c.taken?`${svg('claimed')}${c.taken}`:''}`}</span></button>`;
  }
  function render(){
    if(!root)return;
    const scrolls=[];for(let n=root;n;n=n.parentElement)scrolls.push([n,n.scrollTop]);
    const focus=root.contains(document.activeElement)?document.activeElement:null;
    const focusAttr=focus && ['data-er-provider','data-er-tab','data-er-pick','data-er-menu','data-er-search'].find(a=>focus.hasAttribute(a));
    const focusValue=focusAttr?focus.getAttribute(focusAttr):null,selection=focus?.selectionStart;
    const c=counts(filtered());
    const notice=denied?'Access unavailable':!available()?(snapshot?.notice||'Queue unavailable'):stale()?`Saved queue · Synced ${stamp(snapshot.syncedAt)}`:snapshot?.notice||'';
    replace(root,`<div class="erl-controls"><div class="erl-providers" role="group" aria-label="Filter errands by assistant">${providers.map(p=>`<button data-er-provider="${p}" class="erl-provider erl-${p.toLowerCase()}" aria-label="${p} errands" aria-pressed="${provider===p}">${mark(p)}<span>${p}</span><small aria-label="${items().filter(i=>i.provider===p&&group(i)===tab).length} ${tab==='waiting'?'waiting':tab==='taken'?'taken on':'results'}">${available()?items().filter(i=>i.provider===p&&group(i)===tab).length:'—'}</small></button>`).join('')}</div><div class="erl-tabs" role="tablist" aria-label="Errand state">${[['waiting','Waiting'],['taken','Taken on'],['results','Results']].map(([id,name])=>`<button id="errand-tab-${id}" role="tab" data-er-tab="${id}" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" aria-controls="errand-list">${name}<small>${available()?c[id]:'—'}</small></button>`).join('')}</div>${tab==='results'?`<input class="erl-search" data-er-search aria-label="Find an errand" placeholder="Find an errand" value="${esc(query)}">`:''}</div>${notice?`<div class="erl-notice" role="status">${esc(notice)}</div>`:''}<div id="errand-list" role="tabpanel" aria-labelledby="errand-tab-${tab}">${available()?visible().map(i=>`<article class="erl-row" data-er-row="${esc(i.id)}"><button data-er-pick="${esc(i.id)}" class="erl-pick" aria-expanded="${selected===i.id}" aria-label="Details for ${esc(i.title)}"><span class="erl-${i.provider.toLowerCase()}">${mark(i.provider)}</span><span><span class="erl-title">${esc(i.title)}</span><span class="erl-meta"><span class="erl-state erl-${i.state}" aria-label="${label(i)}">${svg(glyph(i))}</span><span>${i.provider}</span>${i.location?`<span aria-label="${esc(i.location)}">${svg(i.location==='Cloud'?'cloud':'laptop')}</span>`:''}<time datetime="${esc(tab==='waiting'?i.createdAt:i.at)}">${esc(age(tab==='waiting'?i.createdAt:i.at))}</time></span>${i.detail?`<span class="erl-message">${esc(i.detail)}</span>`:''}</span></button><button class="erl-more" data-er-menu="${esc(i.id)}" aria-label="Actions for ${esc(i.title)}" aria-haspopup="menu" aria-expanded="${menuId===i.id}">${svg('more')}</button></article>`).join('')||`<div class="erl-empty">${svg(tab==='waiting'?'waiting':tab==='taken'?'claimed':'complete')}${query?'No matching errands':tab==='waiting'?(snapshot?.notice?'No waiting errands in available records':`No errands waiting${provider?' for '+provider:''}`):tab==='taken'?'No errands taken on':'No saved results'}</div>`:'<div class="erl-empty">Waiting for the private queue</div>'}</div><div class="erl-foot">${available()?`${tab==='waiting'?'Oldest first':tab==='taken'?'Claims and arriving replies':'Latest '+c.results+' results'} · Synced ${esc(age(snapshot.syncedAt))}`:''}</div>`);
    if(focusAttr){const next=[...root.querySelectorAll('['+focusAttr+']')].find(n=>n.getAttribute(focusAttr)===focusValue);next?.focus({preventScroll:true});if(typeof selection==='number')next?.setSelectionRange?.(selection,selection);}
    for(const [n,y] of scrolls)n.scrollTop=y;
    if(menuId)place(menu,root.querySelector(`[data-er-menu="${menuId}"]`));
    if(selected)showDetail(selected,false);
  }
  function place(node,anchor){
    if(!anchor){node.hidden=true;return;}
    const r=anchor.getBoundingClientRect(),width=Math.min(innerWidth-24,node===menu?210:540);
    node.style.width=width+'px';node.style.left=Math.max(12,Math.min(innerWidth-width-12,r.right-width))+'px';
    node.style.top=Math.max(10,Math.min(innerHeight-node.offsetHeight-12,r.bottom+4))+'px';
  }
  function closeMenu(focus=false){const id=menuId;menuId='';menu.hidden=true;root?.querySelector(`[data-er-menu="${id}"]`)?.setAttribute('aria-expanded','false');if(focus)root?.querySelector(`[data-er-menu="${id}"]`)?.focus({preventScroll:true});}
  function closeDetail(focus=false){const id=selected;selected='';panel.hidden=true;root?.querySelector(`[data-er-pick="${id}"]`)?.setAttribute('aria-expanded','false');if(focus)root?.querySelector(`[data-er-pick="${id}"]`)?.focus({preventScroll:true});}
  function showMenu(id){
    if(menuId===id){closeMenu();return;}closeMenu();closeDetail();const item=find(id);if(!item)return;
    menuId=id;const url=safe(item.url);
    replace(menu,`${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" role="menuitem">${svg('open')}${group(item)==='results'||item.state==='reply'?'Open result':'Open request'}</a>`:''}<button role="menuitem" data-er-copy="${id}">Copy title</button>`);
    menu.hidden=false;root.querySelector(`[data-er-menu="${id}"]`)?.setAttribute('aria-expanded','true');place(menu,root.querySelector(`[data-er-menu="${id}"]`));
  }
  function showDetail(id,focus=true){
    const item=find(id);if(!item){closeDetail();return;}selected=id;
    const hasResult=['reply','complete','failed'].includes(item.state),cached=reports.get(id),version=item.at;
    const body=cached?.version===version?cached.body:null;
    const dates=[['Filed',item.createdAt],...(item.claimedAt?[['Taken on',item.claimedAt]]:[]),...(hasResult?[['Updated',item.at]]:[])].filter(([,at])=>Date.parse(at)>0).map(([name,at])=>`<span>${name} ${esc(stamp(at))}</span>`).join('');
    const url=safe(item.url),scroll=panel.scrollTop;
    const rendered=body!==null?reportHtml(body,item):'<p>Reading result…</p>';
    replace(panel,`<h2>${esc(item.title)}</h2><span class="erl-meta"><span class="erl-state erl-${item.state}">${svg(glyph(item))}</span>${label(item)} · ${item.provider}${item.location?' · '+esc(item.location):''}</span>${dates?`<p class="erl-dates">${dates}</p>`:''}${item.state==='claimed'?'<p>A claim is recorded. Continued execution is not confirmed.</p>':''}${hasResult?`<div class="erl-report">${rendered}</div>`:item.detail?`<p>${esc(item.detail)}</p>`:''}${url?`<a class="erl-record" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${svg('open')}${hasResult?'Open saved result':'Open request'}</a>`:''}`);
    panel.hidden=false;panel.scrollTop=scroll;root?.querySelector(`[data-er-pick="${id}"]`)?.setAttribute('aria-expanded','true');place(panel,root.querySelector(`[data-er-pick="${id}"]`));if(focus)panel.focus({preventScroll:true});
    if(hasResult&&body===null&&!requests.has(id)){
      const token=++resultVersion;requests.set(id,token);
      fetch('/api/v1/results/'+encodeURIComponent(id),{cache:'no-store'}).then(async response=>{
        if(!response.ok)throw Error();const value=await response.json();
        if(requests.get(id)===token)reports.set(id,{version,body:typeof value.reply==='string'&&value.reply.trim()?value.reply:'No report body recorded. Open the saved result.'});
      }).catch(()=>{if(requests.get(id)===token)reports.set(id,{version,body:'Result unavailable. Open the saved result.'});})
        .finally(()=>{if(requests.get(id)===token){requests.delete(id);if(selected===id)showDetail(id,false);}});
    }
  }
  async function refresh(){
    clearTimeout(timer);if(pending||document.hidden)return;pending=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch('/api/v1/errands',{headers:etag?{'If-None-Match':etag}:{},cache:'no-store',signal:controller.signal});
      if(response.status===403){denied=true;snapshot=null;reports.clear();requests.clear();closeDetail();closeMenu();throw Error();}
      if(response.status!==304){if(!response.ok)throw Error();const next=await response.json();if(next.schemaVersion!==1||!Array.isArray(next.items))throw Error();snapshot=next;etag=response.headers.get('etag')||'';}
      connected=true;denied=false;
    }catch{connected=false;}finally{
      pending=false;clearTimeout(timeout);
      const next=JSON.stringify([snapshot,connected,denied,stale(),Math.floor(Date.now()/60000)]);if(next!==signature){signature=next;render();window.dispatchEvent(new CustomEvent('errandschange'));}
      if(!document.hidden)timer=setTimeout(refresh,active?5000:15000);
    }
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');
    if(button?.hasAttribute('data-er-provider')){provider=provider===button.dataset.erProvider?'':button.dataset.erProvider;closeDetail();closeMenu();render();return;}
    if(button?.dataset.erTab){tab=button.dataset.erTab;query='';closeDetail();closeMenu();render();return;}
    if(button?.dataset.erMenu){showMenu(button.dataset.erMenu);return;}
    if(button?.dataset.erPick){const id=button.dataset.erPick;closeMenu();if(selected===id)closeDetail();else showDetail(id);return;}
    if(button?.dataset.erCopy){try{await navigator.clipboard.writeText(find(button.dataset.erCopy)?.title||'');button.textContent='Copied';}catch{button.textContent='Copy unavailable';}return;}
    if(!event.target.closest('.erl-menu'))closeMenu();
    if(!event.target.closest('.erl-panel'))closeDetail();
  });
  document.addEventListener('input',event=>{if(event.target.hasAttribute('data-er-search')){query=event.target.value;render();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(!menu.hidden){closeMenu(true);event.preventDefault();}else if(!panel.hidden){closeDetail(true);event.preventDefault();}}
    const target=event.target.closest('[data-er-tab]');
    if(target&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const tabs=[...root.querySelectorAll('[data-er-tab]')],i=tabs.indexOf(target),n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:2))%3;
      tabs[n].click();root.querySelector(`[data-er-tab="${tabs[n].dataset.erTab}"]`)?.focus({preventScroll:true});event.preventDefault();
    }
    if(event.target.closest('.erl-menu')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      const nodes=[...menu.querySelectorAll('[role=menuitem]')],i=nodes.indexOf(document.activeElement),n=event.key==='Home'?0:event.key==='End'?nodes.length-1:(i+(event.key==='ArrowDown'?1:nodes.length-1))%nodes.length;nodes[n]?.focus({preventScroll:true});event.preventDefault();
    }
    const more=event.target.closest('[data-er-menu]');if(more&&event.key==='ArrowDown'){showMenu(more.dataset.erMenu);menu.querySelector('[role=menuitem]')?.focus({preventScroll:true});event.preventDefault();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else refresh();});
  window.addEventListener('online',refresh);
  window.addEventListener('resize',()=>{if(menuId)place(menu,root?.querySelector(`[data-er-menu="${menuId}"]`));if(selected)place(panel,root?.querySelector(`[data-er-pick="${selected}"]`));});
  window.NowErrands={
    mount:node=>{root=node;root.classList.add('erl');render();refresh();},
    setActive:value=>{active=value;if(!value){closeDetail();closeMenu();}else refresh();},
    refresh,summaryHtml,
    connection:()=>{const node=document.getElementById('connection');if(node)node.textContent=available()?(stale()?'Saved queue':'Laptop live'):'Queue unavailable';},
    state:()=>({tab,provider,counts:counts(items()),connected,available:available(),fresh:available()&&!stale(),syncedAt:snapshot?.syncedAt})
  };
})();
