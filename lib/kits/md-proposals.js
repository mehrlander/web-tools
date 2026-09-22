// kits/md-proposals.js — a markdown document read WITH the proposals retained
// against its paragraphs.
//
// The question this answers. The shared Text collection (mehrlander/home,
// projects/text/, two files: texts and proposals by text id) retains edit
// proposals keyed on the exact source string of a paragraph: a half-length
// rewrite, a phrase qualification, a document-audit repair, a local model's
// clarity pass. Text Lab lists them and the FAB's Text tab looks them up for
// the page at hand, but neither puts them ON the document. A reader with a markdown file open had to leave it to learn that
// paragraph six has two alternatives waiting.
//
// The move, and why it is small. A proposal is a block-level pair: the block as
// it stands, and the block as someone proposed it. kits/md-diff.js already
// renders a document whose blocks changed as the document, one swipeable
// container per change with old, inline and new stops. So this kit does not
// render anything of its own: it finds which blocks of the document have
// proposals, composes a second markdown text with one proposal substituted per
// block, and hands both texts to md-diff. Every paragraph with a proposal
// becomes a change container; the strip counts them; the highlight toggle
// answers "where are they" in the first ten seconds. What this kit adds on top
// is the part md-diff cannot know: whose proposal it is, and which one, when a
// block has more than one.
//
//   mdProposals.plan(md, index, { picks })   -> { blocks, count, proposals }
//   mdProposals.compose(md, plan)            -> the composed markdown
//   mdProposals.render(host, md, index, opts)-> md-diff's handle, plus `plan`
//   mdProposals.index({ token })             -> the shared projection, loaded
//
// THE JOIN IS EXACT. A block matches a proposal when the two strings are the
// same after whitespace is flattened, which is the same normalisation md-diff
// uses to align blocks. Measured 2026-09-18 over the web-tools paragraph lane:
// 2,201 of 2,272 retained originals match a block of their document at main,
// and every miss is a paragraph edited since the 2026-09-16 scan. Nothing
// fuzzier is attempted, because a proposal shown against a paragraph it was not
// written for is worse than one not shown.
//
// ONE SUBSTITUTION PER BLOCK, and `picks` says which. md-diff knows one new
// text per block. When a block has several proposals (clarity and half-length
// can both land on one paragraph) the container carries a row of alternatives,
// and choosing one re-renders with that substitution. The chosen one is what
// the swipe compares; the others are one tap away rather than stacked.
//
// READ-ONLY, like every reader of the collection. It writes nothing and offers no
// Apply. Retaining a proposal is not endorsing it, and the provenance line under
// each container says who proposed it so that the reader can weigh it.
//
// Depends on kits/md-diff.js for the rendering and kits/text-proposals.js for
// the projection. Both are loaded on demand.
(() => {
  if (window.mdProposals) return;

  // Where the shared projection lives. The FAB carries the same three under
  // TEXT_PROPOSALS_*; a page that has neither loaded reaches them through
  // index() below.
  const HOME = { repo: 'mehrlander/home', ref: 'main',
                 spec: 'projects/text/current-sources.json' };
  const LAB = 'https://mehrlander.github.io/web-tools/pages/text-lab.html';

  const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const load = (n) => (window.gh ? window.gh.load(n).catch(() => {}) : Promise.resolve());
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // ── The join ──────────────────────────────────────────────────────────────
  // Every proposal, keyed by its flattened original. Built once per index and
  // held weakly, since a projection is loaded once and read by every document.
  const tables = new WeakMap();
  function table(index) {
    let m = tables.get(index);
    if (m) return m;
    m = new Map();
    for (const p of index.proposals || []) {
      const key = flat(index.texts?.[p.from]);
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    }
    tables.set(index, m);
    return m;
  }

  // Which blocks of `md` have proposals, in document order, each with its
  // proposals as text-proposals views and the index of the one to substitute.
  // `picks` is keyed by the block's position in the returned list.
  function plan(md, index, { picks = {} } = {}) {
    const T = window.TextProposals;
    if (!T || !window.mdDiff) throw new Error('mdProposals.plan needs mdDiff and TextProposals');
    const rows = table(index);
    const blocks = [];
    for (const block of window.mdDiff.blocks(md)) {
      const hits = rows.get(flat(block.text));
      if (!hits || !hits.length) continue;
      const proposals = hits.map((p) => T.view(index, p))
        .filter((v) => v && flat(v.to?.text) && flat(v.to.text) !== flat(v.from?.text));
      if (!proposals.length) continue;
      const i = blocks.length;
      const want = Number(picks[i]);
      const pick = Number.isInteger(want) ? Math.min(Math.max(0, want), proposals.length - 1) : 0;
      blocks.push({ block, proposals, pick });
    }
    return { blocks, count: blocks.length,
             proposals: blocks.reduce((n, b) => n + b.proposals.length, 0) };
  }

  // The document with each planned block replaced by its picked proposal.
  // Offsets are md-diff's, which are measured on the CRLF-normalised text, so
  // the same normalisation is applied here before any slice. A block's leading
  // indentation and its trailing newline are kept, since the proposal is the
  // paragraph's words and not its place in a list.
  function compose(md, planned) {
    let src = String(md ?? '').replace(/\r\n?/g, '\n');
    const sorted = [...planned.blocks].sort((a, b) => b.block.start - a.block.start);
    for (const b of sorted) {
      const rep = b.proposals[b.pick]?.to?.text;
      if (rep == null) continue;
      let { start, end } = b.block;
      const lead = /^\s*/.exec(src.slice(start, end))[0].length;
      start += lead;
      while (end > start && /\s/.test(src[end - 1])) end--;
      src = src.slice(0, start) + rep + src.slice(end);
    }
    return src;
  }

  // ── Provenance, under each container ──────────────────────────────────────
  // One line: who proposed it, what kind of proposal, how long against the
  // original, and a way to Text Lab for the record. Under it, when the block
  // has more than one proposal, the alternatives as a row of stops in the same
  // pill idiom md-diff's readings use, so a reader learns one vocabulary.
  const words = (s) => (flat(s).match(/\S+/g) || []).length;
  function provenance(entry, i, onPick) {
    const v = entry.proposals[entry.pick];
    const foot = el('div', 'md-proposals-who mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 '
                         + 'text-[11px] leading-tight opacity-70');
    foot.dataset.mdProposalsFor = String(i);
    const who = el('span', 'inline-flex items-center gap-1');
    who.append(Object.assign(el('i', 'ph ph-sparkle'), { 'aria-hidden': 'true' }));
    who.append(el('span', 'font-medium', v.author || 'unknown proposer'));
    foot.append(who);
    if (v.purpose) foot.append(el('span', '', v.purpose));
    const before = words(v.from?.text);
    if (before) foot.append(el('span', 'tabular-nums', `${Math.round(words(v.to?.text) / before * 100)}% of the words`));
    const lab = el('a', 'link link-hover inline-flex items-center gap-0.5', 'Text Lab');
    lab.href = `${LAB}?proposal=${encodeURIComponent(v.id)}`;
    lab.target = '_blank';
    lab.rel = 'noopener';
    foot.append(lab);
    if (entry.proposals.length > 1) {
      const alts = el('span', 'inline-flex items-center gap-0.5 rounded-full border '
                            + 'border-base-300 px-0.5 py-0.5');
      alts.setAttribute('role', 'group');
      alts.setAttribute('aria-label', 'Alternatives');
      entry.proposals.forEach((alt, k) => {
        const b = el('button', 'cursor-pointer rounded-full px-1.5 py-0.5 transition-colors '
                             + (k === entry.pick ? 'bg-base-300 font-medium' : 'opacity-60'),
                     alt.purpose || String(k + 1));
        b.dataset.mdProposalsPick = String(k);
        b.title = `${alt.author || ''} · ${alt.purpose || ''}`.trim();
        b.addEventListener('click', () => onPick(i, k));
        alts.append(b);
      });
      foot.append(alts);
    }
    return foot;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // md-diff draws the document; this attaches a provenance line under each of
  // its containers. The containers come back in document order, and so do the
  // planned blocks, but the two lists are joined on TEXT rather than position:
  // a proposal that shares too few words with its original is aligned by
  // md-diff as a removal beside an addition, two containers for one block, and
  // a positional join would then label every later block with the wrong
  // proposer. Each container is matched to the planned block whose original
  // or picked replacement it carries.
  async function render(host, md, index, opts = {}) {
    if (!window.mdDiff) await load('kits/md-diff.js');
    if (!window.TextProposals) await load('kits/text-proposals.js');
    if (!window.mdDiff || !window.TextProposals) throw new Error('mdProposals.render: kits unavailable');
    const picks = { ...(opts.picks || {}) };
    const planned = plan(md, index, { picks });
    const composed = compose(md, planned);
    const { picks: _p, onPick: _o, ...rest } = opts;
    const handle = await window.mdDiff.render(host, md, composed, rest);
    const seq = window.mdDiff.align(md, composed).filter((s) => s.kind !== 'same');
    const boxes = [...host.querySelectorAll('.md-diff-change')];
    const byOld = new Map(), byNew = new Map();
    planned.blocks.forEach((b, i) => {
      byOld.set(flat(b.block.text), i);
      byNew.set(flat(b.proposals[b.pick].to.text), i);
    });
    const onPick = (i, k) => {
      picks[i] = k;
      if (typeof opts.onPick === 'function') opts.onPick(i, k, planned.blocks[i]);
      return render(host, md, index, { ...opts, picks });
    };
    const done = new Set();
    boxes.forEach((box, n) => {
      const s = seq[n];
      if (!s) return;
      const i = byOld.has(flat(s.old)) ? byOld.get(flat(s.old))
              : byNew.has(flat(s.new)) ? byNew.get(flat(s.new)) : -1;
      if (i < 0 || done.has(i)) return;
      done.add(i);
      box.append(provenance(planned.blocks[i], i, onPick));
    });
    // The handle has getters (`position`, `layout`), so it is extended by
    // prototype rather than copied.
    return Object.assign(Object.create(handle), { plan: planned, picks });
  }

  // ── The projection ────────────────────────────────────────────────────────
  // The same read the FAB's Text tab makes, resolved at the moment of the call
  // so an account switch is honoured. Home is private, so a reader without a
  // token gets the kit's own "unavailable" error and the host says so.
  async function index({ token, fresh = false, quiet = true } = {}) {
    if (!window.Csv) await load('kits/csv.js');
    if (!window.TextProposals) await load('kits/text-proposals.js');
    if (!window.TextProposals) throw new Error('the proposal projection kit is unavailable');
    if (typeof window.GH !== 'function') throw new Error('no GH client on this page');
    const saved = token ?? (window.ghAuth?.resolve?.() || '');
    const embedded = window.TOKEN && !String(window.TOKEN).includes('🎟') ? window.TOKEN : '';
    const gh = new window.GH({ token: saved || embedded, repo: HOME.repo, ref: HOME.ref });
    return window.TextProposals.load(gh, { specPath: HOME.spec, fresh, quiet });
  }

  window.mdProposals = { plan, compose, render, index, HOME, LAB, _flat: flat };
})();
