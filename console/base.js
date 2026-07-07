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

  const mark = (els, spec = "red", attr = 'data-mark') => {
    els.forEach((n, i) => n.setAttribute(attr, i));

    // spec is one of two things, never a dialect: a bare color recolors mark's
    // layout-safe default (an outline), or a full CSS style string (any token
    // carrying a ':' passes through verbatim — your call, including its layout
    // cost). The rich prefix shorthand (bg-, p-, …) lives only in the console
    // formatter (f), for styling console *text*; mark deliberately does not
    // reuse it, so the two grammars can't drift into looking alike but differing.
    const w = 2, css = spec.split(";").map(x =>
      x.includes(':') ? x : `outline:${w}px solid ${x}`
    ).join(" !important;") + " !important;";

    const id = `mark-s-${attr.replace(/\W/g, '-')}`;
    const s = document.getElementById(id) || Object.assign(document.createElement('style'), { id });
    if (!s.parentNode) document.head.appendChild(s);

  s.textContent = `
      [${attr}]{${css} cursor:crosshair; transition:all 0.1s; position:relative} 
      [${attr}]:hover{outline-width:${w+1}px !important; z-index:1e5}
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

  // help() with no argument opens the visual guide (tabbed reference + live
  // fixtures) in a popup; help(obj) still inspects an object via console.help.
  // The guide is the console-playground page — canonical hosted copy, so it
  // opens from any page the suite is pasted into.
  const GUIDE_URL = 'https://mehrlander.github.io/web-tools/pages/console-playground.html';
  window.help = (obj) => {
    if (obj !== undefined) return console.help(obj);
    const w = window.open(GUIDE_URL, 'web-tools-guide', 'width=1040,height=840');
    if (!w) console.log('help: popup blocked — open the guide at', GUIDE_URL);
    return GUIDE_URL;
  };

  console.nest("Suite Loaded", () => {
    const g = (k, v) => console.style(f("bold;#4b8bd8", k.padEnd(11)), f("gray", v));
    g("Selectors", "ea(sel), glom(filt|els)");
    g("Accessors", "text, rect, sig, dom, el");
    g("Ops",       "mark, summary, unionArea");
    g("Browser",   "pop, packTable, copy");
    g("Console",   "see, help(obj), env, style, box, nest");
    g("Guide",     "help() — open the visual guide + fixtures");
   console.style(f("gray;italic", "try"), f("#345", "help()"), f("gray;italic", "or"), f("#345", "glom('foo').mark()"));  });

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
