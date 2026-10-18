// linked-swiper.js — a list with a detail: the list beside, or over, a strip of
// one card per row, the two moving together. html-style rule 12, held once.
//
// Lifted from budget-drs's corpusSwiper (home, app/view/views/corpora.js), the
// fullest version of the pattern in the estate, so every list-detail view can
// share one implementation instead of copying the pick, the mark and the strip.
//
// Framework-free, loaded via gh.load after kits/swipe-deck.js (the strip and the
// door) and kits/dock-split.js (the seam), on a page whose chain has run
// lib/vanilla-bundle.js (window.esc). Without swipe-deck the card is drawn
// once and a pick redraws it; without dock-split there is no seam. Styling is
// Tailwind and daisyUI classes, written out in full so a build that scans the
// source finds every one.
//
//   linkedSwiper.attach(o) -> { pick(id), show(id), mount(), paint(), step(d), destroy() }
//     pick tells the host through onPick; show moves without telling it, for a
//     host that keeps the selection itself; mount rebuilds after the rows change.
//   linkedSwiper.head(name, i, n, noun, { deck, tight }) -> the head row's HTML
//   linkedSwiper.mark(list, key, id) -> select a row and keep it in the list's view
//
// attach() options:
//   root        the element holding list and card; the kit sets its layout
//   list        the list; the kit styles it and caps it when stacked
//   card        the card; the kit fills it with a head row over a body
//   key         the row attribute that holds an id: 'note' reads data-note.
//               With it the kit picks on a row tap or key and marks the row
//               (aria-selected); without it the host does both, using show().
//               The head row, body and seam carry data-ls="head|body|seam".
//   ids()       the ids in list order        sel()   the selected id
//   body(id, el)   HTML for a card, or fill el and return nothing
//   name(id)    { when, code, title } for the default head row
//   head({ i, n, tight })   HTML for a head row of the host's own
//   noun        one row, singular ('note'); names the arrows and the door
//   empty       HTML for a card when no row is shown
//   onPick(id, via)   the selection moved; via is list, swipe, step or api.
//               The host records it here (its state, its address).
//   deck()      opens the cards full screen; omit for a strip with no door
//   drawn(el), release(i, el)   after a card is drawn, before one is emptied
//   seam        a storage key: puts a dock-split seam between list and card and
//               keeps the list's width under that key
//   width()     the width the layout reads, default the root's own
//   stackBelow  under this width the list stacks over the card (980)
//   tightBelow  under this the arrows give way to the swipe (680)
//   listMax     the stacked list's height cap, a literal class ('max-h-[38vh]')
//   wide        the side-by-side columns without a seam, a literal class
//               (default a 340px list: 'grid-cols-[minmax(0,340px)_minmax(0,1fr)]')
//   innerClass, slidePad   passed to swipeDeck.core for each card
(() => {
  // The estate's one escape helper, from lib/vanilla-bundle.js, which the boot
  // chain loads ahead of every kit.
  const esc = s => window.esc(s);
  const cls = (el, list, on) => { if (el && list) for (const c of list.split(/\s+/)) if (c) el.classList.toggle(c, on); };

  const C = {
    root: 'grid min-h-0 flex-auto gap-2.5',
    wide: 'grid-cols-[minmax(0,340px)_minmax(0,1fr)]',
    // The list's track is the seam's to set, and is held to leave the card 380px
    // so a width kept from a wider screen cannot squeeze the card on this one.
    wideSeam: 'grid-cols-[minmax(0,min(var(--ls-list,340px),calc(100%_-_394px)))_14px_minmax(0,1fr)] gap-x-0',
    stacked: 'grid-cols-1 grid-rows-[auto_minmax(0,1fr)]',
    list: 'min-h-0 overflow-y-auto rounded-lg border border-base-300 bg-base-100',
    card: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100',
    head: 'flex flex-none items-center gap-1 border-b border-base-200 bg-base-100 py-1 pr-1.5 pl-3.5',
    body: 'min-h-0 flex-auto overflow-y-auto px-3.5 py-3',
    bodySwiping: 'min-h-0 flex-auto overflow-hidden',
    pad: 'px-3.5 py-3',
  };

  function head(name, i, n, noun = 'item', o = {}) {
    name = name || {};
    const full = [name.when, name.code, name.title].filter(Boolean).join(' ');
    const arrow = (d, icon, t) => `<button type="button" class="btn btn-xs btn-ghost btn-square${o.tight ? ' hidden' : ''}"`
      + ` data-swipe-step="${d}" title="${esc(t)}" aria-label="${esc(t)}"`
      + `${(d < 0 ? i <= 0 : i >= n - 1) ? ' disabled' : ''}><i class="ph ${icon}"></i></button>`;
    const E = window.swipeDeck && window.swipeDeck.entry;
    const door = n && o.deck && E
      ? `<button type="button" class="${E.cls('ghost')} -my-1.5" data-swipe-cards title="${esc(E.title(n, noun))}"`
        + ` aria-label="${esc(E.title(n, noun))}"><i class="ph ${E.icon} text-lg max-sm:text-xl"></i></button>`
      : '';
    return `<h2 class="m-0 min-w-0 flex-1 truncate text-base font-bold leading-snug" title="${esc(full)}">`
      + [name.when, name.code].filter(Boolean)
        .map(t => `<span class="mr-1.5 font-mono text-xs font-normal text-base-content/60">${esc(t)}</span>`).join('')
      + `${esc(name.title)}</h2>`
      + (n > 1 ? `<div class="flex flex-none items-center">${arrow(-1, 'ph-caret-left', `Previous ${noun}`)}`
        + `<span class="px-1 font-mono text-xs tabular-nums text-base-content/60">${i + 1}/${n}</span>`
        + `${arrow(1, 'ph-caret-right', `Next ${noun}`)}</div>` : '')
      + door;
  }

  // Inside the list, never the page: a swipe walks the selection down rows the
  // reader may have scrolled away from. The lead clears a sticky group label.
  function mark(list, key, id) {
    let on = null;
    for (const r of list.querySelectorAll(`[data-${key}]`)) {
      const hit = r.getAttribute('data-' + key) === String(id);
      r.setAttribute('aria-selected', String(hit));
      if (hit) on = r;
    }
    if (!on || !list.getBoundingClientRect) return;
    const box = list.getBoundingClientRect(), row = on.getBoundingClientRect(), lead = 24;
    if (row.top < box.top + lead) list.scrollTop -= box.top + lead - row.top;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
  }

  function attach(o = {}) {
    const { root, list, card, key } = o;
    if (!card) throw new Error('linked-swiper: no card');
    const kit = window.swipeDeck && window.swipeDeck.core ? window.swipeDeck : null;
    const noun = o.noun || 'item';
    const stackBelow = o.stackBelow ?? 980, tightBelow = o.tightBelow ?? 680;
    const listMax = o.listMax ?? 'max-h-[38vh]';

    const headEl = document.createElement('div'), bodyEl = document.createElement('div');
    headEl.className = C.head; headEl.dataset.ls = 'head';
    bodyEl.dataset.ls = 'body';
    card.replaceChildren(headEl, bodyEl);
    cls(card, C.card, true);
    if (list) cls(list, C.list, true);

    let core = null, ids = [], at = 0, w = 0, stacked = null, tight = false, seamEl = null, split = null;
    const offs = [];

    const draw = (id, el) => {
      const html = o.body(id, el);
      if (typeof html === 'string') el.innerHTML = html;
      if (o.drawn) o.drawn(el);
    };
    const paint = () => {
      const n = ids.length;
      headEl.innerHTML = o.head ? o.head({ i: at, n, tight })
        : head(n && o.name ? o.name(ids[at]) : null, at, n, noun, { deck: !!o.deck, tight });
    };
    const still = () => {
      bodyEl.className = C.body;
      if (ids.length) draw(ids[at], bodyEl); else bodyEl.innerHTML = o.empty || '';
    };
    // Every move the strip did not make itself (the start, a pick in the list, a
    // track that changed width) means "be on this card", so it is instant.
    const jump = () => requestAnimationFrame(() => {
      if (!core) return;
      core.go(at, 'instant');
      core.build(at - 1); core.build(at); core.build(at + 1);
    });

    // A row's attribute is a string and a host's id may not be, so ids are
    // matched as strings and the host is handed its own value back.
    const indexOf = id => ids.findIndex(x => String(x) === String(id));

    function pick(id, via = 'api') {
      const i = indexOf(id);
      if (i < 0) return;
      at = i; id = ids[i];
      if (o.onPick) o.onPick(id, via);
      if (list && key) mark(list, key, id);
      paint();
      if (via === 'swipe') return;
      if (core) jump(); else still();
    }

    function mount() {
      ids = o.ids();
      at = Math.max(0, indexOf(o.sel()));
      paint();
      if (list && key && ids.length) mark(list, key, ids[at]);
      if (!kit || !ids.length) { core = null; still(); return; }
      core = kit.core(ids.length, (i, slide) => draw(ids[i], slide), {
        innerClass: o.innerClass || 'w-full', slidePad: o.slidePad || C.pad, keys: card,
        release: o.release,
      });
      // A change reported while the strip is not the width it settled at is the
      // track re-snapping under a resize, not a swipe: back to the card it was on.
      core.onSlide(i => {
        if (i === at) return;
        if (w && bodyEl.clientWidth !== w) { jump(); return; }
        pick(ids[i], 'swipe');
      });
      bodyEl.className = C.bodySwiping;
      bodyEl.replaceChildren(core.track);
      jump();
    }

    // For a host that keeps the selection itself: be on this row, mark it, and
    // say nothing back.
    function show(id) {
      const i = indexOf(id);
      if (i < 0) return;
      at = i;
      if (list && key) mark(list, key, ids[i]);
      paint();
      if (core) jump(); else still();
    }

    function step(d) {
      const to = Math.max(0, Math.min(ids.length - 1, at + d));
      if (core) { core.go(to, 'smooth'); return; }
      if (to !== at) pick(ids[to], 'step');
    }

    const layout = () => {
      const width = o.width ? o.width() : root && root.clientWidth;
      if (!width) return;
      const s = width < stackBelow, t = width < tightBelow;
      if (s === stacked && t === tight) return;
      stacked = s; tight = t;
      if (root) {
        cls(root, seamEl ? C.wideSeam : (o.wide || C.wide), !s);
        cls(root, C.stacked, s);
        root.toggleAttribute('data-ls-stacked', s);
      }
      if (list) cls(list, listMax, s);
      // Inline, because dock-split's stylesheet is unlayered and outranks the
      // `hidden` utility (snag an-unlayered-rule-beats-every-layer).
      if (seamEl) seamEl.style.display = s ? 'none' : '';
      paint();
    };

    if (root) {
      cls(root, C.root, true);
      if (o.seam && list && window.dockSplit) {
        seamEl = document.createElement('div');
        seamEl.dataset.ls = 'seam';
        card.before(seamEl);
        const store = o.seam;
        const set = px => px ? root.style.setProperty('--ls-list', px + 'px') : root.style.removeProperty('--ls-list');
        try { const v = +localStorage.getItem(store); if (v > 0) set(v); } catch (e) {}
        const rw = () => root.getBoundingClientRect().width;
        split = window.dockSplit.attach(seamEl, {
          axis: 'col', from: 'start', min: 5, max: 95, label: 'Resize the list',
          bounds: () => root.getBoundingClientRect(),
          value: () => { const r = rw(); return r ? list.getBoundingClientRect().width / r * 100 : 0; },
          onChange: pct => { const r = rw(); set(Math.round(Math.max(240, Math.min(r - 380, r * pct / 100)))); split.refresh(); },
          onCommit: () => { try { localStorage.setItem(store, String(Math.round(list.getBoundingClientRect().width))); } catch (e) {} },
        });
        const forget = () => { set(0); try { localStorage.removeItem(store); } catch (e) {} split.refresh(); };
        seamEl.addEventListener('dblclick', forget);
      }
    }

    const onCard = e => {
      const st = e.target.closest('[data-swipe-step]');
      if (st) { e.preventDefault(); step(Number(st.dataset.swipeStep)); return; }
      if (o.deck && e.target.closest('[data-swipe-cards]')) { e.preventDefault(); o.deck(); }
    };
    card.addEventListener('click', onCard);
    offs.push(() => card.removeEventListener('click', onCard));

    if (list && key) {
      const rowOf = e => { const r = e.target.closest && e.target.closest(`[data-${key}]`); return r && list.contains(r) ? r : null; };
      // A host that answers a control inside a row claims the click first, in the
      // capture phase, with preventDefault, and the row is then not picked.
      const onClick = e => { if (e.defaultPrevented) return; const r = rowOf(e); if (r) pick(r.getAttribute('data-' + key), 'list'); };
      const onKey = e => {
        if (e.defaultPrevented || (e.key !== 'Enter' && e.key !== ' ')) return;
        const r = rowOf(e); if (!r) return;
        e.preventDefault(); pick(r.getAttribute('data-' + key), 'list');
      };
      list.addEventListener('click', onClick);
      list.addEventListener('keydown', onKey);
      offs.push(() => { list.removeEventListener('click', onClick); list.removeEventListener('keydown', onKey); });
    }

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        layout();
        const nw = bodyEl.clientWidth;
        if (core && nw && nw !== w) { w = nw; jump(); }
      });
      if (root) ro.observe(root);
      ro.observe(bodyEl);
      offs.push(() => ro.disconnect());
    }

    mount();
    layout();

    return {
      pick: id => pick(id, 'api'),
      show,
      mount,
      paint,
      step,
      destroy() {
        offs.forEach(f => f());
        if (split) split.destroy();
        if (seamEl) seamEl.remove();
      },
    };
  }

  window.linkedSwiper = { attach, head, mark };
})();
