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
// with Next. Other fragment keys are left alone, so a page's own routing and a
// nonce ride beside these, and the four keys plus `say` are reserved for this
// kit on any page that loads it.
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
// WHERE THE TARGET SITS IS land.js's question, and this kit asks it rather than
// answering it again: an element in an inner scroller goes to Land.mark with its
// tint off, and one in the document goes to LAND_AT down the viewport, which
// is also what keeps it clear of a sticky header. The MARK is drawn here, as an
// overlay, because it has to show on a page with no daisyUI theme and no
// Tailwind build, where Land's class would compile to nothing. It is Land's
// colour function with a fallback, so on a themed page the two are one yellow.
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
  const PAD = 4, GAP = 10, EDGE = 16;
  const WARN = 'var(--color-warning, #facc15)';
  const tint = (pct) => `color-mix(in oklab, ${WARN} ${pct}%, transparent)`;
  const TINT = 30;          // Land's FLOW strength: the yellow of every other landing

  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };
  const dark = () => /dark/.test(getComputedStyle(document.documentElement).colorScheme || '');
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
  const QUIET = 'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.6;';
  const HINT = 'font-size:13px;line-height:1.2;opacity:.6;';

  // Phosphor's hand where the page loads Phosphor, a plain caret where it does
  // not: an icon font that is missing draws nothing at all.
  function pointer(layer) {
    const i = node('i', 'pointer', 'position:absolute;display:none;font-size:36px;line-height:1;' +
      `color:${WARN};filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));`);
    i.className = 'ph-fill ph-hand-pointing';
    layer.append(i);
    const glyph = getComputedStyle(i, '::before').content;
    if (glyph && glyph !== 'none' && glyph !== 'normal' && glyph !== '""') return i;
    i.remove();
    const caret = node('div', 'pointer', 'position:absolute;display:none;width:0;height:0;' +
      `border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:16px solid ${WARN};` +
      'filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));');
    layer.append(caret);
    return caret;
  }

  function cardBody(card, s, i, n, el, hidden) {
    card.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:8px">' +
        '<p data-say style="flex:1;margin:0;text-wrap:pretty"></p>' +
        `<button type="button" data-stop aria-label="Close" style="${GHOST}padding:4px 8px;margin:-4px -8px 0 0;opacity:.6">✕</button>` +
      '</div>';
    const say = card.querySelector('[data-say]');
    if (s.miss) say.textContent = s.miss;
    else if (el) say.textContent = s.say;
    else {
      const code = node('code', '', 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
      code.textContent = s.at;
      say.append(hidden ? 'Hidden on this page: ' : 'Not on this page: ', code);
    }
    css(card, `background:${el ? 'var(--color-base-100,#fff)' : `color-mix(in oklab, ${WARN} 14%, var(--color-base-100,#fff))`};`);
    // A lone landing needs no navigation: the message and its close are all.
    if (n === 1 && el && !s.tap) return;
    const nav = node('div', '', 'display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px');
    if (n > 1) {
      const count = node('span', '', QUIET + 'margin-right:auto');
      count.textContent = `${i + 1} / ${n}`;
      nav.append(count);
    }
    if (i > 0) {
      const back = node('button', '', GHOST);
      back.type = 'button'; back.dataset.go = '-1'; back.textContent = 'Back';
      nav.append(back);
    }
    if (el && s.tap) {
      const hint = node('span', '', HINT);
      hint.textContent = 'tap the ringed control';
      nav.append(hint);
    } else {
      const fwd = node('button', '', el ? PRIMARY : GHOST + 'border-color:currentColor;');
      fwd.type = 'button'; fwd.dataset.go = '1';
      fwd.textContent = i + 1 < n ? (el ? 'Next' : 'Skip') : 'Done';
      nav.append(fwd);
    }
    card.append(nav);
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
    for (const el of [r.halo, r.pointer, r.card]) el.style.display = 'none';
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
    // One layer on the root, clipped across and not down: a ring on a control at
    // the right edge would otherwise widen the document and scroll it sideways.
    // Appended to <html> so a positioned <body> cannot move its origin.
    const layer = node('div', 'layer', 'position:absolute;left:0;top:0;width:100%;height:0;' +
      'overflow-x:clip;pointer-events:none;z-index:2147483000;');
    const halo = node('div', 'halo', 'position:absolute;display:none;box-sizing:border-box;');
    const pulse = node('div', 'pulse', `position:absolute;inset:0;border-radius:inherit;border:2px solid ${WARN};`);
    const card = node('div', 'card', 'position:absolute;display:none;pointer-events:auto;box-sizing:border-box;' +
      'width:min(22rem,calc(100vw - 2rem));padding:14px 16px;border-radius:12px;' +
      'color:var(--color-base-content,#1f2937);border:1px solid var(--color-base-300,#d4d4d8);' +
      'box-shadow:0 10px 30px rgba(0,0,0,.18);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;text-align:left;');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('aria-label', 'Look marker');
    halo.append(pulse);
    layer.append(halo, card);
    document.documentElement.append(layer);
    const r = run = { steps: list, i: 0, layer, halo, pulse, card, pointer: pointer(layer), anims: [],
                      wait: o.wait >= 0 ? o.wait : FIND_WAIT };
    const keys = (e) => { if (e.key === 'Escape') stop(); };
    const press = (e) => {
      const go = e.target.closest('[data-go]');
      if (go) step(r.i + Number(go.dataset.go));
      else if (e.target.closest('[data-stop]')) stop();
    };
    addEventListener('keydown', keys);
    card.addEventListener('click', press);
    r.off = () => { removeEventListener('keydown', keys); card.removeEventListener('click', press); };
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
    // Found but never shown is a different answer from absent, and says so.
    cardBody(r.card, s, i, r.steps.length, el, !el && !s.miss && !!find(s.at));
    const lone = r.steps.length === 1 && !s.say && !s.miss;
    r.card.style.display = lone && el ? 'none' : '';
    if (!el) return;
    bring(el, i === 0);
    const still = reduced();
    const round = getComputedStyle(el).borderRadius;
    css(r.halo, `display:block;border-radius:${parseFloat(round) ? round : '6px'};`);
    if (s.tap) {
      // A control to tap is marked by its ring, not by a tint, which would
      // wash out a filled button's label.
      css(r.halo, `background:transparent;mix-blend-mode:normal;border:2px solid ${WARN};opacity:1;`);
      r.pulse.style.display = '';
      r.pointer.style.display = '';
      if (!still) {
        const b = el.getBoundingClientRect();
        r.anims.push(
          r.pulse.animate([{ transform: 'scale(1)', opacity: 1 },
            { transform: `scale(${1 + 20 / Math.max(b.width, 1)}, ${1 + 20 / Math.max(b.height, 1)})`, opacity: 0 }],
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
      // A highlighter over the element, not a fill under it: multiplied on a
      // light ground and screened on a dark one, so text under it stays text.
      css(r.halo, `background:${tint(TINT)};mix-blend-mode:${dark() ? 'screen' : 'multiply'};border:0;opacity:1;`);
      r.pulse.style.display = 'none';
      const dwell = (window.Land && window.Land.DWELL) || 4000;
      r.anims.push(r.halo.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 1000, delay: dwell, fill: 'forwards', easing: 'ease-out' }));
      if (lone) r.timer = setTimeout(() => { if (run === r) stop(); }, dwell + 1100);
    }
  }

  // Land decides where an element in an inner scroller sits. In the document,
  // the same LAND_AT, which also keeps the target out from under a sticky
  // header; a step after the first moves only when its target is out of view,
  // so a tap does not make the page jump under the finger.
  function bring(el, arriving) {
    const L = window.Land;
    if (L && L.scrollerOf(el)) return L.mark(el, { tint: false, ifNeeded: !arriving });
    const b = el.getBoundingClientRect();
    if (!arriving && b.top >= 0 && b.bottom <= innerHeight) return;
    const at = (L && L.LAND_AT) || 0.28;
    window.scrollTo({ top: Math.max(0, scrollY + b.top - innerHeight * at), behavior: reduced() ? 'instant' : 'smooth' });
  }

  // Every frame: the halo on the target, the pointer under it, the card under
  // the pointer, or above the target when the viewport has no room below. In
  // the layer's own coordinates, so the page scrolling, an inner pane
  // scrolling, or the layout reflowing all come out right without a listener.
  function place() {
    const r = run;
    if (!r) return;
    if (r.el && !r.el.isConnected) {
      const again = find(r.steps[r.i].at);
      if (again) r.el = again;
    }
    const L = r.layer.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
    const cw = r.card.offsetWidth, ch = r.card.offsetHeight;
    if (shown(r.el)) {
      const b = r.el.getBoundingClientRect();
      box(r.halo, { left: b.left - L.left - PAD, top: b.top - L.top - PAD, width: b.width + 2 * PAD, height: b.height + 2 * PAD });
      const ph = r.pointer.style.display === 'none' ? 0 : r.pointer.offsetHeight + 4;
      box(r.pointer, { left: b.left - L.left + Math.min(b.width / 2, 120) - r.pointer.offsetWidth / 2, top: b.bottom - L.top + 2 });
      const below = b.bottom + ph + GAP + ch < vh || b.top < ch + GAP + 64;
      box(r.card, {
        left: Math.max(EDGE, Math.min(b.left, vw - cw - EDGE)) - L.left,
        top: (below ? b.bottom + ph + GAP : b.top - ch - GAP) - L.top,
      });
    } else {
      box(r.card, { left: Math.max(EDGE, (vw - cw) / 2) - L.left, top: 72 - L.top });
    }
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
