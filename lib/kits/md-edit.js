// kits/md-edit.js — edit one section of a markdown file where it is rendered,
// and save it back to the repository it came from.
//
// kits/md-doc.js puts controls on every heading and already knows each
// section's SOURCE: where it starts and ends in the file, and which file at
// which address. This kit is the pencil among them, Wikipedia's [edit] link.
// The pencil opens an editor over the section (a variant, see "Variants"), and
// Publish opens a commit sheet with the checks, the message and where the
// save lands.
//
//   mdEdit.open({ sec, head, edit, rerender })
//     sec       a section from mdDoc.split, of the body that was rendered
//     head      its heading node inside a declared render (md-doc stamps it)
//     edit      the host's opt-in: { full, onSaved? }. `full` is the whole file
//               as read, frontmatter included, since the rendered body may be
//               a suffix of it. `onSaved(text, info)` lets the host re-render
//               from the saved text; return true when it did.
//     rerender  md-doc's own re-render of the box, used when the host did not
//
// THE SAVE NEVER WRITES OVER A NEWER VERSION, which the shared save would: on a
// conflict gh-store refetches the sha and puts again. This reads the file fresh
// first. If it is still what was rendered, the section is replaced where it
// was. If it moved, the section's ORIGINAL text is looked for in the newer file
// and replaced there when it occurs exactly once, which is how Wikipedia keeps
// two edits to different sections from colliding. Anything else is a conflict:
// the draft is kept and both are offered, and nothing is written. The PUT
// itself goes out `strict`, so a race between the read and the write comes
// back here to be rebased rather than being settled by overwriting.
//
// WHAT RUNS AROUND THE SAVE. Before it: a generated file is refused (its
// "do not edit" line, or a stage of the repo's commit hook in
// docs/hook-legs.csv); the checks are the edit's own shape (heading kept,
// level kept, a renamed anchor and who links to it, em dashes in added lines,
// links that point nowhere). After it: the commit, its checks, and, where the
// repo declares hook legs, which generated files the edit sets off and the
// repair commit that refreshes them on the default branch.
//
// Pure helpers ride on window.mdEdit for node/test/md-edit.test.mjs.
(() => {
  if (window.mdEdit) return;

  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  // Literal paths, so the build walker sees each one (docs/loader.md).
  const needStore = () => (window.GH && window.GH.prototype.save) ? Promise.resolve()
    : ghRef.load('gh-store.js');
  const needTransfer = () => (window.GH && window.GH.prototype.createPull) ? Promise.resolve()
    : ghRef.load('gh-transfer.js');

  const FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };
  // A commit, full or abbreviated: links pin one as a short sha (showing.py
  // mints `@<12 hex>`), and a write cannot land on a commit. A branch named in
  // nothing but hex would read as one too, which costs it the pencil only.
  const SHA_REF = /^[0-9a-f]{7,40}$/i;
  const editableRef = (ref) => !!ref && !SHA_REF.test(ref);
  const slugify = (s) => (window.mdDoc && window.mdDoc._slugify)
    ? window.mdDoc._slugify(s)
    : String(s || '').trim().toLowerCase().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
  const token = () => {
    try { return (window.ghAuth && window.ghAuth.resolve && window.ghAuth.resolve()) || ''; }
    catch { return ''; }
  };
  const client = (repo, ref) => new window.GH({ token: token(), repo, ref });
  // github.com addresses have one owner (kits/repo-address.js), which boots on
  // every loader page.
  const hub = () => window.RepoAddress && window.RepoAddress.github;

  // ── Pure: where the section goes ──────────────────────────────────────────

  // Where the rendered body starts in the file. A host that strips frontmatter
  // before rendering (the viewer does) hands md-doc a SUFFIX of the file, and
  // every section offset is counted against that suffix. -1 when the body is
  // not the file's tail, which means this render cannot be written back.
  function offsetOf(full, body) {
    full = String(full ?? ''); body = String(body ?? '');
    if (full === body) return 0;
    return full.endsWith(body) ? full.length - body.length : -1;
  }

  // Replace [a, b) with `next`. A section's raw ends at its last non-blank
  // character, so the blank lines that separate it from the next heading are
  // outside the range and survive; `next` is trimmed at the end to match. An
  // emptied section takes its trailing gap with it rather than leaving a hole.
  function splice(text, a, b, next) {
    const n = String(next ?? '').replace(/\s+$/, '');
    if (!n) return text.slice(0, a) + text.slice(b).replace(/^\s+/, '');
    return text.slice(0, a) + n + text.slice(b);
  }

  const place = (full, at, sec, next) => splice(full, at + sec.start, at + sec.end, next);

  // The file moved since it was read: put the edit where the section's original
  // text now is, if that text is still there and nowhere else.
  function rebase(current, sec, next) {
    const raw = sec.raw;
    const i = current.indexOf(raw);
    if (i < 0) return { conflict: 'changed' };
    if (current.indexOf(raw, i + 1) >= 0) return { conflict: 'ambiguous' };
    return { text: splice(current, i, i + raw.length, next) };
  }

  // The first line as a heading: ATX (`## Title`) or setext (`Title` over ===).
  function heading(text) {
    const lines = String(text ?? '').replace(/^\s*\n/, '').split('\n');
    const atx = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(lines[0] || '');
    if (atx) return { depth: atx[1].length, title: atx[2].trim(), setext: false };
    const under = /^ {0,3}(=+|-+)[ \t]*$/.exec(lines[1] || '');
    if (lines[0] && lines[0].trim() && under) {
      return { depth: under[1][0] === '=' ? 1 : 2, title: lines[0].trim(), setext: true };
    }
    return null;
  }

  // Lines of `next` that are new, as indexes, with fenced code marked so a
  // check about prose can skip it. A multiset rather than a diff: a line that
  // moved is not new, and a check that fired on reordering would be noise.
  function addedLines(before, next) {
    const pool = new Map();
    for (const l of String(before ?? '').split('\n')) pool.set(l, (pool.get(l) || 0) + 1);
    const out = [];
    let fence = false;
    String(next ?? '').split('\n').forEach((l, i) => {
      const isFence = /^\s{0,3}(```|~~~)/.test(l);
      const left = pool.get(l) || 0;
      if (left) pool.set(l, left - 1);
      else out.push({ i, line: l, code: fence || isFence });
      if (isFence) fence = !fence;
    });
    return out;
  }

  // The checks that need nothing but the two texts. `o.body` is the rendered
  // body after the edit, for same-document anchors; `o.line` is the file line
  // the section starts on, so a warning names a line the reader can find.
  // `at` holds the lines of `next` a row is about, 0-based, for an editor that
  // marks them in a margin.
  function checks(sec, next, o = {}) {
    const out = [];
    const before = sec.raw;
    if (String(next ?? '').trim() === before.trim()) {
      out.push({ id: 'same', level: 'info', text: 'No changes' });
      return out;
    }
    if (!String(next ?? '').trim()) {
      out.push({ id: 'removed', level: 'warn', text: 'Removes the whole section' });
      return out;
    }
    const was = heading(before), now = heading(next);
    if (was && !now) {
      out.push({ id: 'heading', level: 'warn', at: [0], text: 'No heading on the first line: this text joins the section above' });
    } else if (was && now) {
      if (now.depth !== was.depth) {
        out.push({ id: 'level', level: 'warn', at: [0],
                   text: 'Heading level ' + '#'.repeat(was.depth) + ' becomes ' + '#'.repeat(now.depth) });
      }
      const from = slugify(was.title), to = slugify(now.title);
      if (from !== to) {
        out.push({ id: 'anchor', level: 'warn', slug: from, at: [0],
                   text: 'Anchor #' + from + ' becomes #' + to });
        const n = o.body ? countAnchor(o.body, from) : 0;
        if (n) out.push({ id: 'anchor-here', level: 'warn',
                          text: n + (n === 1 ? ' link' : ' links') + ' in this file point at #' + from });
      }
    }
    const base = o.line || 1;
    const dashed = addedLines(before, next)
      .filter(a => !a.code && (/—/.test(a.line) || /\S\s--\s\S/.test(a.line)))
      .map(a => a.i);
    if (dashed.length) {
      out.push({ id: 'dash', level: 'warn', at: dashed,
                 text: 'Em dash on ' + (dashed.length === 1 ? 'line ' : 'lines ') + dashed.map(i => base + i).join(', ') });
    }
    return out;
  }

  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countAnchor = (text, slug) =>
    (String(text).match(new RegExp('\\]\\(#' + escRe(slug) + '\\)', 'g')) || []).length;

  // Links that are new in `next`: their target as written, and whether it is
  // in this file (`#slug`) or another (`path[#slug]`). External addresses are
  // left out, since nothing here can say whether a website still answers.
  function newLinks(before, next) {
    const grab = (t) => [...String(t ?? '').matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map(m => m[1]);
    const had = new Set(grab(before));
    return [...new Set(grab(next))].filter(h => !had.has(h) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(h));
  }

  // ── Pure: generated files and the hook legs ───────────────────────────────

  // The marker generated files carry near their top: "GENERATED from … do not
  // hand-edit", "_Generated from tasks/. Do not hand-edit._". One line, near the
  // top, so a document that merely discusses generated files does not trip it.
  // Letter boundaries rather than \b, since the board's line is italicized with
  // underscores and `_Generated` has no word boundary before the G.
  const GEN_MARK = /(?<![a-z])generated(?![a-z])[^\n]{0,200}?do not (?:hand[- ]?)?edit|do not (?:hand[- ]?)?edit[^\n]{0,200}?(?<![a-z])generated(?![a-z])/i;

  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0]) rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows;
    return head ? body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))) : [];
  }

  const list = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);

  // A watch or a stage, against a path. `*.md` (no slash) is any file by that
  // name pattern anywhere; a glob with a slash is matched whole; anything else
  // is the file itself or a folder above it.
  function matches(pattern, path) {
    const p = String(pattern).replace(/\/+$/, '');
    if (p.includes('*')) {
      const re = new RegExp('^' + p.split('*').map(escRe).join('[^/]*') + '$');
      return re.test(p.includes('/') ? path : path.split('/').pop());
    }
    return path === p || path.startsWith(p + '/');
  }

  function generated(full, path, legs) {
    const top = String(full ?? '').slice(0, 600);
    const m = GEN_MARK.exec(top);
    if (m) {
      const a = top.lastIndexOf('\n', m.index) + 1, b = top.indexOf('\n', m.index);
      return { why: top.slice(a, b < 0 ? undefined : b).replace(/^<!--\s*|\s*-->$/g, '').trim() };
    }
    for (const l of legs || []) {
      if (l.mode === 'regenerates' && list(l.stages).some(s => matches(s, path))) {
        return { why: 'Written by the commit hook (' + l.leg + ': ' + l.runs + ')', leg: l };
      }
    }
    return null;
  }

  // The legs an edit to `path` sets off: what they regenerate, and whether the
  // repair pass on the default branch runs them.
  function legsFor(path, legs) {
    return (legs || []).filter(l => l.mode === 'regenerates' && list(l.stages).length
      && list(l.watches).some(w => matches(w, path)));
  }

  const stagesOf = (legs) => [...new Set(legs.flatMap(l => list(l.stages)))];

  // ── Pure: what a reviewer gets, and what the checks say ───────────────────

  const REVIEW = 'Review this edit to the section named below. Does the new text read '
               + 'better, stay consistent with the rest of the document, and keep every '
               + 'fact? Point to specific lines.';

  function fenceFor(text) {
    const runs = String(text ?? '').match(/`{3,}/g) || [];
    return '`'.repeat(Math.max(3, ...runs.map(r => r.length + 1)));
  }

  function reviewText(sec, next, addr) {
    const ref = (window.mdDoc && window.mdDoc.reference) ? window.mdDoc.reference(sec, addr) : [];
    const block = (t) => { const f = fenceFor(t); return [f + 'markdown', t, f]; };
    return [REVIEW, '', ...ref, '', 'Before:', ...block(sec.raw), '', 'After:', ...block(next)].join('\n');
  }

  // Check runs on one commit, reduced to the one line a reader wants.
  function summarize(runs) {
    const rs = runs || [];
    if (!rs.length) return { state: 'none' };
    const ok = new Set(['success', 'neutral', 'skipped']);
    const bad = rs.filter(r => r.status === 'completed' && !ok.has(r.conclusion));
    if (bad.length) return { state: 'failed', names: bad.map(r => r.name) };
    const open = rs.filter(r => r.status !== 'completed');
    if (open.length) return { state: 'running', open: open.length, total: rs.length };
    return { state: 'passed', total: rs.length };
  }

  // ── DOM ───────────────────────────────────────────────────────────────────

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k) n.append(k);
    return n;
  };
  const icon = (name, cls = '') => el('i', { class: 'ph ' + name + ' ' + cls });
  const spin = () => el('span', { class: 'loading loading-spinner loading-xs' });

  const copyText = async (text) => {
    if (window.io && typeof window.io.copy === 'function') return window.io.copy(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  // The section's rendered nodes: its heading and everything after it up to
  // the next heading of the same or higher rank, so a subsection travels with
  // its parent the way split() counts it.
  function sectionNodes(head) {
    const depth = +head.tagName[1] || 6;
    const out = [head];
    for (let n = head.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-6]$/.test(n.tagName) && n.hasAttribute('data-md-section') && +n.tagName[1] <= depth) break;
      out.push(n);
    }
    return out;
  }

  // A draft outlives a reload, keyed on the file and the section, and is only
  // restored onto the section text it was started from.
  const draftKey = (addr, sec) => 'mdEdit:' + addr.repo + '@' + addr.ref + ':' + addr.path + '#' + sec.slug;
  const drafts = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    drop(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  };

  // Per repo@ref: the repository's metadata and its hook legs, read once.
  const cache = new Map();
  function preflight(addr) {
    const key = addr.repo + '@' + addr.ref;
    if (!cache.has(key)) {
      const G = client(addr.repo, addr.ref);
      cache.set(key, Promise.all([
        G.req('').catch(() => null),
        G.get('docs/hook-legs.csv', { ref: addr.ref }).then(r => parseCsv(r.text)).catch(() => null),
      ]).then(([meta, legs]) => ({ meta, legs })));
    }
    return cache.get(key);
  }

  function open({ sec, head, edit, rerender }) {
    const loc = window.mdDoc && window.mdDoc.locate(head);
    if (!loc || !loc.box || !sec) return null;
    const box = loc.box, addr = loc.addr || {};
    if (box.__mdEditing) { box.__mdEditing.scrollIntoView({ block: 'start', behavior: 'smooth' }); return null; }
    const body = String((box.__srcDoc && box.__srcDoc.source) ?? '');
    const full = String((edit && edit.full) ?? body);
    const at = offsetOf(full, body);
    const fileLine = (at > 0 ? full.slice(0, at).split('\n').length - 1 : 0) + sec.startLine;

    // No header: the text box opens on the section's own heading line, which
    // says which section this is, and the sheet names where a save goes.
    const nodes = sectionNodes(head);
    const panel = el('div', {
      class: 'not-prose my-3 rounded-box border border-base-300 bg-base-100 p-3 text-base-content',
      'data-annotate-ui': '', 'data-md-edit': '',
    });
    const content = el('div', {}, spin());
    panel.append(content);
    nodes[0].before(panel);
    for (const n of nodes) { n.dataset.mdEditHidden = n.style.display || ''; n.style.display = 'none'; }
    box.__mdEditing = panel;

    const close = () => {
      for (const n of nodes) { n.style.display = n.dataset.mdEditHidden || ''; delete n.dataset.mdEditHidden; }
      panel.remove();
      if (box.__mdEditing === panel) box.__mdEditing = null;
    };
    const closeBtn = () => el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: 'Close', on: { click: close } });
    const say = (glyph, why, ...actions) => content.replaceChildren(
      el('div', { class: 'flex items-start gap-2 text-sm' }, icon(glyph, 'text-warning mt-0.5'), el('span', { text: why })),
      el('div', { class: 'mt-3 flex justify-end gap-2' }, closeBtn(), ...actions));
    const refuse = (why) => say('ph-prohibit', why);
    // md-doc focuses a hidden field inside the pencil's tap so iOS raises the
    // keyboard for the editor that mounts a moment later. Where no editor
    // follows, the field goes, and the keyboard with it.
    const letGo = () => document.querySelectorAll('[data-md-edit-hold]').forEach(n => n.remove());

    if (at < 0) { letGo(); refuse('This view is not the file as stored, so it cannot be saved back'); return panel; }
    if (!editableRef(addr.ref)) { letGo(); refuse('Pinned to a commit: open the branch to edit'); return panel; }

    const proceed = () => preflight(addr).then(({ meta, legs }) => {
      if (!panel.isConnected) return;
      if (meta && meta.permissions && meta.permissions.push === false) {
        letGo(); refuse('No write access to ' + addr.repo); return;
      }
      const gen = generated(full, addr.path, legs);
      if (gen) { letGo(); refuse('Generated file. ' + gen.why); return; }
      mount({ sec, addr, full, at, body, fileLine, legs, meta, panel, content, close, edit, rerender }, pickVariant());
    });

    // NO TOKEN ASKS FOR ONE rather than hiding the pencil, and carries on by
    // itself when gh-auth announces the token it saved.
    if (!token()) {
      const add = el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, icon('ph-key'), el('span', { text: 'Add token' }));
      add.addEventListener('click', () => window.ghAuth && window.ghAuth.prompt
        && window.ghAuth.prompt('Saving to ' + addr.repo + ' needs a GitHub token.'));
      letGo();
      say('ph-key', 'No GitHub token in this browser', add);
      const EV = 'web-tools:token-changed';
      const onToken = () => {
        if (!panel.isConnected) { window.removeEventListener(EV, onToken); return; }
        if (!token()) return;
        window.removeEventListener(EV, onToken);
        content.replaceChildren(spin());
        proceed();
      };
      window.addEventListener(EV, onToken);
      return panel;
    }
    proceed();
    return panel;
  }

  // ── Variants ──────────────────────────────────────────────────────────────
  // THE EDITOR IS A VARIANT; everything around it is this kit's. Two editors
  // are under comparison (docs/prototypes/md-edit-ideas.json): `tabs`,
  // Wikipedia's source editor (kits/md-edit-tabs.js), and `studio`, the source
  // and a live reading of the change side by side (kits/md-edit-studio.js).
  // Each mounts through `api` and hands back { text(), unmount() }. The save,
  // the checks, the drafts, the commit sheet and the receipt stay here, so the
  // two differ only in what writing is like. `basic`, a text box and two
  // buttons, is the floor when a variant fails to load.
  //
  // Which one: `?editor=` on the page's address, else the last one switched to
  // (localStorage `mdEdit:editor`), else tabs. While `?editor=` is present the
  // variant carries a switch to the other, and the text goes across with it.
  const VARIANTS = ['tabs', 'studio'];
  const query = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };
  const pickVariant = () => {
    const q = query('editor');
    if (VARIANTS.includes(q)) return q;
    try { const v = localStorage.getItem('mdEdit:editor'); if (VARIANTS.includes(v)) return v; } catch { /* private mode */ }
    return 'tabs';
  };
  // Literal paths, one per variant, so the build carries both.
  const needVariant = (name) => {
    const have = (window.mdEditVariants || {})[name];
    if (have) return Promise.resolve(have);
    const load = name === 'studio' ? ghRef.load('kits/md-edit-studio.js') : ghRef.load('kits/md-edit-tabs.js');
    return load.then(() => (window.mdEditVariants || {})[name] || null).catch(() => null);
  };
  const needMdDiff = () => window.mdDiff ? Promise.resolve() : ghRef.load('kits/md-diff.js');

  // Lines added and removed, as a multiset both ways: the count a status line
  // shows, which a moved line does not move and a blank line does not count in.
  function changedLines(before, next) {
    const added = addedLines(before, next).filter(a => a.line.trim()).length;
    const removed = addedLines(next, before).filter(a => a.line.trim()).length;
    return { added, removed, any: String(next ?? '').trim() !== String(before ?? '').trim() };
  }

  // The section rendered as the document would render it, sanitized the way the
  // viewer is. Escaped text where the sanitizer is missing, never raw markup.
  function preview(host, text) {
    const clean = window.DOMPurify;
    if (!window.mdDoc || !window.marked || !clean) {
      host.replaceChildren(el('pre', { class: 'whitespace-pre-wrap text-sm', text }));
      return host;
    }
    host.innerHTML = window.mdDoc.html(text, { sanitize: (h) => clean.sanitize(h) });
    return host;
  }

  // The change as tracked changes over the rendered prose: struck where words
  // left, tinted where they arrived. Drawn by preview() and marked with
  // kits/md-diff.js's word runs, rather than through md-diff's own renderer,
  // so Changes and Preview are one typography and switching between them does
  // not move the type (17 px against 14 px on a phone, found by the studio
  // variant). A mark over nothing but whitespace is the newline between two
  // blocks and draws as a sliver on a line of its own, so it goes.
  async function changesInto(host, before, next) {
    let marked = false;
    try {
      await needMdDiff();
      await window.mdDiff.needDiff();
      const was = preview(el('div'), before);
      preview(host, next);
      window.mdDiff.mark(host, window.mdDiff.runs(was.textContent, host.textContent));
      marked = true;
    } catch { /* no md-diff: the clean reading is the floor */ }
    if (!marked) preview(host, next);
    for (const n of host.querySelectorAll('ins, del')) {
      if (n.textContent.trim()) continue;
      if (n.tagName === 'DEL') n.remove(); else n.replaceWith(...n.childNodes);
    }
    return host;
  }

  // Markdown formatting on a text box's selection. insertText keeps the
  // browser's own undo; setRangeText is the fallback where it is refused.
  function format(ta, kind, o = {}) {
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, sel = v.slice(a, b);
    const put = (text, from, to, s0, s1) => {
      ta.focus();
      ta.setSelectionRange(from, to);
      const viaExec = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
      if (!viaExec) { ta.setRangeText(text, from, to, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
      ta.setSelectionRange(from + s0, from + s1);
    };
    const wrap = (l, r, ph) => { const t = sel || ph; put(l + t + r, a, b, l.length, l.length + t.length); };
    if (kind === 'bold') return wrap('**', '**', 'bold text');
    if (kind === 'italic') return wrap('_', '_', 'italic text');
    if (kind === 'code') return wrap('`', '`', 'code');
    if (kind === 'link') { const t = sel || 'link text'; return put('[' + t + '](url)', a, b, t.length + 3, t.length + 6); }
    const pre = { heading: '#'.repeat(Math.min(6, (o.depth || 2) + 1)) + ' ', list: '- ', numbered: '1. ', quote: '> ' }[kind];
    if (!pre) return;
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    const nl = v.indexOf('\n', Math.max(a, b - 1));
    const le = nl < 0 ? v.length : nl;
    const lines = v.slice(ls, le).split('\n');
    const on = lines.every(l => l.startsWith(pre));
    const out = lines.map(l => on ? l.slice(pre.length) : pre + l).join('\n');
    put(out, ls, le, 0, out.length);
  }

  // The switch between the two editors, shown only while comparing.
  function switcher(current, go) {
    const wrap = el('div', { class: 'join', 'data-md-edit-switch': '' });
    for (const [id, label] of [['tabs', 'Wikipedia'], ['studio', 'Studio']]) {
      const b = el('button', { type: 'button', class: 'btn btn-xs join-item' + (id === current ? ' btn-active' : ''),
                               'data-md-edit-switch-to': id, text: label });
      if (id !== current) b.addEventListener('click', () => go(id));
      wrap.append(b);
    }
    return wrap;
  }

  // The floor: a text box, Cancel and Publish.
  const BASIC = {
    mount(api) {
      const ta = el('textarea', { class: 'textarea textarea-bordered w-full font-mono text-base leading-6',
                                  rows: '10', 'data-md-edit-source': '', 'aria-label': 'Markdown of § ' + api.title });
      ta.value = api.initial;
      ta.addEventListener('input', () => api.saveDraft(ta.value));
      const cancel = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', 'data-md-edit-cancel': '', text: 'Cancel' });
      cancel.addEventListener('click', () => api.confirmCancel(cancel));
      const pub = el('button', { type: 'button', class: 'btn btn-sm btn-primary', 'data-md-edit-publish': '', text: 'Publish' });
      pub.addEventListener('click', () => api.publish());
      api.content.append(ta, el('div', { class: 'mt-2 flex justify-end gap-2' }, cancel, pub));
      ta.focus({ preventScroll: true });
      return { text: () => ta.value, unmount() {} };
    },
  };

  async function mount(s, name, carried) {
    const { sec, addr, panel, content, close } = s;
    const key = s.key || (s.key = draftKey(addr, sec));
    let initial = carried, restored = false;
    if (initial == null) {
      const saved = drafts.get(key);
      restored = !!(saved && saved.base === sec.raw && saved.raw !== sec.raw);
      initial = restored ? saved.raw : sec.raw;
    }
    const V = (await needVariant(name)) || BASIC;
    if (!panel.isConnected) return;
    let handle = null, t = null;
    const bodyAfter = (text) => place(s.body, 0, sec, text);
    const api = {
      name: V === BASIC ? 'basic' : name,
      sec, addr, title: sec.title, depth: sec.depth, fileLine: s.fileLine,
      original: sec.raw, initial, restored, panel, content,
      // A phone, by its pointer or its width: where an editor should take the
      // whole screen and keep its controls above the keyboard.
      narrow: () => { try { return matchMedia('(max-width: 639px), (pointer: coarse)').matches; } catch { return false; } },
      saveDraft(text) {
        clearTimeout(t);
        t = setTimeout(() => {
          if (text === sec.raw) drafts.drop(key);
          else drafts.put(key, { raw: text, base: sec.raw, at: Date.now() });
        }, 400);
      },
      check: (text) => checks(sec, text, { body: bodyAfter(text), line: s.fileLine }),
      // The network checks, settled: resolves to the rows they end on.
      checkAsync: (text) => Promise.all(asyncJobs(s, text, bodyAfter(text), api.check(text)).map(j => j.done)),
      changed: (text) => changedLines(sec.raw, text),
      preview: (host, text) => preview(host, text),
      changes: (host, text) => changesInto(host, sec.raw, text),
      format: (ta, kind) => format(ta, kind, { depth: sec.depth }),
      publish: () => publishSheet(s, handle, api),
      // Cancel, after a second tap when there is anything to lose. The draft
      // goes with a deliberate discard; it stays when the page simply closes.
      confirmCancel(button) {
        const text = handle ? handle.text() : sec.raw;
        if (text === sec.raw || button.dataset.armed) { api.cancel(); return; }
        const label = button.innerHTML;
        button.dataset.armed = '1';
        button.textContent = 'Discard changes';
        button.classList.add('text-error');
        setTimeout(() => { delete button.dataset.armed; button.innerHTML = label; button.classList.remove('text-error'); }, 3000);
      },
      cancel: () => { if (handle) handle.unmount(); drafts.drop(key); close(); },
      compareSwitch: () => query('editor') == null ? null : switcher(api.name, async (to) => {
        const text = handle.text();
        handle.unmount();
        content.replaceChildren(spin());
        try { localStorage.setItem('mdEdit:editor', to); } catch { /* private mode */ }
        await mount(s, to, text);
      }),
    };
    content.replaceChildren();
    handle = V.mount(api) || { text: () => sec.raw, unmount() {} };
    s.handle = handle;
  }

  // ── The commit sheet ──────────────────────────────────────────────────────
  // GitHub's commit dialog, since a save here is a commit: what changes, the
  // checks, the message and an optional description, and where it lands.

  const CHECK_ICON = {
    warn: ['ph-warning', 'text-warning'], ok: ['ph-check-circle', 'text-success'],
    info: ['ph-info', 'opacity-60'], bad: ['ph-x-circle', 'text-error'],
  };
  const checkRow = (c) => el('li', { class: 'flex items-start gap-2' },
    c.level === 'wait' ? spin() : icon((CHECK_ICON[c.level] || CHECK_ICON.info)[0], (CHECK_ICON[c.level] || CHECK_ICON.info)[1] + ' mt-0.5'),
    el('span', { text: c.text }));

  function publishSheet(s, handle, api) {
    const { sec, addr } = s;
    if (document.querySelector('dialog[data-md-edit-sheet]')) return;
    const next = handle.text();
    const newBody = place(s.body, 0, sec, next);
    const found = checks(sec, next, { body: newBody, line: s.fileLine });
    const same = found.some(c => c.id === 'same');
    const delta = changedLines(sec.raw, next);

    const dlg = el('dialog', { class: 'modal modal-bottom sm:modal-middle', 'data-annotate-ui': '', 'data-md-edit-sheet': '' });
    const boxEl = el('div', { class: 'modal-box w-full max-w-xl text-base-content' });
    const list = el('ul', { class: 'space-y-1 text-sm' });
    const msg = el('input', { type: 'text', class: 'input w-full text-base', 'data-md-edit-message': '',
                              'aria-label': 'Commit message' });
    msg.value = 'Edit ' + addr.path + ' § ' + (heading(next)?.title || sec.title);
    const desc = el('textarea', { class: 'textarea w-full text-base', rows: '2', placeholder: 'Description (optional)',
                                  'aria-label': 'Description' });
    let mode = 'direct';
    const radio = (id, label) => {
      const r = el('input', { type: 'radio', name: 'md-edit-where', class: 'radio radio-sm', value: id });
      if (id === mode) r.checked = true;
      r.addEventListener('change', () => { mode = id; });
      return el('label', { class: 'flex items-center gap-2 cursor-pointer' }, r, label);
    };
    const status = el('div', { class: 'text-sm' });
    const save = el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-md-edit-commit': '' },
      el('span', { text: 'Publish' }));
    if (same) save.disabled = true;
    const back = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-md-edit-back': '', text: 'Back' });
    const copy = el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-square', 'aria-label': 'Copy for review',
                                'data-title-tip': 'Copy for review' }, icon('ph-copy'));

    boxEl.append(
      el('div', { class: 'flex items-start gap-2' },
        el('div', { class: 'min-w-0 grow' },
          el('div', { class: 'font-semibold', text: 'Publish changes' }),
          el('div', { class: 'font-mono text-xs opacity-60 break-all', text: addr.repo + ' · ' + addr.ref + ' · ' + addr.path })),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-square', 'aria-label': 'Close',
                       on: { click: () => dlg.close() } }, icon('ph-x'))),
      el('div', { class: 'mt-3 flex items-baseline gap-2 text-sm' },
        el('span', { class: 'font-medium', text: '§ ' + sec.title }),
        el('span', { class: 'font-mono text-xs text-success', text: '+' + delta.added }),
        el('span', { class: 'font-mono text-xs text-error', text: '−' + delta.removed })),
      el('div', { class: 'mt-2' }, list),
      el('div', { class: 'mt-4 grid gap-2' }, msg, desc),
      el('div', { class: 'mt-3 grid gap-1.5 text-sm' },
        radio('direct', el('span', {}, 'Commit to ', el('code', { class: 'font-mono', text: addr.ref }))),
        radio('pr', el('span', { text: 'New branch and draft pull request' }))),
      el('div', { class: 'mt-3' }, status),
      el('div', { class: 'mt-3 flex items-center gap-2' }, copy, el('div', { class: 'grow' }), back, save));
    dlg.append(boxEl, el('form', { method: 'dialog', class: 'modal-backdrop' }, el('button', { text: 'close' })));
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    back.addEventListener('click', () => dlg.close());
    copy.addEventListener('click', async () => {
      const ok = await copyText(reviewText(sec, next, addr));
      copy.firstElementChild.className = 'ph ' + (ok ? 'ph-check text-success' : 'ph-warning text-warning');
    });

    const rows = [...found];
    if (!rows.length) rows.push({ id: 'shape', level: 'ok', text: 'Heading and level kept' });
    const paint = () => list.replaceChildren(...rows.map(checkRow));
    if (!same) for (const j of asyncJobs(s, next, newBody, found)) { rows.push(j.row); j.done.then(paint); }
    paint();
    dlg.showModal();

    save.addEventListener('click', async () => {
      save.disabled = true; back.disabled = true;
      status.replaceChildren(el('span', { class: 'flex items-center gap-2' }, spin(), el('span', { text: 'Publishing' })));
      const message = (msg.value.trim() || ('Edit ' + addr.path)) + (desc.value.trim() ? '\n\n' + desc.value.trim() : '');
      let out;
      try { out = await commit(s, next, message, mode); }
      catch (e) { out = { error: e }; }
      if (out.conflict) {
        status.replaceChildren(conflictView(s, next, out));
        back.disabled = false;
        return;
      }
      if (out.error) {
        const e = out.error;
        status.replaceChildren(el('span', { class: 'text-error', text:
          (e.status === 403 || e.status === 404 ? 'GitHub refused the write (' + e.status + ')' : 'Publish failed') + ': ' + (e.message || e) }));
        save.disabled = false; back.disabled = false;
        return;
      }
      if (out.unchanged) { status.replaceChildren(el('span', { text: 'The file already says this' })); back.disabled = false; return; }
      drafts.drop(s.key);
      dlg.close();
      handle.unmount();
      await landed(s, next, out);
    });
  }

  // Checks that need the network: link targets, and who links to a renamed
  // anchor from elsewhere in the repository. Each job starts as a waiting row
  // and settles that same row, so a sheet can paint it as it lands.
  function asyncJobs(s, next, newBody, found) {
    const { sec, addr } = s;
    const G = client(addr.repo, addr.ref);
    const jobs = [];
    const links = newLinks(sec.raw, next);
    if (links.length) {
      const row = { id: 'links', level: 'wait', text: 'Checking ' + links.length + (links.length === 1 ? ' new link' : ' new links') };
      jobs.push({ row, done: (async () => {
        const slugs = new Set((window.mdDoc.split(newBody) || []).map(x => x.slug));
        const head = (await G.req('commits?sha=' + encodeURIComponent(addr.ref) + '&per_page=1'))[0];
        const tree = await G.req('git/trees/' + head.commit.tree.sha + '?recursive=1');
        const paths = new Set((tree.tree || []).map(t => t.path));
        const missing = links.filter(h => {
          const tgt = window.mdDoc.repoPath(addr.path, h);
          if (!tgt) return false;
          if (tgt.path === addr.path && tgt.hash) return !slugs.has(tgt.hash.slice(1));
          return !paths.has(tgt.path);
        });
        return Object.assign(row, missing.length
          ? { level: 'warn', text: 'Nothing at ' + missing.join(', '), targets: missing }
          : { level: 'ok', text: tree.truncated ? 'New links: the tree was too large to check them all' : 'New links resolve' });
      })().catch(() => Object.assign(row, { level: 'info', text: 'Could not check the new links' })) });
    }
    const renamed = (found || []).find(r => r.id === 'anchor');
    if (renamed) {
      const row = { id: 'anchor-elsewhere', level: 'wait', text: 'Looking for links to #' + renamed.slug + ' in other files' };
      jobs.push({ row, done: (async () => {
        const base = addr.path.split('/').pop();
        const q = encodeURIComponent(renamed.slug + ' repo:' + addr.repo + ' extension:md');
        const hits = ((await G.req('/search/code?q=' + q + '&per_page=10')).items || [])
          .map(i => i.path).filter(p => p !== addr.path).slice(0, 8);
        const re = new RegExp(escRe(base) + '#' + escRe(renamed.slug) + '(?![\\w-])');
        const from = [];
        for (const p of hits) {
          const t = await G.get(p, { ref: addr.ref }).then(r => r.text).catch(() => '');
          if (re.test(t)) from.push(p);
        }
        return Object.assign(row, from.length
          ? { level: 'warn', text: 'Linked from ' + from.join(', ') }
          : { level: 'ok', text: 'No other file found linking to #' + renamed.slug });
      })().catch(() => Object.assign(row, { level: 'info', text: 'Could not search other files for #' + renamed.slug })) });
    }
    return jobs;
  }

  function conflictView(s, next, out) {
    const { addr } = s;
    const url = hub() ? hub().blob(addr.repo, addr.ref, addr.path) : '#';
    const copyMine = el('button', { type: 'button', class: 'btn btn-sm' }, icon('ph-copy'), el('span', { text: 'Copy my section' }));
    copyMine.addEventListener('click', async () => { await copyText(next); copyMine.firstElementChild.className = 'ph ph-check text-success'; });
    return el('div', { class: 'rounded-box border border-warning/40 bg-warning/10 p-2' },
      el('div', { class: 'flex items-start gap-2' }, icon('ph-git-diff', 'text-warning mt-0.5'),
        el('span', { text: out.conflict === 'busy'
          ? addr.ref + ' kept moving while saving; nothing was written'
          : 'This section changed on ' + addr.ref + ' since you opened it; nothing was written' })),
      el('div', { class: 'mt-2 flex flex-wrap gap-2' }, copyMine,
        el('a', { class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener' }, icon('ph-arrow-square-out'), el('span', { text: 'Current file' }))));
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  async function commit(s, next, message, mode) {
    const { sec, addr, full, at } = s;
    await needStore();
    const G = client(addr.repo, addr.ref);
    let target = G, branch = null;
    if (mode === 'pr') {
      await needTransfer();
      const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
      branch = 'edit/' + addr.path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + stamp;
      await G.createRef(branch, addr.ref);
      target = client(addr.repo, branch);
    }
    for (let round = 0; round < 3; round++) {
      // Read where the edit started, not on a branch made a moment ago: a new
      // branch is the same tree, and a read of it can be answered by a replica
      // that has not heard of it yet.
      const cur = await G.get(addr.path, { ...FRESH(), ref: addr.ref });
      let text, merged = false;
      if (cur.text === full) text = place(full, at, sec, next);
      else {
        const r = rebase(cur.text, sec, next);
        if (r.conflict) return { conflict: r.conflict, current: cur };
        text = r.text; merged = true;
      }
      if (text === cur.text) return { unchanged: true };
      try {
        const res = await target.save(addr.path, text, message, { sha: cur.sha, strict: true });
        let pr = null;
        if (branch) {
          pr = await target.createPull({ title: message, head: branch, base: addr.ref,
            body: (window.mdDoc.reference(sec, addr)[0] || '') + '\n\nEdited in Web Tools.' });
        } else {
          // Refresh the browser's cached copy of this URL, so the next plain
          // read of the file (another view, a re-open) is not a minute stale.
          G.get(addr.path, { ref: addr.ref, cache: 'reload' }).catch(() => {});
        }
        return { res, text, merged, branch, pr };
      } catch (e) {
        if (e.status === 409 || e.status === 422) continue;
        throw e;
      }
    }
    return { conflict: 'busy' };
  }

  // ── After the save ────────────────────────────────────────────────────────

  async function landed(s, next, out) {
    const { sec, addr, at, edit, rerender, close } = s;
    close();
    if (edit && !out.branch) edit.full = out.text;
    const FM = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
    const newBody = at > 0 ? out.text.replace(FM, '') : out.text;
    let shown = false;
    if (edit && typeof edit.onSaved === 'function' && !out.branch) {
      try { shown = !!(await edit.onSaved(out.text, { sha: out.res.content.sha, commit: out.res.commit })); }
      catch { shown = false; }
    }
    if (!shown && !out.branch && typeof rerender === 'function') rerender(newBody);
    const slug = slugify(heading(next)?.title || sec.title);
    setTimeout(() => {
      const h = document.getElementById(slug);
      if (h) h.scrollIntoView({ block: 'start' });
    }, 120);
    receipt(s, out);
  }

  function receipt(s, out) {
    const { sec, addr, legs, meta } = s;
    const sha = out.res.commit.sha, sha7 = sha.slice(0, 7);
    const ref = out.branch || addr.ref;
    const isDefault = !out.branch && (meta ? meta.default_branch === addr.ref : /^(main|master)$/.test(addr.ref));
    const touched = legsFor(addr.path, legs);
    const stages = stagesOf(touched).filter(p => p !== addr.path);
    const repairs = isDefault && touched.some(l => l.in_repair === 'yes');

    // Bottom LEFT on a wide screen and lifted on a phone, because the corner the
    // card would otherwise take is the FAB's.
    const card = el('div', {
      class: 'not-prose fixed z-[85] bottom-24 left-3 right-3 sm:bottom-3 sm:right-auto sm:w-96 rounded-box border border-base-300 '
           + 'bg-base-100 p-3 text-sm shadow-xl text-base-content',
      'data-annotate-ui': '', 'data-md-edit-receipt': '', role: 'status',
    });
    const rowsEl = el('ul', { class: 'mt-2 space-y-1' });
    let stopped = false;
    const x = el('button', { type: 'button', class: 'btn btn-ghost btn-xs btn-square', 'aria-label': 'Close' }, icon('ph-x'));
    x.addEventListener('click', () => { stopped = true; card.remove(); });
    card.append(el('div', { class: 'flex items-center gap-2' },
      icon('ph-check-circle', 'text-success'), el('span', { class: 'font-semibold grow', text: 'Saved § ' + sec.title }), x),
      rowsEl);
    document.body.append(card);

    const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener', class: 'link', text });
    const row = (lvl, ...kids) => el('li', { class: 'flex items-start gap-2' },
      lvl === 'wait' ? spin() : icon((CHECK_ICON[lvl] || CHECK_ICON.info)[0], (CHECK_ICON[lvl] || CHECK_ICON.info)[1] + ' mt-0.5'),
      el('span', {}, ...kids));
    const state = { checks: null, repair: null, repairChecks: null };
    const checksRow = (sum, at, of = 'Checks') => {
      const href = hub() ? hub().commit(addr.repo, at) : '#';
      if (!sum || sum.state === 'pending') return row('wait', 'Waiting for ' + of.toLowerCase());
      if (sum.state === 'none') return row('info', of + ': none reported');
      if (sum.state === 'running') return row('wait', link(href, of + ' running (' + sum.open + ' of ' + sum.total + ')'));
      if (sum.state === 'failed') return row('bad', link(href, of + ' failed: ' + sum.names.join(', ')));
      return row('ok', link(href, of + ' passed (' + sum.total + ')'));
    };
    const paint = () => {
      const kids = [row('ok', link(out.res.commit.html_url, 'Committed ' + sha7), ' to ' + ref + (out.merged ? ', merged with a newer version' : ''))];
      if (out.pr && out.pr.html_url) kids.push(row('ok', link(out.pr.html_url, 'Draft PR #' + out.pr.number)));
      kids.push(checksRow(state.checks, sha));
      if (stages.length) {
        // The legs say what the repair MAY touch; the repair commit itself is
        // the record of what it did, so the row links it rather than repeating
        // the list as though it were a result.
        if (repairs) {
          kids.push(state.repair
            ? row('ok', link(state.repair.html_url, 'Repair ' + state.repair.sha.slice(0, 7)), ' on ' + addr.ref)
            : row('wait', 'Repair on ' + addr.ref + ' may refresh ' + stages.join(', ')));
          if (state.repair) kids.push(checksRow(state.repairChecks, state.repair.sha, 'Repair checks'));
        } else {
          kids.push(row('warn', 'Stale until regenerated on ' + ref + ': ' + stages.join(', ')));
        }
      }
      rowsEl.replaceChildren(...kids);
    };
    paint();

    const G = client(addr.repo, ref);
    const runs = (at) => G.req('commits/' + at + '/check-runs?per_page=50', FRESH())
      .then(r => summarize(r && r.check_runs)).catch(() => null);
    const t0 = Date.now();
    const tick = async () => {
      if (stopped || !card.isConnected) return;
      const age = Date.now() - t0;
      const sum = await runs(sha);
      // A commit with no runs yet is usually a commit whose runs have not
      // started; "none" only after a minute of silence.
      state.checks = sum && sum.state === 'none' && age < 60_000 ? { state: 'pending' } : sum;
      if (repairs && !state.repair) {
        const recent = await G.req('commits?sha=' + encodeURIComponent(addr.ref) + '&per_page=8', FRESH()).catch(() => []);
        const hit = (recent || []).find(c => (c.commit?.message || '').startsWith('Refresh derived files after ' + sha7));
        if (hit) state.repair = { sha: hit.sha, html_url: hit.html_url };
      }
      if (state.repair) state.repairChecks = await runs(state.repair.sha);
      paint();
      const settled = (x) => x && (x.state === 'passed' || x.state === 'failed' || x.state === 'none');
      const done = settled(state.checks) && (!repairs || (state.repair && settled(state.repairChecks)));
      if (!done && age < 300_000) setTimeout(tick, age < 60_000 ? 8_000 : 15_000);
    };
    setTimeout(tick, 4_000);
  }

  window.mdEdit = {
    open,
    // pure, for the tests
    offsetOf, splice, place, rebase, heading, checks, addedLines, newLinks,
    parseCsv, matches, generated, legsFor, stagesOf, reviewText, summarize, editableRef,
    REVIEW, changedLines, format, pickVariant,
    _commit: commit,
  };
})();
