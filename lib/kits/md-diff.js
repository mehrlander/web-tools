// kits/md-diff.js — a markdown change read as the DOCUMENT rather than as its
// source.
//
// The problem this answers. A diff is over source lines, and a rendered
// document has thrown its lines away, so reviewing a documentation edit meant
// reading `+` and `-` against markup: the reader judged the patch and then had
// to imagine the page. That is the wrong way round for prose, where the
// question is what the document now SAYS.
//
// The assumption the whole shape follows from, and it is worth stating because
// it is the one that can be wrong: a documentation edit is usually a change
// here and a change there, not a rewrite. So the unit is a BLOCK, each changed
// block gets a container of its own, and everything unchanged renders as
// ordinary prose. A file rewritten end to end degrades into one container per
// block, which is honest rather than broken, and the jump strip says so by its
// count.
//
//   mdDiff.blocks(md)                    -> [{ text, start, end }]
//   mdDiff.align(old, new)               -> [{ kind, old, new }]   full sequence
//   mdDiff.changes(old, new)             -> the changed entries only
//   mdDiff.runs(oldText, newText)        -> [{ type: 'equal'|'change', … }]
//   mdDiff.mark(root, runs)              -> root, with <ins>/<del> laid over it
//   mdDiff.render(host, old, new, opts)  -> { count, goto, next, prev }
//
// ── Four readings, and why a container owns its own ─────────────────────────
//
// Every permutation of old, new and combined is right for SOME change, which is
// why picking one globally has never worked. The choice is per container and it
// is two questions rather than one:
//
//   difference OFF   NEW and OLD, each rendered whole
//   difference ON    INLINE (one column, marks in place) and SIDE (two columns)
//
// A word swap reads best inline; a rewritten paragraph reads best as two
// columns; a change whose point is the final wording reads best as the new text
// alone. Only the reader knows which of those they are looking at.
//
// Each pair is a two-slide swipeDeck track, so the swipe between them is the
// house gesture with the house snap behaviour rather than a pointer threshold
// invented here. The buttons drive the same track.
//
// A container opens on inline unless more than half its OLD text was taken
// away, in which case it opens on side by side. See the note by `replaced`.
//
// ── How the inline view is built, since this is the load-bearing part ───────
//
// NOT by diffing markdown source and rendering the result: a word diff cuts
// through `**` and `](` and the render collapses. Instead the NEW block is
// rendered normally and the change is laid over the rendered text as standoff
// marks, which is the move kits/annotate.js makes for a note. The diff runs
// over the two blocks' PLAIN TEXT, so what is marked is what a reader sees, and
// the markup underneath is never touched.
//
// Deletions have no place in the new text, so each removed run is inserted as a
// <del> at the boundary where it used to be. That is the one place this view
// adds a node rather than marking one.
//
// Two details keep that honest. Every offset is resolved against the text nodes
// BEFORE anything is mutated, and the edits are applied back to front within
// each node, so no operation invalidates the next one's coordinates. And a run
// crossing an element boundary is wrapped once per text node rather than once
// per run, so a change spanning `<strong>` stays inside the strong instead of
// re-nesting the markup around it.
//
// The coalescing rule is pages/shorter.html's, and it is a finding rather than
// a nicety: a tiny equal run wedged between two changes is absorbed, so a
// flipped word does not shatter a sentence into a dozen marks.
//
// Marking runs before mdDoc.contain(), deliberately. contain() inserts a
// language label above each fence, and that label is text the walker would
// count, which would put every offset after the first fence off by its length.
//
// Depends on window.Diff (jsdiff, as pages/shorter.html loads it),
// window.GuideRender for the rendering, and kits/swipe-deck.js for the track.
// All three are loaded on demand.
(() => {
  if (window.mdDiff) return;

  const DIFF_JS = 'https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js';
  const ABSORB = 4;        // an equal run this short between two changes is noise

  let diffAsked = null;
  function needDiff() {
    if (window.Diff) return Promise.resolve(window.Diff);
    if (diffAsked) return diffAsked;
    diffAsked = new Promise((done) => {
      const sc = document.createElement('script');
      sc.src = DIFF_JS;
      sc.onload = () => done(window.Diff);
      sc.onerror = () => done(null);
      document.head.append(sc);
    });
    return diffAsked;
  }

  // ── Segmentation ──────────────────────────────────────────────────────────
  // Top-level blocks, split on blank lines, with a fenced run kept whole: a
  // fence contains blank lines of its own, and splitting inside one produces
  // two halves that are each invalid markdown.
  function blocks(md) {
    const src = String(md == null ? '' : md).replace(/\r\n?/g, '\n');
    const lines = src.split('\n');
    const out = [];
    let buf = [], start = 0, pos = 0, fence = null;
    const flush = (end) => {
      const text = buf.join('\n').replace(/\s+$/, '');
      if (text.trim()) out.push({ text, start, end });
      buf = [];
    };
    for (const line of lines) {
      const f = /^\s*(`{3,}|~{3,})/.exec(line);
      if (f && !fence) fence = f[1][0].repeat(3);
      else if (f && fence && line.trim().startsWith(fence)) fence = null;
      if (!fence && !line.trim()) {
        // A blank line outside a fence ends a block and belongs to no block,
        // which is two rules rather than one: an unterminated `if (buf.length)`
        // here pushes a run of leading blanks INTO the next block, and the
        // block's text then starts with whitespace that nothing downstream
        // strips.
        if (buf.length) flush(pos);
        start = pos + line.length + 1;
      } else {
        if (!buf.length) start = pos;
        buf.push(line);
      }
      pos += line.length + 1;
    }
    if (buf.length) flush(src.length);
    return out;
  }

  // ── Alignment ─────────────────────────────────────────────────────────────
  // Blocks compare on their text with whitespace flattened, so a rewrap that
  // changes no words is not a change. What comes back is the NEW document's
  // sequence, each entry either an unchanged block or a change carrying both
  // sides.
  //
  // Which old block became which new one, and what is left over.
  //
  // The measure is shared words, as a Dice coefficient over the two token
  // lists: twice the overlap, over the two lengths together. It is deliberately
  // crude, and crude is enough, because what it has to get right is not which
  // rewording is closest but that prose never pairs with a table and a
  // paragraph never pairs with a code fence. Those score near zero whatever
  // the threshold.
  //
  // Greedy, best score first. A stable-marriage pairing would be better in
  // principle and there is nothing here for it to fix: the runs are a handful
  // of blocks, and the case where greedy loses needs three blocks each of which
  // is the best match for the same partner.
  const TOKENS = (t) => String(t || '').toLowerCase().match(/[\w']+/g) || [];
  const PAIR_FLOOR = 0.34;   // below this the two are different blocks, not one edited

  function pairUp(olds, news) {
    if (!olds.length) return news.map((t) => ({ kind: 'added', old: '', new: t }));
    if (!news.length) return olds.map((t) => ({ kind: 'removed', old: t, new: '' }));

    const ot = olds.map(TOKENS), nt = news.map(TOKENS);
    const cand = [];
    for (let i = 0; i < olds.length; i++) {
      const have = new Set(ot[i]);
      for (let j = 0; j < news.length; j++) {
        if (!ot[i].length || !nt[j].length) continue;
        let hit = 0;
        for (const w of nt[j]) if (have.has(w)) hit++;
        const score = (2 * hit) / (ot[i].length + nt[j].length);
        if (score >= PAIR_FLOOR) cand.push({ i, j, score });
      }
    }
    cand.sort((x, y) => y.score - x.score);
    const forOld = new Array(olds.length).fill(-1);
    const forNew = new Array(news.length).fill(-1);
    for (const c of cand) {
      if (forOld[c.i] >= 0 || forNew[c.j] >= 0) continue;
      forOld[c.i] = c.j; forNew[c.j] = c.i;
    }

    // Ordered by the NEW document, since that is the document being read. A
    // removed block has no place in it, so it is emitted just before whatever
    // now stands where it used to: the next old block that did survive.
    const events = [];
    for (let j = 0; j < news.length; j++) {
      events.push(forNew[j] >= 0
        ? { at: j, rank: 1, kind: 'changed', old: olds[forNew[j]], new: news[j] }
        : { at: j, rank: 1, kind: 'added', old: '', new: news[j] });
    }
    for (let i = 0; i < olds.length; i++) {
      if (forOld[i] >= 0) continue;
      let at = news.length;
      for (let k = i + 1; k < olds.length; k++) if (forOld[k] >= 0) { at = forOld[k]; break; }
      events.push({ at, rank: 0, kind: 'removed', old: olds[i], new: '' });
    }
    events.sort((x, y) => x.at - y.at || x.rank - y.rank);
    return events.map(({ kind, old, new: nw }) => ({ kind, old, new: nw }));
  }

  // HOW A REMOVED RUN MEETS AN ADDED ONE, which is the whole of the alignment
  // and the thing worth getting right. diffArrays hands back a removed run and
  // an added run side by side; how those pair decides what each container
  // holds. Two wrong answers were tried first, and each was visible in the
  // demo page's own shot:
  //
  //   fuse the whole run into one change   The reader loses the count, and the
  //     inline view's word diff then spans block boundaries, so a deletion
  //     belonging to a paragraph lands inside the code fence above it.
  //   pair by position when the counts match   A paragraph taken out shifts
  //     everything below it by one, so a paragraph pairs with a code fence and
  //     the container compares two unrelated things.
  //
  // What is actually being asked is which old block BECAME which new one, and
  // position cannot answer it. So the blocks are paired on how much text they
  // share, best match first, and anything left over is an addition or a
  // removal in its own right. See `pairUp`.
  function align(a, b) {
    const A = blocks(a), B = blocks(b);
    const norm = (x) => x.text.replace(/\s+/g, ' ').trim();
    const parts = window.Diff.diffArrays(A.map(norm), B.map(norm));
    const seq = [];
    let ai = 0, bi = 0, pending = null;
    const flush = () => {
      if (!pending) return;
      for (const e of pairUp(pending.old, pending.new)) seq.push(e);
      pending = null;
    };
    for (const part of parts) {
      const n = part.value.length;
      if (part.added) {
        (pending ||= { old: [], new: [] }).new.push(...B.slice(bi, bi + n).map((x) => x.text));
        bi += n;
      } else if (part.removed) {
        (pending ||= { old: [], new: [] }).old.push(...A.slice(ai, ai + n).map((x) => x.text));
        ai += n;
      } else {
        flush();
        for (let k = 0; k < n; k++) seq.push({ kind: 'same', new: B[bi + k].text });
        ai += n; bi += n;
      }
    }
    flush();
    return seq;
  }

  const changes = (a, b) => align(a, b).filter((s) => s.kind !== 'same');

  // ── Word runs ─────────────────────────────────────────────────────────────
  // Coarse runs first, then absorb the noise, as shorter.html does.
  function runs(oldText, newText) {
    const parts = window.Diff.diffWordsWithSpace(oldText || '', newText || '');
    const coarse = [];
    let cur = null;
    const flush = () => {
      if (cur) { coarse.push({ type: 'change', o: cur.o, n: cur.n }); cur = null; }
    };
    for (const p of parts) {
      if (p.added) (cur ||= { o: '', n: '' }).n += p.value;
      else if (p.removed) (cur ||= { o: '', n: '' }).o += p.value;
      else { flush(); coarse.push({ type: 'equal', text: p.value }); }
    }
    flush();
    for (let again = true; again;) {
      again = false;
      for (let i = 1; i < coarse.length - 1; i++) {
        const e = coarse[i];
        if (e.type === 'equal' && e.text.trim().length <= ABSORB
            && coarse[i - 1].type === 'change' && coarse[i + 1].type === 'change') {
          const x = coarse[i - 1], y = coarse[i + 1];
          coarse.splice(i - 1, 3, { type: 'change', o: x.o + e.text + y.o, n: x.n + e.text + y.n });
          again = true;
          break;
        }
      }
    }
    return coarse;
  }

  // ── Standoff marking ──────────────────────────────────────────────────────
  // `coarse` is measured against the concatenated text of `root`, which is why
  // the caller must diff the text of the SAME tree it passes here.
  const INS_CLASS = 'md-diff-ins bg-success/20 rounded-[2px] px-[1px] no-underline';
  const DEL_CLASS = 'md-diff-del bg-error/20 rounded-[2px] px-[1px] opacity-60';

  function mark(root, coarse) {
    // The numeric filter and ownerDocument are kits/standoff.js's form, for the
    // same two reasons: NodeFilter is a bare global the suite's realm does not
    // have, and a tree built off-document belongs to its own document.
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    const nodes = [];
    let total = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push({ node: n, start: total, len: n.data.length });
      total += n.data.length;
    }

    // Absolute coordinates first, over the whole run list, before any edit.
    //
    // A run that is only whitespace is passed over rather than marked. Marking
    // one adds a node that shows nothing, and the renderer's own newline
    // between two blocks is exactly that run, so the alternative is a stray
    // mark at the end of most changes.
    //
    // An added run is also trimmed at both ends before it is marked. The
    // whitespace at the end of a run is the newline between two rendered
    // blocks, which belongs to neither, and a highlight over it wraps to the
    // next line as a coloured sliver under the paragraph. Visible on the demo
    // page's added block, where the whole paragraph is one run.
    const ops = [];
    let pos = 0;
    const real = (s) => s && s.trim();
    for (const r of coarse) {
      if (r.type === 'equal') { pos += r.text.length; continue; }
      if (real(r.o)) ops.push({ kind: 'del', at: pos, text: r.o });
      if (r.n) {
        if (real(r.n)) {
          const lead = r.n.length - r.n.replace(/^\s+/, '').length;
          const trail = r.n.length - r.n.replace(/\s+$/, '').length;
          ops.push({ kind: 'ins', at: pos + lead, to: pos + r.n.length - trail });
        }
        pos += r.n.length;
      }
    }

    // Then per node, since a run crossing an element boundary is two wraps.
    const perNode = new Map();
    const push = (rec, op) => {
      if (!perNode.has(rec)) perNode.set(rec, []);
      perNode.get(rec).push(op);
    };
    const last = nodes[nodes.length - 1];
    for (const op of ops) {
      if (op.kind === 'ins') {
        for (const rec of nodes) {
          const s = Math.max(op.at, rec.start), e = Math.min(op.to, rec.start + rec.len);
          if (e > s) push(rec, { kind: 'ins', from: s - rec.start, to: e - rec.start });
        }
      } else {
        const rec = nodes.find((r) => op.at >= r.start && op.at < r.start + r.len) || last;
        if (!rec) { root.append(el('del', DEL_CLASS, op.text)); continue; }
        push(rec, { kind: 'del', from: Math.min(op.at - rec.start, rec.len), text: op.text });
      }
    }

    // Back to front within a node: splitText leaves the head intact, so every
    // offset still smaller than the one just used stays correct.
    //
    // At the SAME offset the wrap goes first and the deletion second, which is
    // the opposite of how they read. A deletion is a zero-width point and its
    // split leaves the head node exactly that long, so running it first hands
    // the wrap an empty tail: the <ins> comes out containing nothing and the
    // added words are left unmarked. Running the wrap first puts the <del>
    // immediately before it, which is also where a reader expects the removed
    // words to sit.
    const rank = (o) => (o.kind === 'ins' ? 0 : 1);
    for (const [rec, list] of perNode) {
      list.sort((x, y) => y.from - x.from || rank(x) - rank(y));
      for (const op of list) {
        const tail = rec.node.splitText(op.from);
        if (op.kind === 'del') {
          tail.parentNode.insertBefore(el('del', DEL_CLASS, op.text), tail);
        } else {
          if (op.to - op.from < tail.data.length) tail.splitText(op.to - op.from);
          const ins = el('ins', INS_CLASS);
          tail.replaceWith(ins);
          ins.append(tail);
        }
      }
    }
    return root;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  // `contain: false` is the inline view's, because the language label contain()
  // inserts would shift every offset after the first fence. The caller contains
  // it after marking instead.
  //
  // `size` is the guide body's, set once by render() rather than threaded
  // through every call: a host in a drawer wants the small body for the whole
  // diff, never for one view of one change.
  let bodySize = null;
  function renderMd(md, o = {}) {
    // bodyClass rather than the literal: it installs the stylesheet, and
    // `guide-body` styles nothing until it has.
    const box = el('div', window.GuideRender.bodyClass(o.size || bodySize) + ' min-w-0');
    box.innerHTML = window.GuideRender.render(String(md || ''), {}).html;
    if (o.contain !== false && window.mdDoc && window.mdDoc.contain) window.mdDoc.contain(box);
    return box;
  }

  const inlineView = (chg) => {
    const box = renderMd(chg.new, { contain: false });
    try { mark(box, runs(textOf(chg.old), box.textContent)); }
    catch { /* a shape the walker cannot mark still reads as the new text */ }
    if (window.mdDoc && window.mdDoc.contain) window.mdDoc.contain(box);
    return box;
  };

  const sideView = (chg) => {
    const grid = el('div', 'grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    for (const [label, md] of [['old', chg.old], ['new', chg.new]]) {
      const col = el('div', 'min-w-0');
      col.append(el('div', 'text-[11px] uppercase tracking-widest opacity-40 mb-1', label),
                 renderMd(md));
      grid.append(col);
    }
    return grid;
  };

  // The plain text a reader sees, for diffing the document rather than the
  // source.
  function textOf(md) {
    if (!md) return '';
    const box = el('div');
    box.innerHTML = window.GuideRender.render(String(md), {}).html;
    return box.textContent;
  }

  // A block that was taken out has no new text to lay marks over, so it is
  // shown as itself, tinted and dimmed. Strikethrough over a whole paragraph is
  // the obvious alternative and is much harder to read than the paragraph.
  const goneView = (c) => {
    const box = renderMd(c.old);
    box.classList.add('opacity-60');
    box.style.background = 'color-mix(in oklab, var(--color-error) 8%, transparent)';
    return box;
  };

  const VIEWS = {
    inline: inlineView,
    side: sideView,
    gone: goneView,
    new: (c) => renderMd(c.new),
    old: (c) => renderMd(c.old),
  };

  // One change, with its own settings. Two controls, because the choice is two
  // questions: which pair, then which of the pair. The track is the same answer
  // for a thumb.
  function container(chg, i, total) {
    const box = el('section', 'md-diff-change border border-base-300 rounded-box overflow-hidden '
                            + 'bg-base-100 grid grid-cols-[minmax(0,1fr)]');
    box.dataset.mdDiffChange = String(i);

    const bar = el('div', 'flex items-center gap-2 px-2 py-1 border-b border-base-300 text-xs');
    bar.append(el('span', 'font-mono opacity-50 tabular-nums', `${i + 1}/${total}`));
    bar.append(el('span', 'opacity-50', chg.kind));
    bar.append(el('div', 'grow'));

    const diffBtn = el('button', 'btn btn-xs btn-ghost', 'difference');
    const pair = el('div', 'join');
    const pairBtns = [el('button', 'join-item btn btn-xs'), el('button', 'join-item btn btn-xs')];
    pair.append(...pairBtns);
    bar.append(diffBtn, pair);

    // The host carries an explicit height, set from the reading on screen.
    //
    // A snap track is a flex row, so its height is the TALLEST slide's, and the
    // two columns of the side view wrap to roughly twice the lines of the one
    // column of the inline view. Left alone, the default reading therefore sits
    // above a block of empty container the height of its own text. Measuring
    // the active slide and setting the height is what removes that; the
    // transition is what keeps the swap from reading as a jolt.
    const host = el('div', 'flex min-h-0 max-h-[70vh] transition-[height] duration-200');
    box.append(bar, host);

    let diffOn = true, deck = null;
    const views = () => (diffOn ? ['inline', 'side'] : ['new', 'old']);

    // WHICH READING A CONTAINER OPENS ON. A small edit reads best inline, and a
    // block that was rewritten reads best as two columns: inline for a rewrite
    // is a strikethrough of one sentence immediately followed by a highlight of
    // another, which is harder to read than either version alone.
    //
    // What decides it is how much of the OLD text was taken away, not how much
    // the block moved. Measuring the movement makes a paragraph that was
    // EXPANDED, every original word still standing with additions between them,
    // score as high as one that was replaced, and inline is the best reading
    // there by some distance. Removal is what inline reads badly, so removal is
    // what the measurement is over.
    //
    // The threshold is a default and nothing more: the reader overrules it with
    // one tap, which is what the control is for.
    const replaced = () => {
      try {
        const ot = textOf(chg.old);
        if (!ot || !chg.new) return 0;
        const gone = runs(ot, textOf(chg.new)).filter((r) => r.type === 'change')
          .reduce((n, r) => n + r.o.length, 0);
        return gone / ot.length;
      } catch { return 0; }
    };
    const REWRITE = 0.5;

    // A block that was added or taken out has ONE side, so it has one reading
    // and no choice to offer. Both controls go with it: two questions about a
    // pair, where there is no pair, is chrome that answers nothing. An added
    // block is its own inline view, since a diff against nothing marks the
    // whole of it, which is the right thing to say about a new block.
    const usable = () => {
      if (chg.kind === 'added') return ['inline'];
      if (chg.kind === 'removed') return ['gone'];
      return views();
    };

    let ro = null;
    function build(start = 0) {
      const modes = usable();
      // The previous track's observers watch nodes that are about to be
      // detached, and they fire fit() against an index in a deck that no
      // longer exists.
      if (ro) { ro.disconnect(); ro = null; }
      host.textContent = '';
      deck = window.swipeDeck.core(modes.length, (n, slide) => {
        slide.append(VIEWS[modes[n]](chg));
      }, { innerClass: 'w-full', slideClass: 'px-3 py-3 sm:px-4 sm:py-4' });
      host.append(deck.track);
      const paint = (a) => pairBtns.forEach((b, n) => {
        b.textContent = modes[n] || '';
        b.classList.toggle('hidden', !modes[n]);
        b.classList.toggle('btn-active', n === a);
      });

      // The inner is the only box whose height is the content's: the section
      // around it is `h-full` and stretches, so measuring that would answer
      // with the height already set.
      const fit = (a) => {
        const sec = deck.track.children[a];
        const inner = sec && sec.firstElementChild;
        if (!inner) return;
        const cs = getComputedStyle(sec);
        const pad = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0);
        host.style.height = (inner.scrollHeight + pad) + 'px';
      };
      deck.onSlide((a) => { paint(a); fit(a); });
      paint(Math.min(start, modes.length - 1));
      requestAnimationFrame(() => { fit(start); if (start) deck.go(start); });
      // Highlighting and web fonts arrive after the first measurement, and a
      // table that reflows changes it again, so the height follows the content
      // rather than being read once.
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(() => fit(deck.active()));
        for (const sec of deck.track.children) if (sec.firstElementChild) ro.observe(sec.firstElementChild);
      }
      diffBtn.classList.toggle('btn-active', diffOn);
      const one = modes.length < 2;
      diffBtn.classList.toggle('hidden', one);
      pair.classList.toggle('hidden', one);
    }

    diffBtn.onclick = () => { diffOn = !diffOn; build(0); };
    pairBtns.forEach((b, n) => { b.onclick = () => deck && deck.go(n); });

    build(replaced() > REWRITE ? 1 : 0);
    return box;
  }

  async function render(host, oldMd, newMd, opts = {}) {
    if (!window.Diff) await needDiff();
    const load = (n) => (window.gh ? window.gh.load(n).catch(() => {}) : Promise.resolve());
    if (!window.GuideRender) await load('kits/guide-render.js');
    if (!window.swipeDeck) await load('kits/swipe-deck.js');
    if (!window.mdDoc) await load('kits/md-doc.js');
    if (window.GuideRender && window.GuideRender.needMarked) await window.GuideRender.needMarked();

    bodySize = opts.size || null;
    const seq = align(oldMd, newMd);
    const changed = seq.filter((s) => s.kind !== 'same');
    host.textContent = '';
    host.classList.add('grid', 'grid-cols-[minmax(0,1fr)]', 'gap-4');

    // A strip, not a sidebar: a count and two arrows is the whole of "take me
    // to the next one" on a phone, so it stays the size of chrome.
    const strip = el('div', 'sticky top-0 z-10 flex items-center gap-2 py-1 text-xs '
                          + 'bg-base-200/90 backdrop-blur');
    strip.append(el('span', 'font-mono opacity-60 tabular-nums',
      changed.length ? `${changed.length} change${changed.length > 1 ? 's' : ''}` : 'no changes'));
    const prev = el('button', 'btn btn-xs btn-ghost', '←');
    const next = el('button', 'btn btn-xs btn-ghost', '→');
    strip.append(el('div', 'grow'), prev, next);
    if (changed.length && opts.strip !== false) host.append(strip);

    const boxes = [];
    for (const s of seq) {
      if (s.kind === 'same') { host.append(renderMd(s.new)); continue; }
      const c = container(s, boxes.length, changed.length);
      boxes.push(c);
      host.append(c);
    }

    let ci = -1;
    const goto = (i) => {
      if (!boxes.length) return;
      ci = (i + boxes.length) % boxes.length;
      const box = boxes[ci];
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      box.classList.add('ring', 'ring-[var(--color-primary)]');
      setTimeout(() => box.classList.remove('ring', 'ring-[var(--color-primary)]'), 900);
    };
    prev.onclick = () => goto(ci - 1);
    next.onclick = () => goto(ci + 1);

    return { count: changed.length, goto, next: () => goto(ci + 1), prev: () => goto(ci - 1) };
  }

  window.mdDiff = { blocks, align, changes, runs, mark, render, _textOf: textOf };
})();
