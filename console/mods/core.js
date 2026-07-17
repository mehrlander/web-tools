// console/mods/core.js — shared kernels and the set event bus. Loads first;
// every other glom mod requires base.js + this one (tap stays standalone).
//
//   glom.core   { SCOPE, HUES, clean, own, upath, docOrder, upStep, overStep }
//               the helpers the mods used to each carry a private copy of
//   glom.onSet  subscriber list: every fn(els) runs after glom.set — and
//               everything funnels through set (verbs, pick, grow, lasso,
//               undo), so this is the suite's event bus. Subscribe instead
//               of monkey-patching set; deck and recipe do.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/core: console/base.js must load first');

  const clean = s => s.trim().replace(/\s+/g, ' ');
  const HUES = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#dc2626', '#4f46e5'];
  g.core = {
    SCOPE: 'body *:not(script):not(style)',
    HUES,
    clean,
    own: n => clean([...n.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('')),
    upath: n => {
      const p = [];
      for (let c = n; c && c.nodeType === 1; c = c.parentElement) p.unshift(c.tagName.toLowerCase());
      return p.join('/');
    },
    docOrder: els => [...new Set(els)].sort((a, b) =>
      a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1),
    upStep: (n, arg) => {
      if (typeof arg === 'string') return n.parentElement?.closest(arg) ?? null;
      if (typeof arg === 'function') { let c = n.parentElement; while (c && !arg(c)) c = c.parentElement; return c; }
      let c = n; for (let k = arg ?? 1; k > 0 && c; k--) c = c.parentElement;
      return c;
    },
    overStep: (n, k) => {
      let c = n;
      while (c && k > 0) { c = c.nextElementSibling; k--; }
      while (c && k < 0) { c = c.previousElementSibling; k++; }
      return c;
    },
    // Scroll-until-dry: run round() (which returns how many new items it saw),
    // then scroll + settle + round() until `dry` consecutive rounds surface
    // nothing or `max` rounds pass. harvest sweeps into memory, scan.sweep into
    // a store; both drive this one loop. Returns { total, rounds, hitMax }.
    sweep: async (round, { scroll, settle = 350, dry = 3, max = 200 } = {}) => {
      const step = scroll ?? (() => window.scrollBy(0, window.innerHeight));
      const wait = ms => new Promise(r => setTimeout(r, ms));
      let total = await round(), drought = 0, rounds = 0;
      while (drought < dry && rounds < max) {
        rounds++;
        step();
        await wait(settle);
        const n = await round();
        total += n;
        drought = n ? 0 : drought + 1;
      }
      return { total, rounds, hitMax: rounds >= max };
    },
    // Debounced DOM-churn subscription: fire cb() `settle` ms after mutations
    // quiesce, and return a stop fn. The suite's SPA-fragility primitive —
    // watch heals the set on churn, scan captures on it.
    onChurn: (cb, settle = 250) => {
      let timer;
      const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(cb, settle); });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => { mo.disconnect(); clearTimeout(timer); };
    },
    // A hued group layer for the rank-and-mark mods (census, templates): mark N
    // groups each in its own hue under data-<prefix>-<i>, grab group i into the
    // working set, and clear the marks. Owns the group list, so the two mods
    // stop each carrying their own verbatim grab/clear/mark copy.
    groupLayer: prefix => {
      let groups = [];
      const attr = i => `data-${prefix}-${i}`;
      return {
        mark(gs, on = true) {
          groups = gs;
          if (on) groups.forEach((grp, i) => window.mark(grp.els, HUES[i % HUES.length], attr(i)));
          return groups;
        },
        grab: i => groups[i] ? window.glom(groups[i].els) : (console.warn(`${prefix}: no group ${i} — run it first`), []),
        clear() {
          for (let i = 0; ; i++) {
            const style = document.getElementById(`mark-s-${attr(i)}`);
            const els = document.querySelectorAll(`[${attr(i)}]`);
            if (!style && !els.length) break;
            style?.remove();
            els.forEach(n => n.removeAttribute(attr(i)));
          }
          groups = [];
        },
      };
    },
  };

  g.onSet = [];
  const origSet = g.set;
  g.set = els => {
    const r = origSet(els);
    for (const fn of g.onSet) { try { fn(r); } catch (e) { console.warn('glom.onSet subscriber failed:', e); } }
    return r;
  };
})();
