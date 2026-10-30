(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  const badge = state => `<span class="rounded px-1.5 py-0.5 text-[10px] ${tones[state] || 'bg-stone-100 text-stone-600'}">${escape(labels[state] || state)}</span>`;
  const age = at => { const seconds = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : new Date(at).toLocaleDateString(); };
  const observedTime = at => `<time data-at="${escape(at)}" datetime="${escape(at)}" title="${escape(stamp(at))}">${escape(stamp(at))}</time>`;
  const stamp = at => at ? new Date(at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not yet';
  const safeUrl = value => { try { const url = new URL(value); return url.origin === 'https://mehrlander.github.io' && !url.username && !url.password && !url.port && url.pathname.startsWith('/web-tools/') ? url.href : ''; } catch { return ''; } };
  let data, tab = 'now', assistant = '', timer, etag = '', failures = 0, pending = false, connected = false, accessDenied = false, savedScroll = 0;
  const expanded = new Set();
  const selectedDetails = new Map();
  const panelScrolls = new Map();
  const replies = new Map();
  const filtered = () => (data?.items || []).filter(i => !assistant || keyFor(i.provider) === assistant);
  const active = i => ['working','quiet','claimed','reply'].includes(i.state);
  const finished = i => ['complete','failed','interrupted'].includes(i.state) || i.state === 'idle' && /codex/i.test(i.provider) || i.kind === 'cloud' && i.turn && i.state === 'idle' || i.kind === 'cloud' && /recorded: (done|merged|closed|clean exit)/i.test(i.detail);
  const recordedChange = change => ({...change,kind:'change',state:'recorded'});
  const selected = () => { try { return new URLSearchParams(location.hash.slice(1)).get('item') || ''; } catch { return ''; } };

  function connection() {
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
  const fullIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';
  const externalIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
  function row(item, position, inline = true) {
    const key = escape(item.key), summary = replyPreview(statusText(item)), url = safeUrl(item.url);
    const destination = item.kind === 'errand' ? ['reply','complete','failed'].includes(item.state) ? 'result' : 'errand' : 'session';
    const external = inline && url ? `<a data-external="${key}" href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${destination} in Web Tools: ${escape(item.title)}" title="Open ${destination} in Web Tools" class="absolute right-1 top-1 flex size-11 items-center justify-center rounded text-emerald-900 active:bg-stone-100">${externalIcon}</a>` : '';
    return `<article data-item="${key}" class="min-w-0 border-b border-stone-100 bg-white"><div class="relative"><button ${inline ? `data-inspect="${key}" aria-expanded="false" aria-controls="inline-${encodeURIComponent(item.key)}"` : `data-pick="${key}"`} class="block min-h-11 w-full px-3 py-2 text-left active:bg-stone-50"><span class="flex items-start gap-2">${position ? `<span class="w-5 shrink-0 pt-1 text-sm text-amber-700">${position}.</span>` : `<span class="pt-0.5 ${colours[keyFor(item.provider)]}">${mark(item.provider)}</span>`}<span class="min-w-0 flex-1"><span class="flex items-start gap-1 ${external ? 'pr-9' : ''}"><span class="line-clamp-2 min-w-0 flex-1 text-pretty text-[14px] font-medium leading-5">${escape(itemTitle(item))}</span>${inline ? '' : `<span class="shrink-0 pt-0.5 text-stone-400">${fullIcon}</span>`}</span><span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-stone-500">${badge(item.state)}<span>${escape(item.provider)}</span>${locationMark(item.location)}${item.work?.agents ? `<span>${item.work.agents} agents</span>` : ''}${observedTime(item.at)}</span>${summary ? `<span data-summary class="mt-1 line-clamp-2 text-pretty text-[13px] leading-[19px] text-stone-600">${escape(summary.slice(0,180))}</span>` : ''}</span></span></button>${external}</div>${inline ? `<div id="inline-${encodeURIComponent(item.key)}" data-inline="${key}" hidden></div>` : ''}</article>`;
  }

  function group(title, items, empty = '', numbered = false, inline = true) {
    return `<section><h2 class="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold text-stone-600"><span>${escape(title)}</span>${items.length ? `<span class="font-normal">${items.length}</span>` : ''}</h2>${items.length ? items.map((i,n) => row(i, numbered ? n + 1 : 0, inline)).join('') : `<p class="px-3 py-2 text-[13px] text-stone-500">${escape(empty)}</p>`}</section>`;
  }

  function changeItems() {
    const delegated = new Set(data.items.flatMap(i => (i.work?.members || []).map(id => `session:${i.provider}:${id}`)));
    return (data.changes || []).filter(c => !delegated.has(c.key) && (!assistant || keyFor(c.provider) === assistant)).map(c => {
      const item = data.items.find(i => i.key === c.key);
      return item || recordedChange(c);
    });
  }
  function changesSection(limit, exclude = new Set(), title = 'Recent activity') {
    const items = changeItems().filter(i => !exclude.has(i.key));
    return `<section aria-label="${title}"><h2 class="px-3 pt-2 pb-1 text-xs font-semibold text-stone-600">${title} <span class="font-normal">${items.length || ''}</span></h2>${items.length ? items.slice(0,limit).map(i => row(i)).join('') : '<p class="px-3 py-2 text-[13px] text-stone-500">No recent activity.</p>'}${items.length > limit ? '<button data-tab="recent" class="min-h-11 px-4 text-sm text-emerald-900">All recent →</button>' : ''}</section>`;
  }
  function workerReport(recentOnly = false) {
    const report = data.sources.workerActivity;
    if (!report || assistant && assistant !== 'gemini' || recentOnly && (data.sources.workerState !== 'detected' || Date.now() - Date.parse(report.at) > 900000)) return '';
    const job = report.itemId && data.items.find(i => i.kind === 'errand' && i.id === report.itemId);
    return `<button data-pick="worker:gemini" aria-label="Gemini worker details" class="mx-3 mt-2 block w-[calc(100%-1.5rem)] rounded-lg border-l-4 border-blue-400 bg-blue-50 px-2 py-2 text-left active:bg-blue-100"><span class="float-right text-xl text-blue-600" aria-hidden="true">›</span><p class="text-xs font-medium text-blue-900">Gemini worker · Last reported task</p><p class="mt-0.5 text-[13px] leading-5">${escape(report.headline)}</p>${job ? `<p class="mt-1 text-sm text-stone-600">${escape(job.title)}</p>` : ''}<p class="mt-1 text-xs text-stone-500">Reported ${observedTime(report.at)}</p></button>`;
  }

  function render() {
    if (!data) { connection(); return; }
    // Rebuilding open panels can temporarily shorten the document and clamp its scroll position.
    const viewport = {left:window.scrollX,top:window.scrollY};
    rememberPanelScroll();
    const focus = ['content','assistants'].some(id => el(id).contains(document.activeElement)) ? document.activeElement : null;
    const focusAction = focus && ['inspect','pick','facet','external','assistant','providerLink'].find(key => focus.dataset[key]);
    const focusKey = focusAction && focus.dataset[focusAction];
    const focusOwner = focus?.dataset.for;
    el('machine').textContent = data.machineName;
    const waiting = data.items.filter(i => i.state === 'queued');
    el('queue-count').textContent = data.sources.queueAvailable ? waiting.length : '?';
    html('assistants', ['codex','gemini','claude'].map(key => {
      const items = data.items.filter(i => keyFor(i.provider) === key);
      const working = items.filter(i => i.state === 'working').length;
      const queued = key === 'gemini' ? waiting.length : 0;
      const needs = items.filter(i => i.needsAttention).length;
      const state = working ? `${working} working` : needs ? `${needs} need you` : queued ? `${queued} waiting` : items.some(i => i.state === 'quiet') ? 'Quiet' : items.some(i => i.kind === 'cloud') ? 'Recorded' : items.length ? 'Recent' : 'No activity';
      const usage = window.NowUsage?.compact(data.usage?.find(p => p.provider === key)) || '';
      return `<div class="relative min-w-0"><button data-assistant="${key}" aria-pressed="${assistant === key}" class="block min-h-11 w-full min-w-0 border-b-2 px-2 py-1 ${assistant === key ? 'border-stone-700 bg-white' : 'border-transparent'}"><span class="flex items-center justify-center gap-1 pr-5 text-xs font-medium ${colours[key]}">${mark(key)}${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]}</span><span class="mt-0.5 block text-[10px] text-stone-500">${state}</span><span class="mx-auto mt-1 block min-h-6 max-w-28">${usage}</span></button>${window.NowView.assistantLink(key,{cls:'absolute right-0 top-0'})}</div>`;
    }).join(''));
    document.querySelectorAll('[data-tab]').forEach(button => {
      const current = button.dataset.tab === tab;
      button.setAttribute('aria-pressed', String(current));
      button.classList.toggle('bg-stone-800', current); button.classList.toggle('text-white', current);
    });
    const items = filtered();
    const notices = [...data.sources.notices];
    if (waiting.length && data.sources.workerState === 'absent') notices.unshift('Gemini errands are waiting. Worker not detected.');
    html('notice', notices.map(escape).join('<br>'));
    if (tab === 'usage') {
      html('content', window.NowUsage?.render(data.usage || [], {provider:assistant}) || 'Usage unavailable');
    } else if (tab === 'queue') {
      const queued = items.filter(i => i.state === 'queued').sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      html('content', workerReport() + `<div class="flex items-center justify-between gap-2 px-4 pt-4 text-xs text-stone-500"><span>Gemini worker · ${data.sources.workerState === 'detected' ? 'Detected' : data.sources.workerState === 'absent' ? 'Not detected' : 'Status unavailable'}</span><span>${data.sources.recordsConnected ? '' : 'Saved queue'}</span></div>` + group('Waiting', queued, !data.sources.queueAvailable ? 'Queue unavailable' : assistant && assistant !== 'gemini' ? 'Gemini queue hidden by assistant filter' : 'Queue clear', true) + (items.some(i => ['claimed','reply'].includes(i.state)) ? group('Accepted by worker', items.filter(i => ['claimed','reply'].includes(i.state))) : ''));
    } else if (tab === 'recent') {
      html('content', changesSection(150) + group('Recent results and sessions', items.filter(i => !changeItems().some(c => c.key === i.key) && !['queued','claimed','working','quiet','reply'].includes(i.state)).slice(0,40), 'No recent results') + (data.events.length ? `<section><h2 class="px-3 pt-2 pb-1 text-xs font-semibold text-stone-600">Observed activity</h2>${data.events.filter(e => !assistant || keyFor(e.provider) === assistant).slice(0,15).map(e => `<div class="border-b border-stone-200 px-4 py-3"><div class="flex items-center gap-2 text-xs text-stone-500">${mark(e.provider,'size-4')}<span>${escape(e.provider)} · ${escape(age(e.at))}</span></div><p class="mt-0.5 text-[13px] leading-5">${escape(e.detail || labels[e.state] || e.state)}</p><p class="mt-1 truncate text-xs text-stone-500">${escape(e.title)}</p></div>`).join('')}</section>` : ''));
    } else {
      const current = items.filter(active);
      const needs = items.filter(i => i.needsAttention && !active(i));
      const shown = new Set([...current,...needs].map(i => i.key));
      const changed = new Set(changeItems().map(i => i.key));
      const remaining = items.filter(i => !shown.has(i.key) && !changed.has(i.key));
      html('content', group('In progress', current, 'No current work observed') + workerReport(true) + changesSection(3, shown, 'Other recent') + (needs.length ? group('Needs you', needs) : '') + (remaining.some(finished) ? group('Recently finished', remaining.filter(finished).slice(0,4)) : '') + (!current.length && !needs.length && remaining.some(i => i.kind === 'cloud' && !finished(i)) ? group('Latest cloud records', remaining.filter(i => i.kind === 'cloud' && !finished(i)).slice(0,3)) : ''));
    }
    html('source-times', tab === 'usage' ? '' : `Errands synced ${escape(stamp(data.sources.recordsSyncedAt))}<br>Cloud records captured ${escape(stamp(data.sources.cloudCapturedAt))}`);
    renderPanels(); detail(); connection();
    if (focusAction && !focus.isConnected) [...document.querySelectorAll('#content button,#content a,#assistants button,#assistants a')].find(n => n.dataset[focusAction] === focusKey && n.dataset.for === focusOwner)?.focus({preventScroll:true});
    document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = age(node.dataset.at); });
    if (window.scrollX !== viewport.left || window.scrollY !== viewport.top) window.scrollTo(viewport.left,viewport.top);
  }

  const findItem = key => data?.items.find(i => i.key === key) || data?.changes?.filter(c => c.key === key).map(recordedChange)[0];
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
  function inlineBody(item) {
    const parts = detailParts(item,true), key = item.key, id = 'detail-' + encodeURIComponent(key);
    let choice = selectedDetails.get(key);
    if (!parts.some(p => p.id === choice)) choice = parts[0]?.id || '';
    selectedDetails.set(key,choice);
    const part = parts.find(p => p.id === choice);
    const tabId = p => id + '-' + p.id;
    const controls = parts.map(p => `<button id="${tabId(p)}" role="tab" data-facet="${p.id}" data-for="${escape(key)}" aria-label="${p.title}" title="${p.title}" aria-selected="${p.id === choice}" tabindex="${p.id === choice ? 0 : -1}" aria-controls="${id}" class="inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap ${p.id === choice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 active:bg-white/60'}"><span>${p.label}</span></button>`).join('');
    return `<div class="pl-10 pr-3 pb-2">${controls ? `<div role="tablist" aria-label="Detail sections" class="mb-1 flex items-center gap-0.5 rounded-full bg-stone-200/80 p-0.5">${controls}</div>` : '<p class="py-2 text-xs text-stone-500">No additional detail captured.</p>'}<div id="${id}" role="tabpanel" ${part ? `aria-labelledby="${tabId(part)}"` : 'aria-label="Detail" hidden'}><div data-panel-scroll="${escape(key + ':' + choice)}" class="max-h-[40dvh] min-w-0 overflow-y-auto overscroll-contain pt-1 pb-1 text-[13px] leading-5 text-stone-700 [overflow-wrap:anywhere]">${part?.body || ''}</div></div></div>`;
  }
  function itemBody(item) {
    const url = safeUrl(item.url);
    return `<div class="mt-4 space-y-5 text-[13px] leading-5 text-stone-700 [overflow-wrap:anywhere]">${detailParts(item,false).map(p => `<section aria-label="${p.title}"><h3 class="mb-2 text-xs font-semibold text-stone-500">${p.title}</h3>${p.body}</section>`).join('')}</div>${url ? `<a class="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-emerald-800 underline underline-offset-2" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Open in Web Tools ↗</a>` : ''}`;
  }

  function rememberPanelScroll() {
    if (!el('overview').hidden) document.querySelectorAll('[data-panel-scroll]').forEach(n => panelScrolls.set(n.dataset.panelScroll,n.scrollTop));
  }
  function renderPanels() {
    document.querySelectorAll('#content [data-inline]').forEach(panel => {
      const key = panel.dataset.inline, open = expanded.has(key);
      panel.hidden = !open;
      const trigger = panel.closest('[data-item]').querySelector('[data-inspect]');
      trigger?.setAttribute('aria-expanded', String(open));
      if (!open) { trigger?.querySelector('[data-summary]')?.classList.remove('hidden'); return; }
      const item = findItem(key);
      if (!item) return;
      const focusedFacet = panel.contains(document.activeElement) ? document.activeElement.dataset.facet : '';
      const value = inlineBody(item);
      trigger?.querySelector('[data-summary]')?.classList.toggle('hidden', !!selectedDetails.get(key));
      if (rendered.get(panel) !== value) { panel.innerHTML = value; rendered.set(panel,value); }
      const scroller = panel.querySelector('[data-panel-scroll]');
      if (scroller && panelScrolls.has(scroller.dataset.panelScroll)) scroller.scrollTop = panelScrolls.get(scroller.dataset.panelScroll);
      if (focusedFacet) [...panel.querySelectorAll('[data-facet]')].find(n => n.dataset.facet === focusedFacet)?.focus({preventScroll:true});
      if (item.kind === 'errand' && ['reply','complete','failed'].includes(item.state) && !replies.has(item.id)) loadReply(item);
    });
    document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = age(node.dataset.at); });
  }

  function detail() {
    const key = selected(), item = findItem(key);
    el('overview').hidden = !!key; el('detail').hidden = !key;
    if (!key) return;
    if (key === 'worker:gemini') { workerDetail(); return; }
    if (!item) {
      html('detail','<header class="sticky top-0 border-b border-stone-200 bg-white p-3"><button data-back class="min-h-11 px-2 text-base">← Now</button></header><div id="detail-connection"></div><p class="p-4 text-base">Activity is no longer in the current snapshot.</p>');
      return;
    }
    const value = `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">← Now</button>${locationMark(item.location)}</header><div id="detail-connection"></div><article class="px-4 pt-5 pb-10"><div class="flex items-center gap-2 ${colours[keyFor(item.provider)]}">${mark(item.provider)}<span class="text-sm">${escape(item.provider)}</span></div><h2 class="mt-3 break-words text-balance text-xl font-semibold leading-7">${escape(item.title)}</h2><div class="mt-3 flex flex-wrap items-center gap-3">${badge(item.state)}<span class="text-xs text-stone-500">${escape(stamp(item.at))}</span></div>${itemBody(item)}</article>`;
    html('detail', value);
    if (item.kind === 'errand' && ['reply','complete','failed'].includes(item.state) && !replies.has(item.id)) loadReply(item);
  }

  function workerDetail() {
    if (!data) return;
    const source = data.sources;
    const reports = source.workerReports?.length ? source.workerReports : source.workerActivity ? [source.workerActivity] : [];
    const jobs = data.items.filter(i => i.kind === 'errand' && ['queued','claimed','reply'].includes(i.state));
    const queued = jobs.filter(i => i.state === 'queued').sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const accepted = jobs.filter(i => i.state !== 'queued');
    const status = source.workerState === 'detected' ? 'Process detected' : source.workerState === 'absent' ? 'Process not detected' : 'Process status unavailable';
    const reportRows = (reports.length ? `<ol class="px-4">${reports.map(r => { const job = r.itemId && data.items.find(i => i.kind === 'errand' && i.id === r.itemId); return `<li class="border-b border-stone-100 py-3"><p class="text-xs text-stone-500">${escape(stamp(r.at))}</p><p class="mt-0.5 text-[13px] leading-5">${escape(r.headline)}</p>${job ? `<button data-pick="${escape(job.key)}" class="min-h-11 text-left text-sm text-blue-800">${escape(job.title)} ›</button>` : ''}</li>`; }).join('')}</ol>` : '<p class="px-4 py-3 text-stone-500">No reports available</p>');
    html('detail', `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">← Now</button><span class="text-xs text-stone-500">Laptop</span></header><div id="detail-connection"></div><article class="pt-5 pb-10"><div class="px-4"><div class="flex items-center gap-2 text-blue-700">${mark('Gemini')}<h2 class="text-xl font-semibold">Gemini worker</h2></div><p class="mt-3 text-sm text-stone-600">${status}${source.recordsConnected ? '' : ' · Saved queue'}</p><div class="mt-4 flex gap-3 text-sm"><span class="rounded bg-amber-50 px-3 py-2">${source.queueAvailable ? queued.length + ' waiting' : 'Queue unavailable'}</span><span class="rounded bg-blue-50 px-3 py-2">${accepted.length} accepted</span></div></div><section><h3 class="px-3 pt-2 pb-1 text-xs font-semibold text-stone-600">Recent reports</h3>${reportRows}</section>${group('Waiting', queued, source.queueAvailable ? 'Queue clear' : 'Queue unavailable', true, false)}${accepted.length ? group('Accepted by worker',accepted,'',false,false) : ''}<p class="px-4 pt-5 text-xs leading-5 text-stone-500">Reports show the worker’s last recorded tasks. A detected process or accepted errand does not confirm that a task is still running.</p></article>`);
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
    finally { replyRequests.delete(item.id); if (selected() === item.key) { detail(); connection(); } if (expanded.has(item.key)) render(); }
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
      if (!document.hidden) timer = setTimeout(poll, Math.min(15000, 2000 * 2 ** Math.min(failures,3)));
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.facet) {
      const key = button.dataset.for, facet = button.dataset.facet;
      if (selectedDetails.get(key) === facet) return;
      rememberPanelScroll();
      selectedDetails.set(key,facet);
      renderPanels();
      return;
    }
    if (button.dataset.inspect) {
      rememberPanelScroll();
      const key = button.dataset.inspect;
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      renderPanels();
      return;
    }
    if (button.dataset.tab) { tab = button.dataset.tab; render(); window.scrollTo(0,0); }
    if (button.dataset.assistant) { assistant = assistant === button.dataset.assistant ? '' : button.dataset.assistant; render(); }
    if (button.dataset.pick) { rememberPanelScroll(); savedScroll = window.scrollY; history.pushState({nowDetail:true},'', '#item=' + encodeURIComponent(button.dataset.pick)); detail(); connection(); window.scrollTo(0,0); }
    if (button.hasAttribute('data-back')) {
      if (history.state?.nowDetail) history.back();
      else { history.replaceState(null,'',location.pathname); detail(); window.scrollTo(0,savedScroll); }
    }
  });
  document.addEventListener('keydown', event => {
    const button = event.target.closest('[data-facet]');
    if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const panel = button.closest('[data-inline]'), tabs = [...panel.querySelectorAll('[data-facet]')];
    const index = tabs.indexOf(button), next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const facet = tabs[next].dataset.facet;
    tabs[next].click();
    [...panel.querySelectorAll('[data-facet]')].find(n => n.dataset.facet === facet)?.focus({preventScroll:true});
    event.preventDefault();
  });
  window.addEventListener('popstate', () => { detail(); if (!selected()) renderPanels(); connection(); window.scrollTo(0,savedScroll); });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) poll(); });
  window.addEventListener('online', poll);
  window.addEventListener('offline', () => { connected = false; connection(); });
  try { const cached = JSON.parse(localStorage.getItem('web-tools-now-snapshot')); if (cached?.schemaVersion === 1 && Array.isArray(cached.items)) data = cached; } catch { }
  render(); poll();
})();
