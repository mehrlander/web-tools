(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const focusStyle = 'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#047857] focus-visible:outline-offset-2';
  const touchMore = "pointer-coarse:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:-inset-x-[7px]";
  const statusTones = {working:'text-[#24785d]',waiting:'text-[#a57428]',accepted:'text-[#5879a1]',attention:'text-[#b87832]',quiet:'text-[#938b7d]'};
  const ui = {
    assistants:'sticky top-0 z-[2] grid grid-cols-3 gap-2 px-3 py-1 border-t-0 bg-stone-100 max-[350px]:gap-1 max-[350px]:px-2',
    provider:'phone-provider relative min-w-0',
    providerFilter:`phone-provider-filter block h-full w-full min-h-[42px] pt-0 px-0 pb-0.5 text-left border-b-2 border-transparent rounded aria-pressed:border-[#6f6a61] aria-pressed:bg-[#eae7e1] ${focusStyle}`,
    providerName:'phone-provider-name flex items-center gap-[3px] pr-[18px] text-[13px] font-semibold leading-5 whitespace-nowrap [&>svg]:size-4 [&>svg]:flex-none max-[350px]:text-xs max-[350px]:gap-0.5 max-[350px]:[&>svg]:size-[13px]',
    providerCounts:'phone-provider-counts mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-xs tabular-nums leading-4 text-[#827b71] [&_svg]:size-3 max-[350px]:gap-x-1 max-[350px]:text-[11px] max-[350px]:[&_svg]:size-[11px]',
    count:'inline-flex items-center gap-[3px] whitespace-nowrap',
    providerMore:`phone-provider-more absolute -right-[3px] top-0 grid place-items-center w-[18px] h-5 text-[#827b71] [&_svg]:size-[17px] pointer-coarse:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-top-3 pointer-coarse:after:bottom-0 pointer-coarse:after:-inset-x-[7px] ${focusStyle}`,
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
    detailBody:'phone-detail-body text-[17px] leading-[1.65] text-[#5e5549] [overflow-wrap:anywhere] min-h-20 [&_p]:my-[.7em] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere] [&_a]:text-[#277b67] [&_a]:underline [&_a]:underline-offset-2',
    sessionStep:`grid size-10 place-items-center rounded text-xl text-[#686156] disabled:opacity-30 ${focusStyle}`,
    topicButton:`inline-flex min-h-7 items-center gap-1.5 rounded px-1 text-xs tabular-nums text-stone-600 [&_svg]:size-3.5 [&_svg]:shrink-0 ${focusStyle}`,
    dialogTitle:'text-[15px] font-semibold leading-[21px] pr-[25px] mt-0 mx-0 mb-[9px] [overflow-wrap:anywhere]',
    dialogNote:'my-2 text-[#817565]',
    dialogCounts:'grid grid-cols-[minmax(0,1fr)_auto] gap-y-[5px] gap-x-3 my-3 [&_dd]:tabular-nums [&_dd]:text-right'
  };
  if (el('assistants')) el('assistants').className=ui.assistants;
  // Status counts can change the strip's height. Keep section headings just
  // below its measured edge without moving the reader's scroll position.
  if (window.ResizeObserver && el('assistants')) new ResizeObserver(([entry]) => {
    const height = entry.target.getBoundingClientRect().height;
    const panel = el('panel-now'), value = height + 'px';
    if (height > 0 && panel?.style.getPropertyValue('--phone-assistant-height') !== value) panel?.style.setProperty('--phone-assistant-height',value);
  }).observe(el('assistants'));
  const rendered = new WeakMap();
  const html = (id, value) => {
    const node = el(id);
    if (node && rendered.get(node) !== value) { node.innerHTML = value; rendered.set(node,value); }
  };
  const labels = {working:'Working',quiet:'No recent update',idle:'Idle',interrupted:'Interrupted',recent:'Recent',recorded:'Recorded',queued:'Waiting',claimed:'Accepted',reply:'Reply arriving',complete:'Complete',declined:'Declined',failed:'Needs review'};
  const tones = {working:'bg-emerald-100 text-emerald-900',quiet:'bg-amber-100 text-amber-900',queued:'bg-amber-100 text-amber-900',claimed:'bg-blue-100 text-blue-900',failed:'bg-rose-100 text-rose-900',interrupted:'bg-rose-100 text-rose-900',complete:'bg-emerald-50 text-emerald-900',recorded:'bg-violet-50 text-violet-900'};
  const colours = {codex:'text-emerald-700',gemini:'text-blue-700',claude:'text-orange-700'};
  const keyFor = provider => /gemini/i.test(provider) ? 'gemini' : /claude/i.test(provider) ? 'claude' : 'codex';
  const mark = (provider, cls = 'size-5 shrink-0') => window.assistantMark?.svg(keyFor(provider), {cls}) || '';
  const paths = {working:'M3 12h4l3-8 4 16 3-8h4',quiet:'M8 5v14M16 5v14',idle:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0',queued:'M7 3h10M7 21h10M8 3v5l8 8v5M16 3v5l-8 8v5',claimed:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',reply:'M5 9H2V6m0 3a9 9 0 1 1 1 9',complete:'m5 12 4 4L19 6',failed:'m12 3 10 18H2Zm0 6v5m0 3h.01',attention:'M8 12V7a2 2 0 0 1 4 0v4m0-4a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v6c0 4-3 6-7 6-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l1 1',more:'M12 5h.01M12 12h.01M12 19h.01'};
  paths.declined = 'M8 12h8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0';
  paths.topicOwner = 'M8 19c0-5 8-5 8 0M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0';
  paths.topicSession = 'M3 5h18v14H3ZM3 9h18M7 12l2 2-2 2m5 0h4';
  paths.topicExternal = 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18';
  paths.topicDropped = 'm9 9 6 6m0-6-6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0';
  paths.topics = 'M4 5h16v12H9l-5 4Zm4 4h8m-8 4h5';
  paths.members = 'M5 3h14v18H5Zm3 5h8m-8 4h8m-8 4h5';
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === 'more' ? 3 : 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.idle}"/></svg>`;
  function status(item) {
    if (item.state === 'failed') return {glyph:'failed',label:'Needs review: failed',tone:'attention'};
    if (item.state === 'interrupted') return {glyph:'attention',label:'Interrupted',tone:'attention'};
    if (item.needsAttention || item.state === 'needs-you') return {glyph:'attention',label:'Needs attention',tone:'attention'};
    return {glyph:paths[item.state] ? item.state : 'idle',label:({quiet:'No recent update',claimed:'Accepted; awaiting an update',recent:'Recent activity'})[item.state] || labels[item.state] || 'Recorded',tone:({working:'working',reply:'working',queued:'waiting',claimed:'accepted',quiet:'quiet'})[item.state] || 'quiet'};
  }
  const badge = item => { const value=status(typeof item==='string'?{state:item}:item); return `<span class="${ui.status} phone-status-${value.tone} ${statusTones[value.tone]}">${icon(value.glyph)}<span>${escape(value.label)}</span></span>`; };
  const age = at => { const seconds = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : new Date(at).toLocaleDateString(); };
  const observedTime = at => `<time data-at="${escape(at)}" datetime="${escape(at)}" data-title-tip="${escape('Observed '+stamp(at))}">${escape(stamp(at))}</time>`;
  const stamp = at => at ? new Date(at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not yet';
  const safeUrl = value => { try { const url = new URL(value); return url.origin === 'https://mehrlander.github.io' && !url.username && !url.password && !url.port && url.pathname.startsWith('/web-tools/') ? url.href : ''; } catch { return ''; } };
  let data, assistant = '', timer, etag = '', failures = 0, pending = false, connected = false, accessDenied = false, savedScroll = 0;
  let launchKey = '', copiedTitle = '', savedKey = '', temporaryItem = null, forceAfterPoll = false, detailTrail = null;
  let syncRetryPending = false, syncRetryUntil = 0, syncRetryMessage = '';
  const desktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const selectedDetails = new Map();
  const replies = new Map();
  const filtered = () => (data?.items || []).filter(i => !assistant || keyFor(i.provider) === assistant);
  const active = i => i.state === 'working' && !i.needsAttention;
  const recordedChange = change => ({...change,kind:'change',state:'recorded'});
  const selected = () => { try { const p=new URLSearchParams(location.hash.slice(1)); return p.get('item') || ((!p.get('view') || p.get('view') === 'now') ? p.get('session') || '' : ''); } catch { return ''; } };
  const backLabel = () => history.state?.nowDetail && history.state.fromDetail ? '← Back' : '← ' + (history.state?.nowDetail ? ({now:'Now',usage:'Usage',errands:'Errands',computer:'Computer',files:'Files'}[history.state.originView] || 'Now') : 'Now');
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
  const substantive = value => {
    const text = replyPreview(value);
    return !text || /^(?:Prompt received[.!]?|Response recorded[.!]?|Conversation (?:running|idle|interrupted)[.!]?|No recent (?:event|activity|update)[.!]?|Turn has no recent\b.*|Working with \d+ agents?[.!]?|Delegated work: \d+ agents?[.!]?)$/i.test(text) ? '' : text;
  };
  function statusText(item) {
    const work = latestWork(item);
    const candidates = [
      {kind:'summary',text:substantive(work?.summary),at:work?.at || item.work?.through || work?.generatedAt},
      {kind:'summary',text:substantive(item.checkpoint?.summary) || substantive(item.checkpoint?.headline),at:item.checkpoint?.at || item.checkpoint?.analyzedAt},
      {kind:'reply',text:substantive(item.turn?.response),at:item.turn?.updatedAt},
    ].filter(candidate => candidate.text).sort((a,b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
    const latest = candidates[0];
    if (latest) return (latest.kind === 'reply' ? 'Last reply: ' : 'Last summary: ') + latest.text;
    const activity=related(item).find(member=>member.key===item.activityKey)||item;
    const action = substantive(usefulDetail(activity)) || (activity.turn?.lastTool ? 'Used '+activity.turn.lastTool : '');
    return action ? 'Last activity: '+action : '';
  }
  const topics = item => Array.isArray(item.checkpoint?.topics) ? item.checkpoint.topics.filter(topic => typeof topic?.topic === 'string' && topic.topic.trim()) : [];
  function leadTopic(item) {
    return topics(item).filter(topic => !topic.minor && Number.isSafeInteger(topic.last) && topic.last >= 0
      && Array.isArray(topic.spans) && topic.spans.some(span => Number.isSafeInteger(span?.start) && span.start > 0 && Number.isSafeInteger(span.end) && span.end >= span.start))
      .sort((a,b) => b.last-a.last)[0];
  }
  const usefulTitle = value => {
    const text=substantive(value);
    return /^(?:Current work|Work in progress|Working|Session|Cloud work|Unknown|Untitled)$/i.test(text) ? '' : text;
  };
  const itemTitle = item => leadTopic(item)?.topic || usefulTitle(item.checkpoint?.headline) || usefulTitle(latestWork(item)?.headline) || item.title;
  const related = item => Array.isArray(item.members) ? item.members.filter(member => member && typeof member.key === 'string') : [];
  const parentItem = key => data?.items.find(item => related(item).some(member => member.key === key)
    || Array.isArray(item.relatedKeys) && item.relatedKeys.includes(key));
  const trailKey = key => parentItem(key)?.key || key;
  function topicControl(item) {
    const list=topics(item),members=related(item),total=Number.isSafeInteger(item.memberCount)&&item.memberCount>0?item.memberCount:members.length+1;
    if (!list.length && total < 2) return '';
    const counts=new Map();
    for(const topic of list){
      const key=topic.status==='open' ? ({owner:'topicOwner',session:'topicSession',external:'topicExternal'}[topic.waitsOn] || 'queued')
        : topic.status==='done' ? 'complete' : topic.status==='dropped' ? 'topicDropped' : null;
      if(key)counts.set(key,(counts.get(key)||0)+1);
    }
    const marks=[...counts].map(([key,count])=>`<span class="inline-flex items-center gap-0.5">${icon(key)}<span>${count}</span></span>`).join('') || (list.length?`${icon('topics')}<span>${list.length}</span>`:'');
    return `<button class="${ui.topicButton}" data-topic-context="${escape(item.key)}" aria-label="${escape((list.length?list.length+' recorded topics':'Related activity')+(total>1?', '+total+' related observations':'')+'. Open details')}" aria-haspopup="dialog">${marks}${total>1?`<span class="inline-flex items-center gap-0.5">${icon('members')}<span>${total}</span></span>`:''}</button>`;
  }
  function locationMark(location) {
    if (!['Laptop','Cloud'].includes(location)) return escape(location);
    const label = location === 'Cloud' ? 'Cloud' : 'On this laptop';
    const path = location === 'Cloud' ? '<path d="M6.5 19a4.5 4.5 0 0 1-.8-8.93A6.5 6.5 0 0 1 18.5 9a5 5 0 0 1-.5 10Z"/>' : '<rect x="4" y="3" width="16" height="13" rx="1.5"/><path d="m4 16-2 4h20l-2-4M9 20h6"/>';
    return `<svg data-location="${location}" role="img" aria-label="${label}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" class="inline-block size-3.5 shrink-0 ${location === 'Cloud' ? 'text-sky-700' : 'text-stone-500'}"><title>${label}</title>${path}</svg>`;
  }
  function row(item, position) {
    const key = escape(item.key), summary = replyPreview(statusText(item));
    const value=status(item);
    return `<article data-item="${key}" class="${ui.row}"><span class="${ui.mark} ${colours[keyFor(item.provider)]}">${position ? `<span class="${ui.position}">${position}.</span>` : mark(item.provider)}</span><div class="phone-row-content min-w-0">
      <button data-pick="${key}" class="${ui.pick}" aria-label="${escape('Read ' + itemTitle(item))}"><span class="${ui.rowTitle}">${escape(itemTitle(item))}</span></button>
      ${summary ? `<p data-summary class="${ui.summary}">${escape(summary.slice(0,180))}</p>` : ''}
      <div class="${ui.meta}">${topicControl(item)}<button class="${ui.status} ${ui.statusButton} phone-status-${value.tone} ${statusTones[value.tone]}" data-status="${key}" aria-label="${escape(value.label)}" data-title-tip="${escape(value.label)}">${icon(value.glyph)}</button><span>${escape(item.provider)}</span>${locationMark(item.location)}${item.work?.agents ? `<span>${item.work.agents} agents</span>` : ''}${observedTime(item.at)}${tokenBadge(item)}</div>
      </div><button data-launch="${key}" aria-expanded="${launchKey === item.key}" aria-controls="phone-session-menu" aria-haspopup="menu" aria-label="${escape('Actions for ' + item.title)}" class="${ui.more}">${icon('more')}</button></article>`;
  }

  function group(title, items, empty = '', numbered = false, inline = true) {
    return `<section aria-label="${escape(title)}"><h2 class="${inline ? 'sticky top-[var(--phone-assistant-height,50px)] z-[1] bg-stone-100 ' : ''}flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold text-stone-600"><span>${escape(title)}</span>${items.length ? `<span class="font-normal">${items.length}</span>` : ''}</h2>${items.length ? items.map((i,n) => row(i, numbered ? n + 1 : 0, inline)).join('') : `<p class="px-3 py-2 text-[13px] text-stone-500">${escape(empty)}</p>`}</section>`;
  }

  function changeItems() {
    const delegated = new Set(data.items.flatMap(i => (i.work?.members || []).map(id => `session:${i.provider}:${id}`)));
    return (data.changes || []).filter(c => !delegated.has(c.key) && !parentItem(c.key) && (!assistant || keyFor(c.provider) === assistant)).map(c => {
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
  function activityGroups(items = filtered()) {
    const current = items.filter(active);
    const needs = items.filter(i => i.needsAttention && !active(i) && i.state !== 'queued');
    const accepted = items.filter(i => i.state === 'claimed' && !i.needsAttention);
    const arriving = items.filter(i => i.state === 'reply' && !i.needsAttention);
    const quiet = items.filter(i => i.state === 'quiet' && !i.needsAttention);
    const queued = items.filter(i => i.state === 'queued').sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const shown = new Set([...current,...needs,...accepted,...arriving,...queued,...quiet].map(i => i.key));
    return {current,needs,accepted,arriving,queued,quiet,recent:recentItems(items,shown)};
  }
  const sessionItem = item => item && (['session','cloud'].includes(item.kind) || item.kind === 'change' && /^(session:|cloud:)/.test(item.key));
  function sessionKeys(originView) {
    if (originView === 'usage') return (window.NowPhoneUsage?.recentRows?.() || []).map(row => row.identity).filter(key => typeof key === 'string');
    const {current,needs,accepted,arriving,queued,quiet,recent} = activityGroups();
    return [...current,...needs,...accepted,...arriving,...queued,...quiet,...recent].filter(sessionItem).map(item => item.key);
  }
  function workerReport(recentOnly = false) {
    const report = data.sources.workerActivity;
    if (!report || assistant && assistant !== 'gemini' || recentOnly && (data.sources.workerState !== 'detected' || Date.now() - Date.parse(report.at) > 900000)) return '';
    const job = report.itemId && data.items.find(i => i.kind === 'errand' && i.id === report.itemId);
    return `<button data-pick="worker:gemini" aria-label="Gemini daemon details" class="mx-3 mt-2 block w-[calc(100%-1.5rem)] rounded-lg border-l-4 border-blue-400 bg-blue-50 px-2 py-2 text-left active:bg-blue-100"><span class="float-right text-xl text-blue-600" aria-hidden="true">›</span><p class="text-xs font-medium text-blue-900">Gemini daemon · Last reported task</p><p class="mt-0.5 text-[13px] leading-5">${escape(report.headline)}</p>${job ? `<p class="mt-1 text-sm text-stone-600">${escape(job.title)}</p>` : ''}<p class="mt-1 text-xs text-stone-500">Reported ${observedTime(report.at)}</p></button>`;
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

  function savedObservation() {
    const at = Date.parse(data.observedAt);
    return !connected || !Number.isFinite(at) || Date.now()-at >= 15000;
  }

  const syncNames = {errands:'Errands',sessions:'Session history',summaries:'Session summaries'};
  const syncErrors = {timeout:'The refresh took too long.', 'fetch-failed':'Could not refresh from GitHub.', 'read-failed':'The saved records could not be read.', 'invalid-data':'The received records could not be interpreted.', 'repository-unavailable':'The local activity repository is unavailable.'};
  const syncError = code => Object.hasOwn(syncErrors,code) ? syncErrors[code] : 'The refresh failed.';
  function syncFeeds() {
    return Object.entries(syncNames).flatMap(([key,label]) => {
      const health = data?.sources?.sync?.[key];
      return health && ['unknown','refreshing','ok','error'].includes(health.state) ? [{...health,key,label}] : [];
    });
  }
  const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  function syncNotice() {
    return syncFeeds().filter(feed => feed.state === 'error' || feed.state === 'refreshing' && feed.errorCode).map(feed => {
      const saved = savedObservation(), label = `${feed.label} ${saved ? 'status' : feed.state === 'refreshing' ? 'retrying' : feed.errorCode === 'timeout' ? 'timed out' : 'delayed'}`;
      return `<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5"><a data-sync-status="${feed.key}" href="#view=now&amp;session=status%3Async" class="inline-flex min-h-7 items-center gap-1 rounded text-sm font-medium underline decoration-amber-700/40 underline-offset-4 ${focusStyle}" aria-label="${escape(feed.label+': '+syncError(feed.errorCode)+' Open connection status.')}"${saved?' data-saved-observation':''}>${escape(label)}<span aria-hidden="true">›</span></a><span class="text-xs">${validTime(feed.succeededAt)?`Last synced ${observedTime(feed.succeededAt)}`:'No successful refresh recorded'}</span>${saved?'<span class="w-full text-xs">Saved sync status</span>':''}</div>`;
    }).join('');
  }

  function queueNotice() {
    const waiting = data.items.filter(item => item.kind === 'errand' && keyFor(item.provider) === 'gemini' && item.state === 'queued');
    if (!waiting.length || data.sources.workerState !== 'absent') return '';
    const label = `${waiting.length} Gemini ${waiting.length === 1 ? 'errand' : 'errands'} waiting`;
    const saved = savedObservation(), savedQueue = saved || !data.sources.recordsConnected;
    const link = `inline-flex min-h-7 items-center gap-1 rounded underline decoration-amber-700/40 underline-offset-4 ${focusStyle}`;
    return `<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><a data-queue-notice="gemini" href="#view=errands&amp;provider=gemini&amp;tab=waiting" class="${link} text-sm font-medium" aria-label="${escape('Review '+label)}">${escape(label)}<span aria-hidden="true">›</span></a><a data-worker-status="gemini" href="#view=now&amp;session=worker%3Agemini" class="${link}" aria-label="${saved?'Last observation: Gemini errand daemon not detected.':'Gemini errand daemon not detected.'} Open daemon status.">${saved?'Daemon status':'Daemon not detected'}<span aria-hidden="true">›</span></a>${savedQueue ? `<span class="w-full text-xs">${saved?'Saved queue and daemon status':'Saved queue'}</span>` : ''}</div>`;
  }

  function render() {
    renderUsage();
    if (data) el('machine').textContent = data.machineName;
    if (window.NowViews?.active()) { connection(); return; }
    if (!data) { detail(); connection(); return; }
    // Rebuilding open panels can temporarily shorten the document and clamp its scroll position.
    const viewport = {left:window.scrollX,top:nowScroll()};
    const focus = ['content','assistants','notice'].some(id => el(id).contains(document.activeElement)) ? document.activeElement : null;
    const focusAction = focus && ['pick','status','assistant','providerMenu','launch','sessionTokens','topicContext','queueNotice','workerStatus','syncStatus'].find(key => focus.dataset[key]);
    const focusKey = focusAction && focus.dataset[focusAction];
    const focusOwner = focus?.dataset.for;
    html('assistants', ['codex','gemini','claude'].map(key => {
      const items = data.items.filter(i => keyFor(i.provider) === key);
      const counts=new Map();
      for(const item of items){const s=status(item),id=s.glyph+'|'+s.label;const v=counts.get(id)||{...s,count:0};v.count++;counts.set(id,v);}
      const states=[...counts.values()], current=states.filter(s=>!['idle','complete'].includes(s.glyph));
      const shown=current.length?current:states.length?states:[{glyph:'idle',label:'No observed activity',tone:'quiet',count:0}];
      return `<div class="${ui.provider}"><button data-assistant="${key}" aria-pressed="${assistant === key}" aria-label="${escape({codex:'Codex',gemini:'Gemini',claude:'Claude'}[key] + ': ' + shown.map(s=>s.count+' '+s.label.toLowerCase()).join(', '))}" class="${ui.providerFilter}"><span class="${ui.providerName} ${colours[key]}">${mark(key)}${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]}</span><span class="${ui.providerCounts}">${shown.map(s=>`<span class="phone-status-${s.tone} ${statusTones[s.tone]} ${ui.count}" title="${escape(s.count+' '+s.label)}">${icon(s.glyph)}<span>${s.count}</span></span>`).join('')}</span></button><button data-provider-menu="${key}" class="${ui.providerMore}" aria-label="${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]} options" aria-haspopup="menu" aria-expanded="${launchKey === 'provider:'+key}">${icon('more')}</button></div>`;
    }).join(''));
    const items = filtered();
    const syncNotices = new Set(syncFeeds().length && Array.isArray(data.sources.syncNotices) ? data.sources.syncNotices : []);
    html('notice', queueNotice() + syncNotice() + data.sources.notices.filter(note => note && !syncNotices.has(note)).map(note => `<div>${escape(note)}</div>`).join(''));
    const {current,needs,accepted,arriving,queued,quiet,recent} = activityGroups(items);
    const queueTitle = data.sources.recordsConnected ? 'Waiting' : 'Waiting · Saved queue';
    const queue = queued.length ? group(queueTitle,queued,'',true) : assistant === 'gemini' && !data.sources.queueAvailable ? group('Waiting',[],'Queue unavailable') : '';
    html('content', group('In progress',current,'No current work observed') + (needs.length ? group('Needs you',needs) : '')
      + (accepted.length ? group('Accepted',accepted) : '') + (arriving.length ? group('Reply arriving',arriving) : '')
      + queue + workerReport(true) + (quiet.length ? group('No recent update',quiet) : '') + group('Other recent',recent,'No recent activity.'));
    html('source-times', `Errands synced ${escape(stamp(data.sources.recordsSyncedAt))}<br>Cloud records captured ${escape(stamp(data.sources.cloudCapturedAt))}`);
    updateTimes(); detail(); connection(); renderLaunch();
    if (focusAction && !focus.isConnected) {
      const target = [...document.querySelectorAll('#content button,#content a,#assistants button,#assistants a,#notice a')].find(n => n.dataset[focusAction] === focusKey && n.dataset.for === focusOwner);
      (target || (['queueNotice','workerStatus','syncStatus'].includes(focusAction) ? el('view-picker') : null))?.focus({preventScroll:true});
    }
    document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = age(node.dataset.at); });
    if (!selected() && nowScroll() !== viewport.top) scrollNow(viewport.top);
  }

  function findItem(key) {
    const direct=data?.items.find(i=>i.key===key)||data?.items.flatMap(related).find(i=>i.key===key)||data?.changes?.filter(c=>c.key===key).map(recordedChange)[0];
    if(direct)return direct;
    const value=metadata().sessions?.find(row=>row.provider==='claude'&&'cloud:'+row.id===key),at=Date.parse(value?.usageAt);
    if(value&&Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<=86400000){
      const known=data?.items.find(i=>i.provider==='Claude'&&i.kind==='cloud'&&i.id===value.id);
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
      const counts = new Map();
      for (const item of data?.items || []) if (keyFor(item.provider) === key) { const label = status(item).label; counts.set(label,(counts.get(label) || 0) + 1); }
      value=`<p data-provider-status>${escape([...counts].map(([label,count]) => count+' '+label).join(' · ') || 'No observed activity')}</p><a data-provider-link="${key}" href="${url}" target="_blank" rel="noopener noreferrer">Open ${{codex:'ChatGPT',gemini:'Antigravity',claude:'Claude Code'}[key]}</a>`;
    }else{
      const item=findItem(launchKey);if(!item){closeLaunch();return;}
      value=window.NowView.sessionActions(item,{desktop,copied:copiedTitle===item.key});
    }
    if(rendered.get(launchMenu)!==value){launchMenu.innerHTML=value;rendered.set(launchMenu,value);}
    launchMenu.querySelectorAll('a,button').forEach(node=>{node.setAttribute('role','menuitem');node.tabIndex=-1;node.className=ui.menuItem;});
    launchMenu.hidden=false;launchAnchor()?.setAttribute('aria-expanded','true');placeLaunch();
    if(action&&focusKey)[...launchMenu.querySelectorAll('a,button')].find(n=>n.dataset[action]===focusKey)?.focus({preventScroll:true});
  }
  function openLaunch(key){if(launchKey===key){closeLaunch();return;}window.NowPhoneInfo?.close({restoreFocus:false});closeLaunch();launchKey=key;copiedTitle='';renderLaunch();}
  function makeTrail(key, originView) {
    const keys = [...new Set(sessionKeys(originView).map(trailKey))],canonical=trailKey(key);
    return {keys:keys.includes(canonical) ? keys : [canonical],originView,filter:assistant,scroll:nowScroll(),returnKey:canonical};
  }
  function currentTrail(key = selected()) {
    const normalize = trail => trail && Array.isArray(trail.keys) && trail.keys.length <= 512 && trail.keys.every(value => typeof value === 'string')
      ? {...trail,keys:[...new Set(trail.keys.map(trailKey))],returnKey:trailKey(trail.returnKey)} : null;
    const stored = normalize(history.state?.nowSessionTrail),canonical=trailKey(key);
    detailTrail=normalize(detailTrail);
    if (stored?.keys.includes(canonical)) detailTrail = stored;
    if (!detailTrail?.keys.includes(canonical)) detailTrail = makeTrail(key,'now');
    return detailTrail;
  }
  function sessionNavigation(key) {
    const trail=currentTrail(key),index=trail.keys.indexOf(trailKey(key));
    if (trail.keys.length < 2) return '';
    return `<nav class="flex items-center gap-0.5" aria-label="Neighboring sessions"><button class="${ui.sessionStep}" data-session-step="-1" aria-label="Previous session" ${index<=0?'disabled':''}>‹</button><span class="min-w-9 text-center text-xs tabular-nums text-stone-500" aria-label="Session ${index+1} of ${trail.keys.length}">${index+1}/${trail.keys.length}</span><button class="${ui.sessionStep}" data-session-step="1" aria-label="Next session" ${index>=trail.keys.length-1?'disabled':''}>›</button></nav>`;
  }
  function stepSession(direction) {
    const key=selected(),trail=currentTrail(key),index=trail.keys.indexOf(trailKey(key)),next=trail.keys[index+direction];
    if (!next) return;
    window.NowPhoneInfo?.close({restoreFocus:false});closeLaunch();
    history.replaceState({...history.state,nowSessionTrail:trail},'','#view=now&session='+encodeURIComponent(next));
    detail();connection();window.scrollTo(0,0);
    el('detail').querySelector('h2')?.focus({preventScroll:true});
  }
  function openSession(key){
    if(typeof key!=='string'||!key||key.length>1024||/[\u0000-\u001f]/.test(key))return;
    const route='#view=now&session='+encodeURIComponent(key),originView=window.NowViews?.current?.() || 'now';
    detailTrail=makeTrail(key,originView);savedScroll=detailTrail.scroll;savedKey=key;closeLaunch();window.NowPhoneInfo?.close({restoreFocus:false});
    if(location.hash!==route)history.pushState({nowDetail:true,originView,nowSessionTrail:detailTrail,fromDetail:!!selected()},'',route);
    window.NowViews?.setView?.('now',false);render();detail();connection();window.scrollTo(0,0);
    el('detail').querySelector('h2')?.focus({preventScroll:true});
  }
  function restoreNow(){
    if (detailTrail) { assistant=detailTrail.filter || ''; savedScroll=detailTrail.scroll; savedKey=detailTrail.returnKey; }
    render();scrollNow(savedScroll);
    ([...el('content').querySelectorAll('[data-pick]')].find(n=>n.dataset.pick===savedKey)||el('view-picker'))?.focus({preventScroll:true});
    detailTrail=null;
  }
  function updateTimes(){document.querySelectorAll('time[data-at]').forEach(node=>{node.textContent=age(node.dataset.at);});}
  function showTokens(key, anchor){
    const item=findItem(key),reading=window.NowRecentUsage?.matchUsage?.(item&&adapted(item),metadata(),{now:Date.now()});
    if(!reading)return;
    closeLaunch();
    const number=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('en-US'):'Not recorded';
    window.NowPhoneInfo?.open({anchor,title:'Recorded session tokens',body:`<h3 class="${ui.dialogTitle}">${escape(item.title)}</h3><p class="${ui.dialogNote}">Recorded main-conversation calls · badge shows output</p><dl class="${ui.dialogCounts}">${[['Output',reading.outputTokens],['Fresh input',reading.inputTokens],['Cache read',reading.cacheReadTokens],['Cache write',reading.cacheWriteTokens]].map(([label,value])=>`<dt>${label}</dt><dd>${number(value)}</dd>`).join('')}</dl><p class="${ui.dialogNote}">Last input context: ${number(reading.contextTokens)} tokens. Measured ${escape(stamp(new Date(reading.usageAt).toISOString()))}. ${reading.saved?'Saved reading; usage sync is unavailable. ':''}Counts cover all recorded calls. Subagent calls are excluded. Context describes one call.</p>`});
  }
  function showTopicContext(key, anchor) {
    const item=findItem(key);if(!item)return;closeLaunch();
    const list=topics(item),members=related(item),total=Number.isSafeInteger(item.memberCount)?item.memberCount:members.length+1;
    const labels={owner:'Waits on you',session:'Waits on the session',external:'Waits on someone outside'};
    const topicRows=list.map(topic=>{
      const disposition=topic.status==='done'?'Done':topic.status==='dropped'?'Dropped':topic.status==='open'?(labels[topic.waitsOn]||'Open'):'';
      const reason=topic.status==='open'&&typeof topic.waiting==='string'?topic.waiting:'';
      return `<li data-topic-name="${escape(topic.topic)}" data-topic-status="${['open','done','dropped'].includes(topic.status)?topic.status:''}" class="border-b border-stone-100 py-2"><strong class="font-medium ${topic.status==='dropped'?'line-through text-stone-500':''}">${escape(topic.topic)}</strong>${disposition?`<span class="ml-2 text-xs text-stone-500">${disposition}</span>`:''}${reason?`<p class="mt-1 text-sm">${escape(reason)}</p>`:''}${topic.basis?`<p class="mt-1 text-xs text-stone-500">Basis: ${escape(topic.basis)}</p>`:''}${topic.evidence?`<p class="text-xs text-stone-500">${escape(topic.evidence)}</p>`:''}</li>`;
    }).join('');
    const observations=members.length?[item,...members].map(member=>`<li><button class="block min-h-11 w-full py-2 text-left text-sm text-emerald-800 underline underline-offset-2" data-related-session="${escape(member.key)}">${escape(member.title||member.key)}</button><span class="text-xs text-stone-500">${escape(member.provider)} · ${escape(status(member).label)}</span></li>`).join(''):'';
    window.NowPhoneInfo?.open({anchor,title:list.length?'Recorded topics':'Related activity',body:`${topicRows?`<ul class="m-0 list-none p-0">${topicRows}</ul><p class="mt-2 text-xs text-stone-500">Recorded ${escape(stamp(item.checkpoint?.at))}</p>`:''}${item.checkpoint?.topicsPartial===true?'<p class="text-xs text-stone-500">Some topic details omitted.</p>':''}${total>1?`<section class="mt-3"><h3 class="text-sm font-semibold">Related activity · ${total}</h3>${observations?`<ul class="m-0 list-none divide-y divide-stone-100 p-0">${observations}</ul>`:''}${total>members.length+1?`<p class="text-xs text-stone-500">Showing ${members.length+1} of ${total} related observations.</p>`:''}</section>`:''}`});
  }
  function openRelated(key) {
    if (!findItem(key)) return;
    if (!selected()) { openSession(key); return; }
    const trail=currentTrail();window.NowPhoneInfo?.close({restoreFocus:false});closeLaunch();
    history.replaceState({...history.state,nowSessionTrail:trail},'','#view=now&session='+encodeURIComponent(key));
    detail();connection();window.scrollTo(0,0);el('detail').querySelector('h2')?.focus({preventScroll:true});
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
    const activity=related(item).find(member=>member.key===item.activityKey)||item;
    const parts = [], reply = replies.get(item.id), events = observedEvents(activity,inline);
    if (latestWork(item)) parts.push({id:'summary',label:'Summary',title:'Work updates',body:workBody(item,inline)});
    if (item.turn?.response?.trim()) parts.push({id:'reply',label:'Reply',title:'Latest reply',body:markdown(item.turn.response)});
    else if (item.kind === 'errand' && ['reply','complete','declined','failed'].includes(item.state)) parts.push({id:'reply',label:'Reply',title:'Errand result',body:`<div data-reply="${escape(item.key)}">${reply === undefined ? '<p class="text-stone-500">Reading result…</p>' : markdown(reply)}</div>`});
    if (item.checkpoint && !parts.some(p => p.id === 'summary')) parts.push({id:'summary',label:'Summary',title:'Published summary',body:checkpointBody(item.checkpoint,inline)});
    if (item.turn?.prompt?.trim()) {
      const notice = window.NowReading?.notification(item.turn.prompt);
      parts.push({id:'prompt',label:notice ? 'Update' : 'Prompt',title:notice ? 'Background update' : 'Prompt',body:markdown(item.turn.prompt)});
    }
    const detail = usefulDetail(activity);
    const meaningful = detail && !/^(Conversation (running|idle|interrupted)|No recent event|Delegated work: \d+ agents?)$/.test(detail);
    const agents = activity.work?.agents || 0;
    const activitySource=activity!==item?`<p class="mb-2 text-xs text-stone-500">Activity from <button class="text-emerald-800 underline" data-related-session="${escape(activity.key)}">${escape(activity.title)}</button></p>`:'';
    const observation = `${activitySource}<div aria-label="Current observation" class="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">${badge(activity)}${agents ? `<span>${agents} delegated ${agents === 1 ? 'agent' : 'agents'}</span>` : ''}<span>Observed ${observedTime(activity.at)}</span></div>`;
    parts.push({id:'activity',label:'Activity',title:'Observed activity',body:`${observation}${activity.turn ? `<dl class="mb-2 text-xs text-stone-500"><div class="flex flex-wrap gap-x-1"><dt>Turn started</dt><dd>${escape(stamp(activity.turn.startedAt))}</dd></div>${activity.turn.lastTool ? `<div class="mt-1 flex items-center gap-1"><dt>Last tool</dt><dd class="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900">${escape(activity.turn.lastTool)}</dd></div>` : ''}</dl>` : ''}${meaningful && !events.some(e => e.detail === detail) && !(activity.turn?.lastTool && /^Using /.test(detail)) ? markdown(detail) : ''}${events.length ? `<ol class="divide-y divide-stone-100">${events.map(e => `<li class="flex items-start gap-2 py-1.5"><span class="w-12 shrink-0 pt-0.5 text-xs text-stone-500">${observedTime(e.at)}</span><div class="min-w-0 flex-1">${markdown(e.detail || labels[e.state] || e.state)}</div></li>`).join('')}</ol>` : agents && !meaningful && !activity.turn?.lastTool ? '<p class="text-xs text-stone-500">No detailed action reports captured for this group.</p>' : ''}`});
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
    window.NowViews?.setContext?.(key && key !== 'worker:gemini' ? item || null : null);
    if (!key) return;
    if (key === 'worker:gemini') { workerDetail(); return; }
    if (key === 'status:sync') { syncDetail(); return; }
    if (!item) {
      html('detail',`<header class="${ui.detailHeader}"><button data-back class="${ui.back}">${backLabel()}</button>${sessionNavigation(key)}</header><div id="detail-connection"></div><p class="p-4 text-base">Activity is no longer in the current snapshot.</p>`);
      return;
    }
    const viewport={left:window.scrollX,top:window.scrollY},focused=document.activeElement,focus=focused?.closest('[data-facet]')?.dataset.facet;
    const focusAction=['launch','sessionTokens','sessionStep','topicContext','relatedSession','back'].find(name=>focused?.hasAttribute('data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))),focusHeading=focused?.matches('#detail h2');
    const focusAttribute=focusAction&&'data-'+focusAction.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),focusValue=focusAttribute&&focused.getAttribute(focusAttribute);
    const title=itemTitle(item),original=title!==item.title?`<p class="text-xs text-stone-500">Session: ${escape(item.title)}</p>`:'';
    const value = `<header class="${ui.detailHeader}"><button data-back class="${ui.back}">${backLabel()}</button>${sessionNavigation(key)}<button data-launch="${escape(item.key)}" class="${ui.more}" aria-label="${escape('Actions for '+item.title)}" aria-controls="phone-session-menu" aria-haspopup="menu" aria-expanded="${launchKey===item.key}">${icon('more')}</button></header><div id="detail-connection"></div><article class="${ui.detailArticle}"><div class="${ui.meta}">${mark(item.provider)}<span>${escape(item.provider)}</span>${locationMark(item.location)}</div><h2 tabindex="-1" class="${ui.detailTitle}">${escape(title)}</h2>${original}<div class="${ui.meta}">${topicControl(parentItem(key)||item)}${badge(item)}${observedTime(item.at)}${tokenBadge(item)}</div>${itemBody(item)}</article>`;
    html('detail', value);
    updateTimes();
    if(focus)el('detail').querySelector(`[data-facet="${focus}"]`)?.focus({preventScroll:true});
    else if(focusAction)[...el('detail').querySelectorAll('['+focusAttribute+']')].find(node=>node.getAttribute(focusAttribute)===focusValue)?.focus({preventScroll:true});
    else if(focusHeading)el('detail').querySelector('h2')?.focus({preventScroll:true});
    if(window.scrollY!==viewport.top)window.scrollTo(viewport.left,viewport.top);
    if (item.kind === 'errand' && ['reply','complete','declined','failed'].includes(item.state) && !replies.has(item.id)) loadReply(item);
  }

  function syncDetail() {
    if (!data) return;
    const viewport = {left:window.scrollX,top:window.scrollY}, focused = document.activeElement;
    const headingFocused = focused === el('detail').querySelector('h2');
    const focusAttribute = el('detail').contains(focused) && ['data-back','data-sync-retry','data-worker-status'].find(attribute => focused.hasAttribute(attribute));
    const focusValue = focusAttribute && focused.getAttribute(focusAttribute);
    const feeds = syncFeeds(), saved = savedObservation(), busy = syncRetryPending || feeds.some(feed => feed.state === 'refreshing');
    const cooldown = Math.max(0,Math.ceil((syncRetryUntil-Date.now())/1000));
    const cards = feeds.map(feed => {
      const state = {unknown:'Not checked',refreshing:'Refreshing',ok:'Up to date',error:'Delayed'}[feed.state];
      const tone = saved ? 'text-stone-600' : feed.state === 'ok' ? 'text-emerald-700' : feed.state === 'error' ? 'text-amber-800' : 'text-blue-700';
      const schedule = validTime(feed.nextAttemptAt) && Date.parse(feed.nextAttemptAt) > Date.now() ? `<p class="mt-2 text-xs text-stone-500">Automatic retry ${escape(stamp(feed.nextAttemptAt))}</p>` : feed.state === 'error' ? '<p class="mt-2 text-xs text-stone-500">Retries automatically while the companion is running.</p>' : '';
      return `<section data-sync-feed="${feed.key}" class="border-b border-stone-100 py-4"><div class="flex flex-wrap items-baseline justify-between gap-2"><h3 class="font-semibold text-stone-800">${feed.label}</h3><span class="text-sm ${tone}">${state}${saved?' · Saved observation':''}</span></div>${feed.errorCode?`<p class="mt-2 text-sm text-amber-800">${escape(syncError(feed.errorCode))}</p>`:''}<dl class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm text-stone-600"><dt>Last successful refresh</dt><dd class="text-right">${validTime(feed.succeededAt)?observedTime(feed.succeededAt):'Not yet'}</dd><dt>Last attempt</dt><dd class="text-right">${validTime(feed.attemptedAt)?observedTime(feed.attemptedAt):'Not yet'}</dd>${feed.key === 'sessions' && validTime(data.sources.cloudCapturedAt)?`<dt>Snapshot captured</dt><dd class="text-right">${observedTime(data.sources.cloudCapturedAt)}</dd>`:''}</dl>${schedule}</section>`;
    }).join('');
    const daemon = {detected:'Detected',absent:'Not detected',unknown:'Status unavailable'}[data.sources.workerState] || 'Status unavailable';
    const retryMessage = saved ? (connected ? 'Wait for a fresh laptop observation before retrying.' : 'Reconnect to the laptop to request a refresh.') : (syncRetryMessage || 'Refreshes the GitHub feeds; local branches and files stay unchanged.');
    html('detail',`<header class="${ui.detailHeader}"><button data-back class="${ui.back}">${backLabel()}</button><span class="text-xs text-stone-500">Laptop</span></header><div id="detail-connection"></div><article class="px-4 pt-5 pb-10"><h2 tabindex="-1" class="text-xl font-semibold text-stone-800">Connection status</h2><p class="mt-2 text-sm leading-5 text-stone-500">Laptop access, the errand daemon and GitHub feeds are checked separately.</p><a data-worker-status="gemini" href="#view=now&amp;session=worker%3Agemini" class="mt-4 flex min-h-11 items-center justify-between gap-3 border-b border-stone-100 py-2 text-sm text-blue-800 ${focusStyle}"><span>Gemini errand daemon</span><span>${daemon}${saved?' · Saved':''} ›</span></a>${cards || '<p class="py-4 text-sm text-stone-500">Feed status is not available in this snapshot.</p>'}<div class="mt-5"><button data-sync-retry class="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50 ${focusStyle}" ${saved || busy || cooldown || !feeds.length?'disabled':''}>${busy?'Refreshing…':cooldown?'Retry in '+cooldown+'s':'Retry sync'}</button><p role="status" aria-live="polite" class="mt-2 text-sm text-stone-600">${escape(retryMessage)}</p></div></article>`);
    if (headingFocused) el('detail').querySelector('h2')?.focus({preventScroll:true});
    else if (focusAttribute) {
      const target = [...el('detail').querySelectorAll('['+focusAttribute+']')].find(node => node.getAttribute(focusAttribute) === focusValue);
      (target?.disabled ? el('detail').querySelector('h2') : target)?.focus({preventScroll:true});
    }
    updateTimes();
    if (window.scrollX !== viewport.left || window.scrollY !== viewport.top) window.scrollTo(viewport.left,viewport.top);
  }

  async function retrySync() {
    if (!data || savedObservation() || syncRetryPending || Date.now() < syncRetryUntil) return;
    syncRetryPending = true; syncRetryMessage = 'Requesting a refresh…'; syncDetail();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),6000);
    try {
      const response = await fetch('/api/v1/sync/retry',{method:'POST',headers:{'X-WebTools-Action':'1'},cache:'no-store',signal:controller.signal});
      const result = await response.json().catch(() => ({}));
      const delay = Number(result.retryAfterSeconds);
      if ([202,409,429].includes(response.status)) {
        syncRetryUntil = Date.now() + (Number.isFinite(delay) && delay > 0 ? Math.min(delay,300) : 15)*1000;
        syncRetryMessage = response.status === 202 ? 'Refresh requested. Status updates automatically.' : response.status === 409 ? 'A refresh is already in progress.' : 'Please wait briefly before retrying.';
      } else syncRetryMessage = response.status === 403 ? 'Reconnect through your Tailscale account to retry.' : 'The refresh could not be requested. Try again shortly.';
    } catch { syncRetryMessage = 'The laptop could not be reached. Reconnect and try again.'; }
    finally { clearTimeout(timeout); syncRetryPending = false; if (selected() === 'status:sync') { syncDetail(); connection(); } }
    window.NowPhone?.refresh();
  }

  function workerDetail() {
    if (!data) return;
    const viewport = {left:window.scrollX,top:window.scrollY}, focused = document.activeElement;
    const headingFocused = focused === el('detail').querySelector('h2');
    const focusAttribute = el('detail').contains(focused) && ['data-back','data-pick','data-status','data-launch','data-session-tokens','data-topic-context'].find(attribute => focused.hasAttribute(attribute));
    const focusValue = focusAttribute && focused.getAttribute(focusAttribute);
    const source = data.sources;
    const reports = source.workerReports?.length ? source.workerReports : source.workerActivity ? [source.workerActivity] : [];
    const jobs = data.items.filter(i => i.kind === 'errand' && keyFor(i.provider) === 'gemini' && ['queued','claimed','reply'].includes(i.state));
    const queued = jobs.filter(i => i.state === 'queued').sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const accepted = jobs.filter(i => i.state !== 'queued');
    const savedQueue = savedObservation() || !source.recordsConnected;
    const status = source.workerState === 'detected' ? 'Detected' : source.workerState === 'absent' ? 'Not detected' : 'Status unavailable';
    const saved = savedObservation(), now = Date.now();
    const session = data.items.filter(i => ['session','cloud'].includes(i.kind) && keyFor(i.provider) === 'gemini'
      && Number.isFinite(Date.parse(i.at)) && Date.parse(i.at) <= now && now-Date.parse(i.at) < 86400000)
      .sort((a,b) => Date.parse(b.at)-Date.parse(a.at))[0];
    const observations = `<dl class="mt-3 space-y-3 text-sm"><div data-daemon-observation><dt class="text-xs text-stone-500">Errand daemon${saved?' · Saved observation':''}</dt><dd class="mt-0.5 font-medium ${source.workerState === 'absent'?'text-amber-800':'text-stone-700'}">${status}</dd>${Number.isFinite(Date.parse(data.observedAt))?`<dd class="mt-0.5 text-xs text-stone-500">Observed ${observedTime(data.observedAt)}</dd>`:''}</div><div data-gemini-observation><dt class="text-xs text-stone-500">Gemini sessions${saved?' · Saved observation':''}</dt><dd class="mt-0.5 text-stone-700">${session?`Session update observed ${observedTime(session.at)}`:'No session update in the past day in this snapshot'}</dd></div><div><dt class="text-xs text-stone-500">Gemini connection</dt><dd class="mt-0.5 text-stone-700">Not checked</dd></div></dl>`;
    const reportRows = (reports.length ? `<ol class="px-4">${reports.map(r => { const job = r.itemId && data.items.find(i => i.kind === 'errand' && i.id === r.itemId); return `<li class="border-b border-stone-100 py-3"><p class="text-xs text-stone-500">${escape(stamp(r.at))}</p><p class="mt-0.5 text-[13px] leading-5">${escape(r.headline)}</p>${job ? `<button data-pick="${escape(job.key)}" class="min-h-11 text-left text-sm text-blue-800">${escape(job.title)} ›</button>` : ''}</li>`; }).join('')}</ol>` : '<p class="px-4 py-3 text-stone-500">No reports available</p>');
    html('detail', `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">${backLabel()}</button><span class="text-xs text-stone-500">Laptop</span></header><div id="detail-connection"></div><article class="pt-5 pb-10"><div class="px-4"><div class="flex items-center gap-2 text-blue-700">${mark('Gemini')}<h2 tabindex="-1" class="text-xl font-semibold">Gemini errand daemon</h2></div>${observations}${reports[0] ? `<p class="mt-2 text-xs text-stone-500">Last report ${observedTime(reports[0].at)} · ${escape(reports[0].headline)}</p>` : ''}<div class="mt-4 flex gap-3 text-sm"><span class="rounded bg-amber-50 px-3 py-2">${source.queueAvailable ? queued.length + ' waiting' : 'Queue unavailable'}</span><span class="rounded bg-blue-50 px-3 py-2">${accepted.length} accepted</span></div>${savedQueue ? '<p class="mt-2 text-xs text-amber-800">Saved queue</p>' : ''}</div>${group('Waiting', queued, source.queueAvailable ? 'Queue clear' : 'Queue unavailable', true, false)}${accepted.length ? group('Accepted by daemon',accepted,'',false,false) : ''}<section><h3 class="px-3 pt-2 pb-1 text-xs font-semibold text-stone-600">Recent reports</h3>${reportRows}</section><p class="px-4 pt-5 text-xs leading-5 text-stone-500">Session updates do not verify the daemon’s Gemini connection. Reports show the daemon’s last recorded tasks; process detection or acceptance does not confirm a running task.</p></article>`);
    if (headingFocused) el('detail').querySelector('h2')?.focus({preventScroll:true});
    else if (focusAttribute) [...el('detail').querySelectorAll('['+focusAttribute+']')].find(node => node.getAttribute(focusAttribute) === focusValue)?.focus({preventScroll:true});
    if (window.scrollX !== viewport.left || window.scrollY !== viewport.top) window.scrollTo(viewport.left,viewport.top);
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
    const syncLink = event.target.closest('[data-sync-status]');
    if (syncLink && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); openSession('status:sync'); return;
    }
    const notice = event.target.closest('[data-queue-notice],[data-worker-status]');
    if (notice && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      if (notice.dataset.workerStatus) { event.preventDefault();openSession('worker:gemini');return; }
      if (window.NowViews?.setView) {
        event.preventDefault();closeLaunch();window.NowPhoneInfo?.close({restoreFocus:false});
        const route = notice.getAttribute('href');
        if (location.hash !== route) history.pushState(null,'',route);
        window.NowViews.setView('errands',false);
        (el('panel-errands').querySelector('[data-er-tab="waiting"]') || el('view-picker'))?.focus({preventScroll:true});
        return;
      }
    }
    const button = event.target.closest('button');
    if (button?.hasAttribute('data-sync-retry')) { event.preventDefault(); retrySync(); return; }
    if (!button) { if(event.target.closest('#phone-session-menu a')){closeLaunch();return;} if(!event.target.closest('#phone-session-menu'))closeLaunch();const card=event.target.closest('#content [data-item]');if(card&&!event.target.closest('a,input,select,textarea,[data-title-tip]'))openSession(card.dataset.item);return; }
    if(button.dataset.providerMenu){openLaunch('provider:'+button.dataset.providerMenu);return;}
    if(button.dataset.launch){openLaunch(button.dataset.launch);return;}
    if(button.dataset.sessionStep){stepSession(Number(button.dataset.sessionStep));return;}
    if(button.dataset.topicContext){showTopicContext(button.dataset.topicContext,button);return;}
    if(button.dataset.relatedSession){openRelated(button.dataset.relatedSession);return;}
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
    if(button.dataset.sessionTokens){showTokens(button.dataset.sessionTokens,button);return;}
    if (button.dataset.assistant) { closeLaunch();assistant = assistant === button.dataset.assistant ? '' : button.dataset.assistant; render();return; }
    if (button.dataset.pick) { openSession(button.dataset.pick);return; }
    if (button.hasAttribute('data-back')) {
      closeLaunch();window.NowPhoneInfo?.close({restoreFocus:false});
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
  const finishViewReturn=()=>{
    if(window.NowViews?.active()&&!selected()&&detailTrail){detailTrail=null;el('view-picker')?.focus({preventScroll:true});}
  };
  const routeChanged=()=>{
    closeLaunch();window.NowPhoneInfo?.close({restoreFocus:false});
    if(window.NowViews?.active()){
      finishViewReturn();
      return;
    }
    if(selected()){if(history.state?.nowSessionTrail)assistant=currentTrail().filter||'';render();detail();connection();window.scrollTo(0,0);}
    else if(detailTrail)restoreNow();
    else{render();connection();}
  };
  window.addEventListener('popstate',routeChanged);
  window.addEventListener('hashchange',routeChanged);
  window.addEventListener('nowviewchange', () => {closeLaunch();window.NowPhoneInfo?.close({restoreFocus:false});finishViewReturn();if (!window.NowViews?.active() || window.NowViews.current?.() === 'usage') { render(); connection(); } });
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
