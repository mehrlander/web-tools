// console/mods/grow.js — by-example expansion of the working set.
// Requires console/base.js (glom, ea).
//
//   glom.grow()                expand current members to everything alike
//   glom.grow({classes: false})  match on tag-path alone
//   glom.grow({by: 'style'})   match on computed style (looks-alike; real
//                              layout only — jsdom styles are uniform)
//   glom.alike(el)             fresh set from one example element
//
// Fingerprint: the unindexed tag path from the root (html/body/table/tbody/tr)
// plus, when a path has two or more examples, the classes those examples
// share. Two examples define what "alike" means far better than one (the
// SelectorGadget insight): shared classes survive the intersection, hashy
// per-instance classes (css-1a2b3c) wash out. A single example can't say
// which of its classes matter, so it matches on structure alone.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/grow: base.js + mods/core.js must load first');
  const { SCOPE, upath } = g.core;

  // Style fingerprint: "these LOOK like list items" — finds families in
  // class-less div soup where tag paths and classes both fail. Real layout
  // only (computed styles are uniform under jsdom).
  const styleKey = n => {
    const cs = getComputedStyle(n);
    return [n.tagName, cs.display, cs.fontSize, cs.fontWeight, cs.color, cs.backgroundColor, cs.textAlign].join('|');
  };

  const expand = (members, { classes = true, by = 'structure' } = {}) => {
    if (!members.length) { console.warn('grow: empty set — glom or pick something first'); return []; }
    if (by === 'style') {
      const keys = new Set(members.map(styleKey));
      return ea(SCOPE).filter(n => keys.has(styleKey(n)));
    }
    const req = new Map();   // upath → { classes: Set (intersection), count }
    for (const n of members) {
      const key = upath(n), r = req.get(key);
      if (!r) req.set(key, { classes: new Set(n.classList), count: 1 });
      else { r.count++; for (const c of r.classes) if (!n.classList.contains(c)) r.classes.delete(c); }
    }
    if (classes && [...req.values()].every(r => r.count < 2))
      console.log('grow: single example — matching structure alone; pick two for class-aware growth');
    return ea(SCOPE).filter(n => {
      const r = req.get(upath(n));
      if (!r) return false;
      if (!classes || r.count < 2) return true;
      return [...r.classes].every(c => n.classList.contains(c));
    });
  };

  g.grow = opts => {
    const p = g.get();
    const r = g.set([...new Set([...p, ...expand(p, opts)])]);
    console.log(`grow: ${p.length} → ${r.length}`);
    return r;
  };
  g.alike = (el, opts) => g.set(expand([el].filter(n => n instanceof Element), opts));
})();
