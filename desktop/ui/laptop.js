(() => {
  'use strict';
  let snapshot, filter = 'all', assistant = 'all', search = '', selected = '', lastFeed = '', lastAssistants = '';
  let entries = [], visible = [];
  const bridge = window.chrome?.webview;
  const el = id => document.getElementById(id);
  const html = (id, value) => { if (el(id).innerHTML !== value) el(id).innerHTML = value; };
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const send = (action, id = '') => bridge?.postMessage({action, id});
  const actionClass = 'rounded border border-stone-200 bg-white px-3 py-1.5 text-sm text-emerald-900 hover:bg-emerald-50';
  const labels = {queued:'Queued',claimed:'Claimed',reply:'Reply arriving',complete:'Complete',failed:'Needs review',working:'Working',quiet:'Quiet',idle:'Idle',interrupted:'Interrupted',recent:'Recent',recorded:'Recorded'};
  const tones = {queued:'bg-amber-100 text-amber-900',claimed:'bg-blue-100 text-blue-900',reply:'bg-emerald-100 text-emerald-900',complete:'bg-emerald-50 text-emerald-800',failed:'bg-rose-100 text-rose-900',working:'bg-emerald-100 text-emerald-900',quiet:'bg-amber-50 text-amber-900',interrupted:'bg-rose-100 text-rose-900',recorded:'bg-violet-50 text-violet-900'};
  const keyFor = provider => /gemini/i.test(provider) ? 'gemini' : /claude/i.test(provider) ? 'claude' : 'codex';
  const recent = at => Date.now() - new Date(at).getTime() < 86400000;
  const badge = state => `<span class="rounded px-1.5 py-0.5 text-xs ${tones[state] || 'bg-stone-100 text-stone-600'}">${escape(labels[state] || state)}</span>`;
  const mark = (key, cls = 'size-6 shrink-0') => window.assistantMark?.svg(key, {cls}) || '';
  function ago(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 2000) return 'Time unavailable';
    const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
  }
  const time = at => `<time data-at="${escape(at)}">${escape(ago(at))}</time>`;
  const stamp = at => new Date(at).toLocaleString();
  const needs = item => item.state === 'failed' && item.isNew || item.state === 'interrupted'
    || item.kind === 'cloud' && /Recorded: (needs you|choice needed)/.test(item.detail);
  const finished = item => item.state === 'complete' || item.detail === 'Turn finished'
    || item.kind === 'cloud' && /Recorded: (done|merged|closed|clean exit)/.test(item.detail);
  const open = item => ['working','quiet','claimed','reply'].includes(item.state);

  function collect(data) {
    const result = data.activity.errands.filter(j => recent(j.updatedAt) || ['queued','claimed','reply'].includes(j.state) || j.isNew)
      .map(j => ({...j, key:`errand:${j.id}`,kind:'errand',provider:'Gemini',location:'Laptop',detail:j.note || '',at:j.updatedAt}));
    const local = new Map((data.sessions?.items || []).map(s => [`${s.provider}:${s.id}`, s]));
    for (const event of data.events || []) {
      const key = `${event.provider}:${event.sessionId}`;
      if (!local.has(key) && recent(event.at)) local.set(key, {id:event.sessionId,provider:event.provider,title:event.title,state:event.state,updatedAt:event.at,detail:event.detail,location:event.location,workspace:''});
    }
    for (const s of local.values()) if (recent(s.updatedAt)) result.push({...s,key:`session:${s.provider}:${s.id}`,kind:'session',location:s.location || 'Laptop',at:s.updatedAt});
    for (const s of data.cloud?.items || []) if (recent(s.updatedAt)) result.push({...s,key:`cloud:${s.id}`,kind:'cloud',location:'Cloud',at:s.updatedAt});
    return result.sort((a,b) => Number(open(b) || needs(b) || b.state === 'queued') - Number(open(a) || needs(a) || a.state === 'queued') || new Date(b.at) - new Date(a.at));
  }

  function renderAssistants() {
    const local = entries.filter(e => e.kind === 'session');
    const cloud = entries.filter(e => e.kind === 'cloud');
    const signature = JSON.stringify([local,cloud,assistant,snapshot.applications,snapshot.sessions?.notices,snapshot.cloud?.notice,snapshot.cloud?.capturedAt,snapshot.activity.errands.filter(j => j.state === 'queued').length]);
    if (signature === lastAssistants) return;
    lastAssistants = signature;
    const styles = {codex:'border-emerald-500 bg-emerald-50/50',gemini:'border-blue-500 bg-blue-50/50',claude:'border-orange-400 bg-orange-50/50'};
    html('assistants', ['codex','gemini','claude'].map(key => {
      const name = {codex:'Codex',gemini:'Gemini',claude:'Claude'}[key];
      const sessions = local.filter(s => keyFor(s.provider) === key);
      const records = cloud.filter(s => keyFor(s.provider) === key);
      const working = sessions.filter(s => s.state === 'working').length;
      const quiet = sessions.filter(s => s.state === 'quiet').length;
      const waiting = key === 'gemini' ? entries.filter(e => e.kind === 'errand' && e.state === 'queued').sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)) : [];
      const display = [...sessions.filter(s => s.state === 'working' || s.state === 'quiet'), ...waiting, ...records, ...sessions.filter(s => s.state !== 'working' && s.state !== 'quiet')].slice(0, 2);
      const unavailable = (snapshot.sessions?.notices || []).find(n => n.toLowerCase().includes(key));
      const cloudLoading = key === 'claude' && !snapshot.cloud?.capturedAt && !snapshot.cloud?.notice;
      const state = working ? `${working} working` : waiting.length ? `${waiting.length} queued` : quiet ? `${quiet} quiet` : records.length ? `${records.length} recorded sessions` : cloudLoading ? 'Reading records…' : unavailable ? 'Status unavailable' : 'No current local work';
      const appOpen = snapshot.applications.some(a => keyFor(a.name) === key && /Codex|Gemini|Claude|Antigravity/i.test(a.name) && a.state === 'open');
      const tip = key === 'claude' ? 'Cloud records are published after responses. Live cloud status is not reported.' : 'Local session events. Unfinished work with no event for three minutes appears quiet.';
      const sourceTip = [unavailable, key === 'claude' ? snapshot.cloud?.notice : '', appOpen ? 'Application process detected.' : '', snapshot.cloud?.capturedAt && key === 'claude' ? `Cloud cache captured ${stamp(snapshot.cloud.capturedAt)}.` : ''].filter(Boolean).join(' ');
      const sourceLabel = key === 'claude' ? cloudLoading ? 'Cloud records loading' : snapshot.cloud?.notice ? 'Saved cloud records' : records.length ? 'Cloud records connected' : 'No recent cloud records' : appOpen ? 'App open on this laptop' : 'Local sessions';
      return `<article class="min-w-0 rounded-lg border-l-4 p-3 ${styles[key]}"><div class="flex items-center justify-between gap-2"><button data-assistant="${key}" aria-pressed="${assistant === key}" class="flex items-center gap-2 rounded text-base font-semibold hover:underline">${mark(key)}${name}</button><span class="text-xs ${working ? 'font-medium text-emerald-800' : 'text-stone-600'}" data-title-tip="${escape(tip)}">${escape(state)}</span></div><div class="mt-2 space-y-2">${display.map(s => `<button class="session block w-full rounded text-left hover:bg-white/70" data-pick="${escape(s.key)}"><span class="flex items-center gap-2 text-xs text-stone-500">${badge(s.state)}<span>${escape(s.provider === 'Gemini worker' ? 'Worker' : s.location)}</span>${time(s.at)}</span><span class="mt-1 block truncate text-base leading-6" data-title-tip="${escape(s.title)}">${escape(s.title)}</span>${s.detail && (s.state === 'working' || s.kind === 'cloud') ? `<span class="mt-0.5 block truncate text-sm text-stone-600" data-title-tip="${escape(s.detail)}">${escape(s.detail)}</span>` : ''}</button>`).join('') || '<p class="py-2 text-base text-stone-500">No recent sessions</p>'}</div><div class="mt-2 text-xs text-stone-500" data-title-tip="${escape(sourceTip)}">${sourceLabel}${key === 'gemini' ? ` · ${snapshot.activity.errands.filter(j => j.state === 'queued').length} queued` : ''}</div></article>`;
    }).join(''));
  }

  function renderDetail() {
    const item = visible.find(e => e.key === selected);
    if (!item) { html('detail', '<p class="text-base text-stone-500">No selected activity</p>'); return; }
    const index = visible.indexOf(item), id = escape(item.id);
    const navigation = `<div class="flex shrink-0 items-center gap-2 text-xs text-stone-500"><button data-step="-1" aria-label="Previous activity" class="rounded px-2 py-1 hover:bg-stone-200" ${index === 0 ? 'disabled' : ''}>←</button><span>${index + 1}/${visible.length}</span><button data-step="1" aria-label="Next activity" class="rounded px-2 py-1 hover:bg-stone-200" ${index === visible.length - 1 ? 'disabled' : ''}>→</button></div>`;
    let content;
    if (item.kind === 'errand') {
      content = `<div class="mt-3 flex flex-wrap gap-2"><button class="${actionClass}" data-action="errand" data-id="${id}">Open in Web Tools ↗</button>${item.hasLocalOutput ? `<button class="${actionClass}" data-action="output" data-id="${id}">Open output folder ↗</button>` : ''}</div>${item.note ? `<p class="mt-4 text-pretty text-base leading-7 text-stone-600">${escape(item.note)}</p>` : ''}${item.reply ? `<pre class="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-7">${escape(item.reply.slice(0,20000))}${item.reply.length > 20000 ? '\n\nOpen in Web Tools to read the full result.' : ''}</pre>` : item.message ? `<p class="mt-4 text-pretty text-base leading-7">${escape(item.message)}</p>` : ''}`;
    } else {
      const trail = (snapshot.events || []).filter(e => e.sessionId === item.id && e.provider === item.provider).slice(0,8);
      content = `<p class="mt-3 text-pretty text-base leading-7">${escape(item.detail || labels[item.state])}</p>${item.kind === 'cloud' ? `<button class="${actionClass} mt-3" data-action="cloud-session" data-id="${id}">Open recorded session ↗</button>` : item.workspace ? `<button class="${actionClass} mt-3" data-action="session-folder" data-id="${id}">Open project folder ↗</button>` : ''}${trail.length > 1 ? `<ol class="mt-4 space-y-3">${trail.map(e => `<li class="flex items-start gap-3"><span class="shrink-0 pt-1 text-xs text-stone-500">${time(e.at)}</span><span class="text-base leading-6">${escape(e.detail || labels[e.state])}</span></li>`).join('')}</ol>` : ''}`;
    }
    html('detail', `<article class="${item.kind === 'errand' ? 'errand-detail' : 'session-detail'}"><div class="flex items-start justify-between gap-4"><h3 class="text-balance text-base font-semibold">${escape(item.title)}</h3>${navigation}</div><div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">${badge(item.state)}<span>${escape(item.provider)}</span><span>${escape(item.location)}</span><time>${escape(stamp(item.at))}</time>${item.host ? `<span>${escape(item.host)}</span>` : ''}</div>${content}</article>`);
  }

  function renderFeed() {
    if (!snapshot) return;
    visible = entries.filter(item => {
      if (assistant !== 'all' && keyFor(item.provider) !== assistant) return false;
      if (filter === 'open' && !open(item)) return false;
      if (filter === 'queued' && item.state !== 'queued') return false;
      if (filter === 'new' && !needs(item)) return false;
      if (filter === 'done' && !finished(item)) return false;
      return !search || `${item.title} ${item.detail} ${item.provider} ${item.id}`.toLowerCase().includes(search);
    }).slice(0,40);
    if (!visible.some(e => e.key === selected)) selected = visible[0]?.key || '';
    document.querySelectorAll('.filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    const signature = JSON.stringify([visible,selected]);
    if (signature !== lastFeed) {
      lastFeed = signature;
      html('errands', visible.length ? visible.map(item => `<article class="activity-row border-b border-stone-100 px-4 py-3 ${item.key === selected ? 'bg-emerald-50/50' : ''}"><div class="flex items-start justify-between gap-4"><button class="activity-title ${item.kind === 'errand' ? 'errand-title' : ''} text-left text-base leading-6 hover:text-emerald-800" data-pick="${escape(item.key)}" aria-pressed="${item.key === selected}">${escape(item.title)}</button><span class="shrink-0 text-xs text-stone-500">${time(item.at)}</span></div><div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">${badge(item.state)}<span>${escape(item.provider)}</span><span>${escape(item.location)}</span>${item.isNew ? '<span class="text-emerald-800">New result</span>' : ''}${item.hasLocalOutput ? '<span>Local output</span>' : ''}${item.kind !== 'errand' && item.detail ? `<span class="min-w-0 truncate">${escape(item.detail)}</span>` : ''}</div></article>`).join('') : `<p class="p-5 text-base text-stone-500">${search ? 'No matching activity' : filter === 'queued' ? 'No errands in the queue' : filter === 'open' ? 'No work in progress' : filter === 'new' ? 'No activity needs your attention' : filter === 'done' ? 'No recent completions' : 'No recent activity'}</p>`);
    }
    renderDetail();
    el('record-note').textContent = `${visible.length} shown · Past 24 hours and open errands${assistant !== 'all' ? ` · ${assistant}` : ''}`;
  }

  function renderQueue() {
    const a = snapshot.activity;
    const queued = a.errands.filter(j => j.state === 'queued').sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    const claimed = a.errands.filter(j => j.state === 'claimed');
    const replies = a.errands.filter(j => j.state === 'reply');
    const available = !!a.revision;
    const worker = snapshot.daemon;
    const detected = worker.state === 'detected';
    html('worker-state', `<span class="flex items-center gap-1.5 ${detected ? 'text-emerald-800' : 'text-amber-800'}" data-title-tip="${escape(worker.detail)}"><span class="size-1.5 rounded-full ${detected ? 'bg-emerald-600' : 'bg-amber-500'}" aria-hidden="true"></span>${detected ? 'Detected' : worker.state === 'absent' ? 'Not detected' : 'Unknown'}</span>`);
    html('queue-summary', available ? `<button data-filter="queued" data-reset-assistant="true" class="rounded px-2 py-1 ${queued.length ? 'bg-amber-100 font-medium text-amber-900' : 'bg-emerald-50 text-emerald-800'}">${queued.length ? `${queued.length} waiting` : '✓ Queue clear'}</button>${claimed.length ? `<span class="rounded bg-blue-50 px-2 py-1 text-blue-900" data-title-tip="Claimed means accepted by the worker. Continued execution is not established by a claim.">${claimed.length} claimed</span>` : ''}${replies.length ? `<span class="rounded bg-emerald-50 px-2 py-1 text-emerald-900">${replies.length} replies arriving</span>` : ''}${!a.connected ? '<span class="text-xs text-amber-800">Saved queue</span>' : ''}` : '<span class="text-amber-800">Queue unavailable</span>');
    html('queue', [...queued.slice(0,5),...claimed.slice(0,2)].map((job,i) => `<button class="block w-full text-left text-base leading-6 hover:text-blue-800" data-queue-pick="errand:${escape(job.id)}"><span class="flex items-start gap-2"><span class="shrink-0 text-sm ${job.state === 'queued' ? 'text-amber-700' : 'text-blue-700'}">${job.state === 'queued' ? `${i + 1}.` : '↗'}</span><span>${escape(job.title)}</span></span><span class="ml-5 mt-1 block text-xs text-stone-500">${job.state === 'queued' ? 'Waiting' : 'Claimed'} · ${time(job.state === 'queued' ? job.createdAt : job.updatedAt)}</span></button>`).join(''));
    html('worker-log', worker.lastLogAt ? `<span data-title-tip="Last local log write. A log write is an activity signal, not a heartbeat.">Log ${time(worker.lastLogAt)}</span>` : 'No local worker log');
  }

  function render(data) {
    snapshot = data;
    entries = collect(data);
    el('machine').textContent = data.machineName;
    const working = entries.filter(e => e.kind === 'session' && e.state === 'working').length;
    el('session-count').textContent = working ? `${working} working session${working === 1 ? '' : 's'}` : '';
    el('running').textContent = entries.filter(open).length;
    el('queued').textContent = data.activity.errands.filter(j => j.state === 'queued').length;
    el('new-count').textContent = entries.filter(needs).length;
    el('seen').disabled = !data.activity.errands.some(j => j.isNew);
    const notices = [data.activity.notice,...(data.sessions?.notices || [])].filter(Boolean);
    if (data.daemon.state === 'absent' && data.activity.errands.some(j => j.state === 'queued')) notices.push('Gemini errands are waiting. The worker was not detected.');
    html('notice', notices.length ? `<div class="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">${notices.map(escape).join('<br>')}</div>` : '');
    renderAssistants();
    renderQueue();
    html('applications', data.applications.filter(a => !/Codex|Gemini|Claude|Antigravity/i.test(a.name)).map(app => `<div class="flex items-center justify-between gap-3" data-title-tip="${escape(app.detail)}"><span class="text-base">${escape(app.name)}</span><span class="shrink-0 text-xs ${app.state === 'open' ? 'text-emerald-800' : 'text-stone-500'}">${app.state === 'open' ? 'Detected' : 'Not detected'}</span></div>`).join(''));
    html('places', data.places.map(p => `<button class="flex items-center justify-between rounded px-1 py-1.5 text-left text-base text-emerald-900 hover:bg-emerald-50" data-action="place" data-id="${escape(p.id)}">${escape(p.name)}<span aria-hidden="true">↗</span></button>`).join(''));
    html('downloads', data.downloads.slice(0,3).map(f => `<div class="min-w-0"><div class="break-words text-base">${escape(f.name)}</div><span class="text-xs text-stone-500">${time(f.modifiedAt)}</span></div>`).join('') || '<p class="text-sm text-stone-500">No recent files</p>');
    renderFeed();
    updateTimes();
  }

  function updateTimes() { document.querySelectorAll('time[data-at]').forEach(node => { node.textContent = ago(node.dataset.at); }); }
  function pick(key, reset = false) {
    if (!entries.some(e => e.key === key)) return;
    if (reset || !visible.some(e => e.key === key)) { filter = 'all'; assistant = 'all'; search = ''; el('search').value = ''; }
    selected = key; renderAssistants(); renderFeed();
  }
  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-assistant]');
    if (choice) { assistant = assistant === choice.dataset.assistant ? 'all' : choice.dataset.assistant; renderAssistants(); renderFeed(); return; }
    const queue = event.target.closest('[data-queue-pick]');
    if (queue) { pick(queue.dataset.queuePick,true); return; }
    const row = event.target.closest('[data-pick]');
    if (row) { pick(row.dataset.pick); return; }
    const step = event.target.closest('[data-step]');
    if (step) { const index = visible.findIndex(e => e.key === selected) + Number(step.dataset.step); if (visible[index]) pick(visible[index].key); return; }
    const f = event.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; if (f.dataset.resetAssistant) assistant = 'all'; renderAssistants(); renderFeed(); return; }
    const action = event.target.closest('[data-action]');
    if (action) send(action.dataset.action,action.dataset.id);
  });
  el('search').addEventListener('input', event => { search = event.target.value.toLowerCase().trim(); renderFeed(); });
  bridge?.addEventListener('message', event => { if (event.data?.type === 'snapshot') render(event.data.data); });
  window.setInterval(updateTimes,1000);
  send('ready');
})();
