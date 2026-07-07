// console/mods/query.js — q(expr): a Playwright-flavored chain grammar,
// implemented browser-native (Playwright itself is Node-side; its selector
// grammar is just syntax). Requires console/base.js (ea, sig, mark, glom).
//
//   q('#bills >> tbody tr >> has-text=hearing >> down=a >> nth=0-4')
//
// Stages, separated by `>>`, each transforming the element set:
//   <css>             querySelectorAll — document-wide as the first stage,
//                     then within each member
//   text=foo          own text contains "foo" (case-insensitive)
//   text="Foo"        own text equals "Foo" (whitespace-cleaned)
//   text=/re/i        own text matches the regex
//   has-text=…        same three forms, against full textContent
//   has=<css>         keep members containing a descendant match
//   visible           keep visible members; visible=false for the inverse
//   nth=2             pick by index (0-based; negatives count from the end)
//   nth=1-4           inclusive range (ends may be negative: nth=1--1)
//   up · up=2 · up=<css>   parent / nth ancestor / closest ancestor
//   down=<css>        first descendant match per member
//   down*=<css>       all descendant matches, unioned
//   over=1 · over=-2  sibling hops
//
// Returns a plain array decorated with .mark(spec), .glom() (adopt as the
// working set), and .texts(). Results are deduped in document order.
//
// Grammar notes: `>>` inside quotes or /regex/ literals is safe; a bare stage
// named like an engine (e.g. an svg <text> selector) is read as the engine,
// so write it as `svg text` or `*|text`.
(() => {
  if (!window.ea || !window.glom?.core) return console.warn('mods/query: base.js + mods/core.js must load first');
  const { SCOPE, clean, own, docOrder, upStep, overStep } = window.glom.core;
  const full = n => clean(n.textContent);

  // Split on `>>` outside of "…", '…', and /…/ spans.
  const split = expr => {
    const stages = []; let buf = '', quote = null;
    for (let i = 0; i < expr.length; i++) {
      const c = expr[i];
      if (quote) { buf += c; if (c === quote && expr[i - 1] !== '\\') quote = null; continue; }
      if (c === '"' || c === "'" || c === '/') { quote = c; buf += c; continue; }
      if (c === '>' && expr[i + 1] === '>') { stages.push(buf.trim()); buf = ''; i++; continue; }
      buf += c;
    }
    stages.push(buf.trim());
    return stages.filter(Boolean);
  };

  const ENGINES = new Set(['text', 'has-text', 'has', 'nth', 'up', 'down', 'down*', 'over', 'visible']);
  const BARE    = new Set(['up', 'visible']);
  const parse = stage => {
    const m = stage.match(/^([a-z-]+\*?)\s*=\s*([\s\S]+)$/i);
    if (m && ENGINES.has(m[1].toLowerCase())) return { name: m[1].toLowerCase(), val: m[2].trim() };
    if (BARE.has(stage.toLowerCase())) return { name: stage.toLowerCase(), val: '' };
    return { name: 'css', val: stage };
  };

  const textPred = (val, extract) => {
    const rm = val.match(/^\/(.*)\/([a-z]*)$/s);
    if (rm) { const re = new RegExp(rm[1], rm[2]); return n => re.test(extract(n)); }
    const qm = val.match(/^"(.*)"$/s) || val.match(/^'(.*)'$/s);
    if (qm) { const s = clean(qm[1]); return n => extract(n) === s; }
    const s = val.toLowerCase();
    return n => extract(n).toLowerCase().includes(s);
  };

  const nth = (val, els) => {
    const m = val.match(/^(-?\d+)(?:\s*-\s*(-?\d+))?$/);
    if (!m) { console.warn(`q: bad nth=${val}`); return els; }
    const idx = i => i < 0 ? els.length + i : i;
    if (m[2] == null) { const el = els[idx(+m[1])]; return el ? [el] : []; }
    return els.slice(idx(+m[1]), idx(+m[2]) + 1);
  };

  const apply = (els, { name, val }) => {
    switch (name) {
      case 'css':      return docOrder(els.flatMap(n => [...n.querySelectorAll(val)]));
      case 'text':     return els.filter(textPred(val, own));
      case 'has-text': return els.filter(textPred(val, full));
      case 'has':      return els.filter(n => n.querySelector(val));
      case 'visible':  { const want = val !== 'false'; return els.filter(n => sig.visible(n) === want); }
      case 'nth':      return nth(val, els);
      case 'up':       return docOrder(els.map(n => upStep(n, val === '' ? 1 : (/^\d+$/.test(val) ? +val : val))).filter(Boolean));
      case 'down':     return docOrder(els.map(n => n.querySelector(val)).filter(Boolean));
      case 'down*':    return docOrder(els.flatMap(n => [...n.querySelectorAll(val)]));
      case 'over':     { const k = val === '' ? 1 : +val; if (!Number.isFinite(k)) { console.warn(`q: bad over=${val}`); return els; } return docOrder(els.map(n => overStep(n, k)).filter(Boolean)); }
      default:         return els;
    }
  };

  const decorate = arr => Object.assign(arr, {
    mark:  spec => (window.mark(arr, spec), arr),
    glom:  ()   => window.glom(arr),
    texts: ()   => arr.map(own),
  });

  window.q = expr => {
    const stages = split(String(expr));
    let els = null;
    for (const stage of stages) {
      const s = parse(stage);
      if (els === null) { els = s.name === 'css' ? [...document.querySelectorAll(s.val)] : apply(ea(SCOPE), s); continue; }
      els = apply(els, s);
    }
    return decorate(els ?? []);
  };
})();
