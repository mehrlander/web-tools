// doc-growth.js: a repository's markdown over time, as one bubble chart and one
// ranking, drawn from the payload python/doc-growth.py writes.
//
// Shared by the Map's Docs → Growth tab and pages/doc-growth.html, which hold
// their own state (the sample in view, the y measure, the picked file) and
// hand it here to draw. Framework-free; no DOM beyond the canvas it is given.
//
//   DocGrowth.bounds(data)                 -> axis tops for every measure
//   DocGrowth.shown(data, { y, min })      -> the files a measure draws
//   DocGrowth.rank(data, { unit, min, by })-> rows { p, w, n, d, last }, best first
//   DocGrowth.groups(data, min)            -> the three busiest groups, for hue
//   DocGrowth.draw(canvas, data, s)        -> the points drawn, for hit testing
//   DocGrowth.nearest(points, x, y)        -> the point under (x, y), or null
//   DocGrowth.caption(s, n, total)         -> one line saying what is on screen
//
// A FOCUSED EDIT is a commit touching at most the payload's `focus` markdown
// files, so a sweep across many documents is not attention to each. The care
// measures leave out files a commit hook writes (`gen` in the payload) and
// logs and trays, which are written freely by design, as the governing-docs
// hook treats them.
(function () {
  const CARE_SKIP = /(^|\/)(chron|tracker\/tasks|blog|dump|archive)\//;
  // Categorical hues: dataviz reference palette slots 1-3, the run that clears
  // the all-pairs floors in both modes. "Other" is deliberately achromatic.
  const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'], DARK = ['#3987e5', '#d95926', '#199e70'];

  const careable = f => Array.isArray(f.f) && !f.gen && !CARE_SKIP.test(f.p);
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
    if (!Array.isArray(f.f)) return 0;
    const k = Math.round(t);
    let s = 0;
    for (let i = 0; i <= k && i < f.f.length; i++) s += f.f[i];
    return s;
  };
  const yOf = (f, t, y, days) => y === 'net' ? at(f.n, t) : y === 'age' ? age(f, t, days)
    : y === 'care' ? care(f, t) : churn(f, t);

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

  const hasCare = data => data.files.some(f => Array.isArray(f.f));

  function shown(data, { y = 'churn', min = 5 } = {}) {
    return y === 'care' ? data.files.filter(f => careable(f) && f.focused >= min)
                        : data.files.filter(f => f.edits >= min);
  }

  function rank(data, { unit = 'w', min = 5, by = 'density' } = {}) {
    const k = data.frames.length - 1;
    return data.files
      .filter(f => careable(f) && f.w[k] != null && f.w[k] >= 40 && f.focused >= min)
      .map(f => {
        const w = Math.max(f[unit][k] ?? f.w[k], 40);
        return { p: f.p, w, n: f.focused, d: 1000 * f.focused / w, last: f.lf || '' };
      })
      .sort((a, b) => by === 'count' ? b.n - a.n || b.d - a.d : b.d - a.d);
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

  // s: { t, y, unit, min, groups, picked, hovered, trails, bounds }
  function draw(cv, data, s) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const col = palette(cv), slot = g => s.groups.indexOf(g);
    const P = { l: 44, r: 14, t: 12, b: 30 };
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
    c.fillStyle = col.ink; c.font = '10px ui-monospace, monospace';
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
    c.textAlign = 'right';
    c.globalAlpha = 0.45;
    c.fillText('words →', W - P.r, H - P.b + 18);
    c.save(); c.translate(11, P.t + 2); c.rotate(-Math.PI / 2); c.textAlign = 'right';
    c.fillText(net ? 'lines gained ↑' : isAge ? 'days untouched ↑' : isCare ? 'focused edits ↑' : 'edits / month ↑', 0, 0);
    c.restore();
    c.globalAlpha = 1;

    // care: the line where focused edits reach 10 per thousand words
    if (isCare) {
      c.setLineDash([4, 4]); c.strokeStyle = col.ink; c.globalAlpha = 0.35; c.lineWidth = 1;
      c.beginPath();
      for (let x = 10, first = true; x <= xMax * 1.1 && x / 100 <= yTop; x *= 1.1, first = false) {
        const px = lx(x), py = ly(x / 100);
        first ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }

    // bubbles, largest first so the small ones stay clickable on top
    const pts = [];
    for (const f of files) {
      const w = at(f[s.unit], s.t);
      if (w == null || s.t < f.born - 0.5) continue;
      const y = yOf(f, s.t, s.y, data.days);
      pts.push({ f, x: lx(w), y: ly(y ?? 0), r: Math.max(2.5, Math.sqrt(f.edits) * 1.5) });
    }
    pts.sort((a, b) => b.r - a.r);

    if (s.trails && s.picked) {
      const f = s.picked, ser = f[s.unit];
      c.beginPath();
      let started = false;
      for (let k = 0; k <= Math.round(s.t); k++) {
        if (ser[k] == null) continue;
        const x = lx(ser[k]), yy = ly(yOf(f, k, s.y, data.days) ?? 0);
        started ? c.lineTo(x, yy) : (c.moveTo(x, yy), started = true);
      }
      const sl = slot(data.groups[f.g]);
      c.strokeStyle = sl >= 0 ? col.hue[sl] : col.other;
      c.globalAlpha = 0.45; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1;
    }

    for (const p of pts) {
      const sl = slot(data.groups[p.f.g]);
      const on = s.picked === p.f || s.hovered === p.f;
      c.globalAlpha = sl >= 0 ? (on ? 1 : 0.72) : 0.3;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7);
      c.fillStyle = sl >= 0 ? col.hue[sl] : col.other; c.fill();
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
    if (s.y === 'churn')
      return `${n} of ${tot} files on screen (edited in ${s.min}+ commits). Up means actively worked; right means long.`;
    if (s.y === 'age')
      return `${n} of ${tot} files on screen. Up means untouched for longer, so the top right is a monument and the bottom right is contested.`;
    if (s.y === 'care')
      return `${n} of ${tot} files on screen (${s.min}+ focused edits; hook-written files and logs left out). Above the dashed line, a file has had more than 10 focused edits per thousand words.`;
    return `${n} of ${tot} files on screen. Above the line gained lines that week, below it gave some back.`;
  }

  window.DocGrowth = { CARE_SKIP, careable, at, churn, age, care, bounds, hasCare, shown, rank, groups, draw, nearest, caption, fmt, LIGHT, DARK };
})();
