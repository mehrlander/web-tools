// kits/md-surface.js — a markdown buffer shown RENDERED, and still aimed at by
// character offset, so a text surface can edit its source while the reader looks
// at the document.
//
// Dictate.paint (kits/dictate.js) draws a plain-text buffer and answers the three
// questions every gesture on pages/dictate.html asks: draw the buffer with its
// caret and selection, turn a client point into an offset, and say whether a
// point is over text at all. This answers the same three over RENDERED markdown,
// so a surface that routes those three calls here keeps every gesture it has.
//
//   MdSurface.paint(host, { text, interim, range, armed, handles, overlay, reach })
//   MdSurface.offsetAt(host, x, y)   -> offset into text, or null off the text
//   MdSurface.hitsText(host, x, y)   -> is the point on rendered text
//   MdSurface.tidy / backspace / enter  the rules for typing into the render
//   MdSurface.changes(base, text)    what the marks draw: inserted runs, removals
//
// With `marks` and a `base`, paint also marks what changed since the base: a
// green wash on inserted words, a red wedge where words were removed (it takes
// taps, and carries data-md-del, the removal's index), and a bar in the margin
// beside each changed block, green when the block is new and amber otherwise.
//
// THE MAP IS Standoff.mapText (kits/standoff.js), which pages/audit-render.html
// settled: rendered text is a subsequence of the source, so each text node is
// found by a forward search and stamped with its offset. Markup is in no text
// node, so no tap lands inside `**` or `](url)`. What cannot be found is left
// unstamped and a tap there resolves to the nearest stamped text before it.
//
// THE DOCUMENT IS RENDERED ONLY WHEN THE TEXT CHANGES. Everything that moves
// with a tap or a scroll (the caret, the selection, the pins, the words being
// spoken) is drawn in the overlay from client rects, so a scroll repaints a few
// absolutely positioned boxes and parses nothing. The hypothesis is a chip at
// the caret rather than words in the flow: splicing it into the rendered tree
// would re-render on every partial result.
//
// WHAT A CHANGE COSTS, measured 2026-09-24 in headless Chromium on a desktop
// CPU: 12ms on docs/SURFACING.md (6k characters), about 80ms on docs/loader.md
// (37k) and 210ms on docs/SNAGS.md (160k), mostly layout of the whole document.
// A phone is slower by a factor not measured. The next step, if it is needed,
// is re-rendering only the blocks that changed; content-visibility:auto was
// tried and measured the caret a line off (see pages/dictate.html ensureMd).
//
// Reads window.mdDoc (the render), window.Standoff (the map), window.Dictate
// (the pins) and window.marked, all loaded by the caller.

