// console/mods/columns.js — derive a table from a repeating working set:
// pandas.read_html generalized to things that aren't <table>. Requires
// console/base.js (glom).
//
//   glom.columns()              one row object per member; console.table + return
//   glom.columns({all: true})   keep constant (boilerplate) columns too
//   packTable(glom.columns())   → columnar gzip+base64 on the clipboard
//
// For each member, leaf texts are collected keyed by the member-relative
// indexed tag path (td[2], div/span); links add an <path>@href column.
// Columns whose value never varies across members are boilerplate and drop
// (unless {all}); if nothing varies, everything is kept.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/columns: base.js + mods/core.js must load first');
  const { own } = g.core;

  const relPath = (n, root) => {
    const segs = [];
    for (let c = n; c && c !== root; c = c.parentElement) {
      let t = c.tagName.toLowerCase();
      const same = [...(c.parentElement?.children || [])].filter(x => x.tagName === c.tagName);
      if (same.length > 1) t += `[${same.indexOf(c) + 1}]`;
      segs.unshift(t);
    }
    return segs.join('/') || '.';
  };

  g.columns = ({ all = false } = {}) => {
    const members = g.get();
    if (!members.length) { console.warn('columns: empty set'); return []; }
    const rows = members.map(m => {
      const rec = {};
      const walk = n => {
        const t = own(n);
        if (t) { const k = relPath(n, m); rec[k] = rec[k] ? `${rec[k]} ${t}` : t; }
        if (n.tagName === 'A' && n.getAttribute('href')) rec[`${relPath(n, m)}@href`] = n.getAttribute('href');
        for (const c of n.children) walk(c);
      };
      walk(m);
      return rec;
    });
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const varying = keys.filter(k => new Set(rows.map(r => r[k] ?? '')).size > 1);
    const keep = all || !varying.length ? keys : varying;
    const out = rows.map(r => Object.fromEntries(keep.map(k => [k, r[k] ?? ''])));
    console.table(out);
    return out;
  };
})();
