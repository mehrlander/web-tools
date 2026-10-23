// look.js — look markers: a link that lands on a place in a page, says why, and can ring the control to tap.
//
// The address is the page's own fragment. Any page that boots the web-tools
// loader answers it: lib/gh-boot.js loads land.js and this kit when a fragment
// asks (LOOK_BOOT). Any other page loads both itself, Land first:
//
//   #show=<anchor>[&say=<text>]   land on it, with a message when one is given
//   #tap=<anchor>[&say=<text>]    land, then ring it and point at it until tapped
//   #walkthrough=<name>                  a sequence the page declares, in
//                                 <script type="application/json" id="look-walkthroughs">
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
// control that opens another page says that Back returns here. A walkthrough whose
// name or steps cannot be read still shows its intro, then the miss, so a
// broken walkthrough costs the walkthrough and not the message.
//
// A STOP'S ADDRESS MAY NAME ITS PAGE, the way a spreadsheet names a sheet and
// then a cell: `pages/branch.html!files`, `app/?view=map&tab=showing!map-row`.
// A stop on another page offers Go, a link carrying the walkthrough there, and a tap
// step whose control is a link to the next stop's page carries the walkthrough itself.
// The dock's number and its counter open every step as a list, and a row goes
// to its step (stepList). Its speech bubble takes the reader's notes on a step,
// kept as drafts in this browser and sent on Send to the estate's notes store,
// where a session reads and answers them (composer, send; skills/notes).
//
// A PAGE MAY DRIVE A WALKTHROUGH AS ITS OWN CHOOSER, as a lineup does, one
// step per option: a step's `mark` (up to three characters) replaces its
// number on the dock, the list and the target; `Look.start(steps, { folded:
// true })` opens the dock folded to one row; `Look.go(j)` moves to step j; and
// every step drawn dispatches `look:step` on window with `{ i, n }`, so the
// page follows the reader's arrows and the reader's arrows follow the page.
//
// A page the toss renderer runs top-level is named by the renderer's address,
// `pages/toss-render.html?top&gh=owner/repo@ref:path`, so a walkthrough can cross
// other repositories' pages; a framed toss has no address of its own, and its
// walkthrough stays on the one page.
// The walkthrough's position rides in the address as `stop=<n>`, so Back, a reload
// or a copied link reopens at that stop; nothing is stored, so nothing expires.
// The dock's braces show the walkthrough as JSON in a tooltip, in the shape a link
// would carry.
//
// A tap step is a DO step: its forward arrow is
// locked until the reader taps the ringed control, the tap still reaches the
// page, and the walkthrough stays on the step so the reader sees what the tap did.
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
// centred, rather than land.js's climb to the nearest scroller, which rightly leaves
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

  const KEYS = ['show', 'tap', 'walkthrough', 'steps', 'intro'];
  const MAX_STEPS = 50;
  const MAX_SAY = 500;
  const MAX_ACT = 40;       // the label by the hand: a few words, not a message
  const FIND_WAIT = 2500;   // how long an anchor may take to appear (a late render)
  const OPEN_WAIT = 1500;   // how long a revealed region may take to show
  const ROUTE_WAIT = 1500;  // how long after a tap a change of address counts as the tap's
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

  // The steps as base64url JSON over UTF-8, through gh-api.js's codec where the
  // page has it. The toss renderer injects this kit into pages that boot
  // nothing, so gh-api.js is never there, and a walkthrough arriving at one read
  // as unreadable (2026-10-22); there the platform's codec reads and writes the
  // same encoding (node/test/base64-one-owner.test.mjs carries the exemption).
  function encode(steps) {
    const text = JSON.stringify(steps);
    if (typeof window.GH?.toBase64url === 'function') return window.GH.toBase64url(text);
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(value) {
    const v = String(value).trim();
    if (v.startsWith('[')) return JSON.parse(v);
    if (typeof window.GH?.decode === 'function') return JSON.parse(window.GH.decode(v));
    const b = v.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    const bin = atob(b + '='.repeat((4 - b.length % 4) % 4));
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
      const mark = norm(s.mark).slice(0, 3);
      if (mark) o.mark = mark;
      return o;
    }).filter(s => s.at || s.say).map(s => s.at ? s : { at: '', say: s.say, tap: false,
      ...(s.page ? { page: s.page } : {}), ...(s.mark ? { mark: s.mark } : {}) });
    return out.length ? out : null;
  }

  // The authoring shape of a cleaned sequence, for the dock's JSON view: what
  // a link would carry to ask for exactly this walkthrough.
  const spec = (steps) => steps.map(s => s.miss ? { miss: s.miss } : Object.fromEntries(Object.entries({
    at: s.page ? s.page + '!' + s.at : s.at, say: s.say, tap: s.tap ? (s.act || true) : '', mark: s.mark,
  }).filter(([, v]) => v)));
  // A step's badge: its mark, else its number.
  const badgeOf = (s, i) => (s && s.mark) || String(i + 1);

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
  // here and the walkthrough runs as it did before addresses.
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
  // such as a ?use= pin or the walkthrough's own, are the URL's business.
  // The query is read as text, not through URLSearchParams: in the toss
  // renderer's top mode a shim hides the renderer's own keys (`top`, `gh`,
  // `data`) from any URLSearchParams holding `top`, so two tossed pages read as
  // one and a stop on the other was walked on this page (2026-10-22).
  function queryPairs(search) {
    const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };
    const q = new Map();
    for (const p of String(search || '').replace(/^\?/, '').split('&')) {
      if (!p) continue;
      const i = p.indexOf('=');
      const k = dec(i < 0 ? p : p.slice(0, i));
      if (!q.has(k)) q.set(k, i < 0 ? '' : dec(p.slice(i + 1)));
    }
    return q;
  }
  function matches(page, url) {
    let want;
    try { want = resolvePage(page); } catch { return false; }
    if (want.origin !== url.origin || bare(want.pathname) !== bare(url.pathname)) return false;
    const q = queryPairs(url.search);
    for (const [k, v] of queryPairs(want.search)) if (q.get(k) !== v) return false;
    const h = own(url.hash);
    for (const [k, v] of own(want.hash)) if (h.get(k) !== v) return false;
    return true;
  }
  const here = (page) => !page || !located() || matches(page, location);

  // A fragment's own text with the walkthrough's keys taken out and others given in,
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

  // THE WALKTHROUGH TRAVELS IN THE ADDRESS, never in storage, so nothing is left
  // behind to expire. A link to stop i on another page is that page's address
  // with all of the walkthrough added to its fragment, so Back to an earlier stop
  // still works there, and `stop=` naming where to pick it up. The current
  // ?use= pin rides along, so the next page runs the same code.
  function walkthroughUrl(page, steps, i, base) {
    const u = base ? new URL(base.href) : resolvePage(page);
    const pin = new URLSearchParams(location.search).get('use');
    if (pin && !u.searchParams.has('use')) u.searchParams.set('use', pin);
    u.hash = rekey(u.hash, [['steps', encode(spec(steps))], [STOP, String(i + 1)]]);
    return u.href;
  }

  // Where the reader is, less the walkthrough's own keys, so writing stop= is not
  // read as the reader going somewhere.
  const placeNow = () => location.origin + location.pathname + location.search + rekey(location.hash, []);

  // This page as an address a walkthrough can name: its path from the site's root,
  // its query less a ?use= pin, and its own fragment less the walkthrough's keys.
  function pageHere() {
    const root = siteRoot();
    const path = location.pathname.startsWith(root) ? location.pathname.slice(root.length) : location.pathname.replace(/^\//, '');
    const q = new URLSearchParams(location.search);
    q.delete('use');
    const qs = q.toString();
    return ((path || './') + (qs ? '?' + qs : '') + rekey(location.hash, [])).replace(/!/g, '%21');
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
    } catch { /* a history that refuses: the walkthrough still runs, it just will not reopen here */ }
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
    if (p.has('walkthrough')) {
      const name = p.get('walkthrough');
      let walkthroughs = {};
      try { walkthroughs = JSON.parse(document.getElementById('look-walkthroughs')?.textContent || '{}'); } catch { /* none */ }
      return clean(walkthroughs[name]) || [{ miss: `This page declares no walkthrough named “${name}”.` }];
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
  // the one place the reader is already looking, unless the walkthrough goes along
  // with it (carry), when there is nothing to come back for.
  const actOf = (s, leave, carried) => s.act || (carried ? (coarse() ? 'Tap to open' : 'Click to open')
    : leave === 'page' ? (coarse() ? 'Tap; Back returns here' : 'Click; Back returns here')
    : leave === 'tab' ? 'Opens a new tab' : coarse() ? 'Tap here' : 'Click here');

  // THE TAP CARRIES THE WALKTHROUGH when the control is a link to another page and
  // the next stop belongs there: it names that page, or names none and so is
  // taken to be on the page the tap opens. The walkthrough's keys go onto the link
  // just before the browser follows it, so the next page opens at the next
  // stop with nothing stored (the owner, 2026-10-17: tap as directed and the
  // panel just updates). The stops up to the tap are stamped with this page,
  // so Back on the next page comes back here. A link to a page the next stop
  // does not name is left alone, and so is a control that navigates by
  // script, which the walkthrough cannot see in advance; Back still finds the stop,
  // since the address keeps it. carryTo answers whether a link would carry.
  function carryTo(target, r, i) {
    const a = target && target.closest && target.closest('a[href]');
    const next = r.steps[i + 1];
    if (!a || !next || !located()) return null;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return null; }
    if (u.origin === location.origin && bare(u.pathname) === bare(location.pathname)) return null;
    return !next.page || matches(next.page, u) ? { a, u } : null;
  }
  function carry(target, r, i) {
    const c = carryTo(target, r, i);
    if (!c) return;
    const here_ = pageHere();
    const steps = r.steps.map((s, j) => j <= i && !s.page ? { ...s, page: here_ } : s);
    const before = c.a.getAttribute('href');
    c.a.setAttribute('href', walkthroughUrl('', steps, i + 1, c.u));
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
  // and the page under it scrolls freely. A walkthrough gets a counter and arrows; a
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
    const head = node('div', '', '');
    const row = node('div', '', 'display:flex;align-items:center;gap:8px;');
    const mark = node('button', '', BADGE + 'cursor:pointer;flex:none;');
    mark.type = 'button';
    mark.dataset.mark = '';
    mark.dataset.away = '';
    mark.textContent = badgeOf(s, i);
    mark.setAttribute('aria-label', `Step ${badgeOf(s, i)}: show every step`);
    mark.style.display = n > 1 ? FLEX : 'none';
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
      // The counter opens the list as the number does, and goes on opening it
      // while the number is the way back to a target out of sight.
      const count = node('button', '', QUIET + 'background:transparent;border:0;margin:0;padding:4px 2px;color:inherit;cursor:pointer;');
      count.type = 'button';
      count.dataset.list = '';
      count.setAttribute('aria-label', 'Show every step');
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
    }
    // A SINGLE CARD ENDS ON DONE, in place of the corner ✕ (the owner,
    // 2026-10-23): one way out, named as the end of something. The ✕ stays on
    // a walkthrough, which a reader may leave midway, on a Go card, whose stop
    // is elsewhere, and on a tap card not yet tapped, where Done would read as
    // finished.
    let finish = false;
    if (n <= 1) {
      say.style.flex = '1';
      row.append(say);
      if (go) row.append(goLink(go));
      else if (nav.done) row.append(button(String(nav.fwd - i), 'Done', 'Done', PRIMARY));
      else finish = !s.tap;
    }
    if (finish) {
      const done = node('button', '', PRIMARY + 'flex:none;');
      done.type = 'button';
      done.dataset.stop = '';
      done.setAttribute('aria-label', 'Done');
      done.append('Done');
      row.append(done);
    } else if (!(n <= 1 && nav.done)) {
      const close = node('button', '', GHOST + 'font-size:18px;padding:8px;opacity:.6;');
      close.type = 'button';
      close.dataset.stop = '';
      close.setAttribute('aria-label', 'Close');
      close.append(icon('ph-x'));
      row.append(close);
    }
    head.append(row);
    if (nav.need >= 0) {
      const wrap = node('div', '', 'display:flex;align-items:center;gap:10px;margin-top:8px;');
      say.style.flex = '1';
      wrap.append(say, button(String(nav.need - i), `Go to step ${nav.need + 1}`, `Step ${nav.need + 1}`, PRIMARY));
      head.append(wrap);
    } else if (n > 1) { say.style.marginTop = '8px'; head.append(say); }
    if (r) {
      const mine = drafts(r).filter(d => d.step === i);
      if (mine.length) head.append(noteList(mine, true));
    }
    dock.append(head);
    // THE FOOTER: the walkthrough's JSON behind braces and the note input on
    // the left; Send, once there are notes, and a do step's Skip on the right.
    // ONE MESSAGE PER CARD is the rule above it: a bold lead
    // over the message, and a line on how to come back from another page,
    // were each a second thing to read (the owner, 2026-10-16), so the intro
    // is a card's message or a card of its own, and the way back is the
    // hand's label.
    const end = node('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;');
    const json = node('button', '', GHOST + 'font-size:15px;padding:4px 2px;opacity:.5;');
    json.type = 'button';
    json.dataset.json = '';
    json.setAttribute('aria-label', 'Show this walkthrough as JSON');
    json.append(icon('ph-brackets-curly'));
    const left = node('span', '', 'display:flex;align-items:center;gap:6px;flex:1;min-width:0;');
    const right = node('span', '', 'display:inline-flex;align-items:center;gap:6px;flex:none;');
    left.append(r ? json : node('span'));
    if (r) {
      const all = drafts(r);
      left.append(...noteInput(r));
      if (all.length) {
        const out = node('button', '', GHOST + OUTLINE + 'font-size:13px;padding:6px 10px;display:inline-flex;align-items:center;gap:5px;');
        out.type = 'button';
        out.dataset.send = '';
        out.disabled = !!r.sending;
        out.setAttribute('aria-label', `Send ${all.length} note${all.length === 1 ? '' : 's'}`);
        out.append(css(icon('ph-paper-plane-tilt'), 'font-size:14px;'), `Send ${all.length}`);
        right.append(out);
      }
    }
    if (skip) right.append(skip);
    end.append(left, right);
    dock.append(end);
    if (r && r.status) {
      const said = node('div', '', QUIET + 'opacity:.75;white-space:normal;margin-top:4px;');
      said.dataset.status = '';
      said.textContent = r.status;
      dock.append(said);
    }
    css(dock, `background:${el || note || go ? 'var(--color-base-100,#fff)' : `color-mix(in oklab, ${WARN} 14%, var(--color-base-100,#fff))`};`);
    if (r) {
      r.fold = { head, row, mark, left, json, end, skip, field: left.querySelector('[data-draft]'), say: s.say || '',
                 can: n > 1 && !!el && !go && !s.miss && nav.need < 0 };
      fit(r);
    }
    return hand;
  }

  // ONE ROW OR THE WHOLE PANEL, the reader's choice, made in the number's list
  // and kept from step to step (the owner, 2026-10-23). Folded, the dock is the
  // number, the note field with the step's message as its placeholder, and
  // the check, so the page stays in view and a note is still one line away.
  // Typing opens it, since a note is written against the message, and it
  // folds again once the field is left empty. The dock is built whole and
  // folded by hiding, never redrawn, so the field being typed in keeps its
  // focus and a phone keeps its keyboard. A step the reader must read before
  // anything else opens whatever the choice: a target not found, a stop on
  // another page, a step that needs an earlier one.
  function fit(r) {
    const f = r.fold;
    if (!f) return;
    const small = !!(r.compact && f.can && !r.open);
    r.dock.toggleAttribute('data-folded', small);
    (small ? f.left : f.row).prepend(f.mark);
    f.head.style.display = small ? 'none' : '';
    f.json.style.display = small ? 'none' : '';
    if (f.skip) f.skip.style.display = small ? 'none' : 'inline-flex';
    f.end.style.marginTop = small ? '0' : '4px';
    css(r.dock, small ? 'padding:5px 6px 5px 5px;border-radius:22px;' : 'padding:10px 10px 12px 14px;border-radius:14px;');
    if (f.field) {
      f.field.placeholder = small && f.say ? clip(f.say, 90) : 'Add a note';
      f.field.style.borderColor = small ? 'transparent' : 'var(--color-base-300,#d4d4d8)';
    }
  }
  // Folded again once the field is neither focused nor holding words.
  function refold(r) {
    if (run !== r || !r.open) return;
    const f = r.dock.querySelector('[data-draft]');
    if (f && (document.activeElement === f || f.value.trim())) return;
    r.open = false;
    fit(r);
  }

  // THE ARROWS CROSS PAGES THE WAY THEY CROSS STOPS. Pressing Next or Back
  // toward a stop on another page goes there, carrying the walkthrough and the stop
  // in the address, so an arrow takes one tap wherever its stop is (the owner,
  // 2026-10-17). Decided at the press, not when the dock is drawn: the dock
  // redraws the moment a tap lands, before an app has routed in place, and
  // an arrow fixed then as a link reloaded the app instead of moving on
  // (measured on the Map the same day). A Go card is left for a stop reached
  // any other way, such as a link that opens at a stop on another page.
  const elsewhere = (r, j) => r && j >= 0 && j < r.steps.length && r.steps[j].page && !here(r.steps[j].page)
    ? walkthroughUrl(r.steps[j].page, r.steps, j) : '';
  // BACK OVER A TAP THAT WENT SOMEWHERE GOES BACK THERE. When this stop was
  // reached by a tap that moved the page in place, Back to the tap's stop
  // undoes the move: the browser's own Back when the tap added an entry to
  // history, else the address the tap left from. The walkthrough follows the page
  // back (popstate, in start), so the reader lands on the tap's stop again.
  function move(r, j) {
    const v = r.via[r.i];
    if (v && j === v.i) {
      if (history.length > v.len) return history.back();
      const u = new URL(v.href);
      if (u.origin + u.pathname + u.search === location.origin + location.pathname + location.search) {
        location.hash = u.hash;
        return step(j);
      }
      return window.Look.leave(v.href);
    }
    const away = elsewhere(r, j);
    if (away) window.Look.leave(away); else step(j);
  }

  // Go: a real link, so it opens the way any link does (a long press offers a
  // new tab), carrying the walkthrough to the stop's page in its address.
  function goLink(href) {
    const a = node('a', '', PRIMARY + 'text-decoration:none;display:inline-flex;align-items:center;gap:6px;flex:none;');
    a.href = href;
    a.dataset.goPage = '';
    a.append('Go', css(icon('ph-arrow-right'), 'font-size:15px;'));
    return a;
  }

  // THE WALKTHROUGH AS JSON, a tooltip over the dock rather than a section inside
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

  // EVERY STEP, ONE TAP AWAY. The dock's number opens the walkthrough as a list,
  // the way the swipe deck's header mark opens its set, current step marked,
  // and a row goes to its step, on this page or another (the owner,
  // 2026-10-22). While the target is out of sight the number is the way back
  // to it instead (paintMark), and says so with an arrow.
  function stepList(r) {
    const old = r.dock.querySelector('[data-look="steps"]');
    if (old) return old.remove();
    hideTip(r);
    const t = node('div', 'steps', 'position:absolute;left:0;bottom:calc(100% + 10px);box-sizing:border-box;' +
      'width:min(26rem, calc(100vw - 24px));max-height:min(60vh, 30rem);overflow:auto;padding:6px;border-radius:12px;' +
      'background:var(--color-base-100,#fff);color:var(--color-base-content,#1f2937);' +
      'border:1px solid var(--color-base-300,#d4d4d8);box-shadow:0 10px 30px rgba(0,0,0,.18);');
    t.setAttribute('role', 'menu');
    const noted = {};
    for (const d of drafts(r)) (noted[d.step] = noted[d.step] || []).push(d);
    let page = null;
    r.steps.forEach((s, j) => {
      const at = s.page || '';
      if (at && at !== page) {
        const head = node('div', '', QUIET + 'padding:6px 8px 2px;overflow:hidden;text-overflow:ellipsis;');
        head.textContent = (aboutOf(at) || at).replace(/^[^/]+\//, '');
        t.append(head);
      }
      page = at || page;
      const row = node('button', '', 'display:flex;align-items:flex-start;gap:8px;width:100%;box-sizing:border-box;' +
        'text-align:left;font:inherit;font-size:14px;line-height:1.35;padding:7px 8px;margin:0;border:0;border-radius:8px;' +
        `cursor:pointer;color:inherit;background:${j === r.i ? tint(35) : 'transparent'};`);
      row.type = 'button';
      row.dataset.jump = String(j);
      row.setAttribute('role', 'menuitem');
      if (j === r.i) row.setAttribute('aria-current', 'step');
      const num = node('span', '', BADGE + 'flex:none;');
      num.textContent = badgeOf(s, j);
      const words = node('span', '', 'flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;');
      words.textContent = s.say || s.miss || s.at;
      row.append(num, words);
      t.append(row);
      if (noted[j]) t.append(css(noteList(noted[j], false), 'margin:0 8px 4px 38px;'));
    });
    const fold = node('button', '', 'display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;' +
      'text-align:left;font:inherit;font-size:14px;line-height:1.35;padding:8px 8px 6px;margin:4px 0 0;border:0;' +
      'border-top:1px solid var(--color-base-200,#e4e4e7);border-radius:0;cursor:pointer;color:inherit;background:transparent;opacity:.75;');
    fold.type = 'button';
    fold.dataset.fold = '';
    fold.setAttribute('role', 'menuitem');
    fold.append(css(icon(r.compact ? 'ph-arrows-out-line-vertical' : 'ph-arrows-in-line-vertical'), 'font-size:15px;width:22px;text-align:center;'),
      r.compact ? 'Open the panel' : 'Fold to one row');
    t.append(fold);
    r.dock.append(t);
    const cur = t.querySelector('[aria-current]');
    if (cur) t.scrollTop = Math.max(0, cur.offsetTop - t.clientHeight / 2 + cur.offsetHeight / 2);
  }

  // ── a reader's notes ────────────────────────────────────────────────────

  // A NOTE ON ANY STEP, SENT WHEN THE READER SAYS. Each card takes notes, held
  // as drafts in this browser until Send appends them to the estate's notes
  // store (kits/notes.js; skills/notes reads and answers them), each about
  // the file its step shows, quoting the marked words when they are short
  // enough to quote, and naming the step it was written on (the owner,
  // 2026-10-22). Drafts are the one thing this kit stores, since they are the
  // reader's own words and no address should carry them. They are kept per
  // walkthrough under a key read from its anchors and messages, which a page
  // stamped into a stop (carry) does not change, so they follow the
  // walkthrough from page to page on one site.
  const DRAFTS = 'look:notes:';
  function draftKey(steps) {
    let h = 0x811c9dc5;
    for (const ch of JSON.stringify(steps.map(s => [s.at || '', s.say || '', s.miss || ''])))
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return DRAFTS + h.toString(36);
  }
  function drafts(r) {
    try { const v = JSON.parse(localStorage.getItem(r.key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function keepDrafts(r, list) {
    try {
      if (list.length) localStorage.setItem(r.key, JSON.stringify(list)); else localStorage.removeItem(r.key);
      return true;
    } catch { return false; }
  }

  // A note's subject: the file a page shows, read from the address that shows
  // it (the toss renderer's gh= or a route's key, a viewer's src=, in the query
  // or the fragment), else the page itself on its github.io site.
  function aboutOf(page) {
    let u;
    try { u = page ? resolvePage(page) : new URL(location.href); } catch { return ''; }
    const keys = ['gh', 'src', 'data', 'pdf'];
    for (const part of [u.search, String(u.hash).replace(/^#/, '').split('#')[0]]) {
      for (const [k, v] of queryPairs(part)) {
        const m = keys.includes(k) && String(v).match(/^([\w.-]+\/[\w.-]+)(?:@[^:\s]+)?:([^?#\s]+)/);
        if (m) return m[1] + ':' + m[2];
      }
    }
    const owner = u.hostname.endsWith('.github.io') ? u.hostname.split('.')[0] : '';
    const [, repo, ...rest] = u.pathname.split('/');
    const path = rest.join('/') || 'index.html';
    return owner && repo ? `${owner}/${repo}:${path}` : '';
  }

  const clip = (s, n) => { s = norm(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  // A step's drafted notes as text: on its card, each with a remove, and under
  // its row in the step list, where they are read rather than hovered (rule 11
  // of the house style, and a page the toss shows has no tip kit to lend).
  function noteList(list, removable) {
    const wrap = node('div', 'notes', 'display:flex;flex-direction:column;gap:4px;margin-top:6px;');
    for (const d of list) {
      const row = node('div', '', 'display:flex;align-items:flex-start;gap:6px;font-size:13px;line-height:1.4;' +
        `padding:4px 4px 4px 8px;border-radius:8px;background:${tint(18)};`);
      const words = node('span', '', 'flex:1;min-width:0;white-space:pre-wrap;word-break:break-word;' +
        (removable ? '' : 'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;'));
      words.textContent = d.text;
      row.append(css(icon('ph-chat-circle-text'), 'font-size:13px;margin-top:3px;opacity:.6;flex:none;'), words);
      if (removable) {
        const x = node('button', '', GHOST + 'font-size:12px;padding:3px;opacity:.55;flex:none;');
        x.type = 'button';
        x.dataset.drop = d.id;
        x.setAttribute('aria-label', 'Remove this note');
        x.append(icon('ph-x'));
        row.append(x);
      }
      wrap.append(row);
    }
    return wrap;
  }

  // THE NOTE IS ONE LINE, READY TO TYPE, beside the braces, with a green check
  // that adds it (the owner, 2026-10-22: a box that opened was more than the
  // job needed). Enter adds it too. The page under the dock may answer keys of
  // its own (Budget bills binds the arrows and letters), so a key typed here
  // stops here, and Escape leaves the field rather than the walkthrough.
  function noteInput(r) {
    const field = node('input', '', 'font:inherit;font-size:14px;line-height:1.3;flex:1;min-width:0;width:0;box-sizing:border-box;' +
      'margin:0;padding:6px 8px;border-radius:8px;border:1px solid var(--color-base-300,#d4d4d8);' +
      'background:var(--color-base-100,#fff);color:inherit;text-overflow:ellipsis;');
    field.type = 'text';
    field.dataset.draft = '';
    field.placeholder = 'Add a note';
    field.setAttribute('aria-label', 'A note on this step, or on anything');
    field.value = r.typing || '';
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') field.blur();
      else if (e.key === 'Enter') { e.preventDefault(); addDraft(r); }
    });
    const add = node('button', '', BTN + 'font-size:15px;padding:6px 8px;flex:none;');
    add.type = 'button';
    add.dataset.add = '';
    add.setAttribute('aria-label', 'Add the note');
    add.append(icon('ph-check'));
    // GREEN ONLY WITH SOMETHING TO ADD (the owner, 2026-10-23): an empty field
    // leaves the check grey, so the colour says the press will act. Grey, not
    // disabled: a press on it finds nothing to add and puts the cursor in the
    // field (addDraft), and a value set without typing still adds.
    const paint = () => {
      const has = !!field.value.trim();
      add.setAttribute('aria-disabled', String(!has));
      css(add, has
        ? 'background:var(--color-success,#16a34a);color:var(--color-success-content,#fff);border-color:transparent;opacity:1;cursor:pointer;'
        : 'background:transparent;color:inherit;border-color:var(--color-base-300,#d4d4d8);opacity:.35;cursor:default;');
    };
    field.addEventListener('input', () => { r.typing = field.value; paint(); });
    paint();
    return [field, add];
  }

  function addDraft(r) {
    const area = r.dock.querySelector('[data-draft]');
    const text = String(area ? area.value : r.typing || '').trim();
    if (!text) { if (area) area.focus(); return; }
    const s = r.steps[r.i], n = r.steps.length;
    const words = r.el ? norm(r.el.innerText || r.el.textContent) : '';
    const list = drafts(r);
    list.push({
      id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      step: r.i,
      about: aboutOf(r.go ? s.page : '') || 'mehrlander/web-tools',
      // Only words short enough to be the marked words: a container's whole
      // text (a footer of labels, 190 characters) quoted nothing.
      quote: words && words.length <= 80 ? words : '',
      where: `Written on walkthrough step ${r.i + 1} of ${n}` + (s.say ? `: "${clip(s.say, 160)}"` : '.'),
      text,
      at: new Date().toISOString(),
    });
    r.status = keepDrafts(r, list) ? '' : 'This browser would not keep the note.';
    r.typing = '';
    redraw(r);
    const again = r.dock.querySelector('[data-draft]');
    if (again) again.focus();
  }

  function dropDraft(r, id) {
    keepDrafts(r, drafts(r).filter(d => d.id !== id));
    redraw(r);
  }

  // SENDING TAKES THE ANNOTATION KIT'S PATH (kits/annotate.js, saveNotes): the
  // reader's token, the registry repository, kits/notes.js's compare-and-swap
  // append, one note per draft, all of them in one write, since each write
  // carries the whole store (seven sent one by one took seven, 2026-10-22). A
  // page the toss renderer showed boots none of that, so gh-api.js and the
  // kits are fetched from this site on the press. The drafts are let go only
  // once their notes are on main, so a failure keeps them for another Send.
  const REGISTRY = () => (window.__shell && window.__shell.REGISTRY_REPO) || 'mehrlander/web-tools-private';
  async function notesApi() {
    if (!window.GH) {
      const m = await import(location.origin + siteRoot() + 'lib/gh-api.js');
      if (!window.GH) window.GH = m.default;
    }
    const loader = window.gh && typeof window.gh.load === 'function' ? window.gh
      : new window.GH({ repo: 'mehrlander/web-tools', ref: 'main', loadBase: 'lib/' });
    // The saved token has one reader, gh-auth.js (node/test/token-one-owner.test.mjs),
    // which a page that boots nothing has not loaded either.
    const token = window.TOKEN || (window.ghAuth || (await loader.load('gh-auth.js'), window.ghAuth))?.resolve?.() || '';
    if (!token) throw new Error('no GitHub token is saved in this browser');
    if (!window.RepoAddress) await loader.load('kits/repo-address.js');
    if (!window.Notes) await loader.load('kits/notes.js');
    if (!window.Notes) throw new Error('kits/notes.js did not load');
    return { Notes: window.Notes, token };
  }
  async function send(r) {
    if (r.sending || !drafts(r).length) return;
    r.sending = true;
    r.status = 'Sending…';
    redraw(r);
    try {
      const { Notes, token } = await notesApi();
      const reg = new window.GH({ token, repo: REGISTRY(), ref: 'main' });
      const author = await Notes.author(reg);
      const list = drafts(r);
      await Notes.append(reg, list.map(d => Notes.make({ about: d.about, author, text: d.text + '\n\n' + d.where,
        anchor: d.quote ? { exact: d.quote } : null })));
      keepDrafts(r, drafts(r).filter(x => !list.some(d => d.id === x.id)));
      r.status = `Sent ${list.length} note${list.length === 1 ? '' : 's'}.`;
    } catch (e) {
      r.status = 'Not sent: ' + ((e && e.message) || String(e));
    }
    r.sending = false;
    if (run === r) redraw(r);
  }

  // The dock drawn again in place, for a change that is not a new step: a note
  // opened, added, removed or sent.
  function redraw(r) {
    if (run !== r) return;
    const hand = dockBody(r.dock, r.steps[r.i], r.i, r.steps.length, r.el, !!r.hidden, r.nav, r);
    if (hand && !reduced()) r.anims.push(hand.firstChild.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }],
      { duration: 550, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
    paintMark(r);
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
    m.append(r.away ? css(icon(AWAY[r.away]), 'font-size:14px;') : r.done ? css(icon('ph-check'), 'font-size:13px;') : badgeOf(r.steps[r.i], r.i));
    m.style.display = r.away || r.steps.length > 1 ? FLEX : 'none';
    m.style.boxShadow = r.away ? `0 0 0 3px ${tint(45)}` : '';
    m.setAttribute('aria-label', r.away ? 'Bring the marked place back into view' : `Step ${badgeOf(r.steps[r.i], r.i)}: show every step`);
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
  // and the walkthrough stays put, so the reader sees what the tap did: the glow and
  // the hand stop, the step's number becomes a check, and the dock's hand
  // becomes the forward arrow. Moving on is the reader's next tap, as on any
  // other step. A bare tap link with no message has no dock to unlock, so it
  // simply ends.
  function complete(r, i) {
    if (run !== r || r.i !== i || r.done) return;
    r.done = true;
    r.did.add(i);
    // A TAP THAT GOES SOMEWHERE MOVES THE WALKTHROUGH ON. An app routes in place a
    // moment after the tap reaches it, so the walkthrough watches for the address
    // to change (place(), each frame) and, if it does within ROUTE_WAIT, goes
    // to the next stop. A tap that changes nothing, such as a toggle, stays
    // on its step so the reader sees what it did. The address keeps this
    // stop, so the browser's Back returns to it.
    r.tapped = { i, from: placeNow(), href: location.href, len: history.length, at: Date.now() };
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
        { outlineStyle: 'solid', outlineWidth: '3px', outlineColor: tint(100), outlineOffset: '0px' },
        { outlineStyle: 'solid', outlineWidth: '3px', outlineColor: tint(70), outlineOffset: '13px', offset: 0.45 },
        { outlineStyle: 'solid', outlineWidth: '3px', outlineColor: tint(0), outlineOffset: '22px' },
      ], { duration: 750, easing: 'cubic-bezier(.25,.6,.4,1)' });
    } catch { /* a realm without Web Animations */ }
  }

  // Calls fn once el has stopped moving, so a ping goes off where the eye
  // lands rather than partway through a smooth scroll; a long one on a phone
  // outlasted the fixed delay this replaced, and iOS has no scrollend.
  function settled(r, el, fn) {
    clearTimeout(r.nudgeTimer);
    let last = null, still = 0;
    const t0 = Date.now();
    const tick = () => {
      if (run !== r || !el.isConnected) return;
      const y = el.getBoundingClientRect().top;
      still = last !== null && Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still >= 2 || Date.now() - t0 > 1500) fn();
      else r.nudgeTimer = setTimeout(tick, 60);
    };
    r.nudgeTimer = setTimeout(tick, 120);
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

  // `keep` is for a walkthrough being replaced rather than ended, so the step a
  // reader reached is forgotten only when the reader ends the walkthrough.
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
      `color:var(--color-base-content,#1f2937);border:2px solid ${WARN};` +
      'box-shadow:0 10px 30px rgba(0,0,0,.18);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;text-align:left;');
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-live', 'polite');
    dock.setAttribute('aria-label', 'Look marker');
    halo.append(pulse);
    layer.append(halo, num, dock);
    document.documentElement.append(layer);
    const r = run = { steps: list, i: 0, layer, halo, pulse, num, dock, pointer: pointer(layer), anims: [], away: '',
                      wait: o.wait >= 0 ? o.wait : FIND_WAIT, link: !!o.link, leave: '', did: new Set(),
                      via: [], places: [], key: draftKey(list), typing: '', status: '', compact: !!o.folded, open: false };
    // A walkthrough resumed after the reader left the page counts the taps before
    // the resumed step as done, since leaving was the tap.
    const from = o.from > 0 && o.from < list.length ? o.from : 0;
    for (let j = 0; j < from; j++) if (list[j].tap) r.did.add(j);
    // Escape closes; the arrow keys do what the dock's arrows do, so the right
    // arrow does nothing on a do step, and neither key acts where the reader
    // is typing.
    const keys = (e) => {
      if (e.key === 'Escape') {
        const open = r.dock.querySelector('[data-look="steps"]');
        return open ? open.remove() : stop();
      }
      if (r.steps.length < 2 || !r.nav || !/^Arrow(Left|Right)$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
      const to = e.key === 'ArrowRight' ? r.nav.fwd : r.nav.back;
      if (e.key === 'ArrowRight' && to < 0) attempt(r);
      else if (to >= 0 && to < r.steps.length) move(r, to);
    };
    const press = (e) => {
      const go = e.target.closest('[data-go]');
      const jump = e.target.closest('[data-jump]');
      const drop = e.target.closest('[data-drop]');
      if (go) move(r, r.i + Number(go.dataset.go));
      else if (e.target.closest('[data-fold]')) {
        e.target.closest('[data-look="steps"]').remove();
        r.compact = !r.compact;
        r.open = false;
        fit(r);
      } else if (jump) {
        const j = Number(jump.dataset.jump);
        jump.closest('[data-look="steps"]').remove();
        if (j !== r.i) move(r, j);
      } else if (e.target.closest('[data-where]')) {
        attempt(r);
      } else if (e.target.closest('[data-mark]')) {
        if (!r.away && r.steps.length > 1) stepList(r);
        else if (r.el && shown(r.el)) {
          // Brought back, it pings once it arrives, so the eye lands with it.
          bring(r.el, true, r.clips);
          settled(r, r.el, () => nudge(r));
        } else step(r.i);                                  // re-open what hid it
      } else if (e.target.closest('[data-list]')) stepList(r);
      else if (e.target.closest('[data-add]')) addDraft(r);
      else if (drop) dropDraft(r, drop.dataset.drop);
      else if (e.target.closest('[data-send]')) send(r);
      else if (e.target.closest('[data-stop]')) stop();
      else if (e.target.closest('[data-json]')) specTip(r);
      else if (e.target.closest('[data-copy]')) copySpec(r, e.target.closest('[data-copy]'));
    };
    // The page going back (the browser's Back, or the dock undoing a tap's
    // move) to where an earlier stop was shown takes the walkthrough back to it.
    const pop = () => {
      const now = placeNow();
      for (let k = r.i - 1; k >= 0; k--) if (r.places[k] === now) return step(k);
    };
    // A folded dock opens when its field takes focus, and folds when the field
    // is left empty. A press inside the dock blurs the field before its click
    // lands, so folding waits for the press to finish: folding at the blur
    // would move the number out from under the reader's finger.
    let held = false;
    const opening = (e) => {
      if (!r.compact || r.open || !e.target.matches('[data-draft]')) return;
      r.open = true;
      fit(r);
    };
    const leaving = () => setTimeout(() => { if (!held) refold(r); }, 0);
    const holding = () => { held = true; };
    const letGo = () => { if (held) setTimeout(() => { held = false; refold(r); }, 250); };
    addEventListener('popstate', pop);
    addEventListener('keydown', keys);
    dock.addEventListener('click', press);
    dock.addEventListener('focusin', opening);
    dock.addEventListener('focusout', leaving);
    dock.addEventListener('pointerdown', holding);
    addEventListener('pointerup', letGo, true);
    addEventListener('pointercancel', letGo, true);
    // Any sign of the reader taking the page over ends the settling above.
    const touch = () => { r.touched = true; };
    const INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const t of INPUT) addEventListener(t, touch, { capture: true, passive: true });
    r.off = () => {
      removeEventListener('keydown', keys);
      removeEventListener('popstate', pop);
      dock.removeEventListener('click', press);
      dock.removeEventListener('focusin', opening);
      dock.removeEventListener('focusout', leaving);
      dock.removeEventListener('pointerdown', holding);
      removeEventListener('pointerup', letGo, true);
      removeEventListener('pointercancel', letGo, true);
      for (const t of INPUT) removeEventListener(t, touch, { capture: true });
      clearTimeout(r.rebring);
    };
    place();
    step(from);
    return true;
  }

  // Copy the walkthrough's JSON. Where the clipboard is refused, the text is
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
    r.open = false;
    clearStep(r);
    const s = r.steps[i];
    // A STOP ON ANOTHER PAGE. Right after a tap, give the page a moment, since
    // the tap may have set an app routing there in place; still elsewhere, the
    // dock offers Go, a link carrying the walkthrough there. After a look step there
    // is nothing in motion to wait for.
    const routing = i > 0 && r.steps[i - 1].tap;
    if (s.page && !s.miss && routing && !here(s.page)) await until(() => here(s.page), Math.min(r.wait, 1500), 100);
    if (run !== r || r.token !== token) return;
    r.go = s.page && !s.miss && !here(s.page) ? walkthroughUrl(s.page, r.steps, i) : '';
    const el = pointless(s) || r.go ? null : await reveal(s.at, r.wait);
    if (run !== r || r.token !== token) return;          // superseded while waiting
    r.el = el;
    r.clips = el ? clipsOf(el) : [];
    r.leave = el && s.tap ? leaves(el) : '';
    r.carries = !!(el && s.tap && carryTo(el, r, i));
    // A stop on another page is not written here, so browser Back returns to
    // the last stop the reader saw on this page.
    if (r.link && !r.go) markStop(i);
    if (!r.go) r.places[i] = placeNow();
    // A WALKTHROUGH IS ONE PAGE, but not one moment of it. A target an earlier tap
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
    r.hidden = !el && !pointless(s) && !!find(s.at);
    const hand = dockBody(r.dock, s, i, n, el, r.hidden, nav, r);
    dispatchEvent(new CustomEvent('look:step', { detail: { i, n } }));
    const lone = r.steps.length === 1 && !s.say && !s.miss;
    r.dock.style.display = lone && el ? 'none' : '';
    if (!r.entered && r.dock.style.display !== 'none' && !reduced()) {
      r.entered = true;
      r.dock.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    if (!el) return;
    bring(el, i === 0, r.clips);
    r.settle = Date.now();
    r.touched = false;
    const still = reduced();
    const round = getComputedStyle(el).borderRadius;
    css(r.halo, `display:block;border-radius:${parseFloat(round) ? round : '6px'};`);
    r.num.textContent = badgeOf(s, i);
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
      // The tap goes through to the page; the walkthrough follows it. Matched on the
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
      //
      // A LOOK LINK IS A POINTER, NOT A LANDING. Land's tint alone is right for
      // the app's own landings, which happen all day; a link someone sent is a
      // request to look here, and the tint alone was easy to miss beside a
      // dock the reader had not yet found (owner, 2026-10-16). So the target
      // also wears the ring a do step wears, and sends out one sonar ping once
      // the scroll has brought it in, the answer an early try already gets.
      css(r.halo, `background-color:${tint(TINT)};border:3px solid ${WARN};opacity:1;`);
      r.pulse.style.display = 'none';
      if (!still) {
        r.anims.push(r.halo.animate([{ backgroundColor: tint(2 * TINT) }, { backgroundColor: tint(TINT) }],
          { duration: 900, easing: 'ease-out' }));
        settled(r, el, () => { if (r.i === i) nudge(r); });
      }
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
  // visible. Read once per step, since reading computed styles every frame is
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
    const t = r.tapped;
    if (t) {
      if (Date.now() - t.at > ROUTE_WAIT || r.i !== t.i) r.tapped = null;
      else if (placeNow() !== t.from) {
        r.tapped = null;
        if (t.i + 1 < r.steps.length) { r.via[t.i + 1] = t; step(t.i + 1); }
      }
    }
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
    // the contents above the Showing entry arrived after the walkthrough had centred
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

  function fromLocation(hash = location.hash) {
    seen = signature(location.hash);
    const steps = fromHash(hash);
    if (!steps) return false;
    const at = Number(own(hash).get(STOP));
    return start(steps, { link: true, from: at >= 1 ? Math.floor(at) - 1 : 0 });
  }

  // A PAGE MAY REWRITE ITS FRAGMENT AS IT BOOTS, keeping only its own keys:
  // Budget bills writes tab, sec and bill with replaceState before the load
  // event, and a walkthrough arriving there lost steps= and stop= (2026-10-22).
  // The first start reads the fragment as it stood when this kit ran, when the
  // look keys have gone from it since.
  const bootHash = location.hash;
  const asks = (hash) => signature(hash) !== signature('');
  const fromBoot = () => fromLocation(asks(location.hash) || !asks(bootHash) ? location.hash : bootHash);

  addEventListener('hashchange', () => {
    if (signature(location.hash) !== seen) fromLocation();
  });
  if (document.readyState === 'complete') setTimeout(fromBoot, 0);
  else addEventListener('load', fromBoot, { once: true });

  // `leave` is how the walkthrough goes to another page; a test replaces it.
  const go = (j) => { if (run && j >= 0 && j < run.steps.length && j !== run.i) move(run, j); };
  window.Look = { start, stop, go, fromHash, fromLocation, find, encode, KEYS, leave: (href) => location.assign(href) };
})();
