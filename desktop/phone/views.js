(() => {
  'use strict';
  const el = id => document.getElementById(id), positions = {now:0,computer:0,devices:0,files:0};
  let current = 'now';
  const panel = () => ({computer:window.NowComputer,devices:window.NowDevices,files:window.NowRepositories})[current];
  const name = () => {
    const params=new URLSearchParams(location.hash.slice(1));
    // Previously shared phone links land in the same folder in Files.
    if(params.get('view')==='repositories'){params.set('view','files');history.replaceState(history.state,'','#'+params);}
    return ['computer','devices','files'].includes(params.get('view'))?params.get('view'):'now';
  };
  function setView(next, navigate = true) {
    if (current !== next) positions[current] = scrollY;
    current = next;
    if (navigate) history.pushState(null,'',next === 'now' ? location.pathname + location.search : '#view=' + next);
    el('view-title').textContent = {now:'Now',computer:'Computer',devices:'Devices',files:'Files'}[next];
    document.title = el('view-title').textContent + ' | Web Tools';
    el('overview').hidden = false; el('detail').hidden = true;
    for (const id of ['assistants','notice','content','source-times']) el(id).hidden = next !== 'now';
    for (const id of ['computer','devices','repositories']) el(id).hidden = next !== (id==='repositories'?'files':id);
    for (const button of document.querySelectorAll('[data-view]')) {
      if (button.dataset.view === next) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    window.NowComputer?.setActive(next === 'computer');
    window.NowDevices?.setActive(next === 'devices');
    window.NowRepositories?.setActive(next === 'files');
    window.dispatchEvent(new CustomEvent('nowviewchange'));
    if (next !== 'files') scrollTo(0,positions[next]);
  }
  function closeMenu() { el('view-menu').hidden = true; el('view-picker').setAttribute('aria-expanded','false'); }
  document.addEventListener('click', event => {
    if (event.target.closest('#view-picker')) {
      const open = !el('view-menu').hidden; closeMenu(); el('view-menu').hidden = open;
      el('view-picker').setAttribute('aria-expanded',String(!open)); return;
    }
    const button = event.target.closest('[data-view]');
    if (button) { closeMenu(); setView(button.dataset.view); el('view-picker').focus({preventScroll:true}); }
    else if (!event.target.closest('#view-menu')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !el('view-menu').hidden) {
      closeMenu(); el('view-picker').focus({preventScroll:true}); event.preventDefault();
    }
  });
  window.addEventListener('popstate',event => {
    const next = name();
    if (current !== 'now' || next !== 'now') { setView(next,false); event.stopImmediatePropagation(); }
  });
  window.addEventListener('hashchange',() => { if (current !== name()) setView(name(),false); });
  window.NowViews = {active:() => current !== 'now',connection:() => panel()?.connection()};
  if (name() !== 'now') setView(name(),false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
