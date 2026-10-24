// kits/md-edit.js — edit one section of a markdown file where it is rendered,
// and save it back to the repository it came from.
//
// kits/md-doc.js puts a menu on every heading and already knows each section's
// SOURCE: where it starts and ends in the file, and which file at which
// address. This kit is that menu's Edit row, Wikipedia's [edit] link with its
// own verb at last. The section turns into its markdown in place, the rest of
// the document stays rendered, and Done opens a sheet with the change as a
// diff, the checks, and the commit message.
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
  const needDiff = () => window.textDiff ? Promise.resolve() : ghRef.load('kits/text-diff.js');
  const needTransfer = () => (window.GH && window.GH.prototype.createPull) ? Promise.resolve()
    : ghRef.load('gh-transfer.js');

  const FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };
  // A commit, full or abbreviated: links pin one as a short sha (showing.py
  // mints `@<12 hex>`), and a write cannot land on a commit. A branch named in
  // nothing but hex would read as one too, which costs it the Edit row only.
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
      out.push({ id: 'heading', level: 'warn', text: 'No heading on the first line: this text joins the section above' });
    } else if (was && now) {
      if (now.depth !== was.depth) {
        out.push({ id: 'level', level: 'warn',
                   text: 'Heading level ' + '#'.repeat(was.depth) + ' becomes ' + '#'.repeat(now.depth) });
      }
      const from = slugify(was.title), to = slugify(now.title);
      if (from !== to) {
        out.push({ id: 'anchor', level: 'warn', slug: from,
                   text: 'Anchor #' + from + ' becomes #' + to });
        const n = o.body ? countAnchor(o.body, from) : 0;
        if (n) out.push({ id: 'anchor-here', level: 'warn',
                          text: n + (n === 1 ? ' link' : ' links') + ' in this file point at #' + from });
      }
    }
    const base = o.line || 1;
    const dashed = addedLines(before, next)
      .filter(a => !a.code && (/—/.test(a.line) || /\S\s--\s\S/.test(a.line)))
      .map(a => base + a.i);
    if (dashed.length) {
      out.push({ id: 'dash', level: 'warn',
                 text: 'Em dash on ' + (dashed.length === 1 ? 'line ' : 'lines ') + dashed.join(', ') });
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

    const nodes = sectionNodes(head);
    const panel = el('div', {
      class: 'not-prose my-3 rounded-box border border-base-300 bg-base-100 p-3 text-base-content',
      'data-annotate-ui': '', 'data-md-edit': '',
    });
    const where = el('div', { class: 'flex flex-wrap items-baseline gap-x-2 text-xs opacity-60 font-mono' },
      el('span', { text: addr.path }), el('span', { text: '@ ' + addr.ref }),
      el('span', { text: 'lines ' + (fileLine) + '-' + (fileLine + sec.endLine - sec.startLine) }));
    const title = el('div', { class: 'flex items-center gap-2 font-semibold' },
      icon('ph-pencil-simple', 'opacity-60'), el('span', { text: '§ ' + sec.title }));
    const content = el('div', { class: 'mt-3' }, spin());
    panel.append(title, where, content);
    nodes[0].before(panel);
    for (const n of nodes) { n.dataset.mdEditHidden = n.style.display || ''; n.style.display = 'none'; }
    box.__mdEditing = panel;

    const close = () => {
      for (const n of nodes) { n.style.display = n.dataset.mdEditHidden || ''; delete n.dataset.mdEditHidden; }
      panel.remove();
      if (box.__mdEditing === panel) box.__mdEditing = null;
    };
    const refuse = (why) => {
      content.replaceChildren(
        el('div', { class: 'flex items-start gap-2 text-sm' }, icon('ph-prohibit', 'text-warning mt-0.5'),
          el('span', { text: why })),
        el('div', { class: 'mt-3 flex justify-end' },
          el('button', { type: 'button', class: 'btn btn-sm', text: 'Close', on: { click: close } })));
    };

    if (at < 0) { refuse('This view is not the file as stored, so it cannot be saved back'); return panel; }
    if (!editableRef(addr.ref)) { refuse('Pinned to a commit: open the branch to edit'); return panel; }

    preflight(addr).then(({ meta, legs }) => {
      if (!panel.isConnected) return;
      if (meta && meta.permissions && meta.permissions.push === false) {
        refuse('No write access to ' + addr.repo); return;
      }
      const gen = generated(full, addr.path, legs);
      if (gen) { refuse('Generated file. ' + gen.why); return; }
      editor({ sec, addr, full, at, body, fileLine, legs, meta, panel, content, close, edit, rerender });
    });
    return panel;
  }

  function editor(s) {
    const { sec, addr, panel, content, close } = s;
    const key = draftKey(addr, sec);
    const saved = drafts.get(key);
    const restored = saved && saved.base === sec.raw && saved.raw !== sec.raw;
    const ta = el('textarea', {
      class: 'textarea textarea-bordered w-full font-mono text-base leading-6',
      spellcheck: 'true', autocapitalize: 'sentences', rows: '8',
      'aria-label': 'Markdown of § ' + sec.title,
    });
    ta.value = restored ? saved.raw : sec.raw;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 4) + 'px'; };
    let t = null;
    ta.addEventListener('input', () => {
      grow();
      clearTimeout(t);
      t = setTimeout(() => {
        if (ta.value === sec.raw) drafts.drop(key);
        else drafts.put(key, { raw: ta.value, base: sec.raw, at: Date.now() });
      }, 400);
    });

    let armed = null;
    const cancel = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: 'Cancel' });
    cancel.addEventListener('click', () => {
      if (ta.value === sec.raw || armed) { drafts.drop(key); close(); return; }
      armed = setTimeout(() => { armed = null; cancel.textContent = 'Cancel'; cancel.classList.remove('text-error'); }, 3000);
      cancel.textContent = 'Discard changes';
      cancel.classList.add('text-error');
    });
    const review = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      icon('ph-eye'), el('span', { text: 'Review' }));
    review.addEventListener('click', () => sheet({ ...s, next: () => ta.value, key, ta }));
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ta.value === sec.raw) { e.preventDefault(); close(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); review.click(); }
    });

    // Filtered, since replaceChildren writes a null argument as the text "null".
    content.replaceChildren(...[
      restored && el('div', { class: 'mb-2 text-xs opacity-60', text: 'Draft restored' }),
      ta,
      el('div', { class: 'mt-2 flex items-center justify-end gap-2' }, cancel, review),
    ].filter(Boolean));
    grow();
    ta.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'nearest' });
  }

  // ── The review sheet ──────────────────────────────────────────────────────

  function diffBlock(before, next) {
    const a = before.split('\n'), b = next.split('\n');
    const rows = window.textDiff.rows(window.textDiff.lines(a, b), a, b);
    const out = el('div', { class: 'font-mono text-sm leading-6 overflow-auto max-h-[40vh] rounded-box border border-base-300' });
    const line = (r) => el('div', {
      class: 'px-2 whitespace-pre-wrap break-words ' + (r.t === 'add' ? 'bg-success/15' : r.t === 'del' ? 'bg-error/15' : ''),
    }, el('span', { class: 'select-none opacity-50 mr-2', text: r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' ' }),
       el('span', { text: r.line || ' ' }));
    // Long unchanged runs fold to a count, keeping two lines either side.
    for (let i = 0; i < rows.length;) {
      let j = i;
      while (j < rows.length && rows[j].t === 'ctx') j++;
      const run = j - i;
      if (run > 6) {
        const keepHead = i === 0 ? 0 : 2, keepTail = j === rows.length ? 0 : 2;
        rows.slice(i, i + keepHead).forEach(r => out.append(line(r)));
        out.append(el('div', { class: 'px-2 text-xs opacity-50 py-1', text: (run - keepHead - keepTail) + ' unchanged lines' }));
        rows.slice(j - keepTail, j).forEach(r => out.append(line(r)));
      } else rows.slice(i, j).forEach(r => out.append(line(r)));
      for (; j < rows.length && rows[j].t !== 'ctx'; j++) out.append(line(rows[j]));
      i = j;
    }
    return out;
  }

  const CHECK_ICON = {
    warn: ['ph-warning', 'text-warning'], ok: ['ph-check-circle', 'text-success'],
    info: ['ph-info', 'opacity-60'], bad: ['ph-x-circle', 'text-error'],
  };
  const checkRow = (c) => el('li', { class: 'flex items-start gap-2' },
    c.level === 'wait' ? spin() : icon((CHECK_ICON[c.level] || CHECK_ICON.info)[0], (CHECK_ICON[c.level] || CHECK_ICON.info)[1] + ' mt-0.5'),
    el('span', { text: c.text }));

  async function sheet(s) {
    const { sec, addr, full, at, body, ta } = s;
    await needDiff().catch(() => {});
    const next = s.next();
    const newBody = at >= 0 ? place(body, 0, sec, next) : body;
    const found = checks(sec, next, { body: newBody, line: s.fileLine });
    const same = found.some(c => c.id === 'same');

    if (document.querySelector('dialog[data-md-edit-sheet]')) return;
    const dlg = el('dialog', { class: 'modal modal-bottom sm:modal-middle', 'data-annotate-ui': '', 'data-md-edit-sheet': '' });
    const boxEl = el('div', { class: 'modal-box w-full max-w-6xl text-base-content' });
    const list = el('ul', { class: 'space-y-1 text-sm' });
    const msg = el('input', { type: 'text', class: 'input input-bordered w-full text-base',
                              'aria-label': 'Commit message' });
    msg.value = 'Edit ' + addr.path + ' § ' + (heading(next)?.title || sec.title);
    let mode = 'direct';
    const modeBtn = (id, label) => {
      const b = el('button', { type: 'button', class: 'btn btn-sm join-item', text: label });
      b.addEventListener('click', () => { mode = id; paintMode(); });
      return { id, b };
    };
    const modes = [modeBtn('direct', 'Commit to ' + addr.ref), modeBtn('pr', 'New branch, draft PR')];
    const paintMode = () => modes.forEach(m => m.b.classList.toggle('btn-active', m.id === mode));
    paintMode();
    const status = el('div', { class: 'text-sm min-h-6' });
    const save = el('button', { type: 'button', class: 'btn btn-primary btn-sm' },
      icon('ph-floppy-disk'), el('span', { text: 'Save' }));
    if (same) save.disabled = true;
    const back = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Back' });
    const copy = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' },
      icon('ph-copy'), el('span', { text: 'Copy for review' }));

    boxEl.append(
      el('div', { class: 'flex items-start gap-2' },
        el('div', { class: 'min-w-0 grow' },
          el('div', { class: 'font-semibold', text: 'Save § ' + sec.title }),
          el('div', { class: 'font-mono text-xs opacity-60 break-all', text: addr.repo + ' · ' + addr.ref + ' · ' + addr.path })),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-square', 'aria-label': 'Close',
                       on: { click: () => dlg.close() } }, icon('ph-x'))),
      el('div', { class: 'mt-3' }, window.textDiff ? diffBlock(sec.raw, next.replace(/\s+$/, ''))
        : el('pre', { class: 'text-sm whitespace-pre-wrap', text: next })),
      el('div', { class: 'mt-3' }, list),
      el('label', { class: 'mt-3 block text-xs opacity-60', text: 'Commit message' }), msg,
      el('div', { class: 'mt-3 join' }, modes.map(m => m.b)),
      el('div', { class: 'mt-3' }, status),
      el('div', { class: 'mt-2 flex flex-wrap items-center gap-2' }, copy, el('div', { class: 'grow' }), back, save));
    dlg.append(boxEl, el('form', { method: 'dialog', class: 'modal-backdrop' }, el('button', { text: 'close' })));
    document.body.append(dlg);
    dlg.addEventListener('close', () => { dlg.remove(); ta.focus({ preventScroll: true }); });
    back.addEventListener('click', () => dlg.close());
    copy.addEventListener('click', async () => {
      const ok = await copyText(reviewText(sec, next, addr));
      copy.firstElementChild.className = 'ph ' + (ok ? 'ph-check text-success' : 'ph-warning text-warning');
    });

    const rows = [...found];
    const paint = () => list.replaceChildren(...rows.map(checkRow));
    if (!rows.length) rows.push({ id: 'shape', level: 'ok', text: 'Heading and level kept' });
    paint();
    dlg.showModal();

    if (!same) asyncChecks(s, next, newBody, rows, paint);

    save.addEventListener('click', async () => {
      save.disabled = true; back.disabled = true;
      status.replaceChildren(el('span', { class: 'flex items-center gap-2' }, spin(), el('span', { text: 'Saving' })));
      let out;
      try { out = await commit(s, next, msg.value.trim() || ('Edit ' + addr.path), mode); }
      catch (e) { out = { error: e }; }
      if (out.conflict) {
        status.replaceChildren(conflictView(s, next, out));
        back.disabled = false;
        return;
      }
      if (out.error) {
        const e = out.error;
        status.replaceChildren(el('span', { class: 'text-error', text:
          (e.status === 403 || e.status === 404 ? 'GitHub refused the write (' + e.status + ')' : 'Save failed') + ': ' + (e.message || e) }));
        save.disabled = false; back.disabled = false;
        return;
      }
      if (out.unchanged) { status.replaceChildren(el('span', { text: 'The file already says this' })); back.disabled = false; return; }
      drafts.drop(s.key);
      dlg.close();
      await landed(s, next, out);
    });
  }

  // Checks that need the network: link targets, and who links to a renamed
  // anchor from elsewhere in the repository.
  async function asyncChecks(s, next, newBody, rows, paint) {
    const { sec, addr } = s;
    const G = client(addr.repo, addr.ref);
    const links = newLinks(sec.raw, next);
    const jobs = [];
    if (links.length) {
      const row = { level: 'wait', text: 'Checking ' + links.length + (links.length === 1 ? ' new link' : ' new links') };
      rows.push(row); paint();
      jobs.push((async () => {
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
        Object.assign(row, missing.length
          ? { level: 'warn', text: 'Nothing at ' + missing.join(', ') }
          : { level: 'ok', text: tree.truncated ? 'New links: the tree was too large to check them all' : 'New links resolve' });
      })().catch(() => Object.assign(row, { level: 'info', text: 'Could not check the new links' })));
    }
    const renamed = rows.find(r => r.id === 'anchor');
    if (renamed) {
      const row = { level: 'wait', text: 'Looking for links to #' + renamed.slug + ' in other files' };
      rows.push(row); paint();
      jobs.push((async () => {
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
        Object.assign(row, from.length
          ? { level: 'warn', text: 'Linked from ' + from.join(', ') }
          : { level: 'ok', text: 'No other file found linking to #' + renamed.slug });
      })().catch(() => Object.assign(row, { level: 'info', text: 'Could not search other files for #' + renamed.slug })));
    }
    for (const j of jobs) { await j; paint(); }
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
    REVIEW,
    _commit: commit,
  };
})();
