// mark-pad.js — a pair of arrows that step through the marks of the document
// in view, as a keyboard's arrow keys step through a list, with the mark in
// view counted on a disc between them.
//
// A page whose document carries marks (a focus passage, a caption, the
// citations in an opinion, the changes in a diff) mounts the pad and hands it
// two things: the marks, in document order, and its own way of going to one.
// Down goes to the next mark and up to the previous, the page scrolls there
// and rings it, and the disc between the arrows reads `n/m`. The pad floats
// over the FAB, in the FAB's own manner (round, floating, shadowed,
// translucent), and it is the PAGE's, so it works wherever the page does, a
// toss frame included, where the FAB on screen belongs to the renderer.
//
//   MarkPad.mount(o) -> { refresh(), step(d), set(i), destroy(), el, at }
//     o.items()       the marks to step through now, in document order, each
//                     { label }, where label names it as the reader should
//                     hear it ("focus 1 of 2", "citation 14 of 110"): the
//                     disc's spoken name and its tip. Read on every refresh,
//                     so the page can change them freely
//     o.go(i, item)   the page's move to mark i: scroll there and ring it
//     o.scope()       optional: a value naming what the marks belong to (the
//                     piece open, the kind of mark chosen). When it changes,
//                     the pad starts again from no mark in view
//     o.idle(n)       optional: the disc's spoken name before any step;
//                     "n marks" otherwise
//     o.kinds()       optional: [{ key, label, icon }], the kinds a reader may
//                     step through, when there are several. The disc then
//                     carries the kind's icon, and a tap on it chooses the
//                     next kind through o.choose(key); o.kind() names the one
//                     in force. Without kinds the disc carries a bookmark
//     o.at            optional: a name, so each control carries data-at
//                     ("<at>-up", "<at>-disc", "<at>-down") for a look link
//
//   set(i) places the pad on mark i without going there, for a page whose
//   reader reached a mark another way (a tap on the mark itself), so the next
//   arrow goes on from where they are rather than from where the pad was.
//
// HIDDEN WHEN THERE IS NOTHING TO STEP THROUGH: no items, no pad. A page that
// offers marks only on some views calls refresh() as the view changes. Each
// change between shown and hidden is announced as a `mark-pad` event,
// { detail: { shown } }, on this window and on the one framing it, so a
// control sharing the corner can make way (lib/alpineComponents/fab.js
// tucks itself away; the room it leaves is --mark-pad-bottom, which the pad
// stands on when it is set).
//
// The arrows are the arrow keys, not a scrollbar: down from no mark is the
// first, up from no mark is the last, and each end holds. Before a step the
// disc reads `–/m`: the count, with no mark yet in view. Framework-free; the
// page owns the marks and the moves, and the pad owns only where it is.
//
// Attaches to window.MarkPad.
(() => {
  if (window.MarkPad) return;

  const FACE = 'rounded-full border border-base-300 bg-base-100/80 backdrop-blur-sm shadow-lg '
    + 'flex items-center justify-center text-base-content cursor-pointer disabled:cursor-default ';
  const ROUND = FACE + 'size-11 transition-opacity hover:bg-base-200/90 disabled:opacity-40';
  const DISC = FACE + 'size-14 flex-col tabular-nums';

  function mount(o = {}) {
    const items = () => { try { return o.items() || []; } catch (e) { return []; } };
    let at = -1, scope, shown = null;

    // OVER THE FAB, in the column its 56px disc stands in, centred on it and
    // a gap above it, or where --mark-pad-bottom puts it once the FAB has
    // tucked itself into the corner. Not beside it: a look link's dock spans
    // the bottom of a phone short of exactly that column (lib/kits/look.js
    // keeps the launcher clear), so a pad beside the FAB lay under the dock,
    // and a walkthrough's own "tap the down arrow" could not be done.
    const el = document.createElement('div');
    el.dataset.markPad = '';
    el.className = 'fixed z-[71] right-6 bottom-[var(--mark-pad-bottom,calc(var(--fab-bottom,1.5rem)+3.5rem+0.75rem))] '
      + 'flex flex-col items-center gap-2 transition-[bottom] duration-200';
    el.hidden = true;
    const name = (part) => (o.at ? ` data-at="${o.at}-${part}"` : '');
    el.innerHTML = `<button type="button" data-mark-pad="up"${name('up')} class="${ROUND}" aria-label="Previous mark" data-title-tip="Previous mark"><i class="ph ph-caret-up text-xl"></i></button>`
      + `<button type="button" data-mark-pad="disc"${name('disc')} class="${DISC}"><i class="ph ph-bookmark-simple text-lg leading-5"></i>`
      + `<span class="text-xs leading-4 font-medium"></span></button>`
      + `<button type="button" data-mark-pad="down"${name('down')} class="${ROUND}" aria-label="Next mark" data-title-tip="Next mark"><i class="ph ph-caret-down text-xl"></i></button>`;
    document.body.append(el);
    const $ = (k) => el.querySelector(`[data-mark-pad="${k}"]`);

    function announce() {
      if (shown === !el.hidden) return;
      shown = !el.hidden;
      for (const w of new Set([window, window.parent])) {
        try { if (w && w.dispatchEvent) w.dispatchEvent(new CustomEvent('mark-pad', { detail: { shown } })); } catch (e) { /* a frame we may not reach */ }
      }
    }
    function kinds() { try { return (o.kinds && o.kinds()) || []; } catch (e) { return []; } }
    function refresh() {
      const now = o.scope ? o.scope() : undefined;
      if (now !== scope) { scope = now; at = -1; }
      const list = items(), n = list.length;
      el.hidden = !n;
      announce();
      if (!n) return;
      if (at >= n) at = n - 1;
      $('up').disabled = at === 0;
      $('down').disabled = at === n - 1;
      const ks = kinds(), k = ks.find((x) => x.key === (o.kind && o.kind())) || null;
      const disc = $('disc');
      disc.querySelector('span').textContent = `${at >= 0 ? at + 1 : '–'}/${n}`;
      disc.querySelector('i').className = 'ph text-lg leading-5 ' + (k && k.icon ? k.icon : 'ph-bookmark-simple');
      const said = at >= 0 ? list[at].label : (o.idle ? o.idle(n) : `${n} marks`);
      // The disc is a control only where there is a kind to change to.
      const next = ks.length > 1 && k ? ks[(ks.indexOf(k) + 1) % ks.length] : null;
      disc.disabled = !next;
      disc.setAttribute('aria-label', next ? `${said}. Step through ${next.label} instead` : said);
      disc.dataset.titleTip = next ? `${said}. Tap to step through ${next.label} instead` : said;
    }
    function step(d) {
      const list = items(), n = list.length;
      if (!n) return;
      const to = at < 0 ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, at + d));
      at = to;
      refresh();
      try { o.go(to, list[to]); } catch (e) { console.warn('[mark-pad] go failed', e); }
    }
    function set(i) {
      const n = items().length;
      if (!n || !(i >= 0 && i < n)) return;
      at = i;
      refresh();
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mark-pad]');
      if (!b || b.disabled) return;
      const k = b.dataset.markPad;
      if (k === 'up') step(-1);
      else if (k === 'down') step(1);
      else if (k === 'disc') {
        const ks = kinds(), cur = ks.findIndex((x) => x.key === (o.kind && o.kind()));
        if (ks.length > 1 && o.choose) { o.choose(ks[(cur + 1) % ks.length].key); refresh(); }
      }
    });
    refresh();
    return {
      el, refresh, step, set,
      destroy: () => { el.hidden = true; announce(); el.remove(); },
      get at() { return at; },
    };
  }

  window.MarkPad = { mount };
})();
