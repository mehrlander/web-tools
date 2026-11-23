/* Anchored metric details, with Web Tools' shared panel-tip dismissal behavior. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = null;

  function close({restoreFocus = true} = {}) {
    const prior = current;
    if (!prior) return;
    const focused = prior.panel.contains(document.activeElement);
    current = null;
    prior.guards?.detach();
    prior.observer?.disconnect();
    window.visualViewport?.removeEventListener('resize',prior.viewportClose);
    window.visualViewport?.removeEventListener('scroll',prior.viewportClose);
    prior.panel.remove();
    if (prior.anchor) {
      for (const [name,value] of prior.attributes) {
        if (value === null) prior.anchor.removeAttribute(name);
        else prior.anchor.setAttribute(name,value);
      }
      if (restoreFocus && prior.anchor.isConnected && focused) prior.anchor.focus({preventScroll:true});
    }
  }

  function place(entry) {
    if (current !== entry || !entry.panel.isConnected) return;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const margin = 12, gap = 8;
    entry.panel.style.width = Math.max(0,Math.min(380,width - margin * 2)) + 'px';
    entry.panel.style.maxHeight = Math.max(0,Math.min(520,height - margin * 2)) + 'px';
    const rect = entry.anchor?.isConnected ? entry.anchor.getBoundingClientRect() : null;
    const panel = entry.panel.getBoundingClientRect();
    const left = rect ? Math.min(rect.left,leftEdge + width - panel.width - margin) : leftEdge + margin;
    const below = rect ? rect.bottom + gap : topEdge + margin;
    const above = rect ? rect.top - panel.height - gap : below;
    const top = below + panel.height <= topEdge + height - margin ? below : above;
    entry.panel.style.left = Math.max(leftEdge + margin,left) + 'px';
    entry.panel.style.top = Math.max(topEdge + margin,Math.min(top,topEdge + height - panel.height - margin)) + 'px';
  }

  // Body markup comes from the caller's escaped text or sanitized renderer.
  function open({anchor,title,body} = {}) {
    if (current?.anchor === anchor && anchor) { close(); return; }
    close({restoreFocus:false});
    if (!window.PanelTip) return;
    anchor = anchor?.isConnected ? anchor : null;
    const panel = document.createElement('aside');
    panel.id = 'phone-info-card';
    panel.className = 'fixed z-50 box-border flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-800 shadow-lg';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.setAttribute('aria-labelledby','phone-info-title');
    panel.setAttribute('data-no-swipe','');
    panel.innerHTML = `<header class="relative mb-2 shrink-0 pr-8"><h2 id="phone-info-title" class="m-0 text-sm font-semibold leading-6">${esc(title)}</h2></header>${PanelTip.closeHTML(true)}<div class="phone-info-body min-h-0 min-w-0 overflow-y-auto overscroll-contain break-words [&_p]:mb-3 [&_p:last-child]:mb-0">${body || ''}</div>`;
    const attributes = anchor ? ['aria-expanded','aria-controls','data-phone-info-anchor'].map(name => [name,anchor.getAttribute(name)]) : [];
    if (anchor) {
      anchor.setAttribute('aria-expanded','true');
      anchor.setAttribute('aria-controls',panel.id);
      anchor.setAttribute('data-phone-info-anchor','');
    }
    document.body.append(panel);
    const entry = {anchor,panel,attributes};
    current = entry;
    entry.guards = PanelTip.wire(panel,{onClose:close,except:['[data-phone-info-anchor]'],stale:'geometry',label:'Phone metric details'});
    entry.observer = new MutationObserver(() => {
      if (entry.anchor && !entry.anchor.isConnected) close({restoreFocus:false});
    });
    entry.observer.observe(document.body,{childList:true,subtree:true});
    entry.viewportClose = () => close({restoreFocus:false});
    window.visualViewport?.addEventListener('resize',entry.viewportClose);
    window.visualViewport?.addEventListener('scroll',entry.viewportClose);
    place(entry);
    panel.querySelector('[data-wt-panel-tip-close]')?.focus({preventScroll:true});
    requestAnimationFrame(() => place(entry));
  }

  window.addEventListener('nowviewchange',() => close({restoreFocus:false}));
  document.addEventListener('visibilitychange',() => { if (document.hidden) close({restoreFocus:false}); });
  window.NowPhoneInfo = {open,close};
})();
