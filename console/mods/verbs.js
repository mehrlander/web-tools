// console/mods/verbs.js — set-wise navigation for the glom working set.
// Requires console/base.js (glom). The set moves in lockstep: every member
// takes the same step, members whose step lands nowhere drop out, and
// glom.set dedupes and renumbers. The set stops being a bag and becomes a
// cursor over N parallel subtrees.
//
//   glom.up()            parent of each member
//   glom.up(2)           grandparent
//   glom.up('tr')        closest 'tr' ancestor (excludes self)
//   glom.up(pred)        nearest ancestor passing pred
//   glom.down('a')       first 'a' descendant per member (keeps cardinality)
//   glom.downAll('a')    every 'a' descendant, unioned
//   glom.over()          next element sibling
//   glom.over(-2)        two siblings back
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/verbs: base.js + mods/core.js must load first');
  const { upStep, overStep } = g.core;

  const move = (name, p, stepped) => {
    const r = g.set(stepped.filter(Boolean));
    console.log(`${name}: ${p.length} → ${r.length}`);
    return r;
  };

  g.up      = (arg)   => { const p = g.get(); return move('up',      p, p.map(n => upStep(n, arg))); };
  g.over    = (k = 1) => { const p = g.get(); return move('over',    p, p.map(n => overStep(n, k))); };
  g.down    = (sel)   => { const p = g.get(); return move('down',    p, p.map(n => n.querySelector(sel))); };
  g.downAll = (sel)   => { const p = g.get(); return move('downAll', p, p.flatMap(n => [...n.querySelectorAll(sel)])); };
})();
