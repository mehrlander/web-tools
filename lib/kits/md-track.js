// kits/md-track.js — typing over a rendered markdown document makes a tracked
// change: the reading becomes its own redline, and stays open to typing.
//
// The problem this answers. A reader who spots a wrong word in a rendered
// document wants to fix it where it stands: select it and type, or select it
// and delete. The viewer's Preview did nothing with either, and the edit routes
// it had were a section editor over the markdown source (kits/md-edit.js) and
// a page of its own (pages/dictate.html). This kit keeps the reader where they
// are. The first key over a selection turns the Preview into the redline the
// Changes mode draws (mdDiff.redline: the document in its own typography, words
// that left struck, words that arrived tinted, a bar beside each changed block),
// measured against the text that was rendered, and every key after that edits
// the markdown the redline is drawn from.
//
//   mdTrack.attach(box, opts) -> handle
//     box           the rendered document, its column of prose
//     opts.base     the markdown box renders, frontmatter stripped
//     opts.html(md) one block's sanitized HTML, in the host's own rendering
//     opts.file     { repo, ref, path, full, sha? }, all optional: `full` is the
//                   file as read, frontmatter and all, so the patch is the
//                   file's patch and its line numbers are the file's lines
//     opts.restore()  the host draws its reading again, after Discard
//     opts.registry   where a ticket is filed (default web-tools-private)
//   handle: { text, dirty, undo(), discard(), detach() }
//
//   mdTrack.edit(text, sel, op)   -> { text, caret } | null   (pure, below)
//   mdTrack.full(file, base, text) -> [oldFull, newFull], the file both ways
//   mdTrack.where(file, oldFull, newFull) -> 'owner/repo@ref:path (lines …)'
//   mdTrack.prompt(file, patch, note) -> the task a ticket carries
//
// THE MODEL IS THE MARKDOWN STRING, and the DOM is only ever drawn from it. The
// redline is contenteditable while the reader types, and every beforeinput is
// cancelled: its range is mapped to source offsets, the edit is made to the
// string, and the redline is drawn again. So the browser never edits the
// rendered tree, and nothing has to turn HTML back into markdown. The map is
// Standoff.mapText (kits/standoff.js), the one kits/md-surface.js uses: each
// rendered text node stamped with its offset in the source, with the struck
// words left unstamped since they are not in the text. MdSurface's offsetOf,
// domPoint and its rules for typing into a render (tidy, backspace, enter) read
// those stamps, so the rules are the ones pages/dictate.html types by.
//
// A CARET THE PAGE SET IS TRUSTED OVER THE MAP. An offset on markup (just after
// `\n\n` from an Enter, at a bold's closing `**`) belongs to no rendered run, so
// mapping the DOM caret back would move it. While the platform's selection is
// still the point this kit put it at, or a redraw is pending, the model's own
// caret is used.
//
// COMPOSITION IS LET THROUGH. An IME's insertCompositionText cannot be
// cancelled, so the browser edits the tree while a word is composed, and the
// composed word is applied to the string at compositionend, which redraws over
// what the browser did.
//
// WHAT IT COSTS. The whole redline is drawn again for a keystroke, at most once
// a frame. kits/md-surface.js measured a whole-document render at 12ms for 6k
// characters and 210ms for 160k; a long document will lag under fast typing.
// Drawing only the changed block is the next step if that is felt.
//
// Reads window.Standoff, window.mdDiff, window.MdSurface (loaded on the first
// edit, through the page's gh), window.Errands and window.GH for the ticket.
(() => {
  if (window.mdTrack) return;

  const SKIP = '[data-annotate-ui], [data-md-track-ui], .md-fence-lang, button, [aria-hidden="true"]';
  const OLD = 'del, [data-md-redline="removed"], [data-md-redline-row="removed"]';
  const REGISTRY = 'mehrlander/web-tools-private';
  const PROMPT_MAX = 64 * 1024;          // agent_errand.py's PROMPT_MAX
  const UNDO_MAX = 200;

  // ── The edit one input makes, pure ──────────────────────────────────────
  // `sel` is { a, b }, the selection in source offsets. `op.type` is one of
  // insert (with `data`), paragraph, backward, forward; `op.target`, when the
  // platform supplied one, is the range a deletion takes ({ a, b }). Returns
  // the new text and where the caret goes, or null when nothing changes.
  const S = () => window.MdSurface;
  const prevChar = (t, i) => (i >= 2 && /[\uDC00-\uDFFF]/.test(t[i - 1]) && /[\uD800-\uDBFF]/.test(t[i - 2]) ? 2 : 1);
  const nextChar = (t, i) => (/[\uD800-\uDBFF]/.test(t[i] || '') && /[\uDC00-\uDFFF]/.test(t[i + 1] || '') ? 2 : 1);
  function edit(text, sel, op) {
    const t = String(text), a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b);
    const cut = (x, y, ins = '') => ({ text: t.slice(0, x) + ins + t.slice(y), caret: x + ins.length });
    const tidied = (r) => (S() && S().tidy(r.text, r.caret)) || r;
    if (op.type === 'insert') {
      const data = String(op.data ?? '');
      return data || a < b ? cut(a, b, data) : null;
    }
    if (op.type === 'paragraph') return S() ? S().enter(t, a, b) : cut(a, b, '\n\n');
    if (op.type !== 'backward' && op.type !== 'forward') return null;
    if (a < b) return tidied(cut(a, b));
    // A collapsed caret at a line's start: its marker goes, or the block joins
    // the one above (MdSurface.backspace), before any platform range is read,
    // since that range would span the gap and the markers in it.
    if (op.type === 'backward' && S()) { const r = S().backspace(t, a); if (r) return r; }
    const g = op.target && op.target.b > op.target.a ? op.target : null;
    if (g) return tidied(cut(g.a, g.b));
    if (op.type === 'backward') return a > 0 ? tidied(cut(a - prevChar(t, a), a)) : null;
    return a < t.length ? tidied(cut(a, a + nextChar(t, a))) : null;
  }

  // ── The file, the patch and the address ─────────────────────────────────
  // The rendered body may be a suffix of the file (frontmatter stripped), so
  // both sides are put back on the file's head before they are compared.
  const full = (file, base, text) => {
    const f = file && typeof file.full === 'string' ? file.full : null;
    const head = f && f.endsWith(base) ? f.slice(0, f.length - base.length) : '';
    return [head + base, head + text];
  };
  const patchOf = (file, base, text) => {
    const [o, n] = full(file, base, text);
    return S() ? S().patch((file && file.path) || 'document.md', o, n) : '';
  };
  // The base's lines each change touches, with no context, since the base is
  // what the repository holds and so what a session can open.
  const where = (file, o, n) => {
    const f = file || {};
    const addr = f.repo ? f.repo + (f.ref ? '@' + f.ref : '') + ':' + (f.path || '') : (f.path || 'document');
    if (!window.Diff || o === n) return addr;
    const spans = window.Diff.structuredPatch('a', 'b', o, n, '', '', { context: 0 }).hunks.map((h) => (
      h.oldLines === 0 ? 'after ' + h.oldStart : h.oldLines === 1 ? String(h.oldStart) : h.oldStart + '-' + (h.oldStart + h.oldLines - 1)));
    return spans.length ? addr + ' (line' + (spans.length > 1 || /-/.test(spans[0]) ? 's ' : ' ') + spans.join(', ') + ')' : addr;
  };
  // A ticket's task. How a ticket is worked (its own branch, a draft pull
  // request, git apply) is the rules every taker reads first, in
  // web-tools-private sessions/tools/errand_runner.py, so it is not repeated.
  const prompt = (file, patch, note) => {
    const f = file || {};
    return 'Apply this edit to `' + (f.path || 'the document') + '`' + (f.repo ? ' in ' + f.repo : '')
      + (f.ref ? ' (branch ' + f.ref + ')' : '')
      + (f.sha ? ', made against blob ' + String(f.sha).slice(0, 7) : '') + '. '
      + 'The owner typed it over the rendered document in the Web Tools viewer, as tracked changes.'
      + (String(note || '').trim() ? '\n\nThe owner adds: ' + String(note).trim() : '')
      + '\n\n```diff\n' + patch + '\n```';
  };
  const STAGE = 'https://mehrlander.github.io/web-tools/app/?view=stage&errand=';
  const TAKERS = [['gemini', 'Gemini'], ['claude', 'Claude'], ['codex', 'Codex']];

  // ── Loading ─────────────────────────────────────────────────────────────
  // Literal paths, so the pre-build finds them (docs/loader.md).
  let needed = null;
  const need = () => needed || (needed = (async () => {
    const gh = window.gh;
    if (!window.Standoff) await gh.load('kits/standoff.js');
    if (!window.mdDiff) await gh.load('kits/md-diff.js');
    if (!window.MdSurface) await gh.load('kits/md-surface.js');
    if (!window.Diff) await window.mdDiff.needDiff();
  })().catch((e) => { needed = null; throw e; }));

  const say = (icon, msg, ok = true) => {
    try { window.Alpine.store('toast')(icon, msg, ok ? 'alert-success' : 'alert-error', ok ? 2600 : 5000); }
    catch { if (!ok) console.warn('[md-track] ' + msg); }
  };
  const copy = async (text) => {
    try { if (window.io && window.io.copy) return await window.io.copy(text); await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  };

  // A draft outlives its render: the viewer draws a pane again on a mode
  // switch, and a file's edits should be there when the Preview comes back.
  // Per page, in memory; a reload asks first (beforeunload, below).
  const drafts = new Map();
  let warned = false;
  const warnOnLeave = () => {
    if (warned) return;
    warned = true;
    window.addEventListener('beforeunload', (e) => {
      for (const d of drafts.values()) if (d.text !== d.base) { e.preventDefault(); e.returnValue = ''; return; }
    });
  };

  // ── Attaching to a rendered document ────────────────────────────────────
  function attach(box, opts = {}) {
    if (box.__mdTrack) box.__mdTrack.detach();
    const doc = box.ownerDocument, win = doc.defaultView || window;
    const base = String(opts.base || ''), file = opts.file || null, html = opts.html;
    const key = file && file.repo && file.path ? file.repo + '@' + (file.ref || '') + ':' + file.path : null;
    const kept = key && drafts.get(key);
    const st = {
      text: kept && kept.base === base ? kept.text : base,
      undo: kept && kept.base === base ? kept.undo : [], redo: kept && kept.base === base ? kept.redo : [],
      tracked: false, editing: false, sel: null, placed: null, pending: 0, drawn: 0, comp: null,
      rl: null, bar: null, pill: null, last: null, live: true,
    };
    const keep = () => { if (key) { drafts.set(key, { base, text: st.text, undo: st.undo, redo: st.redo }); warnOnLeave(); } };
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

    // ── The map ───────────────────────────────────────────────────────────
    const stamp = (text, old) => {
      delete box.__index;
      window.Standoff.mapText(box, text, 0, { skip: old ? OLD + ', ' + SKIP : SKIP });
    };
    const inBox = (n) => !!n && box.contains(n) && !(n.nodeType === 1 ? n : n.parentElement)?.closest?.(SKIP);
    const selRange = () => {
      const s = win.getSelection && win.getSelection();
      if (!s || !s.rangeCount) return null;
      const r = s.getRangeAt(0);
      return inBox(r.startContainer) && inBox(r.endContainer) ? r : null;
    };
    const toSrc = (r) => {
      const M = S();
      if (r.collapsed) { const a = M.offsetOf(box, r.startContainer, r.startOffset, 'end'); return a == null ? null : { a, b: a }; }
      const a = M.offsetOf(box, r.startContainer, r.startOffset, 'start'), b = M.offsetOf(box, r.endContainer, r.endOffset, 'end');
      return a == null || b == null ? null : { a: Math.min(a, b), b: Math.max(a, b) };
    };
    const samePoint = () => {
      const s = win.getSelection(), p = st.placed;
      return !!(p && s && s.rangeCount && s.isCollapsed && s.anchorNode === p.node && s.anchorOffset === p.offset);
    };
    const selNow = () => {
      if (st.sel && (st.pending || samePoint())) return st.sel;
      const r = selRange();
      return r ? toSrc(r) : st.sel;
    };
    const place = (at) => {
      const p = S().domPoint(box, at, 'end');
      st.placed = null;
      if (!p) return;
      try { win.getSelection().collapse(p.node, p.offset); st.placed = { node: p.node, offset: p.offset }; } catch {}
    };

    // ── Drawing ───────────────────────────────────────────────────────────
    const draw = async () => {
      const tok = ++st.drawn;
      st.pending = 0;
      const rl = await window.mdDiff.redline(box, base, st.text, { html });
      if (tok !== st.drawn || !st.live) return;
      st.rl = rl;
      stamp(st.text, true);
      // The struck words are the base's, not the text's: the caret steps over
      // them rather than into them.
      for (const n of box.querySelectorAll(OLD)) n.contentEditable = 'false';
      if (st.editing && st.sel && doc.activeElement === box) place(st.sel.b);
      showBar();
    };
    const schedule = () => {
      if (st.pending) return;
      st.pending = (win.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { draw().catch((e) => fail(e)); });
    };
    const fail = (e) => say('warning', 'The edit could not be drawn: ' + ((e && e.message) || e), false);

    // ── Changing the text ─────────────────────────────────────────────────
    // A run of typed characters is one undo step, as a word processor keeps it.
    let run = null;
    const commit = (res, kind) => {
      if (!res || res.text === st.text) return false;
      const coalesce = kind === 'insert' && run && run.at === (st.sel && st.sel.a) && Date.now() - run.t < 1500;
      if (!coalesce) { st.undo.push({ text: st.text, caret: st.sel ? st.sel.a : 0 }); if (st.undo.length > UNDO_MAX) st.undo.shift(); }
      st.redo = [];
      st.text = res.text;
      st.sel = { a: res.caret, b: res.caret };
      run = kind === 'insert' ? { at: res.caret, t: Date.now() } : null;
      keep();
      schedule();
      return true;
    };
    const step = (from, to) => {
      const s = from.pop();
      if (!s) return;
      to.push({ text: st.text, caret: st.sel ? st.sel.a : 0 });
      st.text = s.text;
      st.sel = { a: s.caret, b: s.caret };
      run = null;
      keep();
      schedule();
    };
    const undo = () => step(st.undo, st.redo);
    const redo = () => step(st.redo, st.undo);

    // The first edit, from a key over a selection or the pill on a phone.
    // `r` is a Range captured before anything moved.
    const begin = async (r, op, type) => {
      const pts = [r.startContainer, r.startOffset, r.endContainer, r.endOffset];
      try { await need(); } catch (e) { say('warning', 'The edit kits did not load: ' + ((e && e.message) || e), false); return; }
      if (!st.live) return;
      if (!st.tracked) stamp(base, false);
      const rr = doc.createRange();
      try { rr.setStart(pts[0], pts[1]); rr.setEnd(pts[2], pts[3]); } catch { return; }
      const sel = toSrc(rr);
      if (!sel) { say('warning', 'That selection could not be found in the markdown', false); return; }
      st.sel = sel;
      st.tracked = true;
      if (type) startEditing();
      commit(edit(st.text, sel, op), op.type);
      if (!st.pending) schedule();
    };
    const startEditing = () => {
      st.editing = true;
      box.contentEditable = 'true';
      box.spellcheck = true;
      // The caret is the cue; a focus ring around the whole column is not.
      box.classList.add('outline-none');
      if (doc.activeElement !== box) box.focus({ preventScroll: true });
      hidePill();
      showBar();
    };
    const stopEditing = () => {
      st.editing = false;
      box.contentEditable = 'false';
      st.placed = null;
      showBar();
    };
    const discard = () => {
      if (key) drafts.delete(key);
      st.text = base; st.undo = []; st.redo = []; st.sel = null;
      st.tracked = false; stopEditing();
      box.removeAttribute('contenteditable');
      removeBar();
      if (typeof opts.restore === 'function') opts.restore();
      else draw().then(() => removeBar());
    };

    // ── Input ─────────────────────────────────────────────────────────────
    const isTyping = (e) => !e.ctrlKey && !e.metaKey && !e.altKey && e.key && e.key.length <= 2 && e.key !== ' '
      && [...e.key].length === 1;
    const onKey = (e) => {
      if (!box.isConnected) { detach(); return; }
      if (st.editing) {
        if (e.key === 'Escape') { e.preventDefault(); stopEditing(); return; }
        if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z' && doc.activeElement === box) {
          e.preventDefault(); e.shiftKey ? redo() : undo(); return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && doc.activeElement === box) { e.preventDefault(); redo(); }
        return;
      }
      if (e.defaultPrevented || e.isComposing) return;
      const del = (e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!del && !isTyping(e)) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      const r = selRange();
      if (!r || r.collapsed) return;
      e.preventDefault();
      begin(r.cloneRange(), del ? { type: e.key === 'Delete' ? 'forward' : 'backward' } : { type: 'insert', data: e.key }, true);
    };
    const KIND = {
      insertText: 'insert', insertReplacementText: 'insert', insertFromPaste: 'insert', insertFromDrop: 'insert',
      insertFromYank: 'insert', insertParagraph: 'paragraph', insertLineBreak: 'paragraph',
    };
    const onBefore = (e) => {
      if (!st.editing) return;
      if (e.inputType === 'insertCompositionText' || e.isComposing) return;
      e.preventDefault();
      if (!window.MdSurface) return;
      if (e.inputType === 'historyUndo') { undo(); return; }
      if (e.inputType === 'historyRedo') { redo(); return; }
      const kind = KIND[e.inputType] || (/^delete/.test(e.inputType) ? (/Forward$/.test(e.inputType) ? 'forward' : 'backward') : null);
      if (!kind) return;                     // formatBold and the rest: markdown is typed
      let sel = selNow();
      // A replacement (autocorrect, a spelling pick) and a deletion name their
      // own range; an insertion goes where the selection is.
      let target = null;
      const tr = e.getTargetRanges ? e.getTargetRanges() : [];
      if (tr.length && (kind !== 'insert' || e.inputType === 'insertReplacementText')) {
        const g = doc.createRange();
        try { g.setStart(tr[0].startContainer, tr[0].startOffset); g.setEnd(tr[0].endContainer, tr[0].endOffset); target = toSrc(g); } catch {}
      }
      if (e.inputType === 'insertReplacementText' && target) sel = target;
      if (!sel) return;
      const data = kind === 'insert'
        ? (e.data ?? (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '') ?? '') : '';
      commit(edit(st.text, sel, { type: kind, data, target }), kind);
    };
    const onCompStart = () => { if (st.editing) st.comp = selNow(); };
    const onCompEnd = (e) => {
      if (!st.editing || !st.comp) return;
      const sel = st.comp;
      st.comp = null;
      if (!commit(edit(st.text, sel, { type: 'insert', data: e.data || '' }), 'insert')) schedule();
    };
    const onFocusOut = (e) => {
      if (!st.editing || st.comp) return;
      const to = e.relatedTarget;
      if (to && (box.contains(to) || (st.bar && st.bar.contains(to)))) return;
      stopEditing();
    };

    // ── The bar: what the edit is, and where it can go ────────────────────
    const btn = (icon, tip, run) => {
      const b = el('button', 'btn btn-ghost btn-sm btn-circle hover:text-primary');
      b.type = 'button';
      b.dataset.titleTip = tip;
      b.setAttribute('aria-label', tip);
      b.append(el('i', 'ph ' + icon + ' text-base'));
      // Keeps the caret: a press on the bar would otherwise blur the document.
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.preventDefault(); run(b); });
      return b;
    };
    const showBar = () => {
      if (!st.tracked) return;
      if (!st.bar) buildBar();
      const n = st.rl ? st.rl.count : 0;
      st.bar.__count.textContent = !n ? 'no changes' : st.rl.at >= 0 ? (st.rl.at + 1) + ' of ' + n : n + (n === 1 ? ' change' : ' changes');
      st.bar.__undo.disabled = !st.undo.length;
      st.bar.__mode.replaceChildren(el('i', 'ph ' + (st.editing ? 'ph-check' : 'ph-pencil-simple') + ' text-base'));
      st.bar.__mode.dataset.titleTip = st.editing ? 'Done typing (Esc): the changes stay' : 'Keep typing, at the current change';
      st.bar.__mode.setAttribute('aria-label', st.bar.__mode.dataset.titleTip);
      const remote = !!(file && file.repo && file.path);
      for (const li of st.bar.querySelectorAll('[data-md-track-remote]')) li.classList.toggle('hidden', !remote);
      st.bar.__ticket.classList.toggle('hidden', !st.ticket);
      if (st.ticket) {
        st.bar.__ticket.href = STAGE + encodeURIComponent(st.ticket);
        st.bar.__ticket.dataset.titleTip = 'Ticket ' + st.ticket + ': open it on the Stage';
      }
    };
    // WHERE THE EDIT GOES is one ⋮ menu, labelled, rather than bare icons: a
    // reader picks among them by what they do, and on a phone more buttons ran
    // the bar under the app's floating button. Nothing here commits: the edit
    // leaves as a patch, an address, or a ticket, which an assistant applies on
    // a branch of its own where the repository's hook and CI run (the rule the
    // documentation calls' answers follow, pages/dictate.html, "Record only").
    const menuItem = (icon, label, tip, run) => {
      const li = el('li');
      const b = el('button', 'flex items-start gap-2 text-left');
      b.type = 'button';
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.preventDefault(); closeMenu(); run(b); });
      const words = el('span', 'flex flex-col');
      words.append(el('span', 'font-medium', label), el('span', 'text-xs text-base-content/60', tip));
      b.append(el('i', 'ph ' + icon + ' text-base mt-0.5'), words);
      li.append(b);
      return li;
    };
    const closeMenu = () => { if (st.bar) { st.bar.__menu.classList.add('hidden'); st.bar.__sheet.classList.add('hidden'); } };
    const onDocDown = (e) => { if (st.bar && !st.bar.contains(e.target)) closeMenu(); };
    const buildBar = () => {
      const bar = el('div', 'sticky bottom-3 z-20 my-3 flex w-fit max-w-full items-center gap-0.5 rounded-full border border-base-300 bg-base-100/90 p-0.5 text-sm shadow-md backdrop-blur max-sm:ml-0 max-sm:mr-auto sm:mx-auto');
      bar.dataset.mdTrackUi = '';
      bar.setAttribute('data-annotate-ui', '');
      bar.contentEditable = 'false';
      const nav = (d) => () => { if (!st.rl || !st.rl.count) return; d > 0 ? st.rl.next() : st.rl.prev(); showBar(); };
      const count = el('span', 'px-1 tabular-nums text-base-content/80 whitespace-nowrap');
      count.dataset.mdTrackCount = '';
      const sep = () => el('span', 'mx-0.5 h-5 w-px bg-base-300');
      bar.__count = count;
      bar.__ticket = el('a', 'btn btn-ghost btn-sm btn-circle text-primary hidden');
      bar.__ticket.target = '_blank';
      bar.__ticket.rel = 'noopener';
      bar.__ticket.append(el('i', 'ph ph-ticket text-base'));
      bar.__undo = btn('ph-arrow-counter-clockwise', 'Undo the last change (⌘Z)', () => undo());
      bar.__mode = btn('ph-check', '', () => {
        if (st.editing) { stopEditing(); return; }
        const at = st.sel ? st.sel.b : 0;
        startEditing();
        st.sel = { a: at, b: at };
        place(at);
      });
      const menu = el('ul', 'menu menu-sm absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-box border border-base-300 bg-base-100 shadow-lg hidden');
      const path = menuItem('ph-map-pin', 'Copy the address', 'The file and the lines the edit touches', async () => {
        const [o, n] = full(file, base, st.text);
        say('clipboard-text', await copy(where(file, o, n)) ? 'Copied the address' : 'The browser refused the clipboard', true);
      });
      const ticket = menuItem('ph-ticket', 'Submit ticket', 'An assistant applies the edit on a branch of its own and opens a draft PR', () => {
        bar.__sheet.classList.remove('hidden');
        st.__note.focus({ preventScroll: true });
      });
      path.dataset.mdTrackRemote = ticket.dataset.mdTrackRemote = '';
      menu.append(menuItem('ph-git-diff', 'Copy the patch', 'A unified diff that git apply takes', async () => {
        const p = patchOf(file, base, st.text);
        if (!p) { say('info', 'Nothing has changed'); return; }
        say(await copy(p) ? 'clipboard-text' : 'warning', 'Copied the patch', true);
      }), path, ticket);
      bar.__menu = menu;
      bar.__sheet = buildSheet();
      const send = btn('ph-dots-three-vertical', 'Copy the patch or the address, or submit a ticket', () => {
        bar.__sheet.classList.add('hidden');
        menu.classList.toggle('hidden');
      });
      const out = btn('ph-x', 'Discard every change (tap twice)', (b) => {
        if (!b.__armed) {
          b.__armed = true;
          b.classList.add('text-error');
          setTimeout(() => { b.__armed = false; b.classList.remove('text-error'); }, 2500);
          say('warning', 'Tap again to discard the changes', true);
          return;
        }
        discard();
      });
      bar.append(btn('ph-caret-left', 'Previous change', nav(-1)), count, btn('ph-caret-right', 'Next change', nav(1)), sep(), bar.__ticket,
                 bar.__undo, send, out, sep(), bar.__mode, menu, bar.__sheet);
      (box.parentElement || box).append(bar);
      st.bar = bar;
    };
    const removeBar = () => { if (st.bar) st.bar.remove(); st.bar = null; };

    // THE TICKET SHEET: a note and who may take it. None picked is anyone,
    // and since the Gemini daemon polls and the others wait to be asked, an
    // open ticket usually goes to Gemini first; picking leaves Gemini out
    // when it is broken. web-tools-private errands/README.md, "Tickets".
    const buildSheet = () => {
      const sheet = el('div', 'absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-box border border-base-300 bg-base-100 p-3 shadow-lg hidden flex flex-col gap-2');
      sheet.dataset.mdTrackSheet = '';
      sheet.append(el('div', 'font-medium', 'Submit ticket'));
      const note = el('textarea', 'textarea textarea-sm w-full min-h-16 text-sm');
      note.placeholder = 'Anything to add (optional)';
      const takers = el('div', 'flex flex-wrap items-center gap-1');
      takers.append(el('span', 'mr-1 text-xs text-base-content/60', 'Open to'));
      const picked = new Set();
      const hint = el('div', 'text-xs text-base-content/60');
      const and = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
      const say_ = () => {
        hint.textContent = picked.size ? 'Only ' + and(TAKERS.filter(([k]) => picked.has(k)).map(([, n]) => n)) + ' may take it.'
          : 'Anyone may take it: Gemini usually first.';
      };
      for (const [k, n] of TAKERS) {
        const chip = el('button', 'btn btn-xs rounded-full', n);
        chip.type = 'button';
        chip.dataset.mdTrackTaker = k;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          picked.has(k) ? picked.delete(k) : picked.add(k);
          chip.classList.toggle('btn-primary', picked.has(k));
          say_();
        });
        takers.append(chip);
      }
      say_();
      const row = el('div', 'flex justify-end gap-1');
      const cancel = el('button', 'btn btn-ghost btn-sm', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', (e) => { e.preventDefault(); sheet.classList.add('hidden'); });
      const go = el('button', 'btn btn-primary btn-sm', 'Submit');
      go.type = 'button';
      go.dataset.mdTrackSubmit = '';
      go.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await fileTicket(go, note.value, [...picked])) { note.value = ''; sheet.classList.add('hidden'); }
      });
      row.append(cancel, go);
      sheet.append(note, takers, hint, row);
      st.__note = note;
      return sheet;
    };
    const fileTicket = async (b, note, openTo) => {
      if (b.disabled) return false;
      const p = patchOf(file, base, st.text);
      if (!p) { say('info', 'Nothing has changed'); return false; }
      const task = prompt(file, p, note);
      if (task.length > PROMPT_MAX) { say('warning', 'The edit is too long for a ticket: copy the patch instead', false); return false; }
      b.disabled = true;
      let ok = false;
      try {
        if (!window.Errands) await window.gh.load('kits/errands.js');
        if (!window.TOKEN) throw new Error('no GitHub token on this browser');
        const g = new window.GH({ token: window.TOKEN, repo: opts.registry || REGISTRY, ref: window.Errands.BRANCH });
        if (typeof g.save !== 'function') await window.gh.load('gh-store.js');
        const req = window.Errands.ticketRequest({ title: 'Apply an edit to ' + file.path, prompt: task, openTo,
          subject: file.repo + (file.ref ? '@' + file.ref : '') + ':' + file.path, registry: opts.registry });
        await g.save(window.Errands.DIR.req + '/' + req.id + '.json', req, 'File a ticket: ' + req.title + ' via Web Tools');
        st.ticket = req.id;
        showBar();
        say('ticket', 'Submitted ' + req.id + (openTo.length ? ' for ' + openTo.join(', ') : ''), true);
        ok = true;
      } catch (e) {
        say('warning', 'The ticket was not submitted: ' + ((e && e.message) || e), false);
      }
      b.disabled = false;
      return ok;
    };

    // ── On a phone: a selection has no key to type, so it gets a pill ─────
    const coarse = () => !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
    const hidePill = () => { if (st.pill) st.pill.classList.add('hidden'); };
    const showPill = (r) => {
      if (!st.pill) {
        const p = el('div', 'fixed z-50 flex items-center gap-0.5 rounded-full border border-base-300 bg-base-100 p-0.5 text-sm shadow-lg');
        p.dataset.mdTrackUi = '';
        p.setAttribute('data-annotate-ui', '');
        const go = (op, type) => (e) => {
          e.preventDefault();
          const lr = st.last;
          if (!lr) return;
          // Focus inside the tap, or iOS raises no keyboard.
          if (type) { box.contentEditable = 'true'; box.focus({ preventScroll: true }); }
          hidePill();
          begin(lr, op, type);
        };
        const item = (icon, label, run) => {
          const b = el('button', 'btn btn-ghost btn-sm rounded-full gap-1');
          b.type = 'button';
          b.append(el('i', 'ph ' + icon + ' text-base'), label);
          b.addEventListener('pointerdown', (e) => e.preventDefault());
          b.addEventListener('click', run);
          return b;
        };
        p.append(item('ph-cursor-text', 'Replace', go({ type: 'backward' }, true)),
                 item('ph-backspace', 'Delete', go({ type: 'backward' }, false)));
        doc.body.append(p);
        st.pill = p;
      }
      const rect = r.getBoundingClientRect(), vw = win.innerWidth;
      st.pill.classList.remove('hidden');
      const w = st.pill.offsetWidth || 180;
      st.pill.style.left = Math.max(8, Math.min(vw - w - 8, rect.left + rect.width / 2 - w / 2)) + 'px';
      // Below the selection: iOS puts its own callout above it.
      st.pill.style.top = Math.min(win.innerHeight - 56, rect.bottom + 28) + 'px';
    };
    let selTimer = 0;
    const onSel = () => {
      if (!box.isConnected) { detach(); return; }
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const r = selRange();
        if (r && !r.collapsed && !st.editing) st.last = r.cloneRange();
        if (!coarse()) return;
        if (r && !r.collapsed && !st.editing) showPill(r); else hidePill();
      }, 180);
    };
    const onScroll = () => hidePill();

    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('selectionchange', onSel);
    doc.addEventListener('pointerdown', onDocDown, true);
    win.addEventListener('scroll', onScroll, true);
    box.addEventListener('beforeinput', onBefore);
    box.addEventListener('compositionstart', onCompStart);
    box.addEventListener('compositionend', onCompEnd);
    box.addEventListener('focusout', onFocusOut);

    function detach() {
      if (!st.live) return;
      st.live = false;
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('selectionchange', onSel);
      doc.removeEventListener('pointerdown', onDocDown, true);
      win.removeEventListener('scroll', onScroll, true);
      box.removeEventListener('beforeinput', onBefore);
      box.removeEventListener('compositionstart', onCompStart);
      box.removeEventListener('compositionend', onCompEnd);
      box.removeEventListener('focusout', onFocusOut);
      if (st.pill) st.pill.remove();
      if (box.__mdTrack === handle) delete box.__mdTrack;
    }

    const handle = {
      get text() { return st.text; }, get dirty() { return st.text !== base; },
      get tracked() { return st.tracked; }, get editing() { return st.editing; },
      get redline() { return st.rl; },
      patch: () => patchOf(file, base, st.text),
      undo, redo, discard, detach,
    };
    box.__mdTrack = handle;
    // A draft kept from an earlier render of this file comes back as it was.
    if (st.text !== base) {
      st.tracked = true;
      need().then(() => st.live && draw()).catch((e) => fail(e));
    }
    return handle;
  }

  window.mdTrack = { attach, edit, full, where, prompt, _drafts: drafts };
})();
