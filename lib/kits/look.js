// look.js — look markers: a link that lands on a place in a page, says why, and can ring the control to tap.
//
// The address is the page's own fragment. Any page that boots the web-tools
// loader answers it: lib/gh-boot.js loads land.js and this kit when a fragment
// asks (LOOK_BOOT). Any other page loads both itself, Land first:
//
//   #show=<anchor>[&say=<text>]   land on it, with a message when one is given
//   #tap=<anchor>[&say=<text>]    land, then ring it and point at it until tapped
//   #walk=<name>                  a sequence the page declares, in
//                                 <script type="application/json" id="look-walks">
//                                 as { "<name>": [steps] }
//   #steps=<base64url JSON>       a sequence carried in the link itself; a
//                                 value opening with '[' is read as plain JSON
//
// A step is { at, say?, tap? }. A tap step moves on when the reader taps the
// ringed control, and the tap still reaches the page; any other step moves on
// with the dock's forward arrow, and the arrow keys walk both ways. Other
// fragment keys are left alone, so a page's own routing and a nonce ride
// beside these, and the four keys plus `say` are reserved for this kit on any
// page that loads it.
//
// AN ANCHOR IS A NAME THE PAGE DECLARES. `at` resolves, in order, to
//   data-at="<at>"     the durable kind: a name the page gives an element
//   id="<at>"          the same, for an element that already has one
//   text:<words>       the smallest element whose whole text is those words
//   css:<selector>     the first element the selector matches
// The first two are checked against a page's source by scripts/look-link.py.
// The last two exist for a page that declares nothing, which is what the toss
// renderer injects this kit into, and they break when the wording or the
// structure changes (docs/locators.md, the Quote and Selector rows).
//
// A HIDDEN TARGET IS REVEALED BY ITS REGION. A hidden ancestor carrying
// data-at-open="<anchor>" names the control that shows it, so a link into a
// closed tab opens the tab first. Regions open outermost first, each opener
// clicked once, since a second click on a toggle closes what the first opened.
// A target that still resolves to nothing visible says so on screen: a miss
// is an answer to "did this land", and silence is not.
//
// EVERY SCROLLER MOVES, THE PAGE INCLUDED. A target in a pane that is itself
// out of view has to be brought to the reader, not merely scrolled to inside a
// pane nobody can see, so the scroll is the browser's own scrollIntoView,
// centred, rather than land.js's nearest-scroller walk, which rightly leaves
// the page alone when a list beside a reader is the thing in view. Measured
// 2026-10-04 on the Land demo through a toss: Look ran before the page's
// land.js arrived, scrolled only the window, and left the target clipped in
// its pane with the tint drawn over whatever sat below it. The MARK is drawn
// here, as an overlay, because it has to show on a page with no daisyUI theme
// and no Tailwind build, where Land's class would compile to nothing; it is
// clipped to every pane the target sits in, so a target scrolled out of its
// pane takes its mark with it. It is Land's colour function with a fallback,
// so on a themed page the two are one yellow.
//
// The message arrives from a URL, so it is set as text and never as HTML.
//
//   Look.start(steps, o?)  run a sequence now, replacing any running one;
//                          o.wait caps how long an anchor may take to appear
//   Look.stop()            take every marker down
//   Look.fromHash(hash?)   the cleaned sequence a fragment asks for, or null
//   Look.fromLocation()    start whatever location.hash asks for
//   Look.find(at)          resolve one anchor, preferring a visible match
//   Look.encode(steps)     base64url JSON, the value of #steps=
//
// Starts itself: once the page has loaded, and again when the look keys in the
// fragment change. A second copy of the kit on one page defers to the first.
//
// Attaches to window.Look.

