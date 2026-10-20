(() => {
  'use strict';
  let snapshot, filter = 'all', search = '', selected = '', lastJobsRender = '', lastSessionsRender = '';
  let visible = [];
  const bridge = window.chrome?.webview;
  const el = id => document.getElementById(id);
  const html = (id, value) => { if (el(id).innerHTML !== value) el(id).innerHTML = value; };
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {queued:'Queued',claimed:'Claimed',reply:'Reply arriving',complete:'Complete',failed:'Needs review'};
  const tones = {queued:'bg-amber-50 text-amber-800', claimed:'bg-emerald-50 text-emerald-800', reply:'bg-emerald-50 text-emerald-800', complete:'bg-stone-100 text-stone-600', failed:'bg-amber-50 text-amber-800'};
  const send = (action, id = '') => bridge?.postMessage({action, id});
  const actionClass = 'rounded border border-stone-200 bg-white px-3 py-1.5 text-sm text-emerald-900 hover:bg-emerald-50';
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
  const stamp = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Time unavailable'; };
  const badge = job => `<span class="rounded px-1.5 py-0.5 text-xs ${tones[job.state] || tones.complete}">${escape(labels[job.state] || job.state)}</span>`;

  function updateTimes() {
    document.querySelectorAll('time[data-at]').forEach(time => { time.textContent = ago(time.dataset.at); });
  }

  function renderSessions(data) {
    const sessions = data.sessions?.items || [];
    const working = sessions.filter(s => s.state === 'working').length;
    el('session-count').textContent = working ? `${working} working session${working === 1 ? '' : 's'}` : '';
    el('session-notice').textContent = (data.sessions?.notices || []).join(' ');
    const signature = JSON.stringify(sessions);
    if (signature === lastSessionsRender) return;
    lastSessionsRender = signature;
    const states = {working:'Working',quiet:'Quiet',idle:'Idle',interrupted:'Interrupted',recent:'Recent'};
    html('sessions', sessions.length ? sessions.map(s => `<article class="session py-3 first:pt-0 last:pb-0"><div class="flex items-center justify-between gap-2 text-xs"><span class="text-stone-500">${escape(s.provider)}</span><span class="flex items-center gap-1.5 ${s.state === 'working' ? 'text-emerald-800' : 'text-stone-500'}">${s.state === 'working' ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true"></span>' : ''}${escape(states[s.state] || 'Recent')}</span></div><p class="mt-1 break-words text-base leading-6" title="${escape(s.workspace || s.title)}">${escape(s.title)}</p><time class="text-xs text-stone-500" data-at="${escape(s.updatedAt)}">${escape(ago(s.updatedAt))}</time></article>`).join('') : '<p class="text-sm text-stone-500">No recent local sessions</p>');
  }

  function renderDetail() {
    const job = visible.find(j => j.id === selected);
    if (!job) {
      html('detail', '<div class="text-base text-stone-500">No selected errand</div>');
      return;
    }
    const index = visible.indexOf(job), id = escape(job.id);
    html('detail', `<article class="errand-detail"><div class="flex items-start justify-between gap-4"><h3 class="text-balance text-base font-semibold">${escape(job.title)}</h3><div class="flex shrink-0 items-center gap-2 text-xs text-stone-500"><button data-step="-1" aria-label="Previous errand" class="rounded px-2 py-1 hover:bg-stone-200" ${index === 0 ? 'disabled' : ''}>←</button><span>${index + 1}/${visible.length}</span><button data-step="1" aria-label="Next errand" class="rounded px-2 py-1 hover:bg-stone-200" ${index === visible.length - 1 ? 'disabled' : ''}>→</button></div></div><div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">${badge(job)}<time>${escape(stamp(job.updatedAt))}</time>${job.host ? `<span>${escape(job.host)}</span>` : ''}</div><div class="mt-3 flex flex-wrap gap-2"><button class="${actionClass}" data-action="errand" data-id="${id}">Open in Web Tools ↗</button>${job.hasLocalOutput ? `<button class="${actionClass}" data-action="output" data-id="${id}">Open output folder ↗</button>` : ''}</div>${job.note ? `<p class="mt-4 text-pretty text-base leading-7 text-stone-600">${escape(job.note)}</p>` : ''}${job.reply ? `<pre class="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-7">${escape(job.reply.slice(0, 20000))}${job.reply.length > 20000 ? '\n\nOpen in Web Tools to read the full result.' : ''}</pre>` : job.message ? `<p class="mt-4 text-pretty text-base leading-7">${escape(job.message)}</p>` : ''}</article>`);
  }

  function renderJobs() {
    if (!snapshot) return;
    visible = snapshot.activity.errands.filter(j => {
      if (filter === 'open' && !['claimed','reply'].includes(j.state)) return false;
      if (filter === 'queued' && j.state !== 'queued') return false;
      if (filter === 'new' && !j.isNew) return false;
      return !search || `${j.title} ${j.note} ${j.id}`.toLowerCase().includes(search);
    }).slice(0, 40);
    if (!visible.some(j => j.id === selected)) selected = visible[0]?.id || '';
    el('record-note').textContent = `${visible.length} shown / ${snapshot.activity.errands.length} available · ${snapshot.activity.connected ? 'Current records' : 'Saved records'}`;
    document.querySelectorAll('.filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    const signature = JSON.stringify([visible, filter, search, selected]);
    if (signature === lastJobsRender) return;
    lastJobsRender = signature;
    html('errands', visible.length ? visible.map(job => `<article class="errand border-b border-stone-100 px-4 py-3 ${job.id === selected ? 'bg-emerald-50/50' : ''}"><div class="flex items-start justify-between gap-4"><button class="errand-title text-left text-base leading-6 hover:text-emerald-800" data-expand="${escape(job.id)}" aria-pressed="${job.id === selected}">${escape(job.title)}</button><time class="errand-time shrink-0 text-xs text-stone-500" data-at="${escape(job.updatedAt)}">${escape(ago(job.updatedAt))}</time></div><div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">${badge(job)}${job.isNew ? '<span class="text-emerald-800">New</span>' : ''}${job.hasLocalOutput ? '<span>Local output</span>' : job.hasOutput ? '<span>Saved output</span>' : ''}</div></article>`).join('') : `<div class="p-5 text-base text-stone-500">${filter === 'open' ? 'No errands in progress' : filter === 'queued' ? 'No errands in the queue' : filter === 'new' ? 'No new results' : search ? 'No matching errands' : 'No recent errands'}</div>`);
    renderDetail();
  }

  function render(data) {
    snapshot = data;
    const a = data.activity, jobs = a.errands;
    el('machine').textContent = data.machineName;
    el('running').textContent = jobs.filter(j => ['claimed','reply'].includes(j.state)).length;
    el('queued').textContent = jobs.filter(j => j.state === 'queued').length;
    el('new-count').textContent = jobs.filter(j => j.isNew).length;
    el('seen').disabled = !jobs.some(j => j.isNew);
    const notices = [];
    if (a.notice) notices.push(a.notice);
    if (data.daemon.state === 'absent' && jobs.some(j => j.state === 'queued')) notices.push('Errands are queued. The Gemini worker was not detected.');
    html('notice', notices.length ? `<div class="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">${notices.map(escape).join('<br>')}</div>` : '');
    el('worker-state').textContent = {detected:'Detected',absent:'Not detected',unknown:'Unknown'}[data.daemon.state] || 'Unknown';
    el('worker-detail').textContent = data.daemon.detail;
    html('last-log', data.daemon.lastLogAt ? `<time data-at="${escape(data.daemon.lastLogAt)}">${escape(ago(data.daemon.lastLogAt))}</time>` : 'No local log');
    el('connection').textContent = a.connected ? 'Up to date' : 'Saved records';
    html('applications', data.applications.map(app => `<div class="flex items-center justify-between gap-3"><span class="text-base">${escape(app.name)}</span><span class="shrink-0 text-xs ${app.state === 'open' ? 'text-emerald-800' : 'text-stone-500'}">${app.state === 'open' ? 'Open' : 'Not detected'}</span></div>`).join(''));
    html('places', data.places.map(p => `<button class="flex items-center justify-between rounded px-1 py-2 text-left text-base text-emerald-900 hover:bg-emerald-50" data-action="place" data-id="${escape(p.id)}">${escape(p.name)}<span aria-hidden="true">↗</span></button>`).join('') || '<span class="text-sm text-stone-500">Choose a repositories folder in Settings.</span>');
    html('downloads', data.downloads.map(f => `<div class="min-w-0"><div class="break-words text-base">${escape(f.name)}</div><time class="text-xs text-stone-500" data-at="${escape(f.modifiedAt)}">${escape(ago(f.modifiedAt))}</time></div>`).join('') || '<span class="text-sm text-stone-500">No files found</span>');
    renderSessions(data);
    renderJobs();
    updateTimes();
    el('record-note').textContent = `${visible.length} shown / ${jobs.length} available · ${a.connected ? 'Current records' : 'Saved records'}`;
  }

  document.addEventListener('click', event => {
    const pick = event.target.closest('[data-expand]');
    if (pick) { selected = pick.dataset.expand; renderJobs(); return; }
    const step = event.target.closest('[data-step]');
    if (step) { const index = visible.findIndex(j => j.id === selected) + Number(step.dataset.step); if (visible[index]) { selected = visible[index].id; renderJobs(); } return; }
    const f = event.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; renderJobs(); return; }
    const action = event.target.closest('[data-action]');
    if (action) send(action.dataset.action, action.dataset.id);
  });
  el('search').addEventListener('input', event => { search = event.target.value.toLowerCase().trim(); renderJobs(); });
  bridge?.addEventListener('message', event => { if (event.data?.type === 'snapshot') render(event.data.data); });
  window.setInterval(updateTimes, 1000);
  send('ready');
})();
