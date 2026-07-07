// console/suite.js — GENERATED, do not edit. `npm run build:console` reassembles
// it from console/base.js + console/mods/{verbs,query,grow,pick}.js.

(() => {
  /** ── Core ───────────────────────────────────────────────────────────────── **/

  const _r = (n, k) => Math.round(n.getBoundingClientRect()[k]);

  const _f = (v, els) =>
    typeof v === 'string'   ? els.filter(text.own.clean.lower.includes(v)) :
    typeof v === 'number'   ? els.filter((_, i) => i === v) :
    v instanceof RegExp     ? els.filter(text.own.clean.test(v)) :
    typeof v === 'function' ? els.filter(v) : els;

  const getPath = (n, root, indexed = false, p = []) => {
    if (!n || n === root || n.nodeType !== 1) return p.join('/') || 'self';
    let t = n.tagName.toLowerCase();
    if (indexed) {
      const s = [...(n.parentElement?.children || [])].filter(x => x.tagName === n.tagName);
      if (s.length > 1) t += `[${s.indexOf(n) + 1}]`;
    }
    return getPath(n.parentElement, root, indexed, [t, ...p]);
  };

  /** ── Namespaces ─────────────────────────────────────────────────────────── **/

  const text = (() => {
    const sources = {
      full: n => n.textContent,
      own:  n => [...n.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join(''),
    };
    const transforms = {
      trim:  s => s.trim(),
      clean: s => s.trim().replace(/\s+/g, ' '),
      lower: s => s.toLowerCase(),
      upper: s => s.toUpperCase(),
    };
    const make = (state = { source: 'full', xforms: [] }) => {
      const apply   = s => state.xforms.reduce((a, k) => transforms[k](a), s);
      const extract = n => apply(sources[state.source](n));
      const next = {
        own:   { ...state, source: 'own' },
        trim:  { ...state, xforms: [...state.xforms, 'trim'] },
        clean: { ...state, xforms: [...state.xforms, 'clean'] },
        lower: { ...state, xforms: [...state.xforms, 'lower'] },
        upper: { ...state, xforms: [...state.xforms, 'upper'] },
      };
      const term = {
        includes:   q  => { const qq = apply(q); return n => extract(n).includes(qq); },
        startsWith: q  => { const qq = apply(q); return n => extract(n).startsWith(qq); },
        endsWith:   q  => { const qq = apply(q); return n => extract(n).endsWith(qq); },
        eq:         q  => { const qq = apply(q); return n => extract(n) === qq; },
        test:       re => n => re.test(extract(n)),
      };
      return new Proxy(extract, {
        get: (_, p) => p in next ? make(next[p]) : term[p],
      });
    };
    return make();
  })();

  const rect = new Proxy({
    x:   n => _r(n, 'left'),
    y:   n => _r(n, 'top'),
    w:   n => _r(n, 'width'),
    h:   n => _r(n, 'height'),
    dim: n => `${_r(n, 'width')}x${_r(n, 'height')}`,
  }, { get: (t, p) => p in t ? t[p] : n => _r(n, p) });

  const sig = {
    tag:     n => n.tagName.toLowerCase(),
    classes: n => [...n.classList],
    css:     n => (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].join('.') : ''),
    path:    n => getPath(n, null, true),
    visible: n => !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
    info:    n => ({ tag: sig.tag(n), css: sig.css(n), dim: rect.dim(n), path: sig.path(n), text: text.clean(n), own: text.own.clean(n), visible: sig.visible(n) }),
  };

  const dom = {
    parent:          n => n.parentElement,
    children:        n => [...n.children],
    siblings:        n => [...(n.parentElement?.children || [])].filter(x => x !== n),
    textSiblings:    n => [...(n.parentElement?.childNodes || [])].filter(x => x.nodeType === 3).length,
    elementSiblings: n => [...(n.parentElement?.children || [])].length,
    commentSiblings: n => [...(n.parentElement?.childNodes || [])].filter(x => x.nodeType === 8).length,
    depth:           n => { let d = 0, c = n; while (c.parentElement) { d++; c = c.parentElement; } return d; },
    index:           n => [...(n.parentElement?.children || [])].indexOf(n),
  };

  const el = new Proxy({}, {
    get: (_, p) => n => { const v = n[p]; return typeof v === 'function' ? v.bind(n) : v; }
  });

  Object.assign(window, { text, rect, sig, dom, el });

  /** ── Standalone Utilities ───────────────────────────────────────────────── **/

  const mark = (els, spec = "outline-red-2", attr = 'data-mark') => {
    els.forEach((n, i) => n.setAttribute(attr, i));

    let w = 2, css = spec.split(";").map(x => {
      if (x.startsWith("bg-")) return `background:${x.slice(3)}`;
      if (x.startsWith("outline-")) return (w = parseInt(x.split("-")[2] || 2)), `outline:${w}px solid ${x.split("-")[1]}`;
      return x.includes(':') ? x : `border:${w}px solid ${x}`;
    }).join(" !important;") + " !important;";

    const id = `mark-s-${attr.replace(/\W/g, '-')}`;
    const s = document.getElementById(id) || Object.assign(document.createElement('style'), { id });
    if (!s.parentNode) document.head.appendChild(s);

  s.textContent = `
      [${attr}]{${css} cursor:crosshair; transition:all 0.1s; position:relative} 
      [${attr}]:hover{outline-width:${w+1}px !important; border-width:${w+1}px !important; z-index:1e5}
      [${attr}]::after {
        content: attr(${attr});
        position: absolute;
        top: -20px; right: -10px;
        background: #ffe;
        color: #0f172a;
        font: bold 12px/1.1 monospace;
        padding: 1px 2px;
        border-radius: 3px;
        border: 1px solid #94a3b8;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1e4;
      }
      [${attr}]:hover::after {
        background: #fef08a;
        color: #854d0e;
        border-color: #eab308;
        z-index: 1e6;
      }
    `;
  };

  const unionArea = rs => {
    if (!rs.length) return 0;
    const ev = [];
    rs.forEach(r => { ev.push({x:r.left, t:1, y1:r.top, y2:r.bottom}, {x:r.right, t:-1, y1:r.top, y2:r.bottom}); });
    ev.sort((a,b) => a.x - b.x);
    let px = ev[0]?.x || 0, area = 0, act = [];
    for (const e of ev) {
      const dx = e.x - px;
      if (dx > 0) {
        let len = 0, c = -1e9;
        act.sort((a,b) => a.y1 - b.y1).forEach(iv => {
          if (iv.y1>c){len+=iv.y2-iv.y1;c=iv.y2} else if(iv.y2>c){len+=iv.y2-c;c=iv.y2}
        });
        area += len * dx; px = e.x;
      }
      e.t > 0 ? act.push(e) : (act = act.filter(iv => iv.y1 !== e.y1 || iv.y2 !== e.y2));
    }
    return area;
  };

  const summary = (els, groupBy = sig.path) => {
    const groups = new Map(), r = n => +n.toFixed(3);
    els.forEach(n => {
      const key = groupBy(n);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ n, r: n.getBoundingClientRect(), len: text.clean(n).length });
    });
    const res = [...groups].map(([id, items]) => {
      const rects = items.map(i => i.r);
      const u = unionArea(rects);
      const bb = (Math.max(...rects.map(z=>z.right)) - Math.min(...rects.map(z=>z.left))) *
                 (Math.max(...rects.map(z=>z.bottom)) - Math.min(...rects.map(z=>z.top)));
      return { group: id, count: items.length, tags: items.reduce((m,i) => { const k=sig.tag(i.n); m[k]=(m[k]||0)+1; return m; }, {}), geoReg: r(u/(bb||1)), avgLen: r(items.reduce((a,b) => a+b.len, 0) / items.length) };
    }).sort((a,b) => b.count - a.count);
    console.table(res);
    return res;
  };

  Object.assign(window, { mark, unionArea, summary });

  /** ── ea ─────────────────────────────────────────────────────────────────── **/

  window.ea = (sel, root = document) => {
    const arr = [...root.querySelectorAll(sel)];
    arr.tally   = (fn = sig.tag) => arr.reduce((m, n) => { const k = fn(n); m[k] = (m[k] || 0) + 1; return m; }, {});
    arr.groupBy = (fn = sig.tag) => arr.reduce((m, n) => { const k = fn(n); (m[k] ??= []).push(n); return m; }, {});
    arr.mark    = (spec, attr) => { mark(arr, spec, attr); return arr; };
    arr.summary = (fn) => summary(arr, fn);
    arr.climb   = (arg) => {
      const r = [];
      arr.forEach(n => {
        let cur = n, i = 0;
        while ((cur = cur.parentElement)) {
          if (typeof arg === 'number' ? ++i > arg : (arg && !arg(cur))) continue;
          r.push(cur); if (typeof arg !== 'number') break;
        }
      });
      return glom.set([...new Set(r)]);
    };
    return arr;
  };

  /** ── glom ───────────────────────────────────────────────────────────────── **/

  const SCOPE = 'body *:not(script):not(style)';

  const glom = (...args) => {
    const [payload, mod] = args;
    const isContent = v => typeof v === 'string' || typeof v === 'number' ||
                           typeof v === 'function' || v instanceof RegExp;
    if (isContent(payload)) return glom.set(_f(payload, ea(SCOPE)));
    const els =
      payload instanceof Element ? [payload] :
      payload === document       ? [document.documentElement] :
      payload != null            ? Array.from(payload).filter(n => n instanceof Element) :
      args.length                ? [] :
      ea(SCOPE);
    return glom.set(_f(mod, els));
  };

  glom.history = [];

  glom.set = els => {
    glom.history.push(ea('[data-glom]'));
    ea('[data-glom]').forEach(n => n.removeAttribute('data-glom'));
    document.getElementById('mark-s-data-glom')?.remove();
    const res = [...new Set(els)];
    res.forEach((n, i) => n.setAttribute('data-glom', i));
    return ea('[data-glom]');
  };

  glom.get = (pred) => _f(pred, ea('[data-glom]'));
  glom.keep = v => { const p = glom.get(), r = _f(v, p); console.log(`keep: ${p.length} → ${r.length}`); return glom.set(r); };
  glom.drop = v => { const p = glom.get(), m = new Set(_f(v, p)), r = p.filter(n => !m.has(n)); console.log(`drop: ${p.length} → ${r.length}`); return glom.set(r); };
  glom.undo    = () => { const prev = glom.history.pop(); if (prev) { console.log(`undo: → ${prev.length}`); return glom.set(prev); } return []; };
  glom.clear   = () => { document.getElementById('mark-s-data-glom')?.remove(); glom.history = []; return glom.set([]); };
  glom.mark    = (spec) => { mark(glom.get(), spec, 'data-glom'); return glom.get(); };
  glom.summary = (fn) => summary(glom.get(), fn);

  window.glom = glom;

  /** ── Pop ────────────────────────────────────────────────────────────────── **/

  class Pop {
    constructor({ width = 800, height = 600 } = {}) {
      this.width = width;
      this.height = height;
    }
    show(html) {
      const content = html || prompt("Paste full HTML string:");
      if (!content) return;
      const w = window.open("", "_blank", `width=${this.width},height=${this.height}`);
      w.document.write(content);
      w.document.close();
      if (console.style) {
        console.style(console.formatter("green;bold", "📖 Raw HTML Rendered"), console.formatter("gray", `Length: ${content.length} chars`));
      }
      return w;
    }
    toUrl(s, base64 = true) {
      return base64 ? 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(s))) : 'data:text/html,' + encodeURIComponent(s);
    }
    async pack(s) {
      const cs = new CompressionStream('gzip');
      const w = cs.writable.getWriter();
      w.write(new TextEncoder().encode(s));
      w.close();
      const bytes = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      let out = '';
      for (const b of bytes) out += String.fromCharCode(b);
      return btoa(out);
    }
    async inflate(s) {
      return new Response(new Blob([Uint8Array.from(atob(s.trim()), c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(b => new TextDecoder().decode(b)).then(d => new Promise(resolve => {
         const w = window.open('', '_blank', `width=${this.width},height=${this.height}`);
         w.document.write(d);
         w.document.close();
         w.onload = () => resolve(w);
       }));
    }
  }
  const _pop = new Pop();
  window.pop = _pop;

  window.packTable = async (input = prompt("Paste TSV")) => {
    let headers, data;
    if (typeof input === 'string') {
      const rows = input.trim().split("\n").map(r => r.split("\t"));
      [headers, ...data] = rows;
      data = data.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
    } else {
      headers = Object.keys(input[0]);
      data = input;
    }
    const col = Object.fromEntries(headers.map(h => [h, data.map(r => r[h])]));
    const b64 = await _pop.pack(JSON.stringify(col));
    copy(b64);
    if (console.style) console.style(console.formatter("green;bold", "✅ packTable"), console.formatter("gray", `${headers.length} cols × ${data.length} rows → ${b64.length} chars`));
    return b64;
  };

  /** ── copy override ──────────────────────────────────────────────────────── **/

  let abort;
  const _c = window.copy;
  window.copy = (v) => {
    if (abort) abort.abort();
    abort = new AbortController();
    const trigger = () => {
      _c(v);
      if (console.style) console.style(console.formatter("green;bold", "✅ Copied:"), console.formatter("gray", v));
      abort = null;
    };
    if (console.style) console.style(console.formatter("orange;bold", "🖱️ Click page to copy..."));
    document.addEventListener('click', trigger, { once: true, signal: abort.signal });
  };

  /** ── Console formatter ──────────────────────────────────────────────────── **/

  const f = (spec, txt, border) => {
    const css = spec.split(";").map(x =>
      f.css[x] ||
      (x.match(/^\d+$/) ? `font-size:${x}px` : "") ||
      (x.startsWith("bg-") ? `background:${x.slice(3)}` : "") ||
      (x.startsWith("p-") ? `padding:${x.slice(2)}px` : "") ||
      (x ? `color:${x}` : "")
    ).join(";") + (border ? `;border:${border}` : "");
    return { t: `%c${txt}`, c: css };
  };

  f.css = { bold: "font-weight:bold", italic: "font-style:italic", underline: "text-decoration:underline", strike: "text-decoration:line-through" };
  f.agg = a => {
    const fmt = [], args = [];
    for (const x of a)
      x?.t ? (fmt.push(x.t), args.push(x.c)) : (fmt.push(typeof x == "string" ? x : "%o"), typeof x !== "string" && args.push(x));
    return [fmt.join(" "), ...args];
  };

  console.formatter  = f;
  console.style      = (...a) => console.log(...f.agg(a));
  console.styleGroup = (c, ...a) => (c ? console.groupCollapsed : console.group)(...f.agg(a));
  console.nest       = (lbl, fn, c = true) => { console.styleGroup(c, f("bold", lbl)); try { fn(); } finally { console.groupEnd(); } };

  /** ── Console methods ────────────────────────────────────────────────────── **/

  console.box = (hdr, msg) => {
    const w = Math.max(hdr.length, msg.length) + 6;
    const line = (t, c) => f(c, `║ ${t.padEnd(w - 4)} ║\n`);
    const rule = (s, e) => f("bold;green", s + "═".repeat(w - 2) + e);
    console.style(rule(" ╔", "╗\n"), line(hdr.padStart(hdr.length + (w - 4 - hdr.length) / 2), "bold;green"), line(msg.padStart(msg.length + (w - 4 - msg.length) / 2), "gray"), rule("╚", "╝"));
  };

  console.detail = (n, i = 0) => {
    if (!(n instanceof Element)) return;
    const segs = sig.path(n).split('/'), last = segs.pop();
    const r = n.getClientRects?.()?.[0];
    console.styleGroup(!r, f("orange;bold", `[${i}]`), f("gray", ` ${segs.join('/')}/`), f("black;bold", last));
    return r;
  };

  console.see = (inp = '*', filt, fn = x => x) => {
    let els;
    try {
      if (typeof inp === "string") els = ea(inp);
      else if (inp instanceof Element) els = [inp];
      else if (inp === document) els = [document.documentElement];
      else els = [...inp];
    } catch (e) {
      return console.warn("console.see: Input is not a string, Element, or Iterable.", inp);
    }

    els = _f(filt, els);

    els.forEach((n, i) => {
      if (!(n instanceof Element) || !console.detail(n, i)) return console.groupEnd();
      const r = n.getClientRects()[0];
      const info = r ? ` x:${rect.x(n)} y:${rect.y(n)} w:${rect.w(n)} h:${rect.h(n)}` : "";
      console.style(f("#123;bold", sig.tag(n)), f("#E62;bold", n.id ? "#" + n.id : ""), f("#26E;bold", n.classList.length ? "." + [...n.classList].join(".") : ""), f("p-1;#345;italic;border:1px solid #ccc", info), n);

      const t = text.own.clean(n);
      if (t) {
        const style = n.tagName === "SCRIPT" ? "#569cd6;italic" : (n.tagName === "STYLE" ? "#c586c0;italic" : "green;14");
        console.style("\n", f(style + ";p-1;border:2px dashed #FCE790", t.length > 100 ? t.slice(0, 100) + "…" : t));
      }

      const res = typeof fn === "string" ? fn.split(",").map(k => n[k.trim()]) : fn(n, i);
      if (res !== n) console.style(f("gray", `Result:`), f("blue;bold", typeof res === "object" ? JSON.stringify(res) : res));
      console.groupEnd();
    });
    console.see.last = els;
  };

  console.help = (obj) => {
    if (!obj) return console.box("Help", "No object");
    console.box("Help", obj.constructor?.name || typeof obj);

    const getSig = fn => {
      const s = fn.toString();
      let d = 0, i = 0;
      for (; i < s.length; i++) {
        if (s[i] == '(' || s[i] == '{') d++;
        if (s[i] == ')' || s[i] == '}') d--;
        if (s[i] == '{' && d == 1) break;
      }
      return s.slice(0, i).replace(/\s+/g, " ").trim();
    };

    const readVal = (o, k) => {
      try { return { ok: true, val: o[k] }; }
      catch { return { ok: false, val: '[Getter Exception]' }; }
    };

    const dumpProto = (p) => {
      for (const k of Object.getOwnPropertyNames(p)) {
        if (k === "constructor") continue;
        const { ok, val } = readVal(p, k);
        if (!ok || typeof val !== "function") continue;
        console.style(f("#999", k), f("gray", `args:${val.length}`), f("#555;italic", getSig(val)));
      }
    };

    const dumpOwn = (o) => {
      for (const k of Object.getOwnPropertyNames(o)) {
        const d = Object.getOwnPropertyDescriptor(o, k);
        if (d.get || d.set) {
          console.style(f("orange;bold", k), f("gray", "(accessor)"));
          continue;
        }
        const v = d.value;
        if (typeof v === "function") {
          const protoHas = (() => {
            let p = Object.getPrototypeOf(o);
            while (p) { if (Object.prototype.hasOwnProperty.call(p, k)) return p; p = Object.getPrototypeOf(p); }
            return null;
          })();
          const tag = protoHas ? (v === protoHas[k] ? "[shadows proto]" : "[OVERRIDES proto]") : "[own fn]";
          console.style(f("orange;bold", k), f("red;bold", tag), f("gray", `args:${v.length}`), f("#555;italic", getSig(v)));
        } else {
          console.style(f("orange;bold", k), v);
        }
      }
    };

    console.group("Prototype Chain");
    let p = Object.getPrototypeOf(obj);
    while (p && p !== Object.prototype) {
      console.styleGroup(true, f("bold;#09f", p.constructor?.name || "(proto)"));
      dumpProto(p);
      console.groupEnd();
      p = Object.getPrototypeOf(p);
    }
    console.groupEnd();

    console.nest("Own Properties", () => {
      console.nest("Interactive", () => dumpOwn(obj), true);
      console.nest("Serialized", () => {
        try {
          const seen = new WeakMap();
          console.log(JSON.stringify(obj, (k, v) => {
            if (typeof v === 'object' && v) {
              if (seen.has(v)) return '[Circular]';
              seen.set(v, true);
            }
            return v;
          }, 2));
        } catch (e) {
          console.log("[Error]", e);
        }
      }, true);
    }, false);
  };

  console.env = () => {
    const fEl = document.createElement("iframe"); fEl.style.display="none"; document.body.append(fEl);
    const clean = new Set(Object.keys(fEl.contentWindow)); fEl.remove();
    const vars = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(([k]) => !clean.has(k)).reduce((a, [k]) => {
      const v = window[k], t = typeof v;
      if (['$','debug','dir','table'].includes(k)) a.chrome.push(k);
      else if (t === 'function') a.func.push(k);
      else if (t === 'object' && v) a.obj.push({k, v, type: v.constructor?.name});
      else a.prim.push({k, v});
      return a;
    }, { chrome:[], func:[], obj:[], prim:[] });
    console.box("Env", `${Object.values(vars).flat().length} variables`);
    console.nest("Variables", () => {
      if (vars.func.length) console.style(f("#4da;bold", "functions:"), vars.func);
      vars.obj.sort((a,b)=>a.k.localeCompare(b.k)).forEach(x => console.style(f("#4b8bd8;bold", `${x.k} ${x.type||''}`), x.v));
      vars.prim.sort((a,b)=>a.k.localeCompare(b.k)).forEach(x => console.style(f("#aa77cc;bold", x.k+":"), x.v));
    }, false);
  };

  console.nest("Suite Loaded", () => {
    const g = (k, v) => console.style(f("bold;#4b8bd8", k.padEnd(11)), f("gray", v));
    g("Selectors", "ea(sel), glom(filt|els)");
    g("Accessors", "text, rect, sig, dom, el");
    g("Ops",       "mark, summary, unionArea");
    g("Browser",   "pop, packTable, copy");
    g("Console",   "see, help, env, style, box, nest");
   console.style(f("gray;italic", "try"), f("#345", "glom('foo').mark()"));  });

  window.look = {
    v: "initial",
    prompt(m) { this.v = window.prompt(m, this.v) ?? this.v; return this },
    toUrl(b) { return _pop.toUrl(this.v, b) },
    show() { return _pop.show(this.v) },
    pack() { return _pop.pack(this.v) },
    toString() { return this.v },
    [Symbol.toPrimitive]() { return this.v }
  };
})();

/* ══ mods/verbs.js ══════════════════════════════════════════════════ */

// console/mods/verbs.js — set-wise navigation for the glom working set.
// Requires console/base.js (glom). The set moves in lockstep: every member
// takes the same step, members whose step lands nowhere drop out, and
// glom.set dedupes and renumbers. The set stops being a bag and becomes a
// cursor over N parallel subtrees.
//
//   glom.up()            parent of each member
//   glom.up(2)           grandparent
//   glom.up('tr')        closest 'tr' ancestor (excludes self)
//   glom.up(pred)        nearest ancestor passing pred
//   glom.down('a')       first 'a' descendant per member (keeps cardinality)
//   glom.downAll('a')    every 'a' descendant, unioned
//   glom.over()          next element sibling
//   glom.over(-2)        two siblings back
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/verbs: console/base.js must load first');

  const upStep = (n, arg) => {
    if (typeof arg === 'string') return n.parentElement?.closest(arg) ?? null;
    if (typeof arg === 'function') { let c = n.parentElement; while (c && !arg(c)) c = c.parentElement; return c; }
    let c = n; for (let k = arg ?? 1; k > 0 && c; k--) c = c.parentElement;
    return c;
  };
  const overStep = (n, k) => {
    let c = n;
    while (c && k > 0) { c = c.nextElementSibling; k--; }
    while (c && k < 0) { c = c.previousElementSibling; k++; }
    return c;
  };
  const move = (name, p, stepped) => {
    const r = g.set(stepped.filter(Boolean));
    console.log(`${name}: ${p.length} → ${r.length}`);
    return r;
  };

  g.up      = (arg)   => { const p = g.get(); return move('up',      p, p.map(n => upStep(n, arg))); };
  g.over    = (k = 1) => { const p = g.get(); return move('over',    p, p.map(n => overStep(n, k))); };
  g.down    = (sel)   => { const p = g.get(); return move('down',    p, p.map(n => n.querySelector(sel))); };
  g.downAll = (sel)   => { const p = g.get(); return move('downAll', p, p.flatMap(n => [...n.querySelectorAll(sel)])); };
})();

