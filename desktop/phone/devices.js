(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = value => new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2,'0');
  const valid = value => value?.schemaVersion === 1 && typeof value.reachable === 'boolean' && typeof value.sessionAvailable === 'boolean'
    && Number.isFinite(Date.parse(value.observedAt)) && ['source','title','artist','album','playbackState'].every(key => typeof value[key] === 'string' && value[key].length <= 512)
    && ['canPlayPause','canGoPrevious','canGoNext'].every(key => typeof value[key] === 'boolean')
    && ['positionSeconds','endSeconds'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0);
  let data, active = false, connected = false, reading = false, busy = false, timer, staleTimer, message = '', failed = false, denied = false;
  const fresh = () => connected && navigator.onLine !== false && data && Date.now() - Date.parse(data.observedAt) < 10000;
  const ready = () => fresh() && data.reachable;
  function connection() {
    if (!active) return;
    el('connection').textContent = denied ? 'Access unavailable' : fresh() ? 'Laptop live' : data ? 'Last seen' : failed ? 'Offline' : 'Connecting…';
    el('connection').className = 'ml-auto text-[10px] ' + (fresh() ? 'text-emerald-800' : 'text-amber-800');
    el('connection').title = data ? 'Observed ' + stamp(data.observedAt) : 'Connecting to your laptop';
  }
  const paths = {
    previous:'<path d="M5 5v14m14-14L8 12l11 7Z"/>', next:'<path d="M19 5v14M5 5l11 7-11 7Z"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>', pause:'<path d="M8 4v16m8-16v16"/>',
    down:'<path d="M3 9v6h4l5 4V5L7 9Zm13 3h6"/>', up:'<path d="M3 9v6h4l5 4V5L7 9Zm4 3h6m-3-3v6"/>',
    mute:'<path d="M3 9v6h4l5 4V5L7 9Zm13 0 6 6m0-6-6 6"/>'
  };
  function button(action,label,icon,enabled,large=false) {
    return `<button data-media="${action}" aria-label="${label}" title="${label}" ${enabled && !busy ? '' : 'disabled'} class="flex ${large ? 'size-12 rounded-full bg-stone-900 text-white' : 'size-11 rounded-full text-stone-700'} shrink-0 items-center justify-center disabled:opacity-30 active:bg-stone-200"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" class="size-5" aria-hidden="true">${paths[icon]}</svg></button>`;
  }
  function render() {
    if (!active) return;
    const viewport = {x:scrollX,y:scrollY}, focus = document.activeElement?.dataset.media;
    const live = ready(), playing = data?.playbackState === 'playing';
    const state = !data ? denied ? 'Access unavailable' : failed ? 'Laptop unreachable' : 'Connecting…'
      : !fresh() ? 'Last seen ' + stamp(data.observedAt) : !data.reachable ? 'Unavailable' : !data.sessionAvailable ? 'Ready' : ({playing:'Playing',paused:'Paused',stopped:'Stopped'})[data.playbackState] || 'Player connected';
    const title = data?.sessionAvailable ? data.title || 'Untitled media' : 'No media playing';
    const detail = data?.sessionAvailable ? [data.artist,data.album].filter(Boolean).join(' · ') : 'Start music or video on the laptop to see it here.';
    const end = data?.endSeconds || 0, position = Math.min(data?.positionSeconds || 0,end);
    el('devices').innerHTML = `<article class="border-b border-stone-200 bg-white px-3 py-3"><div class="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-5 shrink-0 text-sky-700" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="6" r="1"/></svg><h2 class="text-sm font-semibold">Stereo Bridge</h2><span class="ml-auto text-[10px] ${live ? 'text-emerald-800' : 'text-stone-500'}">${escape(state)}</span></div><div class="mt-3 min-h-16"><p class="break-words text-base font-medium leading-5">${escape(title)}</p><p class="mt-1 break-words text-xs leading-4 text-stone-500">${escape(detail)}</p>${data?.source && data.sessionAvailable ? `<p class="mt-1 truncate text-[10px] text-stone-400">${escape(data.source)}</p>` : ''}</div><div class="mt-2 h-1 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label="Track position" aria-valuemin="0" aria-valuemax="${end || 1}" aria-valuenow="${position}"><div class="h-full rounded-full bg-sky-600" style="width:${end ? position / end * 100 : 0}%"></div></div><div class="mt-1 flex justify-between text-[10px] tabular-nums text-stone-400"><span>${end ? clock(position) : '–:–'}</span><span>${end ? clock(end) : '–:–'}</span></div><div class="mt-1 flex items-center justify-center gap-7">${button('previous','Previous track','previous',live && data.canGoPrevious)}${button('play-pause',playing ? 'Pause' : 'Play',playing ? 'pause' : 'play',live && data.canPlayPause,true)}${button('next','Next track','next',live && data.canGoNext)}</div><div class="mt-2 flex items-center justify-center gap-7 border-t border-stone-100 pt-1">${button('volume-down','Volume down','down',live)}${button('mute','Toggle mute','mute',live)}${button('volume-up','Volume up','up',live)}</div><p class="min-h-4 text-center text-[11px] ${failed ? 'text-amber-800' : 'text-stone-500'}" role="status">${escape(message || (busy ? 'Sending…' : 'Laptop volume'))}</p></article><p class="px-3 pt-2 text-[11px] leading-4 text-stone-500">${denied ? 'Connect with your Tailscale account.' : data && !fresh() ? 'Laptop unreachable or readings paused. Controls are disabled.' : data && !data.reachable ? 'Open Stereo Bridge on the laptop to connect.' : 'Controls the laptop’s current audio output. Phone audio still uses Bluetooth.'}</p>`;
    if (data?.machineName) el('machine').textContent = data.machineName;
    if (focus) [...el('devices').querySelectorAll('[data-media]')].find(n => n.dataset.media === focus && !n.disabled)?.focus({preventScroll:true});
    if (scrollX !== viewport.x || scrollY !== viewport.y) scrollTo(viewport.x,viewport.y);
    connection();
    clearTimeout(staleTimer);
    if (fresh()) staleTimer = setTimeout(render,Math.max(1,10000 - (Date.now() - Date.parse(data.observedAt))));
  }
  async function poll() {
    clearTimeout(timer);
    if (!active || reading || busy || document.hidden) return;
    reading = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),5000);
    try {
      const response = await fetch('/api/v1/devices',{cache:'no-store',signal:controller.signal});
      denied = response.status === 403;
      if (denied) { data = undefined; localStorage.removeItem('web-tools-stereo-snapshot'); }
      if (!response.ok) throw new Error('Unavailable');
      const value = await response.json();
      if (!valid(value)) throw new Error('Unsupported observation');
      data = value; connected = true; failed = false;
      try { localStorage.setItem('web-tools-stereo-snapshot',JSON.stringify(data)); } catch { }
    } catch { connected = false; failed = true; }
    finally { clearTimeout(timeout); reading = false; render(); if (active && !document.hidden) timer = setTimeout(poll,failed ? 10000 : 2000); }
  }
  async function action(value) {
    if (busy || !ready() || document.hidden) return;
    busy = true; message = ''; clearTimeout(timer); render();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),8000);
    try {
      const response = await fetch('/api/v1/devices/stereo/' + value,{method:'POST',cache:'no-store',headers:{'X-WebTools-Action':'1'},signal:controller.signal});
      if (response.status === 403) { data = undefined; connected = false; denied = true; localStorage.removeItem('web-tools-stereo-snapshot'); }
      // Do not display raw HTTP/proxy error bodies or repeat a possibly delivered toggle.
      message = response.ok ? 'Control sent' : response.status === 409 ? 'Control unavailable or still completing' : response.status === 403 ? 'Access unavailable' : 'Could not confirm. Tap again only if needed.';
      if (!response.ok) { connected = false; failed = true; }
    } catch { connected = false; failed = true; message = 'Could not confirm. Tap again only if needed.'; }
    finally { clearTimeout(timeout); busy = false; render(); poll(); }
  }
  document.addEventListener('click',event => {
    const button = event.target.closest('[data-media]');
    if (active && button && !button.disabled) action(button.dataset.media);
  });
  document.addEventListener('visibilitychange',() => { clearTimeout(timer); if (document.hidden) { connected = false; render(); } else poll(); });
  window.addEventListener('online',poll);
  window.addEventListener('offline',() => { connected = false; render(); });
  try { const saved = JSON.parse(localStorage.getItem('web-tools-stereo-snapshot')); if (valid(saved)) data = saved; } catch { }
  window.NowDevices = {connection,setActive:value => { active = value; clearTimeout(timer); clearTimeout(staleTimer); if (active) { render(); poll(); } }};
})();
