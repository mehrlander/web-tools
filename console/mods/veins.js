// console/mods/veins.js — vein-to-skin matching: join captured API payloads
// (the vein) to the rendered page (the skin). Flattens JSON to leaf fields,
// matches leaf values against elements' own text, and reports which fields
// actually feed the screen — so you learn "the column I'm scraping is
// bills[].status" and can stop scraping the DOM for that site. Requires
// console/base.js (glom, ea); pairs with mods/tap.js (uses tap.hits when no
// data is passed).
//
//   glom.veins()          join every tap.hits payload against the working set
//                         (or the whole page if the set is empty)
//   glom.veins(data)      join an explicit object/array instead
//   glom.veins.grab(i)    adopt field i's matched elements as the working set
//
// Fields rank by coverage (distinct values matched / distinct values seen):
// a field whose every value lands somewhere on screen is a confirmed vein.
// Matching is exact on whitespace-cleaned own text, with a containment
// fallback for values of 4+ characters.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/veins: console/base.js must load first');
  const SCOPE = 'body *:not(script):not(style)';
  const clean = s => s.trim().replace(/\s+/g, ' ');
  const own = n => clean([...n.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join(''));

  const flatten = (data, base = '', out = []) => {
    if (data == null) return out;
    if (Array.isArray(data)) { for (const v of data) flatten(v, base + '[]', out); return out; }
    if (typeof data === 'object') { for (const [k, v] of Object.entries(data)) flatten(v, base ? `${base}.${k}` : k, out); return out; }
    out.push({ field: base || '.', value: clean(String(data)) });
    return out;
  };

  let fields = [];
  g.veins = data => {
    const sources = data !== undefined ? [data] : (window.tap?.hits ?? []).map(h => h.data);
    if (!sources.length) { console.warn('veins: nothing to join — arm tap() first, or pass data'); return []; }
    const leaves = sources.flatMap(d => flatten(d));

    const els = g.get().length ? g.get() : ea(SCOPE);
    const byText = new Map();
    for (const n of els) {
      const t = own(n);
      if (!t) continue;
      if (!byText.has(t)) byText.set(t, []);
      byText.get(t).push(n);
    }

    const agg = new Map();
    for (const { field, value } of leaves) {
      if (!agg.has(field)) agg.set(field, { field, seen: new Set(), hit: new Set(), els: new Set() });
      const a = agg.get(field);
      a.seen.add(value);
      if (value.length < 2) continue;
      const exact = byText.get(value);
      if (exact) { a.hit.add(value); exact.forEach(n => a.els.add(n)); continue; }
      if (value.length >= 4) {
        for (const [t, ns] of byText) if (t.includes(value)) { a.hit.add(value); ns.forEach(n => a.els.add(n)); }
      }
    }

    fields = [...agg.values()]
      .filter(a => a.hit.size)
      .map(a => ({ field: a.field, coverage: `${a.hit.size}/${a.seen.size}`, ratio: a.hit.size / a.seen.size, count: a.els.size, sample: [...a.hit][0], els: [...a.els] }))
      .sort((a, b) => b.ratio - a.ratio || b.count - a.count);
    console.table(fields.map(({ els, ratio, ...row }, i) => ({ i, ...row })));
    console.log('veins: glom.veins.grab(i) adopts a field’s elements');
    return fields;
  };
  g.veins.grab = i => fields[i] ? g(fields[i].els) : (console.warn(`veins: no field ${i} — run glom.veins() first`), []);
})();
