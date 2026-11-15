(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const focusStyle = 'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#047857] focus-visible:outline-offset-2';
  const touchMore = "pointer-coarse:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:-inset-x-[7px]";
  const statusTones = {working:'text-[#24785d]',waiting:'text-[#a57428]',accepted:'text-[#5879a1]',attention:'text-[#b87832]',quiet:'text-[#938b7d]'};
  const ui = {
    assistants:'grid grid-cols-3 gap-2 px-3 py-1 border-t-0 bg-stone-100 max-[350px]:gap-1 max-[350px]:px-2',
    provider:'phone-provider relative min-w-0',
    providerFilter:`phone-provider-filter flex w-full min-h-[34px] items-center gap-[3px] py-0.5 pr-[18px] pl-0 text-left border-b-2 border-transparent rounded aria-pressed:border-[#6f6a61] aria-pressed:bg-[#eae7e1] ${focusStyle}`,
    providerName:'phone-provider-name flex shrink-0 items-center gap-[3px] text-[13px] font-semibold leading-5 whitespace-nowrap [&>svg]:size-4 [&>svg]:flex-none max-[350px]:text-xs max-[350px]:gap-0.5 max-[350px]:[&>svg]:size-[13px]',
    providerCounts:'phone-provider-counts ml-auto flex min-w-0 flex-wrap justify-end gap-x-1 gap-y-0 text-xs tabular-nums leading-4 text-[#827b71] [&_svg]:size-3 max-[350px]:text-[11px] max-[350px]:[&_svg]:size-[11px]',
    count:'inline-flex items-center gap-[3px] whitespace-nowrap',
    providerMore:`phone-provider-more absolute -right-[3px] top-1/2 -translate-y-1/2 grid place-items-center w-[18px] h-7 text-[#827b71] [&_svg]:size-[17px] ${touchMore} ${focusStyle}`,
    row:'phone-row grid grid-cols-[20px_minmax(0,1fr)_28px] gap-[7px] py-2.5 px-3 border-b border-[#e9e6e1] bg-white min-w-0 cursor-pointer max-[350px]:px-2.5 max-[350px]:gap-1.5',
    mark:'phone-mark pt-0.5 [&>svg]:size-5',
    position:'phone-position block w-5 text-[13px] text-[#a06e35] tabular-nums',
    pick:`phone-pick block w-full min-h-[22px] p-0 text-left text-[#35312c] ${focusStyle}`,
    rowTitle:'phone-row-title line-clamp-2 overflow-hidden text-sm font-[550] leading-5 [overflow-wrap:anywhere]',
    meta:'phone-meta flex items-center flex-wrap gap-y-[3px] gap-x-1.5 mt-1 text-xs leading-5 min-h-5 text-[#827b71] [&>svg]:size-3.5 [&>svg]:flex-none [&_time]:whitespace-nowrap [&_time]:tabular-nums max-[350px]:gap-x-[5px]',
    status:'phone-status inline-flex items-center justify-center gap-[5px] [&_svg]:size-4 [&_svg]:flex-none',
    statusButton:`relative size-5 p-0 border-0 bg-transparent pointer-coarse:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:-inset-x-1.5 ${focusStyle}`,
    summary:'phone-summary line-clamp-2 overflow-hidden mt-[5px] mx-0 mb-0 text-[#7b7368] text-[13px] leading-[19px] [overflow-wrap:anywhere]',
    more:`phone-more relative grid place-items-center w-7 h-8 p-0 text-[#827b71] flex-none [&_svg]:size-[17px] ${touchMore} ${focusStyle}`,
    menu:'phone-session-menu fixed z-[60] w-[min(270px,calc(100vw_-_16px))] max-h-[calc(100dvh_-_16px)] overflow-auto bg-white border border-[#e1dcd3] rounded-xl p-[5px] shadow-[0_8px_28px_#29252426] text-[13px] leading-[19px] [&[hidden]]:hidden [&>div]:block [&_p]:text-[11px] [&_p]:leading-[17px] [&_p]:px-2.5 [&_p]:py-[5px] [&_p]:text-[#8a8175]',
    menuItem:`flex w-full min-h-[42px] items-center py-[9px] px-2.5 border-0 rounded-md bg-transparent text-left whitespace-normal text-[#3f6f61] [font:inherit] no-underline hover:bg-[#f1eee8] ${focusStyle}`,
    detailHeader:'phone-detail-header flex items-center justify-between sticky top-0 z-[15] min-h-[49px] bg-[#fffffff5] border-b border-[#e7e3dc] py-1 px-3 backdrop-blur-[8px]',
    back:`phone-back min-h-10 py-[3px] px-1 text-[14px] text-[#686156] ${focusStyle}`,
    detailArticle:'phone-detail-article pt-[14px] px-4 pb-9',
    detailTitle:'text-[21px] font-semibold leading-7 [overflow-wrap:anywhere] mt-3 mx-0 mb-[9px] text-[#373129] outline-none',
    facets:'phone-facets flex gap-[3px] p-[3px] rounded-lg bg-[#efede7] mt-[18px] mx-0 mb-3',
    facet:`flex-1 min-w-0 min-h-[34px] py-1 px-1.5 text-xs leading-[18px] text-[#7b7265] rounded-[5px] whitespace-nowrap aria-selected:bg-white aria-selected:text-[#3d362c] aria-selected:shadow-[0_1px_3px_#29252414] aria-selected:font-[550] pointer-coarse:min-h-10 ${focusStyle}`,
    detailBody:'phone-detail-body text-sm leading-[22px] text-[#5e5549] [overflow-wrap:anywhere] min-h-20 [&_p]:my-[.7em] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere] [&_a]:text-[#277b67] [&_a]:underline [&_a]:underline-offset-2',
    tokenDialog:'phone-token-dialog w-[min(360px,calc(100vw_-_24px))] p-[18px] border border-[#ddd6ca] rounded-[14px] text-[#4b4338] shadow-[0_10px_40px_#29252430] text-xs leading-[18px] backdrop:bg-[#29252430]',
    dialogTitle:'text-[15px] font-semibold leading-[21px] pr-[25px] mt-0 mx-0 mb-[9px] [overflow-wrap:anywhere]',
    dialogNote:'my-2 text-[#817565]',
    dialogCounts:'grid grid-cols-[minmax(0,1fr)_auto] gap-y-[5px] gap-x-3 my-3 [&_dd]:tabular-nums [&_dd]:text-right',
    dialogClose:'phone-dialog-close absolute right-[7px] top-[5px] size-[34px] text-2xl leading-[18px] text-[#8b8172]'
  };
  if (el('assistants')) el('assistants').className=ui.assistants;
  const rendered = new WeakMap();
  const html = (id, value) => {
    const node = el(id);
    if (node && rendered.get(node) !== value) { node.innerHTML = value; rendered.set(node,value); }
  };
  const labels = {working:'Working',quiet:'Quiet',idle:'Idle',interrupted:'Interrupted',recent:'Recent',recorded:'Recorded',queued:'Waiting',claimed:'Claimed',reply:'Reply arriving',complete:'Complete',failed:'Needs review'};
  const tones = {working:'bg-emerald-100 text-emerald-900',quiet:'bg-amber-100 text-amber-900',queued:'bg-amber-100 text-amber-900',claimed:'bg-blue-100 text-blue-900',failed:'bg-rose-100 text-rose-900',interrupted:'bg-rose-100 text-rose-900',complete:'bg-emerald-50 text-emerald-900',recorded:'bg-violet-50 text-violet-900'};
  const colours = {codex:'text-emerald-700',gemini:'text-blue-700',claude:'text-orange-700'};
  const keyFor = provider => /gemini/i.test(provider) ? 'gemini' : /claude/i.test(provider) ? 'claude' : 'codex';
  const mark = (provider, cls = 'size-5 shrink-0') => window.assistantMark?.svg(keyFor(provider), {cls}) || '';
  const paths = {working:'M3 12h4l3-8 4 16 3-8h4',quiet:'M8 5v14M16 5v14',idle:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0',queued:'M7 3h10M7 21h10M8 3v5l8 8v5M16 3v5l-8 8v5',claimed:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',reply:'M5 9H2V6m0 3a9 9 0 1 1 1 9',complete:'m5 12 4 4L19 6',failed:'m12 3 10 18H2Zm0 6v5m0 3h.01',attention:'M8 12V7a2 2 0 0 1 4 0v4m0-4a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v6c0 4-3 6-7 6-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l1 1',more:'M12 5h.01M12 12h.01M12 19h.01'};
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === 'more' ? 3 : 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.idle}"/></svg>`;
  function status(item) {
    if (item.state === 'failed') return {glyph:'failed',label:'Needs review: failed',tone:'attention'};
    if (item.state === 'interrupted') return {glyph:'attention',label:'Interrupted',tone:'attention'};
    if (item.needsAttention || item.state === 'needs-you') return {glyph:'attention',label:'Needs attention',tone:'attention'};
    return {glyph:paths[item.state] ? item.state : 'idle',label:({quiet:'No recent activity',claimed:'Claimed; awaiting an update',recent:'Recent activity'})[item.state] || labels[item.state] || 'Recorded',tone:({working:'working',reply:'working',queued:'waiting',claimed:'accepted',quiet:'quiet'})[item.state] || 'quiet'};
  }
  const badge = item => { const value=status(typeof item==='string'?{state:item}:item); return `<span class="${ui.status} phone-status-${value.tone} ${statusTones[value.tone]}" title="${escape(value.label)}">${icon(value.glyph)}<span>${escape(value.label)}</span></span>`; };
  const age = at => { const seconds = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : new Date(at).toLocaleDateString(); };
  const observedTime = at => `<time data-at="${escape(at)}" datetime="${escape(at)}" title="${escape(stamp(at))}">${escape(stamp(at))}</time>`;
  const stamp = at => at ? new Date(at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not yet';
  const safeUrl = value => { try { const url = new URL(value); return url.origin === 'https://mehrlander.github.io' && !url.username && !url.password && !url.port && url.pathname.startsWith('/web-tools/') ? url.href : ''; } catch { return ''; } };
  let data, assistant = '', timer, etag = '', failures = 0, pending = false, connected = false, accessDenied = false, savedScroll = 0;
  let launchKey = '', copiedTitle = '', savedKey = '', temporaryItem = null, forceAfterPoll = false;
  const desktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const selectedDetails = new Map();
  const replies = new Map();
  const filtered = () => (data?.items || []).filter(i => !assistant || keyFor(i.provider) === assistant);
  const active = i => ['working','quiet','claimed','reply'].includes(i.state) && !i.needsAttention;
  const recordedChange = change => ({...change,kind:'change',state:'recorded'});
  const selected = () => { try { const p=new URLSearchParams(location.hash.slice(1)); return p.get('item') || ((!p.get('view') || p.get('view') === 'now') ? p.get('session') || '' : ''); } catch { return ''; } };
  const backLabel = () => history.state?.nowDetail && history.state?.originView === 'usage' ? '← Usage' : '← Now';
  const nowScroll = () => window.NowViews?.scrollPosition?.() ?? window.scrollY;
  const scrollNow = top => window.NowViews?.scrollTo ? window.NowViews.scrollTo(top) : window.scrollTo(0,top);
  const metadata = () => window.NowPhoneUsage?.sessionUsage?.() || {};
  const adapted = item => ({...item,key:keyFor(item.provider),identity:item.key,place:String(item.location || '').toLowerCase(),at:Date.parse(item.at)});
  const tokenBadge = item => window.NowRecentUsage?.tokenBadge?.(adapted(item),metadata(),{now:Date.now()}) || '';

  function connection() {
    if (window.NowViews?.active() && window.NowViews.current?.() !== 'usage') { window.NowViews.connection(); return; }
    const fresh = data && Date.now() - new Date(data.observedAt).getTime() < 15000;
    const live = connected && fresh;
    const text = accessDenied ? 'Access unavailable · Connect with your Tailscale account' : live ? 'Laptop live · Updates automatically' : data ? `${connected ? 'Activity paused' : 'Laptop unreachable'} · Last seen ${stamp(data.observedAt)}` : failures ? 'Laptop unreachable · Waiting for connection' : 'Connecting to your laptop…';
    html('connection', `<span title="${escape(text)}" class="inline-flex items-center gap-1.5 ${live ? 'text-emerald-800' : data || failures ? 'text-amber-800' : ''}"><span class="size-1.5 rounded-full ${live ? 'bg-emerald-600' : 'bg-amber-500'}" aria-hidden="true"></span>${escape(accessDenied ? 'Access unavailable' : live ? 'Laptop live' : data ? connected ? 'Activity paused' : 'Laptop unreachable' : 'Connecting…')}</span>`);
    if (selected()) html('detail-connection', live ? '' : `<div class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">${escape(text)}</div>`);
  }

  const latestWork = item => item.work?.segments?.[0];
  const usefulDetail = item => item.detail === 'Response recorded' ? '' : item.detail;
  const replyPreview = text => String(window.NowReading?.notification(text)?.summary || text || '').replace(/\[([^\]]+)\]\([^\s)]+\)/g,'$1').replace(/(^|\n)\s{0,3}#{1,6}\s+/g,'$1').replace(/[*`]/g,'').replace(/\s+/g,' ').trim();
  function statusText(item) {
    const work = latestWork(item);
    if (work) return `${Date.parse(item.at) - Date.parse(item.work.through) > 180000 ? 'Last summary: ' : ''}${work.summary}`;
    if (item.turn && item.state === 'idle') {
      const reply = replyPreview(item.turn.response);
      return reply ? `Reply: ${reply}` : item.checkpoint?.headline ? `Last summary: ${item.checkpoint.headline}` : '';
    }
    return item.turn && ['working','quiet','interrupted'].includes(item.state) ? usefulDetail(item) : item.checkpoint?.headline || usefulDetail(item);
  }
  const itemTitle = item => latestWork(item)?.headline || item.title;
  function locationMark(location) {
    if (!['Laptop','Cloud'].includes(location)) return escape(location);
    const label = location === 'Cloud' ? 'Cloud' : 'On this laptop';
    const path = location === 'Cloud' ? '<path d="M6.5 19a4.5 4.5 0 0 1-.8-8.93A6.5 6.5 0 0 1 18.5 9a5 5 0 0 1-.5 10Z"/>' : '<rect x="4" y="3" width="16" height="13" rx="1.5"/><path d="m4 16-2 4h20l-2-4M9 20h6"/>';
    return `<svg data-location="${location}" role="img" aria-label="${label}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" class="inline-block size-3.5 shrink-0 ${location === 'Cloud' ? 'text-sky-700' : 'text-stone-500'}"><title>${label}</title>${path}</svg>`;
  }
  function row(item, position) {
    const key = escape(item.key), summary = replyPreview(statusText(item));
    const value=status(item);
    return `<article data-item="${key}" class="${ui.row}"><span class="${ui.mark} ${colours[keyFor(item.provider)]}">${position ? `<span class="${ui.position}">${position}.</span>` : mark(item.provider)}</span><div class="phone-row-content min-w-0"><button data-pick="${key}" class="${ui.pick}" aria-label="${escape('Read ' + item.title)}"><span class="${ui.rowTitle}">${escape(itemTitle(item))}</span></button><div class="${ui.meta}"><button class="${ui.status} ${ui.statusButton} phone-status-${value.tone} ${statusTones[value.tone]}" data-status="${key}" aria-label="${escape(value.label)}" title="${escape(value.label)}">${icon(value.glyph)}</button><span>${escape(item.provider)}</span>${locationMark(item.location)}${item.work?.agents ? `<span>${item.work.agents} agents</span>` : ''}${observedTime(item.at)}${tokenBadge(item)}</div>${summary ? `<p data-summary class="${ui.summary}">${escape(summary.slice(0,180))}</p>` : ''}</div><button data-launch="${key}" aria-expanded="${launchKey === item.key}" aria-controls="phone-session-menu" aria-haspopup="menu" aria-label="${escape('Actions for ' + item.title)}" class="${ui.more}">${icon('more')}</button></article>`;
  }

  function group(title, items, empty = '', numbered = false, inline = true) {
    return `<section aria-label="${escape(title)}"><h2 class="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold text-stone-600"><span>${escape(title)}</span>${items.length ? `<span class="font-normal">${items.length}</span>` : ''}</h2>${items.length ? items.map((i,n) => row(i, numbered ? n + 1 : 0, inline)).join('') : `<p class="px-3 py-2 text-[13px] text-stone-500">${escape(empty)}</p>`}</section>`;
  }

  function changeItems() {
    const delegated = new Set(data.items.flatMap(i => (i.work?.members || []).map(id => `session:${i.provider}:${id}`)));
    return (data.changes || []).filter(c => !delegated.has(c.key) && (!assistant || keyFor(c.provider) === assistant)).map(c => {
      const item = data.items.find(i => i.key === c.key);
      return item || recordedChange(c);
    });
  }
  function recentItems(items, exclude) {
    const recent = new Map();
    for (const item of [...changeItems(),...items]) {
      if (!exclude.has(item.key)) recent.set(item.key,item);
    }
    return [...recent.values()].sort((a,b) => Date.parse(b.at) - Date.parse(a.at));
  }
  function workerReport(recentOnly = false) {
    const report = data.sources.workerActivity;
    if (!report || assistant && assistant !== 'gemini' || recentOnly && (data.sources.workerState !== 'detected' || Date.now() - Date.parse(report.at) > 900000)) return '';
    const job = report.itemId && data.items.find(i => i.kind === 'errand' && i.id === report.itemId);
    return `<button data-pick="worker:gemini" aria-label="Gemini worker details" class="mx-3 mt-2 block w-[calc(100%-1.5rem)] rounded-lg border-l-4 border-blue-400 bg-blue-50 px-2 py-2 text-left active:bg-blue-100"><span class="float-right text-xl text-blue-600" aria-hidden="true">›</span><p class="text-xs font-medium text-blue-900">Gemini worker · Last reported task</p><p class="mt-0.5 text-[13px] leading-5">${escape(report.headline)}</p>${job ? `<p class="mt-1 text-sm text-stone-600">${escape(job.title)}</p>` : ''}<p class="mt-1 text-xs text-stone-500">Reported ${observedTime(report.at)}</p></button>`;
  }

  function renderUsage() {
    if (window.NowPhoneUsage?.update) { window.NowPhoneUsage.update(data); return; }
    if (!data || !el('usage')) return;
    const viewport = {left:window.scrollX,top:window.scrollY};
    const focused = el('usage').contains(document.activeElement) ? document.activeElement : null;
    const provider = focused?.dataset.usageLink;
    const usage = window.NowUsage?.render(data.usage || []) || '';
    html('usage', window.NowUsage?.workspace ? window.NowUsage.workspace({overview:usage}) : usage);
    if (provider && !focused.isConnected) [...el('usage').querySelectorAll('[data-usage-link]')].find(node => node.dataset.usageLink === provider)?.focus({preventScroll:true});
    if (window.scrollX !== viewport.left || window.scrollY !== viewport.top) window.scrollTo(viewport.left,viewport.top);
  }

  function render() {
    renderUsage();
    if (data) el('machine').textContent = data.machineName;
    if (window.NowViews?.active()) { connection(); return; }
    if (!data) { detail(); connection(); return; }
    // Rebuilding open panels can temporarily shorten the document and clamp its scroll position.
    const viewport = {left:window.scrollX,top:nowScroll()};
    const focus = ['content','assistants'].some(id => el(id).contains(document.activeElement)) ? document.activeElement : null;
    const focusAction = focus && ['pick','status','assistant','providerMenu','launch','sessionTokens'].find(key => focus.dataset[key]);
    const focusKey = focusAction && focus.dataset[focusAction];
    const focusOwner = focus?.dataset.for;
    const waiting = data.items.filter(i => i.state === 'queued');
    html('assistants', ['codex','gemini','claude'].map(key => {
      const items = data.items.filter(i => keyFor(i.provider) === key);
      const counts=new Map();
      for(const item of items){const s=status(item),id=s.glyph+'|'+s.label;const v=counts.get(id)||{...s,count:0};v.count++;counts.set(id,v);}
      const states=[...counts.values()], current=states.filter(s=>!['idle','complete'].includes(s.glyph));
      const shown=current.length?current:states.length?states:[{glyph:'idle',label:'No observed activity',tone:'quiet',count:0}];
      return `<div class="${ui.provider}"><button data-assistant="${key}" aria-pressed="${assistant === key}" aria-label="${escape({codex:'Codex',gemini:'Gemini',claude:'Claude'}[key] + ': ' + shown.map(s=>s.count+' '+s.label.toLowerCase()).join(', '))}" class="${ui.providerFilter}"><span class="${ui.providerName} ${colours[key]}">${mark(key)}${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]}</span><span class="${ui.providerCounts}">${shown.map(s=>`<span class="phone-status-${s.tone} ${statusTones[s.tone]} ${ui.count}" title="${escape(s.count+' '+s.label)}">${icon(s.glyph)}<span>${s.count}</span></span>`).join('')}</span></button><button data-provider-menu="${key}" class="${ui.providerMore}" aria-label="${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]} options" aria-haspopup="menu" aria-expanded="${launchKey === 'provider:'+key}">${icon('more')}</button></div>`;
    }).join(''));
    const items = filtered();
    const notices = [...data.sources.notices];
    if (waiting.some(i => keyFor(i.provider) === 'gemini') && data.sources.workerState === 'absent') notices.unshift('Gemini errands are waiting. Worker not detected.');
    html('notice', notices.map(escape).join('<br>'));
    const current = items.filter(active);
    const queued = items.filter(i => i.state === 'queued').sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const needs = items.filter(i => i.needsAttention && !active(i) && i.state !== 'queued');
    const shown = new Set([...current,...queued,...needs].map(i => i.key));
    const recent = recentItems(items,shown);
    const queueTitle = data.sources.recordsConnected ? 'Waiting' : 'Waiting · Saved queue';
    const queue = queued.length ? group(queueTitle,queued,'',true) : assistant === 'gemini' && !data.sources.queueAvailable ? group('Waiting',[],'Queue unavailable') : '';
    html('content', group('In progress',current,'No current work observed') + (needs.length ? group('Needs you',needs) : '') + queue + workerReport(true) + group('Other recent',recent,'No recent activity.'));
    html('source-times', `Errands synced ${escape(stamp(data.sources.recordsSyncedAt))}<br>Cloud records captured ${escape(stamp(data.sources.cloudCapturedAt))}`);
    updateTimes(); detail(); connection(); renderLaunch();
    if (focusAction && !focus.isConnected) [...document.querySelectorAll('#content button,#content a,#assistants button,#assistants a')].find(n => n.dataset[focusAction] === focusKey && n.dataset.for === focusOwner)?.focus({preventScroll:true});
    document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = age(node.dataset.at); });
    if (!selected() && nowScroll() !== viewport.top) scrollNow(viewport.top);
  }

  function findItem(key) {
    const direct=data?.items.find(i=>i.key===key)||data?.changes?.filter(c=>c.key===key).map(recordedChange)[0];
    if(direct)return direct;
    const value=metadata().sessions?.find(row=>row.provider==='claude'&&'cloud:'+row.id===key),at=Date.parse(value?.usageAt);
    if(value&&Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<=86400000){
      const agent=window.NowView.sessionUrl(value.sessionUrl,'claude',false);
      const known=data?.items.find(i=>i.provider==='Claude'&&i.kind==='cloud'&&(i.id===value.id||agent&&window.NowView.sessionUrl(i.sessionUrl,'claude',false)===agent));
      temporaryItem=known||{key,id:value.id,kind:'cloud',provider:'Claude',location:'Cloud',title:value.title||'Claude session',state:'recorded',detail:'',at:value.usageAt,createdAt:value.usageAt,needsAttention:false,url:'https://mehrlander.github.io/web-tools/app/?view=sessions&session='+encodeURIComponent(value.id),sessionUrl:value.sessionUrl};
      return temporaryItem;
    }
    return temporaryItem?.key===key?temporaryItem:null;
  }
  const launchMenu=document.createElement('aside');
  launchMenu.id='phone-session-menu';launchMenu.className=ui.menu;launchMenu.hidden=true;launchMenu.setAttribute('role','menu');launchMenu.setAttribute('aria-label','Session actions');document.body.append(launchMenu);
  function launchAnchor(key=launchKey){
    const scope=selected()?el('detail'):el('overview');
    return [...scope.querySelectorAll(key.startsWith('provider:')?'[data-provider-menu]':'[data-launch]')].find(node=>key.startsWith('provider:')?node.dataset.providerMenu===key.slice(9):node.dataset.launch===key);
  }
  function closeLaunch(focus=false){const key=launchKey;launchKey='';launchMenu.hidden=true;document.querySelectorAll('[data-launch],[data-provider-menu]').forEach(n=>n.setAttribute('aria-expanded','false'));if(focus)launchAnchor(key)?.focus({preventScroll:true});}
  function placeLaunch(){
    const anchor=launchAnchor();if(!anchor){closeLaunch();return;}
    const r=anchor.getBoundingClientRect(),width=launchMenu.offsetWidth,height=launchMenu.offsetHeight;
    launchMenu.style.left=Math.max(8,Math.min(innerWidth-width-8,r.right-width))+'px';
    launchMenu.style.top=Math.max(8,r.bottom+height+6<=innerHeight-8?r.bottom+4:r.top-height-4)+'px';
  }
  function renderLaunch(){
    if(!launchKey)return;
    const active=document.activeElement,action=['external','providerLink','sessionLink','sessionHome','copyTitle'].find(k=>active?.dataset[k]),focusKey=action&&active.dataset[action];
    let value;
    if(launchKey.startsWith('provider:')){
      const key=launchKey.slice(9),url={codex:'https://chatgpt.com/',gemini:'https://antigravity.google.com/',claude:'https://claude.ai/code'}[key];
      if(!url){closeLaunch();return;}
      value=`<a data-provider-link="${key}" href="${url}" target="_blank" rel="noopener noreferrer">Open ${{codex:'ChatGPT',gemini:'Antigravity',claude:'Claude Code'}[key]}</a>`;
    }else{
      const item=findItem(launchKey);if(!item){closeLaunch();return;}
      value=window.NowView.sessionActions(item,{desktop,copied:copiedTitle===item.key});
    }
    if(rendered.get(launchMenu)!==value){launchMenu.innerHTML=value;rendered.set(launchMenu,value);}
    launchMenu.querySelectorAll('a,button').forEach(node=>{node.setAttribute('role','menuitem');node.tabIndex=-1;node.className=ui.menuItem;});
    launchMenu.hidden=false;launchAnchor()?.setAttribute('aria-expanded','true');placeLaunch();
    if(action&&focusKey)[...launchMenu.querySelectorAll('a,button')].find(n=>n.dataset[action]===focusKey)?.focus({preventScroll:true});
  }
  function openLaunch(key){if(launchKey===key){closeLaunch();return;}closeLaunch();launchKey=key;copiedTitle='';renderLaunch();}
  function openSession(key){
    if(typeof key!=='string'||!key||key.length>1024||/[\u0000-\u001f]/.test(key))return;
    savedScroll=nowScroll();savedKey=key;closeLaunch();assistant='';
    const route='#view=now&session='+encodeURIComponent(key),originView=window.NowViews?.current?.()==='usage'?'usage':'now';
    if(location.hash!==route)history.pushState({nowDetail:true,originView},'',route);
    window.NowViews?.setView?.('now',false);render();detail();connection();window.scrollTo(0,0);
    el('detail').querySelector('h2')?.focus({preventScroll:true});
  }
  function restoreNow(){
    render();scrollNow(savedScroll);
    ([...el('content').querySelectorAll('[data-pick]')].find(n=>n.dataset.pick===savedKey)||el('view-picker'))?.focus({preventScroll:true});
  }
  function updateTimes(){document.querySelectorAll('time[data-at]').forEach(node=>{node.textContent=age(node.dataset.at);});}
  function showTokens(key){
    const item=findItem(key),reading=window.NowRecentUsage?.matchUsage?.(item&&adapted(item),metadata(),{now:Date.now()});
    if(!reading)return;
    closeLaunch();
    const number=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('en-US'):'Not recorded';
    const panel=document.createElement('dialog');panel.className=ui.tokenDialog;panel.setAttribute('aria-label','Recorded session tokens');
    panel.innerHTML=`<form method="dialog"><button class="${ui.dialogClose}" aria-label="Close token details">×</button></form><h2 class="${ui.dialogTitle}">${escape(item.title)}</h2><p class="${ui.dialogNote}">Recorded main-conversation calls · badge shows output</p><dl class="${ui.dialogCounts}">${[['Output',reading.outputTokens],['Fresh input',reading.inputTokens],['Cache read',reading.cacheReadTokens],['Cache write',reading.cacheWriteTokens]].map(([label,value])=>`<dt>${label}</dt><dd>${number(value)}</dd>`).join('')}</dl><p class="${ui.dialogNote}">Last input context: ${number(reading.contextTokens)} tokens. Measured ${escape(stamp(new Date(reading.usageAt).toISOString()))}. ${reading.saved?'Saved reading; usage sync is unavailable. ':''}Counts cover all recorded calls. Subagent calls are excluded. Context describes one call.</p>`;
    document.body.append(panel);const opener=document.activeElement;
    panel.addEventListener('close',()=>{panel.remove();opener?.focus({preventScroll:true});});
    if(panel.showModal)panel.showModal();else panel.setAttribute('open','');
  }
  const markdown = text => window.NowReading?.markdown(text) || `<p class="whitespace-pre-wrap">${escape(text)}</p>`;
  function observedEvents(item, inline) {
    const seen = new Set();
    return data.events.filter(e => {
      if (e.sessionId !== item.id || e.provider !== item.provider) return false;
      const text = e.detail || labels[e.state] || e.state;
      if (inline && (/^(Response recorded|Conversation (running|idle|interrupted)|No recent event|Working with \d+ agents?|Delegated work: \d+ agents?)$/.test(text) || seen.has(text))) return false;
      seen.add(text); return true;
    }).slice(0,inline ? 3 : 10);
  }
  function workBody(item, inline) {
    const work = item.work;
    if (!work?.segments?.length) return '';
    return `<section aria-label="Work updates"><ol class="divide-y divide-stone-100">${work.segments.slice(0,inline ? 3 : 6).map((part,n) => `<li class="py-1.5">${!inline || n ? `<h3 class="text-xs font-semibold text-stone-800">${escape(part.headline)}</h3>` : ''}${markdown(part.summary)}<div class="mt-1 text-[10px] leading-4 text-stone-500"><span title="Evidence through ${escape(stamp(work.through))}">Summarized ${observedTime(part.generatedAt)}</span>${part.evidence?.length ? ` · ${part.evidence.map(escape).join(' · ')}` : ''}</div></li>`).join('')}</ol></section>`;
  }
  function checkpointBody(cp, inline) {
    const latest = cp.turns?.[0];
    const facts = latest ? [[latest.files,'files edited'],[latest.pushes,'branches pushed'],[latest.agents,'agent tasks']].filter(([n]) => n > 0).map(([n,label]) => `<span class="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-900">${n} ${label}</span>`).join('') : '';
    const links = (cp.links || []).filter(l => window.NowView.safeLink(l.url)).map(l => `<a class="inline-flex min-h-11 items-center gap-1 text-xs text-emerald-800 underline underline-offset-2" href="${escape(window.NowView.safeLink(l.url))}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ↗</a>`).join('');
    return `${markdown(cp.summary || cp.headline)}${facts ? `<div class="my-2 flex flex-wrap gap-1">${facts}</div>` : ''}<p class="mt-2 text-[10px] text-stone-500" title="${escape(stamp(cp.analyzedAt || cp.at))}">Summary as of ${observedTime(cp.at)}</p>${links ? `<div class="flex flex-wrap gap-x-3">${links}</div>` : ''}${!inline && cp.turns?.length ? `<ol class="mt-3 space-y-3">${cp.turns.slice(0,3).map(t => `<li><h4 class="text-xs font-medium">${escape(t.headline)}</h4>${markdown(t.summary)}</li>`).join('')}</ol>` : ''}`;
  }
  function detailParts(item, inline) {
    const parts = [], reply = replies.get(item.id), events = observedEvents(item,inline);
    if (latestWork(item)) parts.push({id:'summary',label:'Summary',title:'Work updates',body:workBody(item,inline)});
    if (item.turn?.response?.trim()) parts.push({id:'reply',label:'Reply',title:'Latest reply',body:markdown(item.turn.response)});
    else if (item.kind === 'errand' && ['reply','complete','failed'].includes(item.state)) parts.push({id:'reply',label:'Reply',title:'Errand result',body:`<div data-reply="${escape(item.key)}">${reply === undefined ? '<p class="text-stone-500">Reading result…</p>' : markdown(reply)}</div>`});
    if (item.checkpoint && !parts.some(p => p.id === 'summary')) parts.push({id:'summary',label:'Summary',title:'Published summary',body:checkpointBody(item.checkpoint,inline)});
    if (item.turn?.prompt?.trim()) {
      const notice = window.NowReading?.notification(item.turn.prompt);
      parts.push({id:'prompt',label:notice ? 'Update' : 'Prompt',title:notice ? 'Background update' : 'Prompt',body:markdown(item.turn.prompt)});
    }
    const detail = usefulDetail(item);
    const meaningful = detail && !/^(Conversation (running|idle|interrupted)|No recent event|Delegated work: \d+ agents?)$/.test(detail);
    const agents = item.work?.agents || 0;
    const observation = agents ? `<div aria-label="Current observation" class="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">${badge(item.state)}<span>${agents} delegated ${agents === 1 ? 'agent' : 'agents'}</span><span>Observed ${observedTime(item.at)}</span></div>` : '';
    if (events.length || item.turn || meaningful || agents) parts.push({id:'activity',label:'Activity',title:'Observed activity',body:`${observation}${item.turn ? `<dl class="mb-2 text-[10px] text-stone-500"><div class="flex flex-wrap gap-x-1"><dt>Turn started</dt><dd>${escape(stamp(item.turn.startedAt))}</dd></div>${item.turn.lastTool ? `<div class="mt-1 flex items-center gap-1"><dt>Last tool</dt><dd class="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900">${escape(item.turn.lastTool)}</dd></div>` : ''}</dl>` : ''}${meaningful && !events.some(e => e.detail === detail) && !(item.turn?.lastTool && /^Using /.test(detail)) ? markdown(detail) : ''}${events.length ? `<ol class="divide-y divide-stone-100">${events.map(e => `<li class="flex items-start gap-2 py-1.5"><span class="w-12 shrink-0 pt-0.5 text-[10px] text-stone-500">${observedTime(e.at)}</span><div class="min-w-0 flex-1">${markdown(e.detail || labels[e.state] || e.state)}</div></li>`).join('')}</ol>` : agents && !meaningful && !item.turn?.lastTool ? '<p class="text-xs text-stone-500">No detailed action reports captured for this group.</p>' : ''}`});
    return parts;
  }
  function itemBody(item) {
    const parts=detailParts(item,false),key=item.key;
    let choice=selectedDetails.get(key);
    if(!parts.some(p=>p.id===choice))choice=(parts.find(p=>p.id==='reply')||parts.find(p=>p.id==='summary')||parts[0])?.id||'';
    selectedDetails.set(key,choice);const part=parts.find(p=>p.id===choice),prefix='phone-detail-'+encodeURIComponent(key);
    return `<div class="${ui.facets}" role="tablist" aria-label="Detail sections">${parts.map(p=>`<button class="${ui.facet}" id="${prefix}-${p.id}" role="tab" data-facet="${p.id}" data-for="${escape(key)}" aria-selected="${p.id===choice}" tabindex="${p.id===choice?0:-1}" aria-controls="${prefix}">${p.label}</button>`).join('')}</div><section id="${prefix}" class="${ui.detailBody}" role="tabpanel" ${part?`aria-labelledby="${prefix}-${part.id}"`:'aria-label="Detail"'}>${part?.body||'<p>No additional detail captured.</p>'}</section>`;
  }

  function detail() {
    if(window.NowViews?.active())return;
    const key = selected(), item = findItem(key);
    el('overview').hidden = !!key; el('detail').hidden = !key;
    if (!key) return;
    if (key === 'worker:gemini') { workerDetail(); return; }
    if (!item) {
      html('detail',`<header class="sticky top-0 border-b border-stone-200 bg-white p-3"><button data-back class="min-h-11 px-2 text-base">${backLabel()}</button></header><div id="detail-connection"></div><p class="p-4 text-base">Activity is no longer in the current snapshot.</p>`);
      return;
    }
    const viewport={left:window.scrollX,top:window.scrollY},focused=document.activeElement,focus=focused?.closest('[data-facet]')?.dataset.facet;
    const focusAction=['launch','sessionTokens','back'].find(name=>focused?.hasAttribute('data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))),focusHeading=focused?.matches('#detail h2');
    const value = `<header class="${ui.detailHeader}"><button data-back class="${ui.back}">${backLabel()}</button><button data-launch="${escape(item.key)}" class="${ui.more}" aria-label="${escape('Actions for '+item.title)}" aria-controls="phone-session-menu" aria-haspopup="menu" aria-expanded="${launchKey===item.key}">${icon('more')}</button></header><div id="detail-connection"></div><article class="${ui.detailArticle}"><div class="${ui.meta}">${mark(item.provider)}<span>${escape(item.provider)}</span>${locationMark(item.location)}</div><h2 tabindex="-1" class="${ui.detailTitle}">${escape(item.title)}</h2><div class="${ui.meta}">${badge(item)}${observedTime(item.at)}${tokenBadge(item)}</div>${itemBody(item)}</article>`;
    html('detail', value);
    updateTimes();
    if(focus)el('detail').querySelector(`[data-facet="${focus}"]`)?.focus({preventScroll:true});
    else if(focusAction)el('detail').querySelector('[data-'+focusAction.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')?.focus({preventScroll:true});
    else if(focusHeading)el('detail').querySelector('h2')?.focus({preventScroll:true});
    if(window.scrollY!==viewport.top)window.scrollTo(viewport.left,viewport.top);
    if (item.kind === 'errand' && ['reply','complete','failed'].includes(item.state) && !replies.has(item.id)) loadReply(item);
  }

  function workerDetail() {
    if (!data) return;
    const source = data.sources;
    const reports = source.workerReports?.length ? source.workerReports : source.workerActivity ? [source.workerActivity] : [];
    const jobs = data.items.filter(i => i.kind === 'errand' && keyFor(i.provider) === 'gemini' && ['queued','claimed','reply'].includes(i.state));
    const queued = jobs.filter(i => i.state === 'queued').sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const accepted = jobs.filter(i => i.state !== 'queued');
    const status = source.workerState === 'detected' ? 'Process detected' : source.workerState === 'absent' ? 'Process not detected' : 'Process status unavailable';
    const reportRows = (reports.length ? `<ol class="px-4">${reports.map(r => { const job = r.itemId && data.items.find(i => i.kind === 'errand' && i.id === r.itemId); return `<li class="border-b border-stone-100 py-3"><p class="text-xs text-stone-500">${escape(stamp(r.at))}</p><p class="mt-0.5 text-[13px] leading-5">${escape(r.headline)}</p>${job ? `<button data-pick="${escape(job.key)}" class="min-h-11 text-left text-sm text-blue-800">${escape(job.title)} ›</button>` : ''}</li>`; }).join('')}</ol>` : '<p class="px-4 py-3 text-stone-500">No reports available</p>');
    html('detail', `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">${backLabel()}</button><span class="text-xs text-stone-500">Laptop</span></header><div id="detail-connection"></div><article class="pt-5 pb-10"><div class="px-4"><div class="flex items-center gap-2 text-blue-700">${mark('Gemini')}<h2 class="text-xl font-semibold">Gemini worker</h2></div><p class="mt-3 text-sm text-stone-600">${status}${source.recordsConnected ? '' : ' · Saved queue'}</p><div class="mt-4 flex gap-3 text-sm"><span class="rounded bg-amber-50 px-3 py-2">${source.queueAvailable ? queued.length + ' waiting' : 'Queue unavailable'}</span><span class="rounded bg-blue-50 px-3 py-2">${accepted.length} accepted</span></div></div><section><h3 class="px-3 pt-2 pb-1 text-xs font-semibold text-stone-600">Recent reports</h3>${reportRows}</section>${group('Waiting', queued, source.queueAvailable ? 'Queue clear' : 'Queue unavailable', true, false)}${accepted.length ? group('Accepted by worker',accepted,'',false,false) : ''}<p class="px-4 pt-5 text-xs leading-5 text-stone-500">Reports show the worker’s last recorded tasks. A detected process or accepted errand does not confirm that a task is still running.</p></article>`);
  }

  const replyRequests = new Set();
  async function loadReply(item) {
    if (replyRequests.has(item.id)) return;
    replyRequests.add(item.id);
    try {
      const response = await fetch('/api/v1/results/' + encodeURIComponent(item.id), {cache:'no-store'});
      if (!response.ok) throw new Error('Unavailable');
      const value = await response.json(); replies.set(item.id, value.reply || 'No reply body recorded.');
    } catch { replies.set(item.id, 'Result unavailable. Open the saved result in Web Tools.'); }
    finally { replyRequests.delete(item.id); if (selected() === item.key) { detail(); connection(); } }
  }

  async function poll() {
    clearTimeout(timer);
    if (pending || document.hidden) return;
    pending = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/v1/now', {headers:etag ? {'If-None-Match':etag} : {},cache:'no-store',signal:controller.signal});
      accessDenied = response.status === 403;
      if (response.status !== 304) {
        if (!response.ok) throw new Error('Unavailable');
        const next = await response.json();
        if (next.schemaVersion !== 1 || !Array.isArray(next.items)) throw new Error('Unsupported snapshot');
        for (const [id] of replies) if (data?.items.find(i => i.id === id)?.at !== next.items.find(i => i.id === id)?.at) replies.delete(id);
        data = next; etag = response.headers.get('ETag') || '';
        try { localStorage.setItem('web-tools-now-snapshot', JSON.stringify(data)); } catch { }
      }
      failures = 0; connected = true; render();
    } catch { failures++; connected = false; render(); }
    finally {
      clearTimeout(timeout); pending = false;
      if(forceAfterPoll&&!document.hidden){forceAfterPoll=false;etag='';timer=setTimeout(poll,0);}
      else if (!document.hidden) timer = setTimeout(poll, Math.min(15000, 2000 * 2 ** Math.min(failures,3)));
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) { if(event.target.closest('#phone-session-menu a')){closeLaunch();return;} if(!event.target.closest('#phone-session-menu'))closeLaunch();const card=event.target.closest('#content [data-item]');if(card&&!event.target.closest('a,input,select,textarea'))openSession(card.dataset.item);return; }
    if(button.dataset.providerMenu){openLaunch('provider:'+button.dataset.providerMenu);return;}
    if(button.dataset.launch){openLaunch(button.dataset.launch);return;}
    if (button.dataset.copyTitle) {
      const key = button.dataset.copyTitle, item = findItem(key);
      if (item && navigator.clipboard?.writeText) navigator.clipboard.writeText(item.title).then(() => { copiedTitle = key; renderLaunch(); }).catch(() => { button.textContent = 'Copy unavailable'; });
      else button.textContent = 'Copy unavailable';
      return;
    }
    if (button.dataset.facet) {
      const key = button.dataset.for, facet = button.dataset.facet;
      if (selectedDetails.get(key) === facet) return;
      closeLaunch();selectedDetails.set(key,facet);
      detail();el('detail').querySelector(`[data-facet="${facet}"]`)?.focus({preventScroll:true});
      return;
    }
    if(button.dataset.status){selectedDetails.set(button.dataset.status,'activity');openSession(button.dataset.status);return;}
    if(button.dataset.sessionTokens){showTokens(button.dataset.sessionTokens);return;}
    if (button.dataset.assistant) { closeLaunch();assistant = assistant === button.dataset.assistant ? '' : button.dataset.assistant; render();return; }
    if (button.dataset.pick) { openSession(button.dataset.pick);return; }
    if (button.hasAttribute('data-back')) {
      closeLaunch();
      if (history.state?.nowDetail) history.back();
      else { history.replaceState(null,'',location.pathname+location.search+'#view=now'); restoreNow(); }
      return;
    }
    if(!event.target.closest('#phone-session-menu'))closeLaunch();
  });
  document.addEventListener('keydown', event => {
    if(event.key==='Escape'&&launchKey){closeLaunch(true);event.preventDefault();return;}
    const trigger=event.target.closest('[data-launch],[data-provider-menu]');
    if(trigger&&event.key==='ArrowDown'){event.preventDefault();const key=trigger.dataset.launch||'provider:'+trigger.dataset.providerMenu;if(launchKey!==key)openLaunch(key);launchMenu.querySelector('[role=menuitem]')?.focus({preventScroll:true});return;}
    if(launchKey&&event.target.closest('#phone-session-menu')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      const nodes=[...launchMenu.querySelectorAll('[role=menuitem]')],i=nodes.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(i+(event.key==='ArrowDown'?1:nodes.length-1))%nodes.length;nodes[next]?.focus({preventScroll:true});event.preventDefault();return;
    }
    if(event.key==='Tab'&&launchKey)setTimeout(()=>{if(!launchMenu.contains(document.activeElement))closeLaunch();},0);
    const button = event.target.closest('[data-facet]');
    if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const panel = button.closest('.phone-facets'), tabs = [...panel.querySelectorAll('[data-facet]')];
    const index = tabs.indexOf(button), next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const facet = tabs[next].dataset.facet;
    tabs[next].click();
    [...panel.querySelectorAll('[data-facet]')].find(n => n.dataset.facet === facet)?.focus({preventScroll:true});
    event.preventDefault();
  });
  const routeChanged=()=>{closeLaunch();if(window.NowViews?.active())return;if(selected()){savedKey=selected();render();detail();connection();window.scrollTo(0,0);}else restoreNow();};
  window.addEventListener('popstate',routeChanged);
  window.addEventListener('hashchange',routeChanged);
  window.addEventListener('nowviewchange', () => {closeLaunch();if (!window.NowViews?.active() || window.NowViews.current?.() === 'usage') { render(); connection(); } });
  window.addEventListener('nowusagearchivechange',render);
  window.addEventListener('resize',()=>{if(launchKey)placeLaunch();});
  document.addEventListener('scroll',()=>{if(launchKey)closeLaunch();},{capture:true,passive:true});
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) poll(); });
  window.addEventListener('online', poll);
  window.addEventListener('offline', () => { connected = false; connection(); });
  try { const cached = JSON.parse(localStorage.getItem('web-tools-now-snapshot')); if (cached?.schemaVersion === 1 && Array.isArray(cached.items)) data = cached; } catch { }
  window.NowPhone={refresh:()=>{etag='';if(pending){forceAfterPoll=true;return;}return poll();},openSession,snapshot:()=>data};
  render(); poll();
})();
