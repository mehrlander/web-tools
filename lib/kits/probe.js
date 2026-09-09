// probe.js — the page shows its own conditions, so a screenshot carries them.
//
// ── The gap this closes ────────────────────────────────────────────────────
//
// A pointer bug reproduces on the reader's machine and nowhere else. The
// reader can send a screenshot, which shows the symptom and none of the
// reasons, or a console dump, which needs devtools open and throws away the
// geometry that IS the bug. Six rounds of "it is still broken" were spent in
// that gap on budget-drs's submittal page, where three popup mechanisms with
// three different close contracts all present as "the tooltip will not go
// away" and a still frame cannot tell them apart.
//
// So the page draws its own conditions in the corner, and the screenshot the
// reader was going to send anyway carries them. That is the whole idea. The
// filing half below is a convenience on top of it, not the point.
//
// ── Why the trace is in the picture and not only in the log ────────────────
//
// A live state readout answers "what is true now" and loses the sequence. A
// handler that declines to act leaves no trace in the state at all: a card
// that stayed open because its guard bailed looks exactly like a card whose
// guard never ran. So the overlay carries a ROLLING TRACE of decisions beside
// the state, newest last, and every refusal is a line. One screenshot then
// shows what is true, what happened, and which door was tried and refused.
//
// ── What it must never do ──────────────────────────────────────────────────
//
// **It must never be the pointer's target.** The overlay is
// `pointer-events: none` at its root with no exception anywhere inside it,
// because the class of bug it exists to watch is decided by hit-testing. An
// instrument that can be hovered changes the behaviour it is measuring, and
// the session is then spent chasing the instrument. This is the one rule here
// that is not a preference.
//
// It must not throw into the page it watches, so every read is guarded and
// every listener is passive. It must not be reachable by accident: nothing
// renders unless the address asks for it.
//
// ── Using it ───────────────────────────────────────────────────────────────
//
//   gh.load('kits/probe.js')            // self-starts when ?probe= is set
//
//   Probe.watch('obs', () => `open=${d.obs.open}`)   // a live line
//   Probe.log('call:hideObs', 'timer=set')           // a trace line
//   Probe.file()                                     // commit the capture
//
// It picks up `Card.wire`'s guard decisions on its own (card.js reports to
// `window.__cardProbe`), so a page using the card kit gets its popups traced
// with no taps at all. `watch` and `log` are for what only the page knows: its
// own component state and its own handlers.
//
// A page adopts it in one line and pays nothing when the address is silent:
// with no `?probe=` the kit defines `Probe` as a set of no-ops and draws
// nothing.
(() => {
  const KEY_FILE = 'KeyP';    // alt+shift+P — file the capture
  const KEY_CLEAR = 'KeyC';   // alt+shift+C — clear the trace
  const KEY_HOLD = 'KeyH';    // alt+shift+H — freeze / unfreeze the trace
  const KEY_MOVE = 'KeyM';    // alt+shift+M — hop to the next corner
  const KEY_WIN = 'KeyW';     // alt+shift+W — pop out into a real window
  const MAX_TRACE = 400;      // retained
  const SHOW_TRACE = 18;      // drawn
  const ID = Math.random().toString(36).slice(2, 6);

  const param = (k) => {
    try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; }
  };
  const on = (() => {
    const v = param('probe');
    return v !== null && v !== '' && v !== 'off';
  })();

  // ── The no-op shape, so an adopting page never branches ──────────────────
  // A page that calls Probe.log in a hot handler must not pay for a string it
  // will not show, so log takes its detail lazily where it matters and the
  // no-op returns immediately either way.
  if (!on) {
    window.Probe = {
      on: false, id: ID,
      log() {}, watch() {}, unwatch() {}, file() { return Promise.resolve({ ok: false, why: 'probe off' }); },
      state() { return {}; }, trace() { return []; },
    };
    return;
  }

  // ── The overlay's own CSS ────────────────────────────────────────────────
  //
  // Carried as a string rather than as Tailwind classes, the way card.js
  // carries its ✕. This has to draw on any page that loads it, including one
  // with no Tailwind and one whose own utilities are layered in a way this
  // cannot know, so it brings everything it needs and inherits nothing.
  //
  // `pointer-events:none` appears on the root and is not overridden anywhere
  // below it. Read the top of this file before changing that.
  const CSS = `
#wt-probe{position:fixed;z-index:2147483646;pointer-events:none;
  font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  max-width:min(46rem,calc(100vw - 16px));max-height:calc(100vh - 16px);
  color:#e8edf3;background:rgba(15,18,24,.93);border:1px solid rgba(255,255,255,.18);
  border-radius:8px;padding:7px 9px;box-shadow:0 6px 24px rgba(0,0,0,.45);
  white-space:pre;overflow:hidden;text-shadow:0 1px 0 rgba(0,0,0,.6)}
#wt-probe b{font-weight:600;color:#fff}
#wt-probe .wt-p-head{color:#8fb7ff}
#wt-probe .wt-p-rule{color:rgba(255,255,255,.22)}
#wt-probe .wt-p-yes{color:#7ee0a2}
#wt-probe .wt-p-no{color:#ff9d9d}
#wt-probe .wt-p-dim{color:rgba(232,237,243,.5)}
#wt-probe .wt-p-hot{color:#ffd479}
/* Four corners, because the overlay will otherwise sit on top of the thing
   under investigation. It cannot be dragged: dragging needs the pointer, and
   the pointer is the one thing this may never take. So it hops, on a key. */
#wt-probe[data-corner="br"]{right:8px;bottom:8px}
#wt-probe[data-corner="bl"]{left:8px;bottom:8px}
#wt-probe[data-corner="tl"]{left:8px;top:8px}
#wt-probe[data-corner="tr"]{right:8px;top:8px}
`;
  const CORNERS = ['br', 'bl', 'tl', 'tr'];
  let corner = 0;

  // ── Drawn as NODES, never as a string of markup ──────────────────────────
  //
  // Two reasons, and the second is the one that decided it. The estate keeps
  // exactly one HTML-escape helper, window.esc in lib/vanilla-bundle.js
  // (one-escape-helper.test.mjs holds the shelf at one), and a kit that must
  // draw on any page cannot assume the bundle is loaded there, so a local copy
  // was the only way to interpolate safely and a local copy is what the rule
  // forbids. Building the overlay out of text nodes needs neither.
  //
  // And it is the right shape on its own terms. EVERY string on this overlay
  // comes from the page being watched: a class name, a note id, an error
  // message, a watcher's own output. A diagnostic that interpolates the DOM it
  // is observing into innerHTML aims the hazard at the person holding it, and
  // this one is meant to be handed to a reader whose page is already
  // misbehaving.
  // Bound to a document rather than assuming this one, because the window mode
  // below builds into a SECOND document and a node made by the wrong one is
  // rejected on append. Two lines of indirection that remove a whole class of
  // cross-document mistake.
  const nodes = (doc) => ({
    span: (cls, text) => {
      const el = doc.createElement('span');
      if (cls) el.className = cls;
      el.textContent = text == null ? '' : String(text);
      return el;
    },
    row: (...kids) => {
      const el = doc.createElement('div');
      for (const k of kids) el.appendChild(k);
      return el;
    },
  });
  const { span, row } = nodes(document);

  // ── What is true, asked of the page rather than remembered ───────────────
  //
  // Everything here is read at draw time. A cached answer is how a readout
  // starts lying, which is the one failure an instrument cannot afford: a
  // wrong line here sends the reading of the whole capture off.
  const watchers = new Map();
  const t0 = performance.now();
  const stamp = () => (performance.now() - t0) / 1000;

  const trace = [];
  let held = false;
  let lastUnder = '';

  // A tag says which door and which verdict, so the trace reads as a sequence
  // of decisions rather than a list of events. Kept short: the value of the
  // overlay is that sixteen of these fit in a screenshot and stay legible.
  function log(tag, detail) {
    if (held) return;
    const t = stamp();
    const last = trace.length ? trace[trace.length - 1] : null;
    const tg = String(tag), dt = detail == null ? '' : String(detail);
    // RUN-LENGTH, because a repeat is one fact and sixteen lines are the whole
    // budget. A guard firing on every frame of a scroll is worth one line
    // saying so with a count, and worth losing the fifteen lines above it for
    // nothing. The retained trace collapses the same way, so the filed capture
    // and the drawn tail cannot tell different stories.
    if (last && last.tag === tg && last.detail === dt) {
      last.n = (last.n || 1) + 1;
      last.t = t;
      draw();
      return;
    }
    const prev = last ? last.t : t;
    trace.push({ t, d: t - prev, tag: tg, detail: dt, n: 1 });
    if (trace.length > MAX_TRACE) trace.shift();
    draw();
  }

  // ── The element under the pointer, which is what a hit-test bug is about ──
  //
  // Logged on CHANGE rather than on every move: the pointer guard in card.js
  // keys on the element the pointer arrives over, so the arrivals are the
  // events and the moves between them are noise. Passive and rAF-coalesced, so
  // watching costs the page nothing it would notice.
  let px = -1, py = -1, pending = false;
  function describe(el) {
    if (!el) return '(none)';
    const bits = [el.tagName.toLowerCase()];
    if (el.id) bits.push('#' + el.id);
    const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) bits.push('.' + cls.join('.'));
    for (const a of ['data-obs', 'data-note', 'data-guide']) {
      if (el.closest && el.closest('[' + a + ']')) bits.push('[' + a + ']');
    }
    return bits.join('');
  }
  addEventListener('pointermove', (ev) => {
    px = ev.clientX; py = ev.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      let el = null;
      try { el = document.elementFromPoint(px, py); } catch (e) {}
      const d = describe(el);
      if (d !== lastUnder) { lastUnder = d; log('under', d); }
      draw();
    });
  }, { passive: true, capture: true });

  // ── card.js reports here ─────────────────────────────────────────────────
  //
  // The whole reason the hook exists: a guard's refusal is invisible from
  // outside and is the answer more often than its firing is. Chained rather
  // than assigned, so a page that already had a listener keeps it.
  const prevHook = window.__cardProbe;
  window.__cardProbe = (tag, el, detail) => {
    sawCard = true;
    const name = (detail && detail.name) || (el && el.id) || '?';
    const rest = detail ? Object.keys(detail).filter((k) => k !== 'name')
      .map((k) => k + '=' + detail[k]).join(' ') : '';
    log('card:' + tag, (name + (rest ? ' ' + rest : '')).trim());
    if (typeof prevHook === 'function') { try { prevHook(tag, el, detail); } catch (e) {} }
  };

  // Whether the loaded card.js can report at all. A capture taken against a
  // build without the hook is still worth having, and saying so on its face is
  // what stops it being read as "no guard ever fired".
  //
  // Asked twice, and the second answer is the one that settles it. The source
  // test looks for the CALL inside `wire`, not for the hook's name, which
  // lives in the kit's closure and never appears in `wire.toString()`: reading
  // for `__cardProbe` there reported "no hook" on a build that was reporting
  // fine, which is an instrument lying about its own reach. Once anything has
  // actually arrived, `sawCard` is proof and no source test is needed.
  let sawCard = false;
  const hookable = () => {
    if (sawCard) return true;
    try { return !!(window.Card && String(window.Card.wire).indexOf('tell(') >= 0); }
    catch (e) { return false; }
  };

  // ── Drawing ──────────────────────────────────────────────────────────────
  let el = null, drawPending = false;
  function ensure() {
    if (el) return el;
    if (!document.body) return null;
    if (!document.getElementById('wt-probe-css')) {
      const st = document.createElement('style');
      st.id = 'wt-probe-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    el = document.createElement('div');
    el.id = 'wt-probe';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-corner', CORNERS[corner]);
    document.body.appendChild(el);
    return el;
  }

  function env() {
    const g = (fn, f = null) => { try { const v = fn(); return v === undefined ? f : v; } catch (e) { return f; } };
    return {
      hover: g(() => matchMedia('(hover: hover)').matches),
      anyHover: g(() => matchMedia('(any-hover: hover)').matches),
      coarse: g(() => matchMedia('(pointer: coarse)').matches),
      touch: g(() => navigator.maxTouchPoints, 0),
      framed: g(() => window !== window.top),
      w: g(() => innerWidth), h: g(() => innerHeight),
      card: g(() => typeof window.Card === 'object'),
      hook: hookable(),
    };
  }

  function render() {
    const e = env();
    const f = document.createDocumentFragment();
    const yn = (v) => span(v ? 'wt-p-yes' : 'wt-p-no', v ? 'yes' : 'no');
    const id = document.createElement('b');
    id.textContent = ID;

    const head = row(span('wt-p-head', 'probe '), id,
                     span('wt-p-dim', '  ' + stamp().toFixed(1) + 's'));
    if (held) head.appendChild(span('wt-p-hot', '  HELD'));
    f.appendChild(head);

    f.appendChild(row(span('wt-p-dim', 'card.js '), yn(e.card),
                      span('wt-p-dim', '  probe hook '), yn(e.hook),
                      span('wt-p-dim', '  framed '), yn(e.framed)));
    f.appendChild(row(span('wt-p-dim', 'hover '), yn(e.hover),
                      span('wt-p-dim', '  any-hover '), yn(e.anyHover),
                      span('wt-p-dim', '  coarse '), yn(e.coarse),
                      span('wt-p-dim', '  touch ' + e.touch + '  ' + e.w + '\u00d7' + e.h)));

    for (const [name, fn] of watchers) {
      let v;
      try { v = fn(); } catch (err) { v = '!' + (err && err.message); }
      f.appendChild(row(span('wt-p-dim', name + ' '), span('', v)));
    }
    f.appendChild(row(span('wt-p-dim', 'under '), span('', lastUnder || '(no pointer yet)')));
    f.appendChild(row(span('wt-p-rule', '\u2500'.repeat(46))));

    const tail = trace.slice(-SHOW_TRACE);
    for (const r of tail) {
      const hot = /close|arm|esc/.test(r.tag) ? 'wt-p-hot' : '';
      const line = row(span('wt-p-dim', r.t.toFixed(2).padStart(6) + ' +' + r.d.toFixed(2) + ' '),
                       span(hot, r.tag.padEnd(16) + ' '),
                       span('wt-p-dim', r.detail));
      if (r.n > 1) line.appendChild(span('wt-p-hot', ' \u00d7' + r.n));
      f.appendChild(line);
    }
    if (!tail.length) f.appendChild(row(span('wt-p-dim', '(no events yet)')));

    f.appendChild(row(span('wt-p-rule', '\u2500'.repeat(46))));
    const foot = row(span('wt-p-dim', 'alt+shift+ W window \u00b7 P file \u00b7 H hold \u00b7 M move \u00b7 C clear'));
    if (fileNote) foot.appendChild(span('wt-p-hot', '  ' + fileNote));
    f.appendChild(foot);
    return f;
  }

  function draw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      // ONE SURFACE AT A TIME. With the window up, the overlay collapses to a
      // single line rather than vanishing: a reader who has moved the panel to
      // another screen still needs the page itself to say where it went, and a
      // window closed by the browser's own chrome has to leave something
      // behind that can bring it back.
      const detached = drawWindow();
      const box = ensure();
      if (!box) return;
      while (box.firstChild) box.removeChild(box.firstChild);
      box.appendChild(detached ? renderStub() : render());
    });
  }

  function renderStub() {
    const f = document.createDocumentFragment();
    f.appendChild(row(span('wt-p-head', 'probe '), span('wt-p-hot', ID),
                      span('wt-p-dim', '  in its own window \u00b7 alt+shift+W to bring it back')));
    return f;
  }

  // ── THE WINDOW, which is the overlay with the one constraint lifted ───────
  //
  // The overlay may never take the pointer, because the bug class it watches
  // is decided by hit-testing. That rule costs it everything a panel usually
  // has: no button, no scrollbar, no selectable text, no dragging, and a size
  // that has to stay out of the way of the page underneath. A SEPARATE WINDOW
  // is not part of the watched document at all, so it keeps the rule
  // absolutely while paying none of it. It can carry a real button, show the
  // whole trace instead of the last eighteen, and sit on another screen.
  //
  // It cannot open by itself. `window.open` without a user gesture is a popup
  // blocker's whole purpose, so this opens on a key and never on load. The
  // overlay stays the default and stays the phone-capable half, since no key
  // reaches it there.
  //
  // WRITTEN INTO DIRECTLY, not through postMessage. An about:blank window
  // opened from this document inherits its origin, so `w.document` is reachable
  // and there is no channel to build or keep in step. Where that fails, which
  // is a page on an opaque origin (the toss shell's payload mode, `#gz=`), the
  // attempt is caught and the overlay says so rather than leaving a blank
  // window and no explanation.
  let win = null, winWatch = null;
  const winAlive = () => { try { return !!(win && !win.closed && win.document); } catch (e) { return false; } };

  const WIN_CSS = `
:root{color-scheme:dark}
body{margin:0;background:#0f1218;color:#e8edf3;
  font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
h2{margin:0;padding:9px 14px 7px;font:600 10px/1 ui-monospace,monospace;
  letter-spacing:.12em;text-transform:uppercase;color:#8fb7ff;
  border-bottom:1px solid rgba(255,255,255,.10)}
.wt-head{display:flex;align-items:baseline;gap:10px;padding:11px 14px;
  border-bottom:1px solid rgba(255,255,255,.16)}
.wt-head b{font-size:15px;color:#fff}
.wt-sec{padding:9px 14px 13px}
.wt-kv{display:grid;grid-template-columns:11.5rem 1fr;gap:2px 10px}
.wt-kv > span:nth-child(odd){color:rgba(232,237,243,.45)}
.wt-trace{padding:2px 14px 13px;max-height:42vh;overflow:auto;white-space:pre}
.wt-file{border-top:1px solid rgba(255,255,255,.16);padding:12px 14px 16px;
  background:rgba(255,255,255,.03)}
.wt-file p{margin:0 0 8px;max-width:62ch;color:rgba(232,237,243,.78)}
.wt-file ul{margin:0 0 10px;padding-left:1.1rem;max-width:62ch;
  color:rgba(232,237,243,.62)}
.wt-file li{margin:1px 0}
.wt-path{display:block;margin:6px 0 10px;padding:7px 10px;border-radius:6px;
  background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);color:#ffd479}
button{font:inherit;padding:7px 14px;border-radius:6px;cursor:pointer;
  border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);color:#fff}
button:hover{background:rgba(255,255,255,.18)}
button:disabled{opacity:.5;cursor:default}
.wt-keys{margin-top:10px;color:rgba(232,237,243,.42)}
.wt-yes{color:#7ee0a2}.wt-no{color:#ff9d9d}.wt-hot{color:#ffd479}
.wt-dim{color:rgba(232,237,243,.45)}.wt-rule{color:rgba(255,255,255,.20)}
`;

  // WHAT FILING ACTUALLY DOES, in the reader's words rather than the kit's.
  // Written out because the honest version is longer than a key hint and a
  // reader deciding whether to press it is owed the whole answer: where the
  // file goes, who writes it, what is in it, and what is not. The counts are
  // read at draw time so the sentence describes THIS capture rather than a
  // capture in general.
  function fileExplainer(doc) {
    const { span, row } = nodes(doc);
    const cfg = (window.PageReport && window.PageReport.config) || {};
    const repo = cfg.repo || 'mehrlander/web-tools-private';
    const dir = cfg.dir || 'logs/page';
    const day = new Date().toISOString().slice(0, 10);
    const page = (() => { try { return location.pathname.split('/').pop() || 'index'; } catch (e) { return 'page'; } })();

    const wrap = doc.createElement('div');
    wrap.className = 'wt-file';
    const h = doc.createElement('h2');
    h.textContent = 'File a capture';
    h.style.padding = '0 0 8px';
    h.style.border = '0';
    wrap.appendChild(h);

    const p1 = doc.createElement('p');
    p1.textContent = 'One press writes a single JSON file into your own private repository. '
      + 'It is written from this browser with the GitHub token already stored here. '
      + 'No server sees it and nothing goes anywhere else.';
    wrap.appendChild(p1);

    const path = doc.createElement('code');
    path.className = 'wt-path';
    path.textContent = repo + '  ' + dir + '/' + day + '/' + page + '-<time>-<tag>.json';
    wrap.appendChild(path);

    const p2 = doc.createElement('p');
    p2.textContent = 'What goes in:';
    wrap.appendChild(p2);
    const inList = doc.createElement('ul');
    for (const t of [
      'the conditions above, exactly as shown',
      'the whole trace, ' + trace.length + ' entries so far, not only the ones drawn above',
      'every popup panel on screen at the moment you press: its id, size, position, computed pointer-events and opacity, and the first 300 characters of its text',
      'the pointer\u2019s last position and the element under it',
      'your browser, viewport, language and timezone',
      'what this page loaded: request count, total bytes, and the addresses of the eight slowest requests',
      'this page\u2019s own address',
    ]) { const li = doc.createElement('li'); li.textContent = t; inList.appendChild(li); }
    wrap.appendChild(inList);

    const p3 = doc.createElement('p');
    p3.textContent = 'What does not:';
    wrap.appendChild(p3);
    const outList = doc.createElement('ul');
    for (const t of [
      'the token itself, cookies, or anything else in local storage',
      'form values, or any page text beyond the panel excerpts named above',
    ]) { const li = doc.createElement('li'); li.textContent = t; outList.appendChild(li); }
    wrap.appendChild(outList);

    const p4 = doc.createElement('p');
    p4.textContent = 'The file is named with the load id ' + ID + ', the same four characters at the '
      + 'top of this window, so a screenshot and a capture pair up without reconciling clocks.';
    wrap.appendChild(p4);

    // The button's own state is held OUTSIDE it, because this whole panel is
    // rebuilt on every pointer move and a label set on the element would be
    // gone before the write returned. `filing` survives the redraw; `fileNote`
    // carries the outcome afterwards and is the single place either surface
    // reads it from.
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.disabled = filing;
    btn.textContent = filing ? 'Filing\u2026' : 'File the capture';
    btn.addEventListener('click', () => {
      if (filing) return;
      log('probe:file', 'from the window');
      file();
    });
    wrap.appendChild(btn);

    // Its own line, not tacked onto the key hints: this is the answer to the
    // press and the hints are a standing reference, so running them together
    // reads as one sentence and is how "not filed: no token" got lost.
    if (fileNote) {
      const n = doc.createElement('div');
      n.className = 'wt-keys';
      n.style.marginTop = '10px';
      n.appendChild(span('wt-hot', fileNote));
      wrap.appendChild(n);
    }

    const keys = doc.createElement('div');
    keys.className = 'wt-keys';
    keys.textContent = 'alt+shift+ P file \u00b7 H hold \u00b7 C clear \u00b7 W close this window';
    wrap.appendChild(keys);
    return wrap;
  }

  function renderWindow(doc) {
    const { span, row } = nodes(doc);
    const e = env();
    const f = doc.createDocumentFragment();
    const yn = (v) => span(v ? 'wt-yes' : 'wt-no', v ? 'yes' : 'no');

    const head = doc.createElement('div');
    head.className = 'wt-head';
    const b = doc.createElement('b');
    b.textContent = 'Probe ' + ID;
    head.appendChild(b);
    head.appendChild(span('wt-dim', (() => { try { return location.pathname.split('/').pop(); } catch (x) { return ''; } })()));
    head.appendChild(span('wt-dim', stamp().toFixed(1) + 's'));
    if (held) head.appendChild(span('wt-hot', 'HELD'));
    f.appendChild(head);

    const h1 = doc.createElement('h2'); h1.textContent = 'Conditions'; f.appendChild(h1);
    const sec = doc.createElement('div'); sec.className = 'wt-sec';
    const kv = doc.createElement('div'); kv.className = 'wt-kv';
    const pair = (k, v) => { kv.appendChild(span('', k)); kv.appendChild(typeof v === 'string' ? span('', v) : v); };
    pair('card.js', yn(e.card));
    pair('probe hook', yn(e.hook));
    pair('hover', yn(e.hover));
    pair('any-hover', yn(e.anyHover));
    pair('pointer coarse', yn(e.coarse));
    pair('touch points', String(e.touch));
    pair('framed', yn(e.framed));
    pair('viewport', e.w + ' \u00d7 ' + e.h);
    for (const [name, fn] of watchers) {
      let v; try { v = fn(); } catch (err) { v = '!' + (err && err.message); }
      pair(name, String(v));
    }
    pair('under pointer', lastUnder || '(no pointer yet)');
    sec.appendChild(kv);
    f.appendChild(sec);

    const h2 = doc.createElement('h2');
    h2.textContent = 'Decisions \u00b7 ' + trace.length + ' entries, newest last';
    f.appendChild(h2);
    const tr = doc.createElement('div'); tr.className = 'wt-trace';
    for (const r of trace) {
      const hot = /close|arm|esc/.test(r.tag) ? 'wt-hot' : '';
      const line = row(span('wt-dim', r.t.toFixed(2).padStart(7) + ' +' + r.d.toFixed(2) + '  '),
                       span(hot, r.tag.padEnd(18)),
                       span('wt-dim', r.detail));
      if (r.n > 1) line.appendChild(span('wt-hot', '  \u00d7' + r.n));
      tr.appendChild(line);
    }
    if (!trace.length) tr.appendChild(row(span('wt-dim', '(no events yet)')));
    f.appendChild(tr);

    f.appendChild(fileExplainer(doc));
    return f;
  }

  function drawWindow() {
    if (!winAlive()) return false;
    const doc = win.document;
    const body = doc.body;
    if (!body) return false;
    // The trace pane is the one thing a reader scrolls, so its position is kept
    // across a redraw: a pane that jumps to the top on every pointer move is
    // unreadable while the page is being worked.
    const old = doc.querySelector('.wt-trace');
    const atBottom = old ? (old.scrollHeight - old.scrollTop - old.clientHeight < 24) : true;
    const keep = old ? old.scrollTop : 0;
    while (body.firstChild) body.removeChild(body.firstChild);
    body.appendChild(renderWindow(doc));
    const pane = doc.querySelector('.wt-trace');
    if (pane) pane.scrollTop = atBottom ? pane.scrollHeight : keep;
    return true;
  }

  function openWindow() {
    if (winAlive()) { try { win.focus(); } catch (e) {} return true; }
    let w = null;
    try { w = window.open('', 'wt-probe-' + ID, 'width=820,height=940'); } catch (e) {}
    if (!w) { note('the browser blocked the window', 6000); return false; }
    try {
      w.document.title = 'Probe ' + ID;
      const st = w.document.createElement('style');
      st.textContent = WIN_CSS;
      w.document.head.appendChild(st);
      w.addEventListener('keydown', onKey, true);
      win = w;
    } catch (e) {
      // An opaque-origin page (the toss shell's payload mode) cannot reach the
      // document it just opened. Say which, rather than leaving a blank window.
      try { w.close(); } catch (x) {}
      win = null;
      note('this page cannot write to a window (opaque origin)', 8000);
      return false;
    }
    // A window closed from its own chrome sends nothing back, so the overlay
    // would sit collapsed with no way to bring it back. The watch exists only
    // while a window does: a page that never pops out installs no timer, which
    // also keeps this kit out of the way of anything waiting for a quiet event
    // loop.
    winWatch = setInterval(() => { if (win && !winAlive()) { win = null; draw(); } }, 1000);
    log('probe:window', 'opened');
    draw();
    return true;
  }

  function closeWindow() {
    clearInterval(winWatch); winWatch = null;
    if (winAlive()) { try { win.close(); } catch (e) {} }
    win = null;
    log('probe:window', 'closed');
    draw();
  }

  // ── Filing, so a capture reaches a session without being retyped ──────────
  //
  // The overlay is the primary artifact and this is the second copy: the same
  // buffer, whole rather than the drawn tail, as JSON in a repo a session can
  // read. Both carry the load's id, so a screenshot and a filed capture join
  // on four characters rather than on a reconciled clock.
  //
  // PageReport owns the write. `send` rather than `auto` because a deliberate
  // capture is not subject to the repeat and worth gates that keep automatic
  // reporting quiet: the reader pressed a key, which is the whole signal.
  let fileNote = '';
  function note(s, ms = 4000) {
    fileNote = s;
    draw();
    setTimeout(() => { if (fileNote === s) { fileNote = ''; draw(); } }, ms);
  }

  function snapshot() {
    const live = {};
    for (const [name, fn] of watchers) {
      try { live[name] = String(fn()); } catch (e) { live[name] = '!' + (e && e.message); }
    }
    // Any panel that is on screen, measured. A capture that says a card is open
    // and cannot say where it was drawn leaves the geometry question open,
    // which on this class of bug is the question.
    const panels = [];
    try {
      for (const p of document.querySelectorAll('[id$="card"],[id$="-card"],[class*="popover"]')) {
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = p.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        panels.push({ id: p.id || null, cls: String(p.className || '').slice(0, 120),
          pointerEvents: cs.pointerEvents, opacity: cs.opacity,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          text: (p.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300) });
      }
    } catch (e) {}
    return {
      // `probeAt` and not `at`: PageReport.collect stamps its own ISO `at` and
      // then spreads this object over it, so a key named `at` here silently
      // replaced a timestamp with a number of seconds and the write failed
      // inside the reporter with `doc.at.slice is not a function`. A capture
      // that cannot be filed because the capture overwrote the filer is the
      // sort of thing this kit exists to stop happening to other people.
      probeId: ID, probe: param('probe'), probeAt: stamp(),
      environment: env(), live, pointer: { x: px, y: py, under: lastUnder },
      panels, trace: trace.slice(),
    };
  }

  let filing = false;
  async function file(reason) {
    if (filing) return { ok: false, why: 'already filing' };
    filing = true;
    try { return await fileNow(reason); } finally { filing = false; draw(); }
  }

  async function fileNow(reason) {
    const doc = snapshot();
    doc.reason = reason || 'probe:' + (param('probe') || 'on');
    // FETCHED WHEN THE KEY IS PRESSED, not carried by every adopting page.
    // Filing is the second half of this kit and most loads never reach it, so
    // a page that only ever draws the overlay should not pull the writer.
    // page-report.js loads gh-store.js the same way and for the same reason.
    if (!window.PageReport && window.gh && typeof window.gh.load === 'function') {
      note('fetching the reporter…', 15000);
      try { await window.gh.load('kits/page-report.js'); } catch (e) {}
    }
    if (!window.PageReport) {
      const why = window.gh ? 'kits/page-report.js would not load' : 'no gh on this page';
      note('not filed: ' + why, 8000);
      return { ok: false, why };
    }
    try {
      window.PageReport.watch();
      const res = await window.PageReport.send(doc);
      note(res.ok ? 'filed ' + String(res.path).split('/').pop() : 'not filed: ' + res.why, 8000);
      return res;
    } catch (e) {
      note('not filed: ' + (e && e.message));
      return { ok: false, why: String(e && e.message || e) };
    }
  }

  // ── The keys ─────────────────────────────────────────────────────────────
  //
  // alt+shift, not ctrl+shift: ctrl+shift+P is a private window in one browser
  // and a command palette in another, and a capture key that opens a browser
  // window at the moment of capture is worse than no key. Read off `code`, so
  // a non-QWERTY layout still reaches them.
  // Named rather than inline, because the window installs the SAME handler on
  // itself: whichever of the two has focus, the keys mean the same thing.
  function onKey(ev) {
    if (!ev.altKey || !ev.shiftKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.code === KEY_FILE) { ev.preventDefault(); log('probe:file'); file(); }
    else if (ev.code === KEY_CLEAR) { ev.preventDefault(); trace.length = 0; lastUnder = ''; draw(); }
    else if (ev.code === KEY_WIN) { ev.preventDefault(); winAlive() ? closeWindow() : openWindow(); }
    else if (ev.code === KEY_MOVE) {
      ev.preventDefault();
      corner = (corner + 1) % CORNERS.length;
      if (el) el.setAttribute('data-corner', CORNERS[corner]);
    }
    else if (ev.code === KEY_HOLD) {
      ev.preventDefault();
      held = !held;
      if (!held) log('probe:resume'); else draw();
    }
  }
  addEventListener('keydown', onKey, true);



  // ── The rest of the world, worth a line each ─────────────────────────────
  // These are the events card.js's geometry guards rest on, traced here too so
  // a capture distinguishes "the guard did not fire" from "the event never
  // arrived". Passive and capture-phase, so nothing here is in the page's way.
  addEventListener('scroll', (ev) => {
    const t = ev.target;
    log('win:scroll', t === document ? 'document' : describe(t && t.nodeType === 1 ? t : null));
  }, { passive: true, capture: true });
  addEventListener('resize', () => log('win:resize', innerWidth + '×' + innerHeight), { passive: true });
  addEventListener('blur', () => log('win:blur'), true);
  addEventListener('focus', () => log('win:focus'), true);
  addEventListener('visibilitychange', () => log('win:visibility', document.visibilityState));

  window.Probe = {
    on: true,
    id: ID,
    log,
    // A live line. The function is called at draw time, so it always reports
    // the page's actual state rather than what was true when it registered.
    watch(name, fn) { watchers.set(name, fn); draw(); return this; },
    unwatch(name) { watchers.delete(name); draw(); return this; },
    file,
    openWindow, closeWindow,
    get windowOpen() { return winAlive(); },
    state: snapshot,
    trace() { return trace.slice(); },
    describe,
  };

  // The first line is written whether or not there is a body to draw it in
  // yet: a kit loaded from a page's head has no document to render into, and a
  // trace that starts only once the page is parsed loses the boot, which is
  // where a load-order defect lives. `ensure` simply declines until there is a
  // body, and the next draw picks it up.
  log('probe:on', 'id=' + ID);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', draw, { once: true });
  }
})();