/* ══ mods/query.js ══════════════════════════════════════════════════ */

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
  if (!window.ea) return console.warn('mods/query: console/base.js must load first');
  const SCOPE = 'body *:not(script):not(style)';

  const clean = s => s.trim().replace(/\s+/g, ' ');
  const own  = n => clean([...n.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join(''));
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

  const docOrder = els => [...new Set(els)].sort((a, b) =>
    a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

  const upStep = (n, arg) => {
    if (typeof arg === 'string') return n.parentElement?.closest(arg) ?? null;
    let c = n; for (let k = arg; k > 0 && c; k--) c = c.parentElement;
    return c;
  };
  const overStep = (n, k) => {
    let c = n;
    while (c && k > 0) { c = c.nextElementSibling; k--; }
    while (c && k < 0) { c = c.previousElementSibling; k++; }
    return c;
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

/* ══ mods/grow.js ═══════════════════════════════════════════════════ */

// console/mods/grow.js — by-example expansion of the working set.
// Requires console/base.js (glom, ea).
//
//   glom.grow()                expand current members to everything alike
//   glom.grow({classes: false})  match on tag-path alone
//   glom.alike(el)             fresh set from one example element
//
// Fingerprint: the unindexed tag path from the root (html/body/table/tbody/tr)
// plus, when a path has two or more examples, the classes those examples
// share. Two examples define what "alike" means far better than one (the
// SelectorGadget insight): shared classes survive the intersection, hashy
// per-instance classes (css-1a2b3c) wash out. A single example can't say
// which of its classes matter, so it matches on structure alone.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/grow: console/base.js must load first');
  const SCOPE = 'body *:not(script):not(style)';

  const upath = n => {
    const p = [];
    for (let c = n; c && c.nodeType === 1; c = c.parentElement) p.unshift(c.tagName.toLowerCase());
    return p.join('/');
  };

  const expand = (members, { classes = true } = {}) => {
    if (!members.length) { console.warn('grow: empty set — glom or pick something first'); return []; }
    const req = new Map();   // upath → { classes: Set (intersection), count }
    for (const n of members) {
      const key = upath(n), r = req.get(key);
      if (!r) req.set(key, { classes: new Set(n.classList), count: 1 });
      else { r.count++; for (const c of r.classes) if (!n.classList.contains(c)) r.classes.delete(c); }
    }
    if (classes && [...req.values()].every(r => r.count < 2))
      console.log('grow: single example — matching structure alone; pick two for class-aware growth');
    return ea(SCOPE).filter(n => {
      const r = req.get(upath(n));
      if (!r) return false;
      if (!classes || r.count < 2) return true;
      return [...r.classes].every(c => n.classList.contains(c));
    });
  };

  g.grow = opts => {
    const p = g.get();
    const r = g.set([...new Set([...p, ...expand(p, opts)])]);
    console.log(`grow: ${p.length} → ${r.length}`);
    return r;
  };
  g.alike = (el, opts) => g.set(expand([el].filter(n => n instanceof Element), opts));
})();

/* ══ mods/pick.js ═══════════════════════════════════════════════════ */

// console/mods/pick.js — click-to-collect mode for the glom working set.
// Requires console/base.js (glom).
//
//   glom.pick()        arm the page: hover shows a dashed outline, click
//                      toggles membership (badges update live), Esc or
//                      glom.pick.done() finishes and reports the set.
//
// Picks are additive to the current working set; click a member again to
// remove it. Clicks are swallowed (capture phase, stopImmediatePropagation)
// so picking a link doesn't navigate.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/pick: console/base.js must load first');
  let finish = null;

  g.pick = () => {
    if (finish) return console.warn('pick: already active — Esc or glom.pick.done() to finish');
    const doc = document;
    const style = Object.assign(doc.createElement('style'), { id: 'glom-pick-style' });
    style.textContent = '[data-glom-hover]{outline:2px dashed #f59e0b !important; cursor:copy !important}';
    doc.head.append(style);

    let hover = null;
    const setHover = el => {
      hover?.removeAttribute('data-glom-hover');
      (hover = el)?.setAttribute('data-glom-hover', '');
    };
    const onMove = e => setHover(e.target instanceof Element && e.target !== doc.documentElement ? e.target : null);
    const onClick = e => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const cur = new Set(g.get());
      cur.has(el) ? cur.delete(el) : cur.add(el);
      g.set([...cur]);
      g.mark();
    };
    const onKey = e => { if (e.key === 'Escape') g.pick.done(); };

    doc.addEventListener('pointermove', onMove, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKey, true);
    finish = () => {
      doc.removeEventListener('pointermove', onMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKey, true);
      setHover(null);
      style.remove();
      finish = null;
      console.log(`pick: done — ${g.get().length} in set`);
      return g.get();
    };
    console.log('pick: click to toggle membership, Esc to finish');
  };

  g.pick.done = () => finish ? finish() : (console.warn('pick: not active'), g.get());
})();

console.style?.(console.formatter?.('gray;italic', 'mods'), console.formatter?.('#345', 'verbs, query, grow, pick'));
