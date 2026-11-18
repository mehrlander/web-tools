(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const names = {now:'Now',usage:'Usage',errands:'Errands',computer:'Computer',files:'Files'};
  const ids = Object.keys(names), positions = Object.fromEntries(ids.map(id => [id,0]));
  const track = el('view-track'), panels = new Map(ids.map(id => [id,el('panel-' + id)]));
  const interfaceVersion = '26.4';
  let current = 'now', deck, registration, updateJob, refreshing = false;
  let startupAligned = false, startupFrame = 0, startupStyles, startupSizes;
  let filesRoute = '#view=files';
  const canonical = value => value === 'devices' ? 'computer' : value === 'repositories' ? 'files' : ids.includes(value) ? value : 'now';
  const route = () => {
    const params = new URLSearchParams(location.hash.slice(1)), requested = params.get('view');
    const next = canonical(requested);
    if (requested === 'devices' || requested === 'repositories') {
      params.set('view',next);
      history.replaceState(history.state,'','#' + params);
    }
    return next;
  };
  const panel = id => panels.get(canonical(id));
  const scrollPosition = (id = 'now') => {
    const key = canonical(id);
    if (!el('overview').hidden) positions[key] = panel(key)?.scrollTop ?? positions[key];
    return positions[key];
  };
  const scrollToPanel = (top, id = 'now') => {
    const key = canonical(id), value = typeof top === 'number' && Number.isFinite(top) ? Math.max(0,top) : 0;
    positions[key] = value;
    const target = panel(key);
    if (target && !el('overview').hidden) target.scrollTop = value;
  };
  const connection = () => ({errands:window.NowErrands,computer:window.NowComputer,files:window.NowRepositories})[current]?.connection();
  function horizontalLayoutReady() {
    if (el('overview').hidden) return false;
    const width = track.clientWidth, bounds = ids.map(id => panel(id).getBoundingClientRect());
    if (!width || !bounds[0].height) return false;
    return bounds.every((box,index) => box.height > 0 && Math.abs(box.width - width) < 2
      && Math.abs(box.top - bounds[0].top) < 2 && Math.abs(box.left - bounds[0].left - index * bounds[0].width) < 2);
  }
  function scheduleStartupAlignment() {
    if (startupAligned || startupFrame || !deck) return;
    startupFrame = requestAnimationFrame(() => {
      startupFrame = 0;
      if (!horizontalLayoutReady()) return;
      // Tailwind can turn already full-width stacked panels into a strip
      // without resizing the track. Align once after that geometry exists.
      deck.jump(ids.indexOf(current));
      startupAligned = true;
      startupStyles?.disconnect();
      startupSizes?.disconnect();
    });
  }
  function closeMenu(focus = false) {
    el('view-menu').hidden = true;
    el('view-picker').setAttribute('aria-expanded','false');
    if (focus) el('view-picker').focus({preventScroll:true});
  }
  function openMenu() {
    el('view-menu').hidden = false;
    el('view-picker').setAttribute('aria-expanded','true');
    el('view-menu').querySelector('[aria-current="page"]')?.focus({preventScroll:true});
  }
  function setView(value, navigate = true, move = true) {
    const next = canonical(value), changed = current !== next;
    if (changed) {
      positions[current] = scrollPosition(current);
      if (current === 'files' && route() === 'files') filesRoute = location.hash;
    }
    current = next;
    if (navigate) {
      const hash = next === 'files' ? filesRoute : '#view=' + next;
      if (location.hash !== hash) history.pushState(null,'',hash);
    } else if (next === 'files') filesRoute = location.hash;
    closeMenu();
    el('view-title').textContent = names[next];
    document.title = names[next] + ' | Web Tools';
    el('overview').hidden = false;
    el('detail').hidden = true;
    for (const [id,target] of panels) {
      const active = id === next;
      target.inert = !active;
      target.toggleAttribute('inert',!active);
      target.setAttribute('aria-hidden',String(!active));
    }
    for (const button of el('view-menu').querySelectorAll('[data-view]')) {
      const active = canonical(button.dataset.view) === next;
      if (active) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
      button.setAttribute('aria-checked',String(active));
    }
    if (changed || !deck) {
      window.NowComputer?.setActive(next === 'computer');
      window.NowDevices?.setActive(next === 'computer');
      window.NowRepositories?.setActive(next === 'files');
      window.NowErrands?.setActive(next === 'errands');
    }
    // Keep the incoming hash intact. The Now listener resolves a session route
    // after the visible panel and active view agree.
    window.dispatchEvent(new CustomEvent('nowviewchange',{detail:{view:next}}));
    if (move && startupAligned) deck?.go(ids.indexOf(next),true);
    else scheduleStartupAlignment();
    if (changed && next !== 'files') scrollToPanel(positions[next],next);
    connection();
  }
  function updateInterface() {
    if (document.hidden || !registration) return Promise.resolve();
    if (!updateJob) updateJob = Promise.resolve().then(() => registration.update()).catch(() => {}).finally(() => { updateJob = null; });
    return updateJob;
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    // A new worker may activate quietly. Only this explicit action reloads a
    // page, so returning to the foreground never interrupts a reading.
    await Promise.race([updateInterface(),new Promise(resolve => setTimeout(resolve,3000))]);
    location.reload();
  }
  window.NowViews = {
    active:() => current !== 'now', current:() => current, connection,
    setView, scrollPosition, scrollTo:scrollToPanel, refresh, interfaceVersion,
  };
  el('view-menu').querySelector('[data-interface-version]').textContent = 'v' + interfaceVersion;
  document.addEventListener('click',event => {
    if (event.target.closest('[data-interface-refresh]')) { event.preventDefault(); closeMenu(true); refresh(); return; }
    if (event.target.closest('#view-picker')) {
      if (el('view-menu').hidden) openMenu(); else closeMenu();
      return;
    }
    const button = event.target.closest('[data-view]');
    if (button) { setView(button.dataset.view); el('view-picker').focus({preventScroll:true}); }
    else if (!event.target.closest('#view-menu')) closeMenu();
    if (current === 'files' && route() === 'files') filesRoute = location.hash;
  });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && !el('view-menu').hidden) { closeMenu(true); event.preventDefault(); return; }
    if (event.target === el('view-picker') && event.key === 'ArrowDown') { openMenu(); event.preventDefault(); return; }
    if (el('view-menu').hidden || !['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    const items = [...el('view-menu').querySelectorAll('[data-view],[data-interface-refresh]')], at = items.indexOf(document.activeElement);
    items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus({preventScroll:true});
    event.preventDefault();
  });
  // Registered before phone.js: its popstate/hashchange listeners still run
  // after navigation has made a routed Now detail visible.
  window.addEventListener('popstate',() => setView(route(),false));
  window.addEventListener('hashchange',() => { if (current !== route()) setView(route(),false); });
  for (const [id,target] of panels) target.addEventListener('scroll',() => {
    if (el('overview').hidden) return;
    positions[id] = target.scrollTop;
    if (id === 'files') window.NowRepositories?.positionPanels();
  },{passive:true});
  window.NowErrands?.mount(el('errands'));
  if (window.swipeDeck?.strip) {
    deck = window.swipeDeck.strip({el:track,at:() => ids.indexOf(current),onSlide:i => { if (startupAligned) setView(ids[i],true,false); }});
    track.addEventListener('scroll',() => { if (startupAligned) deck.scrolled(); },{passive:true});
    track.addEventListener('scrollend',() => { if (startupAligned) deck.read(); },{passive:true});
    startupStyles = new MutationObserver(scheduleStartupAlignment);
    startupStyles.observe(document.head,{childList:true,characterData:true,subtree:true});
    if (typeof ResizeObserver !== 'undefined') {
      startupSizes = new ResizeObserver(scheduleStartupAlignment);
      startupSizes.observe(track);
      for (const target of panels.values()) startupSizes.observe(target);
    }
  } else {
    startupAligned = true;
  }
  setView(route(),false);
  scheduleStartupAlignment();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(value => {
    registration = value;
    updateInterface();
  }).catch(() => {});
  document.addEventListener('visibilitychange',() => { if (!document.hidden) updateInterface(); });
  window.addEventListener('pageshow',updateInterface);
})();