(() => {
  if (window.Look && window.Look.start) return;

  const KEYS = ['show', 'tap', 'walk', 'steps'];
  const MAX_STEPS = 50;
  const MAX_SAY = 500;
  const FIND_WAIT = 2500;   // how long an anchor may take to appear (a late render)
  const OPEN_WAIT = 1500;   // how long a revealed region may take to show
  const PAD = 4;
  const WARN = 'var(--color-warning, #facc15)';
  const tint = (pct) => `color-mix(in oklab, ${WARN} ${pct}%, transparent)`;
  const TINT = 30;          // Land's FLOW strength: the yellow of every other landing

  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };
  const shown = (el) => !!el && el.isConnected && el.getClientRects().length > 0;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const ours = (el) => !!el.closest('[data-look]');

  async function until(fn, ms, every) {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(every)) {
      const v = fn();
      if (v) return v;
    }
    return fn();
  }

  // ── resolving an anchor ─────────────────────────────────────────────────

  const prefer = (list) => list.find(shown) || list[0] || null;

  function byText(words) {
    if (!words) return null;
    const lower = words.toLowerCase();
    const all = [...document.body.querySelectorAll('*')].filter(e =>
      !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(e.tagName) && !ours(e));
    for (const same of [(t) => t === words, (t) => t.toLowerCase() === lower]) {
      const hits = all.filter(e => same(norm(e.textContent)));
      // The smallest: an element none of whose descendants also matches, so
      // `text:Export` lands on the button, not the toolbar around it.
      const leaves = hits.filter(h => !hits.some(o => o !== h && h.contains(o)));
      if (leaves.length) return prefer(leaves);
    }
    return null;
  }

  function find(at) {
    at = String(at == null ? '' : at);
    if (!at) return null;
    if (at.startsWith('css:')) {
      try { return prefer([...document.querySelectorAll(at.slice(4))].filter(e => !ours(e))); }
      catch { return null; }
    }
    if (at.startsWith('text:')) return byText(norm(at.slice(5)));
    // Compared, not selected: an anchor needs no escaping to be a name.
    const named = [...document.querySelectorAll('[data-at]')].filter(e => e.getAttribute('data-at') === at);
    return prefer(named) || document.getElementById(at);
  }

  async function reveal(at, wait) {
    const every = at.startsWith('text:') ? 200 : 80;
    const open = Math.min(wait, OPEN_WAIT);
    let el = await until(() => find(at), wait, every);
    if (!el) return null;
    if (shown(el)) return el;
    const regions = [];
    for (let p = el.parentElement; p; p = p.parentElement) if (p.hasAttribute('data-at-open')) regions.unshift(p);
    for (const region of regions) {
      if (shown(region)) continue;
      const opener = find(region.getAttribute('data-at-open'));
      if (!opener) break;
      opener.click();
      await until(() => shown(region), open, 50);
    }
    el = await until(() => { const e = find(at); return shown(e) && e; }, open, every);
    return el || null;
  }

  // ── the address ─────────────────────────────────────────────────────────

  function encode(steps) {
    const bytes = new TextEncoder().encode(JSON.stringify(steps));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(value) {
    const v = String(value).trim();
    if (v.startsWith('[')) return JSON.parse(v);
    const s = v.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  }

  // A link is untrusted input: keep the three fields, as strings and a flag.
  function clean(steps) {
    if (!Array.isArray(steps)) return null;
    const out = steps.slice(0, MAX_STEPS).filter(s => s && typeof s === 'object').map(s => ({
      at: norm(s.at),
      say: norm(s.say).slice(0, MAX_SAY),
      tap: !!s.tap,
    })).filter(s => s.at);
    return out.length ? out : null;
  }

  function fromHash(hash) {
    const p = new URLSearchParams(String(hash == null ? location.hash : hash).replace(/^#/, ''));
    if (p.has('steps')) {
      try { return clean(decode(p.get('steps'))) || [{ miss: 'This link carries no steps.' }]; }
      catch { return [{ miss: 'This link’s steps could not be read.' }]; }
    }
    if (p.has('walk')) {
      const name = p.get('walk');
      let walks = {};
      try { walks = JSON.parse(document.getElementById('look-walks')?.textContent || '{}'); } catch { /* none */ }
      return clean(walks[name]) || [{ miss: `This page declares no walk named “${name}”.` }];
    }
    const tap = p.has('tap');
    if (tap || p.has('show')) return clean([{ at: p.get(tap ? 'tap' : 'show'), say: p.get('say'), tap }]);
    return null;
  }

  // The look keys alone, so a page rewriting its own keys is not a new ask.
  const signature = (hash) => {
    const p = new URLSearchParams(String(hash).replace(/^#/, ''));
    return [...KEYS, 'say'].map(k => p.get(k)).join('\u0000');
  };

  // ── drawing ─────────────────────────────────────────────────────────────

  const css = (el, s) => { el.style.cssText += s; return el; };
  const box = (el, o) => { for (const k in o) el.style[k] = Math.round(o[k]) + 'px'; };
  const node = (tag, look, style) => {
    const el = document.createElement(tag);
    if (look) el.setAttribute('data-look', look);
    return css(el, style || '');
  };

  const BTN = 'font:inherit;font-size:14px;font-weight:600;line-height:1;padding:8px 12px;' +
    'border-radius:8px;border:1px solid transparent;cursor:pointer;margin:0;';
  const PRIMARY = BTN + 'background:var(--color-primary,#4f46e5);color:var(--color-primary-content,#fff);';
  const GHOST = BTN + 'background:transparent;color:inherit;';
  const ARROW = 'font-size:20px;padding:9px 13px;';
  const OUTLINE = 'border-color:var(--color-base-300,#d4d4d8);';
  const QUIET = 'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.6;white-space:nowrap;';
  // The step's number, on the target and in the dock: dark on yellow in both
  // themes, since the yellow does not change with the theme. Shown with its
  // display named, since clearing an inline display drops this one with it.
  const BADGE = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;' +
    `min-width:22px;height:22px;padding:0 6px;border-radius:11px;border:0;margin:0;background:${WARN};` +
    'color:#1f2937;font:700 13px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;';
  const FLEX = 'inline-flex';

  // ICONS ARE PHOSPHOR'S, as classes, like every page here. A page that does
  // not load Phosphor, which is what the toss renderer injects this kit into,
  // gets the two weights the marker uses from the CDN the pages use, since a
  // Phosphor class with no stylesheet behind it draws nothing at all. A page
  // that loads them already, by link or inlined, is left as it is.
  const PH = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/';
  function drawn(weight) {
    const i = document.createElement('i');
    i.className = `${weight} ph-x`;
    css(i, 'position:absolute;visibility:hidden;');
    document.documentElement.append(i);
    const glyph = getComputedStyle(i, '::before').content;
    i.remove();
    return !!glyph && !/^(none|normal|""|'')$/.test(glyph);
  }
  function icons() {
    for (const w of ['bold', 'fill']) {
      if (document.querySelector(`link[href*="@phosphor-icons/web"][href*="/${w}/"]`) || drawn(`ph-${w}`)) continue;
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `${PH}${w}/style.css`;
      (document.head || document.documentElement).append(l);
    }
  }
  const icon = (name, weight = 'ph-bold') => {
    const i = document.createElement('i');
    i.className = `${weight} ${name}`;
    i.setAttribute('aria-hidden', 'true');
    return css(i, 'display:block;line-height:1;');
  };

  function pointer(layer) {
    const i = node('i', 'pointer', 'position:absolute;display:none;font-size:36px;line-height:1;' +
      `color:${WARN};filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));`);
    i.className = 'ph-fill ph-hand-pointing';
    layer.append(i);
    return i;
  }

  const button = (go, label, content, style) => {
    const b = node('button', '', style);
    b.type = 'button';
    b.dataset.go = go;
    b.setAttribute('aria-label', label);
    b.append(content);
    return b;
  };

  // THE WORDS SIT IN A DOCK, the same place on every step: a card beside the
  // target had to find room near it on every step and every frame, covered
  // what sat there, and left the reader hunting for it after a scroll. The
  // dock is tied to its target by the step's number instead of by nearness,
  // and the page under it scrolls freely. A walk gets a counter and arrows; a
  // lone landing gets its message and a close.
  function dockBody(dock, s, i, n, el, hidden) {
    dock.textContent = '';
    const row = node('div', '', 'display:flex;align-items:center;gap:8px;');
    const mark = node('button', '', BADGE + 'cursor:pointer;flex:none;');
    mark.type = 'button';
    mark.dataset.mark = '';
    mark.dataset.away = '';
    mark.textContent = String(i + 1);
    mark.setAttribute('aria-label', `Step ${i + 1}`);
    mark.style.display = n > 1 && el ? FLEX : 'none';
    row.append(mark);
    const say = node('p', '', 'margin:0;text-wrap:pretty;');
    say.dataset.say = '';
    if (s.miss) say.textContent = s.miss;
    else if (el) say.textContent = s.say || (s.tap ? 'Tap the ringed control.' : '');
    else {
      const code = node('code', '', 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
      code.textContent = s.at;
      say.append(hidden ? 'Hidden on this page: ' : 'Not on this page: ', code);
    }
    if (n > 1) {
      const count = node('span', '', QUIET);
      count.textContent = `${i + 1} of ${n}`;
      row.append(count, node('span', '', 'flex:1'));
      const back = button('-1', 'Back', icon('ph-caret-left'), GHOST + ARROW + OUTLINE);
      if (i === 0) { back.disabled = true; css(back, 'opacity:.35;cursor:default;'); }
      // Forward moves the walk on, except on a tap step, where the tap moves
      // it on and forward only skips.
      const ahead = el && !s.tap;
      row.append(back, i + 1 < n
        ? button('1', ahead ? 'Next' : 'Skip', icon('ph-caret-right'), (ahead ? PRIMARY : GHOST + OUTLINE) + ARROW)
        : button('1', 'Done', 'Done', ahead ? PRIMARY : GHOST + OUTLINE));
    } else {
      say.style.flex = '1';
      row.append(say);
    }
    const close = node('button', '', GHOST + 'font-size:18px;padding:8px;opacity:.6;');
    close.type = 'button';
    close.dataset.stop = '';
    close.setAttribute('aria-label', 'Close');
    close.append(icon('ph-x'));
    row.append(close);
    dock.append(row);
    if (n > 1) { say.style.marginTop = '8px'; dock.append(say); }
    css(dock, `background:${el ? 'var(--color-base-100,#fff)' : `color-mix(in oklab, ${WARN} 14%, var(--color-base-100,#fff))`};`);
  }

  // The dock's number turns into the way back when its target is out of
  // sight: an arrow toward it, or an eye when it is no longer shown at all, as
  // when the reader switched away from its tab.
  const AWAY = { up: 'ph-arrow-up', down: 'ph-arrow-down', left: 'ph-arrow-left', right: 'ph-arrow-right', hidden: 'ph-eye' };
  function paintMark(r) {
    const m = r.dock.querySelector('[data-mark]');
    if (!m) return;
    m.dataset.away = r.away;
    m.textContent = '';
    m.append(r.away ? css(icon(AWAY[r.away]), 'font-size:14px;') : String(r.i + 1));
    m.style.display = r.away || r.steps.length > 1 ? FLEX : 'none';
    m.style.boxShadow = r.away ? `0 0 0 3px ${tint(45)}` : '';
    m.setAttribute('aria-label', r.away ? 'Bring the marked place back into view' : `Step ${r.i + 1}`);
  }

  function whither(el, clips, floor) {
    if (!shown(el)) return 'hidden';
    const b = el.getBoundingClientRect();
    let l = 0, t = 0, rt = innerWidth, bt = floor;
    for (const c of clips || []) {
      const k = c.getBoundingClientRect();
      l = Math.max(l, k.left); t = Math.max(t, k.top); rt = Math.min(rt, k.right); bt = Math.min(bt, k.bottom);
    }
    return b.bottom <= t ? 'up' : b.right <= l ? 'left' : b.left >= rt ? 'right' : 'down';
  }

  // ── a run ───────────────────────────────────────────────────────────────

  let run = null;

  function clearStep(r) {
    (r.anims || []).forEach(a => { try { a.cancel(); } catch { /* gone */ } });
    r.anims = [];
    clearTimeout(r.timer);
    if (r.unbind) r.unbind();
    r.unbind = null;
    r.el = null;
    r.away = '';
    for (const el of [r.halo, r.pointer, r.num, r.dock]) el.style.display = 'none';
  }

  function stop() {
    const r = run;
    if (!r) return;
    run = null;
    clearStep(r);
    cancelAnimationFrame(r.raf);
    r.off();
    r.layer.remove();
  }

  function start(steps, o = {}) {
    stop();
    // A miss from fromHash is shown as itself; anything else is cleaned here,
    // since a page may hand over steps of its own.
    const list = Array.isArray(steps) && steps[0] && steps[0].miss ? steps.slice(0, 1) : clean(steps);
    if (!list) return false;
    icons();
    // One layer on the root, appended to <html> so a positioned <body> cannot
    // move its origin, and CLIPPING NOTHING. It used to clip sideways, with
    // overflow-x:clip on this zero-height box, so a ring at the right edge
    // could not widen the page; on an iPhone it drew nothing inside it at all,
    // the tint and the step's number gone while the fixed dock, which no
    // ancestor clips, stayed (2026-10-04, and Chromium draws exactly that with
    // the layer clipped both ways). The page keeps its width another way:
    // place() clamps every mark to it, and the pulse is an outline, which
    // paints past its box without widening the page as a growing box does.
    const layer = node('div', 'layer', 'position:absolute;left:0;top:0;width:100%;height:0;' +
      'pointer-events:none;z-index:2147483000;');
    const halo = node('div', 'halo', 'position:absolute;display:none;box-sizing:border-box;');
    const pulse = node('div', 'pulse', `position:absolute;inset:0;border-radius:inherit;outline:2px solid ${WARN};outline-offset:0;`);
    const num = node('div', 'num', BADGE + 'position:absolute;display:none;box-shadow:0 1px 3px rgba(0,0,0,.35);');
    // Fixed to the viewport, which the layer's sideways clip does not reach:
    // overflow clips only what the clipping box contains, and a fixed box is
    // contained by the viewport. Inset by the safe area, clear of a phone's
    // home bar, and at the bottom left, short of the bottom right corner where
    // the FAB's launcher sits: a 56px disc 24px in, measured 2026-10-04 over
    // this dock's close button through a toss. That launcher belongs to the
    // toss shell, outside this document, so the dock cannot move it and keeps
    // clear of it instead; on a wider screen the 28rem cap already does.
    const dock = node('div', 'dock', 'position:fixed;display:none;pointer-events:auto;box-sizing:border-box;' +
      'left:max(12px, env(safe-area-inset-left));bottom:max(12px, env(safe-area-inset-bottom));' +
      'width:min(28rem, calc(100vw - 100px));padding:10px 10px 12px 14px;border-radius:14px;' +
      'color:var(--color-base-content,#1f2937);border:1px solid var(--color-base-300,#d4d4d8);' +
      'box-shadow:0 10px 30px rgba(0,0,0,.18);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;text-align:left;');
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-live', 'polite');
    dock.setAttribute('aria-label', 'Look marker');
    halo.append(pulse);
    layer.append(halo, num, dock);
    document.documentElement.append(layer);
    const r = run = { steps: list, i: 0, layer, halo, pulse, num, dock, pointer: pointer(layer), anims: [], away: '',
                      wait: o.wait >= 0 ? o.wait : FIND_WAIT };
    // Escape closes; the arrow keys walk, except where the reader is typing.
    const keys = (e) => {
      if (e.key === 'Escape') return stop();
      if (r.steps.length < 2 || !/^Arrow(Left|Right)$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
      const to = r.i + (e.key === 'ArrowRight' ? 1 : -1);
      if (to >= 0 && to < r.steps.length) step(to);
    };
    const press = (e) => {
      const go = e.target.closest('[data-go]');
      if (go) step(r.i + Number(go.dataset.go));
      else if (e.target.closest('[data-mark]')) {
        if (r.el && shown(r.el)) bring(r.el, true, r.clips);
        else step(r.i);                                    // re-open what hid it
      } else if (e.target.closest('[data-stop]')) stop();
    };
    addEventListener('keydown', keys);
    dock.addEventListener('click', press);
    r.off = () => { removeEventListener('keydown', keys); dock.removeEventListener('click', press); };
    place();
    step(0);
    return true;
  }

  async function step(i) {
    const r = run;
    if (!r) return;
    if (i >= r.steps.length) return stop();
    i = Math.max(0, i);
    const token = r.token = {};
    r.i = i;
    clearStep(r);
    const s = r.steps[i];
    const el = s.miss ? null : await reveal(s.at, r.wait);
    if (run !== r || r.token !== token) return;          // superseded while waiting
    r.el = el;
    r.clips = el ? clipsOf(el) : [];
    // Found but never shown is a different answer from absent, and says so.
    dockBody(r.dock, s, i, r.steps.length, el, !el && !s.miss && !!find(s.at));
    const lone = r.steps.length === 1 && !s.say && !s.miss;
    r.dock.style.display = lone && el ? 'none' : '';
    if (!el) return;
    bring(el, i === 0, r.clips);
    const still = reduced();
    const round = getComputedStyle(el).borderRadius;
    css(r.halo, `display:block;border-radius:${parseFloat(round) ? round : '6px'};`);
    r.num.textContent = String(i + 1);
    r.num.style.display = r.steps.length > 1 ? FLEX : 'none';
    if (s.tap) {
      // A control to tap is marked by its ring, not by a tint, which would
      // wash out a filled button's label.
      css(r.halo, `background-color:transparent;border:2px solid ${WARN};opacity:1;`);
      r.pulse.style.display = '';
      r.pointer.style.display = '';
      if (!still) {
        r.anims.push(
          r.pulse.animate([{ outlineOffset: '0px', opacity: 1 }, { outlineOffset: '10px', opacity: 0 }],
            { duration: 1100, iterations: Infinity, easing: 'ease-out' }),
          r.pointer.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }],
            { duration: 550, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      }
      // The tap goes through to the page; the walk follows it. Matched on the
      // anchor as well as the element, since a framework may re-render it.
      const onTap = (e) => {
        const now = find(s.at);
        if ((el.isConnected && el.contains(e.target)) || (now && now.contains(e.target))) {
          if (r.unbind) r.unbind();
          r.unbind = null;
          setTimeout(() => { if (run === r && r.i === i) step(i + 1); }, 150);
        }
      };
      document.addEventListener('click', onTap, true);
      r.unbind = () => document.removeEventListener('click', onTap, true);
    } else {
      // A tint laid over the element, unblended. It was multiplied, meant to
      // leave text under it black, but the layer is a stacking context and so
      // an isolated group: the blend had no page beneath it, and Chromium drew
      // multiply and normal pixel for pixel alike (measured 2026-10-04). On an
      // iPhone the same step drew no tint while the rings drew, and only the
      // tint used the blend and color-mix; the blend was doing nothing here.
      // It stays while the dock is up, since the reader may scroll away and
      // back; a lone landing with nothing to say has no dock, so it fades and
      // goes, the way every other landing does. A brighter first moment
      // catches the eye where the scroll left it.
      css(r.halo, `background-color:${tint(TINT)};border:0;opacity:1;`);
      r.pulse.style.display = 'none';
      if (!still) r.anims.push(r.halo.animate([{ backgroundColor: tint(2 * TINT) }, { backgroundColor: tint(TINT) }],
        { duration: 900, easing: 'ease-out' }));
      if (lone) {
        const dwell = (window.Land && window.Land.DWELL) || 4000;
        r.anims.push(r.halo.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: 1000, delay: dwell, fill: 'forwards', easing: 'ease-out' }));
        r.timer = setTimeout(() => { if (run === r) stop(); }, dwell + 1100);
      }
    }
  }

  // The browser's own scroll, since it moves every pane between the target and
  // the page. Centred, which keeps an ordinary target clear of a sticky header;
  // a target taller than most of the screen goes to the top instead, where a
  // sticky header can cover its first line. A step after the first moves only
  // when its target is out of view, so a tap does not make the page jump under
  // the finger.
  function bring(el, arriving, clips) {
    const b = el.getBoundingClientRect(), v = seen_(el, clips);
    if (!arriving && v && v.top <= b.top && v.bottom >= b.bottom) return;
    const tall = b.height > innerHeight * 0.6;
    try { el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }); }
    catch { /* a realm that cannot scroll */ }
  }

  // The panes that clip an element: every ancestor whose overflow is not
  // visible. Read once per step, since walking computed styles every frame is
  // what the per-frame placement cannot afford.
  function clipsOf(el) {
    const out = [];
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push(p);
    }
    return out;
  }

  // The part of an element the reader can actually see: its box cut by every
  // clipping pane and by the viewport, or null when nothing of it shows.
  function seen_(el, clips) {
    const b = el.getBoundingClientRect();
    let l = b.left, t = b.top, r = b.right, bt = b.bottom;
    for (const c of [...(clips || []), null]) {
      const k = c ? c.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      l = Math.max(l, k.left); t = Math.max(t, k.top); r = Math.min(r, k.right); bt = Math.min(bt, k.bottom);
    }
    return r > l && bt > t ? { left: l, top: t, right: r, bottom: bt, width: r - l, height: bt - t } : null;
  }

  // Every frame: the halo on the target, the pointer under it, the number at
  // its corner, and whether the dock's number should be the way back. In the
  // layer's own coordinates, so the page scrolling, an inner pane scrolling,
  // or the layout reflowing all come out right without a listener. The dock
  // is fixed and needs no placing.
  function place() {
    const r = run;
    if (!r) return;
    if (r.el && !r.el.isConnected) {
      const again = find(r.steps[r.i].at);
      if (again) { r.el = again; r.clips = clipsOf(again); }
    }
    const L = r.layer.getBoundingClientRect();
    const b = shown(r.el) && seen_(r.el, r.clips);
    // A target scrolled out of its pane, or off the screen, takes its mark
    // with it; the dock stays, and offers the way back.
    for (const el of [r.halo, r.pointer, r.num]) el.style.visibility = b || !r.el ? '' : 'hidden';
    if (b) {
      // Clamped to the page's width, since nothing clips the layer: a mark
      // past the right edge would widen the page and scroll it sideways.
      const vw = document.documentElement.clientWidth || innerWidth;
      const pw = r.pointer.offsetWidth;
      const left = b.left - PAD, right = Math.min(b.right + PAD, vw);
      box(r.halo, { left: left - L.left, top: b.top - L.top - PAD, width: right - left, height: b.height + 2 * PAD });
      box(r.pointer, { left: Math.max(0, Math.min(b.left + Math.min(b.width / 2, 120) - pw / 2, vw - pw)) - L.left, top: b.bottom - L.top + 2 });
      box(r.num, { left: Math.min(Math.max(2, b.left - PAD - 11), vw - 24) - L.left, top: b.top - PAD - 11 - L.top });
    }
    // Under the dock counts as out of sight: the reader sees the dock there.
    const d = r.dock.style.display === 'none' ? null : r.dock.getBoundingClientRect();
    const floor = d && d.height ? d.top : innerHeight;
    const away = !r.el ? '' : !b ? whither(r.el, r.clips, floor) : b.top >= floor ? 'down' : '';
    if (away !== r.away) { r.away = away; paintMark(r); }
    r.raf = requestAnimationFrame(place);
  }

  // ── starting itself ─────────────────────────────────────────────────────

  let seen = signature(location.hash);

  function fromLocation() {
    seen = signature(location.hash);
    const steps = fromHash();
    return steps ? start(steps) : false;
  }

  addEventListener('hashchange', () => {
    if (signature(location.hash) !== seen) fromLocation();
  });
  if (document.readyState === 'complete') setTimeout(fromLocation, 0);
  else addEventListener('load', fromLocation, { once: true });

  window.Look = { start, stop, fromHash, fromLocation, find, encode, KEYS };
})();
