// console/mods/pick.js — click-to-collect mode for the glom working set.
// Requires console/base.js (glom).
//
//   glom.pick()        arm the page: hover shows a dashed outline, click
//                      toggles membership (badges update live), Esc or
//                      glom.pick.done() finishes and reports the set.
//
// Picks are additive to the current working set; click a member again to
// remove it. Clicks are swallowed (capture phase, stopImmediatePropagation)
// so picking a link doesn't navigate.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/pick: console/base.js must load first');
  let finish = null;

  g.pick = () => {
    if (finish) return console.warn('pick: already active — Esc or glom.pick.done() to finish');
    const doc = document;
    const style = Object.assign(doc.createElement('style'), { id: 'glom-pick-style' });
    style.textContent = '[data-glom-hover]{outline:2px dashed #f59e0b !important; cursor:copy !important}';
    doc.head.append(style);

    let hover = null;
    const setHover = el => {
      hover?.removeAttribute('data-glom-hover');
      (hover = el)?.setAttribute('data-glom-hover', '');
    };
    const onMove = e => setHover(e.target instanceof Element && e.target !== doc.documentElement ? e.target : null);
    const onClick = e => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const cur = new Set(g.get());
      cur.has(el) ? cur.delete(el) : cur.add(el);
      g.set([...cur]);
      g.mark();
    };
    const onKey = e => { if (e.key === 'Escape') g.pick.done(); };

    doc.addEventListener('pointermove', onMove, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKey, true);
    finish = () => {
      doc.removeEventListener('pointermove', onMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKey, true);
      setHover(null);
      style.remove();
      finish = null;
      console.log(`pick: done — ${g.get().length} in set`);
      return g.get();
    };
    console.log('pick: click to toggle membership, Esc to finish');
  };

  g.pick.done = () => finish ? finish() : (console.warn('pick: not active'), g.get());
})();
