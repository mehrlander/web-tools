// console/mods/templates.js — Wring-style template induction over the page:
// group elements whose signatures differ only in slots, so hashy per-instance
// classes (css-1a2b3c, hash-x9) become ${0} slots instead of noise that
// class-intersection (grow) has to discard. Signatures are path-qualified
// (ancestor tags + tag#id + classes), which keeps lookalike components from
// different page regions apart — Wring's surface signatures alone can't.
//
// The bookend-merge engine is adapted from lib/kits/wring.js (generated from
// mehrlander/wring; see archive/wring/ARCHITECTURE.md), trimmed to the
// single-slot + character-refinement path and vendored here so the suite
// stays one self-contained paste. Requires console/base.js (ea, glom, mark).
//
//   glom.templates()            group the working set (whole page if empty),
//                               mark groups in hues, console.table the ranking
//   glom.templates.grab(i)      adopt group i as the working set
//   glom.templates.clear()      unmark
//   glom.templates.group(strings, opts)      the raw engine — any delimited
//                               strings (signatures, urls, log lines)
//   glom.templates.reconstruct(template, slots)   lossless inverse
//
// Ranking is MDL-ish: (members − 1) × literal chars — "which repetition
// matters", not just "which is most numerous".
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/templates: base.js + mods/core.js must load first');
  const { SCOPE, HUES } = g.core;

  /* ── engine (adapted from kits/wring.js: bookend merge, single slot) ── */

  const computeBookend = (a, b) => {
    let p = 0;
    const maxP = Math.min(a.length, b.length);
    while (p < maxP && a[p] === b[p]) p++;
    let s = 0;
    const maxS = Math.min(a.length - p, b.length - p);
    while (s < maxS && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    return { prefix: a.slice(0, p), suffix: s ? a.slice(a.length - s) : [] };
  };
  const matchesBookend = (segs, prefix, suffix) => {
    if (segs.length < prefix.length + suffix.length) return false;
    for (let i = 0; i < prefix.length; i++) if (segs[i] !== prefix[i]) return false;
    for (let i = 0; i < suffix.length; i++) if (segs[segs.length - 1 - i] !== suffix[suffix.length - 1 - i]) return false;
    return true;
  };
  const lcp = strings => {
    let p = strings[0] ?? '';
    for (const s of strings.slice(1)) {
      let j = 0;
      while (j < p.length && j < s.length && p[j] === s[j]) j++;
      p = p.slice(0, j);
      if (!p) return '';
    }
    return p;
  };
  const lcs = strings => {
    const rev = s => [...s].reverse().join('');
    return rev(lcp(strings.map(rev)));
  };

  // Absorb the slot values' common character prefix/suffix into the template.
  const refineChars = (group, minCharLen = 2) => {
    const vals = group.members.map(m => m.slots[0]);
    if (vals.some(v => v === '')) return;
    let cpre = lcp(vals), csuf = lcs(vals);
    if (cpre.length < minCharLen) cpre = '';
    if (csuf.length < minCharLen) csuf = '';
    const minLen = Math.min(...vals.map(v => v.length));
    if (cpre.length + csuf.length > minLen) {
      csuf = csuf.slice(0, Math.max(0, minLen - cpre.length));
      if (csuf.length < minCharLen) csuf = '';
    }
    if (!cpre && !csuf) return;
    group.template = group.template.replace('${0}', () => `${cpre}\${0}${csuf}`);
    for (const m of group.members) m.slots[0] = m.slots[0].slice(cpre.length, csuf.length ? -csuf.length : undefined);
  };

  const groupStrings = (strings, options = {}) => {
    const { minLiteralChars = 3, minGroupSize = 2, delimiter = '.', strategy = 'specific' } = options;
    const entries = strings.map((s, index) => ({ original: s, index, segs: s.split(delimiter) }));
    const lit = (p, s) => [p.length && p.join(delimiter), s.length && s.join(delimiter)].filter(Boolean).join(delimiter).length;

    const candidates = new Map();
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        const { prefix, suffix } = computeBookend(entries[i].segs, entries[j].segs);
        if (!prefix.length && !suffix.length) continue;
        const key = prefix.join('\x00') + '\x01' + suffix.join('\x00');
        if (!candidates.has(key)) candidates.set(key, { prefix, suffix });
      }
    for (const t of candidates.values())
      t.members = entries.filter(e => matchesBookend(e.segs, t.prefix, t.suffix))
        .map(e => ({ index: e.index, original: e.original, slotSegs: e.segs.slice(t.prefix.length, e.segs.length - t.suffix.length) }));

    const ranked = [...candidates.values()]
      .filter(t => t.members.length >= minGroupSize && lit(t.prefix, t.suffix) >= minLiteralChars);
    ranked.sort(strategy === 'specific'
      ? (a, b) => lit(b.prefix, b.suffix) - lit(a.prefix, a.suffix) || b.members.length - a.members.length
      : (a, b) => (b.members.length - 1) * lit(b.prefix, b.suffix) - (a.members.length - 1) * lit(a.prefix, a.suffix));

    const assigned = new Set(), groups = [];
    for (const t of ranked) {
      const avail = t.members.filter(m => !assigned.has(m.index));
      if (avail.length < minGroupSize) continue;
      avail.forEach(m => assigned.add(m.index));
      const parts = [];
      if (t.prefix.length) parts.push(t.prefix.join(delimiter));
      parts.push('${0}');
      if (t.suffix.length) parts.push(t.suffix.join(delimiter));
      const group = {
        template: parts.join(delimiter),
        members: avail.map(m => ({ original: m.original, slots: [m.slotSegs.join(delimiter)] })),
        score: (avail.length - 1) * lit(t.prefix, t.suffix),
      };
      refineChars(group);
      groups.push(group);
    }
    return { groups, ungrouped: entries.filter(e => !assigned.has(e.index)).map(e => e.original) };
  };

  const reconstruct = (template, slots, delimiter = '.') => {
    let out = template;
    for (let i = slots.length - 1; i >= 0; i--) {
      const marker = '${' + i + '}', val = slots[i];
      if (val === '') {
        if (out.includes(delimiter + marker + delimiter)) out = out.replace(delimiter + marker + delimiter, () => delimiter);
        else if (out.includes(delimiter + marker)) out = out.replace(delimiter + marker, '');
        else if (out.includes(marker + delimiter)) out = out.replace(marker + delimiter, '');
        else out = out.replace(marker, '');
      } else out = out.replace(marker, () => val);
    }
    return out;
  };

  /* ── the glom face: elements → signatures → template groups ── */

  const sigOf = (n, qualify) => {
    const segs = [];
    if (qualify) for (let c = n.parentElement; c && c.nodeType === 1; c = c.parentElement) segs.unshift(c.tagName.toLowerCase());
    segs.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : ''));
    segs.push(...n.classList);
    return segs.join('.');
  };

  let groups = [];
  const templates = (opts = {}) => {
    const { qualify = true, minGroupSize = 2, top = 12, mark: doMark = true, ...engineOpts } = opts;
    templates.clear();
    const els = g.get().length ? g.get() : ea(SCOPE);
    const bySig = new Map();
    for (const n of els) {
      const s = sigOf(n, qualify);
      if (!bySig.has(s)) bySig.set(s, []);
      bySig.get(s).push(n);
    }
    const res = groupStrings([...bySig.keys()], { minGroupSize: 2, ...engineOpts });

    const out = [];
    for (const grp of res.groups) {
      const members = grp.members.flatMap(m => bySig.get(m.original));
      if (members.length < minGroupSize) continue;
      out.push({
        template: grp.template,
        count: members.length,
        slots: [...new Set(grp.members.map(m => m.slots[0]))].slice(0, 6),
        els: members,
        lit: grp.template.replace(/\$\{\d+\}/g, '').length,
      });
    }
    for (const s of res.ungrouped) {                        // identical-signature families
      const members = bySig.get(s);
      if (members.length >= Math.max(minGroupSize, 2))
        out.push({ template: s, count: members.length, slots: [], els: members, lit: s.length });
    }
    out.sort((a, b) => (b.count - 1) * b.lit - (a.count - 1) * a.lit);
    groups = out.slice(0, top);

    if (doMark) groups.forEach((grp, i) => window.mark(grp.els, `outline-${HUES[i % HUES.length]}-2`, `data-tmpl-${i}`));
    console.table(groups.map(({ els, lit, slots, ...row }, i) =>
      ({ i, ...row, slots: slots.join(', '), template: row.template.length > 90 ? '…' + row.template.slice(-89) : row.template })));
    console.log('templates: glom.templates.grab(i) adopts a group; .clear() unmarks');
    return groups;
  };

  templates.grab = i => groups[i] ? g(groups[i].els) : (console.warn(`templates: no group ${i} — run glom.templates() first`), []);
  templates.clear = () => {
    for (let i = 0; ; i++) {
      const style = document.getElementById(`mark-s-data-tmpl-${i}`);
      const els = document.querySelectorAll(`[data-tmpl-${i}]`);
      if (!style && !els.length) break;
      style?.remove();
      els.forEach(n => n.removeAttribute(`data-tmpl-${i}`));
    }
    groups = [];
  };
  templates.group = groupStrings;
  templates.reconstruct = reconstruct;
  g.templates = templates;
})();
