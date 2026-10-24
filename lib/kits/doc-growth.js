// doc-growth.js: a repository's markdown over time, as one bubble chart and one
// ranking, drawn from the payload python/doc-growth.py writes.
//
// Shared by the Map's Docs → Growth tab and pages/doc-growth.html, which hold
// their own state (the sample in view, the y measure, the picked file) and
// hand it here to draw. Framework-free; no DOM beyond the canvas it is given.
//
//   DocGrowth.bounds(data)                 -> axis tops for every measure
//   DocGrowth.shown(data, { y, min })      -> the files a measure draws
//   DocGrowth.rank(data, { unit, by })     -> rows { p, w, n, e, d, last, g, k }, best first
//                                             (by density, weighted, edits or words)
//   DocGrowth.kind(path)                   -> what the file is, a key of KINDS
//   DocGrowth.groups(data, min)            -> the three busiest groups, for hue
//   DocGrowth.draw(canvas, data, s)        -> the points drawn, for hit testing
//   DocGrowth.nearest(points, x, y)        -> the point under (x, y), or null
//   DocGrowth.caption(s, n, total)         -> one line saying what is on screen
//   DocGrowth.yTitle(y)                    -> what the y axis measures, in words
//
// A WEIGHTED EDIT counts 1 / the Markdown files its commit changed (`a` per
// sample and `weighted` in all, from python/doc-growth.py), so a sweep across
// many documents is not read as attention to each, and no cutoff decides
// which commits count. The care measures leave out files a commit hook writes
// (`gen` in the payload), whose edits are the hook's, not anyone's attention.
// Logs, tasks and archives are ranked with everything else and told apart by
// kind. Nothing here sets a minimum: every edited file is ranked and drawn.
(function () {
  // Categorical hues: dataviz reference palette slots 1-3, the run that clears
  // the all-pairs floors in both modes. "Other" is deliberately achromatic.
  const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'], DARK = ['#3987e5', '#d95926', '#199e70'];

  const careable = f => Array.isArray(f.a) && !f.gen;
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
  const churn = (f, t) => {
    const k = Math.round(t), lo = Math.max(0, k - 3);
    return f.e.slice(lo, k + 1).reduce((s, v) => s + v, 0);
  };
  // Days since the file was last touched; a file never touched inside the
  // window ages from its first sample.
  const age = (f, t, days) => {
    const k = Math.round(t);
    for (let i = k; i >= 0; i--) if (f.e[i]) return (k - i) * days;
    return Math.max(0, k - f.born) * days;
  };
  const care = (f, t) => {
    if (!Array.isArray(f.a)) return 0;
    const k = Math.round(t);
    let s = 0;
    for (let i = 0; i <= k && i < f.a.length; i++) s += f.a[i];
    return s;
  };
  const yOf = (f, t, y, days) => y === 'net' ? at(f.n, t) : y === 'age' ? age(f, t, days)
    : y === 'care' ? care(f, t) : churn(f, t);

  const yTitle = y => y === 'net' ? 'lines gained' : y === 'age' ? 'days untouched'
    : y === 'care' ? 'weighted edits' : 'edits a month';

  const fmt = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) < 10000 ? 1 : 0) + 'k'
                                       : String(Math.round(v));

  function bounds(data) {
    const all = data.files;
    const peak = (f, k) => Math.max(...f[k].filter(v => v != null), 0);
    return {
      w: { x: Math.max(100, ...all.map(f => peak(f, 'w'))) },
      r: { x: Math.max(100, ...all.map(f => peak(f, 'r'))) },
      net: Math.max(50, ...all.flatMap(f => f.n.map(Math.abs))),
      churn: Math.max(4, ...all.flatMap(f => f.e.map((_, k) => churn(f, k)))),
      age: Math.max(data.days, ...all.map(f => age(f, f.w.length - 1, data.days))),
      care: Math.max(4, ...all.map(f => care(f, f.w.length - 1))),
    };
  }

  const hasCare = data => data.files.some(f => Array.isArray(f.a));

  // `min` is the full page's edits slider; the Map tab passes none.
  function shown(data, { y = 'churn', min = 1 } = {}) {
    return y === 'care' ? data.files.filter(careable)
                        : data.files.filter(f => f.edits >= min);
  }

  // Every file a reader's commits edited and the last sample still holds,
  // with words to divide by.
  function rank(data, { unit = 'w', by = 'density' } = {}) {
    const order = {
      weighted: (a, b) => b.n - a.n || b.d - a.d,
      edits: (a, b) => b.e - a.e || b.n - a.n,
      words: (a, b) => b.w - a.w || b.d - a.d,
    }[by] || ((a, b) => b.d - a.d);
    const k = data.frames.length - 1;
    return data.files
      .filter(f => careable(f) && (f[unit][k] ?? f.w[k]) > 0)
      .map(f => {
        const w = f[unit][k] ?? f.w[k];
        return { p: f.p, w, n: f.weighted, e: f.edits, d: 1000 * f.weighted / w, last: f.le || '',
                 g: data.groups[f.g], k: kind(f.p) };
      })
      .sort(order);
  }

  // Open on the three groups with the most actively maintained files. Picking
  // by total bytes instead handed a hue slot to `archive`, which is exactly
  // the material nobody is working on.
  function groups(data, min = 5) {
    const live = {};
    for (const f of data.files) {
      if (f.edits < min) continue;
      const g = data.groups[f.g];
      live[g] = (live[g] ?? 0) + 1;
    }
    return Object.entries(live).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
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
      axis: `rgba(${r},${g},${b},0.35)`,
      other: dark ? '#6f6d67' : '#a9a7a1',
      surface: dark ? 'rgba(16,16,18,0.75)' : 'rgba(255,255,255,0.75)',
    };
  }

  // s: { t, y, unit, min, groups, picked, hovered, trails, bounds, mark, hue, top, titles }
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
    const slot = f => s.hue ? s.hue(f) : s.groups.indexOf(data.groups[f.g]);
    const faint = f => s.mark && !s.mark.has(f.p);
    // `top` leaves room above the plot for controls a host lays over it.
    const P = { l: 44, r: 14, t: s.top ?? 12, b: 30 };
    const files = shown(data, { y: s.y, min: s.min });
    const net = s.y === 'net', isAge = s.y === 'age', isCare = s.y === 'care';
    const B = s.bounds;

    // x: words, log. y: net change symlog around zero, everything else log1p.
    const xMax = B[s.unit].x;
    const lx = v => P.l + (Math.log10(Math.max(v, 10)) - 1) / (Math.log10(xMax) - 1) * (W - P.l - P.r);
    const yTop = net ? B.net : isAge ? B.age : isCare ? B.care : B.churn;
    const sym = v => Math.sign(v) * Math.log10(Math.abs(v) + 1);
    const ly = v => net
      ? P.t + (1 - (sym(v) / sym(yTop) + 1) / 2) * (H - P.t - P.b)
      : P.t + (1 - Math.log1p(Math.max(v, 0)) / Math.log1p(yTop)) * (H - P.t - P.b);
    const label = data.frames[Math.round(s.t)] ?? '';

    // the big ghosted date, Rosling's clock
    c.fillStyle = col.ink;
    c.globalAlpha = 0.055;
    c.font = `700 ${Math.min(W * 0.22, 150)}px ui-sans-serif, system-ui, sans-serif`;
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText(label.slice(0, 7), W - P.r - 6, H - P.b - 4);
    c.globalAlpha = 1;

    // grid + axes
    c.strokeStyle = col.grid; c.lineWidth = 1;
    c.fillStyle = col.ink; c.font = '11px ui-monospace, monospace';
    c.textAlign = 'right'; c.textBaseline = 'middle';
    const yTicks = net ? [-yTop, -yTop / 10, 0, yTop / 10, yTop]
                 : isAge ? [0, 7, 28, yTop].filter((v, i, a) => v <= yTop && a.indexOf(v) === i)
                         : [0, 1, 5, 20, yTop].filter((v, i, a) => v <= yTop && a.indexOf(v) === i);
    for (const v of yTicks) {
      const y = Math.round(ly(v)) + 0.5;
      c.beginPath(); c.moveTo(P.l, y); c.lineTo(W - P.r, y);
      c.strokeStyle = (net && v === 0) ? col.axis : col.grid;
      c.stroke();
      c.globalAlpha = 0.55;
      c.fillText(net ? fmt(v) : Math.round(v) + (isAge ? 'd' : ''), P.l - 6, y);
      c.globalAlpha = 1;
    }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let e = 1; Math.pow(10, e) <= xMax; e++) {
      const x = Math.round(lx(Math.pow(10, e))) + 0.5;
      c.beginPath(); c.moveTo(x, P.t); c.lineTo(x, H - P.b); c.strokeStyle = col.grid; c.stroke();
      c.globalAlpha = 0.55;
      c.fillText(fmt(Math.pow(10, e)), x, H - P.b + 6);
      c.globalAlpha = 1;
    }
    if (s.titles !== false) {
      c.textAlign = 'right';
      c.globalAlpha = 0.45;
      c.fillText('words →', W - P.r, H - P.b + 18);
      c.save(); c.translate(11, P.t + 2); c.rotate(-Math.PI / 2); c.textAlign = 'right';
      c.fillText(yTitle(s.y) + ' ↑', 0, 0);
      c.restore();
      c.globalAlpha = 1;
    }

    // bubbles, greyed first, then largest first so the small ones stay
    // clickable on top
    const pts = [];
    for (const f of files) {
      const w = at(f[s.unit], s.t);
      if (w == null || s.t < f.born - 0.5) continue;
      const y = yOf(f, s.t, s.y, data.days);
      pts.push({ f, x: lx(w), y: ly(y ?? 0), r: Math.max(2.5, Math.sqrt(f.edits) * 1.5) });
    }
    const layer = f => faint(f) ? 0 : slot(f) >= 0 ? 2 : 1;
    pts.sort((a, b) => layer(a.f) - layer(b.f) || b.r - a.r);

    if (s.trails && s.picked) {
      const f = s.picked, ser = f[s.unit];
      c.beginPath();
      let started = false;
      for (let k = 0; k <= Math.round(s.t); k++) {
        if (ser[k] == null) continue;
        const x = lx(ser[k]), yy = ly(yOf(f, k, s.y, data.days) ?? 0);
        started ? c.lineTo(x, yy) : (c.moveTo(x, yy), started = true);
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

    // direct label for the pinned file
    if (s.picked) {
      const p = pts.find(q => q.f === s.picked);
      if (p) {
        c.font = '600 11px ui-monospace, monospace';
        c.fillStyle = col.ink; c.textAlign = 'left'; c.textBaseline = 'bottom';
        const name = p.f.p.split('/').pop();
        c.fillText(name, Math.min(p.x + p.r + 5, W - P.r - c.measureText(name).width), p.y - p.r - 2);
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

  function caption(s, n, tot) {
    const floor = s.min > 1 ? ` (edited in ${s.min}+ commits)` : '';
    if (s.y === 'churn')
      return `${n} of ${tot} files on screen${floor}. Up means actively worked; right means long.`;
    if (s.y === 'age')
      return `${n} of ${tot} files on screen. Up means untouched for longer, so the top right is a monument and the bottom right is contested.`;
    if (s.y === 'care')
      return `${n} of ${tot} files on screen; files a commit hook writes are left out. Up means more edits, each counted as 1 ÷ the Markdown files its commit changed.`;
    return `${n} of ${tot} files on screen. Above the line gained lines that week, below it gave some back.`;
  }

  window.DocGrowth = { KINDS, careable, kind, at, churn, age, care, bounds, hasCare, shown, rank, groups, draw, nearest, caption, yTitle, fmt, LIGHT, DARK };
})();
