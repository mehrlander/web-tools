// kits/md-history.js — a markdown document read WITH the history of its
// passages: what each one used to say, the commit that changed it, and the
// proposals the Text collection holds against each earlier text.
//
// Where the history comes from. Git, read through the page's GH client: the
// commits that touched the file on its ref, newest first, and the file as it
// stood at each one. Consecutive versions are aligned with md-diff's block
// pairing, the same rule the Diff view uses, so a block's predecessor is the
// old block that pairing matched it to one commit back. The walk reads one
// version per commit and stops at the first of three ends: every block of the
// open document has been traced to the commit that first wrote it, the file's
// commit list runs out, or `limit` commits have been read (LIMIT, 20, by
// default). At the third end the page says so and offers the next twenty.
//
// Until 2026-09-22 this kit read a third collection file, revisions.jsonl:
// eight rows from one bounded experiment, every field readable off git, and a
// paragraph that became five recorded as five rows. Applied to those rows, the
// pairing rule below reproduces the three one-to-one connections and matches
// the split paragraph to one of its five successors, so the file was retired
// and the walk replaced it. The pairing is an inference from shared words, not
// a record: a block that became several is matched to the one sharing the most
// words with it, and the rest appear as additions. A paragraph that moved
// between files has no chain here, since git records that as a removal and an
// addition.
//
// The collection is consulted only once a chain exists, and quietly, so
// History works on a public file for a reader with no token for home.
//
//   mdHistory.gitSource(gh, repo)              -> { commits, read }, the two git reads
//   mdHistory.walk(md, opts)                   -> { blocks, chains, commits, read, exhausted, truncated }
//   mdHistory.plan(md, walked)                 -> { blocks, count }
//   mdHistory.compose(md, plan)                -> the markdown with predecessors in place
//   mdHistory.render(host, md, opts)           -> md-diff's handle, plus `plan` and `walked`
//   mdHistory.index({ token })                 -> the collection, loaded
//
// READ-ONLY, like every reader of the collection.
(() => {
  if (window.mdHistory) return;

  const HOME = { repo: 'mehrlander/home', ref: 'main' };
  const LAB = 'https://mehrlander.github.io/web-tools/pages/text-lab.html';
  const LIMIT = 20;
  const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const load = (n) => (window.gh ? window.gh.load(n).catch(() => {}) : Promise.resolve());
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // ── Git ───────────────────────────────────────────────────────────────────
  // Two reads, both through GH.req with an absolute path so the client can
  // address any repository the page's token reaches, as the viewer's own byte
  // fetch does. A version is immutable, so the client's minute-long memo
  // serves a repeat read within a session for free.
  function gitSource(gh, repo) {
    if (!gh || typeof gh.req !== 'function') throw new Error('mdHistory.gitSource needs a GH client');
    const decode = (b64) => {
      const bin = atob(String(b64).replace(/\s/g, ''));
      return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    };
    return {
      async commits(path, ref, n) {
        const rows = await gh.req(`/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&per_page=${n}`);
        return (Array.isArray(rows) ? rows : []).map(c => ({
          sha: c.sha,
          date: String(c.commit?.committer?.date || c.commit?.author?.date || '').slice(0, 10),
          message: String(c.commit?.message || '').split('\n')[0],
          url: c.html_url || `https://github.com/${repo}/commit/${c.sha}`,
        }));
      },
      async read(path, sha) {
        const data = await gh.req(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(sha)}`);
        if (Array.isArray(data)) throw new Error(`${path} is a directory at ${sha.slice(0, 7)}`);
        const b64 = data.content || (await gh.req(`/repos/${repo}/git/blobs/${data.sha}`)).content;
        return decode(b64 || '');
      },
    };
  }

  // ── The walk ──────────────────────────────────────────────────────────────
  // One chain per block of the open document, newest first: step 0 is the
  // block as it stands, and each later step carries the earlier text and the
  // commit that turned it into the step above. `origin` is the commit that
  // first wrote the oldest text, when the walk reached it.
  async function walk(md, { source, path, ref = 'main', limit = LIMIT } = {}) {
    if (!source || !window.mdDiff) throw new Error('mdHistory.walk needs a source and mdDiff');
    const commits = await source.commits(path, ref, limit);
    const exhausted = commits.length < limit;
    const blocks = window.mdDiff.blocks(md);
    const chains = blocks.map(b => ({ steps: [{ text: b.text, revision: null }], cursor: flat(b.text), origin: null, done: false }));
    let newer = String(md ?? '').replace(/\r\n?/g, '\n');
    let read = 0;
    for (let i = 0; i < commits.length && chains.some(c => !c.done); i++) {
      const commit = commits[i];
      if (i + 1 === commits.length) {
        // Nothing older is listed. If the list is complete, this commit wrote
        // whatever is still untraced; if it was cut by the limit, that is not
        // known, and the chain stays open.
        if (exhausted) for (const c of chains) if (!c.done) { c.origin = commit; c.done = true; }
        break;
      }
      const older = String(await source.read(path, commits[i + 1].sha)).replace(/\r\n?/g, '\n');
      read++;
      const changed = new Map();
      for (const e of window.mdDiff.align(older, newer)) {
        if (e.kind === 'changed' && !changed.has(flat(e.new))) changed.set(flat(e.new), e.old);
        else if (e.kind === 'added' && !changed.has(flat(e.new))) changed.set(flat(e.new), null);
      }
      for (const c of chains) {
        if (c.done || !changed.has(c.cursor)) continue;
        const old = changed.get(c.cursor);
        if (old == null) { c.origin = commit; c.done = true; continue; }
        c.steps.push({ text: old, revision: commit });
        c.cursor = flat(old);
      }
      newer = older;
    }
    for (const c of chains) delete c.cursor;
    return { blocks, chains, commits, read, exhausted, truncated: chains.some(c => !c.done) };
  }

  // The collection's proposals against each earlier text, by passage id. Step
  // 0 is the Proposals reading's business and is left alone.
  async function attach(walked, index) {
    const T = window.TextCollection;
    for (const c of walked.chains) {
      for (let k = 1; k < c.steps.length; k++) {
        const step = c.steps[k];
        step.passage_id = T ? await T.passageId(step.text) : null;
        step.proposals = index && step.passage_id
          ? index.proposals.filter(p => p.from === step.passage_id).map(p => T.view(index, p))
          : [];
      }
    }
    return walked;
  }

  // Which blocks have a predecessor, in document order, each with its chain.
  function plan(md, walked) {
    const blocks = [];
    walked.chains.forEach((c, i) => {
      if (c.steps.length < 2) return;
      blocks.push({ block: walked.blocks[i], chain: c.steps, origin: c.origin, open: !c.done });
    });
    return { blocks, count: blocks.length };
  }

  // The document with each planned block replaced by its predecessor: the
  // text one commit back. Offsets are md-diff's, measured on the
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
  function commitLink(r) {
    const link = el('a', 'link link-hover font-mono', r.sha.slice(0, 7));
    link.href = r.url;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }
  function chainLine(entry, i) {
    const foot = el('div', 'md-history-chain mt-1 grid gap-1 text-[11px] leading-tight opacity-70');
    foot.dataset.mdHistoryFor = String(i);
    entry.chain.forEach((step, k) => {
      if (k === 0) return;
      const row = el('div', 'flex flex-wrap items-center gap-x-2 gap-y-1');
      row.append(Object.assign(el('i', 'ph ph-clock-counter-clockwise'), { 'aria-hidden': 'true' }));
      row.append(el('span', '', k === 1 ? 'became this in' : 'and before that, in'));
      row.append(commitLink(step.revision));
      if (step.revision.date) row.append(el('span', 'opacity-60', step.revision.date));
      if (step.revision.message) row.append(el('span', 'italic truncate max-w-[48ch]', step.revision.message));
      foot.append(row);
      for (const p of step.proposals || []) {
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
    const end = el('div', 'flex flex-wrap items-center gap-x-2 gap-y-1 opacity-60');
    if (entry.origin) {
      end.append(el('span', '', 'first written in'));
      end.append(commitLink(entry.origin));
      if (entry.origin.date) end.append(el('span', '', entry.origin.date));
    } else if (entry.open) {
      end.append(el('span', '', 'older than the commits read'));
    }
    if (end.childElementCount) foot.append(end);
    return foot;
  }

  // The walk's own line under the document: how far back it read, and the
  // next twenty when the limit was what stopped it.
  function bound(walked, onMore) {
    const line = el('div', 'md-history-bound mt-4 flex flex-wrap items-center gap-x-2 text-xs opacity-70');
    const n = walked.read + 1;
    const open = walked.chains.filter(c => !c.done).length;
    line.append(el('span', '', walked.truncated
      ? `Read ${n} commit${n === 1 ? '' : 's'} back; ${open} block${open === 1 ? '' : 's'} older than that.`
      : `Read ${n} commit${n === 1 ? '' : 's'} back, to where every block was first written.`));
    if (walked.truncated && typeof onMore === 'function') {
      const more = el('button', 'btn btn-xs btn-ghost', `Read ${LIMIT} more`);
      more.type = 'button';
      more.addEventListener('click', () => onMore(walked.commits.length + LIMIT));
      line.append(more);
    }
    return line;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // md-diff draws the document, old side being the predecessors; this attaches
  // a chain under each of its containers, matched by order, and the bound line
  // after the document. `opts.index` is the collection (or false to skip it);
  // absent, it is read quietly and its absence costs nothing but proposals.
  async function render(host, md, opts = {}) {
    if (!window.mdDiff) await load('kits/md-diff.js');
    if (!window.mdDiff) throw new Error('mdHistory.render: md-diff is unavailable');
    const walked = await walk(md, opts);
    const planned = plan(md, walked);
    let index = opts.index === false ? null : opts.index || null;
    let collection = null;
    if (planned.count && opts.index == null) {
      try { index = await api.index({ token: opts.token }); }
      catch (error) { collection = error?.message || String(error); }
    }
    if (planned.count) await attach(walked, index);
    const handle = await window.mdDiff.render(host, compose(md, planned), md, opts.diff || {});
    const boxes = [...host.querySelectorAll('.md-diff-change')];
    boxes.forEach((box, i) => {
      if (planned.blocks[i]) box.append(chainLine(planned.blocks[i], i));
    });
    host.append(bound(walked, opts.onMore));
    if (collection) host.append(el('div', 'text-xs opacity-60 italic', `Proposals along the chain are unavailable (${collection}).`));
    return { ...handle, plan: planned, walked };
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

  const api = { gitSource, walk, attach, plan, compose, render, index, HOME, LAB, LIMIT };
  window.mdHistory = api;
})();