(() => {
  const PART = 'data-md-surface';

  const render = (host, text) => {
    host.innerHTML = window.mdDoc.html(text, { proseClass: '' });
    // A fence's language tag is text the source does not hold in that place.
    // Mapped, its search would run ahead to a later match and every node after
    // it would go unstamped, so it is set aside for the mapping and put back.
    const tags = [...host.querySelectorAll('.md-fence-lang')].map((t) => [t, t.parentNode]);
    for (const [t] of tags) t.remove();
    window.Standoff.mapText(host, text, 0);
    for (const [t, p] of tags) p.appendChild(t);
    host.__mdText = text;
    host.__index = null;
  };

  const spans = (host) => host.querySelectorAll('[data-src]');

  // The text node and inner offset holding a source offset. A caret between two
  // stamped runs (at a bold's closing `**`, say) belongs to the run it ends, so
  // the words land inside what the reader was looking at.
  // The stamped runs in source order, built once per render, so finding the
  // run for an offset is a binary search: the change marks ask it hundreds of
  // times a paint on a heavily edited file.
  const index = (host) => {
    if (host.__index) return host.__index;
    const out = [];
    for (const sp of spans(host)) {
      const n = sp.firstChild;
      if (n && n.nodeType === 3) out.push({ s: +sp.dataset.src, n });
    }
    return (host.__index = out);
  };
  const pointAt = (host, at) => {
    const ix = index(host);
    let lo = 0, hi = ix.length - 1, best = -1;
    while (lo <= hi) {                       // the last run starting at or before `at`
      const mid = (lo + hi) >> 1;
      if (ix[mid].s <= at) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) return null;
    const { s: s0, n } = ix[best];
    return at <= s0 + n.length ? { node: n, offset: at - s0 } : { node: n, offset: n.length };
  };

  const rangeRects = (host, a, b) => {
    const p = pointAt(host, a), q = a === b ? p : pointAt(host, b);
    if (!p || !q) return [];
    const r = host.ownerDocument.createRange();
    r.setStart(p.node, p.offset);
    r.setEnd(q.node, q.offset);
    return [...r.getClientRects()].filter((x) => x.width || a === b);
  };

  const caretRect = (host, at) => {
    const p = pointAt(host, at);
    if (!p) return null;
    const r = host.ownerDocument.createRange();
    r.setStart(p.node, p.offset);
    r.collapse(true);
    const rs = r.getClientRects();
    if (rs.length) return rs[rs.length - 1];
    // A collapsed range at a node's very start reports nothing in some engines;
    // the character after it has a box whose left edge is the same place.
    if (p.offset < p.node.length) {
      r.setEnd(p.node, p.offset + 1);
      const b = r.getBoundingClientRect();
      return { left: b.left, right: b.left, top: b.top, bottom: b.bottom, height: b.height };
    }
    return null;
  };

  // ── What changed since the base ─────────────────────────────────────────
  // A word diff of the buffer against `base` (what GitHub holds), as offsets
  // into the buffer: inserted runs, and the points where something was removed
  // with the text that was. Needs window.Diff (jsdiff, loaded by
  // mdDiff.needDiff); without it there is nothing to mark.
  // TWO LEVELS, lines and then words inside each changed pair of line runs,
  // which is the usual shape and the difference between milliseconds and a
  // second on a file with hundreds of changes. A change that is whitespace and
  // nothing else is dropped: a line break become a space renders the same, so
  // an Unwrap marks nothing, which is the truth about it.
  const changes = (base, text) => {
    const ins = [], del = [];
    if (!window.Diff || base == null || base === text) return { ins, del };
    const blank = (v) => !v.trim();
    const words = (oldV, newV, at) => {
      let pos = at;
      for (const part of window.Diff.diffWordsWithSpace(oldV, newV)) step(part, () => pos, (d) => { pos += d; });
    };
    const step = (part, getPos, move) => {
      const pos = getPos();
      if (part.added) {
        const last = del[del.length - 1];
        if (!blank(part.value)) {
          if (last && last.at === pos && !last.with) last.with = [pos, pos + part.value.length];
          ins.push([pos, pos + part.value.length]);
        }
        move(part.value.length);
      } else if (part.removed) {
        if (!blank(part.value)) del.push({ at: pos, text: part.value });
      } else move(part.value.length);
    };
    const lines = window.Diff.diffLines(base, text);
    let pos = 0;
    for (let i = 0; i < lines.length; i++) {
      const part = lines[i], next = lines[i + 1];
      if (part.removed && next && next.added) {
        words(part.value, next.value, pos);
        pos += next.value.length;
        i++;
        continue;
      }
      step(part, () => pos, (d) => { pos += d; });
    }
    return { ins, del };
  };
  const changesFor = (host, base, text) => {
    if (host.__chgText !== text || host.__chgBase !== base) {
      host.__chg = changes(base, text);
      host.__chgText = text; host.__chgBase = base;
    }
    return host.__chg;
  };

  // The block an offset sits in: the nearest paragraph, item, heading, cell,
  // quote or code block, which is the unit a change bar marks.
  const BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, td, th, dt, dd';
  const blockAt = (host, at) => {
    const p = pointAt(host, at);
    const el = p && p.node.parentElement && p.node.parentElement.closest(BLOCK);
    return el && host.contains(el) ? el : null;
  };

  // The three marks, drawn into the overlay under the caret and the selection.
  // Colours are the theme's, at the weights kits/md-diff.js uses for the same
  // meaning, so the Changes view and these read as one vocabulary.
  const INS = 'color-mix(in oklab, var(--color-success, #16a34a) 22%, transparent)';
  const DEL = 'var(--color-error, #dc2626)';
  const NEW = 'var(--color-success, #16a34a)';
  const MOD = 'var(--color-warning, #d97706)';
  const paintMarks = (host, chg, mk, at, visible, lb, box) => {
    // Only the changes on screen are measured: the source window between the
    // top and bottom of the scroll box, with a margin for a block that starts
    // above the fold.
    const top = offsetAt(host, box.left + 24, box.top + 4);
    const bot = offsetAt(host, box.right - 24, box.bottom - 4);
    const vs = (top ?? 0) - 400, ve = (bot ?? host.__mdText.length) + 400;
    chg = { ins: chg.ins.filter(([a, b]) => b >= vs && a <= ve), del: chg.del.filter((d) => d.at >= vs && d.at <= ve) };
    for (const [a, b] of chg.ins) {
      if (!host.__mdText.slice(a, b).trim()) continue;
      for (const x of rangeRects(host, a, b)) {
        if (!visible(x)) continue;
        mk('ins', at(x) + 'width:' + Math.round(x.width) + 'px;height:' + Math.round(x.height) + 'px;'
          + 'background:' + INS + ';border-radius:2px;');
      }
    }
    // A block is NEW when nothing in it predates the edit, CHANGED otherwise.
    const blocks = new Map();
    const note = (el, fresh) => { if (el) blocks.set(el, (blocks.get(el) ?? true) && fresh); };
    for (const [a, b] of chg.ins) {
      const el = blockAt(host, a);
      if (!el) continue;
      const own = [...el.querySelectorAll('[data-src]')];
      const fresh = own.every((sp) => { const s0 = +sp.dataset.src, s1 = s0 + sp.firstChild.length;
        return !sp.textContent.trim() || chg.ins.some(([x, y]) => x <= s0 && s1 <= y); });
      note(el, fresh);
      const tail = blockAt(host, Math.max(a, b - 1));
      if (tail && tail !== el) note(tail, false);
    }
    const all = host.__chg ? host.__chg.del : chg.del;
    chg.del.forEach((d) => {
      const i = all.indexOf(d);
      note(blockAt(host, d.at), false);
      const c = caretRect(host, d.at);
      if (!c || !visible(c)) return;
      // The wedge takes taps, which is how the removed words are seen again.
      const w = mk('del', 'left:' + Math.round(c.left - lb.left - 7) + 'px;top:' + Math.round(c.top - lb.top - 3) + 'px;'
        + 'width:14px;height:' + Math.round(c.height + 6) + 'px;pointer-events:auto;cursor:pointer;z-index:2;');
      w.setAttribute('data-md-del', i);
      w.setAttribute('title', 'Removed: ' + d.text.trim().slice(0, 80));
      w.innerHTML = '<div style="position:absolute;left:6px;top:3px;width:2px;bottom:3px;background:' + DEL + ';border-radius:1px"></div>'
        + '<div style="position:absolute;left:3px;top:0;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ' + DEL + '"></div>';
    });
    for (const [el, fresh] of blocks) {
      const x = el.getBoundingClientRect();
      if (!visible(x)) continue;
      mk('bar', 'left:' + Math.round(box.left - lb.left + 4) + 'px;top:' + Math.round(x.top - lb.top) + 'px;'
        + 'width:3px;height:' + Math.round(x.height) + 'px;border-radius:2px;background:' + (fresh ? NEW : MOD) + ';');
    }
  };

  const paint = (host, o = {}) => {
    const doc = host.ownerDocument;
    const text = o.text || '';
    if (host.__mdText !== text) render(host, text);
    const r = o.range;
    host.__range = r || null;

    const layer = o.overlay || host.parentNode;
    if (!layer.style.position) layer.style.position = 'relative';
    for (const gone of [...layer.querySelectorAll('[' + PART + ']')]) gone.remove();
    const lb = layer.getBoundingClientRect();
    const box = host.parentNode.getBoundingClientRect();
    const visible = (x) => x.bottom > box.top && x.top < box.bottom;
    const mk = (kind, css) => {
      const n = doc.createElement('div');
      n.setAttribute(PART, kind);
      n.setAttribute('style', 'position:absolute;pointer-events:none;' + css);
      layer.appendChild(n);
      return n;
    };
    const at = (x) => 'left:' + Math.round(x.left - lb.left) + 'px;top:' + Math.round(x.top - lb.top) + 'px;';

    if (o.marks) paintMarks(host, changesFor(host, o.base, text), mk, at, visible, lb, box);

    const sel = r && r.start !== r.end ? rangeRects(host, r.start, r.end) : [];
    for (const x of sel) {
      if (!visible(x)) continue;
      mk('sel', at(x) + 'width:' + Math.round(x.width) + 'px;height:' + Math.round(x.height) + 'px;'
        + 'background:rgba(96,165,250,0.35);border-radius:2px;');
    }

    const end = r ? r.end : text.length;
    const c = caretRect(host, r && r.start === r.end ? r.start : end);
    if (c && visible(c) && (!r || r.start === r.end)) {
      mk('caret', at(c) + 'width:2px;height:' + Math.round(c.height) + 'px;margin-left:-1px;background:#dc2626;');
    }

    if (o.interim && c) {
      const chip = mk('interim', 'left:' + Math.round(Math.max(0, c.left - lb.left - 8)) + 'px;'
        + 'top:' + Math.round(c.bottom - lb.top + 4) + 'px;max-width:min(80%,28rem);'
        + 'padding:2px 8px;border-radius:8px;background:rgba(244,244,245,0.95);'
        + 'box-shadow:0 1px 3px rgba(0,0,0,0.15);color:#71717a;font-style:italic;z-index:2;');
      chip.textContent = o.interim;
    }

    if (sel.length && o.handles !== false) {
      window.Dictate.pins(layer, { first: sel[0], last: sel[sel.length - 1], armed: o.armed,
                                   reach: o.reach, arrows: false, clip: box });
    } else {
      for (const gone of [...layer.childNodes]) if (gone.getAttribute && gone.getAttribute('data-edge')) gone.remove();
    }
    return host;
  };

  // The caret position under a point, from the platform's own hit test. A node
  // outside the map (an unfindable run, a table's padding) resolves to the end
  // of the nearest stamped text before it, never to the top of the document.
  const offsetAt = (host, x, y) => {
    const doc = host.ownerDocument;
    let node = null, off = 0;
    if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
    else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
    if (!node || !host.contains(node)) return null;
    if (node.nodeType === 3) {
      const sp = node.parentElement && node.parentElement.closest('[data-src]');
      if (sp && sp.firstChild === node) return +sp.dataset.src + off;
    } else if (node.childNodes[off]) {
      node = node.childNodes[off];
    }
    let best = null;
    for (const sp of spans(host)) {
      if (sp === node || sp.compareDocumentPosition(node) & 4 /* FOLLOWING */) best = sp;
      else break;
    }
    return best ? +best.dataset.src + (best.firstChild ? best.firstChild.length : 0) : 0;
  };

  // On the words, as against the margin or the gap below the last line. The
  // platform's nearest caret position is checked against its own text's boxes,
  // widened to the line so the leading between two lines still counts.
  const hitsText = (host, x, y) => {
    const doc = host.ownerDocument;
    const r = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(x, y) : null;
    const node = r ? r.startContainer : null;
    if (!node || node.nodeType !== 3 || !host.contains(node)) return false;
    const el = node.parentElement;
    const lead = parseFloat(getComputedStyle(el).lineHeight) || 0;
    const rg = doc.createRange();
    rg.selectNodeContents(node);
    for (const b of rg.getClientRects()) {
      if (x < b.left - 2 || x > b.right + 2) continue;
      const pad = lead > b.height ? (lead - b.height) / 2 : 2;
      if (y >= b.top - pad && y <= b.bottom + pad) return true;
    }
    return false;
  };

  // ── Editing rules for typing into the rendered face ─────────────────────
  // Pure functions over the markdown string and a caret, so they are testable
  // without a layout engine. Each returns { text, caret } or null when the rule
  // does not apply and the ordinary edit should go ahead.
  //
  // A WRAPPER LASTS AS LONG AS ONE CHARACTER OF IT DOES. Deleting inside `**…**`
  // leaves the markers standing until the last character goes, and then they go
  // with it; typing at the inner edge continues the wrapper, since a caret at
  // the end of a bold run maps to just before its closing `**`.
  const WRAPS = ['**', '__', '~~', '`', '*', '_'];
  const tidy = (text, c) => {
    for (const m of WRAPS) {
      if (text.slice(c - m.length, c) === m && text.slice(c, c + m.length) === m) {
        return { text: text.slice(0, c - m.length) + text.slice(c + m.length), caret: c - m.length };
      }
    }
    // A link whose label is gone takes its target with it.
    if (text[c - 1] === '[') {
      const m = /^\]\([^)\n]*\)/.exec(text.slice(c));
      if (m) return { text: text.slice(0, c - 1) + text.slice(c + m[0].length), caret: c - 1 };
    }
    return null;
  };

  // The block marker a line opens with, if any: a heading's hashes, a list
  // bullet or number, a quote.
  const MARKER = /^(\s*)(#{1,6}\s+|[-*+]\s+|\d{1,9}[.)]\s+|>\s?)/;
  const lineAt = (text, c) => {
    const ls = text.lastIndexOf('\n', c - 1) + 1;
    let le = text.indexOf('\n', c);
    if (le < 0) le = text.length;
    const m = MARKER.exec(text.slice(ls, le));
    return { ls, le, line: text.slice(ls, le), marker: m ? m[0] : '', indent: m ? m[1] : '' };
  };

  // Backspace at the start of a line's CONTENT. A marked line (heading, item,
  // quote) loses its marker and becomes a paragraph, the block version of the
  // wrapper rule; an unmarked one joins the block before it, through however
  // many blank lines stood between.
  const backspace = (text, c) => {
    const L = lineAt(text, c);
    if (L.marker && c === L.ls + L.marker.length) {
      return { text: text.slice(0, L.ls) + text.slice(L.ls + L.marker.length), caret: L.ls };
    }
    if (c === L.ls && c > 0) {
      let a = c;
      while (a > 0 && text[a - 1] === '\n') a--;
      return { text: text.slice(0, a) + text.slice(c), caret: a };
    }
    return null;
  };

  // Enter. In a list item, a new item (a number counts up); on an item with no
  // text, the list ends. Anywhere else, a new paragraph, which in markdown is a
  // blank line: a single newline would render as a space and look like nothing.
  const enter = (text, a, b = a) => {
    const L = lineAt(text, a);
    const item = /^(\s*)([-*+]|(\d{1,9})([.)]))\s+/.exec(L.line);
    if (item) {
      // Ended with a blank line before the caret, or the next words would be
      // read as a lazy continuation of the item above.
      if (!L.line.slice(item[0].length).trim()) {
        return { text: text.slice(0, L.ls) + '\n' + text.slice(L.le), caret: L.ls + 1 };
      }
      const next = item[3] ? (+item[3] + 1) + item[4] : item[2];
      const ins = '\n' + item[1] + next + ' ';
      return { text: text.slice(0, a) + ins + text.slice(b), caret: a + ins.length };
    }
    return { text: text.slice(0, a) + '\n\n' + text.slice(b), caret: a + 2 };
  };

  const removals = (host) => (host.__chg ? host.__chg.del : []);
  window.MdSurface = { paint, offsetAt, hitsText, tidy, backspace, enter, lineAt, changes, removals, _pointAt: pointAt };
})();
