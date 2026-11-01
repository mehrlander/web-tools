(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = value => new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const open = new Set(), positions = {now:0,computer:0};
  let data, active = false, connected = false, pending = false, timer, etag = '', failures = 0;
  const valid = value => value?.schemaVersion === 1 && Array.isArray(value.applications) && value.applications.length <= 256 && Number.isFinite(Date.parse(value.observedAt)) && value.applications.every(a => /^[A-Za-z0-9-]{1,80}$/.test(a.key) && typeof a.name === 'string' && Array.isArray(a.windows) && a.windows.length <= 256 && a.windows.every(w => typeof w.title === 'string'));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const fresh = () => connected && data && Date.now() - Date.parse(data.observedAt) < 20000;
  function connection() {
    if (!active) return;
    const live = fresh();
    const text = live ? 'Laptop live' : data ? 'Last seen ' + stamp(data.observedAt) : 'Laptop unreachable';
    el('connection').innerHTML = `<span class="inline-flex items-center gap-1 ${live ? 'text-emerald-800' : 'text-amber-800'}"><span class="size-1.5 rounded-full ${live ? 'bg-emerald-600' : 'bg-amber-500'}" aria-hidden="true"></span>${live ? 'Live' : data ? 'Last seen' : failures ? 'Offline' : 'Connecting…'}</span>`;
    el('connection').title = text;
  }
  function meter(label, value, detail, tone) {
    const amount = finite(value) ? Math.min(100,Math.max(0,value)) : null;
    return `<div class="min-w-0 flex-1"><div class="flex justify-between gap-1 text-xs"><span class="text-stone-500">${label}</span><span class="font-medium tabular-nums">${amount === null ? '…' : Math.round(amount) + '%'}</span></div><div class="mt-1 h-1 overflow-hidden rounded-full bg-stone-200">${amount === null ? '' : `<div class="h-full rounded-full ${tone}" style="width:${amount}%"></div>`}</div><p class="mt-1 truncate text-[10px] text-stone-500">${escape(detail)}</p></div>`;
  }
  function render() {
    if (!active) return;
    const viewport = {x:scrollX,y:scrollY};
    const focused = document.activeElement?.dataset.computerApp;
    if (!data) {
      el('computer').innerHTML = `<p class="px-3 py-4 text-sm text-stone-500">${failures ? 'Laptop unreachable. Use Windows App above to connect.' : 'Reading your computer…'}</p>`;
      connection(); return;
    }
    el('machine').textContent = data.machineName;
    const live = fresh(), count = data.applications.reduce((sum,a) => sum + a.windows.length,0);
    const session = ({locked:'Locked',unlocked:'Unlocked',disconnected:'Session disconnected',unknown:'Session status unavailable'})[data.sessionState] || 'Session status unavailable';
    const sessionText = session + (data.remoteSession === true ? ' · Remote desktop' : data.remoteSession === false ? ' · Local desktop' : '');
    const status = !live ? `Laptop unreachable or readings paused · Last seen ${stamp(data.observedAt)}` : data.notice;
    const battery = data.batteryPercent;
    const power = data.charging ? 'Charging' : data.pluggedIn === true ? 'Plugged in' : data.pluggedIn === false ? 'On battery' : 'Power unavailable';
    const memory = finite(data.memoryUsedGb) && finite(data.memoryTotalGb) ? `${data.memoryUsedGb} / ${data.memoryTotalGb} GB` : 'Reading memory';
    const icons = app => typeof app.icon === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{1,32768}$/.test(app.icon) ? `<img src="${app.icon}" alt="" class="size-6 shrink-0">` : `<span aria-hidden="true" class="flex size-6 shrink-0 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold text-stone-500">${escape(app.name.slice(0,1))}</span>`;
    el('computer').innerHTML = `${status ? `<p role="status" class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">${escape(status)}</p>` : ''}<div class="px-3 pt-2 pb-1"><p class="text-[11px] text-stone-500">${escape(sessionText)}</p><div class="mt-2 flex gap-4">${meter('CPU',data.cpuPercent,'Whole computer','bg-sky-500')}${meter('Memory',data.memoryPercent,memory,'bg-violet-500')}${meter('Battery',battery,power,'bg-emerald-500')}</div></div><div class="flex items-center justify-between gap-2 px-3 pt-3 pb-1 text-xs text-stone-500"><h2 class="font-medium">Open applications <span class="tabular-nums">${data.applications.length}</span></h2><span>${count} ${count === 1 ? 'window' : 'windows'}</span></div>${data.applications.length ? `<ul class="divide-y divide-stone-100 bg-white">${data.applications.map(app => `<li><button data-computer-app="${escape(app.key)}" aria-expanded="${open.has(app.key)}" aria-controls="windows-${escape(app.key)}" class="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-stone-50">${icons(app)}<span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">${escape(app.name)}</span>${app.windows.some(w => w.inFront) && live && data.sessionState === 'unlocked' ? '<span class="text-[10px] text-emerald-700">In front</span>' : ''}</span><span class="text-xs tabular-nums text-stone-400">${app.windows.length}</span></button><ul id="windows-${escape(app.key)}" ${open.has(app.key) ? '' : 'hidden'} class="space-y-1.5 pr-3 pb-2 pl-12">${app.windows.map(w => `<li class="break-words text-xs leading-4 text-stone-600">${escape(w.title)}${w.minimized ? '<span class="ml-1 text-[10px] text-stone-400">Minimized</span>' : ''}</li>`).join('')}</ul></li>`).join('')}</ul>` : `<p class="px-3 py-3 text-sm text-stone-500">${data.windowsObservedAt ? 'No application windows observed.' : 'No window list available yet.'}</p>`}<p class="px-3 pt-3 text-[10px] leading-4 text-stone-400">${data.windowsObservedAt ? 'Windows observed ' + escape(stamp(data.windowsObservedAt)) + ' · ' : ''}Desktop windows in this Windows session, including minimized windows. Background processes are not listed.</p>`;
    if (focused) [...el('computer').querySelectorAll('[data-computer-app]')].find(n => n.dataset.computerApp === focused)?.focus({preventScroll:true});
    if (scrollX !== viewport.x || scrollY !== viewport.y) scrollTo(viewport.x,viewport.y);
    connection();
  }
  async function poll() {
    clearTimeout(timer);
    if (!active || pending || document.hidden) return;
    pending = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),6000);
    try {
      const response = await fetch('/api/v1/computer',{cache:'no-store',signal:controller.signal,headers:etag ? {'If-None-Match':etag} : {}});
      if (response.status === 403) {
        data = undefined; etag = ''; localStorage.removeItem('web-tools-computer-snapshot');
        throw new Error('Access unavailable');
      }
      if (response.status !== 304) {
        if (!response.ok) throw new Error('Unavailable');
        const value = await response.json();
        if (!valid(value)) throw new Error('Unsupported snapshot');
        data = value; etag = response.headers.get('ETag') || '';
        try { localStorage.setItem('web-tools-computer-snapshot',JSON.stringify(data)); } catch { }
      }
      connected = true; failures = 0;
    } catch { connected = false; failures++; }
    finally {
      clearTimeout(timeout); pending = false; render();
      if (active && !document.hidden) timer = setTimeout(poll,Math.min(15000,3000 * 2 ** Math.min(failures,3)));
    }
  }
  function setView(name, navigate = true) {
    const next = name === 'computer';
    if (next !== active) positions[active ? 'computer' : 'now'] = scrollY;
    active = next;
    if (navigate) history.pushState(null,'',next ? '#view=computer' : location.pathname + location.search);
    el('view-title').textContent = next ? 'Computer' : 'Now';
    document.title = (next ? 'Computer' : 'Now') + ' | Web Tools';
    for (const id of ['assistants','notice','content','source-times']) el(id).hidden = next;
    el('computer').hidden = !next;
    for (const button of document.querySelectorAll('[data-view]')) {
      if (button.dataset.view === (next ? 'computer' : 'now')) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    clearTimeout(timer); render();
    window.dispatchEvent(new CustomEvent('nowviewchange',{detail:{computer:next}}));
    if (next) poll();
    scrollTo(0,positions[next ? 'computer' : 'now']);
  }
  function closeMenus() {
    el('view-menu').hidden = true;
    el('view-picker').setAttribute('aria-expanded','false');
  }
  document.addEventListener('click', event => {
    const picker = event.target.closest('#view-picker');
    if (picker) {
      const menu = el(picker.getAttribute('aria-controls')), wasOpen = !menu.hidden;
      closeMenus(); menu.hidden = wasOpen; picker.setAttribute('aria-expanded',String(!wasOpen)); return;
    }
    const button = event.target.closest('[data-view],[data-computer-app]');
    if (button?.dataset.view) { closeMenus(); setView(button.dataset.view); el('view-picker').focus({preventScroll:true}); }
    if (button?.dataset.computerApp) {
      const key = button.dataset.computerApp;
      if (open.has(key)) open.delete(key); else open.add(key);
      button.setAttribute('aria-expanded',String(open.has(key)));
      el('windows-' + key).hidden = !open.has(key);
    }
    if (!event.target.closest('#view-menu')) closeMenus();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!el('view-menu').hidden) { closeMenus(); el('view-picker').focus({preventScroll:true}); event.preventDefault(); }
  });
  const route = event => {
    const name = new URLSearchParams(location.hash.slice(1)).get('view');
    if (active || name === 'computer') { setView(name,false); event?.stopImmediatePropagation(); }
  };
  window.addEventListener('popstate',route);
  window.addEventListener('hashchange',() => { if (active !== (new URLSearchParams(location.hash.slice(1)).get('view') === 'computer')) route(); });
  document.addEventListener('visibilitychange',() => { clearTimeout(timer); if (!document.hidden) poll(); });
  window.addEventListener('online',poll);
  window.addEventListener('offline',() => { connected = false; render(); });
  try { const prior = JSON.parse(localStorage.getItem('web-tools-computer-snapshot')); if (valid(prior)) data = prior; } catch { }
  window.NowComputer = {active:() => active,connection};
  if (new URLSearchParams(location.hash.slice(1)).get('view') === 'computer') route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
