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
// One CSS variable is the host's half of the contract: set `--md-diff-top` to
// the height of your own sticky header, or the jump strip sticks underneath it.
// `opts.layout` picks the layout the document opens on ('swipe' or 'side'), and
// the returned handle's `setLayout` changes it later.
//
// ── Two layouts, and the document picks ─────────────────────────────────────
//
// `swipe` reads, `side` compares, and which one you want is a property of the
// document rather than of one change: nobody compares paragraph four in two
// columns and paragraph nine by swiping. So one toggle in the strip moves every
// change, and no block carries a control for it.
//
// ── Three readings on one axis, inside `swipe` ─────────────────────────────
//
// Every version of old, new and combined is right for SOME change, which is why
// picking one globally has never worked. The reader picks, by swiping:
//
//   old      the block as it stood
//   both     one column, the change marked in place   <- where a change opens
//   new      the block as it now reads
//
// One axis with three stops, so the swipe IS the interface and the line beneath
// a change is a label that happens to be tappable. See the note above
// `container` for what that replaced and why.
//
// The track is a swipeDeck, so the gesture is the house one with the house snap
// behaviour rather than a pointer threshold invented here.
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
  // Contrast, and the deletion is the one that needed it. It was a 20% wash
  // under `opacity-60` text, so the words a reader most needs to read were the
  // faintest thing on the page. The tint carries the signal now and the text
  // stays at full strength; the strike is currentColor, so it reads at the same
  // weight as the words it crosses.
  const INS_CLASS = 'md-diff-ins bg-success/20 rounded-[2px] px-[1px] no-underline';
  const DEL_CLASS = 'md-diff-del bg-error/40 rounded-[2px] px-[1px] line-through';

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

  // The plain text a reader sees, for diffing the document rather than the
  // source. Rendered WITHOUT contain(), to match the tree inlineView marks.
  function textOf(md) {
    if (!md) return '';
    const box = el('div');
    box.innerHTML = window.GuideRender.render(String(md), {}).html;
    return box.textContent;
  }

  // A block that was taken out has no new text to lay marks over, so it is
  // shown as itself over a red wash. Strikethrough over a whole paragraph is
  // the obvious alternative and is much harder to read than the paragraph.
  const goneView = (c) => {
    const box = renderMd(c.old);
    box.classList.add('bg-error/20', 'rounded-[3px]');
    return box;
  };

  const VIEWS = {
    inline: inlineView,
    gone: goneView,
    new: (c) => renderMd(c.new),
    old: (c) => renderMd(c.old),
  };

  // WHAT A CHANGE LOOKS LIKE IN THE DOCUMENT, and the answer is: like the
  // document, with a little delineation. A bordered box per change turns a page
  // of prose into a stack of panels and the reader then reads the panels rather
  // than the text; a change with no edge at all is hard to aim at. So the block
  // keeps the left edge and the rhythm of the paragraphs around it, and carries
  // a faint tint that says where it begins and ends.
  //
  // THREE READINGS ON ONE AXIS, which is what removed the controls. The first
  // version asked two questions (difference on or off, then which of that
  // pair), which needed two controls and a mode the reader had to hold. Old,
  // inline and new is one axis with three stops, so a swipe is the whole
  // interface and the stops are a label that happens to be tappable.
  // Two-column side by side went with it: at a phone's width it stacked into
  // old-above-new, which is what swiping to `old` and back already gives.
  //
  // The reader lands on inline, the middle stop, so a swipe either way reaches
  // a whole version of the block.
  //
  // The stops float at the top right rather than sitting under the block. Under
  // it they read as a caption belonging to the paragraph, which is the one
  // thing they are not, and they were easy to miss; over it they read as chrome
  // for the block they sit on. The backdrop is what keeps them legible where a
  // line of text runs under them.
  //
  // SELECTION IS ONE IDEA WITH THREE WAYS IN. Tapping a stop, swiping, and
  // jumping from the strip all say the same thing: this block, this reading.
  // So the current block stays marked until another is chosen, rather than
  // flashing and going out, which left the strip's arrows saying nothing about
  // where they had put you.
  function container(chg, i, total) {
    const box = el('section', 'md-diff-change relative grid grid-cols-[minmax(0,1fr)] '
                            + 'rounded-[4px] px-2 -mx-2 py-1 transition-colors duration-200');
    box.dataset.mdDiffChange = String(i);

    const modes = chg.kind === 'added' ? ['inline', 'new']
                : chg.kind === 'removed' ? ['gone']
                : ['old', 'inline', 'new'];
    const start = Math.max(0, modes.indexOf('inline'));
    const LABEL = { gone: 'removed', inline: 'inline', old: 'old', new: 'new' };

    // THE BLOCK'S OUTLINE SAYS WHICH VERSION IS ON SCREEN. Without it, a block
    // sitting on `new` is prose with a faint wash, which is indistinguishable
    // from prose at a glance: the reader has scrolled past the marks and
    // nothing is left saying what they are looking at. Red for the old text,
    // green for the new, neutral for the marked reading, which needs no colour
    // of its own because the marks are the colour.
    //
    // An outline rather than a fill, because a fill is a second background
    // behind text that already carries coloured marks, and the two washes
    // muddy each other; an outline is at the block's edge, where the prose is
    // not. It also leaves the background free to carry selection, which is the
    // one fact that has to be readable ON TOP of the version.
    const RING = {
      old: 'ring-[color-mix(in_oklab,var(--color-error)_55%,transparent)]',
      gone: 'ring-[color-mix(in_oklab,var(--color-error)_55%,transparent)]',
      new: 'ring-[color-mix(in_oklab,var(--color-success)_55%,transparent)]',
      inline: 'ring-[var(--color-base-300)]',
    };
    const RINGS = [...new Set(Object.values(RING))];
    const tint = (m) => {
      box.classList.remove(...RINGS);
      box.classList.add('ring-1', RING[m] || RING.inline);
    };

    // `-mx-2 px-2` puts the tint's edge outside the text and leaves the text
    // itself on the document's own left edge, so the block is delineated
    // without being indented.
    //
    // The stops, floating. `-top-2` lifts the group into the gap above the
    // block so it clears the first line in the common case, and the backdrop
    // covers the case where a line runs under it.
    const stops = el('div', 'absolute -top-2 right-1 z-10 flex items-center gap-0.5 '
                          + 'rounded-full border border-base-300 bg-base-100/90 backdrop-blur '
                          + 'px-0.5 py-0.5 text-[10px] leading-none select-none');
    const tabs = modes.map((m) => {
      const b = el('button', 'cursor-pointer rounded-full px-1.5 py-0.5 transition-colors',
                   LABEL[m] || m);
      stops.append(b);
      return b;
    });
    const host = el('div', 'flex min-h-0 transition-[height] duration-200');
    box.append(stops, host);

    // The reading on screen is FILLED, not merely less transparent. A stop that
    // differs from its neighbours only by opacity reads as slightly clearer
    // text rather than as a selection.
    const paint = (a) => {
      tabs.forEach((b, n) => {
        b.classList.toggle('bg-base-300', n === a);
        b.classList.toggle('font-medium', n === a);
        b.classList.toggle('opacity-100', n === a);
        b.classList.toggle('opacity-45', n !== a);
      });
      tint(modes[a]);
    };

    // Only a reader's move counts as choosing this block. The initial
    // `go(start)` scrolls the track, and the deck reports that as a slide
    // change like any other, so without a guard every container announces
    // itself on mount and the strip opens saying the reader is somewhere they
    // have not been.
    //
    // The guard is the GESTURE, not a timer. A timer was tried first and is a
    // guess at how long a smooth scroll takes: 400ms held on the demo page and
    // not in the app, where a heavier layout stretched the same scroll past it
    // and the card opened on change 2 of 3. A pointer on the track cannot
    // arrive early.
    let live = false;
    const mine = () => live && box.dispatchEvent(
      new CustomEvent('md-diff:here', { bubbles: true, detail: { at: i } }));

    let deck = null, ro = null;

    // ── SWIPE: three stops on one axis ────────────────────────────────────
    function swipe() {
      // slideScroll: false hands the vertical axis to the content, and takes
      // the slide's padding with it. Both matter here: the padding is what
      // would set a changed block in from the prose around it, and a scroller
      // inside the document is a second place to drag.
      deck = window.swipeDeck.core(modes.length, (n, slide) => {
        slide.append(VIEWS[modes[n]](chg));
      }, { slideScroll: false, innerClass: 'w-full', slideClass: '' });
      host.append(deck.track);

      // The slide's own box is `h-full` under slideScroll:false, so measuring
      // it answers with the height already set. The content inside it is the
      // only box whose height is the content's.
      const fit = (a) => {
        const inner = deck.track.children[a] && deck.track.children[a].firstElementChild;
        const content = inner && inner.firstElementChild;
        if (content) host.style.height = content.scrollHeight + 'px';
      };
      deck.onSlide((a) => { paint(a); fit(a); mine(); });
      deck.track.addEventListener('pointerdown', () => { live = true; });
      tabs.forEach((b, n) => { b.onclick = () => { live = true; deck.go(n); mine(); }; });

      paint(start);
      requestAnimationFrame(() => { fit(start); if (start) deck.go(start); });
      // Highlighting and web fonts arrive after the first measurement, and a
      // table that reflows changes it again, so the height follows the content
      // rather than being read once.
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(() => fit(deck.active()));
        for (const sec of deck.track.children) {
          const content = sec.firstElementChild && sec.firstElementChild.firstElementChild;
          if (content) ro.observe(content);
        }
      }
    }

    // ── SIDE: both versions at once ───────────────────────────────────────
    // A reader who wants to compare rather than to read wants both halves in
    // view, and that is a property of the whole document rather than of one
    // block: nobody compares paragraph four side by side and paragraph nine by
    // swiping. So the layout is the document's and the stops stand down, which
    // is what keeps this from being a second control per change.
    //
    // Each column carries the version tint the swipe layout puts on the block,
    // so red and green mean the same thing in both layouts.
    function side() {
      const grid = el('div', 'w-full grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
      const cols = chg.kind === 'added' ? [['new', chg.new]]
                 : chg.kind === 'removed' ? [['old', chg.old]]
                 : [['old', chg.old], ['new', chg.new]];
      for (const [which, md] of cols) {
        const col = el('div', 'min-w-0 rounded-[3px] px-2 py-1 ring-1 '
                            + (which === 'old' ? RING.old : RING.new));
        col.append(el('div', 'text-[10px] leading-none opacity-40 pb-1', which), renderMd(md));
        grid.append(col);
      }
      host.style.height = '';
      host.append(grid);
    }

    function build(layout) {
      if (ro) { ro.disconnect(); ro = null; }
      deck = null;
      host.textContent = '';
      const paired = layout === 'side';
      stops.classList.toggle('hidden', paired);
      // In `side` the columns carry the colour, so the block itself takes the
      // neutral edge rather than claiming a version it is not showing.
      box.classList.remove(...RINGS);
      if (paired) { box.classList.add('ring-1', RING.inline); side(); }
      else swipe();
    }

    // No initial build: render() calls setLayout once for the whole document,
    // which is the one place the layout is decided.
    return { el: box, build };
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
    // gap-2 is .5rem, which is exactly the margin guide-body puts between two
    // paragraphs. Each block renders as its own guide-body, and that rule zeroes
    // the first and last child's margins, so the gap here is the ONLY thing
    // setting the document's rhythm. Anything larger and the changes read as
    // cards with air around them rather than as paragraphs.
    host.classList.add('grid', 'grid-cols-[minmax(0,1fr)]', 'gap-2');

    // A position and two arrows. It reads `2 / 3` rather than `3 changes`,
    // because the arrows put you somewhere and a count cannot say where: after
    // two taps the reader had no way to tell which change they were looking at
    // or how many were left.
    // `--md-diff-top` is the one thing a host has to tell this: how far down
    // ITS top is. A page with a sticky header of its own would otherwise have
    // the strip slide underneath it and disappear, which is the state a reader
    // reported as the nav not surviving a scroll. Default 0, for a host with
    // no header.
    const strip = el('div', 'sticky z-20 flex items-center gap-3 py-1 text-[11px] '
                          + 'leading-none bg-base-100/85 backdrop-blur');
    strip.style.top = 'var(--md-diff-top, 0px)';
    const where = el('span', 'opacity-40 tabular-nums');
    // THE LAYOUT IS THE DOCUMENT'S, not each change's. Comparing and reading
    // are two ways of going through a document, and a reader doing one is
    // doing it to all of it: nobody compares paragraph four in two columns and
    // paragraph nine by swiping. One toggle here, and every change follows it,
    // which is what keeps a second control off every block.
    const lay = el('div', 'flex items-center gap-0.5 rounded-full border border-base-300 '
                        + 'px-0.5 py-0.5 select-none');
    const layBtns = ['swipe', 'side'].map((k) => {
      const b = el('button', 'cursor-pointer rounded-full px-1.5 py-0.5 transition-colors', k);
      b.dataset.layout = k;
      lay.append(b);
      return b;
    });
    const prev = el('button', 'cursor-pointer opacity-40 hover:opacity-80 transition-opacity', '←');
    const next = el('button', 'cursor-pointer opacity-40 hover:opacity-80 transition-opacity', '→');
    strip.append(where, el('div', 'grow'), lay, prev, next);
    if (changed.length && opts.strip !== false) host.append(strip);

    const boxes = [];
    for (const s of seq) {
      if (s.kind === 'same') { host.append(renderMd(s.new)); continue; }
      const c = container(s, boxes.length, changed.length);
      boxes.push(c);
      host.append(c.el);
    }

    let layout = opts.layout === 'side' ? 'side' : 'swipe';
    const setLayout = (k) => {
      layout = k;
      layBtns.forEach((b) => {
        const on = b.dataset.layout === k;
        b.classList.toggle('bg-base-300', on);
        b.classList.toggle('font-medium', on);
        b.classList.toggle('opacity-100', on);
        b.classList.toggle('opacity-45', !on);
      });
      boxes.forEach((b) => b.build(k));
    };
    layBtns.forEach((b) => { b.onclick = () => setLayout(b.dataset.layout); });

    // ONE SELECTION, THREE WAYS IN. A container says `md-diff:here` when the
    // reader taps a stop or swipes it; the arrows set the same thing. So the
    // strip always names the block the reader is working in, whether they got
    // there by scrolling and swiping or by tapping an arrow.
    //
    // Selection is the BACKGROUND, because the outline now carries the version.
    // The two facts need two channels: a reader working in a block still has
    // to be able to see which version that block is showing, so selection
    // cannot take the edge the version is using.
    const SEL = 'bg-primary/10';
    let ci = -1;
    const mark = () => {
      boxes.forEach((b, n) => b.el.classList.toggle(SEL, n === ci));
      where.textContent = !changed.length ? 'no changes'
        : ci < 0 ? `${changed.length} change${changed.length > 1 ? 's' : ''}`
        : `${ci + 1} / ${changed.length}`;
    };
    host.addEventListener('md-diff:here', (e) => {
      const at = e.detail && e.detail.at;
      if (typeof at === 'number' && at !== ci) { ci = at; mark(); }
    });
    const goto = (i) => {
      if (!boxes.length) return;
      ci = (i + boxes.length) % boxes.length;
      mark();
      boxes[ci].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    prev.onclick = () => goto(ci - 1);
    next.onclick = () => goto(ci + 1);
    setLayout(layout);
    mark();

    return { count: changed.length, goto, next: () => goto(ci + 1), prev: () => goto(ci - 1),
             setLayout, get layout() { return layout; } };
  }

  window.mdDiff = { blocks, align, changes, runs, mark, render, _textOf: textOf };
})();
