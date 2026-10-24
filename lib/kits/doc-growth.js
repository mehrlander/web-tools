// doc-growth.js: a repository's markdown over time, as one bubble chart and one
// ranking, drawn from the payload python/doc-growth.py writes and the session
// counts python/doc-reads.py writes.
//
// Shared by the Map's Docs → Growth tab and pages/doc-growth.html, which hold
// their own state (the sample in view, the picked file) and hand it here to
// draw. Framework-free; no DOM beyond the canvas it is given.
//
// Three dimensions, each one thing: a bubble's AREA is the file's words, its
// place ACROSS is its edits to date, and its place UP is the sessions that
// opened it to date. The play control sweeps the samples, so a file drifts
// right as it is edited, up as it is read, and swells as it grows.
//
//   DocGrowth.join(data, rows, from)  -> data, with each file's running counts;
//                                        rows: one repo's files in the reads
//                                        data file, from: its first day
//   DocGrowth.shown(data)             -> the files drawn
//   DocGrowth.rank(data, { by })      -> rows { p, w, e, o, c, via, last, g, k },
//                                        most first (by reads, edits or words)
//   DocGrowth.kind(path)              -> what the file is, a key of KINDS
//   DocGrowth.groups(data)            -> the three folders with the most files, for hue
//   DocGrowth.draw(canvas, data, s)   -> the points drawn, for hit testing
//   DocGrowth.nearest(points, x, y)   -> the point under (x, y), or null
//
// OPENED counts a session once, however it opened the file (a file tool, a
// shell read or a skill call). Being in context at startup is kept apart as
// `c` and never added: CLAUDE.md is in context in nearly every session and
// opened in few. Files a commit hook writes (`gen` in the payload) are left
// out, since their edits are the hook's.
(function () {
  // Categorical hues: dataviz reference palette slots 1-3, the run that clears
  // the all-pairs floors in both modes. "Other" is deliberately achromatic.
  const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'], DARK = ['#3987e5', '#d95926', '#199e70'];
  const TITLES = { x: 'edits', y: 'sessions that opened it', size: 'words' };

  // What a file is, from its path alone, so the same split holds in every
  // repository. The first test that matches wins, so a README inside an
  // archive is archive and a task's folder outranks its name. Instruction
  // files are named in capitals by convention, so that test is
  // case-sensitive: `docs/agents.md` is a document. A skill reference is any
  // other file in a skill's folder.
  const KINDS = [
    { k: 'instructions', n: 'Instructions', test: p => /(^|\/)(CLAUDE|AGENTS|GEMINI)\.md$/.test(p) },
    { k: 'task', n: 'Tracker task', test: p => /(^|\/)tracker\/tasks\//.test(p) },
    { k: 'thread', n: 'Thread', test: p => /(^|\/)chron\/threads\//.test(p) },
    { k: 'blog', n: 'Blog post', test: p => /(^|\/)blog\//.test(p) },
    { k: 'log', n: 'Log entry', test: p => /(^|\/)(chron|dump)\//.test(p) },
    { k: 'archive', n: 'Archive', test: p => /(^|\/)archive\//.test(p) },
    { k: 'skill', n: 'Skill', test: p => /(^|\/)SKILL\.md$/i.test(p) },
    { k: 'agent', n: 'Agent', test: p => /(^|\/)agents\/[^/]+\.md$/i.test(p) },
    { k: 'readme', n: 'README', test: p => /(^|\/)README\.md$/i.test(p) },
    { k: 'reference', n: 'Skill reference', test: p => /(^|\/)skills\/[^/]+\/.+\.md$/i.test(p) },
    { k: 'doc', n: 'Doc', test: () => true },
  ];
  const kind = p => KINDS.find(x => x.test(p)).k;
  // A value at a fractional sample, so playback slides between samples.
  const at = (series, t) => {
    const a = Math.floor(t), b = Math.min(series.length - 1, a + 1), u = t - a;
    const va = series[a], vb = series[b];
    if (va == null) return vb == null ? null : vb;
    return vb == null ? va : va + (vb - va) * u;
  };
  const day = s => Date.parse(s + 'T00:00:00Z') / 864e5;
  const fmt = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) < 10000 ? 1 : 0) + 'k'
                                       : String(Math.round(v));

  // Each file's running counts, one per sample: `ec` its edits to date and
  // `o` the sessions that opened it to date, the last sample counting every
  // recorded session, so a reads file newer than the payload still shows in
  // full. Without reads every `o` is zero and `data.reads` is false.
  //
  // `peak.cap` is the size above which a bubble stops growing: sixteen times
  // the 90th-percentile file, where the largest file outruns it. One large
  // source extract beside documents of a few hundred words otherwise draws
  // every document as a dot.
  function join(data, rows, from) {
    const n = data.frames.length, cut = data.frames.map(f => day(f) - (from ? day(from) : 0));
    let peak = { e: 1, o: 1, w: 100 };
    for (const f of data.files) {
      let s = 0;
      f.ec = f.e.map(v => (s += v));
      const r = rows?.[f.p], days = r?.opened || [];
      f.o = cut.map((c, k) => k === n - 1 ? days.length : days.filter(d => d <= c).length);
      f.opened = days.length;
      f.ctx = r?.context?.length || 0;
      f.via = r?.via || {};
      f.lastRead = days.length && from ? new Date((day(from) + days[days.length - 1]) * 864e5).toISOString().slice(0, 10) : '';
      if (f.gen) continue;
      peak = { e: Math.max(peak.e, f.edits), o: Math.max(peak.o, f.opened),
               w: Math.max(peak.w, ...f.w.filter(v => v != null)) };
    }
    const now = shown(data).map(f => f.w[n - 1]).filter(v => v > 0).sort((a, b) => a - b);
    const w90 = now[Math.floor(now.length * 0.9)] || peak.w;
    peak.cap = peak.w > 16 * w90 ? 16 * w90 : 0;
    data.reads = !!rows;
    data.readsFrom = from || '';
    data.peak = peak;
    return data;
  }
  // A file's own two offsets in [-1, 1], from its path, so files sharing a
  // pair of counts spread instead of stacking on one point, and each keeps
  // its offsets through playback.
  const spread = f => f._j || (f._j = (() => {
    let h = 2166136261;
    for (const ch of f.p) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const u = x => (x >>> 0) % 2001 / 1000 - 1;
    return [u(h), u(Math.imul(h ^ (h >>> 15), 2246822519))];
  })());

  const shown = data => data.files.filter(f => !f.gen);

  // Every file the last sample still holds, with words to show.
  function rank(data, { by = 'reads' } = {}) {
    const order = {
      edits: (a, b) => b.e - a.e || b.o - a.o,
      words: (a, b) => b.w - a.w || b.o - a.o,
    }[by] || ((a, b) => b.o - a.o || b.e - a.e);
    const k = data.frames.length - 1;
    return shown(data)
      .filter(f => f.w[k] > 0)
      .map(f => ({ p: f.p, w: f.w[k], e: f.edits, o: f.opened || 0, c: f.ctx || 0, via: f.via || {},
                   last: f.le || '', read: f.lastRead || '', g: data.groups[f.g], k: kind(f.p) }))
      .sort(order);
  }

  // The full page's hue: the three folders holding the most files.
  function groups(data) {
    const n = {};
    for (const f of shown(data)) n[data.groups[f.g]] = (n[data.groups[f.g]] ?? 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  }

  // Colours from the canvas's own computed text colour, so the chart follows
  // whichever theme its host is in.
  function palette(canvas) {
    const ink = getComputedStyle(canvas).color || 'rgb(11,11,11)';
    const [r, g, b] = (ink.match(/\d+(\.\d+)?/g) || [11, 11, 11]).map(Number);
    const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) > 140;
    return {
      hue: dark ? DARK : LIGHT, ink,
      grid: `rgba(${r},${g},${b},${dark ? 0.10 : 0.08})`,
      other: dark ? '#6f6d67' : '#a9a7a1',
      surface: dark ? 'rgba(16,16,18,0.75)' : 'rgba(255,255,255,0.75)',
    };
  }

  // s: { t, groups, picked, hovered, trails, mark, hue, top, titles }
  // `titles: false` leaves the axis titles to the host, which can set them
  // in type the canvas's small print cannot match.
  // `hue(f)` gives a file's hue slot (0 to 2), or -1 for the neutral "other";
  // without it, the three `groups` each take a hue. `mark`, a Set of paths,
  // draws every file outside it faint, whatever its hue.
  function draw(cv, data, s) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const col = palette(cv);
    const slot = f => s.hue ? s.hue(f) : (s.groups || []).indexOf(data.groups[f.g]);
    const faint = f => s.mark && !s.mark.has(f.p);
    // `top` leaves room above the plot for controls a host lays over it;
    // `inset` keeps a bubble at zero off the axis line.
    const P = { l: 44, r: 14, t: s.top ?? 12, b: 30 }, inset = 10;
    const peak = data.peak || { e: 1, o: 1, w: 100 };

    // Both axes log(1 + v), so zero has a place and one session or one edit
    // reads apart from none.
    const lx = v => P.l + inset + Math.log1p(Math.max(v, 0)) / Math.log1p(peak.e) * (W - P.l - P.r - 2 * inset);
    const ly = v => H - P.b - inset - Math.log1p(Math.max(v, 0)) / Math.log1p(peak.o) * (H - P.t - P.b - 2 * inset);
    // Area for words, up to `peak.cap`: the largest file drawn takes the
    // largest radius the plot allows.
    const rMax = Math.max(12, Math.sqrt(W * H) / 14);
    const radius = w => Math.max(2, rMax * Math.sqrt(Math.min(w, peak.cap || peak.w) / (peak.cap || peak.w)));
    const label = data.frames[Math.round(s.t)] ?? '';

    // the big ghosted date, Rosling's clock
    c.fillStyle = col.ink;
    c.globalAlpha = 0.055;
    c.font = `700 ${Math.min(W * 0.22, 150)}px ui-sans-serif, system-ui, sans-serif`;
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText(label.slice(0, 7), W - P.r - 6, H - P.b - 4);
    c.globalAlpha = 1;

    // grid: 0, 1, 3, 10, 30, … and the peak itself. The lines go under the
    // bubbles and the numbers over them, so a large bubble near an axis
    // does not hide its scale.
    const ticks = top => [...[0, 1, 3, 10, 30, 100, 300, 1000, 3000].filter(v => v <= top / 1.5), top];
    const yt = ticks(peak.o).map(v => [v, Math.round(ly(v)) + 0.5]), xt = ticks(peak.e).map(v => [v, Math.round(lx(v)) + 0.5]);
    c.strokeStyle = col.grid; c.lineWidth = 1;
    for (const [, y] of yt) { c.beginPath(); c.moveTo(P.l, y); c.lineTo(W - P.r, y); c.stroke(); }
    for (const [, x] of xt) { c.beginPath(); c.moveTo(x, P.t); c.lineTo(x, H - P.b); c.stroke(); }

    // bubbles, faint first, then largest first so the small ones stay
    // clickable on top. Counts are whole numbers, so many files share a
    // place: each is moved by its own offsets, at most 30% of the way to the
    // next whole count and never past 12px, so a crowd reads as a crowd and
    // no bubble passes a neighbouring count.
    const pts = [];
    for (const f of shown(data)) {
      const w = at(f.w, s.t);
      if (w == null || s.t < f.born - 0.5) continue;
      const e = at(f.ec, s.t), o = at(f.o, s.t), [jx, jy] = spread(f);
      const ax = Math.min(12, 0.3 * (lx(e + 1) - lx(e))), ay = Math.min(12, 0.3 * (ly(o) - ly(o + 1)));
      pts.push({ f, x: lx(e) + jx * ax, y: ly(o) + jy * ay, r: radius(w) });
    }
    const layer = f => faint(f) ? 0 : slot(f) >= 0 ? 2 : 1;
    pts.sort((a, b) => layer(a.f) - layer(b.f) || b.r - a.r);

    if (s.trails && s.picked) {
      const f = s.picked;
      c.beginPath();
      let started = false;
      for (let k = 0; k <= Math.round(s.t); k++) {
        if (f.w[k] == null) continue;
        const x = lx(f.ec[k]), y = ly(f.o[k]);
        started ? c.lineTo(x, y) : (c.moveTo(x, y), started = true);
      }
      const sl = slot(f);
      c.strokeStyle = sl >= 0 ? col.hue[sl] : col.other;
      c.globalAlpha = 0.45; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1;
    }

    for (const p of pts) {
      const sl = slot(p.f);
      const on = s.picked === p.f || s.hovered === p.f;
      c.globalAlpha = on ? 1 : faint(p.f) ? 0.15 : sl >= 0 ? 0.72 : s.hue ? 0.55 : 0.3;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7);
      c.fillStyle = sl >= 0 && !faint(p.f) ? col.hue[sl] : col.other; c.fill();
      // a surface ring keeps overlapping marks separable
      c.lineWidth = on ? 2 : 1.25;
      c.strokeStyle = on ? col.ink : col.surface;
      c.globalAlpha = on ? 1 : 0.5;
      c.stroke();
    }
    c.globalAlpha = 1;

    // the scale's numbers and, unless the host sets them, the axis titles
    c.fillStyle = col.surface;
    c.fillRect(0, P.t, P.l - 2, H - P.t); c.fillRect(0, H - P.b + 2, W, P.b - 2);
    c.fillStyle = col.ink; c.font = '11px ui-monospace, monospace';
    c.globalAlpha = 0.55;
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const [v, y] of yt) c.fillText(fmt(v), P.l - 6, y);
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const [v, x] of xt) c.fillText(fmt(v), x, H - P.b + 6);
    if (s.titles !== false) {
      c.globalAlpha = 0.45;
      c.textAlign = 'right';
      c.fillText(TITLES.x + ' →', W - P.r, H - P.b + 18);
      c.save(); c.translate(11, P.t + 2); c.rotate(-Math.PI / 2); c.textAlign = 'right';
      c.fillText(TITLES.y + ' ↑', 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;

    // direct label for the pinned file
    if (s.picked) {
      const p = pts.find(q => q.f === s.picked);
      if (p) {
        c.font = '600 11px ui-monospace, monospace';
        c.fillStyle = col.ink; c.textAlign = 'left'; c.textBaseline = 'bottom';
        const name = p.f.p.split('/').pop();
        c.fillText(name, Math.min(p.x + p.r + 5, W - P.r - c.measureText(name).width), Math.max(P.t + 12, p.y - p.r - 2));
      }
    }
    return pts;
  }

  function nearest(pts, x, y) {
    let best = null, bd = 400;
    for (const p of pts || []) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd + p.r ** 2) { bd = d; best = p; }
    }
    return best;
  }

  window.DocGrowth = { KINDS, TITLES, kind, at, join, shown, rank, groups, draw, nearest, fmt, LIGHT, DARK };
})();
