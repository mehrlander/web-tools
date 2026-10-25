// kits/md-edit-studio.js — the section editor as a studio: the source and a live
// reading of the change on one full screen, with no mode to switch.
//
// kits/md-edit.js owns everything around an editor (the save, the checks, the
// drafts, the commit sheet) and mounts a variant through `api`. This is the
// second of the two under comparison, ideas 2, 3 and 4 of
// docs/prototypes/md-edit-ideas.json at once. Wikipedia's tabs
// (kits/md-edit-tabs.js) make the writer choose between writing and seeing;
// here the question "what does this do to the document" is answered while
// typing, beside the cursor, rather than after a switch.
//
// FULL SCREEN ON EVERY WIDTH. In place, the editor shares the width the
// document gave the section, and a reading pane beside the source would get
// half of a column. An overlay gives the two panes equal standing on a wide
// screen, and on a phone it is the only way either gets room at all.
//
// THE OVERLAY FOLLOWS THE VISUAL VIEWPORT, not `bottom: 0`. iOS does not
// resize the layout viewport for the keyboard, so a fixed bottom edge sits
// behind it. Sized to visualViewport, the overlay's last row is the row
// directly on top of the keyboard, which is where the formatting row lives,
// and the same measurement says whether the keyboard is up. With it up, the
// reading pane folds to its bar, since half a phone is not enough for two
// panes; the bar stays, so the reading is one tap away (a peek that ends when
// the keyboard goes).
//
// THE MARGIN IS MEASURED, because a textarea cannot mark its own lines and a
// wrapped line has no fixed height. A hidden mirror with the textarea's font
// and width measures each line of the source; a layer under the transparent
// textarea paints the line numbers and the checks that point at a line
// (idea 7). The numbers are FILE lines, so "Em dash on line 16" in a check is
// line 16 in the margin.
//
// THE READING RENDERS OFF TO THE SIDE and is swapped in, debounced, so a slow
// tracked-changes pass never overwrites a newer one. Scrolling is kept
// roughly level by proportion, driven by whichever pane the reader touched
// last, so the two never fight.
//
// ESCAPE NEVER DISCARDS A DRAFT ON ITS OWN: with nothing changed it closes,
// otherwise it arms the discard button and puts focus on it. The network
// checks (link targets, links to a renamed anchor) cost GitHub requests, so
// they run only while the checks panel is open.
(() => {
  window.mdEditVariants = window.mdEditVariants || {};
  const VARIANTS = window.mdEditVariants;
  if (VARIANTS.studio) return;

  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
    return n;
  };
  const icon = (name, cls = '') => el('i', { class: ('ph ' + name + ' ' + cls).trim(), 'aria-hidden': 'true' });
  const spin = () => el('span', { class: 'loading loading-spinner loading-xs mt-0.5 shrink-0' });

  const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  const keyName = (k) => (MAC ? '⌘' : 'Ctrl+') + k;
  const isMod = (e) => (MAC ? e.metaKey : e.ctrlKey) && !e.altKey;

  const FORMATS = [
    { kind: 'bold', glyph: 'ph-text-b', label: 'Bold', key: 'B' },
    { kind: 'italic', glyph: 'ph-text-italic', label: 'Italic', key: 'I' },
    { kind: 'link', glyph: 'ph-link-simple', label: 'Link', key: 'K' },
    { kind: 'heading', glyph: 'ph-text-h', label: 'Heading' },
    { kind: 'list', glyph: 'ph-list-bullets', label: 'List' },
    { kind: 'code', glyph: 'ph-code', label: 'Code' },
  ];
  const BY_KEY = Object.fromEntries(FORMATS.filter(f => f.key).map(f => [f.key.toLowerCase(), f.kind]));

  const LEVEL = {
    warn: ['ph-warning', 'text-warning'], ok: ['ph-check-circle', 'text-success'],
    info: ['ph-info', 'text-base-content/60'], bad: ['ph-x-circle', 'text-error'],
  };

  const RENDER_MS = 300;     // the reading follows the typing by this much
  const ASYNC_MS = 800;      // and the network checks by this much, panel open
  const KEYBOARD = 120;      // px the visual viewport loses before it is a keyboard
  const PREF = 'mdEdit:studio';

  const TA = 'absolute inset-0 block size-full resize-none appearance-none rounded-none border-0 bg-transparent '
           + 'font-mono text-base text-base-content outline-none caret-[var(--color-primary)]';
  const NUM = 'absolute left-0 top-0 w-12 select-none pr-4 text-right font-mono text-xs tabular-nums';

  function mount(api) {
    let alive = true;
    const off = [];
    const on = (t, ev, fn, o) => { if (!t) return; t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
    const later = (fn, ms) => { const id = setTimeout(() => { if (alive) fn(); }, ms); off.push(() => clearTimeout(id)); return id; };

    // Per viewer: which reading, and how much of a phone it takes.
    const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch { return {}; } })();
    let view = prefs.view === 'clean' ? 'clean' : 'changes';
    let split = Number.isFinite(prefs.split) ? Math.min(80, Math.max(20, prefs.split)) : 42;
    let userOpen = prefs.open !== false;
    const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify({ view, split, open: userOpen })); } catch { /* private mode */ } };

    const addr = api.addr || {};
    const base = String(addr.path || '').split('/').pop();
    const de = document.documentElement, bd = document.body;

    // ── Header ────────────────────────────────────────────────────────────
    // Not a btn-square, and named by its content rather than an aria-label:
    // confirmCancel writes "Discard changes" into it, and the name follows.
    const cancel = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm pointer-coarse:btn-md min-w-9 shrink-0 px-2 pointer-coarse:min-w-10',
      'data-md-edit-cancel': '',
    }, icon('ph-x', 'text-lg'), el('span', { class: 'sr-only', text: 'Close' }));

    const title = el('div', { class: 'truncate text-sm font-semibold leading-5', text: api.title });
    const sub = el('div', { class: 'flex h-4 min-w-0 items-center gap-1.5 font-mono text-xs leading-4 text-base-content/60' });
    const titleBox = el('div', { class: 'min-w-0 flex-1 pl-1' }, title, sub);
    const where = el('span', { class: 'truncate' });
    const restoredEl = el('span', { class: 'flex items-center gap-1 font-sans' },
      icon('ph-clock-counter-clockwise'), el('span', { text: 'Draft restored' }));

    const plus = el('span', { class: 'text-success' }), minus = el('span', { class: 'text-error' });
    const delta = el('span', { class: 'flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums', hidden: true }, plus, minus);

    const chipIcon = icon('ph-check-circle', 'text-lg');
    const chipN = el('span', { class: 'font-mono text-xs tabular-nums', hidden: true });
    const chip = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm pointer-coarse:btn-md shrink-0 gap-1 px-2',
      'aria-label': 'Checks', 'aria-expanded': 'false', 'data-title-tip': 'Checks', hidden: true,
    }, chipIcon, chipN);

    const publish = el('button', {
      type: 'button', class: 'btn btn-primary btn-sm pointer-coarse:btn-md shrink-0 px-4',
      'data-md-edit-publish': '', 'data-title-tip': 'Publish ' + keyName(MAC ? '↵' : 'Enter'),
    }, 'Publish');

    const sw = api.compareSwitch();
    const right = el('div', { class: 'flex shrink-0 items-center gap-1 sm:gap-2' });
    const head = el('header', {
      class: 'relative z-20 flex h-14 shrink-0 items-center gap-1 border-b border-base-300 px-1.5 sm:gap-2 sm:px-3',
    }, cancel, titleBox, right);
    const swRow = el('div', { class: 'flex shrink-0 justify-center border-b border-base-300 px-2 py-1.5', hidden: true });

    // ── Source ────────────────────────────────────────────────────────────
    const strip = el('div', { class: 'flex h-10 shrink-0 items-center gap-0.5 border-b border-base-300 px-2' });
    const lines = el('div', { class: 'absolute inset-x-0 top-0' });
    const back = el('div', { class: 'pointer-events-none absolute inset-0 overflow-hidden', 'aria-hidden': 'true' }, lines);
    const ta = el('textarea', {
      class: TA, 'data-md-edit-source': '', 'aria-label': 'Markdown of § ' + api.title,
      spellcheck: 'true', autocapitalize: 'sentences', wrap: 'soft',
    });
    const mirror = el('div', {
      class: 'invisible pointer-events-none absolute left-0 top-0 h-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-base',
      'aria-hidden': 'true',
    });
    const srcCol = el('section', { class: 'relative flex min-h-0 min-w-0 flex-1 flex-col', 'aria-label': 'Markdown' },
      strip, el('div', { class: 'relative min-h-0 flex-1' }, back, ta, mirror));

    // ── Reading ───────────────────────────────────────────────────────────
    const grip = el('span', { class: 'pointer-events-none absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-base-content/20', 'aria-hidden': 'true' });
    const tab = (id, glyph, label) => el('button', { type: 'button', role: 'tab', class: 'tab gap-1.5', 'data-md-edit-tab': id },
      icon(glyph), el('span', { text: label }));
    const tChanges = tab('changes', 'ph-git-diff', 'Changes'), tClean = tab('clean', 'ph-eye', 'Clean');
    const tabs = el('div', { class: 'tabs tabs-box tabs-xs pointer-coarse:tabs-sm', role: 'tablist', 'aria-label': 'Reading' }, tChanges, tClean);
    const fold = el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-square pointer-coarse:btn-md' }, icon('ph-caret-down', 'text-lg'));
    const bar = el('div', {}, grip, tabs, el('div', { class: 'flex-1' }), fold);
    const host = el('div', { class: 'min-w-0' }, el('span', { class: 'loading loading-spinner loading-sm opacity-40' }));
    const pane = el('div', { class: 'min-h-0 flex-1 overflow-y-auto overscroll-contain' }, host);
    const readCol = el('section', { 'aria-label': 'Reading' }, bar, pane);

    const body = el('div', { class: 'relative flex min-h-0 flex-1' }, srcCol, readCol);

    // ── The row on the keyboard ───────────────────────────────────────────
    const kbRow = el('div', { class: 'grid shrink-0 grid-cols-6 gap-1 border-t border-base-300 bg-base-200 px-2 py-1', hidden: true });

    // The formatting buttons keep the textarea's focus (mousedown), so the
    // phone keyboard does not drop and rise again between two taps.
    const fmtButton = (f, cls) => {
      const label = f.key ? f.label + ' ' + keyName(f.key) : f.label;
      const b = el('button', { type: 'button', class: cls, 'aria-label': f.label, 'data-title-tip': label }, icon(f.glyph, 'text-lg'));
      on(b, 'mousedown', (e) => e.preventDefault());
      on(b, 'click', () => api.format(ta, f.kind));
      return b;
    };
    strip.append(...FORMATS.map(f => fmtButton(f, 'btn btn-ghost btn-sm btn-square text-base-content/70')));
    kbRow.append(...FORMATS.map(f => fmtButton(f, 'btn btn-ghost btn-sm pointer-coarse:btn-md w-full px-0')));

    // ── Checks panel: a popover on a wide screen, a drawer on a phone ─────
    const list = el('ul', { class: 'grid gap-0.5 text-sm' });
    const closeX = el('button', { type: 'button', class: 'btn btn-ghost btn-xs btn-square pointer-coarse:btn-sm', 'aria-label': 'Close checks' }, icon('ph-x'));
    const sheet = el('div', { role: 'dialog', 'aria-label': 'Checks', hidden: true },
      el('div', { class: 'flex items-center justify-between pb-1 pl-2' },
        el('span', { class: 'text-xs font-medium text-base-content/60', text: 'Checks' }), closeX),
      list);
    const scrim = el('div', { class: 'absolute inset-0 z-30 bg-black/30', hidden: true });

    const root = el('div', {
      class: 'fixed inset-x-0 top-0 z-[90] flex h-dvh flex-col overflow-hidden overscroll-none bg-base-100 text-base-content',
      'data-md-edit-variant': 'studio', 'data-annotate-ui': '',
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit § ' + api.title,
    }, head, swRow, body, kbRow, scrim);

    // ── Layout: two columns, or stacked with a split ──────────────────────
    let wide = null, kb = false, peek = false;
    // The height a keyboard has not taken: the tallest seen at this width.
    // Read for the layout too, so a keyboard that shrinks the window (Android's
    // resizes-content) does not flip a tablet from two columns to stacked.
    const vv = window.visualViewport;
    let baseH = Math.max(vv ? vv.height : 0, innerHeight), baseW = innerWidth;
    const isWide = () => innerWidth >= 768 && Math.max(baseH, innerHeight) >= 480;
    const shown = () => wide || (kb ? peek : userOpen);

    const applySplit = () => {
      if (wide) { readCol.style.height = ''; pane.hidden = false; return; }
      const s = shown();
      readCol.style.height = s ? split + '%' : '';
      pane.hidden = !s;
      const label = s ? 'Fold the reading' : 'Open the reading';
      fold.setAttribute('aria-label', label);
      fold.setAttribute('data-title-tip', label);
      fold.setAttribute('aria-expanded', String(s));
      fold.firstElementChild.className = 'ph ' + (s ? 'ph-caret-down' : 'ph-caret-up') + ' text-lg';
    };
    const setShown = (v) => {
      if (kb) peek = v; else { userOpen = v; savePrefs(); }
      applySplit();
      measureSoon();
    };

    const layout = () => {
      const w = isWide();
      if (w === wide) return false;
      wide = w;
      root.dataset.layout = w ? 'wide' : 'stacked';
      body.classList.toggle('flex-col', !w);
      strip.hidden = !w;
      ta.className = TA + ' ' + (w ? 'pl-14 pr-6 py-5 leading-7' : 'px-4 py-3 leading-relaxed');
      readCol.className = 'relative flex min-h-0 min-w-0 flex-col '
        + (w ? 'flex-1 border-l border-base-300' : 'shrink-0 border-t border-base-300');
      bar.className = 'relative flex shrink-0 items-center gap-2 px-2 '
        + (w ? 'h-10 border-b border-base-300' : 'h-12 pt-1.5 cursor-row-resize touch-none select-none');
      grip.hidden = fold.hidden = w;
      host.className = 'min-w-0 pb-24 ' + (w ? 'px-6 pt-5' : 'px-4 pt-1');
      if (w) right.replaceChildren(...[delta, chip, sw && el('span', { class: 'mx-1 h-5 w-px bg-base-300', 'aria-hidden': 'true' }), sw, publish].filter(Boolean));
      else { right.replaceChildren(chip, publish); if (sw) swRow.append(sw); }
      swRow.hidden = w || !sw || kb;
      if (checksOpen) closeChecks();
      paintSub();
      applySplit();
      measureSoon();
      return true;
    };

    // ── The visual viewport: the overlay's size, and the keyboard ─────────
    const fit = () => {
      if (!alive) return;
      if (innerWidth !== baseW) { baseW = innerWidth; baseH = Math.max(vv ? vv.height : 0, innerHeight); }
      layout();
      if (vv) {
        const zoomed = Math.abs((vv.scale || 1) - 1) > 0.01;
        root.style.top = zoomed ? '' : vv.offsetTop + 'px';
        root.style.height = zoomed ? '' : vv.height + 'px';
        if (!zoomed) baseH = Math.max(baseH, vv.height);
        const up = !zoomed && api.narrow() && document.activeElement === ta && vv.height < baseH - KEYBOARD;
        if (up !== kb) { kb = up; if (!kb) peek = false; applySplit(); }
      }
      // With the keyboard up the comparison switch gives its line to the text.
      kbRow.hidden = !kb || wide;
      swRow.hidden = wide || !sw || kb;
      measureSoon();
    };

    // ── The margin ────────────────────────────────────────────────────────
    let rows = [], warnAt = new Set(), curLine = -1, lineH = '', raf = 0;
    const lineEl = () => el('div', { class: 'absolute inset-x-0' },
      el('div', { class: 'absolute inset-0 bg-warning/10' }),
      el('div', { class: 'absolute bottom-0 left-0 top-0 w-[3px] rounded-r-sm bg-warning' }),
      el('span', { class: NUM }));
    const scrollPaint = () => { lines.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)'; };
    const paint = () => {
      while (lines.childElementCount < rows.length) lines.append(lineEl());
      while (lines.childElementCount > rows.length) lines.lastElementChild.remove();
      rows.forEach((r, i) => {
        const d = lines.children[i], [band, mark, num] = d.children;
        d.style.top = r.top + 'px';
        d.style.height = r.h + 'px';
        const warn = warnAt.has(i);
        band.hidden = mark.hidden = !warn;
        num.hidden = !wide;
        if (!wide) return;
        num.textContent = String((api.fileLine || 1) + i);
        num.style.lineHeight = lineH;
        num.className = NUM + (warn ? ' font-semibold text-warning' : i === curLine ? ' text-base-content/70' : ' text-base-content/30');
      });
      scrollPaint();
    };
    const measure = () => {
      if (!alive) return;
      const cs = getComputedStyle(ta);
      const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0, pt = parseFloat(cs.paddingTop) || 0;
      const w = ta.clientWidth - pl - pr;
      if (w <= 0) return;
      lineH = cs.lineHeight;
      mirror.style.width = w + 'px';
      mirror.style.lineHeight = lineH;
      const src = ta.value.split('\n');
      while (mirror.childElementCount < src.length) mirror.append(el('div'));
      while (mirror.childElementCount > src.length) mirror.lastElementChild.remove();
      src.forEach((l, i) => { const d = mirror.children[i], t = l || '\u200b'; if (d.textContent !== t) d.textContent = t; });
      let y = pt;
      rows = src.map((_, i) => { const h = mirror.children[i].offsetHeight; const r = { top: y, h }; y += h; return r; });
      paint();
      fabLift();
    };
    // THE PAGE'S FAB floats over everything, in the bottom right corner, which
    // on a phone is where the folded bar's control and the checks drawer's rows
    // end. It is lifted over them through the property it reads for that
    // (kits/md-edit-tabs.js lifts it over its footer the same way), and given
    // back as it was found. With the keyboard up it stays behind the keyboard.
    const fabWas = bd.style.getPropertyValue('--fab-bottom');
    const fabSet = (px) => {
      if (px) bd.style.setProperty('--fab-bottom', 'calc(' + Math.round(px) + 'px + 0.75rem)');
      else if (fabWas) bd.style.setProperty('--fab-bottom', fabWas);
      else bd.style.removeProperty('--fab-bottom');
    };
    const fabLift = () => {
      if (!alive || wide) return fabSet(0);
      if (checksOpen) return fabSet(sheet.offsetHeight);
      fabSet(shown() ? 0 : readCol.offsetHeight + (kbRow.hidden ? 0 : kbRow.offsetHeight));
    };
    off.push(() => fabSet(0));
    const measureSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); }); };
    const caretLine = () => {
      const c = document.activeElement === ta ? ta.value.slice(0, ta.selectionStart).split('\n').length - 1 : -1;
      if (c !== curLine) { curLine = c; if (wide) paint(); }
    };

    // ── The header's figures ──────────────────────────────────────────────
    let found = [], restoredOn = !!api.restored;
    let asyncText = null, asyncRows = null, asyncSeq = 0, asyncT = 0, checksOpen = false;
    const paintSub = () => {
      where.textContent = (wide ? addr.path : base) + ' · ' + addr.ref;
      if (restoredOn) sub.replaceChildren(restoredEl);
      else if (!wide && !delta.hidden) sub.replaceChildren(delta);
      else sub.replaceChildren(where);
      if (wide && delta.parentNode !== right) right.prepend(delta);
    };
    const update = () => {
      const text = ta.value;
      const d = api.changed(text);
      found = d.any ? api.check(text) : [];
      warnAt = new Set(found.filter(c => c.level === 'warn' && c.at).flatMap(c => c.at));
      plus.textContent = '+' + d.added;
      minus.textContent = '−' + d.removed;
      delta.hidden = !d.any;
      const settled = asyncText === text && asyncRows ? asyncRows : [];
      const n = [...found, ...settled].filter(c => c.level === 'warn').length;
      chip.hidden = !d.any;
      chipIcon.className = 'ph text-lg ' + (n ? 'ph-warning text-warning' : 'ph-check-circle text-base-content/50');
      chipN.textContent = String(n);
      chipN.hidden = !n;
      chip.setAttribute('aria-label', n ? 'Checks: ' + n + (n === 1 ? ' warning' : ' warnings') : 'Checks');
      publish.disabled = !d.any;
      paintSub();
      if (checksOpen) paintChecks();
    };

    // ── The reading ───────────────────────────────────────────────────────
    let seq = 0, renderT = 0, driver = 'src';
    const follow = (a, b) => {
      const ma = a.scrollHeight - a.clientHeight, mb = b.scrollHeight - b.clientHeight;
      if (mb > 0) b.scrollTop = ma > 0 ? (a.scrollTop / ma) * mb : 0;
    };
    // Changes and Clean share one typography because api.changes draws with
    // api.preview's renderer (lib/kits/md-edit.js, changesInto).
    const render = async () => {
      clearTimeout(renderT);
      const my = ++seq, text = ta.value, scratch = el('div');
      try {
        if (view === 'clean') api.preview(scratch, text);
        else await api.changes(scratch, text);
      } catch {
        scratch.replaceChildren(el('pre', { class: 'whitespace-pre-wrap font-mono text-sm', text }));
      }
      if (!alive || my !== seq) return;
      host.replaceChildren(...scratch.childNodes);
      if (driver === 'src') follow(ta, pane);
    };
    const setView = (v) => {
      view = v;
      savePrefs();
      for (const [b, id] of [[tChanges, 'changes'], [tClean, 'clean']]) {
        b.classList.toggle('tab-active', id === v);
        b.setAttribute('aria-selected', String(id === v));
      }
      if (!shown()) setShown(true);
      render();
    };

    // ── Checks ────────────────────────────────────────────────────────────
    // What the network checks will look into, said while they run, in the
    // words the commit sheet uses for the same rows.
    const pendingRows = (text) => {
      const out = [];
      const n = window.mdEdit && window.mdEdit.newLinks ? window.mdEdit.newLinks(api.original, text).length : 0;
      if (n) out.push({ level: 'wait', text: 'Checking ' + n + (n === 1 ? ' new link' : ' new links') });
      const a = found.find(r => r.id === 'anchor');
      if (a) out.push({ level: 'wait', text: 'Looking for links to #' + a.slug + ' in other files' });
      return out;
    };
    const lineStart = (v, i) => { let at = 0; for (let k = 0; k < i; k++) { const nl = v.indexOf('\n', at); if (nl < 0) return v.length; at = nl + 1; } return at; };
    const select = (a, b) => {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(a, b);
      driver = 'src';
      const r = rows[ta.value.slice(0, a).split('\n').length - 1];
      if (r) ta.scrollTop = Math.max(0, r.top - ta.clientHeight / 3);
      caretLine();
    };
    // A row that points at lines steps through them on each tap; a row that
    // names link targets selects the first one where it is written.
    const jump = (c, btn) => {
      const v = ta.value;
      if (c.at && c.at.length) {
        const k = (+btn.dataset.step || 0) % c.at.length;
        btn.dataset.step = String(k + 1);
        const a = lineStart(v, c.at[k]), nl = v.indexOf('\n', a);
        if (!wide) closeChecks();
        select(a, nl < 0 ? v.length : nl);
      } else if (c.targets && c.targets.length) {
        const a = v.indexOf(c.targets[0]);
        if (a < 0) return;
        if (!wide) closeChecks();
        select(a, a + c.targets[0].length);
      }
    };
    const checkRow = (c) => {
      const [glyph, tone] = LEVEL[c.level] || LEVEL.info;
      const mark = c.level === 'wait' ? spin() : icon(glyph, tone + ' mt-0.5 shrink-0');
      const text = el('span', { class: 'min-w-0 flex-1 text-pretty', text: c.text });
      const goes = (c.at && c.at.length) || (c.targets && c.targets.length);
      if (!goes) return el('li', { class: 'flex items-start gap-2 px-2 py-1.5' }, mark, text);
      const tail = c.at && c.at.length
        ? el('span', { class: 'mt-0.5 shrink-0 font-mono text-xs text-base-content/50', text: 'L' + ((api.fileLine || 1) + c.at[0]) })
        : icon('ph-caret-right', 'mt-1 shrink-0 text-base-content/40');
      const b = el('button', {
        type: 'button', class: 'flex w-full items-start gap-2 rounded-field px-2 py-1.5 text-left hover:bg-base-200 pointer-coarse:py-2.5',
      }, mark, text, tail);
      b.addEventListener('click', () => jump(c, b));
      return el('li', {}, b);
    };
    const paintChecks = () => {
      const text = ta.value;
      const rowsOut = found.length ? [...found] : [{ level: 'ok', text: 'Heading and level kept' }];
      if (asyncText === text && asyncRows) rowsOut.push(...asyncRows);
      else rowsOut.push(...pendingRows(text));
      list.replaceChildren(...rowsOut.map(checkRow));
    };
    const runAsync = (ms = ASYNC_MS) => {
      clearTimeout(asyncT);
      const text = ta.value;
      if (asyncText === text || !api.changed(text).any) return;
      asyncT = setTimeout(async () => {
        if (!alive) return;
        const my = ++asyncSeq;
        let got;
        try { got = await api.checkAsync(text); }
        catch { got = [{ level: 'info', text: 'Could not run the network checks' }]; }
        if (!alive || my !== asyncSeq) return;
        asyncText = text;
        asyncRows = got || [];
        update();
      }, ms);
    };
    const openChecks = () => {
      checksOpen = true;
      sheet.className = wide
        ? 'absolute right-2 top-full z-30 mt-1 max-h-[60vh] w-[22rem] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl'
        : 'absolute inset-x-0 bottom-0 z-40 max-h-[70%] overflow-y-auto rounded-t-box border-t border-base-300 bg-base-100 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl';
      (wide ? head : root).append(sheet);
      sheet.hidden = false;
      scrim.hidden = wide;
      chip.setAttribute('aria-expanded', 'true');
      paintChecks();
      runAsync(0);
      measureSoon();
    };
    const closeChecks = () => {
      if (!checksOpen) return;
      checksOpen = false;
      sheet.hidden = scrim.hidden = true;
      chip.setAttribute('aria-expanded', 'false');
      clearTimeout(asyncT);
      measureSoon();
    };

    const doPublish = () => {
      closeChecks();
      if (api.narrow()) ta.blur();
      api.publish();
    };

    // ── Wiring ────────────────────────────────────────────────────────────
    on(cancel, 'click', () => api.confirmCancel(cancel));
    on(publish, 'click', doPublish);
    on(chip, 'click', () => (checksOpen ? closeChecks() : openChecks()));
    on(closeX, 'click', closeChecks);
    on(scrim, 'click', closeChecks);
    on(document, 'pointerdown', (e) => {
      if (checksOpen && wide && !sheet.contains(e.target) && !chip.contains(e.target)) closeChecks();
    }, true);
    on(tChanges, 'click', () => setView('changes'));
    on(tClean, 'click', () => setView('clean'));
    on(fold, 'click', () => setShown(!shown()));

    on(ta, 'input', () => {
      api.saveDraft(ta.value);
      if (restoredOn) restoredOn = false;
      update();
      measureSoon();
      caretLine();
      clearTimeout(renderT);
      renderT = setTimeout(render, RENDER_MS);
      if (checksOpen) runAsync();
    });
    on(ta, 'scroll', () => { scrollPaint(); if (driver === 'src') follow(ta, pane); });
    on(pane, 'scroll', () => { if (driver === 'pane') follow(pane, ta); });
    for (const ev of ['pointerdown', 'wheel', 'touchstart', 'keydown', 'focus']) on(ta, ev, () => { driver = 'src'; }, { passive: true });
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) on(pane, ev, () => { driver = 'pane'; }, { passive: true });
    on(document, 'selectionchange', caretLine);
    on(ta, 'focus', fit);
    on(ta, 'blur', () => { caretLine(); later(fit, 0); });

    // The bar is the handle on a phone: drag it to set the split, tap it to
    // fold or open. Pointer capture throws on an id the browser no longer
    // holds, which is why it is guarded (kits/dock-split.js met it first).
    on(bar, 'pointerdown', (e) => {
      if (wide || (e.button != null && e.button > 0) || e.target.closest('button')) return;
      const box = body.getBoundingClientRect(), top0 = readCol.getBoundingClientRect().top, y0 = e.clientY;
      const least = bar.offsetHeight + 1;
      let moved = false, h = 0;
      try { bar.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
      const move = (ev) => {
        if (!alive) return;
        if (!moved && Math.abs(ev.clientY - y0) < 6) return;
        if (!moved) { moved = true; pane.hidden = false; }
        h = Math.max(least, Math.min(box.height * 0.85, box.bottom - (top0 + ev.clientY - y0)));
        readCol.style.height = h + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!alive) return;
        if (!moved) { setShown(!shown()); return; }
        if (h < least + 56) { setShown(false); return; }
        split = Math.min(80, Math.max(20, Math.round((h / box.height) * 100)));
        setShown(true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    on(document, 'keydown', (e) => {
      if (!alive || e.isComposing || document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (checksOpen) { closeChecks(); return; }
        if (ta.value === api.original) { api.confirmCancel(cancel); return; }
        if (!cancel.dataset.armed) { api.confirmCancel(cancel); cancel.focus(); }
        return;
      }
      if (isMod(e) && e.key === 'Enter') {
        e.preventDefault();
        if (!publish.disabled) doPublish();
        return;
      }
      if (isMod(e) && !e.shiftKey && document.activeElement === ta) {
        const kind = BY_KEY[String(e.key).toLowerCase()];
        if (kind) { e.preventDefault(); api.format(ta, kind); }
      }
    });

    on(vv, 'resize', fit);
    on(vv, 'scroll', fit);
    on(window, 'resize', fit);
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => measureSoon());
      ro.observe(ta);
      off.push(() => ro.disconnect());
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) measureSoon(); });

    // Lock the page behind, and give back exactly what it had.
    const was = [de.style.overflow, bd.style.overflow];
    de.style.overflow = 'hidden';
    bd.style.overflow = 'hidden';
    off.push(() => { de.style.overflow = was[0]; bd.style.overflow = was[1]; });

    // ── Open ──────────────────────────────────────────────────────────────
    ta.value = api.initial;
    api.content.replaceChildren(el('div', { class: 'flex items-center gap-2 text-sm text-base-content/60' },
      icon('ph-pencil-simple-line'), el('span', { class: 'truncate', text: api.title })));
    document.body.append(root);
    fit();
    update();
    setView(view);
    if (restoredOn) later(() => { restoredOn = false; paintSub(); }, 6000);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
    // A class new to the page has no CSS until the current task ends, so the
    // margin is measured again once the browser build has compiled it.
    later(measureSoon, 120);
    later(measureSoon, 600);

    const unmount = () => {
      if (!alive) return;
      alive = false;
      clearTimeout(renderT);
      clearTimeout(asyncT);
      if (raf) cancelAnimationFrame(raf);
      for (const f of off.splice(0)) { try { f(); } catch { /* already gone */ } }
      root.remove();
    };
    return { text: () => ta.value, unmount };
  }

  VARIANTS.studio = { mount };
})();
