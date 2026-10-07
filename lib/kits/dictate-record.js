// kits/dictate-record.js — an edit to one file as data: its changes, and notes
// kept as records anchored to GitHub's copy, serialized as a `dictate/1` record.
//
// pages/dictate.html edits a file against the copy GitHub holds. What it has to
// say about that edit is two kinds of thing, and they are kept apart because
// they come from different places:
//
//   CHANGES are derived. The page recomputes them from the two texts on every
//   paint (kits/md-surface.js, the cards), so here they are only read out.
//   NOTES are authored. Only the reader makes one, so each is a record that
//   lives until it is deleted: { id, at, o, e, exact, prefix, suffix, text }.
//
// A NOTE IS ANCHORED TO GITHUB'S COPY, by offsets `o` and `e` into it, because
// that copy does not move while the reader edits: a note on a paragraph stays
// on it through any edit anywhere, its own included, and through the edit
// being taken back. A note on text that only the edit has (a paragraph added)
// is a POINT, o === e, at the place the addition goes in, with the added text
// as its `exact`. The quote (exact, prefix, suffix: the W3C Web Annotation
// TextQuoteSelector, as kits/annotate.js and kits/notes.js keep it) is the
// witness that lets a note be found again when GitHub's copy itself changes.
//
// GITHUB'S COPY CHANGES IN TWO WAYS, and each has its own repair:
//   rebase()  a commit from this page (Apply, Save) replaced it, and the old
//             and new copies are both in hand, so each note moves through the
//             alignment between them: a note on a change that went in lands
//             on that change's text, one whose text went out is unplaced.
//   refind()  it moved on GitHub while the reader was away, and only the new
//             copy is in hand, so each note is found again by its quote.
// An UNPLACED note keeps its quote and its words and has o === e === null. It
// stays in the record, so a note is never lost without saying so.
//
// THE RECORD is the serialization, `kind: "dictate/1"`: the file and the
// version the line numbers count in, then `changes` and `notes`, either of
// which may be empty. Its field names follow the estate's other formats rather
// than coin new ones: `kind` as data-view, shorter and standoff spell it;
// `target` as standoff names the document, holding surface's `repository`,
// `ref`, `path` triple and the git `blob` docs/locators.md names as a file's
// witness; `{start, end}` lines as annotate's sections; `after` as standoff's
// insertions; and a note shaped as the notes store's record (`anchor`, `text`,
// `at`), so a note saves there field for field.
//
//   DictateRecord.make(unit, base, text, words)   a note on one unit (MdSurface.units)
//   DictateRecord.place(notes, units, text)       Map note id -> the unit holding it
//   DictateRecord.refresh(notes, units, text)     a point note's quote follows its text
//   DictateRecord.rebase(notes, from, to)         notes moved through a commit
//   DictateRecord.refind(notes, base)             notes found again by their quotes
//   DictateRecord.build({ target, at, author, base, text, units, notes, accepted })
//   DictateRecord.markdown(record) / prompt(record)
//   DictateRecord.notesFrom(record, base)         a record's notes, anchored again
//
// Reads window.mdDiff (kits/md-diff.js) for rebase only. Attaches
// window.DictateRecord, loaded via gh.load('kits/dictate-record.js').
(() => {
  const CTX = 32;
  const KIND = 'dictate/1';
  const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
  // The notes store's id and time formats (kits/notes.js), so a note saved
  // there later can keep both.
  const newId = () => 'n' + Date.now().toString(36)
    + Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * 36)]).join('');
  const stamp = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // The quote of base[o, e), or for a point the base either side of it with
  // `exact` supplied.
  const quote = (base, o, e, exact) => ({
    exact: exact != null ? exact : base.slice(o, e),
    prefix: base.slice(Math.max(0, o - CTX), o),
    suffix: base.slice(e, e + CTX),
  });
  // A unit's span with the trailing newline a block's `end` carries left off,
  // so a quote is the block's text and a line count does not run one over.
  const trimmed = (s, a, b) => a + s.slice(a, b).trimEnd().length;
  const addedText = (u, text) => text.slice(u.n[0], u.n[1]).trimEnd();

  const make = (u, base, text, words) => {
    const point = u.o[0] === u.o[1];
    const o = u.o[0], e = point ? o : trimmed(base, u.o[0], u.o[1]);
    return { id: newId(), at: stamp(), o, e, ...quote(base, o, e, point ? addedText(u, text) : undefined), text: words };
  };

  // How many words two texts share, for telling apart two additions that
  // stand at one point after one of them has been typed into.
  const shared = (a, b) => {
    const w = new Set(flat(a).toLowerCase().split(' '));
    return flat(b).toLowerCase().split(' ').filter((x) => x && w.has(x)).length;
  };

  // WHICH UNIT HOLDS A NOTE. A passage is held by the unit whose base span it
  // meets, so a note on a paragraph shows on it unchanged and on its card once
  // edited. A point is held by a card that only adds, standing at that point;
  // two additions side by side stand at one point, and the added text decides,
  // by the words it still shares with the note's quote.
  const place = (notes, units, text = '') => {
    const out = new Map();
    for (const n of notes) {
      if (n.o == null) continue;
      let hit = null;
      if (n.o === n.e) {
        const c = units.filter((u) => u.card != null && u.o[0] === u.o[1] && u.o[0] === n.o);
        hit = c.length > 1 ? c.map((u) => [u, shared(addedText(u, text), n.exact)]).sort((x, y) => y[1] - x[1])[0][0] : (c[0] || null);
      } else {
        hit = units.find((u) => u.o[0] !== u.o[1] && n.o < u.o[1] && u.o[0] < n.e) || null;
      }
      if (hit) out.set(n.id, hit);
    }
    return out;
  };

  // A point note's `exact` is the added text, which the reader may still be
  // editing; brought up to date before the notes are stored or serialized.
  const refresh = (notes, units, text) => {
    const at = place(notes, units, text);
    return notes.map((n) => {
      const u = at.get(n.id);
      if (!u || n.o !== n.e) return n;
      const exact = addedText(u, text);
      return exact === n.exact ? n : { ...n, exact };
    });
  };

  const unplaced = (n) => ({ ...n, o: null, e: null });

  // THROUGH A COMMIT. `from` and `to` are GitHub's copy before and after, and
  // align pairs their blocks: an unchanged block moves by however much the
  // text above it grew, a changed one maps to its new text.
  const rebase = (notes, from, to) => {
    if (from === to || !notes.length) return notes;
    const seq = window.mdDiff.align(from, to, { items: true });
    // Where a point in `from` lands in `to`: after the block that ended at or
    // before it, or at the top.
    const pointAt = (p) => {
      let at = 0;
      for (const e of seq) if (e.oldRange && e.newRange && e.oldRange.end <= p) at = Math.max(at, e.newRange.end);
      return at;
    };
    return notes.map((n) => {
      if (n.o == null) return n;
      let o, e;
      if (n.o === n.e) {
        // A note on added text whose addition went in: an added block of `to`
        // standing at the note's point, carrying its text.
        let last = 0, hit = null;
        for (const x of seq) {
          if (!x.oldRange && x.newRange && last === n.o && flat(x.new) === flat(n.exact)) { hit = x; break; }
          if (x.oldRange) last = Math.max(last, x.oldRange.end);
        }
        if (hit) { o = hit.newRange.start; e = trimmed(to, hit.newRange.start, hit.newRange.end); }
        else { const p = pointAt(n.o); return { ...n, o: p, e: p, ...quote(to, p, p, n.exact) }; }
      } else {
        const met = seq.filter((x) => x.oldRange && x.oldRange.start < n.e && n.o < x.oldRange.end && x.newRange);
        if (!met.length) return unplaced(n);
        o = Math.min(...met.map((x) => x.newRange.start));
        e = trimmed(to, o, Math.max(...met.map((x) => x.newRange.end)));
      }
      return { ...n, o, e, ...quote(to, o, e) };
    });
  };

  // BY QUOTE, when GitHub's copy moved and only the new one is in hand. A
  // passage still at its offsets stays; otherwise each place its text occurs
  // is scored by whether its context still matches, nearest first on a tie. A
  // point is found by the text either side of it.
  const occurrences = (s, q) => {
    const out = [];
    if (!q) return out;
    for (let i = s.indexOf(q); i >= 0; i = s.indexOf(q, i + 1)) out.push(i);
    return out;
  };
  const refind = (notes, base) => notes.map((n) => {
    if (n.o === n.e && n.o != null && base.slice(n.o - n.prefix.length, n.o) === n.prefix
        && base.slice(n.o, n.o + n.suffix.length) === n.suffix) return n;
    if (n.o !== n.e && n.o != null && base.slice(n.o, n.e) === n.exact) return { ...n, ...quote(base, n.o, n.e) };
    const was = n.o == null ? 0 : n.o;
    // An unplaced note was a passage or a point; only its text can bring it
    // back, so it is looked for as a passage and otherwise stays unplaced.
    if (n.o != null && n.o === n.e) {
      const tries = [[n.prefix + n.suffix, n.prefix.length], [n.prefix, n.prefix.length], [n.suffix, 0]];
      for (const [q, off] of tries) {
        const hits = q.trim() ? occurrences(base, q) : [];
        if (!hits.length) continue;
        const p = hits.sort((a, b) => Math.abs(a + off - was) - Math.abs(b + off - was))[0] + off;
        return { ...n, o: p, e: p, ...quote(base, p, p, n.exact) };
      }
      return unplaced(n);
    }
    const hits = occurrences(base, n.exact);
    if (!hits.length) return unplaced(n);
    // How much of the context still stands either side, character by
    // character outward from the passage, so a context that half survived
    // still outweighs one that did not.
    const score = (i) => {
      let a = 0, b = 0;
      while (a < n.prefix.length && i - a - 1 >= 0 && base[i - a - 1] === n.prefix[n.prefix.length - a - 1]) a++;
      const j = i + n.exact.length;
      while (b < n.suffix.length && base[j + b] === n.suffix[b]) b++;
      return a + b;
    };
    const i = hits.sort((a, b) => score(b) - score(a) || Math.abs(a - was) - Math.abs(b - was))[0];
    return { ...n, o: i, e: i + n.exact.length, ...quote(base, i, i + n.exact.length) };
  });

  // Line numbers, 1-based, in the text the offsets index.
  const lineIndex = (s) => {
    const starts = [0];
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) starts.push(i + 1);
    const at = (i) => {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= i) lo = m; else hi = m - 1; }
      return lo + 1;
    };
    return {
      span: (a, b) => ({ start: at(a), end: at(Math.max(a, b - 1)) }),
      // The last line holding text before a point, or 0 at the top.
      after: (p) => { let q = p; while (q > 0 && /\s/.test(s[q - 1])) q--; return q === 0 ? 0 : at(q - 1); },
    };
  };

  // THE RECORD. `units` are MdSurface.units for base and text; `accepted` the
  // card numbers the reader confirmed. Notes come out in document order, the
  // unplaced ones last.
  const build = ({ target, at, author, base, text, units, notes, accepted }) => {
    const L = lineIndex(base);
    const changes = [];
    for (const u of units) {
      if (u.card == null) continue;
      const c = { id: 'c' + (u.card + 1) };
      const old = base.slice(u.o[0], u.o[1]).trimEnd(), now = text.slice(u.n[0], u.n[1]).trimEnd();
      if (u.o[0] === u.o[1]) c.after = L.after(u.o[0]); else c.lines = L.span(u.o[0], u.o[0] + old.length);
      if (old) c.old = old;
      if (now) c.new = now;
      if (accepted && accepted.has(u.card)) c.accepted = true;
      changes.push(c);
    }
    const held = place(notes, units, text);
    const where = (n) => (n.o == null ? Infinity : n.o);
    const out = [...notes].sort((a, b) => where(a) - where(b)).map((n) => {
      const r = { id: n.id, at: n.at };
      if (n.o == null) r.unplaced = true;
      else if (n.o === n.e) r.after = L.after(n.o);
      else r.lines = L.span(n.o, n.e);
      r.anchor = { exact: n.exact, prefix: n.prefix, suffix: n.suffix };
      const u = held.get(n.id);
      if (u && u.card != null) r.change = 'c' + (u.card + 1);
      r.text = n.text;
      return r;
    });
    const rec = { kind: KIND, target: { ...target }, at: at || stamp() };
    if (author) rec.author = author;
    rec.changes = changes;
    rec.notes = out;
    return rec;
  };

  // Back from a record: its notes, anchored again in `base` by their quotes,
  // with the line numbers as the starting guess. The reader that opens a
  // record rides on this; so does the test that holds a record to round-trip.
  const notesFrom = (rec, base) => {
    const starts = [0];
    for (let i = 0; i < base.length; i++) if (base.charCodeAt(i) === 10) starts.push(i + 1);
    const lineStart = (n) => starts[Math.min(Math.max(n, 1), starts.length) - 1] || 0;
    const seed = (r) => {
      if (r.unplaced) return { o: null, e: null };
      const o = r.lines ? lineStart(r.lines.start) : r.after != null ? lineStart(r.after + 1) : 0;
      return r.lines ? { o, e: o + r.anchor.exact.length } : { o, e: o };
    };
    const notes = (rec.notes || []).map((r) => ({ id: r.id, at: r.at, ...seed(r),
      exact: r.anchor.exact, prefix: r.anchor.prefix, suffix: r.anchor.suffix, text: r.text }));
    // A note the record says is unplaced stays so: refind would look for it
    // again, which is the right thing when the copy moves and not on a read.
    const placed = refind(notes.filter((n) => n.o != null), base);
    return notes.map((n) => (n.o == null ? n : placed.shift()));
  };

  // ── Markdown, for a chat or a session ─────────────────────────────────────
  // annotate's reading (kits/annotate.js itemMarkdown): one heading per item,
  // the passage quoted or the change as a diff, and the reader's own words
  // after a bold **Note:**, which is what keeps them apart from anything the
  // recipient writes around the paste.
  const fence = (s) => {
    let n = 3;
    for (const m of String(s).matchAll(/`+/g)) n = Math.max(n, m[0].length + 1);
    return '`'.repeat(n);
  };
  const where = (r) => (r.lines ? (r.lines.start === r.lines.end ? 'line ' + r.lines.start : 'lines ' + r.lines.start + '-' + r.lines.end)
    : r.after != null ? (r.after ? 'after line ' + r.after : 'at the top') : '');
  const quoted = (s) => String(s).split('\n').map((l) => ('> ' + l).trimEnd());
  // A change as diff lines: the lines both sides share as context, the rest
  // struck and added, so one word changed in a hard-wrapped paragraph reads
  // as one line rather than as the paragraph twice. A longest common
  // subsequence over lines, bounded; past the bound, the two sides whole.
  const diffLines = (a, b) => {
    const A = a ? a.split('\n') : [], B = b ? b.split('\n') : [], n = A.length, m = B.length;
    if (n * m > 40000) return [...A.map((l) => '- ' + l), ...B.map((l) => '+ ' + l)];
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push('  ' + A[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) out.push('- ' + A[i++]);
      else out.push('+ ' + B[j++]);
    }
    while (i < n) out.push('- ' + A[i++]);
    while (j < m) out.push('+ ' + B[j++]);
    return out.map((l) => l.trimEnd());
  };
  const noteLines = (n) => ['**Note:** ' + n.text, ''];
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');

  const markdown = (rec) => {
    const t = rec.target || {}, L = [];
    const accepted = rec.changes.filter((c) => c.accepted).length;
    L.push('# ' + String(t.path || '').split('/').pop());
    L.push('`' + t.repository + (t.ref ? '@' + t.ref : '') + ':' + t.path + '`'
      + (t.blob ? ' · blob ' + t.blob.slice(0, 7) : '') + ' · ' + String(rec.at || '').slice(0, 10));
    L.push((rec.changes.length ? plural(rec.changes.length, 'change') + (accepted ? ' (' + accepted + ' accepted)' : '') : 'No changes')
      + ' · ' + (rec.notes.length ? plural(rec.notes.length, 'note') : 'no notes'), '');
    const pos = (r) => (r.lines ? r.lines.start : r.after != null ? r.after + 0.5 : Infinity);
    const items = [
      ...rec.changes.map((c) => ({ c, at: pos(c) })),
      ...rec.notes.filter((n) => !n.change).map((n) => ({ n, at: pos(n) })),
    ].sort((a, b) => a.at - b.at);
    for (const it of items) {
      if (it.c) {
        const c = it.c;
        L.push('## Change ' + c.id.slice(1) + ' · ' + where(c) + (c.accepted ? ' · accepted' : ''));
        const body = diffLines(c.old || '', c.new || '').join('\n');
        const f = fence(body);
        L.push(f + 'diff', body, f, '');
        for (const n of rec.notes.filter((x) => x.change === c.id)) L.push(...noteLines(n));
      } else {
        const n = it.n;
        L.push('## Note' + (n.unplaced ? ' (could not be placed)' : ' · ' + where(n)));
        L.push(...quoted(n.anchor.exact), '', ...noteLines(n));
      }
    }
    return L.join('\n').replace(/\n+$/, '\n');
  };

  // What rides to a Claude Code session: where it belongs, what a change marked
  // accepted means, and the record's markdown.
  const prompt = (rec) => {
    const t = rec.target || {};
    return 'Here are changes and notes on `' + t.path + '` in ' + t.repository + (t.ref ? ' (branch ' + t.ref + ')' : '')
      + ', made against blob ' + String(t.blob || '').slice(0, 7) + '. A change marked accepted is one the reader confirmed.'
      + ' Apply the accepted changes on a new branch, weigh the others, act on the notes where they ask for something,'
      + ' and open a PR for anything you change.\n\n' + markdown(rec);
  };

  window.DictateRecord = { KIND, newId, stamp, quote, make, place, refresh, rebase, refind, build, notesFrom, markdown, prompt };
})();
