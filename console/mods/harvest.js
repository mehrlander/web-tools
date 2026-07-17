// console/mods/harvest.js — sweep a virtualized or lazy list. Virtualized
// grids keep only the visible rows in the DOM, so any one-shot grab is
// partial; harvest scrolls, waits, re-collects, and accumulates *records*
// (text/html snapshots that survive element destruction) until the page runs
// dry. Requires console/base.js (glom, ea).
//
//   await glom.harvest()                      match via the set's tag-path fingerprint
//   await glom.harvest({selector: '.row'})    explicit matcher (glom.infer() output fits)
//   await glom.harvest({scroll, settle, dry}) custom scroller / wait ms / dry rounds
//
// Returns [{key, text, html, el}] — el is the last-seen node and may be dead
// by the time you look. Records dedupe by fingerprint + text, so identical
// repeated rows collapse to one.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/harvest: base.js + mods/core.js must load first');
  const { SCOPE, clean, upath, sweep } = g.core;

  g.harvest = async ({ selector, scroll, settle = 350, dry = 3, max = 200 } = {}) => {
    let match;
    if (selector) match = () => [...document.querySelectorAll(selector)];
    else {
      const seed = g.get();
      if (!seed.length) { console.warn('harvest: empty set and no selector'); return []; }
      const keys = new Set(seed.map(upath));
      match = () => ea(SCOPE).filter(n => keys.has(upath(n)));
    }

    const seen = new Map();
    const collect = () => {
      let fresh = 0;
      for (const el of match()) {
        const text = clean(el.textContent), key = `${upath(el)}|${text}`;
        if (!seen.has(key)) { seen.set(key, { key, text, html: el.outerHTML, el }); fresh++; }
      }
      return fresh;
    };

    const { rounds, hitMax } = await sweep(collect, { scroll, settle, dry, max });
    const out = [...seen.values()];
    console.log(`harvest: ${out.length} records in ${rounds} scrolls${hitMax ? ' (hit max — raise {max})' : ''}`);
    return out;
  };
})();
