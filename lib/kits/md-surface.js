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
  };

  const spans = (host) => host.querySelectorAll('[data-src]');

  // The text node and inner offset holding a source offset. A caret between two
  // stamped runs (at a bold's closing `**`, say) belongs to the run it ends, so
  // the words land inside what the reader was looking at.
  const pointAt = (host, at) => {
    let before = null;
    for (const sp of spans(host)) {
      const n = sp.firstChild;
      if (!n || n.nodeType !== 3) continue;
      const s = +sp.dataset.src;
      if (at >= s && at <= s + n.length) return { node: n, offset: at - s };
      if (s + n.length < at) before = { node: n, offset: n.length };
      else break;
    }
    return before;
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

  window.MdSurface = { paint, offsetAt, hitsText, _pointAt: pointAt };
})();
