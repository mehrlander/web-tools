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
  const badge = state => `<span class="rounded px-2 py-0.5 text-xs ${tones[state] || 'bg-stone-100 text-stone-600'}">${escape(labels[state] || state)}</span>`;
  const age = at => { const seconds = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : new Date(at).toLocaleDateString(); };
  const observedTime = at => `<time data-at="${escape(at)}" datetime="${escape(at)}" title="${escape(stamp(at))}">${escape(stamp(at))}</time>`;
  const stamp = at => at ? new Date(at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not yet';
  const safeUrl = value => { try { const url = new URL(value); return url.origin === 'https://mehrlander.github.io' && url.pathname.startsWith('/web-tools/') ? url.href : ''; } catch { return ''; } };
  let data, tab = 'now', assistant = '', timer, etag = '', failures = 0, pending = false, connected = false, accessDenied = false, savedScroll = 0, review;
  let unseen = [];
  const expanded = new Set();
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
    html('connection', `<span class="inline-flex items-center gap-2 ${live ? 'text-emerald-800' : data || failures ? 'text-amber-800' : ''}"><span class="size-1.5 rounded-full ${live ? 'bg-emerald-600' : 'bg-amber-500'}" aria-hidden="true"></span>${escape(text)}</span>`);
    if (selected()) html('detail-connection', live ? '' : `<div class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">${escape(text)}</div>`);
  }

  const statusText = item => item.turn ? item.detail : item.checkpoint?.headline || item.detail;
  const caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const fullIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';
  function row(item, position, inline = true) {
    const key = escape(item.key), summary = statusText(item);
    return `<article data-item="${key}" ${item.changeId ? `data-change="${escape(item.changeId)}"` : ''} class="min-w-0 border-b border-stone-100 bg-white"><div class="relative"><button ${inline ? `data-inspect="${key}" aria-expanded="false" aria-controls="inline-${encodeURIComponent(item.key)}"` : `data-pick="${key}"`} class="block min-h-16 w-full px-4 py-3 text-left active:bg-stone-50"><span class="flex items-start gap-2.5">${position ? `<span class="w-5 shrink-0 pt-1 text-sm text-amber-700">${position}.</span>` : `<span class="pt-0.5 ${colours[keyFor(item.provider)]}">${mark(item.provider)}</span>`}<span class="min-w-0 flex-1"><span class="flex items-start gap-1 ${inline ? 'pr-9' : ''}"><span class="line-clamp-2 min-w-0 flex-1 text-pretty text-base font-medium leading-6">${escape(item.title)}</span><span data-caret class="shrink-0 pt-0.5 text-stone-400">${inline ? caret : fullIcon}</span></span><span class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">${badge(item.state)}<span>${escape(item.provider)} · ${escape(item.location)}</span>${observedTime(item.at)}</span>${summary ? `<span class="mt-1.5 line-clamp-2 text-pretty text-base leading-6 text-stone-600">${escape(summary.slice(0,200))}</span>` : ''}</span></span></button>${inline ? `<button data-pick="${key}" aria-label="Open full view: ${escape(item.title)}" title="Full view" class="absolute right-1 top-1 flex size-11 items-center justify-center rounded text-emerald-900 active:bg-stone-100">${fullIcon}</button>` : ''}</div>${inline ? `<div id="inline-${encodeURIComponent(item.key)}" data-inline="${key}" hidden></div>` : ''}</article>`;
  }

  function group(title, items, empty = '', numbered = false, inline = true) {
    return `<section><h2 class="flex items-center justify-between px-4 pt-5 pb-2 text-sm font-semibold text-stone-600"><span>${escape(title)}</span>${items.length ? `<span class="font-normal">${items.length}</span>` : ''}</h2>${items.length ? items.map((i,n) => row(i, numbered ? n + 1 : 0, inline)).join('') : `<p class="px-4 py-4 text-base text-stone-500">${escape(empty)}</p>`}</section>`;
  }

  function changeItems() {
    return unseen.filter(c => !assistant || keyFor(c.provider) === assistant).map(c => {
      const item = data.items.find(i => i.key === c.key);
      return {...(item || recordedChange(c)),changeId:c.id};
    });
  }
  function changesSection(limit, exclude = new Set(), title = 'Since you last looked') {
    const items = changeItems().filter(i => !exclude.has(i.key));
    return `<section aria-label="${title}"><div class="flex items-center justify-between gap-3 px-4 pt-5 pb-2"><h2 class="text-sm font-semibold text-stone-600">${title} <span class="font-normal">${items.length || ''}</span></h2>${items.length ? '<button data-review class="min-h-11 text-sm text-emerald-900">Mark shown seen</button>' : ''}</div>${items.length ? items.slice(0,limit).map(i => row(i)).join('') : '<p class="px-4 py-3 text-base text-stone-500">You’re caught up.</p>'}${items.length > limit ? '<button data-tab="recent" class="min-h-11 px-4 text-sm text-emerald-900">All recent →</button>' : ''}</section>`;
  }
  function workerReport(recentOnly = false) {
    const report = data.sources.workerActivity;
    if (!report || assistant && assistant !== 'gemini' || recentOnly && (data.sources.workerState !== 'detected' || Date.now() - Date.parse(report.at) > 900000)) return '';
    const job = report.itemId && data.items.find(i => i.kind === 'errand' && i.id === report.itemId);
    return `<button data-pick="worker:gemini" aria-label="Gemini worker details" class="mx-4 mt-4 block w-[calc(100%-2rem)] rounded-lg border-l-4 border-blue-400 bg-blue-50 px-3 py-3 text-left active:bg-blue-100"><span class="float-right text-xl text-blue-600" aria-hidden="true">›</span><p class="text-xs font-medium text-blue-900">Gemini worker · Last reported task</p><p class="mt-1 text-base leading-6">${escape(report.headline)}</p>${job ? `<p class="mt-1 text-sm text-stone-600">${escape(job.title)}</p>` : ''}<p class="mt-1 text-xs text-stone-500">Reported ${observedTime(report.at)}</p></button>`;
  }

  function render() {
    if (!data) { connection(); return; }
    rememberPanelScroll();
    const focus = el('content').contains(document.activeElement) ? document.activeElement : null;
    const focusAction = focus && ['inspect','pick'].find(key => focus.dataset[key]);
    const focusKey = focusAction && focus.dataset[focusAction];
    const visibleTop = el('overview').querySelector('header')?.getBoundingClientRect().bottom || 0;
    const anchor = selected() ? null : [...document.querySelectorAll('#content [data-item]')].find(n => n.getBoundingClientRect().bottom > visibleTop);
    const anchorKey = anchor?.dataset.item, anchorTop = anchor?.getBoundingClientRect().top;
    if (!review || review.key !== `web-tools-now-reviewed:${data.machineName}`) review = new window.NowView.ReviewStore(data.machineName);
    unseen = review.pending(data.changes);
    el('machine').textContent = data.machineName;
    const waiting = data.items.filter(i => i.state === 'queued');
    el('queue-count').textContent = data.sources.queueAvailable ? waiting.length : '?';
    html('assistants', ['codex','gemini','claude'].map(key => {
      const items = data.items.filter(i => keyFor(i.provider) === key);
      const working = items.filter(i => i.state === 'working').length;
      const queued = key === 'gemini' ? waiting.length : 0;
      const needs = items.filter(i => i.needsAttention).length;
      const state = working ? `${working} working` : needs ? `${needs} need you` : queued ? `${queued} waiting` : items.some(i => i.state === 'quiet') ? 'Quiet' : items.some(i => i.kind === 'cloud') ? 'Recorded' : items.length ? 'Recent' : 'No activity';
      return `<button data-assistant="${key}" aria-pressed="${assistant === key}" class="min-h-20 min-w-0 border-b-2 px-2 py-3 ${assistant === key ? 'border-stone-700 bg-white' : 'border-transparent'}"><span class="flex items-center justify-center gap-1.5 text-sm font-medium ${colours[key]}">${mark(key)}${{codex:'Codex',gemini:'Gemini',claude:'Claude'}[key]}</span><span class="mt-1.5 block text-xs text-stone-500">${state}</span></button>`;
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
    if (tab === 'queue') {
      const queued = items.filter(i => i.state === 'queued').sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      html('content', workerReport() + `<div class="flex items-center justify-between gap-2 px-4 pt-4 text-xs text-stone-500"><span>Gemini worker · ${data.sources.workerState === 'detected' ? 'Detected' : data.sources.workerState === 'absent' ? 'Not detected' : 'Status unavailable'}</span><span>${data.sources.recordsConnected ? '' : 'Saved queue'}</span></div>` + group('Waiting', queued, !data.sources.queueAvailable ? 'Queue unavailable' : assistant && assistant !== 'gemini' ? 'Gemini queue hidden by assistant filter' : 'Queue clear', true) + (items.some(i => ['claimed','reply'].includes(i.state)) ? group('Accepted by worker', items.filter(i => ['claimed','reply'].includes(i.state))) : ''));
    } else if (tab === 'recent') {
      html('content', changesSection(150) + group('Recent results and sessions', items.filter(i => !changeItems().some(c => c.key === i.key) && !['queued','claimed','working','quiet','reply'].includes(i.state)).slice(0,40), 'No recent results') + (data.events.length ? `<section><h2 class="px-4 pt-5 pb-2 text-sm font-semibold text-stone-600">Observed activity</h2>${data.events.filter(e => !assistant || keyFor(e.provider) === assistant).slice(0,15).map(e => `<div class="border-b border-stone-200 px-4 py-3"><div class="flex items-center gap-2 text-xs text-stone-500">${mark(e.provider,'size-4')}<span>${escape(e.provider)} · ${escape(age(e.at))}</span></div><p class="mt-1 text-base leading-6">${escape(e.detail || labels[e.state] || e.state)}</p><p class="mt-1 truncate text-xs text-stone-500">${escape(e.title)}</p></div>`).join('')}</section>` : ''));
    } else {
      const current = items.filter(active);
      const needs = items.filter(i => i.needsAttention && !active(i));
      const shown = new Set([...current,...needs].map(i => i.key));
      const changed = new Set(changeItems().map(i => i.key));
      const remaining = items.filter(i => !shown.has(i.key) && !changed.has(i.key));
      html('content', group('In progress', current, 'No current work observed') + workerReport(true) + changesSection(3, shown, 'Other recent') + (needs.length ? group('Needs you', needs) : '') + (remaining.some(finished) ? group('Recently finished', remaining.filter(finished).slice(0,4)) : '') + (!current.length && !needs.length && remaining.some(i => i.kind === 'cloud' && !finished(i)) ? group('Latest cloud records', remaining.filter(i => i.kind === 'cloud' && !finished(i)).slice(0,3)) : ''));
    }
    html('source-times', `Errands synced ${escape(stamp(data.sources.recordsSyncedAt))}<br>Cloud records captured ${escape(stamp(data.sources.cloudCapturedAt))}`);
    renderPanels(); detail(); connection();
    if (anchorKey) {
      const next = [...document.querySelectorAll('#content [data-item]')].find(n => n.dataset.item === anchorKey);
      if (next) { const delta = next.getBoundingClientRect().top - anchorTop; if (Math.abs(delta) > 1) window.scrollTo(0,window.scrollY + delta); }
    }
    if (focusAction && !focus.isConnected) [...el('content').querySelectorAll('button')].find(n => n.dataset[focusAction] === focusKey)?.focus({preventScroll:true});
    document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = age(node.dataset.at); });
  }

  const findItem = key => data?.items.find(i => i.key === key) || data?.changes?.filter(c => c.key === key).map(recordedChange)[0];
  function itemBody(item, inline = false) {
    const url = safeUrl(item.url), reply = replies.get(item.id);
    const events = data.events.filter(e => e.sessionId === item.id && e.provider === item.provider).slice(0,10);
    return `${item.detail && (!inline || item.detail !== statusText(item)) ? `<p class="mt-5 whitespace-pre-wrap break-words text-pretty text-base leading-7">${escape(item.detail)}</p>` : ''}${window.NowView.turn(item.turn,{stamp})}${window.NowView.checkpoint(item.checkpoint,{stamp,link:l => `<a class="inline-flex min-h-11 items-center rounded border border-stone-200 px-3 text-sm text-emerald-900" href="${escape(window.NowView.safeLink(l.url))}" rel="noreferrer">${escape(l.label)} ↗</a>`})}${url ? `<a class="mt-5 inline-flex min-h-11 items-center rounded border border-stone-200 px-3 text-base text-emerald-900" href="${escape(url)}">Open in Web Tools ↗</a>` : ''}${item.kind === 'errand' && ['reply','complete','failed'].includes(item.state) ? `<div data-reply="${escape(item.key)}" class="mt-6 whitespace-pre-wrap break-words text-base leading-7">${reply === undefined ? 'Reading result…' : escape(reply)}</div>` : ''}${events.length ? `<h3 class="mt-6 text-sm font-semibold text-stone-500">Observed activity</h3><ol class="mt-3 space-y-4">${events.map(e => `<li><p class="text-xs text-stone-500">${escape(stamp(e.at))}</p><p class="mt-1 text-base leading-7">${escape(e.detail || labels[e.state])}</p></li>`).join('')}</ol>` : ''}`;
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
      trigger?.querySelector('[data-caret]')?.classList.toggle('rotate-180', open);
      if (!open) return;
      const item = findItem(key);
      if (!item) return;
      const value = `<div class="border-t border-stone-100 bg-stone-50 px-4 py-3"><div data-panel-scroll="${escape(key)}" class="max-h-[60dvh] overflow-y-auto overscroll-contain [&>:first-child]:mt-0 [&>:first-child]:border-0 [&>:first-child]:pt-0">${itemBody(item,true)}</div></div>`;
      if (rendered.get(panel) !== value) { panel.innerHTML = value; rendered.set(panel,value); }
      const scroller = panel.querySelector('[data-panel-scroll]');
      if (panelScrolls.has(key)) scroller.scrollTop = panelScrolls.get(key);
      if (item.kind === 'errand' && ['reply','complete','failed'].includes(item.state) && !replies.has(item.id)) loadReply(item);
    });
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
    const value = `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">← Now</button><span class="text-xs text-stone-500">${escape(item.location)}</span></header><div id="detail-connection"></div><article class="px-4 pt-5 pb-10"><div class="flex items-center gap-2 ${colours[keyFor(item.provider)]}">${mark(item.provider)}<span class="text-sm">${escape(item.provider)}</span></div><h2 class="mt-3 break-words text-balance text-xl font-semibold leading-7">${escape(item.title)}</h2><div class="mt-3 flex flex-wrap items-center gap-3">${badge(item.state)}<span class="text-xs text-stone-500">${escape(stamp(item.at))}</span></div>${itemBody(item)}</article>`;
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
    const reportRows = (reports.length ? `<ol class="px-4">${reports.map(r => { const job = r.itemId && data.items.find(i => i.kind === 'errand' && i.id === r.itemId); return `<li class="border-b border-stone-100 py-3"><p class="text-xs text-stone-500">${escape(stamp(r.at))}</p><p class="mt-1 text-base leading-6">${escape(r.headline)}</p>${job ? `<button data-pick="${escape(job.key)}" class="min-h-11 text-left text-sm text-blue-800">${escape(job.title)} ›</button>` : ''}</li>`; }).join('')}</ol>` : '<p class="px-4 py-3 text-stone-500">No reports available</p>');
    html('detail', `<header class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur"><button data-back class="min-h-11 px-2 text-base text-stone-700">← Now</button><span class="text-xs text-stone-500">Laptop</span></header><div id="detail-connection"></div><article class="pt-5 pb-10"><div class="px-4"><div class="flex items-center gap-2 text-blue-700">${mark('Gemini')}<h2 class="text-xl font-semibold">Gemini worker</h2></div><p class="mt-3 text-sm text-stone-600">${status}${source.recordsConnected ? '' : ' · Saved queue'}</p><div class="mt-4 flex gap-3 text-sm"><span class="rounded bg-amber-50 px-3 py-2">${source.queueAvailable ? queued.length + ' waiting' : 'Queue unavailable'}</span><span class="rounded bg-blue-50 px-3 py-2">${accepted.length} accepted</span></div></div><section><h3 class="px-4 pt-5 pb-2 text-sm font-semibold text-stone-600">Recent reports</h3>${reportRows}</section>${group('Waiting', queued, source.queueAvailable ? 'Queue clear' : 'Queue unavailable', true, false)}${accepted.length ? group('Accepted by worker',accepted,'',false,false) : ''}<p class="px-4 pt-5 text-xs leading-5 text-stone-500">Reports show the worker’s last recorded tasks. A detected process or accepted errand does not confirm that a task is still running.</p></article>`);
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
    } catch { failures++; connected = false; connection(); }
    finally {
      clearTimeout(timeout); pending = false;
      if (!document.hidden) timer = setTimeout(poll, Math.min(15000, 2000 * 2 ** Math.min(failures,3)));
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.inspect) {
      rememberPanelScroll();
      const key = button.dataset.inspect;
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      renderPanels();
      return;
    }
    if (button.hasAttribute('data-review')) {
      const shown = new Set([...document.querySelectorAll('[data-change]')].map(n => n.dataset.change));
      review.mark(unseen.filter(c => shown.has(c.id))); render(); return;
    }
    if (button.dataset.tab) { tab = button.dataset.tab; render(); window.scrollTo(0,0); }
    if (button.dataset.assistant) { assistant = assistant === button.dataset.assistant ? '' : button.dataset.assistant; render(); }
    if (button.dataset.pick) { rememberPanelScroll(); savedScroll = window.scrollY; history.pushState({nowDetail:true},'', '#item=' + encodeURIComponent(button.dataset.pick)); detail(); connection(); window.scrollTo(0,0); }
    if (button.hasAttribute('data-back')) {
      if (history.state?.nowDetail) history.back();
      else { history.replaceState(null,'',location.pathname); detail(); window.scrollTo(0,savedScroll); }
    }
  });
  window.addEventListener('popstate', () => { detail(); if (!selected()) renderPanels(); connection(); window.scrollTo(0,savedScroll); });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) poll(); });
  window.addEventListener('storage', event => { if (review && event.key === review.key) { review.load(); render(); } });
  window.addEventListener('online', poll);
  window.addEventListener('offline', () => { connected = false; connection(); });
  try { const cached = JSON.parse(localStorage.getItem('web-tools-now-snapshot')); if (cached?.schemaVersion === 1 && Array.isArray(cached.items)) data = cached; } catch { }
  render(); poll();
})();
