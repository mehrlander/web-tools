// deck-host.js: the host half of swipe-deck's placement contract, for a page
// that has no host of its own. Loading it is what makes a plain page dock its
// decks on the right beside its content, the way the two apps' views do.
//
// Framework-free, loaded via gh.load like swipe-deck.js and drag-splitter.js, in
// web-tools or in another repo (docs/loader.md#consumers-in-other-repos). It
// needs neither kit to load first: it installs window hooks and one stylesheet,
// and swipe-deck reads both when a deck opens. It loads kits/drag-splitter.js
// itself when the page has not, since without it the drag-splitter is never drawn.
//
//   await gh.load('kits/deck-host.js');          // installs with the defaults
//   deckHost.install({ top: chromeEl })          // reinstalls with options
//   deckHost.uninstall()                         // puts back what it changed
//   deckHost.active, deckHost.options            // getters
//
// ── What a host is, and why a page needs one ───────────────────────────────
//
// kits/swipe-deck.js leaves placement to its host ("The host's dock hook" and
// THE DRAG-SPLITTER in its header): CSS variables for the frame, `window.__deckPane`
// for the claim that the host can dock, `window.__deckWidth` for the claim
// that it can be told how wide. The Web Tools app (app/index.html) and the
// budget-drs app (mehrlander/budget-drs, app/view/app.html) each implement
// that half. A page with neither, including one an app frames in an iframe
// (the frame has its own window, so the app's hooks do not reach it), gets a
// full takeover from its left edge. This kit is the budget-drs app's
// implementation generalized, without the sidebar that app docks beside.
//
// From the breakpoint up:
//
//   - a deck opens DOCKED, on the right, at `share` percent of the window;
//   - the content beside it gives the deck its width, through a right margin
//     on the content element, only while a deck is open;
//   - the deck's toggle widens it to the whole window (under `top`) and back,
//     and the next deck opens the way the reader left it;
//   - the drag-splitter on the deck's edge drags its width between `min` and `max`.
//
// Below the breakpoint the kit claims nothing: no toggle, no drag-splitter, and the
// deck is the full takeover it always was.
//
// install() options (every length is a CSS length string, a number of px, or
// a () => px):
//   breakpoint  px, or a media query string; default 1024
//   share       the deck's percent of the window until the reader drags the
//               drag-splitter; default 55, since a deck usually holds the wide one of
//               the pair
//   min         the deck's narrowest width; default '24rem'
//   max         the deck's widest; default the window less '20rem', which is
//               what the content keeps beside it
//   content     a selector or an Element: what gives the deck its width.
//               Default the first `main` outside a deck, else `body`
//   top         where the deck starts from the top: a length, an Element
//               (measured, for chrome pinned at the top) or a () => length.
//               Default none, which leaves the page's own --deck-top
//   bottom      the same for the bottom edge (--deck-bottom). Default room
//               for the FAB launcher where one is mounted, else none
//
// ── Rules it keeps, from the hosts it generalizes ──────────────────────────
//
// IT YIELDS TO A HOST THAT IS ALREADY THERE. Where `window.__deckPane` exists
// and is not this kit's, install() changes nothing and returns false, so a
// page an app loads in its own window keeps the app's placement. A host that
// installs its hook after this kit wins too: the kit notices on its next
// event and takes itself out.
//
// THE PANE IS A STANDING PREFERENCE; WHETHER A DECK IS OPEN IS THE KIT'S FACT.
// `data-deck-pane` on :root holds `dock` or `inset` from the breakpoint up,
// whether or not a deck is open, and the reflow keys on swipe-deck's
// `data-deck-open` as well. Keying it on the pane alone leaves the content
// narrowed by a deck that has closed. `inset` is the toggle's other state: the
// deck takes the window under `top`, and page scroll locks under it.
//
// A MARGIN, NOT PADDING, so the content keeps its own gutter, and on the one
// content element the kit marks (`data-deck-host-content`), never a bare
// `main`: one rendered inside a deck would take the deck's width as margin and
// be left with none. The page's layout then sees a narrower box, so one that
// responds to its container rather than the viewport reflows correctly beside
// the deck.
//
// AN OPENER THAT FRAMES ITS OWN DECK IS LEFT ALONE. An inline `--deck-left` on
// :root is that signal, as in the budget-drs app: `when` is then false for
// both hooks (no toggle and no drag-splitter over the opener's own) and the
// margin rule does not apply, so a column the opener reserved is not reserved
// twice.
//
// THE WIDTH IS ONE NUMBER, CLAMPED IN SCRIPT. The kit writes the deck's left
// edge as `--deck-host-left` on :root, from the reader's percent clamped to
// `min` and `max` at the current width, and clamps again on every resize, so
// a width set in a wide window cannot cover the content in a narrow one. The
// preference lives for the page's lifetime; a reload restores `share`.
(() => {
  const DEFAULTS = Object.freeze({
    breakpoint: 1024, share: 55, min: '24rem', max: null, content: null, top: null, bottom: 'fab',
  });
  // The FAB floats 56px at the bottom-right under a 24px margin and paints
  // above everything (alpineComponents/fab.js), so a docked deck reaching the
  // bottom edge wears it over its pager. The figure is kits/annotate.js's.
  const FAB_ROOM = 88;

  let S = null;                    // the installed state, or null
  let ready = Promise.resolve();

  const root = () => document.documentElement;
  const mediaOf = bp => typeof bp === 'number' ? `(min-width: ${bp}px)` : String(bp);
  const matches = q => { try { return typeof matchMedia === 'function' && matchMedia(q).matches; } catch { return false; } };
  const rem = () => parseFloat(getComputedStyle(root()).fontSize) || 16;

  // A length in px. Units the kit can compute are computed; anything else
  // (a calc, a clamp) is measured on a probe, which reads 0 where there is no
  // layout.
  const px = (len) => {
    if (typeof len === 'function') { try { return Number(len()) || 0; } catch { return 0; } }
    if (typeof len === 'number') return len;
    const s = String(len || '').trim();
    const m = s.match(/^(-?[\d.]+)(px|rem|em|vw|vh|%)?$/);
    if (m) {
      const n = parseFloat(m[1]);
      return m[2] === 'rem' || m[2] === 'em' ? n * rem()
        : m[2] === 'vw' || m[2] === '%' ? n * innerWidth / 100
        : m[2] === 'vh' ? n * innerHeight / 100 : n;
    }
    if (!document.body) return 0;
    const probe = document.createElement('div');
    probe.style.cssText = `position:fixed;visibility:hidden;left:0;top:0;height:0;width:${s}`;
    document.body.appendChild(probe);
    const w = probe.offsetWidth;
    probe.remove();
    return w;
  };

  // The deck's stops as percents of the window, which is the unit
  // swipe-deck and drag-splitter speak. When the window is too narrow for both,
  // the content's floor wins and the deck takes what is left.
  const minPct = () => Math.min(100, px(S.o.min) / (innerWidth || 1) * 100);
  const maxPct = () => {
    const m = S.o.max == null ? innerWidth - px('20rem') : px(S.o.max);
    return Math.max(0, Math.min(100, m / (innerWidth || 1) * 100));
  };
  const clampPct = pct => {
    const lo = minPct(), hi = maxPct();
    return Math.round(Math.max(Math.min(lo, hi), Math.min(hi, pct)) * 10) / 10;
  };

  const framedByOpener = () => !!root().style.getPropertyValue('--deck-left');
  const claim = () => !!S && matches(S.q) && !framedByOpener();

  // The element whose margin gives the deck its width, resolved when a deck
  // opens as well as at install, since a page can render its `main` late.
  const insideDeck = el => !!(el.closest && el.closest('.sd-overlay'));
  const contentEl = () => {
    const c = S.o.content;
    if (c && typeof c === 'object') return c;
    if (typeof c === 'string') return [...document.querySelectorAll(c)].find(el => !insideDeck(el)) || null;
    return [...document.querySelectorAll('main')].find(el => !insideDeck(el)) || document.body;
  };
  const mark = () => {
    const el = contentEl();
    if (el === S.content) return;
    if (S.content) S.content.removeAttribute('data-deck-host-content');
    S.content = el;
    if (el) el.setAttribute('data-deck-host-content', '');
  };

  const edge = (opt) => {
    if (opt == null || opt === false) return null;
    if (opt === 'fab') return document.querySelector('[x-data^="fab"]') ? FAB_ROOM + 'px' : '0px';
    if (typeof opt === 'object' && opt.nodeType === 1) return (opt.offsetHeight || 0) + 'px';
    if (typeof opt === 'function') { try { const v = opt(); return typeof v === 'number' ? v + 'px' : String(v); } catch { return '0px'; } }
    return typeof opt === 'number' ? opt + 'px' : String(opt);
  };

  const applyWidth = () => {
    S.at = clampPct(S.pct);
    root().style.setProperty('--deck-host-left', `calc(100vw - ${S.at}vw)`);
  };
  const applyEdges = () => {
    const r = root().style;
    for (const [opt, name] of [[S.o.top, '--deck-host-top'], [S.o.bottom, '--deck-host-bottom']]) {
      const v = edge(opt);
      if (v == null) r.removeProperty(name); else r.setProperty(name, v);
    }
  };
  // The pane attribute follows the width: the reader's preference from the
  // breakpoint up, nothing below it.
  const syncPane = () => {
    if (matches(S.q)) root().dataset.deckPane = S.pref;
    else delete root().dataset.deckPane;
  };
  const sync = () => {
    if (!S) return;
    if (window.__deckPane !== S.pane) { uninstall(); return; }
    mark(); applyEdges(); applyWidth(); syncPane();
  };

  // Generated from the options because the breakpoint is a media query, and
  // a page that sets no `top` keeps its own --deck-top rather than a 0.
  const cssFor = (o) => `/* exempt-all(theme): swipe-deck reads --deck-left, --deck-top, --deck-bottom and --deck-border from its host; this is the host half of that contract, for a page with none */
@media ${mediaOf(o.breakpoint)} {
  :root[data-deck-pane] {${o.top == null ? '' : ' --deck-top: var(--deck-host-top, 0px);'}${o.bottom == null ? '' : ' --deck-bottom: var(--deck-host-bottom, 0px);'} }
  :root[data-deck-pane="dock"] { --deck-left: var(--deck-host-left, 45vw); --deck-border: 1px; }
  :root[data-deck-pane="dock"][data-deck-open]:not([style*="--deck-left"]) [data-deck-host-content] { width: auto; margin-right: calc(100vw - var(--deck-left)); }
}`;

  function install(opts = {}) {
    if (typeof document === 'undefined') return false;
    if (typeof window.__deckPane === 'function' && !(S && window.__deckPane === S.pane)) return false;
    // A reinstall is the page configuring the kit, and it keeps what the
    // READER chose: the pane, and a width only if one was dragged.
    const keep = S ? { pref: S.pref, pct: S.dragged ? S.pct : null } : null;
    if (S) uninstall();
    const o = { ...DEFAULTS, ...opts };
    S = { o, q: mediaOf(o.breakpoint), pref: keep ? keep.pref : 'dock', pct: keep && keep.pct != null ? keep.pct : o.share,
          dragged: !!(keep && keep.pct != null), content: null, at: o.share, offs: [] };

    S.style = document.createElement('style');
    S.style.dataset.deckHost = '';
    S.style.textContent = cssFor(o);
    document.head.appendChild(S.style);

    // The pane hook: an intent in, the attribute out. The kit reads the
    // attribute back, so this host needs no return value.
    const pane = (intent) => {
      if (!S) return;
      S.pref = intent === 'dock' ? 'dock' : 'inset';
      syncPane();
    };
    pane.when = claim;
    // The width hook, in percent of the window given to the deck. Read with no
    // argument; a drag writes on every move and commits on release, and both
    // land in the same place since the preference is not stored.
    const width = (pct) => {
      if (!S) return 55;
      if (pct == null) return S.at;
      S.pct = clampPct(Number(pct));
      S.dragged = true;
      applyWidth();
      return S.at;
    };
    width.when = claim;
    width.min = minPct;
    width.max = maxPct;
    S.pane = window.__deckPane = pane;
    if (typeof window.__deckWidth !== 'function') S.width = window.__deckWidth = width;

    const onWidth = () => sync();
    addEventListener('resize', onWidth);
    S.offs.push(() => removeEventListener('resize', onWidth));
    try {
      const mq = matchMedia(S.q);
      mq.addEventListener('change', onWidth);
      S.offs.push(() => mq.removeEventListener('change', onWidth));
    } catch { /* no matchMedia: resize still re-syncs */ }
    // A deck opening is when a late `main` or a changed chrome height matters.
    const mo = new MutationObserver(() => { if (S && 'deckOpen' in root().dataset) sync(); });
    mo.observe(root(), { attributes: true, attributeFilter: ['data-deck-open'] });
    S.offs.push(() => mo.disconnect());
    if (o.top && typeof o.top === 'object' && o.top.nodeType === 1 && typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => S && applyEdges());
      ro.observe(o.top);
      S.offs.push(() => ro.disconnect());
    }

    sync();
    if (!window.dragSplitter && window.gh && window.gh.load) {
      ready = window.gh.load('kits/drag-splitter.js').catch(() => { /* no drag-splitter; the dock still works */ });
    }
    return true;
  }

  function uninstall() {
    if (!S) return;
    const s = S;
    S = null;
    for (const off of s.offs) off();
    s.style.remove();
    if (window.__deckPane === s.pane) delete window.__deckPane;
    if (s.width && window.__deckWidth === s.width) delete window.__deckWidth;
    if (s.content) s.content.removeAttribute('data-deck-host-content');
    const r = root();
    for (const name of ['--deck-host-left', '--deck-host-top', '--deck-host-bottom']) r.style.removeProperty(name);
    if (r.dataset.deckPane === s.pref) delete r.dataset.deckPane;
  }

  window.deckHost = {
    install, uninstall, DEFAULTS,
    get active() { return !!S; },
    get options() { return S ? { ...S.o } : null; },
    get ready() { return ready; },
  };
  install();
})();
