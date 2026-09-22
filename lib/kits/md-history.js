// kits/md-history.js — a markdown document read WITH the history of its
// passages: what each one used to say, and what was proposed along the way.
//
// The collection's third file, revisions.jsonl, says one passage became another
// in a commit at a path. For each block of the open document whose text some
// revision led INTO, this kit composes a second copy of the file with the
// block's predecessor substituted and hands both to kits/md-diff.js, so the
// paragraph is a swipeable container between what it said and what it says.
// Under it, the chain: each earlier text, the commit that changed it, and the
// proposals that were made against it. The join is exact, on the block's
// text with whitespace flattened, the same rule md-proposals uses.
//
//   mdHistory.plan(md, index)               -> { blocks, count }
//   mdHistory.compose(md, plan)             -> the markdown with predecessors in place
//   mdHistory.render(host, md, index, opts) -> md-diff's handle, plus `plan`
//   mdHistory.index({ token })              -> the collection, loaded
//
// READ-ONLY, like every reader of the collection.
(() => {
  if (window.mdHistory) return;

  const HOME = { repo: 'mehrlander/home', ref: 'main' };
  const LAB = 'https://mehrlander.github.io/web-tools/pages/text-lab.html';
  const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const load = (n) => (window.gh ? window.gh.load(n).catch(() => {}) : Promise.resolve());
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // Every passage id that some revision leads into, keyed by flattened text.
  const tables = new WeakMap();
  function table(index) {
    let m = tables.get(index);
    if (m) return m;
    m = new Map();
    for (const r of index.revisions || []) {
      const key = flat(index.passages?.[r.to]);
      if (key && !m.has(key)) m.set(key, r.to);
    }
    tables.set(index, m);
    return m;
  }

  // Which blocks of `md` have a history, in document order, each with its
  // chain (newest first, the block's own text as step 0).
  function plan(md, index) {
    const T = window.TextCollection;
    if (!T || !window.mdDiff) throw new Error('mdHistory.plan needs mdDiff and TextCollection');
    const ids = table(index);
    const blocks = [];
    for (const block of window.mdDiff.blocks(md)) {
      const id = ids.get(flat(block.text));
      if (!id) continue;
      const chain = T.chain(index, id);
      if (chain.length < 2) continue;
      blocks.push({ block, chain });
    }
    return { blocks, count: blocks.length };
  }

  // The document with each planned block replaced by its predecessor: the
  // text one revision back. Offsets are md-diff's, measured on the
  // CRLF-normalised text, and the block's indentation and trailing newline
  // are kept, as md-proposals does.
  function compose(md, planned) {
    let src = String(md ?? '').replace(/\r\n?/g, '\n');
    const sorted = [...planned.blocks].sort((a, b) => b.block.start - a.block.start);
    for (const b of sorted) {
      const previous = b.chain[1]?.text;
      if (previous == null) continue;
      let { start, end } = b.block;
      const lead = /^\s*/.exec(src.slice(start, end))[0].length;
      start += lead;
      while (end > start && /\s/.test(src[end - 1])) end--;
      src = src.slice(0, start) + previous + src.slice(end);
    }
    return src;
  }

  // ── The chain, under each container ───────────────────────────────────────
  // One line per step back: the commit that produced the step above it, then
  // the proposals made against that earlier text, each named by who and what.
  const commitUrl = (r) => `https://github.com/${r.repo}/commit/${encodeURIComponent(r.commit)}`;
  function chainLine(entry, i) {
    const foot = el('div', 'md-history-chain mt-1 grid gap-1 text-[11px] leading-tight opacity-70');
    foot.dataset.mdHistoryFor = String(i);
    entry.chain.forEach((step, k) => {
      if (k === 0) return;
      const later = entry.chain[k - 1];
      const row = el('div', 'flex flex-wrap items-center gap-x-2 gap-y-1');
      row.append(Object.assign(el('i', 'ph ph-clock-counter-clockwise'), { 'aria-hidden': 'true' }));
      const r = step.revision;
      const link = el('a', 'link link-hover font-mono', `${r.commit.slice(0, 7)}`);
      link.href = commitUrl(r);
      link.target = '_blank';
      link.rel = 'noopener';
      row.append(el('span', '', k === 1 ? 'became this in' : 'and before that, in'));
      row.append(link);
      row.append(el('span', 'font-mono opacity-60', r.path));
      if (later.also_from.length) row.append(el('span', 'opacity-60', `+${later.also_from.length} other predecessor${later.also_from.length === 1 ? '' : 's'}`));
      foot.append(row);
      for (const p of step.proposals) {
        const line = el('div', 'flex flex-wrap items-center gap-x-2 pl-5');
        line.append(Object.assign(el('i', 'ph ph-sparkle'), { 'aria-hidden': 'true' }));
        line.append(el('span', 'font-medium', p.author));
        line.append(el('span', '', p.purpose));
        line.append(el('span', 'italic truncate max-w-[48ch]', flat(p.to.text)));
        const lab = el('a', 'link link-hover', 'Text Lab');
        lab.href = `${LAB}?proposal=${encodeURIComponent(p.id)}`;
        lab.target = '_blank';
        lab.rel = 'noopener';
        line.append(lab);
        foot.append(line);
      }
    });
    return foot;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // md-diff draws the document, old side being the predecessors; this attaches
  // a chain under each of its containers, matched by order.
  async function render(host, md, index, opts = {}) {
    if (!window.mdDiff) await load('kits/md-diff.js');
    if (!window.TextCollection) await load('kits/text-collection.js');
    if (!window.mdDiff || !window.TextCollection) throw new Error('mdHistory.render: kits unavailable');
    const planned = plan(md, index);
    const handle = await window.mdDiff.render(host, compose(md, planned), md, opts);
    const boxes = [...host.querySelectorAll('.md-diff-change')];
    boxes.forEach((box, i) => {
      if (planned.blocks[i]) box.append(chainLine(planned.blocks[i], i));
    });
    return { ...handle, plan: planned };
  }

  async function index({ token, fresh = false, quiet = true } = {}) {
    if (!window.TextCollection) await load('kits/text-collection.js');
    if (!window.TextCollection) throw new Error('the collection kit is unavailable');
    if (typeof window.GH !== 'function') throw new Error('no GH client on this page');
    const saved = token ?? (window.ghAuth?.resolve?.() || '');
    const embedded = window.TOKEN && !String(window.TOKEN).includes('🎟') ? window.TOKEN : '';
    const home = new window.GH({ token: saved || embedded, repo: HOME.repo, ref: HOME.ref });
    return window.TextCollection.load(home, { fresh, quiet });
  }

  window.mdHistory = { plan, compose, render, index, HOME, LAB };
})();
