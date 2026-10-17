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
//   #intro=<text>                 a greeting: the first card's message when
//                                 that card points at something and says
//                                 nothing of its own, else a card of its own
//                                 ahead of the rest (or alone)
//
// ONE MESSAGE PER CARD. A step is { at, say?, tap? }, or { say } alone: a
// NOTE step, a message with nothing to point at, drawn as the dock on a page
// left where it is. `tap` may be a string, the label by the hand ("Tap to
// open"); without one the hand reads "Tap here" or "Click here", and a
// control that opens another page says that Back returns here. A walk whose
// name or steps cannot be read still shows its intro, then the miss, so a
// broken walk costs the walk and not the message.
//
// A STOP'S ADDRESS MAY NAME ITS PAGE, the way a spreadsheet names a sheet and
// then a cell: `pages/branch.html!files`, `app/?view=map&tab=showing!map-row`.
// A stop on another page offers Go, a link carrying the walk there, and a tap
// step whose control is a link to the next stop's page carries the walk itself.
// The walk's position rides in the address as `stop=<n>`, so Back, a reload
// or a copied link reopens at that stop; nothing is stored, so nothing expires.
// The dock's braces show the walk as JSON in a tooltip, in the shape a link
// would carry.
//
// A tap step is a DO step: its forward arrow is
// locked until the reader taps the ringed control, the tap still reaches the
// page, and the walk stays on the step so the reader sees what the tap did.
// Until then the dock offers a Skip past what the tap would make. Any other
// step is a LOOK step and moves on with the dock's forward arrow. The arrow
// keys do what the dock's arrows do. Other fragment keys are left
// alone, so a page's own routing and a nonce ride beside these, and the five
// keys plus `say` are reserved for this kit on any page that loads it.
//
// AN ANCHOR IS A NAME THE PAGE DECLARES. `at` resolves, in order, to
//   data-at="<at>"     the durable kind: a name the page gives an element
//   id="<at>"          the same, for an element that already has one
//   text:<words>       the smallest element whose whole text is those words
//   css:<selector>     the first element the selector matches
// The first two are checked against a page's source by python/look-link.py.
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

  const KEYS = ['show', 'tap', 'walk', 'steps', 'intro'];
  const MAX_STEPS = 50;
  const MAX_SAY = 500;
  const MAX_ACT = 40;       // the label by the hand: a few words, not a message
  const FIND_WAIT = 2500;   // how long an anchor may take to appear (a late render)
  const OPEN_WAIT = 1500;   // how long a revealed region may take to show
  const SETTLE_FROM = 700;  // after a landing's scroll animation has had its time
  const SETTLE_FOR = 4000;  // how long a late layout may push the target away
  const PAD = 4;
  // A HIGHLIGHTER YELLOW, FIXED RATHER THAN THE THEME'S. The mark was
  // var(--color-warning), which daisyUI's light theme makes an amber; tinted to
  // 30% over white that read as peach, which the owner took for a skin tone on
  // the app's Map view (2026-10-16). On a page with no theme it fell back to
  // this yellow, so the demo looked right and the app did not. The ring, the
  // step's number and the hand are yellow-400; the tint is yellow-300, which
  // stays yellow when thinned. Land still tints with the theme's warning
  // colour, so on a themed page a landing and a look mark now differ.
  const WARN = '#facc15';
  const tint = (pct) => `color-mix(in oklab, #fde047 ${pct}%, transparent)`;
  const TINT = 30;          // Land's FLOW strength, in the look mark's own yellow

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

  // A link is untrusted input: keep the known fields, as strings and a flag.
  // `tap` may be a string, which is the label by the hand ("Tap to open").
  function clean(steps) {
    if (!Array.isArray(steps)) return null;
    const out = steps.slice(0, MAX_STEPS).filter(s => s && typeof s === 'object').map(s => {
      // Cleaned twice on the way in, so a page already lifted out of `at` is
      // kept from `page`.
      const { page, at } = address(norm(s.at));
      const o = { at, say: norm(s.say).slice(0, MAX_SAY), tap: !!s.tap };
      if (page || s.page) o.page = page || norm(s.page);
      // Cleaned twice on the way in (fromHash, then start), so a label already
      // lifted out of `tap` is kept from `act`.
      const act = !s.tap ? '' : norm(typeof s.tap === 'string' ? s.tap : s.act).slice(0, MAX_ACT);
      if (act) o.act = act;
      return o;
    }).filter(s => s.at || s.say).map(s => s.at ? s : { at: '', say: s.say, tap: false, ...(s.page ? { page: s.page } : {}) });
    return out.length ? out : null;
  }

  // The authoring shape of a cleaned sequence, for the dock's JSON view: what
  // a link would carry to ask for exactly this walk.
  const spec = (steps) => steps.map(s => s.miss ? { miss: s.miss } : Object.fromEntries(Object.entries({
    at: s.page ? s.page + '!' + s.at : s.at, say: s.say, tap: s.tap ? (s.act || true) : '',
  }).filter(([, v]) => v)));

  // A note step points at nothing; a miss step reports a link that could not
  // be read. Neither has an anchor to find.
  const pointless = (s) => !!s.miss || !s.at;

  // AN ADDRESS NAMES A PAGE, THEN A PLACE ON IT, the way a spreadsheet names a
  // sheet and then a cell: `app/?view=map&tab=showing!text:Toss, data route`.
  // The first '!' splits them, and only when what comes before it reads as a
  // page (a path, a query or a .html name, and not a text: or css: anchor);
  // a '!' inside the page part is written %21. No page part means this page.
  // Checked across the three repos on 2026-10-17: no branch name, route table
  // or written page link held a '!', and one file did (a text file, not a page).
  function address(at) {
    const k = at.indexOf('!');
    if (k > 0) {
      const page = at.slice(0, k).trim();
      if (!/^(text|css):/.test(page) && /[/?]|\.html?(#|$)/.test(page)) return { page, at: at.slice(k + 1).trim() };
    }
    return { page: '', at };
  }

  // A page address is read from the site's root: /<repo>/ on a github.io
  // project site, / anywhere else (a local server). A document with no real
  // address of its own, such as a page framed by the toss renderer and served
  // from a blob: URL, cannot tell where it is, so there every page counts as
  // here and the walk runs as it did before addresses.
  const located = () => /^https?:$/.test(location.protocol);
  function siteRoot() {
    const seg = location.pathname.split('/')[1];
    return location.hostname.endsWith('.github.io') && seg ? `/${seg}/` : '/';
  }
  const resolvePage = (page) =>
    new URL(/^([a-z][a-z0-9+.-]*:|[/?#])/i.test(page) ? page : siteRoot() + page, location.href);
  const bare = (path) => path.replace(/index\.html?$/, '');

  // Whether a URL is the page an address names: the same path, and every
  // query and fragment value the address names agrees. Keys it does not name,
  // such as a ?use= pin or the walk's own, are the URL's business.
  function matches(page, url) {
    let want;
    try { want = resolvePage(page); } catch { return false; }
    if (want.origin !== url.origin || bare(want.pathname) !== bare(url.pathname)) return false;
    const q = new URLSearchParams(url.search);
    for (const [k, v] of new URLSearchParams(want.search)) if (q.get(k) !== v) return false;
    const h = own(url.hash);
    for (const [k, v] of own(want.hash)) if (h.get(k) !== v) return false;
    return true;
  }
  const here = (page) => !page || !located() || matches(page, location);

  // A fragment's own text with the walk's keys taken out and others given in,
  // edited as text rather than through URLSearchParams, which would re-encode
  // a page's own keys (gh=o/r becomes gh=o%2Fr) under it.
  function rekey(raw, add, drop = [...KEYS, 'say', STOP]) {
    const s = String(raw || '').replace(/^#/, '');
    const cut = s.indexOf('#');
    const head = cut < 0 ? s : s.slice(0, cut), tail = cut < 0 ? '' : s.slice(cut);
    const ours = new RegExp(`^(${drop.join('|')})(=|$)`);
    const parts = head.split('&').filter(x => x && !ours.test(x));
    for (const [k, v] of add) parts.push(k + '=' + v);
    const h = parts.join('&') + tail;
    return h ? '#' + h : '';
  }

  // THE WALK TRAVELS IN THE ADDRESS, never in storage, so nothing is left
  // behind to expire. A link to stop i on another page is that page's address
  // with all of the walk added to its fragment, so Back to an earlier stop
  // still works there, and `stop=` naming where to pick it up. The current
  // ?use= pin rides along, so the next page runs the same code.
  function walkUrl(page, steps, i, base) {
    const u = base ? new URL(base.href) : resolvePage(page);
    const pin = new URLSearchParams(location.search).get('use');
    if (pin && !u.searchParams.has('use')) u.searchParams.set('use', pin);
    u.hash = rekey(u.hash, [['steps', encode(spec(steps))], [STOP, String(i + 1)]]);
    return u.href;
  }

  // WHERE THE READER IS, kept in the address as `stop=<n>`, counted from 1, so
  // Back, a reload or a copied link opens at that stop, and the original link,
  // which has none, opens at the first. Written with replaceState, which fires
  // no hashchange, so a page routing on its own fragment is not re-routed. A
  // document with no real address of its own has nowhere to write it.
  const STOP = 'stop';
  function markStop(i) {
    if (!located()) return;
    try {
      const h = rekey(location.hash, i == null ? [] : [[STOP, String(i + 1)]], [STOP]);
      history.replaceState(history.state, '', location.pathname + location.search + h);
    } catch { /* a history that refuses: the walk still runs, it just will not reopen here */ }
  }

  // THIS DOCUMENT'S KEYS: the part of the fragment before a nested '#'. A toss
  // shell's fragment carries the framed page's address and, after a second
  // '#', the page's own fragment; URLSearchParams splits on '&' before it reads
  // a key, so a page fragment with two keys would surface as the shell's own
  // and run a second marker on the shell (lib/gh-boot.js says the same).
  const own = (hash) => new URLSearchParams(
    String(hash == null ? location.hash : hash).replace(/^#/, '').split('#')[0]);

  function fromHash(hash) {
    const p = own(hash);
    const intro = norm(p.get('intro')).slice(0, MAX_SAY);
    const seq = sequence(p);
    if (!intro) return seq;
    // One message per card. The intro is the first card's message when that
    // card points at something and has none of its own, so the first card
    // shows a place and says one thing (the owner, 2026-10-16); otherwise it
    // is a card of its own, ahead of the rest.
    if (seq && seq[0] && seq[0].at && !seq[0].miss && !seq[0].say) return [{ ...seq[0], say: intro }, ...seq.slice(1)];
    return [{ at: '', say: intro, tap: false }, ...(seq || [])];
  }

  function sequence(p) {
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
    const p = own(hash);
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

  // THE HAND SAYS WHAT TO DO. A ringed control with a hand bobbing under it
  // was read as "tap this" and never said so (the owner, 2026-10-16), so the
  // hand carries a short label: the step's own (`"tap": "Tap to open"`), else
  // one chosen from the reader's pointer and from where the control leads.
  // Only the hand bobs; a label that moved would be harder to read.
  function pointer(layer) {
    const p = node('div', 'pointer', 'position:absolute;display:none;align-items:flex-start;gap:2px;');
    const hand = node('i', '', 'font-size:36px;line-height:1;flex:none;' +
      `color:${WARN};filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));`);
    hand.className = 'ph-fill ph-hand-pointing';
    const label = node('span', '', 'margin-top:12px;padding:3px 8px;border-radius:6px;white-space:nowrap;' +
      'background:var(--color-neutral,#1f2937);color:var(--color-neutral-content,#fff);' +
      'font:600 13px/1.3 ui-sans-serif,system-ui,-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);');
    label.dataset.act = '';
    p.append(hand, label);
    p.hand = hand;
    p.label = label;
    layer.append(p);
    return p;
  }

  // Where a tap on a control takes the reader: '' for this page, 'tab' for a
  // new tab, 'page' for another document. Read from a link's href, so a
  // control that navigates by script is not caught, and a link that only
  // changes the query is taken to stay, since an app routes those in place.
  function leaves(el) {
    const a = el && el.closest('a[href]');
    if (!a) return '';
    if ((a.getAttribute('target') || '').toLowerCase() === '_blank') return 'tab';
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      return u.origin !== location.origin || u.pathname !== location.pathname ? 'page' : '';
    } catch { return ''; }
  }

  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
  // A control that opens another page says how to come back in the label,
  // the one place the reader is already looking, unless the walk goes along
  // with it (carry), when there is nothing to come back for.
  const actOf = (s, leave, carried) => s.act || (carried ? (coarse() ? 'Tap to open' : 'Click to open')
    : leave === 'page' ? (coarse() ? 'Tap; Back returns here' : 'Click; Back returns here')
    : leave === 'tab' ? 'Opens a new tab' : coarse() ? 'Tap here' : 'Click here');

  // THE TAP CARRIES THE WALK when the control is a link to the next stop's
  // page: the walk's keys go onto the link just before the browser follows it,
  // so the next page opens at that stop with nothing stored. A link that leads
  // anywhere else is left alone, and so is a control that navigates by script,
  // which the walk cannot see in advance; Back still finds the stop, since the
  // address keeps it. carryTo answers whether a link would carry; carry does it.
  function carryTo(target, r, i) {
    const a = target && target.closest && target.closest('a[href]');
    const next = r.steps[i + 1];
    if (!a || !next || !next.page || !located()) return null;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return null; }
    if (u.origin === location.origin && bare(u.pathname) === bare(location.pathname)) return null;
    return matches(next.page, u) ? { a, u } : null;
  }
  function carry(target, r, i) {
    const c = carryTo(target, r, i);
    if (!c) return;
    const before = c.a.getAttribute('href');
    c.a.setAttribute('href', walkUrl(r.steps[i + 1].page, r.steps, i + 1, c.u));
    setTimeout(() => { if (c.a.isConnected) c.a.setAttribute('href', before); }, 0);
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
  // A LOOK STEP AND A DO STEP ARE DIFFERENT ASKS, and the dock says which. A
  // look step (here is the thing) tints its target and moves on with the
  // filled forward arrow. A do step (tap: true) rings its target and puts the
  // same yellow hand in the forward arrow's place until the reader's tap on
  // the page unlocks it: tapping the hand meanwhile says what to tap (tip()),
  // and the tap turns the hand into the arrow (complete()). A quiet Skip below
  // the message jumps to the first later step whose target exists now, past
  // whatever the skipped tap would have made, so leaving a do step undone
  // never lands on a step that cannot be shown; Back likewise passes over
  // steps whose targets are gone. Where those land is navOf()'s to say.
  function dockBody(dock, s, i, n, el, hidden, nav, r) {
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
    const note = !s.miss && !s.at;
    const go = r && r.go;
    if (s.miss) say.textContent = s.miss;
    else if (go) say.textContent = s.say || 'This stop is on another page.';
    else if (note) say.textContent = s.say;
    else if (el) say.textContent = s.say || (s.tap ? 'Tap the ringed control.' : '');
    else if (nav.need >= 0) say.textContent = `This step needs step ${nav.need + 1} first.`;
    else {
      const code = node('code', '', 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
      code.textContent = s.at;
      say.append(hidden ? 'Hidden on this page: ' : 'Not on this page: ', code);
    }
    let hand = null, skip = null;
    if (n > 1) {
      const count = node('span', '', QUIET);
      count.textContent = `${i + 1} of ${n}`;
      row.append(count, node('span', '', 'flex:1'));
      const back = button(String(nav.back - i), 'Back', icon('ph-caret-left'), GHOST + ARROW + OUTLINE);
      if (nav.back < 0) { back.disabled = true; css(back, 'opacity:.35;cursor:default;'); }
      row.append(back);
      if (nav.fwd < 0) {
        hand = node('button', '', BADGE + 'height:40px;min-width:48px;padding:0 12px;border-radius:8px;font-size:22px;cursor:pointer;');
        hand.type = 'button';
        hand.dataset.where = '';
        hand.setAttribute('aria-label', 'Your tap on the ringed control is the next step');
        hand.append(icon('ph-hand-pointing', 'ph-fill'));
        row.append(hand);
        skip = button(String(nav.skip - i), nav.skip < n ? `Skip to step ${nav.skip + 1}` : 'Skip and finish',
          nav.skip < n ? `Skip to step ${nav.skip + 1}` : 'Skip and finish',
          GHOST + 'font-size:14px;font-weight:500;padding:6px 2px;opacity:.7;display:inline-flex;align-items:center;gap:4px;');
        skip.append(css(icon('ph-caret-right'), 'font-size:13px;'));
      } else if (go) {
        row.append(goLink(go));
      } else {
        const ahead = !!el || note;
        row.append(nav.fwd < n
          ? button(String(nav.fwd - i), ahead ? 'Next' : 'Skip', icon('ph-caret-right'), (ahead ? PRIMARY : GHOST + OUTLINE) + ARROW)
          : button(String(nav.fwd - i), 'Done', 'Done', ahead ? PRIMARY : GHOST + OUTLINE));
      }
    } else {
      say.style.flex = '1';
      row.append(say);
      if (go) row.append(goLink(go));
      else if (nav.done) row.append(button(String(nav.fwd - i), 'Done', 'Done', PRIMARY));
    }
    const close = node('button', '', GHOST + 'font-size:18px;padding:8px;opacity:.6;');
    close.type = 'button';
    close.dataset.stop = '';
    close.setAttribute('aria-label', 'Close');
    close.append(icon('ph-x'));
    row.append(close);
    dock.append(row);
    if (nav.need >= 0) {
      const wrap = node('div', '', 'display:flex;align-items:center;gap:10px;margin-top:8px;');
      say.style.flex = '1';
      wrap.append(say, button(String(nav.need - i), `Go to step ${nav.need + 1}`, `Step ${nav.need + 1}`, PRIMARY));
      dock.append(wrap);
    } else if (n > 1) { say.style.marginTop = '8px'; dock.append(say); }
    // THE FOOTER: the walk's JSON behind braces on the left, a do step's Skip
    // on the right. ONE MESSAGE PER CARD is the rule above it: a bold lead
    // over the message, and a line on how to come back from another page,
    // were each a second thing to read (the owner, 2026-10-16), so the intro
    // is a card's message or a card of its own, and the way back is the
    // hand's label.
    const end = node('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;');
    const json = node('button', '', GHOST + 'font-size:15px;padding:4px 2px;opacity:.5;');
    json.type = 'button';
    json.dataset.json = '';
    json.setAttribute('aria-label', 'Show this walk as JSON');
    json.append(icon('ph-brackets-curly'));
    end.append(r ? json : node('span'), skip || node('span'));
    dock.append(end);
    css(dock, `background:${el || note || go ? 'var(--color-base-100,#fff)' : `color-mix(in oklab, ${WARN} 14%, var(--color-base-100,#fff))`};`);
    return hand;
  }

  // Go: a real link, so it opens the way any link does (a long press offers a
  // new tab), carrying the walk to the stop's page in its address.
  function goLink(href) {
    const a = node('a', '', PRIMARY + 'text-decoration:none;display:inline-flex;align-items:center;gap:6px;flex:none;');
    a.href = href;
    a.dataset.goPage = '';
    a.append('Go', css(icon('ph-arrow-right'), 'font-size:15px;'));
    return a;
  }

  // THE WALK AS JSON, a tooltip over the dock rather than a section inside
  // it: an expanding card pushed the message around and was not liked
  // (2026-10-16). The braces toggle it; a new step closes it, since the dock
  // is redrawn. The steps are shown as the kit runs them, in the shape a link
  // would carry, with a copy control in its corner.
  function specTip(r) {
    const old = r.dock.querySelector('[data-look="spec"]');
    if (old) return old.remove();
    hideTip(r);
    const t = node('div', 'spec', 'position:absolute;left:0;bottom:calc(100% + 10px);box-sizing:border-box;' +
      'width:min(24rem, calc(100vw - 24px));max-height:min(50vh, 26rem);overflow:auto;padding:10px 36px 10px 12px;' +
      'border-radius:10px;background:var(--color-neutral,#1f2937);color:var(--color-neutral-content,#fff);' +
      'box-shadow:0 6px 20px rgba(0,0,0,.25);');
    t.setAttribute('role', 'tooltip');
    const pre = node('pre', '', 'margin:0;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      'white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;');
    pre.dataset.spec = '';
    pre.textContent = JSON.stringify(spec(r.steps), null, 2);
    const copy = node('button', '', GHOST + 'position:absolute;top:6px;right:6px;font-size:15px;padding:6px;opacity:.75;');
    copy.type = 'button';
    copy.dataset.copy = '';
    copy.setAttribute('aria-label', 'Copy the JSON');
    copy.append(icon('ph-copy'));
    t.append(pre, copy);
    r.dock.append(t);
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
    m.append(r.away ? css(icon(AWAY[r.away]), 'font-size:14px;') : r.done ? css(icon('ph-check'), 'font-size:13px;') : String(r.i + 1));
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
    r.done = false;
    clearTimeout(r.nudgeTimer);
    hideTip(r);
    for (const el of [r.halo, r.pointer, r.num, r.dock]) el.style.display = 'none';
  }

  // Where Back, forward and a do step's Skip lead from step i, read now.
  function navOf(r, i, el) {
    const s = r.steps[i], n = r.steps.length;
    const exists = (j) => pointless(r.steps[j]) || !here(r.steps[j].page) || !!find(r.steps[j].at);
    const nav = { back: -1, fwd: i + 1, skip: -1, need: -1, done: !!(s.tap && r.done) };
    for (let j = i - 1; j >= 0; j--) if (exists(j)) { nav.back = j; break; }
    if (el && s.tap && !r.done) {
      nav.fwd = -1;
      nav.skip = n;
      for (let j = i + 1; j < n; j++) if (exists(j)) { nav.skip = j; break; }
    }
    // A missing target sends the reader back to the nearest tap NOT yet done.
    // It named the nearest tap of any kind, so a target missing for another
    // reason said "This step needs step 2 first" after step 2 was done
    // (2026-10-16, a Map row the screenshot's ref did not have).
    if (!el && !pointless(s) && !r.go) for (let j = i - 1; j >= 0; j--) if (r.steps[j].tap && !r.did.has(j)) { nav.need = j; break; }
    return nav;
  }

  // DOING A DO STEP UNLOCKS IT; IT DOES NOT MOVE ON. The tap reaches the page
  // and the walk stays put, so the reader sees what the tap did: the glow and
  // the hand stop, the step's number becomes a check, and the dock's hand
  // becomes the forward arrow. Moving on is the reader's next tap, as on any
  // other step. A bare tap link with no message has no dock to unlock, so it
  // simply ends.
  function complete(r, i) {
    if (run !== r || r.i !== i || r.done) return;
    r.done = true;
    r.did.add(i);
    if (r.link && i + 1 < r.steps.length) markStop(i + 1);
    hideTip(r);
    r.anims.forEach(a => { try { a.cancel(); } catch { /* gone */ } });
    r.anims = [];
    r.pulse.style.display = 'none';
    r.pointer.style.display = 'none';
    if (r.dock.style.display === 'none') return stop();
    r.nav = navOf(r, i, r.el);
    dockBody(r.dock, r.steps[i], i, r.steps.length, r.el, false, r.nav, r);
    r.num.textContent = '';
    r.num.append(css(icon('ph-check'), 'font-size:13px;'));
    paintMark(r);
    const fwd = r.dock.querySelector('[aria-label="Next"],[aria-label="Done"]');
    if (fwd && !reduced()) fwd.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  // A TRY TO MOVE ON IS ANSWERED IN TWO PLACES. Before the do step is done,
  // the dock's hand stands where the forward arrow will be, and a tap on it,
  // or the right arrow key, gets a short tip there and an answer on the page
  // (nudge()), where the action is. The tip says only what is wanted; the
  // ping from the ring says where. The kit draws the tip itself: a page the
  // toss renderer injects this kit into has no title-tip kit to lend one.
  function attempt(r) {
    if (!r.dock.querySelector('[data-where]')) return;
    tip(r);
    const moved = r.el && shown(r.el) && bring(r.el, false, r.clips);
    clearTimeout(r.nudgeTimer);
    r.nudgeTimer = setTimeout(() => { if (run === r && !r.done) nudge(r); }, moved ? 450 : 0);
  }

  // The target's answer: one sonar ping. A thin copy of the ring peels off
  // its edge and spreads about 18px outward as it fades, once per try; the
  // resting glow keeps breathing underneath. Picked on 2026-10-06 from six
  // options on a demo page (a flood of colour, a soft ripple, a colour
  // shift, a spotlight, a hop, and this), the last two proposed by an
  // independent agent. It is an outline, which paints outside the ring
  // without widening the page, and it is a single burst rather than the
  // endless one that read as stacked borders. A ping still running when the
  // reader tries again is left to finish rather than restarted.
  function nudge(r) {
    if (reduced() || (r.ping && r.ping.playState === 'running')) return;
    try {
      r.ping = r.halo.animate([
        { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tint(100), outlineOffset: '0px' },
        { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tint(60), outlineOffset: '11px', offset: 0.45 },
        { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tint(0), outlineOffset: '18px' },
      ], { duration: 750, easing: 'cubic-bezier(.25,.6,.4,1)' });
    } catch { /* a realm without Web Animations */ }
  }

  function tip(r) {
    const hand = r.dock.querySelector('[data-where]');
    if (!hand) return;
    hideTip(r);
    const t = node('div', 'tip', 'position:absolute;bottom:calc(100% + 10px);box-sizing:border-box;' +
      'width:max-content;max-width:min(15rem, calc(100vw - 40px));padding:8px 11px;border-radius:8px;' +
      'background:var(--color-neutral,#1f2937);color:var(--color-neutral-content,#fff);' +
      'font:500 14px/1.35 ui-sans-serif,system-ui,-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);');
    t.setAttribute('role', 'status');
    t.textContent = 'Complete the action first.';
    const point = node('div', '', 'position:absolute;bottom:-5px;width:10px;height:10px;transform:rotate(45deg);' +
      'background:var(--color-neutral,#1f2937);');
    t.append(point);
    r.dock.append(t);
    const right = r.dock.clientWidth - hand.offsetLeft - hand.offsetWidth;
    t.style.right = Math.max(0, right - 4) + 'px';
    point.style.right = Math.max(8, hand.offsetWidth / 2 - 5 + (right - Math.max(0, right - 4))) + 'px';
    if (!reduced()) t.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' });
    r.tipTimer = setTimeout(() => hideTip(r), 2500);
  }
  function hideTip(r) {
    clearTimeout(r.tipTimer);
    // The JSON tooltip shares the spot above the dock, so it goes too.
    r.dock && r.dock.querySelectorAll('[data-look="tip"],[data-look="spec"]').forEach(t => t.remove());
  }

  // `keep` is for a walk being replaced rather than ended, so the step a
  // reader reached is forgotten only when the reader ends the walk.
  function stop(o = {}) {
    const r = run;
    if (!r) return;
    run = null;
    if (r.link && !o.keep) markStop(null);
    clearStep(r);
    cancelAnimationFrame(r.raf);
    r.off();
    r.layer.remove();
  }

  function start(steps, o = {}) {
    stop({ keep: true });
    // A miss from fromHash is shown as itself, after the intro it may follow;
    // anything else is cleaned here, since a page may hand over steps of its own.
    const miss = Array.isArray(steps) ? steps.findIndex(s => s && s.miss) : -1;
    const list = miss >= 0 ? steps.slice(0, miss + 1) : clean(steps);
    if (!list) return false;
    icons();
    // One layer on the root, appended to <html> so a positioned <body> cannot
    // move its origin, and CLIPPING NOTHING. It used to clip sideways, with
    // overflow-x:clip on this zero-height box, so a ring at the right edge
    // could not widen the page; on an iPhone it drew nothing inside it at all,
    // the tint and the step's number gone while the fixed dock, which no
    // ancestor clips, stayed (2026-10-04, and Chromium draws exactly that with
    // the layer clipped both ways). The page keeps its width another way:
    // place() clamps every mark to it, and the pulse is a glow, a box-shadow,
    // which paints past its box without widening the page as a growing box
    // does.
    const layer = node('div', 'layer', 'position:absolute;left:0;top:0;width:100%;height:0;' +
      'pointer-events:none;z-index:2147483000;');
    const halo = node('div', 'halo', 'position:absolute;display:none;box-sizing:border-box;');
    // ONE RING, AND A GLOW THAT BREATHES AROUND IT. The pulse was a second
    // line, an outline growing out from the ring and fading; filmed frame by
    // frame on 2026-10-05 it sat a pixel or two outside the ring for part of
    // every cycle, so the control wore two and three concentric borders at
    // once, which is what read as competing states on an iPhone. Now nothing
    // moves outward: the glow swells and fades in place, and only its opacity
    // animates, which a phone composites without repainting.
    const pulse = node('div', 'pulse', 'position:absolute;inset:-2px;border-radius:inherit;opacity:.6;' +
      `box-shadow:0 0 0 4px ${tint(35)},0 0 14px 6px ${tint(30)};`);
    const num = node('div', 'num', BADGE + 'position:absolute;display:none;box-shadow:0 1px 3px rgba(0,0,0,.35);');
    // Fixed to the viewport, which the layer's sideways clip does not reach:
    // overflow clips only what the clipping box contains, and a fixed box is
    // contained by the viewport. Inset by the safe area, clear of a phone's
    // home bar, and at the bottom left, short of the bottom right corner where
    // the FAB's launcher sits: a 56px disc 24px in, measured 2026-10-04 over
    // this dock's close button through a toss. That launcher belongs to the
    // toss shell, outside this document, so the dock cannot move it and keeps
    // clear of it instead; on a wider screen the 28rem cap already does.
    // Above the hand and the step's number, which come after it in the layer,
    // so the JSON tooltip it carries is not drawn under the hand's label.
    const dock = node('div', 'dock', 'position:fixed;z-index:1;display:none;pointer-events:auto;box-sizing:border-box;' +
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
                      wait: o.wait >= 0 ? o.wait : FIND_WAIT, link: !!o.link, leave: '', did: new Set() };
    // A walk resumed after the reader left the page counts the taps before
    // the resumed step as done, since leaving was the tap.
    const from = o.from > 0 && o.from < list.length ? o.from : 0;
    for (let j = 0; j < from; j++) if (list[j].tap) r.did.add(j);
    // Escape closes; the arrow keys do what the dock's arrows do, so the right
    // arrow does nothing on a do step, and neither key acts where the reader
    // is typing.
    const keys = (e) => {
      if (e.key === 'Escape') return stop();
      if (r.steps.length < 2 || !r.nav || !/^Arrow(Left|Right)$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
      const to = e.key === 'ArrowRight' ? r.nav.fwd : r.nav.back;
      if (e.key === 'ArrowRight' && to < 0) attempt(r);
      else if (to >= 0 && to < r.steps.length) step(to);
    };
    const press = (e) => {
      const go = e.target.closest('[data-go]');
      if (go) step(r.i + Number(go.dataset.go));
      else if (e.target.closest('[data-where]')) {
        attempt(r);
      } else if (e.target.closest('[data-mark]')) {
        if (r.el && shown(r.el)) bring(r.el, true, r.clips);
        else step(r.i);                                    // re-open what hid it
      } else if (e.target.closest('[data-stop]')) stop();
      else if (e.target.closest('[data-json]')) specTip(r);
      else if (e.target.closest('[data-copy]')) copySpec(r, e.target.closest('[data-copy]'));
    };
    addEventListener('keydown', keys);
    dock.addEventListener('click', press);
    // Any sign of the reader taking the page over ends the settling above.
    const touch = () => { r.touched = true; };
    const INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const t of INPUT) addEventListener(t, touch, { capture: true, passive: true });
    r.off = () => {
      removeEventListener('keydown', keys);
      dock.removeEventListener('click', press);
      for (const t of INPUT) removeEventListener(t, touch, { capture: true });
      clearTimeout(r.rebring);
    };
    place();
    step(from);
    return true;
  }

  // Copy the walk's JSON. Where the clipboard is refused, the text is
  // selected instead, so the reader's own Copy still works.
  async function copySpec(r, btn) {
    const pre = r.dock.querySelector('[data-spec]');
    if (!pre) return;
    try {
      await navigator.clipboard.writeText(pre.textContent);
      btn.replaceChildren(icon('ph-check'));
      setTimeout(() => { if (btn.isConnected) btn.replaceChildren(icon('ph-copy')); }, 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
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
    // A STOP ON ANOTHER PAGE. Right after a tap, give the page a moment, since
    // the tap may have set an app routing there in place; still elsewhere, the
    // dock offers Go, a link carrying the walk there. After a look step there
    // is nothing in motion to wait for.
    const routing = i > 0 && r.steps[i - 1].tap;
    if (s.page && !s.miss && routing && !here(s.page)) await until(() => here(s.page), Math.min(r.wait, 1500), 100);
    if (run !== r || r.token !== token) return;
    r.go = s.page && !s.miss && !here(s.page) ? walkUrl(s.page, r.steps, i) : '';
    const el = pointless(s) || r.go ? null : await reveal(s.at, r.wait);
    if (run !== r || r.token !== token) return;          // superseded while waiting
    r.el = el;
    r.clips = el ? clipsOf(el) : [];
    r.leave = el && s.tap ? leaves(el) : '';
    r.carries = !!(el && s.tap && carryTo(el, r, i));
    if (r.link) markStop(i);
    // A WALK IS ONE PAGE, but not one moment of it. A target an earlier tap
    // makes, such as a Save button that exists only while a row is being
    // edited, is missing once that tap is skipped, or undone by going on and
    // coming back, not because the page lacks it. Measured 2026-10-04 on an
    // iPhone: back from step 5 to the demo's step 4 said "Not on this page:
    // save-licenses" over the Summary tab. So Back and a do step's Skip pass
    // over steps whose targets do not exist now, read when the step is drawn,
    // and Next from a look step goes one on, since a target there may still be
    // rendering. Should that one turn out missing with a tap before it, the
    // dock names the nearest such step and offers to go there; missing with
    // none is a wrong name, and found but never shown is a third answer.
    const n = r.steps.length, nav = r.nav = navOf(r, i, el);
    const hand = dockBody(r.dock, s, i, n, el, !el && !pointless(s) && !!find(s.at), nav, r);
    const lone = r.steps.length === 1 && !s.say && !s.miss;
    r.dock.style.display = lone && el ? 'none' : '';
    if (!el) return;
    bring(el, i === 0, r.clips);
    r.settle = Date.now();
    r.touched = false;
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
      r.pointer.label.textContent = actOf(s, r.leave, r.carries);
      r.pointer.style.display = 'flex';
      if (!still) {
        r.anims.push(
          r.pulse.animate([{ opacity: 0.15 }, { opacity: 1 }],
            { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }),
          ...[r.pointer.hand, hand && hand.firstChild].filter(Boolean).map(h =>
            h.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }],
              { duration: 550, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })));
      }
      // The tap goes through to the page; the walk follows it. Matched on the
      // anchor as well as the element, since a framework may re-render it.
      const onTap = (e) => {
        const now = find(s.at);
        if ((el.isConnected && el.contains(e.target)) || (now && now.contains(e.target))) {
          if (r.unbind) r.unbind();
          r.unbind = null;
          carry(e.target, r, i);
          complete(r, i);
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
    if (!arriving && v && v.top <= b.top && v.bottom >= b.bottom) return false;
    const tall = b.height > innerHeight * 0.6;
    try { el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }); }
    catch { /* a realm that cannot scroll */ }
    return true;
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
      const left = b.left - PAD, right = Math.min(b.right + PAD, vw);
      box(r.halo, { left: left - L.left, top: b.top - L.top - PAD, width: right - left, height: b.height + 2 * PAD });
      // The hand points where it always did; its label sits to its right, or
      // to its left when the right edge would cut it off.
      const at = b.left + Math.min(b.width / 2, 120), hw = r.pointer.hand.offsetWidth, pw = r.pointer.offsetWidth;
      const flip = at - hw / 2 + pw > vw;
      r.pointer.style.flexDirection = flip ? 'row-reverse' : 'row';
      const x = flip ? at + hw / 2 - pw : at - hw / 2;
      box(r.pointer, { left: Math.max(0, Math.min(x, vw - pw)) - L.left, top: b.bottom - L.top + 2 });
      box(r.num, { left: Math.min(Math.max(2, b.left - PAD - 11), vw - 24) - L.left, top: b.top - PAD - 11 - L.top });
    }
    // Under the dock counts as out of sight: the reader sees the dock there.
    const d = r.dock.style.display === 'none' ? null : r.dock.getBoundingClientRect();
    const floor = d && d.height ? d.top : innerHeight;
    // A done step's target may be gone, as a Save button is once tapped; that
    // is the step working, so its number stays rather than becoming a way back.
    const away = !r.el || r.done ? '' : !b ? whither(r.el, r.clips, floor) : b.top >= floor ? 'down' : '';
    if (away !== r.away) { r.away = away; paintMark(r); }
    // A PAGE STILL LOADING MOVES THE TARGET AFTER THE SCROLL. On the app's Map
    // the contents above the Showing entry arrived after the walk had centred
    // it, and the first card opened with the target below the fold and a down
    // arrow for a number (2026-10-16). So for a few seconds after a step
    // lands, past the scroll's own animation, a target pushed out of view is
    // brought back, until the reader scrolls or touches anything.
    const since = Date.now() - (r.settle || 0);
    if (away && r.el && !r.touched && since > SETTLE_FROM && since < SETTLE_FOR && !r.rebring) {
      r.rebring = setTimeout(() => {
        r.rebring = 0;
        if (run === r && !r.touched && r.el && shown(r.el)) bring(r.el, true, r.clips);
      }, 150);
    }
    r.raf = requestAnimationFrame(place);
  }

  // ── starting itself ─────────────────────────────────────────────────────

  let seen = signature(location.hash);

  function fromLocation() {
    seen = signature(location.hash);
    const steps = fromHash();
    if (!steps) return false;
    const at = Number(own(location.hash).get(STOP));
    return start(steps, { link: true, from: at >= 1 ? Math.floor(at) - 1 : 0 });
  }

  addEventListener('hashchange', () => {
    if (signature(location.hash) !== seen) fromLocation();
  });
  if (document.readyState === 'complete') setTimeout(fromLocation, 0);
  else addEventListener('load', fromLocation, { once: true });

  window.Look = { start, stop, fromHash, fromLocation, find, encode, KEYS };
})();
