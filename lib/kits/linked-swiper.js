// linked-swiper.js — a list with a detail: the list beside, or over, a strip of
// one card per row, the two moving together. html-style rule 11, held once.
//
// Lifted from budget-drs's corpusSwiper (mehrlander/budget-drs, app/view/views/corpora.js), the
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
//   linkedSwiper.attach(o) -> { pick(id, via, sub), show(id, sub), mount(), paint(),
//                               step(d), tabs(id), slides(), destroy() }
//     pick tells the host through onPick, with `via` ('api' when omitted) the
//     host's own word for how the move was made: 'follow' for a link followed
//     inside a card, say, so the host can add a history entry for it and
//     replace the entry for a browse; show moves without telling it, for a
//     host that keeps the selection itself; mount rebuilds after the rows change.
//     With sub-items (subs, below): sub names one, else the item's first;
//     tabs draws the rows' tabs again, one item's or all, after the host
//     redrew its rows or changed a sub-item's state; slides lists the cards in
//     order as { id, sub, j, n }, for a deck that follows them.
//   linkedSwiper.head(name, i, n, noun, { deck, tight, slim, count }) -> the head row's HTML
//     count is a color class for the counter, in place of its quiet one
//   linkedSwiper.mark(list, key, id, sub) -> select a row, and its sub-item's
//     tab, and keep both in view
//
// attach() options:
//   root        the element holding list and card; the kit sets its layout
//   list        the list; the kit styles it and caps it when stacked
//   card        the card; the kit fills it with a head row over a body
//   key         the row attribute that holds an id: 'note' reads data-note.
//               With it the kit picks on a row tap or key and marks the row
//               (aria-selected); without it the host does both, using show().
//               Up and Down in the list then step the selection the way a
//               swipe steps the strip: the card follows, and focus moves with
//               the row. Rows that carry a tabindex share one tab stop, on the
//               selected row; where none does, the list itself takes focus.
//               The head row, body and seam carry data-ls="head|body|seam".
//   ids()       the ids in list order        sel()   the selected id
//   body(id, el)   HTML for a card, or fill el and return nothing
//   name(id)    { when, code, title } for the default head row; pill is a
//               short mark, a number say, drawn as a pill in the accent
//               straight after the title, for a card that is one of a
//               numbered few. The title truncates and the pill stays whole
//   head({ i, n, tight })   HTML for a head row of the host's own
//   noun        one row, singular ('note'); names the arrows and the door
//   empty       HTML for a card when no row is shown
//   onPick(id, via)   the selection moved; via is list, swipe, step, api, or
//               whatever the host passed to pick().
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
//   innerClass, slidePad, slideScroll   passed to swipeDeck.core for each card
//   subs(id)    the item's sub-items, in order, ids unique within the item.
//               There is then a card per sub-item, item by item, and one for
//               an item with none. A swipe, a step, or Up and Down move card by
//               card, into the next item after an item's last. A row whose
//               item has more than one gets a strip of numbered tabs at its
//               right end, in place of a [data-ls-tabs] the row holds: a tap
//               on a tab opens that sub-item, a tap elsewhere on the row the
//               item's first. The open one's tab is aria-selected, and its
//               label is the head's pill unless name() gives one. body, name,
//               onPick and pick take the sub-item last: body(id, el, sub),
//               name(id, sub), onPick(id, via, sub), pick(id, via, sub).
//   places      with subs: a sub-item is a place in its item's card, not a
//               card of its own. A move between an item's sub-items, however
//               made, has no transition: body(id, el, sub) runs again on the
//               element already showing the item, for the host to update in
//               place. Into another item the strip slides as before. On an
//               item with more than one sub-item a swipe is a step, read when
//               the finger lifts. Counter, tabs and slides() are unchanged; a
//               deck that follows slides() gets the same by passing
//               card: i => slides()[i].id to swipeDeck.open().
//   selSub()    the selected sub-item, read beside sel()
//   tab(id, sub, j, n)   { label, aria, cls } for a sub-item's tab: its text
//               (j + 1 by default), its name for a screen reader, and classes
//               for a state such as judged
//   subNoun     one sub-item, singular ('flag'); names the tabs
//   slim        the head row is as tall as its title: the door reaches past
//               the row, over the card's top padding, and keeps its size. A
//               host that draws its own head row passes `slim` to head() too
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
    // A long strip is held to about five tabs and scrolls inside itself, so
    // the row's title keeps its room.
    tabs: 'tabs tabs-box tabs-xs max-w-[7.5rem] flex-none flex-nowrap overflow-x-auto p-0.5 [scrollbar-width:none]',
    tab: 'tab min-w-5 flex-none px-1 font-mono text-[0.8125rem] font-medium tabular-nums text-base-content/80 aria-selected:bg-primary aria-selected:text-primary-content',
  };
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  function head(name, i, n, noun = 'item', o = {}) {
    name = name || {};
    const full = [name.when, name.code, name.title, name.pill].filter(x => x != null && x !== '').join(' ');
    const arrow = (d, icon, t) => `<button type="button" class="btn btn-xs btn-ghost btn-square${o.tight ? ' hidden' : ''}"`
      + ` data-swipe-step="${d}" data-title-tip="${esc(t)}" aria-label="${esc(t)}"`
      + `${(d < 0 ? i <= 0 : i >= n - 1) ? ' disabled' : ''}><i class="ph ${icon}"></i></button>`;
    const E = window.swipeDeck && window.swipeDeck.entry;
    const door = n && o.deck && E
      ? `<button type="button" class="${E.cls('ghost')} ${o.slim ? '-my-3' : '-my-1.5'}" data-swipe-cards data-title-tip="${esc(E.title(n, noun))}"`
        + ` aria-label="${esc(E.title(n, noun))}"><i class="ph ${E.icon} text-lg max-sm:text-xl"></i></button>`
      : '';
    const lead = [name.when, name.code].filter(Boolean)
      .map(t => `<span class="mr-1.5 flex-none font-mono text-xs font-normal text-base-content/60">${esc(t)}</span>`).join('');
    // With a pill the heading is a row: the title gives way and the pill,
    // right after it, does not.
    const pill = name.pill != null && name.pill !== '';
    return `<h2 class="m-0 min-w-0 flex-1 text-base font-bold leading-snug ${pill ? 'flex items-center gap-1.5' : 'truncate'}" data-title-tip="${esc(full)}">`
      + lead
      + (pill
        ? `<span class="min-w-0 truncate">${esc(name.title)}</span>`
          + `<span data-ls-pill class="badge badge-primary badge-sm flex-none px-1.5 font-mono font-medium tabular-nums">${esc(name.pill)}</span>`
        : esc(name.title))
      + `</h2>`
      + (n > 1 ? `<div class="flex flex-none items-center">${arrow(-1, 'ph-caret-left', `Previous ${noun}`)}`
        + `<span class="px-1 font-mono text-xs tabular-nums ${o.count || 'text-base-content/60'}">${i + 1}/${n}</span>`
        + `${arrow(1, 'ph-caret-right', `Next ${noun}`)}</div>` : '')
      + door;
  }

  // Inside the list, never the page: a swipe walks the selection down rows the
  // reader may have scrolled away from. The lead clears a sticky group label.
  // The tab stop is the row's, or its open tab's where it shows tabs.
  function mark(list, key, id, sub) {
    let on = null, tab = null;
    for (const r of list.querySelectorAll(`[data-${key}]`)) {
      const hit = r.getAttribute('data-' + key) === String(id);
      r.setAttribute('aria-selected', String(hit));
      let t = null;
      for (const x of r.querySelectorAll('[data-ls-sub]')) {
        const open = hit && x.getAttribute('data-ls-sub') === String(sub);
        x.setAttribute('aria-selected', String(open));
        x.tabIndex = -1;
        if (open) t = x;
      }
      if (r.hasAttribute('tabindex')) { r.tabIndex = hit && !t ? 0 : -1; if (t) t.tabIndex = 0; }
      // A focus ring drawn outside the row is cut off by the list's scroll
      // box, so it is drawn just inside. Inline, because the title-tip kit's
      // focus ring is unlayered and outranks a utility (snag
      // an-unlayered-rule-beats-every-layer).
      r.style.outlineOffset = '-2px';
      if (hit) { on = r; tab = t; }
    }
    if (!on || !list.getBoundingClientRect) return;
    const box = list.getBoundingClientRect(), row = on.getBoundingClientRect(), lead = 24;
    if (row.top < box.top + lead) list.scrollTop -= box.top + lead - row.top;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
    const strip = tab && tab.parentElement;
    if (strip && strip.scrollWidth > strip.clientWidth)
      strip.scrollLeft += tab.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - tab.offsetWidth) / 2;
  }

  function attach(o = {}) {
    const { root, list, card, key } = o;
    if (!card) throw new Error('linked-swiper: no card');
    const kit = window.swipeDeck && window.swipeDeck.core ? window.swipeDeck : null;
    const noun = o.noun || 'item';
    const stackBelow = o.stackBelow ?? 980, tightBelow = o.tightBelow ?? 680;
    const listMax = o.listMax ?? 'max-h-[38vh]';

    const headEl = document.createElement('div'), bodyEl = document.createElement('div');
    // A slim head row sits over the body, so a button reaching past the row
    // is still the button where a finger lands on it.
    headEl.className = C.head + (o.slim ? ' relative z-10' : ''); headEl.dataset.ls = 'head';
    bodyEl.dataset.ls = 'body';
    card.replaceChildren(headEl, bodyEl);
    cls(card, C.card, true);
    if (list) cls(list, C.list, true);

    // The cards, one per sub-item or per item without any: { id, sub, j, n }.
    let core = null, cards = [], at = 0, w = 0, stacked = null, tight = false, seamEl = null, split = null;
    const offs = [];
    const subNoun = o.subNoun || 'part';
    const cardsOf = () => o.ids().flatMap(id => {
      const subs = (o.subs && o.subs(id)) || [];
      return subs.length ? subs.map((sub, j) => ({ id, sub, j, n: subs.length })) : [{ id, sub: undefined, j: 0, n: 0 }];
    });
    const tabOf = c => ({ label: c.j + 1, aria: `${cap(subNoun)} ${c.j + 1} of ${c.n}`, ...(o.tab && o.tab(c.id, c.sub, c.j, c.n)) });

    const draw = (c, el) => {
      const html = o.body(c.id, el, c.sub);
      if (typeof html === 'string') el.innerHTML = html;
      if (o.drawn) o.drawn(el);
    };
    const paint = () => {
      const n = cards.length, c = cards[at];
      let name = n && o.name ? o.name(c.id, c.sub) : null;
      if (name && c.n > 1 && (name.pill == null || name.pill === '')) name = { ...name, pill: tabOf(c).label };
      headEl.innerHTML = o.head ? o.head({ i: at, n, tight, id: c && c.id, sub: c && c.sub })
        : head(name, at, n, noun, { deck: !!o.deck, tight, slim: !!o.slim });
    };
    const still = () => {
      bodyEl.className = C.body;
      if (cards.length) draw(cards[at], bodyEl); else bodyEl.innerHTML = o.empty || '';
    };
    const markAt = () => { if (list && key && cards[at]) mark(list, key, cards[at].id, cards[at].sub); };

    // Each row's strip, drawn where its [data-ls-tabs] was, else at its end;
    // an item with one sub-item or none keeps an empty, hidden one.
    function drawTabs(only) {
      if (!list || !key || !o.subs) return;
      for (const r of list.querySelectorAll(`[data-${key}]`)) {
        const id = r.getAttribute('data-' + key);
        if (only != null && id !== String(only)) continue;
        const mine = cards.filter(c => String(c.id) === id && c.n > 1);
        const box = document.createElement('span');
        box.dataset.lsTabs = '';
        if (mine.length) {
          box.className = C.tabs;
          box.setAttribute('role', 'tablist');
          box.setAttribute('aria-label', cap(subNoun) + 's');
          box.innerHTML = mine.map(c => {
            const t = tabOf(c);
            return `<button type="button" role="tab" tabindex="-1" data-ls-sub="${esc(String(c.sub))}" aria-selected="false"`
              + ` class="${C.tab}${t.cls ? ' ' + esc(t.cls) : ''}" aria-label="${esc(t.aria)}">${esc(String(t.label))}</button>`;
          }).join('');
        } else box.hidden = true;
        const old = r.querySelector('[data-ls-tabs]');
        if (old) old.replaceWith(box); else r.append(box);
      }
    }
    // Every move the strip did not make itself (the start, a pick in the list, a
    // track that changed width) means "be on this card", so it is instant.
    const jump = () => requestAnimationFrame(() => {
      if (!core) return;
      core.go(at, 'instant');
      core.build(at - 1); core.build(at); core.build(at + 1);
    });

    // A row's attribute is a string and a host's id may not be, so ids are
    // matched as strings and the host is handed its own value back. A sub-item
    // the item lacks, or none, is its first card.
    const indexOf = (id, sub) => {
      let first = -1;
      for (let i = 0; i < cards.length; i++) {
        if (String(cards[i].id) !== String(id)) continue;
        if (sub == null || String(cards[i].sub) === String(sub)) return i;
        if (first < 0) first = i;
      }
      return first;
    };

    function pick(id, via = 'api', sub) {
      const i = indexOf(id, sub);
      if (i < 0) return;
      at = i;
      const c = cards[i];
      if (o.onPick) o.onPick(c.id, via, c.sub);
      markAt();
      paint();
      if (via === 'swipe') return;
      if (core) jump(); else still();
    }

    function mount() {
      cards = cardsOf();
      at = Math.max(0, indexOf(o.sel(), o.selSub && o.selSub()));
      drawTabs();
      paint();
      markAt();
      if (!kit || !cards.length) { core = null; still(); return; }
      core = kit.core(cards.length, (i, slide) => draw(cards[i], slide), {
        innerClass: o.innerClass || 'w-full', slidePad: o.slidePad || C.pad, keys: card,
        release: o.release, slideScroll: o.slideScroll,
        ...(o.places && o.subs ? { card: i => String(cards[i].id), start: at } : {}),
      });
      // A change reported while the strip is not the width it settled at is the
      // track re-snapping under a resize, not a swipe: back to the card it was on.
      core.onSlide(i => {
        if (i === at) return;
        if (w && bodyEl.clientWidth !== w) { jump(); return; }
        pick(cards[i].id, 'swipe', cards[i].sub);
      });
      bodyEl.className = C.bodySwiping;
      bodyEl.replaceChildren(core.track);
      jump();
    }

    // For a host that keeps the selection itself: be on this row, mark it, and
    // say nothing back.
    function show(id, sub) {
      const i = indexOf(id, sub);
      if (i < 0) return;
      at = i;
      markAt();
      paint();
      if (core) jump(); else still();
    }

    function step(d) {
      const to = Math.max(0, Math.min(cards.length - 1, at + d));
      if (core) { core.go(to, 'smooth'); return; }
      if (to !== at) pick(cards[to].id, 'step', cards[to].sub);
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
      const focusable = el => !!el && (el.tabIndex >= 0 || /^(A|BUTTON)$/.test(el.tagName));
      const first = list.querySelector(`[data-${key}]`);
      if (!list.hasAttribute('tabindex') && !(first && (first.hasAttribute('tabindex') || /^(A|BUTTON)$/.test(first.tagName)))) list.tabIndex = 0;
      list.style.outlineOffset = '-2px';
      const rowFor = id => [...list.querySelectorAll(`[data-${key}]`)].find(r => r.getAttribute('data-' + key) === String(id));
      // What was tapped takes focus (Safari does not give it to a tapped
      // button), so the arrow keys work after a tap as after a Tab.
      // A row showing tabs gives focus to its open one.
      const take = r => {
        const el = (r && r.querySelector('[data-ls-sub][aria-selected="true"]')) || r;
        const t = focusable(el) ? el : list;
        if (focusable(t) && t.focus) t.focus({ preventScroll: true });
      };
      const subAt = (e, r) => { const t = e.target.closest && e.target.closest('[data-ls-sub]'); return t && r.contains(t) ? t.getAttribute('data-ls-sub') : undefined; };
      const onClick = e => {
        if (e.defaultPrevented) return;
        const r = rowOf(e);
        if (r) { pick(r.getAttribute('data-' + key), 'list', subAt(e, r)); take(r); }
      };
      const onKey = e => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable)) return;
        const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        if (d) {
          e.preventDefault();
          const to = Math.max(0, Math.min(cards.length - 1, at + d));
          if (!cards.length || to === at) return;
          const onRow = !!rowOf(e), c = cards[to];
          pick(c.id, 'list', c.sub);
          if (onRow) take(rowFor(c.id));
          return;
        }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const r = rowOf(e); if (!r) return;
        e.preventDefault(); pick(r.getAttribute('data-' + key), 'list', subAt(e, r));
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
    // The first mark runs before the icon font has set the rows' heights, and
    // the rows above a selection then grow under it, pushing a row a link
    // picked out of a capped list's view. Mark again once the fonts are in.
    if (list && key && document.fonts) document.fonts.ready.then(markAt);

    return {
      pick: (id, via = 'api', sub) => pick(id, via, sub),
      show,
      mount,
      paint,
      step,
      tabs(id) { drawTabs(id); markAt(); },
      slides: () => cards.map(c => ({ ...c })),
      destroy() {
        offs.forEach(f => f());
        if (split) split.destroy();
        if (seamEl) seamEl.remove();
      },
    };
  }

  window.linkedSwiper = { attach, head, mark };
})();
