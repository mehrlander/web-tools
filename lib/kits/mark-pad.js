// mark-pad.js — a pair of arrows that step through the marks of the document
// in view, as a keyboard's arrow keys step through a list.
//
// A page whose document carries marks (a focus passage, a caption, the
// citations in an opinion, the changes in a diff) mounts the pad and hands it
// two things: the marks, in document order, and its own way of going to one.
// Down goes to the next mark and up to the previous, the page scrolls there
// and rings it, and a small label names the mark in view. The pad floats beside
// the FAB, in the FAB's own manner (round, floating, shadowed, translucent),
// and it is the PAGE's, so it works wherever the page does, a toss frame
// included, where the FAB on screen belongs to the renderer and runs main.
//
//   MarkPad.mount(o) -> { refresh(), step(d), destroy(), el }
//     o.items()       the marks to step through now, in document order, each
//                     { label }, where label names it as the reader should read
//                     it ("focus 1 of 2", "citation 14 of 110"). Read on every
//                     refresh, so the page can change them freely
//     o.go(i, item)   the page's move to mark i: scroll there and ring it
//     o.scope()       optional: a value naming what the marks belong to (the
//                     piece open, the kind of mark chosen). When it changes,
//                     the pad starts again from no mark in view
//     o.idle(n)       optional: the label before any step; "n marks" otherwise
//     o.kinds()       optional: [{ key, label, icon }], the kinds a reader may
//                     step through, when there are several. The label then
//                     carries the kind's icon, and a tap on it chooses the
//                     next kind through o.choose(key); o.kind() names the one
//                     in force
//     o.at            optional: a name, so each control carries data-at
//                     ("<at>-up", "<at>-down", "<at>-label") for a look link
//
// HIDDEN WHEN THERE IS NOTHING TO STEP THROUGH: no items, no pad. A page that
// offers marks only on some views calls refresh() as the view changes.
//
// The arrows are the arrow keys, not a scrollbar: down from no mark is the
// first, up from no mark is the last, and each end holds. Framework-free; the
// page owns the marks and the moves, and the pad owns only where it is.
//
// Attaches to window.MarkPad.
(() => {
  if (window.MarkPad) return;

  const ROUND = 'size-11 rounded-full border border-base-300 bg-base-100/80 backdrop-blur-sm shadow-lg '
    + 'flex items-center justify-center text-base-content transition-opacity hover:bg-base-200/90 '
    + 'disabled:opacity-40 disabled:cursor-default cursor-pointer';
  const PILL = 'h-8 max-w-48 rounded-full border border-base-300 bg-base-100/80 backdrop-blur-sm shadow-lg '
    + 'px-3 flex items-center gap-1.5 text-sm font-medium tabular-nums whitespace-nowrap text-base-content';

  function mount(o = {}) {
    const items = () => { try { return o.items() || []; } catch (e) { return []; } };
    let at = -1, scope;

    // Beside the FAB: its right margin, its width and a gap, at its bottom.
    const el = document.createElement('div');
    el.dataset.markPad = '';
    el.className = 'fixed z-[71] right-[calc(1.5rem+3.5rem+0.75rem)] bottom-[var(--fab-bottom,1.5rem)] flex items-center gap-2';
    el.hidden = true;
    const name = (part) => (o.at ? ` data-at="${o.at}-${part}"` : '');
    el.innerHTML = `<button type="button" data-mark-pad="label"${name('label')} class="${PILL}"><i class="ph text-base hidden"></i><span></span></button>`
      + `<div class="flex flex-col gap-2">`
      + `<button type="button" data-mark-pad="up"${name('up')} class="${ROUND}" aria-label="Previous mark" data-title-tip="Previous mark"><i class="ph ph-caret-up text-xl"></i></button>`
      + `<button type="button" data-mark-pad="down"${name('down')} class="${ROUND}" aria-label="Next mark" data-title-tip="Next mark"><i class="ph ph-caret-down text-xl"></i></button>`
      + `</div>`;
    document.body.append(el);
    const $ = (k) => el.querySelector(`[data-mark-pad="${k}"]`);

    function kinds() { try { return (o.kinds && o.kinds()) || []; } catch (e) { return []; } }
    function refresh() {
      const now = o.scope ? o.scope() : undefined;
      if (now !== scope) { scope = now; at = -1; }
      const list = items(), n = list.length;
      el.hidden = !n;
      if (!n) return;
      if (at >= n) at = n - 1;
      $('up').disabled = at === 0;
      $('down').disabled = at === n - 1;
      const ks = kinds(), k = ks.find((x) => x.key === (o.kind && o.kind())) || null;
      const label = at >= 0 ? list[at].label : (o.idle ? o.idle(n) : `${n} marks`);
      $('label').querySelector('span').textContent = label;
      const icon = $('label').querySelector('i');
      icon.className = 'ph text-base ' + (k && k.icon ? k.icon : 'hidden');
      // The label is a control only where there is a kind to change to.
      const next = ks.length > 1 && k ? ks[(ks.indexOf(k) + 1) % ks.length] : null;
      $('label').disabled = !next;
      $('label').setAttribute('aria-label', next ? `${label}. Step through ${next.label} instead` : label);
      if (next) $('label').dataset.titleTip = `Step through ${next.label} instead`;
      else delete $('label').dataset.titleTip;
    }
    function step(d) {
      const list = items(), n = list.length;
      if (!n) return;
      const to = at < 0 ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, at + d));
      at = to;
      refresh();
      try { o.go(to, list[to]); } catch (e) { console.warn('[mark-pad] go failed', e); }
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mark-pad]');
      if (!b || b.disabled) return;
      const k = b.dataset.markPad;
      if (k === 'up') step(-1);
      else if (k === 'down') step(1);
      else if (k === 'label') {
        const ks = kinds(), cur = ks.findIndex((x) => x.key === (o.kind && o.kind()));
        if (ks.length > 1 && o.choose) { o.choose(ks[(cur + 1) % ks.length].key); refresh(); }
      }
    });
    refresh();
    return { el, refresh, step, destroy: () => el.remove(), get at() { return at; } };
  }

  window.MarkPad = { mount };
})();
