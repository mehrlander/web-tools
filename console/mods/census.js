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
  const { SCOPE, clean, upath, groupLayer } = window.glom.core;
  const layer = groupLayer('census');

  const census = (top = 10, { min = 3, mark: doMark = true } = {}) => {
    layer.clear();
    const byKey = new Map();
    for (const n of ea(SCOPE)) {
      const k = upath(n);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(n);
    }
    const groups = [...byKey.entries()]
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
    layer.mark(groups, doMark);
    console.table(groups.map(({ els, ...row }, i) => ({ i, ...row })));
    console.log('census: census.grab(i) adopts a group; census.clear() unmarks');
    return groups;
  };

  census.grab = layer.grab;
  census.clear = layer.clear;
  window.census = census;
})();
