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
  g.core = {
    SCOPE: 'body *:not(script):not(style)',
    HUES: ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#dc2626', '#4f46e5'],
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
  };

  g.onSet = [];
  const origSet = g.set;
  g.set = els => {
    const r = origSet(els);
    for (const fn of g.onSet) { try { fn(r); } catch (e) { console.warn('glom.onSet subscriber failed:', e); } }
    return r;
  };
})();
