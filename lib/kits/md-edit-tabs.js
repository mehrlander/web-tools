// kits/md-edit-tabs.js — Wikipedia's source editor for one markdown section:
// Write, Preview and Changes over one text box, in place on a wide screen and
// the whole screen on a phone.
//
// kits/md-edit.js owns everything around the writing (the save, the checks,
// the draft, the commit sheet, the receipt) and mounts an editor through `api`
// (its "Variants" section). This is the `tabs` editor, the board's selection
// (docs/prototypes/md-edit-ideas.json): idea 1, with the phone sheet (2), the
// keyboard bar and margin checks (7), tracked changes (4) and the commit
// sheet (6, the engine's) grafted on.
//
// TABS RATHER THAN PANES, because a phone has room for one thing at a time and
// Wikipedia's editors already know these three. They share one frame, so a
// switch moves the body and nothing else, and the text box is the same element
// throughout, hidden rather than rebuilt, so its undo history and selection
// survive a look at the preview. A wide card keeps the box's height on the
// other tabs for the same reason: the footer does not jump under the pointer.
//
// ON A PHONE THE EDITOR TAKES THE SCREEN, because the keyboard takes half of it
// and a card inside a scrolling document would leave the writer a strip. The
// sheet follows window.visualViewport, not the layout viewport: iOS raises the
// keyboard by shrinking and panning the VISUAL viewport and leaves `fixed`
// elements where they were, so a bar pinned to the layout viewport's bottom
// sits under the keyboard and the header can be panned off the top. Sized to
// the visual viewport, the sheet keeps its header at the top and the
// formatting bar just above the keyboard, with the text scrolling between
// them. The document underneath is locked while the sheet is open.
//
// CHECKS IN THE MARGIN while typing, since an em dash is cheapest to fix on the
// line where it was typed. The engine's rows name the lines they are about
// (`at`); a text box cannot say where a line is drawn once it wraps, so a
// hidden mirror carrying the box's computed font, padding and width lays the
// same lines out to be measured. The mirror also sizes the box to its text,
// which is what lets the gutter scroll with the lines rather than chase the
// box's own scroll position.
//
// THE CARD IS THE PANEL. The engine's panel is a padded card for its basic
// floor; on a wide screen this editor is the card, so the padding comes off
// while it is mounted and goes back on unmount, since a compare switch mounts
// the other editor inside the same panel.
//
// No loads of its own: preview, changes and formatting are the engine's, which
// sanitize and load what they need.
(() => {
  window.mdEditVariants = window.mdEditVariants || {};
  if (window.mdEditVariants.tabs) return;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
    return n;
  };
  const icon = (name, cls = '') => el('i', { class: 'ph ' + name + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
  const quiet = (glyph, text) => el('div', { class: 'flex items-center gap-2 text-sm text-base-content/60' },
    icon(glyph), el('span', { text }));

  // ⌘ on Apple keyboards, Ctrl elsewhere, and only that one: Ctrl+B on a Mac
  // is the caret's move back, which a bold shortcut must not take.
  const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  const KEY = (k) => (MAC ? '⌘' : 'Ctrl+') + k;
  const modKey = (e) => (MAC ? e.metaKey : e.ctrlKey);

  const FORMATS = [
    { kind: 'bold', glyph: 'ph-text-b', label: 'Bold', key: 'B' },
    { kind: 'italic', glyph: 'ph-text-italic', label: 'Italic', key: 'I' },
    { kind: 'link', glyph: 'ph-link-simple', label: 'Link', key: 'K' },
    { kind: 'heading', glyph: 'ph-text-h', label: 'Heading' },
    { kind: 'list', glyph: 'ph-list-bullets', label: 'Bulleted list' },
    { kind: 'code', glyph: 'ph-code', label: 'Code' },
  ];
  const SHORTCUT = { b: 'bold', i: 'italic', k: 'link' };
  const TABS = [['write', 'Write'], ['preview', 'Preview'], ['changes', 'Changes']];

  // Everything that decides where a line wraps and how tall it is.
  const MIRRORED = ['boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
    'letterSpacing', 'wordSpacing', 'lineHeight', 'tabSize', 'textTransform', 'textIndent', 'whiteSpace',
    'overflowWrap', 'wordBreak', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const LINES_MIN = 8;          // a wide card's box never opens shorter than this
  const CHECK_MS = 150;         // margin checks settle this long after the last key
  const FLASH_MS = 5000;        // a check's text stays this long under its line

  function mount(api) {
    const narrowNow = () => { try { return !!api.narrow(); } catch { return false; } };
    const uid = 'md-edit-tabs-' + Math.random().toString(36).slice(2, 8);
    const off = [];             // listeners on window, undone by unmount
    const listen = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
    const st = { tab: 'write', narrow: null, warns: [], cycle: -1, touched: false, scroll: {}, shown: {},
                 ticket: 0, width: 0, writeH: 0, flashLine: null, dead: false };
    let checkT = 0, flashT = 0, frame = 0, settle = 0;

    // ── The parts that persist across tabs and layouts ──────────────────────

    const ta = el('textarea', {
      class: 'block w-full resize-none appearance-none overflow-hidden border-0 bg-transparent py-3 pl-6 pr-4 '
           + 'font-mono text-base leading-7 text-base-content shadow-none outline-none focus:outline-none',
      rows: '1', spellcheck: 'true', 'data-md-edit-source': '', 'aria-label': 'Markdown of § ' + api.title,
    });
    ta.value = api.initial;

    const mirror = el('div', { class: 'pointer-events-none invisible absolute left-0 top-0', 'aria-hidden': 'true' });
    const gutter = el('div', { class: 'pointer-events-none absolute inset-y-0 left-0 w-6' });
    const callout = el('div', {
      class: 'absolute left-6 z-10 hidden w-max max-w-[calc(100%-2.25rem)] scroll-mt-20 scroll-mb-4 cursor-pointer items-start gap-2 rounded-field '
           + 'border border-warning/50 bg-base-100 px-3 py-2 text-sm text-base-content shadow-md',
      role: 'status', 'aria-live': 'polite',
    });
    const write = el('div', { class: 'relative', role: 'tabpanel', id: uid + '-write' }, mirror, ta, gutter, callout);
    const preview = el('div', { class: 'hidden min-w-0 px-6 py-4', role: 'tabpanel', id: uid + '-preview' });
    const changes = el('div', { class: 'hidden min-w-0 px-6 py-4', role: 'tabpanel', id: uid + '-changes' });
    const panes = { write, preview, changes };

    const count = el('span', { class: 'badge badge-xs hidden border-0 bg-base-300 px-1.5 font-mono text-base-content/70' });
    const tabs = TABS.map(([id, label]) => {
      const b = el('button', {
        type: 'button', role: 'tab', class: 'tab gap-1.5' + (id === st.tab ? ' tab-active' : ''),
        id: uid + '-tab-' + id, 'aria-controls': uid + '-' + id, 'aria-selected': String(id === st.tab),
        tabindex: id === st.tab ? '0' : '-1', 'data-md-edit-tab': id,
      }, el('span', { text: label }), id === 'changes' ? count : null);
      b.addEventListener('click', () => setTab(id));
      panes[id].setAttribute('aria-labelledby', b.id);
      return b;
    });
    const tablist = el('div', { role: 'tablist', 'aria-label': 'View', class: 'tabs tabs-border shrink-0 flex-nowrap' }, tabs);
    tablist.addEventListener('keydown', (e) => {
      const i = TABS.findIndex(([id]) => id === st.tab);
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (j == null) return;
      e.preventDefault();
      const id = TABS[(j + TABS.length) % TABS.length][0];
      setTab(id);
      tabs.find((t) => t.dataset.mdEditTab === id).focus();
    });

    const delta = el('span', { class: 'flex items-center gap-1.5 whitespace-nowrap font-mono text-xs' });
    const restoredNote = api.restored
      ? el('span', { class: 'flex items-center gap-1 whitespace-nowrap text-xs leading-tight text-base-content/60' },
          icon('ph-clock-counter-clockwise'), el('span', { text: 'Draft restored' }))
      : null;
    const chipCount = el('span');
    const chip = el('button', {
      type: 'button',
      class: 'btn hidden gap-1 border-warning/40 bg-warning/10 px-2 font-mono text-base-content shadow-none hover:bg-warning/20',
    }, icon('ph-warning', 'text-base text-warning'), chipCount);
    chip.addEventListener('mousedown', (e) => e.preventDefault());
    chip.addEventListener('click', () => nextWarning());
    const sw = api.compareSwitch();

    const go = () => { if (api.changed(ta.value).any) api.publish(); };

    // ── The chrome, built per layout ─────────────────────────────────────────

    let shell = null, cancelBtn = null, publishBtn = null, fmtGroup = null, scroller = null, whereEl = null;
    const undoShell = [];

    const fmtButtons = (cls) => FORMATS.map((f) => {
      const b = el('button', { type: 'button', class: 'btn btn-ghost btn-square ' + cls, 'aria-label': f.label,
                               'data-title-tip': f.key ? f.label + '  ' + KEY(f.key) : f.label }, icon(f.glyph));
      // A press that took focus would drop the selection being formatted and,
      // on a phone, the keyboard with it.
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { if (st.tab === 'write') api.format(ta, f.kind); });
      return b;
    });

    function buildCard() {
      const panel = api.panel, was = panel.className;
      panel.classList.remove('p-3');
      panel.classList.add('overflow-clip');
      undoShell.push(() => { panel.className = was; });
      fmtGroup = el('div', { class: 'flex items-center' }, fmtButtons('btn-sm text-base'),
        sw ? el('span', { class: 'mx-1.5 h-5 w-px shrink-0 bg-base-300' }) : null);
      cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-md-edit-cancel': '', text: 'Cancel' });
      publishBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-md-edit-publish': '',
                                  'data-title-tip': KEY(MAC ? '↵' : 'Enter') }, 'Publish changes');
      const bar = el('div', { class: 'sticky top-0 z-10 flex min-h-11 items-center gap-1 border-b border-base-300 bg-base-200 pl-2 pr-1.5' },
        el('div', { class: 'flex self-end' }, tablist), el('div', { class: 'grow' }), fmtGroup, sw);
      const foot = el('div', { class: 'flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-base-300 px-3 py-2' },
        delta, chip, restoredNote, el('div', { class: 'grow' }),
        el('div', { class: 'flex items-center gap-2' }, cancelBtn, publishBtn));
      const root = el('div', { class: 'flex flex-col', 'data-md-edit-variant': 'tabs' },
        bar, el('div', { class: 'min-w-0' }, write, preview, changes), foot);
      api.content.append(root);
      return root;
    }

    function buildSheet() {
      // 36 px wide by 40 tall, so six of them, the chip and the count fit a
      // 360 px phone; past that the row scrolls rather than wrapping.
      fmtGroup = el('div', { class: 'flex min-w-0 items-center overflow-x-auto' }, fmtButtons('w-9 text-lg'));
      cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost px-2.5', 'data-md-edit-cancel': '',
                                 'aria-label': 'Cancel', 'data-title-tip': 'Cancel' }, icon('ph-x', 'text-xl'));
      publishBtn = el('button', { type: 'button', class: 'btn btn-primary px-4', 'data-md-edit-publish': '' }, 'Publish');
      const where = [String(api.addr.path || '').split('/').pop(), api.addr.ref].filter(Boolean).join(' · ');
      whereEl = where ? el('div', { class: 'truncate font-mono text-xs leading-tight text-base-content/60', text: where }) : null;
      const head = el('div', { class: 'flex h-14 shrink-0 items-center gap-1 border-b border-base-300 px-1.5' },
        cancelBtn,
        el('div', { class: 'min-w-0 flex-1 px-1.5' },
          el('div', { class: 'truncate font-semibold leading-tight', text: api.title }), whereEl, restoredNote),
        publishBtn);
      const strip = el('div', { class: 'flex shrink-0 items-end gap-2 border-b border-base-300 pl-1 pr-2' },
        tablist, el('div', { class: 'grow' }), sw ? el('div', { class: 'self-center' }, sw) : null);
      scroller = el('div', { class: 'relative min-h-0 flex-1 overflow-y-auto overscroll-contain' }, write, preview, changes);
      const foot = el('div', { class: 'flex shrink-0 items-center gap-1 border-t border-base-300 bg-base-200 px-1 py-1' },
        fmtGroup, el('div', { class: 'grow' }),
        el('div', { class: 'flex shrink-0 items-center gap-2 pr-1.5' }, chip, delta));
      // The root covers the layout viewport, keyboard area included, so a
      // keyboard sliding away never shows the page through the gap before the
      // sheet has grown back; the sheet inside it is what follows the keyboard.
      const sheet = el('div', { class: 'absolute inset-x-0 top-0 flex h-full flex-col' }, head, strip, scroller, foot);
      const root = el('div', {
        class: 'fixed inset-0 z-[90] bg-base-100 text-base-content',
        role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit § ' + api.title,
        'data-md-edit-variant': 'tabs', 'data-annotate-ui': '',
      }, sheet);
      document.body.append(root);
      undoShell.push(() => root.remove());
      undoShell.push(lockScroll());
      undoShell.push(liftFab(foot));
      undoShell.push(followViewport(sheet));
      return root;
    }

    // The FAB sits above every surface by design (alpineComponents/fab.js),
    // so the sheet lifts it clear of the formatting bar through the variable
    // the FAB reads for exactly this, as pages/dictate.html does.
    function liftFab(foot) {
      const body = document.body, was = body.style.getPropertyValue('--fab-bottom');
      const set = () => body.style.setProperty('--fab-bottom', 'calc(' + (foot.offsetHeight || 49) + 'px + 0.75rem)');
      set();
      const raf = requestAnimationFrame(set);
      return () => {
        cancelAnimationFrame(raf);
        if (was) body.style.setProperty('--fab-bottom', was); else body.style.removeProperty('--fab-bottom');
      };
    }

    function lockScroll() {
      const html = document.documentElement, body = document.body;
      const was = [html.style.overflow, body.style.overflow, window.scrollX, window.scrollY];
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      // iOS can scroll a locked page to bring a focused field above the
      // keyboard; the reader comes back to where they tapped the pencil.
      return () => { html.style.overflow = was[0]; body.style.overflow = was[1]; window.scrollTo(was[2], was[3]); };
    }

    function followViewport(sheet) {
      const vv = window.visualViewport;
      if (!vv) return () => {};
      let raf = 0;
      const fit = () => {
        raf = 0;
        // A pinch zoom also shrinks the visual viewport; following it would
        // shrink the sheet with the zoom, so the sheet keeps the screen then.
        if (vv.scale > 1.01) { sheet.style.top = ''; sheet.style.height = ''; }
        else { sheet.style.top = vv.offsetTop + 'px'; sheet.style.height = vv.height + 'px'; }
        size();
        keepCaret();
      };
      const soon = () => { if (!raf) raf = requestAnimationFrame(fit); };
      vv.addEventListener('resize', soon);
      vv.addEventListener('scroll', soon);
      fit();
      return () => {
        vv.removeEventListener('resize', soon);
        vv.removeEventListener('scroll', soon);
        cancelAnimationFrame(raf);
      };
    }

    // Built once, and again only when the screen crosses the engine's narrow
    // line (a window resized, a tablet turned), with the same text box moved
    // across so nothing typed is lost.
    function arrange() {
      const narrow = narrowNow();
      if (shell && narrow === st.narrow) return;
      const focused = document.activeElement === ta;
      const sel = [ta.selectionStart, ta.selectionEnd];
      teardown();
      st.narrow = narrow;
      chip.classList.toggle('btn-sm', !narrow);
      shell = narrow ? buildSheet() : buildCard();
      shell.addEventListener('keydown', onKey);
      cancelBtn.addEventListener('click', () => api.confirmCancel(cancelBtn));
      publishBtn.addEventListener('click', go);
      setTab(st.tab, true);
      status();
      if (focused) { ta.focus({ preventScroll: true }); ta.setSelectionRange(sel[0], sel[1]); }
    }

    function teardown() {
      while (undoShell.length) { try { undoShell.pop()(); } catch { /* keep undoing the rest */ } }
      if (shell) shell.remove();
      shell = null; scroller = null; whereEl = null;
    }

    // ── Tabs ─────────────────────────────────────────────────────────────────

    function setTab(id, force) {
      if (id === st.tab && !force) return;
      if (!force) {
        if (scroller) st.scroll[st.tab] = scroller.scrollTop;
        if (st.tab === 'write' && write.offsetHeight) st.writeH = write.offsetHeight;
      }
      st.tab = id;
      for (const t of tabs) {
        const on = t.dataset.mdEditTab === id;
        t.classList.toggle('tab-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      }
      for (const [k, p] of Object.entries(panes)) p.classList.toggle('hidden', k !== id);
      if (fmtGroup) fmtGroup.classList.toggle(st.narrow ? 'hidden' : 'invisible', id !== 'write');
      hideFlash();
      const floor = !st.narrow && st.writeH ? st.writeH + 'px' : '';
      preview.style.minHeight = floor;
      changes.style.minHeight = floor;
      if (id === 'write') {
        size();
        placeMarks();
        if (!force && !st.narrow) ta.focus({ preventScroll: true });
      }
      if (id === 'preview') showPreview();
      if (id === 'changes') showChanges();
      if (scroller) scroller.scrollTop = st.scroll[id] || 0;
    }

    function showPreview() {
      const text = ta.value;
      if (st.shown.preview === text) return;
      st.shown.preview = text;
      if (!text.trim()) preview.replaceChildren(quiet('ph-file-dashed', 'Empty'));
      else api.preview(preview, text);
    }

    async function showChanges() {
      const text = ta.value;
      if (st.shown.changes === text) return;
      const t = ++st.ticket;
      if (!api.changed(text).any) {
        st.shown.changes = text;
        changes.replaceChildren(quiet('ph-equals', 'No changes'));
        return;
      }
      changes.replaceChildren(el('div', { class: 'py-1' }, el('span', { class: 'loading loading-spinner loading-sm text-base-content/50' })));
      const host = el('div', { class: 'min-w-0' });
      try { await api.changes(host, text); }
      catch {
        if (t === st.ticket && !st.dead) changes.replaceChildren(quiet('ph-warning', 'Changes could not be drawn'));
        return;
      }
      if (t !== st.ticket || st.dead) return;
      st.shown.changes = text;
      changes.replaceChildren(host);
    }

    // ── The box, its mirror, and the margin ──────────────────────────────────

    const lineHeight = () => parseFloat(getComputedStyle(ta).lineHeight) || 28;

    // Lay the text out in the mirror and size the box to it. Immediate on
    // every key: the box must never scroll inside itself, or the gutter would
    // drift from its lines.
    function size() {
      if (st.tab !== 'write' || !write.isConnected) return;
      const w = ta.clientWidth;
      if (!w) return;
      const cs = getComputedStyle(ta);
      for (const p of MIRRORED) mirror.style[p] = cs[p];
      mirror.style.width = w + 'px';
      const parts = ta.value.split('\n');
      while (mirror.childElementCount > parts.length) mirror.lastElementChild.remove();
      while (mirror.childElementCount < parts.length) mirror.append(document.createElement('div'));
      parts.forEach((line, i) => {
        const d = mirror.children[i], s = line || '​';
        if (d.textContent !== s) d.textContent = s;
      });
      const lh = parseFloat(cs.lineHeight) || 28;
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      // A phone's box fills the sheet, so a tap anywhere below the text lands in it.
      const floor = st.narrow ? (scroller ? scroller.clientHeight : 0) : lh * LINES_MIN + pad;
      ta.style.height = Math.max(floor, mirror.offsetHeight) + 'px';
      if (ta.scrollHeight > ta.clientHeight + 1) ta.style.height = ta.scrollHeight + 'px';
    }

    function placeMarks() {
      if (st.dead) return;
      const rows = (api.check(ta.value) || []).filter((r) => r.level === 'warn');
      st.warns = rows;
      chip.classList.toggle('hidden', !rows.length);
      chipCount.textContent = String(rows.length);
      chip.setAttribute('aria-label', rows.length === 1 ? '1 warning' : rows.length + ' warnings');
      if (st.tab !== 'write' || !ta.clientWidth) return;
      const byLine = new Map();
      for (const r of rows) for (const i of r.at || []) byLine.set(i, [...(byLine.get(i) || []), r]);
      gutter.replaceChildren(...[...byLine].map(([i, rs]) => marker(i, rs)).filter(Boolean));
    }

    function marker(i, rows) {
      const line = mirror.children[i];
      if (!line) return null;
      const b = el('button', {
        type: 'button', class: 'pointer-events-auto absolute left-0 flex w-6 cursor-pointer justify-center py-1.5',
        'aria-label': rows.map((r) => r.text).join('. '), 'data-md-edit-mark': String(i),
      }, el('span', { class: 'block h-full w-1 rounded-full bg-warning' }));
      b.style.top = line.offsetTop + 'px';
      b.style.height = line.offsetHeight + 'px';
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => pick(i, rows));
      return b;
    }

    function lineRange(i) {
      const parts = ta.value.split('\n');
      let a = 0;
      for (let k = 0; k < i && k < parts.length; k++) a += parts[k].length + 1;
      return [a, a + (parts[i] || '').length];
    }

    // Select the line a check is about and say why under it.
    function pick(i, rows) {
      if (st.tab !== 'write') setTab('write');
      const [a, b] = lineRange(i);
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(a, b);
      flash(i, rows);
    }

    // The chip walks the warnings in turn; one about no line in particular
    // (the whole section removed) speaks from the top.
    function nextWarning() {
      if (!st.warns.length) return;
      st.cycle = (st.cycle + 1) % st.warns.length;
      const r = st.warns[st.cycle];
      if (r.at && r.at.length) pick(r.at[0], [r]);
      else { if (st.tab !== 'write') setTab('write'); flash(0, [r]); }
    }

    function flash(i, rows) {
      const line = mirror.children[i];
      callout.replaceChildren(icon('ph-warning', 'mt-0.5 shrink-0 text-warning'),
        el('div', { class: 'grid min-w-0 gap-0.5' }, rows.map((r) => el('div', { text: r.text }))));
      callout.style.top = (line ? line.offsetTop + line.offsetHeight : 0) + 'px';
      callout.classList.remove('hidden');
      callout.classList.add('flex');
      st.flashLine = i;
      revealFlash();
      clearTimeout(flashT);
      flashT = setTimeout(hideFlash, FLASH_MS);
    }
    function hideFlash() {
      clearTimeout(flashT);
      callout.classList.add('hidden');
      callout.classList.remove('flex');
      st.flashLine = null;
    }
    callout.addEventListener('mousedown', (e) => e.preventDefault());
    callout.addEventListener('click', hideFlash);

    // Bring [top, bottom] of the write pane into view: inside the sheet on a
    // phone, through the document's own scroller on a wide screen.
    function reveal(top, bottom, pad) {
      if (!scroller) return;
      const base = write.offsetTop, view = scroller.scrollTop, h = scroller.clientHeight;
      if (base + bottom + pad > view + h) scroller.scrollTop = Math.min(base + top - pad, base + bottom + pad - h);
      else if (base + top - pad < view) scroller.scrollTop = Math.max(0, base + top - pad);
    }
    function revealFlash() {
      if (st.flashLine == null) return;
      if (!scroller) { callout.scrollIntoView({ block: 'nearest' }); return; }
      reveal(callout.offsetTop - lineHeight(), callout.offsetTop + callout.offsetHeight, 8);
    }

    // Where the caret is drawn, in the mirror: its line laid out again with a
    // probe at the caret's column.
    function caretTop() {
      const v = ta.value, pos = ta.selectionEnd;
      const start = v.lastIndexOf('\n', pos - 1) + 1;
      const end = v.indexOf('\n', pos);
      const i = (v.slice(0, start).match(/\n/g) || []).length;
      const d = mirror.children[i];
      if (!d) return null;
      const line = v.slice(start, end < 0 ? v.length : end);
      const probe = el('span', { text: '​' });
      d.replaceChildren(line.slice(0, pos - start), probe, line.slice(pos - start));
      const y = probe.offsetTop;
      d.textContent = line || '​';
      return y;
    }

    // The sheet scrolls rather than the box, so keeping the caret above the
    // keyboard is this editor's job, not the browser's.
    function keepCaret() {
      if (!scroller || st.tab !== 'write' || document.activeElement !== ta) return;
      if (st.flashLine != null) { revealFlash(); return; }
      const y = caretTop();
      if (y == null) return;
      const lh = lineHeight();
      reveal(y, y + lh, lh);
    }

    // ── Status, keys, input ──────────────────────────────────────────────────

    function status() {
      const d = api.changed(ta.value);
      if (!d.any) delta.replaceChildren(el('span', { class: 'font-sans text-base-content/60', text: 'No changes' }));
      else delta.replaceChildren(el('span', { class: 'text-success', text: '+' + d.added }),
                                 el('span', { class: 'text-error', text: '−' + d.removed }));
      const n = d.added + d.removed;
      count.textContent = String(n);
      count.classList.toggle('hidden', !d.any || !n);
      if (publishBtn) publishBtn.disabled = !d.any;
      // "Draft restored" says where the text came from until the first key.
      // On a phone it stands under the title in place of the file's name,
      // since the formatting bar has no room to spare.
      const restored = !!restoredNote && !st.touched;
      if (restoredNote) restoredNote.classList.toggle('hidden', !restored);
      if (whereEl) whereEl.classList.toggle('hidden', restored);
    }

    function onKey(e) {
      if (e.isComposing || e.defaultPrevented) return;
      if (modKey(e) && e.key === 'Enter') { e.preventDefault(); go(); return; }
      if (modKey(e) && !e.altKey && !e.shiftKey && e.target === ta) {
        const kind = SHORTCUT[String(e.key).toLowerCase()];
        if (kind) { e.preventDefault(); api.format(ta, kind); return; }
      }
      if (e.key === 'Escape') {
        if (st.flashLine != null) { e.preventDefault(); hideFlash(); return; }
        if (ta.value === api.original) { e.preventDefault(); api.confirmCancel(cancelBtn); }
      }
    }

    ta.addEventListener('input', () => {
      st.touched = true;
      api.saveDraft(ta.value);
      hideFlash();
      size();
      status();
      keepCaret();
      clearTimeout(checkT);
      checkT = setTimeout(placeMarks, CHECK_MS);
    });

    // ── Mount ────────────────────────────────────────────────────────────────

    arrange();
    listen(window, 'resize', () => { if (narrowNow() !== st.narrow) arrange(); });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      const w = write.clientWidth;
      if (!w || w === st.width) return;
      st.width = w;
      size();
      placeMarks();
    }) : null;
    if (ro) ro.observe(write);
    // Tailwind's browser build styles a class new to the page after this task
    // ends, so the first measure can read unstyled geometry: measure again
    // once the classes have landed.
    const remeasure = () => { if (!st.dead) { size(); placeMarks(); keepCaret(); } };
    remeasure();
    frame = requestAnimationFrame(remeasure);
    settle = setTimeout(remeasure, 200);

    // A phone opens with the caret after the heading, where an edit to the
    // title would start; a wide card opens at the top, as Wikipedia's does.
    const head = ta.value.indexOf('\n');
    const at = st.narrow ? (head < 0 ? ta.value.length : head) : 0;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(at, at);

    return {
      text: () => ta.value,
      unmount() {
        if (st.dead) return;
        st.dead = true;
        clearTimeout(checkT); clearTimeout(flashT); clearTimeout(settle); cancelAnimationFrame(frame);
        if (ro) ro.disconnect();
        while (off.length) off.pop()();
        teardown();
      },
    };
  }

  window.mdEditVariants.tabs = { mount };
})();
