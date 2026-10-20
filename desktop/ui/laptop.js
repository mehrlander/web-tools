(() => {
  'use strict';
  let snapshot, filter = 'all', search = '', lastJobsRender = '';
  const expanded = new Set();
  const bridge = window.chrome?.webview;
  const el = id => document.getElementById(id);
  const html = (id, value) => { if (el(id).innerHTML !== value) el(id).innerHTML = value; };
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {queued:'Queued',claimed:'Claimed',reply:'Reply arriving',complete:'Complete',failed:'Needs review'};
  const send = (action, id = '') => bridge?.postMessage({action, id});
  function ago(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 2000) return 'Time unavailable';
    const minutes = Math.max(0, Math.floor((Date.now() - date) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
  }
  const stamp = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Time unavailable'; };
  function renderJobs() {
    if (!snapshot) return;
    // Keep focused controls, selections and accessibility nodes stable between
    // checks when only the observation time or process signals changed.
    const signature = JSON.stringify([snapshot.activity.errands, filter, search, [...expanded]]);
    if (signature === lastJobsRender) return;
    lastJobsRender = signature;
    const jobs = snapshot.activity.errands.filter(j => {
      if (filter === 'open' && !['claimed','reply'].includes(j.state)) return false;
      if (filter === 'queued' && j.state !== 'queued') return false;
      if (filter === 'new' && !j.isNew) return false;
      return !search || `${j.title} ${j.note} ${j.id}`.toLowerCase().includes(search);
    });
    document.querySelectorAll('.filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    el('errands').innerHTML = jobs.length ? jobs.slice(0, 40).map(j => {
      const id = escape(j.id), open = expanded.has(j.id);
      const detail = open ? `<div class="errand-detail"><div class="detail-actions"><button class="text-button" data-action="errand" data-id="${id}">Open in Web Tools ↗</button>${j.hasLocalOutput ? `<button class="text-button" data-action="output" data-id="${id}">Open output folder ↗</button>` : ''}</div><p>${escape(j.note || 'No additional request note.')}</p>${j.message && !j.reply ? `<p>${escape(j.message)}</p>` : ''}${j.reply ? `<pre>${escape(j.reply.slice(0, 20000))}${j.reply.length > 20000 ? '\n\nOpen in Web Tools to read the full reply.' : ''}</pre>` : ''}</div>` : '';
      return `<article class="errand"><div class="errand-top"><span class="state-marker ${escape(j.state)}" aria-hidden="true"></span><div class="errand-content"><button class="errand-title" data-expand="${id}" aria-expanded="${open}">${escape(j.title)}</button><div class="errand-meta"><span class="badge ${escape(j.state)}">${escape(labels[j.state] || j.state)}</span>${j.isNew ? '<span class="new-dot">NEW</span>' : ''}${j.hasLocalOutput ? '<span>Local output</span>' : j.hasOutput ? '<span>Saved output</span>' : ''}${j.state === 'claimed' && j.host ? `<span>${escape(j.host)}</span>` : ''}</div></div><time class="errand-time" data-at="${escape(j.updatedAt)}" title="${escape(stamp(j.updatedAt))}">${escape(ago(j.updatedAt))}</time></div>${detail}</article>`;
    }).join('') : `<div class="empty"><strong>${filter === 'open' ? 'No errands in progress' : filter === 'queued' ? 'No errands in the queue' : filter === 'new' ? 'You are caught up' : search ? 'No matching errands' : 'No recent errands to show'}</strong>${filter === 'open' ? 'New work will appear here when the worker claims an errand.' : filter === 'new' ? 'New replies and results will appear here.' : 'The list updates automatically while the desktop app is open.'}</div>`;
    el('record-note').textContent = `${snapshot.activity.errands.length} recent and open errands available${jobs.length > 40 ? ' · showing the latest 40 matches' : ''} · Checked ${ago(snapshot.activity.observedAt).toLowerCase()}`;
  }
  function render(data) {
    snapshot = data;
    const a = data.activity, jobs = a.errands;
    el('machine').textContent = `THIS COMPUTER · ${data.machineName}`;
    el('checked').textContent = `Checked ${new Date(a.observedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    el('running').textContent = jobs.filter(j => ['claimed','reply'].includes(j.state)).length;
    el('queued').textContent = jobs.filter(j => j.state === 'queued').length;
    el('new-count').textContent = jobs.filter(j => j.isNew).length;
    el('running-note').textContent = jobs.some(j => j.state === 'reply') ? 'Claimed errands and replies still arriving' : 'Claimed by the laptop worker';
    el('seen').disabled = !jobs.some(j => j.isNew);
    const notices = [];
    if (a.notice) notices.push(a.notice);
    if (data.daemon.state === 'absent' && jobs.some(j => j.state === 'queued')) notices.push('Errands are queued, but the Gemini worker was not detected on this laptop.');
    el('notice').innerHTML = notices.length ? `<div class="notice">${notices.map(escape).join('<br>')}</div>` : '';
    el('worker-state').textContent = {detected:'Detected',absent:'Not detected',unknown:'Unknown'}[data.daemon.state] || 'Unknown';
    el('worker-state').className = `badge ${data.daemon.state}`;
    el('worker-detail').textContent = data.daemon.detail;
    el('last-log').textContent = data.daemon.lastLogAt ? ago(data.daemon.lastLogAt) : 'No local log';
    el('last-log').title = data.daemon.lastLogAt ? stamp(data.daemon.lastLogAt) : '';
    el('connection').textContent = a.connected ? 'Up to date' : 'Saved records';
    el('applications').innerHTML = data.applications.map(app => `<div class="application" title="${escape(app.detail)}"><span>${escape(app.name)}</span><span class="application-state ${app.state}">${app.state === 'open' ? '<span class="dot green"></span>Open' : 'Not detected'}</span></div>`).join('');
    html('places', data.places.map(p => `<button class="place" data-action="place" data-id="${escape(p.id)}" title="${escape(p.detail)}">${escape(p.name)}<span aria-hidden="true">↗</span></button>`).join('') || '<div class="empty compact">Choose your repositories folder in Settings.</div>');
    el('downloads').innerHTML = data.downloads.map(f => `<div class="download"><span class="download-name" title="${escape(f.name)}">${escape(f.name)}</span><time class="download-date" title="${escape(stamp(f.modifiedAt))}">${escape(ago(f.modifiedAt))}</time></div>`).join('') || '<div class="empty compact">No recent files found in Downloads.</div>';
    renderJobs();
    document.querySelectorAll('.errand-time[data-at]').forEach(time => { time.textContent = ago(time.dataset.at); });
  }
  document.addEventListener('click', event => {
    const expand = event.target.closest('[data-expand]');
    if (expand) { const id = expand.dataset.expand; expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderJobs(); return; }
    const f = event.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; renderJobs(); return; }
    const action = event.target.closest('[data-action]');
    if (action) send(action.dataset.action, action.dataset.id);
  });
  el('search').addEventListener('input', event => { search = event.target.value.toLowerCase().trim(); renderJobs(); });
  bridge?.addEventListener('message', event => { if (event.data?.type === 'snapshot') render(event.data.data); });
  send('ready');
})();
