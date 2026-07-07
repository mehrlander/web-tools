// console/mods/census.js — ping the page's shape: find and rank the
// repeating structures, mark each in its own hue, and offer handles to grab
// them. Orientation without reading any HTML. Requires console/base.js
// (ea, glom, mark, unionArea).
//
//   census()            top 10 groups (count ≥ 3), marked + console.table
//   census(25, {min:2, mark:false})
//   census.grab(i)      adopt group i as the glom working set
//   census.clear()      remove census marks
//
// Groups by unindexed tag path (html/body/table/tbody/tr). geoReg is
// summary()'s kernel: union area over bounding box — near 1 means the group
// tiles its region like a grid or list; near 0 means scattered or overlapped.
(() => {
  if (!window.ea || !window.glom?.core) return console.warn('mods/census: base.js + mods/core.js must load first');
  const { SCOPE, HUES, clean, upath } = window.glom.core;
  let groups = [];

  const census = (top = 10, { min = 3, mark: doMark = true } = {}) => {
    census.clear();
    const byKey = new Map();
    for (const n of ea(SCOPE)) {
      const k = upath(n);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(n);
    }
    groups = [...byKey.entries()]
      .filter(([, els]) => els.length >= min)
      .map(([path, els]) => {
        const rects = els.map(n => n.getBoundingClientRect());
        const u = window.unionArea(rects);
        const bb = (Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left))) *
                   (Math.max(...rects.map(r => r.bottom)) - Math.min(...rects.map(r => r.top)));
        const avgLen = Math.round(els.reduce((a, n) => a + clean(n.textContent).length, 0) / els.length);
        return { path, count: els.length, geoReg: +(u / (bb || 1)).toFixed(3), avgLen, els };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
    if (doMark) groups.forEach((grp, i) => window.mark(grp.els, `outline-${HUES[i % HUES.length]}-2`, `data-census-${i}`));
    console.table(groups.map(({ els, ...row }, i) => ({ i, ...row })));
    console.log('census: census.grab(i) adopts a group; census.clear() unmarks');
    return groups;
  };

  census.grab = i => groups[i] ? window.glom(groups[i].els) : (console.warn(`census: no group ${i} — run census() first`), []);
  census.clear = () => {
    for (let i = 0; ; i++) {
      const style = document.getElementById(`mark-s-data-census-${i}`);
      const els = document.querySelectorAll(`[data-census-${i}]`);
      if (!style && !els.length) break;
      style?.remove();
      els.forEach(n => n.removeAttribute(`data-census-${i}`));
    }
    groups = [];
  };
  window.census = census;
})();
