// console/mods/join.js — relational joins over element sets: the spreadsheet
// move that turns label/value scraping into one line. Requires base.js +
// mods/core.js; composes with mods/sets.js (named sets via glom.peek).
//
//   glom.join('labels', 'inputs', 'left-of')   each label paired with the
//                                              input it sits left of
//   glom.join(elsA, 'rows', 'inside')          arrays and names mix freely
//   glom.join(a, b, (x, y) => …)               custom predicate
//
// Relations (a REL b): inside, contains (structural); left-of, right-of,
// above, below, same-row, same-col, near (geometric — real layout only,
// jsdom boxes are all 0×0). When several b's qualify, the nearest by center
// distance wins. Returns [{a, b, aText, bText}]; unmatched a's are dropped
// and counted in the log.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/join: base.js + mods/core.js must load first');
  const { clean } = g.core;

  const R = n => n.getBoundingClientRect();
  const overlapV = (a, b) => a.top < b.bottom && b.top < a.bottom;
  const overlapH = (a, b) => a.left < b.right && b.left < a.right;
  const dist = (a, b) => Math.hypot((a.left + a.right) / 2 - (b.left + b.right) / 2,
                                    (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
  const RELS = {
    inside:     (a, b) => b.contains(a) && a !== b,
    contains:   (a, b) => a.contains(b) && a !== b,
    'left-of':  (a, b) => { const ra = R(a), rb = R(b); return ra.right <= rb.left + 1 && overlapV(ra, rb); },
    'right-of': (a, b) => { const ra = R(a), rb = R(b); return rb.right <= ra.left + 1 && overlapV(ra, rb); },
    above:      (a, b) => { const ra = R(a), rb = R(b); return ra.bottom <= rb.top + 1 && overlapH(ra, rb); },
    below:      (a, b) => { const ra = R(a), rb = R(b); return rb.bottom <= ra.top + 1 && overlapH(ra, rb); },
    'same-row': (a, b) => a !== b && overlapV(R(a), R(b)),
    'same-col': (a, b) => a !== b && overlapH(R(a), R(b)),
    near:       (a, b, px = 100) => a !== b && dist(R(a), R(b)) <= px,
  };

  const resolve = v => typeof v === 'string'
    ? (g.peek ? g.peek(v) : (console.warn('join: named sets need mods/sets.js'), []))
    : [...v].filter(n => n instanceof Element);

  g.join = (a, b, rel = 'inside') => {
    const A = resolve(a), B = resolve(b);
    if (!A.length || !B.length) { console.warn(`join: empty side (a: ${A.length}, b: ${B.length})`); return []; }
    const pred = typeof rel === 'function' ? rel : RELS[rel];
    if (!pred) { console.warn(`join: unknown relation "${rel}" — ${Object.keys(RELS).join(', ')}, or a function`); return []; }

    const pairs = [];
    let unmatched = 0;
    for (const x of A) {
      const hits = B.filter(y => pred(x, y));
      if (!hits.length) { unmatched++; continue; }
      const y = hits.length === 1 ? hits[0]
        : hits.reduce((best, cur) => dist(R(cur), R(x)) < dist(R(best), R(x)) ? cur : best);
      pairs.push({ a: x, b: y, aText: clean(x.textContent).slice(0, 60), bText: clean(y.textContent).slice(0, 60) });
    }
    console.table(pairs.map(({ aText, bText }, i) => ({ i, aText, bText })));
    console.log(`join: ${pairs.length} pairs${unmatched ? `, ${unmatched} unmatched` : ''}`);
    return pairs;
  };
})();
