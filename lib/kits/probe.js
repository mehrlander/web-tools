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
  const span = (cls, text) => {
    const el = document.createElement('span');
    if (cls) el.className = cls;
    el.textContent = text == null ? '' : String(text);
    return el;
  };
  const row = (...kids) => {
    const el = document.createElement('div');
    for (const k of kids) el.appendChild(k);
    return el;
  };

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
    const foot = row(span('wt-p-dim', 'alt+shift+ P file \u00b7 H hold \u00b7 M move \u00b7 C clear'));
    if (fileNote) foot.appendChild(span('wt-p-hot', '  ' + fileNote));
    f.appendChild(foot);
    return f;
  }

  function draw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      const box = ensure();
      if (!box) return;
      while (box.firstChild) box.removeChild(box.firstChild);
      box.appendChild(render());
    });
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

  async function file(reason) {
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
  addEventListener('keydown', (ev) => {
    if (!ev.altKey || !ev.shiftKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.code === KEY_FILE) { ev.preventDefault(); log('probe:file'); file(); }
    else if (ev.code === KEY_CLEAR) { ev.preventDefault(); trace.length = 0; lastUnder = ''; draw(); }
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
  }, true);

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
