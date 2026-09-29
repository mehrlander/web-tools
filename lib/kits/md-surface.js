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
//   MdSurface.paint(host, { text, interim, range, armed, handles, overlay, reach, caret })
//                                    caret: the caret's color, red by default
//   MdSurface.offsetAt(host, x, y)   -> offset into text, or null off the text
//   MdSurface.offsetOf(host, node, off, side) / domPoint(host, i, side)
//                                    a Selection's end as an offset, and back
//   MdSurface.rectAt(host, i)        -> the caret's client rect at offset i
//   MdSurface.step(host, i, dir)     -> the offset one arrow key away, markup skipped
//   MdSurface.hitsText(host, x, y)   -> is the point on rendered text
//   MdSurface.tidy / backspace / enter  the rules for typing into the render
//   MdSurface.changes(base, text)    what the marks draw: inserted runs, removals
//   MdSurface.patch(path, base, text)  the edit as a unified diff git applies
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

  // A fence's language tag is text the source does not hold in that place.
  // Mapped, its search would run ahead to a later match and every node after
  // it would go unstamped, so it is set aside for the mapping and put back.
  const map = (root, text, from, skip) => {
    const tags = [...root.querySelectorAll('.md-fence-lang')].map((t) => [t, t.parentNode]);
    for (const [t] of tags) t.remove();
    window.Standoff.mapText(root, text, from, skip ? { skip } : {});
    for (const [t, p] of tags) p.appendChild(t);
  };

  const render = (host, text) => {
    host.innerHTML = window.mdDoc.html(text, { proseClass: '' });
    map(host, text, 0);
    host.__cards = [];
  };

  // ── TRACKED: the edit as cards in the document ───────────────────────────
  // With a base, each paragraph that differs from it is drawn as a CARD in the
  // flow; unchanged blocks render as ordinary text. A card is one paragraph
  // unless a join or a split ties paragraphs together, and then it holds every
  // paragraph taking part: the original ones in `old`, the new ones in `inline`
  // and `new` (groupsOf). Two neighbouring paragraphs edited apart are two cards.
  //
  // A card has up to three readings, named on its stops pill in order, and
  // every one but `old` takes the caret:
  //
  //   old      the base's text for the whole run, read-only.
  //   inline   the default: the new text with the change laid over it, removed
  //            words struck in place (a <del>, never mapped, so the caret
  //            skips it), added words washed green, and a block taken out
  //            struck whole. Typing here is typing in the buffer.
  //   new      the new text, clean. Typing here is typing in the buffer too.
  //
  // A run with both sides has all three; one that only removes has old and
  // inline; one that only adds has inline alone, and no pill (cardModes).
  //
  // A card's reading is host.__readings[key], keyed by where the run starts
  // in the BASE, which editing never moves, so an edit that adds or removes a
  // card elsewhere does not hand one card's reading to its neighbour; a run
  // with no base text falls back to its number. An edit forgets every `old`
  // and keeps every `new`: `old` is a look back and the caret cannot enter
  // it, while `new` is a way of reading the text being typed.
  //
  // Cards carry data-md-card=<i>; the number is a button with
  // data-md-card-badge, which a host may read as "select this card", each stop a button with data-md-card-read="<i>:<mode>",
  // and every control is data-md-ui so a host's gestures can tell a control
  // from the text. host.__cards[i] is that card's entries.
  //
  // THE ACTIONS PILL (o.cardActions, optional): the host's words for what a
  // card can do, [{ act, text, title?, cls? }], drawn as one pill centred on
  // each card's bottom edge with data-md-card-bar=<i>, each word a button
  // with data-md-card-act=<act>. It is born `invisible opacity-0 scale-75`
  // and the host takes those three off the one for the card it has selected. Being in the card, it scrolls
  // with the text; a pill drawn over the page had to be moved on every
  // scroll, and lagged.
  //
  // Every pill, top and bottom, is 22px tall with 13px words: the padding is
  // what was cut to fit them. The ones on the top edge straddle it by half.
  const CARD = 'relative my-3 rounded-[4px] border bg-base-200/30 px-2 pt-4 pb-1';
  const PILL = 'absolute -top-[11px] z-10 flex items-center rounded-full border border-base-300 '
             + 'bg-base-100 text-[13px] leading-none select-none';
  const GONE = 'bg-error/10 rounded-[3px] line-through decoration-[var(--color-error)] opacity-80';
  // The Changes view's hues (kits/md-diff.js), one per reading, as class
  // builders so the colour stays a Tailwind utility.
  const HUE = { old: '--color-error', new: '--color-success', inline: '--color-base-content' };
  const MIX = (v, pct) => `color-mix(in_oklab,var(${v})_${pct}%,transparent)`;
  const EDGE = (v, pct) => `border-[${MIX(v, pct)}]`;
  const TXT = (v) => `text-[${MIX(v, 85)}]`;
  const FILL = (v) => `bg-[${MIX(v, 20)}]`;
  // A touch swap slides and a pointer swap does not: a click is not a gesture,
  // and the Changes view settled the same question the same way.
  const quick = (win) => {
    try { return !win.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches
                 || win.matchMedia('(pointer: fine)').matches; } catch { return true; }
  };
  const modesOf = (r) => {
    const hasOld = r.some((e) => e.oldRange), hasNew = r.some((e) => e.newRange);
    return hasOld && hasNew ? ['old', 'inline', 'new'] : hasOld ? ['old', 'inline'] : ['inline'];
  };
  const keyOf = (r, i) => { const e = r.find((x) => x.oldRange); return e ? 'o' + e.oldRange.start : 'a' + i; };
  // ── Paragraph breaks, which a word diff cannot see ──────────────────────
  // The marks come from the card's words, and the words of two paragraphs
  // joined are the words of the two paragraphs: a join, or a paragraph carried
  // onto the end of another, changed the document and marked nothing. So the
  // BREAKS are compared on their own, by word position. The words either side
  // of each old break are followed through a word-array diff; a break whose
  // two neighbours survive side by side with no break between them now was
  // closed, and a break between two words that sat together before was
  // opened. The seam below draws both.
  const words = (s) => s.split(/\s+/).filter(Boolean);
  // The texts' words laid end to end, each remembered as [block, word], and
  // which old word survived as which new one.
  const wordMatch = (oldTexts, newTexts) => {
    if (!window.Diff || !window.Diff.diffArrays) return null;
    const flat = (texts) => {
      const w = [], starts = new Set(), at = [], size = [];
      texts.forEach((t, k) => {
        const ws = words(t);
        if (w.length && ws.length) starts.add(w.length);
        ws.forEach((_, n) => at.push([k, n]));
        size.push(ws.length);
        w.push(...ws);
      });
      return { w, starts, at, size };
    };
    const O = flat(oldTexts), N = flat(newTexts);
    const o2n = new Map(), n2o = new Map();
    let i = 0, j = 0;
    for (const part of window.Diff.diffArrays(O.w, N.w)) {
      const len = part.count ?? part.value.length;
      if (part.added) j += len;
      else if (part.removed) i += len;
      else for (let k = 0; k < len; k++) { o2n.set(i, j); n2o.set(j, i); i++; j++; }
    }
    return { O, N, o2n, n2o };
  };
  // closed: { k, n }, the n-th word of new block k ended an old paragraph and
  //   the block now runs on past it.
  // opened: { k, ok, on }, new block k ends where old block ok ran on, and
  //   that block's word `on` begins what is now the next paragraph.
  const breaksOf = (oldTexts, newTexts) => {
    const out = { closed: [], opened: [] };
    const M = wordMatch(oldTexts, newTexts);
    if (!M) return out;
    const { O, N, o2n, n2o } = M;
    // Closed: the words either side of an old break now run on with no break
    // between them. One neighbour surviving is enough to anchor it, since the
    // edit after a join is usually to the other one (the capital after the
    // old break coming down, or the first word going): the struck ¶ goes
    // after the new word that ends where the old paragraph ended.
    for (const b of O.starts) {
      const jb = o2n.get(b), ja = o2n.get(b - 1);
      let left;
      if (ja != null && jb != null) left = jb === ja + 1 ? ja : null;
      else if (ja != null) left = ja;
      else if (jb != null) left = jb - 1;
      else left = null;
      if (left == null || left < 0 || left + 1 >= N.w.length || N.starts.has(left + 1)) continue;
      const [k, n] = N.at[left];
      if (N.at[left + 1][0] !== k) continue;
      out.closed.push({ k, n });
    }
    // Opened: new words j-1 and j came from adjacent old words with no break.
    for (const jb of N.starts) {
      const ib = n2o.get(jb), ia = n2o.get(jb - 1);
      if (ib == null || ia !== ib - 1 || O.starts.has(ib)) continue;
      const [ok, on] = O.at[ib];
      out.opened.push({ k: N.at[jb - 1][0], ok, on });
    }
    return out;
  };
  // THE SEAM: where the other reading has a break, a gray bar stands in the
  // text at the first word after it, one line tall, so the reader sees where
  // one paragraph ended and the next began. It goes in whichever reading has
  // fewer paragraphs, and only there: `inline` and `new` for a join, `old`
  // for a split; a reading that shows the break needs no mark. The word is
  // wrapped in an inline-block exactly one line tall, and the bar is its
  // child, drawn as a background rather than a border, since a zero-width box
  // bordered on one side went unpainted on a phone. A join's bar in `inline`
  // carries data-md-break="closed", a split's in `old` "opened"; the bar has
  // no text, so counting them never touches the words.
  const SEAM = 'pointer-events-none absolute top-[0.2em] bottom-[0.2em] -left-[4px] w-[2px] rounded-full bg-base-content/35';
  const seamAt = (body, n, brk) => {
    const doc = body.ownerDocument;
    const walker = doc.createTreeWalker(body, 4);
    let t, k = -1, gap = true;
    while ((t = walker.nextNode())) {
      if (t.parentElement && t.parentElement.closest('del, [data-md-ui]')) continue;
      const s = t.data;
      for (let x = 0; x < s.length; x++) {
        const ws = /\s/.test(s[x]);
        if (!ws && gap && ++k === n) {
          let e = x;
          while (e < s.length && !/\s/.test(s[e])) e++;
          const word = x ? t.splitText(x) : t;
          if (e - x < word.length) word.splitText(e - x);
          const box = doc.createElement('span');
          box.className = 'relative inline-block';
          box.dataset.mdSeam = '';
          word.parentNode.insertBefore(box, word);
          box.appendChild(word);
          const bar = box.appendChild(doc.createElement('span'));
          bar.className = SEAM;
          bar.dataset.mdUi = '';
          bar.setAttribute('aria-hidden', 'true');
          if (brk) box.children[0].dataset.mdBreak = brk;
          return box;
        }
        gap = ws;
      }
    }
    return null;
  };
  // ONE CARD PER PARAGRAPH, UNLESS A JOIN OR A SPLIT TIES SEVERAL TOGETHER.
  // mdDiff.align pairs blocks one to one, so a join comes back as a changed
  // pair and a removal, and a split as a changed pair and an addition. What
  // ties them is shared words: an original paragraph whose words went into a
  // new one is linked to it, and a card is one set of linked paragraphs. A
  // link needs a fifth of the smaller paragraph's words, since a lone "the"
  // matches across two long paragraphs rewritten side by side.
  // A card must also be a contiguous stretch of both texts, which is what
  // reverting it swaps back, and cards must stand in the same order in both,
  // or each goes back in place and the pair stays swapped. So groups that
  // interleave or cross are merged.
  const groupsOf = (run) => {
    if (run.length < 2) return [run];
    const textOf = window.mdDiff._textOf;
    const olds = run.map((e, x) => (e.oldRange ? x : -1)).filter((x) => x >= 0)
      .sort((x, y) => run[x].oldRange.start - run[y].oldRange.start);
    const news = run.map((e, x) => (e.newRange ? x : -1)).filter((x) => x >= 0);
    const up = run.map((_, x) => x);
    const find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
    const tie = (x, y) => { up[find(x)] = find(y); };
    let M = null;
    try { M = wordMatch(olds.map((x) => textOf(run[x].old)), news.map((x) => textOf(run[x].new))); } catch {}
    if (M) {
      const count = new Map();
      for (const [i, j] of M.o2n) {
        const key = M.O.at[i][0] + ':' + M.N.at[j][0];
        count.set(key, (count.get(key) || 0) + 1);
      }
      for (const [key, c] of count) {
        const [a, b] = key.split(':').map(Number);
        const small = Math.min(M.O.size[a], M.N.size[b]);
        if (c >= Math.ceil(small / 5)) tie(olds[a], news[b]);
      }
    }
    const rank = new Map(olds.map((x, r) => [x, r]));
    for (let merged = true; merged;) {
      merged = false;
      const span = new Map();
      run.forEach((_, x) => {
        const g = find(x), s = span.get(g) || { lo: x, hi: x, olo: Infinity, ohi: -Infinity };
        s.lo = Math.min(s.lo, x); s.hi = Math.max(s.hi, x);
        if (rank.has(x)) { s.olo = Math.min(s.olo, rank.get(x)); s.ohi = Math.max(s.ohi, rank.get(x)); }
        span.set(g, s);
      });
      const gs = [...span.entries()];
      for (let p = 0; p < gs.length && !merged; p++) for (let q = p + 1; q < gs.length && !merged; q++) {
        const [g, a] = gs[p], [h, b] = gs[q];
        const meet = (a.lo <= b.hi && b.lo <= a.hi) || (a.olo <= b.ohi && b.olo <= a.ohi);
        const cross = a.ohi >= 0 && b.ohi >= 0 && (a.hi < b.lo) !== (a.ohi < b.olo);
        if (meet || cross) { tie(g, h); merged = true; }
      }
    }
    const out = [];
    let cur = null, last = null;
    run.forEach((e, x) => {
      const g = find(x);
      if (g !== last) out.push(cur = []);
      cur.push(e);
      last = g;
    });
    return out;
  };
  const renderTracked = (host, text, base, actions) => {
    const doc = host.ownerDocument;
    const readings = host.__readings || (host.__readings = {});
    host.innerHTML = '';
    const runs = [];
    let run = null;
    for (const e of window.mdDiff.align(base, text)) {
      if (e.kind === 'same') { run = null; runs.push(e); continue; }
      if (!run) runs.push(run = []);
      run.push(e);
    }
    for (let x = runs.length - 1; x >= 0; x--) if (Array.isArray(runs[x])) runs.splice(x, 1, ...groupsOf(runs[x]));
    const cards = [], keys = [];
    for (const r of runs) {
      const wrap = doc.createElement('div');
      if (!Array.isArray(r)) {
        wrap.innerHTML = window.mdDoc.html(text.slice(r.newRange.start, r.newRange.end), { proseClass: '' });
        map(wrap, text, r.newRange.start);
        host.appendChild(wrap);
        continue;
      }
      const i = cards.length;
      cards.push(r);
      keys.push(keyOf(r, i));
      const modes = modesOf(r);
      const mode = modes.includes(readings[keys[i]]) ? readings[keys[i]] : 'inline';
      // THE CARD'S EDGE SAYS WHICH READING IS ON SCREEN, in the Changes view's
      // vocabulary (kits/md-diff.js): red for the original, green for the new
      // text, neutral for the marked reading, whose marks carry the colour. A
      // run that only adds has one reading and says green.
      const hue = (m) => (m === 'inline' && !r.some((e) => e.oldRange) ? HUE.new : HUE[m]);
      const stopCls = (m, on) => 'rounded-full px-2 py-[1.5px] cursor-pointer ' + TXT(hue(m))
        + (on ? ' font-medium ' + FILL(hue(m)) : ' opacity-60');
      // The edge and the lit stop together, for the reading `m`. Called as the
      // track moves, not only when it settles: the reading under the finger is
      // lit at once, and the settle that follows only makes it stick.
      const light = (m) => {
        wrap.className = CARD + ' ' + EDGE(hue(m), m === 'inline' ? 30 : 70);
        for (const b of wrap.querySelectorAll('[data-md-card-read]')) {
          const bm = b.dataset.mdCardRead.split(':')[1];
          b.className = stopCls(bm, bm === m);
        }
      };
      wrap.className = CARD + ' ' + EDGE(hue(mode), mode === 'inline' ? 30 : 70);
      wrap.dataset.mdCard = i;
      wrap.style.touchAction = 'pan-y';           // a sideways drag is the card's, not the page's
      const badge = doc.createElement('button');
      badge.className = PILL + ' left-1 px-2.5 py-[3.5px] font-medium tabular-nums cursor-pointer';
      badge.textContent = String(i + 1);
      badge.dataset.mdCardBadge = i;
      badge.dataset.mdUi = '';
      wrap.appendChild(badge);
      if (modes.length > 1) {
        // Each stop carries its reading's hue, faint when unlit, so the pill
        // teaches the colours before it is tapped; the lit one is filled.
        const stops = doc.createElement('div');
        stops.className = PILL + ' right-1 gap-0.5 p-0.5';
        stops.dataset.mdUi = '';
        for (const m of modes) {
          const b = doc.createElement('button');
          b.className = stopCls(m, m === mode);
          b.textContent = m;
          b.dataset.mdCardRead = i + ':' + m;
          b.dataset.mdUi = '';
          stops.appendChild(b);
        }
        wrap.appendChild(stops);
      }
      if (actions && actions.length) {
        const bar = doc.createElement('div');
        // Outlined in amber, since it is the one pill that acts, on the plain
        // pill ground: a fill read as clutter. Tailwind's amber rather than the
        // theme's warning, which in the default theme is a pale beige. Born
        // scaled down, so a host showing it can let it grow in.
        bar.className = 'absolute -bottom-[11px] left-1/2 -translate-x-1/2 z-10 invisible opacity-0 scale-75 flex items-center '
          + 'rounded-full border border-amber-400 bg-base-100 '
          + 'transition-[opacity,scale] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none '
          + 'text-[13px] leading-none select-none whitespace-nowrap';
        bar.dataset.mdUi = ''; bar.dataset.mdCardBar = i;
        actions.forEach((a, k) => {
          if (k) bar.appendChild(Object.assign(doc.createElement('span'), { className: 'w-px h-3 bg-amber-300' }));
          const b = doc.createElement('button');
          b.type = 'button';
          // The words are small, so an invisible margin (::before) takes a thumb.
          b.className = "relative px-2.5 py-[3.5px] cursor-pointer before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] " + (a.cls || '');
          b.textContent = a.text; b.title = a.title || a.text; b.setAttribute('aria-label', b.title);
          b.dataset.mdCardAct = a.act; b.dataset.mdUi = '';
          bar.appendChild(b);
        });
        wrap.appendChild(bar);
      }
      // EVERY READING IS BUILT, side by side on a snap track, the house swipe
      // (kits/swipe-deck.js, the Changes view): the text follows the finger
      // and the platform settles it on a reading. The track is as tall as its
      // tallest reading, so nothing below moves when the reading changes, and
      // one height is also what lets iOS snap where it is aimed (see the note
      // in md-diff.js swipe()). Only the reading the track rests on is mapped,
      // so a source offset has one run to land in; the others carry
      // data-md-off and are left out of the blocks and the seams.
      //
      // AND THE OTHERS ARE INVISIBLE UNTIL THE TRACK MOVES. Visible, they are
      // text like any other to the platform: a selection dragged across the
      // card took all three readings and scrolled the track to the first as
      // it went. Hidden, they take no hit and no selection. The first scroll
      // shows them, so a swipe still slides the next reading in, and the
      // settle hides them again (or the repaint for a new reading does).
      //
      // The page used to decide a swipe itself, from how far a finger ended
      // up from where it went down, and a selection handle dragged sideways
      // across a card read as one. A scroll the platform runs is not confused
      // with a selection the platform runs.
      const stage = wrap.appendChild(doc.createElement('div'));
      stage.className = 'flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain'
        + ' [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
      stage.dataset.mdTrack = '';
      // The card's original blocks in the BASE's order: a run pairs its blocks
      // by shared words, so a block carried past another pairs crosswise and
      // the run lists it where it now stands, which is not where the original
      // had it. The breaks are found once, from the words of both sides, and
      // every reading draws from the same answer.
      const olds = r.filter((e) => e.oldRange).sort((x, y) => x.oldRange.start - y.oldRange.start);
      const nws = r.filter((e) => e.newRange);
      const htmlOf = (e) => window.mdDoc.html(text.slice(e.newRange.start, e.newRange.end), { proseClass: '' });
      const plain = (html) => { const d = doc.createElement('div'); d.innerHTML = html; return d.textContent; };
      const newHtml = nws.map(htmlOf), newTexts = newHtml.map(plain);
      let B = { closed: [], opened: [] };
      if (olds.length && nws.length) {
        try { B = breaksOf(olds.map((e) => window.mdDiff._textOf(e.old)), newTexts); } catch {}
      }
      for (const m of modes) {
        const live = m === mode;
        const layer = stage.appendChild(doc.createElement('div'));
        layer.className = 'w-full min-w-0 shrink-0 snap-start snap-always';
        layer.dataset.mdReading = m;
        if (!live) { layer.setAttribute('aria-hidden', 'true'); layer.dataset.mdOff = ''; layer.classList.add('invisible'); }
        if (m === 'old') {
          const bodies = olds.map((e) => {
            const body = layer.appendChild(doc.createElement('div'));
            body.innerHTML = window.mdDoc.html(e.old, { proseClass: '' });
            return body;
          });
          for (const { ok, on } of B.opened) { try { seamAt(bodies[ok], on, 'opened'); } catch {} }
          layer.dataset.mdGhost = '';
          layer.classList.add('opacity-70');
        } else if (m === 'new') {
          nws.forEach((e, k) => {
            const body = layer.appendChild(doc.createElement('div'));
            body.innerHTML = newHtml[k];
            for (const c of B.closed) if (c.k === k) { try { seamAt(body, c.n + 1); } catch {} }
            if (live) map(body, text, e.newRange.start, '[data-md-ui]');
          });
        } else if (!nws.length) {
          for (const e of r) {
            const body = layer.appendChild(doc.createElement('div'));
            body.innerHTML = window.mdDoc.html(e.old, { proseClass: '' });
            body.dataset.mdGhost = '';
            body.className = GONE;
          }
        } else {
          // The card is marked as a whole, its new blocks against its old text
          // in the base's order, not pair by pair. Pairing is by shared words,
          // so a paragraph split in two pairs the old one with whichever half
          // shares more, and marked pair by pair the other half reads as added
          // while its words are struck from the first: a move where there was
          // only a break. Marked as a whole, the break is all that differs, and
          // a block taken out beside the others is struck where it stood.
          const bodies = nws.map((e, k) => {
            const body = layer.appendChild(doc.createElement('div'));
            body.innerHTML = newHtml[k];
            return body;
          });
          const was = olds.map((e) => e.old).join('\n\n');
          try { window.mdDiff.mark(layer, window.mdDiff.runs(was ? window.mdDiff._textOf(was) : '', layer.textContent)); } catch {}
          for (const c of B.closed) { try { seamAt(bodies[c.k], c.n + 1, 'closed'); } catch {} }
          if (live) bodies.forEach((body, k) => map(body, text, nws[k].newRange.start, 'del, [data-md-ui]'));
        }
      }
      host.appendChild(wrap);
      // The track opens on the card's reading, and a scroll that comes to
      // rest on another one names it: a `md-card-reading` event on the host,
      // { i, mode }, for the page to set and repaint. Settled by a quiet
      // spell rather than `scrollend`, which iOS Safari does not fire, and
      // never while a finger is still down: a drag that pauses goes quiet
      // too, and the repaint would rebuild the card under the finger.
      const at = modes.indexOf(mode);
      let quiet = null, held = false, shown = false, lit = mode;
      // AND AGAIN ONCE THE STYLES LAND. Tailwind's browser build writes the
      // CSS for a class the first time it sees it, a frame or so after the
      // node goes in, and until then the track is not a scroller at all: the
      // position set here was dropped, and the first card of a session opened
      // on `old` while `inline` took the caret. So it is set again on the
      // next frames and once more a little later, unless a finger has taken
      // the track in the meantime.
      // Only while the position is the one dropped (still at the start) and
      // nothing has asked the track to go anywhere since: a finger, or a
      // stop tapped (showReading marks the track).
      const open = () => {
        if (!held && !shown && !stage.__asked && at > 0 && stage.scrollLeft < 1) stage.scrollLeft = at * stage.clientWidth;
      };
      open();
      const win = doc.defaultView;
      const raf = win.requestAnimationFrame ? (f) => win.requestAnimationFrame(f) : (f) => win.setTimeout(f, 16);
      raf(() => { open(); raf(open); });
      win.setTimeout(open, 150);
      const others = (hide) => { shown = !hide; for (const l of stage.querySelectorAll('[data-md-off]')) l.classList.toggle('invisible', hide); };
      // THE RELEASE GLIDES, SHORT. The platform's snap after a finger lifts
      // coasts for half a second or more on iOS, with no way to shorten it,
      // and the reading was taken only after that and a quiet spell, so a
      // quick second swipe fell into the tail. On a touch release the track
      // is therefore taken off the platform (overflow and snap off inline,
      // which also stops the coasting) and eased to the reading the finger
      // was heading for in GLIDE ms, and the reading is taken on landing.
      // A flick counts in its direction; a slow drag goes to the nearer
      // reading. Inline styles, since a class Tailwind has not yet seen has
      // no CSS for a frame.
      const GLIDE = 160;
      let from0 = 0, vx = 0, last = null, gliding = false;
      const take = (k) => {
        clearTimeout(quiet);
        if (modes[k] !== lit) light(lit = modes[k]);
        if (modes[k] !== mode) host.dispatchEvent(new doc.defaultView.CustomEvent('md-card-reading', { detail: { i, mode: modes[k] } }));
        else others(true);
      };
      const glide = () => {
        const w = stage.clientWidth, x0 = stage.scrollLeft;
        if (!w) return false;
        const base = Math.round(from0 / w), d = x0 / w - base;
        const fling = Math.abs(vx) > 0.3 ? Math.sign(vx) : 0;
        let k = fling && Math.sign(d) === fling && Math.abs(d) > 0.06 ? base + fling : Math.round(x0 / w);
        k = Math.max(0, Math.min(modes.length - 1, k));
        const x1 = k * w;
        if (Math.abs(x1 - x0) < 1) return false;
        gliding = true;
        stage.style.overflowX = 'hidden'; stage.style.scrollSnapType = 'none';
        const t0 = win.performance.now();
        const step = (now) => {
          if (!gliding) return;
          const p = Math.min(1, (now - t0) / GLIDE), e = 1 - Math.pow(1 - p, 3);
          stage.scrollLeft = x0 + (x1 - x0) * e;
          if (p < 1) { raf(step); return; }
          gliding = false; stage.style.overflowX = ''; stage.style.scrollSnapType = '';
          take(k);
        };
        raf(step);
        return true;
      };
      const settle = () => {
        if (held && stage.clientWidth) {
          const now = win.performance.now(), x = stage.scrollLeft;
          if (last && now - last.t > 0) vx = 0.6 * ((x - last.x) / (now - last.t)) + 0.4 * vx;
          last = { x, t: now };
        }
        if (gliding) return;
        // Not for the track's own opening scroll to its reading.
        if (!shown && (held || Math.abs(stage.scrollLeft - at * stage.clientWidth) > 1)) others(false);
        const w0 = stage.clientWidth;
        if (w0) {
          const k0 = Math.max(0, Math.min(modes.length - 1, Math.round(stage.scrollLeft / w0)));
          if (modes[k0] !== lit) light(lit = modes[k0]);
        }
        clearTimeout(quiet);
        quiet = setTimeout(() => {
          const w = stage.clientWidth;
          if (held || gliding || !w) return;
          take(Math.max(0, Math.min(modes.length - 1, Math.round(stage.scrollLeft / w))));
        }, 90);
      };
      stage.addEventListener('scroll', settle, { passive: true });
      // A finger landing mid-glide takes the track back where it is.
      stage.addEventListener('touchstart', () => {
        held = true; vx = 0; last = null;
        if (gliding) { gliding = false; stage.style.overflowX = ''; stage.style.scrollSnapType = ''; }
        from0 = stage.scrollLeft;
      }, { passive: true });
      stage.addEventListener('touchend', () => { held = false; if (!glide()) settle(); }, { passive: true });
      stage.addEventListener('touchcancel', () => { held = false; settle(); }, { passive: true });
    }
    host.__cards = cards;
    host.__cardKeys = keys;
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
    // At a node's very start a collapsed range reports nothing in some engines,
    // and in Chrome it can report the END OF THE LINE BEFORE: measured
    // 2026-09-24 at the start of an h2, whose caret came back on the previous
    // paragraph's last line. The first character's box has the right left edge
    // and the right line, so it is asked first there.
    const rs = p.offset === 0 && p.node.length ? [] : r.getClientRects();
    if (rs.length) return rs[rs.length - 1];
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
    // Re-rendered only when what it draws changes: the text, and when tracking,
    // the base and the card readings. A scroll or a tap repaints the overlay.
    const track = !!(o.track && o.base != null && o.base !== text && window.mdDiff && window.Diff);
    if (host.__mdText !== text && host.__readings) {    // an edit ends every look back
      for (const k of Object.keys(host.__readings)) if (host.__readings[k] === 'old') delete host.__readings[k];
    }
    const key = text + '\u0000' + (track ? o.base + '\u0000' + JSON.stringify(host.__readings || {}) : '');
    if (host.__mdKey !== key) {
      // THE HEIGHT IS HELD WHILE THE BLOCKS ARE REBUILT. The rebuild empties
      // the host first, and anything that reads layout mid-rebuild (a card's
      // track measuring its width) lays out a document one screen tall, so
      // the scroller holding it clamps its scroll to the top and stays there.
      // Settling a card's swipe rebuilds, and sent the reader to the top.
      const hold = host.offsetHeight;
      if (hold) host.style.minHeight = hold + 'px';
      if (track) renderTracked(host, text, o.base, o.cardActions); else render(host, text);
      host.style.minHeight = '';
      host.__mdKey = key; host.__mdText = text; host.__index = null;
    }
    const r = o.range;
    host.__range = r || null;
    // The caret pulses as the Source face's does; the rule lives with it.
    if (window.Dictate && window.Dictate.caretStyle) window.Dictate.caretStyle(doc);

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

    // `selection: false` leaves the range to the platform's own highlight.
    const sel = r && r.start !== r.end && o.selection !== false ? rangeRects(host, r.start, r.end) : [];
    for (const x of sel) {
      if (!visible(x)) continue;
      mk('sel', at(x) + 'width:' + Math.round(x.width) + 'px;height:' + Math.round(x.height) + 'px;'
        + 'background:rgba(96,165,250,0.35);border-radius:2px;');
    }

    const end = r ? r.end : text.length;
    const c = caretRect(host, r && r.start === r.end ? r.start : end);
    if (c && visible(c) && (!r || r.start === r.end)) {
      const cw = o.caretWidth || 2;
      mk('caret', at(c) + 'width:' + cw + 'px;height:' + Math.round(c.height) + 'px;margin-left:' + (-cw / 2) + 'px;background:' + (o.caret || '#dc2626') + ';');
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

  // ONE ARROW KEY'S WORTH OF CARET TRAVEL, in source offsets. The source holds
  // markup the reader cannot see, so a step of one character can land inside a
  // `**` and look like a key press that did nothing. Inside a stamped run a step
  // is one character; at a run's edge it crosses the gap to the next run, and
  // spends a character on the far side when the two edges are the same place
  // on screen (inline markup), not when they differ (a block boundary).
  const step = (host, at, dir) => {
    const ix = index(host);
    if (!ix.length) return at;
    let lo = 0, hi = ix.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ix[mid].s <= at) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    const end = (x) => x.s + x.n.length;
    const same = (a, b) => {
      const x = caretRect(host, a), y = caretRect(host, b);
      return !!(x && y && Math.abs(x.top - y.top) < 2 && Math.abs(x.left - y.left) < 2);
    };
    if (dir > 0) {
      if (k >= 0 && at < end(ix[k])) return at + 1;
      const nx = ix[k + 1];
      if (!nx) return at;
      return same(at, nx.s) ? Math.min(nx.s + 1, end(nx)) : nx.s;
    }
    if (k >= 0 && at > ix[k].s && at <= end(ix[k])) return at - 1;
    const pv = k >= 0 && at > end(ix[k]) ? ix[k] : ix[k - 1];
    if (!pv) return k >= 0 ? ix[k].s : at;
    return same(at, end(pv)) ? Math.max(pv.s, end(pv) - 1) : end(pv);
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
  // A SELECTION'S END as an offset into the source. Not offsetAt's rule,
  // which answers where a TAP lands: a Selection hands back boundary points,
  // often (element, k), the point before child k, and which side of the gap
  // between two runs it means depends on which end it is. A start takes the
  // first run at or after the point, an end the last run before it, so a
  // selection dragged into the gap between two paragraphs stops at the first
  // one's last word and takes nothing of the next.
  const offsetOf = (host, node, off, side = 'end') => {
    if (!node || !host.contains(node)) return null;
    if (node.nodeType === 3) {
      const sp = node.parentElement && node.parentElement.closest('[data-src]');
      if (sp && sp.firstChild === node) return +sp.dataset.src + off;
    }
    const at = host.ownerDocument.createRange();
    try { at.setStart(node, off); } catch { return null; }
    const ix = index(host);
    if (!ix.length) return 0;
    if (side === 'start') {
      for (const x of ix) if (at.comparePoint(x.n, 0) >= 0) return x.s;
      const z = ix[ix.length - 1];
      return z.s + z.n.length;
    }
    let best = null;
    for (const x of ix) { if (at.comparePoint(x.n, x.n.length) <= 0) best = x; else break; }
    return best ? best.s + best.n.length : ix[0].s;
  };
  // The inverse, for writing a range into the platform's Selection. An offset
  // on markup belongs to no run: an end takes the run before it, a start the
  // run after, so a range the page sets on `## ` or `**` covers the words it
  // names and not the gap before them.
  const domPoint = (host, at, side = 'end') => {
    const p = pointAt(host, at);
    if (side !== 'start') return p;
    const ix = index(host);
    const k = p ? ix.findIndex((x) => x.n === p.node) : -1;
    if (p && !(k >= 0 && at > ix[k].s + ix[k].n.length)) return p;
    const nx = ix[k + 1];
    return nx ? { node: nx.n, offset: 0 } : p;
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
  // many blank lines stood between, with one space where the break was: the
  // words either side were never one word, and gluing them ("end.Start") was
  // what this did until 2026-09-27.
  const backspace = (text, c) => {
    const L = lineAt(text, c);
    if (L.marker && c === L.ls + L.marker.length) {
      return { text: text.slice(0, L.ls) + text.slice(L.ls + L.marker.length), caret: L.ls };
    }
    if (c === L.ls && c > 0) {
      let a = c;
      while (a > 0 && text[a - 1] === '\n') a--;
      const sp = a > 0 && /\S/.test(text[a - 1]) && /\S/.test(text[c] || '') ? ' ' : '';
      return { text: text.slice(0, a) + sp + text.slice(c), caret: a + sp.length };
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

  // ── The edit as a patch ─────────────────────────────────────────────────
  // A unified diff git can apply: `git apply` from the repository root, or
  // `patch -p1`. jsdiff's separator line is dropped and git's header added.
  const patch = (path, base, text) => {
    if (!window.Diff || base === text) return '';
    const body = window.Diff.createTwoFilesPatch('a/' + path, 'b/' + path, base, text)
      .split('\n').filter((l) => !/^=+$/.test(l)).join('\n');
    return 'diff --git a/' + path + ' b/' + path + '\n' + body;
  };

  const removals = (host) => (host.__chg ? host.__chg.del : []);
  // Which reading card i shows, 'inline' or 'old'; the next paint redraws it.
  const cardModes = (host, i) => ((host.__cards || [])[i] ? modesOf(host.__cards[i]) : []);
  const setReading = (host, i, mode) => {
    const modes = cardModes(host, i);
    if (!modes.includes(mode)) return;
    const k = host.__cardKeys[i], readings = (host.__readings ||= {});
    if (mode === 'inline') delete readings[k]; else readings[k] = mode;
  };
  // A reading chosen by a tap on its stop is SCROLLED to, so it arrives the
  // way a swipe does; the settled scroll then sets it (md-card-reading).
  // Instant under a mouse or reduced motion (quick()). Returns false where
  // there is no track to scroll, and the caller sets the reading directly.
  const showReading = (host, i, mode) => {
    const modes = cardModes(host, i), stage = host.querySelector('[data-md-card="' + i + '"] [data-md-track]');
    if (!stage || !modes.includes(mode) || !stage.clientWidth) return false;
    stage.__asked = true;
    stage.scrollTo({ left: modes.indexOf(mode) * stage.clientWidth, behavior: quick(host.ownerDocument.defaultView) ? 'instant' : 'smooth' });
    return true;
  };
  const readingOf = (host, i) => {
    const m = (host.__readings || {})[(host.__cardKeys || [])[i]];
    return cardModes(host, i).includes(m) ? m : 'inline';
  };
  const cards = (host) => host.__cards || [];

  // ── The document's paragraphs, and the seams between them ────────────────
  // The top-level blocks ON SCREEN, in order, each with the source span its
  // text covers: a card's reading that is showing counts, the readings behind
  // it and the ghosts of removed text do not. A block with no mapped text (a
  // rule) is left out, since nothing in it can be joined or aimed at.
  const TOP = 'p,h1,h2,h3,h4,h5,h6,ul,ol,pre,blockquote,table';
  const blocks = (host) => {
    const out = [];
    for (const el of host.querySelectorAll(TOP)) {
      if (el.parentElement && el.parentElement.closest(TOP)) continue;
      if (el.closest('[data-md-ghost], [data-md-off]')) continue;
      const spans = el.querySelectorAll('[data-src]');
      if (!spans.length) continue;
      const last = spans[spans.length - 1];
      out.push({ el, tag: el.tagName.toLowerCase(), start: +spans[0].dataset.src,
                 end: +last.dataset.src + last.textContent.length });
    }
    return out;
  };
  // A SEAM is the paragraph break between two neighbouring blocks: `at` is
  // where the break begins in the source, `top` and `bottom` the gap on
  // screen, and `join` says whether both sides are paragraphs, the one case
  // where closing the break leaves the markdown meaning what it looks like.
  const seams = (host) => {
    const text = host.__mdText || '', bs = blocks(host), out = [];
    for (let k = 1; k < bs.length; k++) {
      const a = bs[k - 1], b = bs[k];
      const m = /\n[^\S\n]*\n/.exec(text.slice(a.end, b.start));
      if (!m) continue;
      const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
      out.push({ at: a.end + m.index, top: ra.bottom, bottom: rb.top,
                 join: a.tag === 'p' && b.tag === 'p', a, b });
    }
    return out;
  };
  window.MdSurface = { paint, offsetAt, offsetOf, domPoint, rects: rangeRects, hitsText, step, rectAt: caretRect, tidy, backspace, enter, lineAt, changes, removals, setReading, showReading, readingOf, cardModes, cards, blocks, seams,
                       patch, _pointAt: pointAt };
})();
