// alpineComponents/user-call-form.js — one user call as a form.
//
// A user call is one decision a session needs from the owner (user-call/1,
// written by web-tools-private user-calls/user-call.py, one file per call at
// user-calls/<session>-<slug>.json
// in the repo it governs). This is its form, and it is shaped like the branch
// page for the same reason the session page is: a head that says what this is,
// over a pane of files to move through.
//
//   Top      what an executive would be shown: the question, one line of
//            what is at stake, live facts for a linked PR, and two answers:
//            Take, the session's recommendation, or Adjust it. Taking sends
//            from the card; an adjustment is written on its own slide below
//            (the note, and whether the session goes ahead or comes back
//            with a new call), so the card has no note row. A call filed
//            before Take and Adjust keeps its options as buttons and its
//            note row. A merge is approved, and a documentation call
//            recorded, from the verdict circle instead.
//            A call that names a decision tree (`tree`) shows where it sits
//            in place of its question and brief: the goal at the root and the
//            decisions under it, each under the decision it serves, open or
//            closed, with its inquiry and instrument as attribute lines, and
//            the call's own decision ringed (see loadTree). A second tab, a
//            swipe away, says the question plainly: the call's question and
//            brief as text. A tree that cannot be read gives the question and
//            brief back. A call that names a glossary (`glossary`:
//            owner/repo@ref:file.json, entities written by a reader other than
//            the call's author) marks each entity's first mention in the
//            question, the brief and the tree with a small raised dot.
//            Everything the card points to is in the deck below, and the card
//            is how a reader gets there: a marked term brings up the Notes
//            slide with its note marked, Take brings up what it approves and
//            Adjust its form, and a block a material is filed against carries
//            a link to it. The top is the decision; the bottom is what
//            supports it.
//   Bottom   one slide at a time in a snap swiper, as branch-brief's Files
//            pane swipes. The Notes, where the call has a tree or a
//            glossary: for each entity the question a reader has at its mark
//            and the answer, with a ↗ where
//            the word's meaning lives elsewhere. One place for every note, so a
//            term met twice shows the same note, and nothing floats over the
//            text it explains. Then a slide per answer that names one (a
//            material's `answer`), then the rest of the materials: a page
//            rendered, a document as prose, anything else a button out. In a
//            Take or Adjust call, what taking approves leads, before the
//            Notes, and the Adjust form ends the deck while the call is open.
//            n/m, arrows, and a contents list off the mark, because a swipe
//            that starts on a framed page goes to the page.
//
// A DOCUMENTATION CALL IS ANSWERED HERE TOO (owner, 2026-10-29: "It should
// just be the call, and that's the form", not Dictate's machinery). The form
// reads the call's file, stages its edits with kits/call-answer.js, and draws
// each one as md-diff's inline reading with its reason, Keep, Discard and a
// note. Recording writes the same answer line Dictate and the Map's Docs tab
// write, the confirmed edits as a patch for a session to apply.
//
// Mounted two ways, as branch-brief is: as a slide in the session page's deck
// of calls, and on its own at pages/user-call.html. A host passes:
//   call      the envelope, already read (the deck has it)
//   src       owner/repo[@ref]:user-calls/<id>.json, read here when `call` is absent
//   repo, ref, path   where the call lives, for the answers file beside it
//   onAnswer  (entry) => void, told when an answer is sent
//
// Answers go to <id>.answers.jsonl beside the call, one JSON line each,
// appended through the owner's token and never edited; the latest line wins.
// Where the call names a PR and the box is ticked, the answer is first
// commented there, which wakes a session subscribed to it.
//
// window.UserCallForm carries the helpers the session page shares: linkOf (a typed
// link to what the renderer draws), prFacts, postAnswer, prOf.
(function () {
  const STORE = 'mehrlander/web-tools-private';
  const PR_TONE = { draft: 'bg-warning/20 border-warning/60', open: 'bg-success/20 border-success/60',
                    merged: 'bg-secondary/20 border-secondary/60', closed: 'bg-error/20 border-error/60' };
  // A proof's pill in the colour of what it opens: a view of the app, a
  // page, a document, or source. The same tints as PR_TONE.
  const KIND_TONE = { view: 'bg-info/20 border-info/60', html: 'bg-primary/20 border-primary/60',
                      md: 'bg-secondary/10 border-secondary/40', code: 'bg-base-200 border-base-300' };
  // The kind of a shipped change, after Keep a Changelog's verbs plus one
  // for work that records rather than alters. The glyph leads the line; its
  // name is the hover title. A line with no kind keeps the plain check.
  const CHANGE_KIND = {
    // A tinted disc with dark ink: this theme's success and warning are pale
    // enough that a bare glyph in them all but disappears.
    added: { icon: 'ph-plus', tone: 'bg-success/30 text-success-content', label: 'Added' },
    changed: { icon: 'ph-pencil-simple', tone: 'bg-primary/10 text-primary', label: 'Changed' },
    fixed: { icon: 'ph-wrench', tone: 'bg-warning/40 text-warning-content', label: 'Fixed' },
    removed: { icon: 'ph-minus', tone: 'bg-error/20 text-error', label: 'Removed' },
    recorded: { icon: 'ph-bookmark-simple', tone: 'bg-secondary/10 text-secondary', label: 'Recorded' },
  };
  const PEEKS = new Map();

  const prOf = (ref) => {
    const m = String(ref || '').match(/^([^/]+\/[^#]+)#(\d+)$/);
    return m ? { slug: m[1], n: m[2], label: m[1].split('/').pop() + ' #' + m[2] } : null;
  };

  // A page or a document, in the shape a peek or a slide draws; a document's
  // prose is fetched once, on first use, and kept.
  // `kind` is md, html, or text: source shown as wrapped text, since a file
  // named as proof may be a script.
  function peekOf(slug, ref, path, kind, url) {
    const key = slug + '@' + ref + ':' + path;
    if (PEEKS.has(key)) return PEEKS.get(key);
    const v = window.Alpine.reactive({ key, repo: slug, ref, kind, path, url, html: '', _asked: false });
    PEEKS.set(key, v);
    return v;
  }
  async function fillPeek(v) {
    if (!v || v.kind === 'html' || v._asked || v.html) return;
    v._asked = true;
    try {
      const text = (await new window.GH({ token: window.TOKEN, repo: v.repo, ref: v.ref }).get(v.path)).text;
      if (v.kind === 'text') { v.html = '<pre>' + window.esc(text) + '</pre>'; return; }
      if (window.gh?.load && !window.chatRender) await window.gh.load('kits/chat-render.js').catch(() => {});
      await window.chatRender?.ready?.().catch(() => {});
      v.html = window.marked ? window.marked.parse(text) : '';
    } catch { v.html = ''; }
  }

  // One typed link ({kind, ref, label?}) to where it goes, its mark, and for a
  // page or a document, the peek.
  function linkOf(l, prState) {
    const ref = String(l?.ref || '');
    const out = { href: ref, label: l?.label || ref, icon: 'ph-link', tone: 'border-base-300', peek: null, card: 0, kind: l?.kind || '' };
    if (l?.kind === 'pr') {
      const p = prOf(ref);
      if (p) {
        out.href = window.RepoAddress.github.pull(p.slug, p.n);
        out.label = l.label ? l.label + ' · #' + p.n : p.label;
        out.icon = 'ph-git-pull-request';
        out.tone = PR_TONE[prState?.(p)] || out.tone;
      }
    } else if (l?.kind === 'branch') {
      const { repo: slug, ref: br } = window.RepoAddress.parseRepo(ref) || { repo: ref, ref: '' };
      out.href = 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=' + slug + '@' + encodeURIComponent(br || '');
      out.label = l.label || slug.split('/').pop() + ' @ ' + window.AssistantMark.shortBranch(br);
      out.icon = 'ph-git-branch';
    } else if (l?.kind === 'file') {
      const a = window.RepoAddress.parse(ref);
      if (a && a.ref) {
        const { repo: slug, ref: r, path } = a;
        const md = /\.(md|markdown)$/i.test(path), page = /\.html?$/i.test(path);
        const t = page ? (window.GuideRender?.pageTargets?.(slug, r, [path], null) || [])[0] : null;
        out.gh = window.RepoAddress.github.blob(slug, r, path);
        out.href = t ? t.url : out.gh;
        out.label = l.label || path.split('/').pop();
        out.icon = md ? 'ph-file-text' : page ? 'ph-browser' : 'ph-file-code';
        // A page is its render, a document its prose, anything else its
        // source as wrapped text.
        out.peek = peekOf(slug, r, path, md ? 'md' : page ? 'html' : 'text', out.href);
        out.kind = md ? 'md' : page ? 'html' : 'code';
      }
    } else if (l?.kind === 'task') {
      // A tracker task the call decides, owner/repo[@ref]:<path>/tracker/tasks/<id>.md.
      // Named by its id, the way the Tending view names a task subject; the
      // task names the call back with `awaiting: user-call <id>`.
      const a = window.RepoAddress.parse(ref);
      if (a) {
        const { repo: slug, path } = a, r = a.ref || 'main';
        out.gh = window.RepoAddress.github.blob(slug, r, path);
        out.href = out.gh;
        out.label = l.label || path.split('/').pop().replace(/\.md$/, '');
        out.icon = 'ph-list-checks';
        out.peek = peekOf(slug, r, path, 'md', out.href);
        out.kind = 'task';
      }
    } else if (l?.kind === 'view') {
      // A view of the Web Tools app, framed live: ref is the app's own query
      // (view=map&tab=context). The frame runs the app at this page's ?use=,
      // chrome off, so the proof is the display the claim is about.
      const q = new URLSearchParams(ref.replace(/^\?/, ''));
      const use = new URLSearchParams(location.search).get('use');
      if (use && !q.has('use')) q.set('use', use);
      if (!q.has('shell')) q.set('shell', 'none');
      out.href = 'https://mehrlander.github.io/web-tools/app/?' + q.toString();
      out.label = l.label || [q.get('view'), q.get('tab')].filter(Boolean).join(' · ');
      out.icon = 'ph-app-window';
      out.peek = peekOf('app', use || 'main', q.toString(), 'html', out.href);
    } else if (l?.kind === 'card') {
      out.card = parseInt(ref, 10) || 0;
      out.href = '#card=' + out.card;
      out.label = l.label || 'Exchange ' + out.card;
      out.icon = 'ph-chat-circle-text';
    }
    return out;
  }

  // The PR's state, CI on its head, mergeability and size. Read when a form
  // opens and never written, so never stale.
  async function prFacts(ref) {
    const p = prOf(ref);
    if (!p || !window.GH) return null;
    const g = new window.GH({ token: window.TOKEN, repo: p.slug });
    const pr = await g.req('pulls/' + p.n);
    let ci = '';
    try {
      const runs = (await g.req('commits/' + pr.head.sha + '/check-runs'))?.check_runs || [];
      const bad = runs.filter((r) => ['failure', 'timed_out', 'cancelled'].includes(r.conclusion)).length;
      const going = runs.filter((r) => r.status !== 'completed').length;
      ci = !runs.length ? 'no checks' : bad ? bad + ' failing' : going ? 'running' : 'passing';
    } catch { ci = ''; }
    return { state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open',
             ci, mergeable: pr.mergeable_state || '', files: pr.changed_files, add: pr.additions,
             del: pr.deletions, title: pr.title, url: pr.html_url,
             commits: pr.commits, updated: pr.updated_at, branch: pr.head?.ref || '', slug: p.slug, n: p.n };
  }

  // Append one answer line; comment it on a PR first when asked, so the
  // comment's address rides in the line. Read fresh, PUT with the sha, and on
  // a lost race read again, as kits/notes.js appends.
  // `token` is for a host that keeps its token somewhere other than
  // window.TOKEN (Dictate reads the stored one); otherwise that global is used.
  async function postAnswer({ repo, ref, path, entry, pr, comment, token }) {
    if (!window.GH.toBase64 && window.gh?.load) await window.gh.load('gh-store.js');
    const tk = token || window.TOKEN;
    const g = new window.GH({ token: tk, repo, ref });
    entry.by = entry.by || (await g.req('/user').catch(() => ({})))?.login || '';
    if (pr && comment) {
      const c = await new window.GH({ token: tk, repo: pr.slug })
        .req('issues/' + pr.n + '/comments', { method: 'POST', body: JSON.stringify({ body: comment }) });
      entry.comment = c?.html_url || '';
    }
    for (let tries = 1; ; tries++) {
      let cur = { text: '', sha: null };
      try { const f = await g.get(path, window.GH.FRESH); cur = { text: f.text, sha: f.sha }; }
      catch (e) { if (e?.status !== 404) throw e; }
      const text = (cur.text && !cur.text.endsWith('\n') ? cur.text + '\n' : cur.text) + JSON.stringify(entry) + '\n';
      const put = { message: 'answer: ' + path.split('/').pop() + ' = ' + entry.answer,
                    content: window.GH.toBase64(text), branch: ref };
      if (cur.sha) put.sha = cur.sha;
      try { await g.req('contents/' + path, { method: 'PUT', body: JSON.stringify(put) }); return entry; }
      catch (e) { if ((e?.status !== 409 && e?.status !== 422) || tries >= 3) throw e; }
    }
  }

  // Branches as branch-brief slides in a deck over whatever is showing: the
  // session page's branch chips and a call's PR panel both open this. Each
  // item: { slug, branch, pr?, prState?, icon?, repoShort?, short?, url? }.
  const BRANCH_KITS = ['kits/review-target.js', 'kits/branch-status.js', 'kits/guide-render.js', 'kits/csv.js',
                       'kits/content-registry.js', 'kits/route-activity.js', 'kits/branch-brief.js',
                       'kits/cm6-merge.js', 'alpineComponents/file-review.js', 'alpineComponents/branch-brief.js'];
  const branchUrl = (b) => 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=' + b.slug + '@'
    + encodeURIComponent(b.branch) + (b.pr ? '&pr=' + b.pr : '');
  // `opts.pane` opens every slide on that pane of the branch form ('files'
  // or 'guide'), for a caller that came for the files rather than the brief.
  async function openBranchDeck(items, start = 0, opts = {}) {
    const list = (items || []).map((b) => ({ repoShort: b.slug.split('/').pop(), icon: 'ph-git-branch',
      short: window.AssistantMark.shortBranch(b.branch), url: branchUrl(b), ...b }));
    if (!list.length || !window.swipeDeck) return;
    for (const k of BRANCH_KITS) if (window.gh?.load) await window.gh.load(k).catch(() => {});
    const keys = [];
    let h = null;
    h = window.swipeDeck.open({
      count: list.length, start,
      slideScroll: false,
      innerClass: 'h-full w-full min-w-0',
      icon: list[start].icon,
      title: list[start].repoShort,
      subtitle: list[start].branch,
      link: { href: list[start].url, title: 'Open the branch page' },
      index: (i) => ({ title: list[i].repoShort, subtitle: list[i].pr ? '#' + list[i].pr + ' ' + (list[i].prState || '') : 'no PR',
                       icon: list[i].icon, group: list[i].branch, section: list[i].short }),
      render: (i, slide) => {
        const b = list[i];
        const key = '__deckBranch' + i + '_' + Date.now().toString(36);
        keys[i] = key;
        window[key] = { repo: b.slug, branch: b.branch, base: 'main', pr: b.pr ? String(b.pr) : '', framed: true,
                        ...(opts.pane ? { pane: opts.pane } : {}) };
        const el = document.createElement('div');
        el.className = 'h-full';
        el.setAttribute('x-data', 'branchBrief(window.' + key + ')');
        slide.append(el);
        window.Alpine.initTree(el);
      },
      release: (i) => { if (keys[i]) { delete window[keys[i]]; keys[i] = null; } },
      onSlide: (i) => {
        const b = list[i];
        if (!h) return;
        h.setTitle?.(b.repoShort); h.setSubtitle?.(b.branch); h.setIcon?.(b.icon);
        h.setLink?.({ href: b.url, title: 'Open the branch page' });
      },
    });
  }

  // A document's prose, the same in the pane and in the full-screen deck.
  const PROSE = '[overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap px-4 py-3 text-base leading-7'

  // ── Step art ─────────────────────────────────────────────────────────
  // The tree's steps by their kind, drawn here rather than as icon-font
  // glyphs: each two-tone in its kind's colour (--k reaches them as
  // currentColor), with one red detail each, and the goal a filled badge with
  // a dart in its red bull, so it reads first. The red is the owner's ask: a
  // little more exciting, not gaudy. Each draws its kind and nothing of one
  // call's content: the first designs drew the instrument as a key because
  // that call's was an answer key, which the owner caught.
  const RED = '#e5484d', INK = '#1f2937';
  const SVG = (size, body) => '<svg viewBox="0 0 24 24" class="' + size + ' shrink-0 overflow-visible" aria-hidden="true">' + body + '</svg>';
  const STEP_ART = {
    goal: SVG('size-[1.85em]', '<circle cx="12" cy="12" r="11.5" fill="currentColor"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#fff" stroke-width="1.8"/>'
      + '<circle cx="12" cy="12" r="3" fill="' + RED + '"/><path d="M12.3 11.7 20.6 3.4" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>'
      + '<path d="M18.9 5.1 18.3 1.6 20.2 1.5 21.4 2.6zM18.9 5.1 22.4 5.7 22.5 3.8 21.4 2.6z" fill="' + RED + '" stroke="#fff" stroke-width=".5" stroke-linejoin="round"/>'),
    // the fork, its junction lit: where the choice is made, not which way
    decide: SVG('size-[1.45em]', '<path d="M12 21.5V14L6.4 8.4M12 14l5.6-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<circle cx="5" cy="6.5" r="2.7" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="6.5" r="2.7" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.6"/>'
      + '<circle cx="12" cy="14" r="2.6" fill="' + RED + '"/>'),
    // a closed fork: the path taken solid, the other faded, nothing red
    decided: SVG('size-[1.45em]', '<path d="M12 21.5V14L6.4 8.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="M12 14l5.6-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.6 2.6" opacity=".45"/>'
      + '<circle cx="5" cy="6.5" r="2.7" fill="currentColor"/><circle cx="19" cy="6.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/>'),
    know: SVG('size-[1.45em]', '<circle cx="10" cy="10" r="6.6" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="2"/>'
      + '<path d="m15.4 15.4 5.2 5.2" stroke="' + RED + '" stroke-width="3" stroke-linecap="round"/><path d="M7.2 8.6a3.2 3.2 0 0 1 2.9-2.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>'),
    // how we tell: a gauge, its needle red
    tool: SVG('size-[1.45em]', '<path d="M2.8 17.5a9.2 9.2 0 0 1 18.4 0z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
      + '<path d="M6 12.6l1.2.9M12 8.3v1.5M18 12.6l-1.2.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
      + '<path d="M12 17.5 16.4 11.2" stroke="' + RED + '" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.7" fill="currentColor"/>'),
  };
  // What an adjustment sets off: the session goes ahead, or drafts the change
  // and puts it back to the owner as a new call (user-call.py, `then`).
  const THEN = [
    { k: 'go', label: 'Adjust and go', icon: 'ph-arrow-right', hint: 'The session makes the change and carries on.' },
    { k: 'return', label: 'Come back first', icon: 'ph-arrow-u-up-left', hint: 'The session drafts the change and files a new call to show you before it acts.' },
  ];
  // The two who talk the question down: Pip, round and curious, and Pap, square
  // and unimpressed. Drawn in the theme's info and warning colours, paled.
  const SPRITES = {
    pip: '<svg viewBox="0 0 40 40" class="size-9 shrink-0 text-[color-mix(in_oklab,var(--color-info)_55%,white)]" aria-hidden="true">'
      + '<path d="M20 7.5c0-3 1.6-4.6 4.4-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
      + '<circle cx="20" cy="22.5" r="15" fill="currentColor"/>'
      + '<ellipse cx="14.5" cy="20.5" rx="3.6" ry="4.3" fill="#fff"/><ellipse cx="25.5" cy="20.5" rx="3.6" ry="4.3" fill="#fff"/>'
      + '<circle cx="15.3" cy="21.6" r="1.9" fill="' + INK + '"/><circle cx="26.3" cy="21.6" r="1.9" fill="' + INK + '"/>'
      + '<path d="M16.2 29q3.8 3 7.6 0" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/></svg>',
    pap: '<svg viewBox="0 0 40 40" class="size-9 shrink-0 text-[color-mix(in_oklab,var(--color-warning)_70%,white)]" aria-hidden="true">'
      + '<rect x="4.5" y="6.5" width="31" height="30" rx="9" fill="currentColor"/>'
      + '<path d="M10.4 20a3.6 3.6 0 0 0 7.2 0z" fill="#fff"/><path d="M22.4 20a3.6 3.6 0 0 0 7.2 0z" fill="#fff"/>'
      + '<circle cx="14" cy="21.4" r="1.7" fill="' + INK + '"/><circle cx="26" cy="21.4" r="1.7" fill="' + INK + '"/>'
      + '<path d="M10 20h8M22 20h8" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>'
      + '<path d="M22.5 15.2l7-2.2" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>'
      + '<path d="M15.5 29.5h9" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };
    + ' [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_p]:my-2'
    + ' [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:link [&_code]:font-mono'
    + ' [&_code]:text-sm [&_table]:text-sm [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6';

  const TEMPLATE = `
    <div class="h-full flex flex-col min-h-0 bg-base-100">
      <div x-show="err" class="m-3 alert alert-warning" x-text="err"></div>
      <div x-show="!c && !err" class="flex-1 flex items-center justify-center">
        <span class="loading loading-spinner text-primary"></span></div>
      <!-- Two cards on the page's own ground, as branch-brief lays out its
           guide and its Files pane: the framing above, the materials below. -->
      <template x-if="c">
        <div class="flex-1 min-h-0 flex flex-col gap-2 p-3 bg-base-200/40">
          <div class="shrink-0 overflow-y-auto rounded-xl border border-base-300 bg-base-100 px-4 py-2.5 grid grid-cols-[minmax(0,1fr)] gap-2 [&_[data-lit]]:rounded-[3px] [&_[data-lit]]:bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)]" :class="c.tree ? 'max-h-[62%]' : c.kind === 'documentation' ? (mats.length ? 'max-h-[78%]' : 'max-h-full') : 'max-h-[40%]'"
               @pointerenter="inCard = true" @pointerover="entOver($event)" @pointerleave="inCard = false; entLeave($event)" @click="entClick($event)" @focusin="entFocus($event)" data-call-card>
            <!-- AN EXECUTIVE'S GLANCE: the question, one line of what is at
                 stake, and answers that are only answers. Depth is in the
                 materials below, never in the answers. -->
            <div x-show="c.kind !== 'merge' && !chained" class="flex items-start gap-2">
              <div class="grow text-xl font-semibold leading-snug" x-html="ann(c.question)"></div>
              <span x-show="!hosted && c.kind === 'documentation'" class="shrink-0" x-effect="if (!hosted && !chained && c.kind === 'documentation') $el.replaceChildren(verdictEl())"></span>
            </div>
            <!-- A MERGE CALL is a standard confirm panel, not a question: its
                 kind and PR, one status line, the verdict circle top right,
                 then what shipped. Inside the session page's deck the kind,
                 the PR pill and the circle ride in the deck's header (onHead),
                 so the card starts at the status; on its own page they lead. -->
            <template x-if="c.kind === 'merge'">
              <div class="grid gap-1">
                <div class="flex items-center gap-2 min-w-0">
                  <template x-if="!hosted">
                    <div class="flex items-center gap-1.5 min-w-0 text-sm">
                      <i class="ph ph-git-merge shrink-0 opacity-60"></i><span class="font-semibold shrink-0">Confirm merge</span>
                      <button type="button" data-pr-chip @click="togglePr($el)"
                         class="inline-flex items-center gap-1 rounded-full border px-2 leading-6 hover:bg-base-200 min-w-0"
                         :class="tone(facts?.state)" :aria-expanded="prOpen ? 'true' : 'false'" :data-title-tip="pr?.label">
                        <i class="ph ph-git-pull-request shrink-0"></i><span x-text="'#' + (pr?.n || '')"></span></button>
                    </div>
                  </template>
                  <!-- One status line: loose ends and readiness together. -->
                  <div x-show="hosted" class="min-w-0 text-sm">
                    <div x-show="facts?.state === 'merged'" class="opacity-70">Already merged.</div>
                    <div x-show="!(c.loose || []).length && facts?.state !== 'merged'" class="flex items-center gap-1.5 opacity-70 min-w-0">
                      <i class="ph ph-check-circle shrink-0 text-success"></i><span class="truncate" x-text="'No loose ends' + (facts && !blocker ? ' · nothing blocks it' : '')"></span></div>
                    <div x-show="(c.loose || []).length" class="flex items-center gap-1.5 text-warning">
                      <i class="ph ph-circle-dashed shrink-0"></i><span x-text="(c.loose || []).length + ' loose ' + ((c.loose || []).length === 1 ? 'end' : 'ends')"></span></div>
                  </div>
                  <!-- The verdict circle: in the deck's header when hosted,
                       here, top right, on the call's own page. -->
                  <span x-show="!hosted" class="ml-auto shrink-0" x-init="hosted || $el.replaceChildren(verdictEl())"></span>
                </div>
                <div class="grid gap-0.5 text-sm">
                  <template x-for="x in (c.loose || [])" :key="x">
                    <div class="flex gap-1.5 leading-snug text-warning"><i class="ph ph-circle-dashed mt-0.5 shrink-0"></i><span x-text="x"></span></div>
                  </template>
                  <div x-show="!hosted && facts?.state === 'merged'" class="opacity-70">Already merged.</div>
                  <div x-show="!hosted && !(c.loose || []).length && facts?.state !== 'merged'" class="flex items-center gap-1.5 opacity-70">
                    <i class="ph ph-check-circle text-success"></i><span x-text="'No loose ends' + (facts && !blocker ? ' · nothing blocks it' : '')"></span></div>
                </div>
              </div>
            </template>
            <!-- The PR as one compact chip in its state's colour, as the
                 session page draws a branch; its facts speak only when they
                 are a reason not to answer yet. -->
            <p x-show="c.brief && !chained" class="text-base leading-snug">
              <span class="text-base-content/80" x-html="ann(c.brief)"></span>
              <button type="button" x-show="pr" data-pr-chip @click="togglePr($el)"
                 class="ml-1 inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 align-middle hover:bg-base-200"
                 :class="tone(facts?.state)" :aria-expanded="prOpen ? 'true' : 'false'">
                <i class="ph ph-git-pull-request"></i><span x-text="'#' + (pr?.n || '')"></span></button>
            </p>
            <!-- WHERE IT SITS: the decision in the structure it serves, a design
                 from the template route with this call's block open and ringed,
                 so the question is understood before its materials. -->
            <!-- The scroll sits one level in: a grid item that scrolls has an
                 automatic minimum height of zero, so a card at its max height
                 squeezed it and clipped the open block. A plain item keeps its
                 content's height, and the card scrolls instead. -->
            <!-- TWO WAYS INTO THE QUESTION, a tab each and a swipe between them:
                 the diagram, and the question said plainly (the call's question and
                 brief, as text at the card's full width). Each view is one track
                 wide, and the strip is as tall as the taller, so switching never
                 moves what is below; it scrolls sideways and the tabs follow it. -->
            <div x-show="c.tree" :class="!chained && 'border-t border-base-200 pt-2'">
              <!-- The tabs scroll sideways when they outrun a phone. The views
                   keep one fixed height, each scrolling inside it, so a long
                   view never pushes the answers down. -->
              <div x-show="chained" role="tablist" aria-label="The question"
                   class="tabs tabs-border tabs-sm -mt-1 mb-1 flex-nowrap overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <template x-for="(t, i) in views" :key="t.k">
                  <button type="button" role="tab" class="tab shrink-0" :class="view === i && 'tab-active'" :aria-selected="String(view === i)" @click="showView(i)" x-text="t.label"></button>
                </template>
              </div>
              <div x-ref="views" @scroll.passive="onViews()" :class="chained && 'h-[min(20rem,44vh)] sm:h-[15rem]'"
                   class="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div class="w-full min-w-full shrink-0 snap-start h-full overflow-y-auto overscroll-y-contain" role="tabpanel">
                  <div x-show="!chainHTML" class="text-sm opacity-50" x-text="chainErr || 'Reading where this sits…'"></div>
                  <div class="overflow-x-auto pb-2 pl-1.5" x-html="chainHTML"></div>
                </div>
                <div x-show="chained" class="w-full min-w-full shrink-0 snap-start h-full overflow-y-auto overscroll-y-contain grid grid-cols-[minmax(0,1fr)] content-start gap-2 pb-2 pl-1.5" role="tabpanel">
                  <div class="text-lg font-semibold leading-snug" x-html="ann(c.question)"></div>
                  <p x-show="c.brief" class="leading-snug text-base-content/80" x-html="ann(c.brief)"></p>
                  <p x-show="ta" class="leading-snug"><span class="font-semibold" x-text="'Recommended: ' + c.recommend"></span><span x-show="c.why" class="text-base-content/70" x-text="', since ' + c.why"></span></p>
                </div>
                <!-- Questions anyone would ask, each answered short. -->
                <div x-show="chained && vw?.questions?.length" class="w-full min-w-full shrink-0 snap-start h-full overflow-y-auto overscroll-y-contain grid grid-cols-[minmax(0,1fr)] content-start gap-3 pb-2 pl-1.5 pr-1" role="tabpanel">
                  <template x-for="(x, i) in (vw?.questions || [])" :key="i">
                    <div class="leading-snug">
                      <div class="font-semibold" x-text="x.q"></div>
                      <div class="text-base-content/80"><span x-text="x.a"></span>
                        <button x-show="seeLabel(x.see)" type="button" @click.stop="goSee(x.see)" data-see
                          class="ml-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-base-100))] bg-primary/5 px-2 align-[0.1em] text-xs leading-5 text-primary hover:bg-primary/10">
                          <i class="ph ph-arrow-down shrink-0"></i><span class="truncate" x-text="seeLabel(x.see)"></span></button></div>
                    </div>
                  </template>
                </div>
                <!-- A radio opener: the question as a host would sell it. -->
                <div x-show="chained && vw?.radio?.lines?.length" class="w-full min-w-full shrink-0 snap-start h-full overflow-y-auto overscroll-y-contain grid grid-cols-[minmax(0,1fr)] content-start gap-2 pb-2 pl-1.5 pr-1" role="tabpanel">
                  <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-error/80">
                    <span class="inline-block size-2 rounded-full bg-error/80"></span><span x-text="vw?.radio?.title || 'On air'"></span></div>
                  <template x-for="(l, i) in (vw?.radio?.lines || [])" :key="i">
                    <p class="leading-relaxed" :class="l.startsWith('[') ? 'text-sm italic text-base-content/55' : ''" x-text="l"></p>
                  </template>
                </div>
                <!-- Pip and Pap, talking the question down to size. -->
                <div x-show="chained && vw?.dialog?.length" class="w-full min-w-full shrink-0 snap-start h-full overflow-y-auto overscroll-y-contain grid grid-cols-[minmax(0,1fr)] content-start gap-2 pb-2 pl-1.5 pr-1" role="tabpanel">
                  <template x-for="(d, i) in (vw?.dialog || [])" :key="i">
                    <div class="flex items-end gap-2" :class="d.who === 'pap' && 'flex-row-reverse'">
                      <span class="inline-flex" x-html="sprite(d.who)" :aria-label="castName(d.who)"></span>
                      <div class="min-w-0 max-w-[82%] rounded-2xl px-3 py-1.5 leading-snug"
                           :class="d.who === 'pap' ? 'rounded-br-sm bg-[color-mix(in_oklab,var(--color-warning)_16%,var(--color-base-100))]' : 'rounded-bl-sm bg-[color-mix(in_oklab,var(--color-info)_12%,var(--color-base-100))]'">
                        <span x-text="d.line"></span>
                        <button x-show="seeLabel(d.see)" type="button" @click.stop="goSee(d.see)" data-see
                          class="ml-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-base-100))] bg-primary/5 px-2 align-[0.1em] text-xs leading-5 text-primary hover:bg-primary/10">
                          <i class="ph ph-arrow-down shrink-0"></i><span class="truncate" x-text="seeLabel(d.see)"></span></button></div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <p x-show="blocker" class="text-sm text-warning flex items-center gap-1">
              <i class="ph ph-warning-circle"></i><span x-text="blocker"></span></p>
            <p x-show="c.recommend && !(ta && chained)" class="text-sm opacity-70">
              <i class="ph ph-star-four text-primary"></i>
              <span x-text="'I recommend ' + c.recommend + (c.why ? ': ' + c.why : '.')"></span></p>
            <!-- A DOCUMENTATION CALL is answered here, on the document itself:
                 md-diff draws the file with each edit as a container that
                 swipes between the old text, both, and the new, and Keep,
                 Discard and Note sit on the container. A head that stays at
                 the top names the file, counts the decisions and links the
                 file's diff on the call's PR. Record sends one line for the
                 whole call once every edit is decided. -->
            <template x-if="c.kind === 'documentation'">
              <div class="flex flex-col gap-2" data-doc-edits>
                <div class="sticky -top-2.5 z-30 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-base-300 bg-base-100 px-4 py-2 text-sm" data-doc-head>
                  <span class="flex min-w-0 items-center gap-1.5"><i class="ph ph-file-text shrink-0"></i><span class="break-all font-mono" x-text="docPath"></span></span>
                  <span class="opacity-70" x-text="docCount"></span>
                  <div x-show="doc.ready" class="join" role="radiogroup" aria-label="Show the document" data-doc-views>
                    <template x-for="v in ['old', 'changes', 'new']" :key="v">
                      <button type="button" role="radio" class="join-item btn btn-xs" :class="docView === v ? 'btn-primary' : 'btn-ghost border-base-300'"
                              :aria-checked="String(docView === v)" @click="docShow(v)" :data-doc-view="v" x-text="{ old: 'Old', changes: 'Changes', new: 'New' }[v]"></button>
                    </template>
                  </div>
                  <div class="basis-full empty:hidden" data-doc-controls></div>
                </div>
                <p x-show="doc.err" class="text-sm text-error" x-text="doc.err"></p>
                <span x-show="!doc.ready && !doc.err" class="loading loading-dots loading-sm"></span>
                <div class="min-w-0" x-init="docAt($el)" data-doc-host></div>
                <template x-for="i in docUnplaced" :key="i">
                  <p class="text-sm opacity-70" :data-doc-unplaced="i + 1" x-text="'Edit ' + (i + 1) + ': ' + docStanding(i) + '.'"></p>
                </template>
                <div x-show="doc.ready && !done" class="flex flex-nowrap items-center gap-2">
                  <input type="text" class="input input-sm min-w-0 flex-1" placeholder="Note on the whole call" x-model="doc.note">
                  <button type="button" class="btn btn-sm btn-primary shrink-0 gap-1.5" :disabled="busy || docOpen > 0" @click="sendDoc()" data-doc-send>
                    <i class="ph ph-paper-plane-tilt"></i><span x-text="docOpen ? docOpen + ' to decide' : 'Record'"></span></button>
                </div>
                <p x-show="sendErr" class="text-sm text-error" x-text="sendErr"></p>
                <span x-show="done" class="text-sm opacity-70" x-text="'Answered: ' + done"></span>
              </div>
            </template>
            <!-- THE ANSWERS, in plain view, for a decision: a tap picks one and
                 a second tap lets it go. Take carries the recommendation and
                 sends from here; Adjust brings up its form below, which sends
                 from there. Once answered, the answer that stands stays lit
                 and the other steps back. An older call's options keep their
                 star and send from the note row. A merge is approved from its
                 circle and a documentation call from its edits, so
                 neither has this row. -->
            <div x-show="isDecision && answerOpts.length" class="flex items-center gap-1.5" :class="ta ? 'flex-nowrap max-sm:flex-wrap' : 'flex-wrap'" role="radiogroup" :aria-label="c.question" data-answers>
              <template x-for="o in answerOpts" :key="o">
                <button type="button" role="radio" :aria-checked="String(pick === o || done === o)" :data-title-tip="optTitle(o)"
                        @click="pickOpt(o)" class="btn btn-sm gap-1.5" :class="[optClass(o), ta && o === 'Take' ? 'min-w-0 shrink flex-nowrap' : 'shrink-0']" :data-option="o">
                  <i x-show="done === o" class="ph ph-check-circle"></i>
                  <i x-show="ta && done !== o" class="ph" :class="o === 'Take' ? 'ph-check' : 'ph-pencil-simple'"></i>
                  <i x-show="!ta && o === c.recommend && done !== o" class="ph ph-star-four"></i>
                  <span class="shrink-0" x-text="ta && o === 'Take' ? 'Take:' : o"></span>
                  <span x-show="ta && o === 'Take'" class="truncate font-normal" x-text="c.recommend"></span></button>
              </template>
              <button type="button" x-show="ta && pick === 'Take'" data-send @click="send()" :disabled="busy"
                      class="btn btn-sm btn-ghost shrink-0 gap-1 border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10 text-primary hover:bg-primary/15"
                      :data-title-tip="'Send Take' + (comment && pr ? ', and post it on #' + pr.n : '')" aria-label="Send">
                <span x-show="busy" class="loading loading-spinner loading-xs"></span>
                <i x-show="!busy" class="ph ph-paper-plane-tilt"></i><span class="max-sm:hidden">Send</span></button>
              <!-- On a phone the chip is its glyph alone and gives way to Send,
                   so the answers keep one line; it wraps below them before the
                   recommendation is cut. -->
              <button type="button" x-show="ta && chained && !hosted && pr" data-pr-chip @click="togglePr($el)"
                 class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 text-sm leading-6 hover:bg-base-200"
                 :class="[tone(facts?.state), pick === 'Take' ? 'max-sm:hidden' : '']" :aria-expanded="prOpen ? 'true' : 'false'" :data-title-tip="pr?.label" :aria-label="pr?.label">
                <i class="ph ph-git-pull-request"></i><span class="max-sm:hidden" x-text="'#' + (pr?.n || '')"></span></button>
            </div>
            <!-- What is typed here rides with the picked answer. The input
                 leads at a width it keeps from sm up, so "Post on", the PR chip
                 and Send sit beside it rather than at the far edge. Where the
                 tree stands in for the question, the chip names the PR the
                 answer posts on, and it stays once the call is answered. One
                 line at a phone's width: the input gives up room, and "Post on"
                 drops its words below 22rem. -->
            <div x-show="!ta && (canNote || (chained && !hosted && pr))" class="flex items-center gap-2" data-note-row>
              <input x-show="canNote" type="text" x-ref="noteIn" class="input input-sm input-bordered grow min-w-0 basis-0 sm:max-w-sm" x-model="note"
                     @keydown.enter="pick && send()" :placeholder="chained && !hosted ? 'Say more' : 'Say more with your answer (optional)'">
              <label x-show="canNote && pr" class="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm opacity-80" :data-title-tip="'Comments the answer on ' + (pr?.label || '') + ', which wakes a subscribed session'">
                <input type="checkbox" class="checkbox checkbox-xs" x-model="comment"><span class="max-[22rem]:hidden" x-text="chained && !hosted ? 'Post on' : 'Post on #' + (pr?.n || '')"></span></label>
              <button type="button" x-show="chained && !hosted && pr" data-pr-chip @click="togglePr($el)"
                 class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 text-sm leading-6 hover:bg-base-200"
                 :class="tone(facts?.state)" :aria-expanded="prOpen ? 'true' : 'false'" :data-title-tip="pr?.label">
                <i class="ph ph-git-pull-request"></i><span x-text="'#' + (pr?.n || '')"></span></button>
              <button type="button" x-show="canNote" data-send @click="send()" :disabled="!!(!pick || busy)"
                      class="btn btn-sm btn-ghost shrink-0 gap-1 border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10 text-primary hover:bg-primary/15" :data-title-tip="pick ? 'Send ' + pick : 'Pick an answer first'">
                <span x-show="busy" class="loading loading-spinner loading-xs"></span>
                <i x-show="!busy" class="ph ph-paper-plane-tilt"></i><span>Send</span></button>
            </div>
            <div x-show="sendErr && c.kind !== 'merge'" class="text-sm text-error" x-text="sendErr"></div>
            <!-- The merge's detail, after the answer rather than before it:
                 what shipped, and what changes once it is on main. -->
            <template x-if="c.kind === 'merge'">
              <div class="grid gap-1.5 border-t border-base-200 pt-2">
                <!-- Each shipped line with its proof: the chip swipes the pane
                     below to the file or page that shows it, named in a pill. -->
                <template x-for="x in (c.shipped || [])" :key="shipText(x)">
                  <!-- A head row, the topic in bold and its proof beside it,
                       then the detail: scanned by the heads, read below. The
                       leading glyph is the kind of change (CHANGE_KIND), and the
                       kind decides the detail's shape: Old and New for a change
                       or a fix, New alone for an addition or a record, Old
                       alone for a removal. -->
                  <div class="flex gap-2.5 leading-snug">
                    <span class="mt-0.5 size-5 shrink-0 rounded-full inline-flex items-center justify-center text-xs" :class="kindOf(x).tone" data-title-tip-bare :data-title-tip="kindOf(x).label">
                      <i class="ph-bold" :class="kindOf(x).icon"></i></span>
                    <div class="grid gap-0.5 min-w-0">
                      <div class="flex items-center gap-2 min-w-0">
                        <span x-show="x?.head" class="font-semibold shrink-0" x-text="x?.head"></span>
                        <button type="button" x-show="shipProof(x)" @click="showProof(x)"
                                class="inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 hover:brightness-95 max-w-full min-w-0"
                                :class="KIND_TONE[proofMark(x).kind] || 'bg-base-200 border-base-300'"
                                :data-title-tip="'Show ' + (proofMark(x).label || 'the proof') + ' below'">
                          <i class="ph shrink-0" :class="proofMark(x).icon"></i><span class="truncate" x-text="proofMark(x).label"></span></button>
                      </div>
                      <!-- Old and New as small badges, one width so the text
                           behind them lines up. -->
                      <div x-show="x?.old || x?.new" class="grid gap-0.5 text-sm">
                        <div x-show="x?.old" class="flex items-baseline gap-1.5">
                          <span class="w-7 shrink-0 rounded text-center text-[10px] font-semibold uppercase tracking-wide leading-4 bg-base-200 text-base-content/50">old</span>
                          <span class="opacity-60" x-text="x?.old"></span></div>
                        <div x-show="x?.new" class="flex items-baseline gap-1.5">
                          <span class="w-7 shrink-0 rounded text-center text-[10px] font-semibold uppercase tracking-wide leading-4 bg-primary/10 text-primary">new</span>
                          <span x-text="x?.new"></span></div>
                      </div>
                      <span x-show="typeof x === 'string' || x?.text" :class="x?.head && 'text-sm opacity-75'" x-text="typeof x === 'string' ? x : x?.text"></span>
                    </div>
                  </div>
                </template>
                <div x-show="c.effect" class="leading-snug opacity-80">
                  <span class="text-xs uppercase tracking-wide opacity-60 mr-1">On main</span><span x-text="c.effect"></span></div>
                <!-- Not merging is not a button: it is a message. Whatever is
                     typed here goes to the session, posted on the PR, and the
                     PR stays open. -->
                <div x-show="!done && !c.closed" class="flex items-center gap-2 border-t border-base-200 pt-2 mt-1">
                  <input type="text" x-ref="msgIn" class="input input-sm input-bordered grow min-w-0" placeholder="Or message the session instead of merging"
                         x-model="note" @keydown.enter="note.trim() && sendNow('Message')">
                  <button type="button" class="btn btn-sm btn-ghost btn-square shrink-0" data-title-tip="Send the message; don't merge"
                          @click="sendNow('Message')" :disabled="!!busy || !note.trim()">
                    <span x-show="busy && pick === 'Message'" class="loading loading-spinner loading-xs"></span>
                    <i x-show="!(busy && pick === 'Message')" class="ph ph-paper-plane-tilt text-lg"></i></button>
                </div>
                <div x-show="sendErr" class="text-sm text-error" x-text="sendErr"></div>
                <div x-show="done" class="text-sm flex items-center gap-1.5"
                     :class="done === 'Merge' ? 'text-success' : 'opacity-70'">
                  <i class="ph" :class="done === 'Merge' ? 'ph-check-circle' : 'ph-chat-circle-text'"></i>
                  <span x-text="done === 'Merge' ? 'Confirmed: the session merges it.' : 'Message sent; not merging.'"></span></div>
              </div>
            </template>
            <div x-show="answers.length || c.closed" class="text-sm opacity-70 grid gap-0.5">
              <template x-for="a in answers" :key="a.at">
                <div class="flex flex-wrap items-center gap-x-1.5">
                  <i class="ph ph-check-circle text-success"></i>
                  <span x-text="'Answered ' + a.answer + (a.then ? ', then ' + (a.then === 'go' ? 'go' : 'come back') : '') + ' · ' + ago(a.at)"></span>
                  <span x-show="a.note" class="italic" x-text="'“' + a.note + '”'"></span>
                  <a x-show="a.comment" :href="a.comment" target="_blank" rel="noopener" class="link">comment ↗</a>
                </div>
              </template>
              <div x-show="c.closed" x-text="'Closed: ' + (c.closed?.answer || '')"></div>
            </div>
          </div>

          <!-- The verdict menu, dropped from the circle: the call's answers
               as rows, the recommended one marked. Picking one sends it. -->
          <div x-show="vOpen" role="menu" aria-label="Answer"
               @click.outside="if (!$event.target.closest('[data-verdict]')) vOpen = false" @keydown.escape.window="vOpen = false"
               class="fixed z-[1000] w-64 rounded-xl border border-base-300 bg-base-100 shadow-lg py-1"
               :style="vAt ? 'left:' + vAt.x + 'px;top:' + vAt.y + 'px' : ''">
            <template x-for="v in verdicts" :key="v.o">
              <button type="button" role="menuitem" @click="choose(v)"
                      class="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-base-200">
                <i class="ph text-lg mt-0.5 shrink-0" :class="[v.icon, v.tone]"></i>
                <span class="grid min-w-0"><span class="font-medium" x-text="v.label"></span>
                  <span x-show="v.hint" class="text-xs opacity-60" x-text="v.hint"></span></span>
              </button>
            </template>
          </div>

          <!-- The PR's panel, the one the session page drops from a branch
               chip: repo and PR, its title, one facts line, and the two ways
               into the branch. kits/panel-tip.js owns the way out. -->
          <div x-ref="prTip" x-show="prOpen" role="dialog" aria-label="Pull request"
               class="fixed z-[1000] rounded-xl border border-base-300 bg-base-100 shadow-lg px-4 py-3 text-sm leading-6"
               :style="prAt ? 'left:' + prAt.x + 'px;top:' + prAt.y + 'px;width:' + prAt.w + 'px' : ''">
            <div x-html="prClose"></div>
            <div class="grid gap-1.5 pr-6">
              <div class="flex items-center gap-2 min-w-0 -my-1">
                <i class="ph ph-git-branch text-lg shrink-0"></i>
                <span class="font-medium text-base truncate" x-text="(pr?.slug || '').split('/').pop()"></span>
                <span class="shrink-0 rounded-full border px-2 font-mono text-xs leading-5" :class="tone(facts?.state)"
                      x-text="'#' + (pr?.n || '') + (facts?.state ? ' ' + facts.state : '')"></span>
                <span class="grow"></span>
                <button type="button" class="btn btn-ghost btn-sm btn-square text-primary shrink-0" @click="openBranch()"
                        data-title-tip="Open the branch here"><i class="ph ph-cards-three text-lg"></i></button>
                <a :href="branchHref()" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-square shrink-0"
                   data-title-tip="Open the branch page"><i class="ph ph-arrow-square-out text-lg"></i></a>
              </div>
              <div x-show="facts?.title" class="leading-snug" x-text="facts?.title"></div>
              <div class="flex items-baseline gap-1.5 min-w-0 font-mono text-xs opacity-60">
                <span class="truncate min-w-0" x-text="shortBranch()"></span>
                <span class="shrink-0 whitespace-nowrap"
                      x-text="[facts?.commits != null ? '· ' + facts.commits + ' commits' : '', facts?.files != null ? '· ' + facts.files + ' files' : '',
                               facts?.updated ? '· ' + ago(facts.updated) : ''].filter(Boolean).join(' ')"></span>
              </div>
              <div x-show="blocker" class="text-warning flex items-center gap-1"><i class="ph ph-warning-circle"></i><span x-text="blocker"></span></div>
            </div>
          </div>

          <!-- The materials: branch-brief's Files pane, as a swiper. The head
               row keeps one height on every slide, its full-screen button held
               in place (invisible where a slide has nothing to open) and sized
               to the row: a row that grew 12px on a document slide and shrank
               on the Notes resized the strip mid-swipe, and iOS stops snapping
               a track whose box changes while it scrolls (swipe-deck's note by
               go(), from pages/probe-snap.html). -->
          <div x-show="mats.length" data-swipe-section
               @pointerenter="hovered = true" @pointerleave="hovered = false" @pointerdown="hovered = true"
               class="relative flex-1 min-h-0 flex flex-col rounded-xl border border-base-300 bg-base-100 overflow-hidden">
            <div class="shrink-0 flex h-10 items-center gap-2 px-3 border-b border-base-300 bg-base-200/60 min-w-0">
              <button type="button" data-mat-list-btn @click="listOpen = !listOpen"
                      class="btn btn-sm btn-square btn-ghost shrink-0 -ml-1" :class="listOpen && 'bg-primary/10 text-primary'"
                      :data-title-tip="listOpen ? 'Back to the file' : 'Contents'">
                <i class="ph text-lg" :class="listOpen ? 'ph-caret-up' : mats[at]?.icon"></i></button>
              <span class="truncate text-sm" x-text="mats[at]?.label"></span>
              <!-- GitHub only as its own mark beside the name, never as the
                   way to open a thing: the estate's rule for any file. -->
              <a x-show="mats[at]?.gh" :href="mats[at]?.gh" target="_blank" rel="noopener"
                 class="btn btn-ghost btn-xs btn-square shrink-0 opacity-50 hover:opacity-100" data-title-tip="On GitHub">
                <i class="ph ph-github-logo text-base"></i></a>
              <span class="grow"></span>
              <div x-show="mats.length > 1" class="flex items-center shrink-0">
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at - 1)" :disabled="at <= 0">
                  <i class="ph ph-caret-left"></i></button>
                <span class="font-mono text-xs opacity-60 tabular-nums px-1" x-text="(at + 1) + '/' + mats.length"></span>
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at + 1)" :disabled="at >= mats.length - 1">
                  <i class="ph ph-caret-right"></i></button>
              </div>
              <!-- Full screen is a deck over this one, not a new tab: back
                   returns here, at the slide the reader left. -->
              <button type="button" @click="expand()" :disabled="!mats[at]?.peek" :aria-hidden="mats[at]?.peek ? null : 'true'"
                      class="btn btn-sm btn-square btn-ghost shrink-0" :class="!mats[at]?.peek && 'invisible'" :data-title-tip="deckDoor.title" :aria-label="deckDoor.title">
                <i class="ph text-lg" :class="deckDoor.icon"></i></button>
            </div>
            <div x-show="listOpen" @click.outside="if (!$event.target.closest('[data-mat-list-btn]')) listOpen = false"
                 class="absolute left-1 top-11 z-20 w-80 max-w-[calc(100%-0.5rem)] max-h-[calc(100%-3.25rem)] overflow-y-auto
                        rounded-xl border border-base-300 bg-base-100 shadow-xl">
              <template x-for="(m, i) in mats" :key="i">
                <button type="button" @click="listOpen = false; go(i)"
                        class="flex w-full items-center gap-2.5 border-b border-base-200 px-3 py-2 text-left"
                        :class="i === at ? 'bg-primary/10' : 'hover:bg-base-200/60'">
                  <span class="w-5 shrink-0 text-right font-mono text-xs tabular-nums" :class="i === at ? 'text-primary' : 'opacity-40'" x-text="i + 1"></span>
                  <i class="ph shrink-0 opacity-50" :class="m.icon"></i>
                  <span class="truncate text-sm" :class="i === at && 'font-semibold text-primary'" x-text="m.label"></span>
                </button>
              </template>
            </div>
            <div x-ref="strip" @scroll.passive="onStrip()"
                 class="flex-1 min-h-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <template x-for="(m, i) in mats" :key="i">
                <div data-slide class="relative w-full shrink-0 snap-center min-h-0">
                  <template x-if="m.peek?.kind === 'html' && (Math.abs(i - at) <= 1 || seen[i])">
                    <iframe :src="m.peek.url" x-init="seen[i] = true" class="absolute inset-0 w-full h-full border-0 bg-base-100"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                  </template>
                  <template x-if="m.peek?.kind === 'md' || m.peek?.kind === 'text'">
                    <div x-init="fill(m.peek)" class="absolute inset-0 overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap px-4 py-3 text-base leading-7
                                [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_p]:my-2
                                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:link [&_code]:font-mono
                                [&_code]:text-sm [&_table]:text-sm [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6
                                [&_th]:text-left [&_th]:pr-3 [&_td]:pr-3 [&_td]:align-top [&_th:first-child]:whitespace-nowrap [&_td:first-child]:whitespace-nowrap"
                         x-html="m.peek.html || ''"></div>
                  </template>
                  <!-- THE NOTES: the question a reader has at each mark and its
                       answer, one row each. The pinned or pointed-at note is
                       tinted, and its mentions light in the card above. -->
                  <template x-if="m.kind === 'notes'">
                    <div data-notes @click="noteClick($event)"
                         class="absolute inset-0 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-20 grid content-start gap-0.5 text-[15px] leading-snug
                                [&_[data-lit]]:rounded-[3px] [&_[data-lit]]:bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)]">
                      <template x-for="n in notes" :key="n.id">
                        <div :data-note="n.id" role="button" tabindex="0" @keydown.enter.prevent="pinNote(n.id)" :aria-pressed="String(pin === n.id)"
                             class="rounded-lg border px-3 py-2 cursor-pointer transition-colors"
                             :class="act?.id === n.id ? 'border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10' : 'border-transparent hover:bg-base-200/60'">
                          <span class="font-semibold" x-text="n.asks"></span>
                          <span x-text="n.aside"></span>
                          <a x-show="n.link" :href="entHref(n.link)" target="_blank" rel="noopener" class="ml-0.5 text-primary hover:opacity-70"
                             :data-title-tip="entSource(n.link)" :aria-label="'Open ' + entSource(n.link)"><i class="ph ph-arrow-up-right align-[-0.1em]"></i></a>
                        </div>
                      </template>
                    </div>
                  </template>
                  <!-- THE ADJUSTMENT: what to change, and whether the session
                       goes ahead or comes back with a new call first. Typing
                       picks Adjust; Send sends from here, as Take sends from
                       the card. -->
                  <template x-if="m.kind === 'adjust'">
                    <div data-adjust class="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-20 grid content-start gap-3">
                      <p class="leading-snug"><span class="text-base-content/60">Adjusting the recommendation:</span> <span class="font-semibold" x-text="c.recommend"></span></p>
                      <textarea x-model="note" @input="pick = 'Adjust'" @keydown.ctrl.enter="sendAdjust()" @keydown.meta.enter="sendAdjust()" rows="3"
                                class="textarea textarea-bordered w-full text-base leading-snug" placeholder="What should change?"></textarea>
                      <!-- Then: two halves of one control, and a line saying what
                           the chosen half sets off. -->
                      <div class="grid gap-1">
                        <div role="radiogroup" aria-label="Then" class="grid grid-cols-2 gap-1.5">
                          <template x-for="t in THEN" :key="t.k">
                            <button type="button" role="radio" :aria-checked="String(then === t.k)" @click="then = t.k" :data-then="t.k"
                                    class="btn btn-sm btn-ghost min-w-0 flex-nowrap gap-1.5 border"
                                    :class="then === t.k ? 'border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10 text-primary hover:bg-primary/15' : 'border-base-300'">
                              <i class="ph shrink-0" :class="t.icon"></i><span class="truncate" x-text="t.label"></span></button>
                          </template>
                        </div>
                        <p class="text-sm leading-snug text-base-content/70" x-text="THEN.find((t) => t.k === then)?.hint"></p>
                      </div>
                      <div class="flex items-center gap-2">
                        <label x-show="pr" class="flex items-center gap-1.5 whitespace-nowrap text-sm opacity-80" :data-title-tip="'Comments the answer on ' + (pr?.label || '') + ', which wakes a subscribed session'">
                          <input type="checkbox" class="checkbox checkbox-xs" x-model="comment"><span x-text="'Post on #' + (pr?.n || '')"></span></label>
                        <button type="button" data-adjust-send @click="sendAdjust()" :disabled="!!(!note.trim() || busy)"
                                class="ml-auto btn btn-sm btn-ghost shrink-0 gap-1 border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10 text-primary hover:bg-primary/15"
                                :data-title-tip="note.trim() ? 'Send the adjustment' : 'Say what should change first'">
                          <span x-show="busy" class="loading loading-spinner loading-xs"></span>
                          <i x-show="!busy" class="ph ph-paper-plane-tilt"></i><span>Send</span></button>
                      </div>
                    </div>
                  </template>
                  <template x-if="!m.peek && m.kind !== 'notes' && m.kind !== 'adjust'">
                    <div class="absolute inset-0 flex items-center justify-center p-6">
                      <a :href="m.href" target="_blank" rel="noopener" class="btn btn-soft">
                        <i class="ph" :class="m.icon"></i><span x-text="'Open ' + m.label"></span></a>
                    </div>
                  </template>
                </div>
              </template>
            </div>
            <!-- BREAKING THE WALL: Pip or Pap on the slide showing, one line at
                 a time; a tap on the bubble gives the next, the ✕ sends them off
                 for the rest of the visit. -->
            <!-- Clear of the bottom-right corner, where the app's floating button
                 sits; the ✕ rides the bubble's own corner. -->
            <div x-show="aside && !asidesOff" class="pointer-events-none absolute bottom-2 left-2 right-20 z-10 flex items-end gap-2" data-aside>
              <span class="pointer-events-auto inline-flex drop-shadow-sm" x-html="sprite(aside?.who)" :aria-label="castName(aside?.who)"></span>
              <div class="pointer-events-auto relative max-w-[28rem]">
                <button type="button" @click="asideAt++" class="w-full rounded-2xl rounded-bl-sm border border-base-300 bg-base-100 py-1.5 pl-3 pr-6 text-left text-sm leading-snug shadow-md">
                  <span class="font-semibold" x-text="castName(aside?.who) + ':'"></span> <span x-text="aside?.line"></span>
                  <span x-show="asides.length > 1" class="ml-1 text-xs text-base-content/50" x-text="(asideAt % asides.length + 1) + '/' + asides.length"></span></button>
                <button type="button" @click="asidesOff = true" class="absolute right-0.5 top-0.5 btn btn-ghost btn-xs btn-circle" aria-label="Send them off"><i class="ph ph-x"></i></button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>`;

  const register = function () {
    Alpine.data('userCallForm', function (opts) {
      const o = opts || {};
      // The two strips' drivers (swipeDeck.strip), outside Alpine's reactive state.
      let sd = null, vd = null;
      // A documentation call's rendered document and its changes' edits, as plain DOM.
      let dh = null, dmap = [];
      return {
        description: 'One call: a decision put to the owner, framed above, its materials swiped below, answered in place',

        c: o.call || null, err: '',
        repo: o.repo || STORE, ref: o.ref || 'main', path: o.path || '',
        pick: '', note: '', then: 'go', THEN, comment: false, view: 0, vw: null, asideAt: 0, asidesOff: false, busy: false, sendErr: '', chainHTML: '', chainErr: '', deckReady: !!window.swipeDeck,
        gloss: [], kinds: [], act: null, pin: null, _glossRead: null,
        doc: { base: null, status: [], dec: [], notes: [], note: '', err: '', ready: false }, docView: 'changes',
        prOpen: false, prAt: null, prClose: '', _prWired: false,
        hosted: !!o.onHead, _mark: null, _onKey: null, _vEl: null, vOpen: false, vAt: null, KIND_TONE, facts: null, answers: [], at: 0, listOpen: false, seen: {}, hovered: false, inCard: false, _onBlur: null, _lastFocus: null, _afterGo: null, _offKeys: null,

        get pr() { return prOf(this.c?.pr); },
        // Answers are plain strings; an older call's {label} objects still read.
        get opts() { return (this.c?.options || []).map((o) => typeof o === 'string' ? o : o?.label).filter(Boolean); },
        // A decision filed as Take or Adjust (user-call.py): a recommendation
        // and no options.
        get ta() { return this.isDecision && !this.opts.length && !!this.c?.recommend; },
        get answerOpts() { return this.ta ? ['Take', 'Adjust'] : this.opts; },
        // The materials, then any shipped line's proof not already among
        // them, so every proof has a slide to swipe to.
        get matLinks() {
          const out = [...(this.c?.materials || [])];
          for (const x of this.c?.shipped || []) {
            const p = x && typeof x === 'object' ? x.proof : null;
            if (p && !out.some((l) => l.kind === p.kind && l.ref === p.ref)) out.push(p);
          }
          return out;
        },
        // The deck below. A Take or Adjust call leads with what taking
        // approves, then the notes and the rest, and ends with the Adjust form
        // while it is open. An older call puts the notes first, where there
        // are any, then a slide for each answer that names one (a material's
        // `answer`), in the answers' order, then the rest as filed. `key` and `src` are the filed ref and
        // kind, so a link from the card finds its slide wherever it lands.
        get mats() {
          const links = this.matLinks.map((l) => ({ ...linkOf(l), key: String(l?.ref || ''), src: l?.kind || '', answer: l?.answer || '', field: l?.field || '' }));
          const notes = this.gloss.length || this.chained ? [{ kind: 'notes', key: '#notes', label: 'Notes', icon: 'ph-question', peek: null }] : [];
          if (this.ta) {
            const take = links.filter((m) => m.answer === 'Take');
            const adjust = this.canNote ? [{ kind: 'adjust', key: '#adjust', label: 'Adjust', icon: 'ph-pencil-simple', peek: null }] : [];
            return [...take, ...notes, ...links.filter((m) => !take.includes(m)), ...adjust];
          }
          const ans = this.opts.map((o) => links.find((m) => m.answer === o)).filter(Boolean);
          return [...notes, ...ans, ...links.filter((m) => !ans.includes(m))];
        },
        // The door to full screen is the swipe deck's own entry (kits/swipe-deck.js):
        // its glyph, class and wording, read once the kit is in.
        get deckDoor() {
          const e = this.deckReady && window.swipeDeck?.entry;
          return e ? { icon: e.icon, cls: e.cls('ghost') + ' shrink-0', title: e.title(this.mats.length, 'material') }
                   : { icon: 'ph-cards-three', cls: 'btn btn-sm btn-square btn-ghost shrink-0', title: 'Read the materials one at a time' };
        },
        // Whether the tree stands in for the question and brief: a call with a
        // tree, until the tree fails to read.
        get chained() { return !!this.c?.tree && this.c.kind !== 'merge' && !this.chainErr; },
        // Whether the answer note and its Post-on box are offered.
        get canNote() { return this.c?.kind !== 'merge' && this.c?.kind !== 'documentation' && !this.done && !this.c?.closed; },
        get isDecision() { return (this.c?.kind || 'decision') === 'decision'; },
        // A tap picks an answer, and a tap on the picked one lets it go. Not
        // aria-disabled once answered: daisyUI greys such a button, and the
        // answer that stands has to read.
        // An answer with a slide of its own brings it up when picked; Adjust's
        // is its form, and the form takes the keys.
        pickOpt(o) {
          if (!this.canNote || this.busy) return;
          this.pick = this.pick === o ? '' : o;
          const i = this.pick ? this.mats.findIndex((m) => m.answer === o || (o === 'Adjust' && m.kind === 'adjust')) : -1;
          if (i >= 0) { this.listOpen = false; this.go(i); }
          if (this.ta && this.pick === 'Adjust') setTimeout(() => this._root?.querySelector('[data-adjust] textarea')?.focus({ preventScroll: true }), 450);
        },
        optTitle(o) {
          if (!this.ta) return '';
          return o === 'Take' ? 'Take the recommendation' + (this.c?.why ? ', since ' + this.c.why : '') : 'Say what to change, below';
        },
        // Light fills only, at rest and under the pointer alike: daisyUI's soft
        // buttons fill solid on hover, so the tints are drawn here. Picked is a
        // pale primary, the answer that stands a pale success, and once answered
        // the others step back. Borders are opaque sRGB mixes: a translucent
        // oklab border draws a yellow-green fringe at a rounded corner.
        optClass(o) {
          const d = this.done;
          if (d) return d === o ? 'btn-ghost border-[color-mix(in_srgb,var(--color-success)_60%,var(--color-base-100))] bg-success/20 hover:bg-success/20' : 'btn-ghost border-base-300 opacity-50';
          if (this.pick === o) return 'btn-ghost border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] bg-primary/10 text-primary hover:bg-primary/15';
          return (this.ta ? o === 'Take' : o === this.c?.recommend) ? 'btn-ghost border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-base-100))] text-primary' : 'btn-ghost border-base-300';
        },
        // The glossary's entities, read once; a glossary that cannot be read
        // leaves the call unmarked rather than failing it.
        loadGloss() {
          return this._glossRead || (this._glossRead = (async () => {
            const a = window.RepoAddress.parse(this.c?.glossary);
            if (!a?.ref) return;
            try {
              if (!window.TermMarks) await window.gh.load('kits/term-marks.js');
              const g = JSON.parse((await new window.GH({ token: window.TOKEN, repo: a.repo, ref: a.ref }).get(a.path)).text);
              this.gloss = (g.entities || []).filter((x) => x?.id && (x.terms || []).length && x.asks && x.aside && (x.home === 'here' || x.link));
              // The tree's kinds of step, each a name and its gloss.
              this.kinds = (g.kinds?.steps || []).filter((k) => k?.step && k.name && k.gloss);
            } catch (e) { console.warn('[user-call] glossary not read', e); }
          })());
        },
        // ── Other ways into the question ──────────────────────────────────
        // A call may name a views file (`views`: owner/repo@ref:file.json) that
        // looks at the question sideways, each a tab beside the diagram:
        // plain questions anyone would ask, a radio-style opener, and Pip and
        // Pap talking it down. Any line may point at a slide below (`see`: an
        // answer, a material's label, or Notes), and `asides` let the two
        // comment on a slide while it shows. Read once; a file that cannot be
        // read leaves the diagram and the words.
        loadViews() {
          return this._viewsRead || (this._viewsRead = (async () => {
            const a = window.RepoAddress.parse(this.c?.views);
            if (!a?.ref) return;
            try { this.vw = JSON.parse((await new window.GH({ token: window.TOKEN, repo: a.repo, ref: a.ref }).get(a.path)).text); }
            catch (e) { console.warn('[user-call] views not read', e); }
          })());
        },
        get views() {
          const v = [{ k: 'diagram', label: 'Diagram' }, { k: 'words', label: 'In words' }];
          if (this.vw?.questions?.length) v.push({ k: 'questions', label: 'Questions' });
          if (this.vw?.radio?.lines?.length) v.push({ k: 'radio', label: 'On air' });
          if (this.vw?.dialog?.length) v.push({ k: 'dialog', label: this.castName('pip') + ' & ' + this.castName('pap') });
          return v;
        },
        castName(who) { return this.vw?.cast?.[who]?.name || (who ? who[0].toUpperCase() + who.slice(1) : ''); },
        sprite(who) { return SPRITES[who] || SPRITES.pip; },
        // A slide named by an answer, a material's label, or Notes.
        slideOf(see) { return see ? this.mats.findIndex((m) => m.answer === see || m.label === see || (see === 'Notes' && m.kind === 'notes')) : -1; },
        seeLabel(see) { const i = this.slideOf(see); return i < 0 ? '' : this.mats[i].label; },
        goSee(see) { const i = this.slideOf(see); if (i >= 0) { this.listOpen = false; this.go(i); } },
        // What Pip and Pap say about the slide showing, one line at a time.
        // They go quiet on the Adjust form once the reader starts writing, and on
        // the Notes while a note is pinned, so the bubble never sits over what
        // the reader came to read.
        get asides() {
          const m = this.mats[this.at];
          if (!m || (m.kind === 'adjust' && this.note.trim()) || (m.kind === 'notes' && this.pin)) return [];
          return (this.vw?.asides || []).filter((a) => this.slideOf(a.on) === this.at);
        },
        get aside() { const a = this.asides; return a.length ? a[this.asideAt % a.length] : null; },
        gotoHTML(m) {
          return '<button type="button" data-goto="' + window.esc(m.key) + '"'
            + ' class="ml-1.5 inline-flex shrink-0 items-center self-center rounded text-primary/70 hover:text-primary"'
            + ' data-title-tip="' + window.esc(m.label) + '" aria-label="' + window.esc('Show ' + m.label + ' below') + '"><i class="ph ' + m.icon + '"></i></button>';
        },
        // ── The decision tree ─────────────────────────────────────────────
        // A call names a tree (`tree`: owner/repo@ref:file.json), drawn once the
        // call and its glossary are read (owner, 2026-10-17). Decisions are the nodes: the goal at the
        // root, and each decision under the decision it serves, open or closed.
        // A decision's inquiry (what it waits to know) is an attribute of it, and
        // the inquiry's instrument (how we find out) an attribute of the inquiry,
        // since it is the inquiry it answers: plain lines under the pill, the
        // instrument a step in from its inquiry, never parents of another
        // decision, so the tree has one link, "serves".
        // A closed decision shows the path not taken. The call's own decision,
        // the one whose `call` is this call's id, is ringed. A material whose
        // `field` names a node (`two-steps`) or an attribute (`two-steps.inquiry`)
        // hangs a link on that line.
        async loadTree() {
          const a = window.RepoAddress.parse(this.c?.tree);
          try {
            if (!a?.ref) throw new Error('a tree reads owner/repo@ref:path.json');
            if (!window.TermMarks) await window.gh.load('kits/term-marks.js');
            await this.loadGloss();
            const t = JSON.parse((await new window.GH({ token: window.TOKEN, repo: a.repo, ref: a.ref }).get(a.path)).text);
            const box = document.createElement('div');
            box.innerHTML = this.treeHTML(t);
            if (this.gloss.length) window.TermMarks.mark(box, this.gloss);
            this.markUp(box);
            for (const x of this.mats) {
              const n = x.field && box.querySelector('[data-node="' + CSS.escape(x.field) + '"]');
              const line = n && (n.matches('[data-line]') ? n : n.querySelector(':scope > [data-line]'));
              if (line) line.insertAdjacentHTML('beforeend', this.gotoHTML(x));
            }
            this.chainHTML = box.innerHTML;
          } catch (e) { this.chainErr = 'Where this sits could not be read: ' + (e?.message || e); }
        },
        treeHTML(t) {
          const E = window.esc, own = this.c?.id;
          const tip = (k, gloss) => { const x = this.kinds.find((y) => y.step === k); return x ? ' data-title-tip="' + E(x.name + ' · ' + (gloss || x.gloss)) + '" data-title-tip-bare' : ''; };
          // The icon in its kind's colour (--k), its hit area 8px past it.
          const icon = (k, art, size, gloss) => '<span data-step="' + k + '"' + tip(k, gloss) + ' class="relative mt-[0.05em] inline-flex shrink-0 text-[var(--k)] before:absolute before:-inset-2 [&>svg]:' + size + '">' + art + '</span>';
          const PILL = 'inline-flex w-fit max-w-full items-start gap-1.5 rounded-[0.9em] border px-2.5 py-1 ';
          const TINT = 'bg-[color-mix(in_oklab,var(--k)_14%,transparent)] border-[color-mix(in_oklab,var(--k)_45%,transparent)]';
          const attr = (id, a, k, deep) => a?.text ? '<div data-node="' + E(id) + '" data-line class="flex items-start gap-1.5 text-[0.95em] text-base-content/75' + (deep ? ' pl-[1.55em]' : '') + ' [--k:var(--' + (k === 'know' ? 'color-info' : 'color-secondary') + ')]">'
            + icon(k, STEP_ART[k], 'size-[1.2em]') + '<span class="min-w-0">' + E(a.text)
            + (a.result ? ' <span class="whitespace-nowrap font-medium text-base-content/90">' + E(a.result) + '</span>' : '') + '</span></div>' : '';
          const not = (d) => d.not ? '<div class="flex items-baseline gap-1.5 text-[0.95em] text-base-content/55"><span data-glue class="text-[0.75em] font-semibold uppercase tracking-wide">not</span>'
            + '<s>' + E(d.not) + '</s></div>' : '';
          // A decision's body: its attribute lines, then the decisions that serve
          // it, each joined by a branch; the line down the left runs to the last.
          const body = (d) => {
            const kids = d.decisions || [], q = d.inquiry;
            const attrs = attr(d.id + '.inquiry', q, 'know') + (q?.text ? attr(d.id + '.instrument', q.instrument, 'tool', true) : '') + not(d);
            if (!attrs && !kids.length) return '';
            return '<div class="ml-[0.95em]">'
              + (attrs ? '<div class="grid gap-0.5 pt-1 pl-[1.25em]' + (kids.length ? ' border-l border-base-300' : '') + '">' + attrs + '</div>' : '')
              + (kids.length ? '<ul>' + kids.map((x) => '<li class="relative pl-[1.25em] pt-1.5 before:absolute before:left-0 before:top-[calc(0.375rem+0.95em)] before:w-[1em] before:border-t before:border-base-300'
                + ' after:absolute after:left-0 after:top-0 after:bottom-0 after:border-l after:border-base-300 last:after:bottom-auto last:after:h-[calc(0.375rem+0.95em)]">' + node(x) + '</li>').join('') + '</ul>' : '')
              + '</div>';
          };
          const node = (d) => {
            const closed = d.state === 'closed', mine = d.call && d.call === own;
            const paths = (d.paths || []).map((p, i) => (i ? '<span data-glue> · </span>' : '') + '<b>' + E(p.letter) + '</b> ' + E(p.name)).join('');
            return '<div data-node="' + E(d.id || '') + '" class="' + (closed ? '[--k:color-mix(in_oklab,var(--color-base-content)_45%,transparent)]' : '[--k:var(--color-warning)]') + '">'
              + '<div data-line class="' + PILL + (closed ? 'border-base-300 bg-base-200/50 text-base-content/70' : TINT)
              + (mine ? ' outline-2 outline-offset-2 outline-[var(--color-primary)]" aria-current="step' : '') + '">'
              + icon('decide', closed ? STEP_ART.decided : STEP_ART.decide, 'size-[1.3em]', closed ? 'settled' : '')
              + '<span class="min-w-0">' + E(d.text || '') + (paths ? ' <span class="whitespace-nowrap text-[0.85em] text-base-content/60">' + paths + '</span>' : '') + '</span></div>'
              + body(d) + '</div>';
          };
          const g = t.goal || {};
          return '<div data-tree class="grid pr-1.5 text-[0.875rem] leading-snug">'
            + '<div data-node="goal" class="[--k:var(--color-success)]"><div data-line class="' + PILL + TINT + ' font-semibold shadow-sm">'
            + icon('goal', STEP_ART.goal, 'size-[1.6em]') + '<span class="min-w-0">' + E(g.text || '') + '</span></div>'
            + body({ decisions: t.decisions }) + '</div></div>';
        },
        // A line of the call's own text, escaped, with its entities marked.
        ann(text) {
          const t = String(text || '');
          if (!this.gloss.length || !window.TermMarks) return window.esc(t);
          const el = document.createElement('span');
          el.textContent = t;
          return this.markUp(window.TermMarks.mark(el, this.gloss)).innerHTML;
        },
        // How a marked term looks: a small accent dot raised after it, drawn as the
        // span's ::after so the term's text stays its own. A bullet character, not a
        // box: a box after a word is a place the line may break, which on a phone left
        // the dot at the start of the next line. Never the question-mark
        // cursor (house style rule 11). A pale wash was tried and rejected, and the
        // owner never liked the dotted underline; footnote numerals read as powers
        // beside a call's scores, tinted ink as a link, semibold as emphasis.
        // Focusable, so a keyboard reaches its note too.
        markUp(root) {
          for (const s of root.querySelectorAll('[data-entity]')) {
            s.setAttribute('tabindex', '0');
            s.className = 'outline-offset-2 after:content-[\'•\'] after:ml-px after:align-super after:text-[0.7em] after:leading-none'
              + ' after:text-primary/60 hover:after:text-primary';
          }
          return root;
        },
        // ── The notes ─────────────────────────────────────────────────────
        // Every note sits on one slide, the first of the materials: the call's own
        // question and brief where the tree stands in for them, then each entity
        // the call mentions, in the order a reader meets them (the tree, then the
        // question, then the brief). Pointing at a marked term lights every
        // mention of it, here and in the slide, and marks its note; a click or a
        // tap pins it and brings the slide up with the note in view. Leaving the
        // card goes back to the pinned note, or to none, and a click on anything
        // else in the card clears it. A touch is read only as its click, since it
        // sends its pointer out the moment the finger lifts.
        // Searched from the component's root: called from a handler, $el would be its element.
        lite(id) {
          this._root.querySelectorAll('[data-lit]').forEach((n) => n.removeAttribute('data-lit'));
          if (id) this._root.querySelectorAll('[data-entity="' + CSS.escape(id) + '"]').forEach((n) => n.setAttribute('data-lit', ''));
        },
        show(id) {
          this.act = (id && this.gloss.find((g) => g.id === id)) || null;
          this.lite(this.act?.id);
          if (this.act && this.at === this.notesAt) this.$nextTick(() => this.revealNote(this.act.id));
        },
        get notes() {
          const k = this.gloss.length + '|' + (this.chainHTML || '').length + '|' + this.chained;
          if (this._notes?.k === k) return this._notes.v;
          const v = [], seen = new Set();
          const html = (this.chainHTML || '') + this.ann(this.c?.question) + this.ann(this.c?.brief);
          for (const m of html.matchAll(/data-entity="([^"]+)"/g)) {
            const g = !seen.has(m[1]) && this.gloss.find((x) => x.id === m[1]);
            if (g) { seen.add(g.id); v.push(g); }
          }
          this._notes = { k, v };
          return v;
        },
        get notesAt() { return this.mats.findIndex((m) => m.kind === 'notes'); },
        // The note in view on its slide, scrolled within the slide alone, so the
        // strip's own swipe is not pulled along.
        revealNote(id) {
          const box = this._root.querySelector('[data-notes]'), el = box?.querySelector('[data-note="' + CSS.escape(id) + '"]');
          if (!el) return;
          const top = el.offsetTop - box.offsetTop, bottom = top + el.offsetHeight;
          // Clear of the slide's foot too, where the app's floating button sits.
          if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight - 72) box.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
        },
        // One animation at a time: when the strip has to move, the note is
        // scrolled into view only once it has arrived, since a second smooth
        // scroll started inside a slide while the strip is still moving left
        // the strip short of its stop on iOS.
        toNotes() {
          const i = this.notesAt;
          if (i < 0) return;
          if (this.at === i) { this.$nextTick(() => this.revealNote(this.pin)); return; }
          this._afterGo = () => this.revealNote(this.pin);
          this.go(i);
        },
        pinNote(id) {
          if (this.pin === id) { this.closeNote(); return; }
          this.pin = id; this.show(id);
        },
        // A click on the slide: a note pins itself, and a marked term inside one
        // (the brief's) pins its own note.
        noteClick(e) {
          if (e.target.closest?.('a')) return;
          const s = e.target.closest?.('[data-entity]');
          if (s) { e.preventDefault(); this.pin = s.dataset.entity; this.show(this.pin); return; }
          const n = e.target.closest?.('[data-note]');
          if (n) this.pinNote(n.dataset.note);
        },
        entOver(e) {
          const s = e.target.closest?.('[data-entity]');
          if (s && e.pointerType !== 'touch') this.show(s.dataset.entity);
        },
        entLeave(e) { if (e.pointerType !== 'touch') this.show(this.pin); },
        // Keyboard focus only: a tap focuses the term before its click, and acting on
        // the focus then would move the deck before the click lands.
        entFocus(e) {
          const s = e.target.closest?.('[data-entity]');
          if (s && e.target.matches?.(':focus-visible')) this.show(s.dataset.entity);
        },
        // A click in the card: a block's link brings up its material, a marked term
        // its note; a click on nothing in particular clears it.
        entClick(e) {
          const g = e.target.closest?.('[data-goto]');
          if (g) { e.preventDefault(); this.goKey(g.dataset.goto); return; }
          const s = e.target.closest?.('[data-entity]');
          if (s) { e.preventDefault(); this.pin = s.dataset.entity; this.show(this.pin); this.toNotes(); return; }
          if (!e.target.closest?.('button, a, input, label')) this.closeNote();
        },
        closeNote() { this.pin = null; this.show(null); },
        // Back and forward through the notes in the slide's order. A step pins the
        // note and brings up the slide.
        step(d) {
          const ids = this.notes.map((n) => n.id);
          if (!ids.length) return;
          const i = ids.indexOf(this.act?.id);
          const id = ids[i < 0 ? (d > 0 ? 0 : ids.length - 1) : (i + d + ids.length) % ids.length];
          this.pin = id;
          this.show(id);
          this.toNotes();
        },
        // The question's views: a tab scrolls the strip to its view, and a
        // swipe moves the tab. A view x-show hides is out of the strip, so it
        // is out of the count too, as it is out of the tabs.
        viewDrive() {
          if (!vd && window.swipeDeck?.strip) vd = window.swipeDeck.strip({
            el: () => this.$refs.views, at: () => this.view,
            slides: (s) => [...s.querySelectorAll(':scope > [role="tabpanel"]')].filter((k) => k.style.display !== 'none'),
            onSlide: (i) => { this.view = i; },
          });
          return vd;
        },
        showView(i) { this.view = i; this.viewDrive()?.go(i); },
        onViews() { this.viewDrive()?.scrolled(); },
        // A material by the ref it was filed with, wherever the deck has put it.
        goKey(key) {
          const i = this.mats.findIndex((m) => m.key === key);
          if (i < 0) return;
          this.listOpen = false;
          this.go(i);
        },
        // A glossary link is a URL or owner/repo@ref:path, which opens on GitHub.
        entHref(l) {
          const a = window.RepoAddress.parse(l);
          return a?.ref ? window.RepoAddress.github.blob(a.repo, a.ref, a.path) : l;
        },
        // What the ↗ names: a pull request by number, a file by its name.
        entSource(l) {
          const pr = String(l || '').match(/\/pull\/(\d+)/);
          return pr ? 'PR #' + pr[1] : String(l || '').replace(/[#?].*$/, '').split(/[/:]/).pop();
        },
        shipText(x) { return typeof x === 'string' ? x : x?.text || x?.new || x?.old || ''; },
        kindOf(x) { return CHANGE_KIND[x?.kind] || { icon: 'ph-check', tone: 'bg-success/30 text-success-content', label: 'Shipped' }; },
        shipProof(x) { return x && typeof x === 'object' ? x.proof : null; },
        proofMark(x) { const p = this.shipProof(x); return p ? linkOf(p) : { label: '', icon: '' }; },
        // A proof opens in the materials pane, never away from the page.
        showProof(x) {
          const p = this.shipProof(x);
          const i = p ? this.mats.findIndex((m) => m.src === p.kind && m.key === p.ref) : -1;
          if (i < 0) return;
          this.listOpen = false;
          this.go(i);
          this.$nextTick(() => this.$el.querySelector('[data-swipe-section]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        },
        get done() {
          if (this.c?.closed?.answer) return this.c.closed.answer;
          return this.answers.length ? this.answers[this.answers.length - 1].answer : '';
        },
        tone(s) { return PR_TONE[s] || 'border-base-300'; },
        // Only what would change the answer: a failing check or a conflict.
        get blocker() {
          const f = this.facts;
          if (!f || f.state === 'merged' || f.state === 'closed') return '';
          if (/failing/.test(f.ci || '')) return 'CI is ' + f.ci + ' on this PR.';
          if (f.mergeable === 'dirty') return 'This PR has merge conflicts.';
          return '';
        },
        fill(p) { fillPeek(p); },
        ago(iso) { return window.GH?.ago?.(iso) || ''; },

        init() {
          this._root = this.$el;
          this.$el.innerHTML = TEMPLATE;
          this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
          this.load();
          this.$watch('busy', () => this.paintVerdict());
          this.$watch('at', () => { this.asideAt = 0; });
          this.$watch('answers', () => this.paintVerdict());
          // THE INNER SWIPER TAKES THE ARROWS while the pointer or focus is in
          // it, through swipe-deck's keys() (wireKeys), the one rule every
          // embedded strip shares; this handler stands aside there.
          // THE NOTES TAKE THEM OTHERWISE, while the pointer or focus is in the
          // top card; on a page of its own, with no deck over it, anywhere else too.
          // A form hosted in a deck leaves the arrows outside its card to the
          // deck, which turns slides with them. A step that starts on a focused
          // term moves the focus with the note.
          this._onKey = (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.target && (/^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName) || e.target.isContentEditable)) return;
            const root = this._root;
            if (!root?.isConnected) return;
            const r = root.getBoundingClientRect();
            if (r.width > 0 && (r.right <= 0 || r.left >= window.innerWidth)) return;
            const d = e.key === 'ArrowRight' ? 1 : -1, at = document.activeElement;
            const sec = root.querySelector('[data-swipe-section]'), card = root.querySelector('[data-call-card]');
            const take = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); };
            if (this.hovered || (sec && sec.contains(at))) return;
            const inCard = this.inCard || (card && card.contains(at));
            if (!(this.chained || this.gloss.length) || !(inCard || (!this.hosted && !window.swipeDeck?.top?.()))) return;
            take();
            this.step(d);
            if (at?.matches?.('[data-entity]') && card?.contains(at)) card.querySelector('[data-entity="' + CSS.escape(this.pin) + '"]')?.focus({ preventScroll: true });
          };
          window.addEventListener('keydown', this._onKey, true);
          // A MATERIAL'S FRAME DOES NOT TAKE THE KEYBOARD ON ITS OWN. toss-render
          // focuses its frame once it renders, which is right as a page of its
          // own and wrong inside this form: until the reader clicked, the arrows
          // reached the framed page and never the notes or the swiper. So focus
          // that lands in one of this form's frames before the page has had any
          // user activation goes back to the page; a click into the frame is
          // activation (it propagates to the frame's ancestors) and is left alone.
          // Nor does a frame on a slide that is not showing, which no one can
          // have clicked: a neighbour loading beside the Adjust form took the
          // keys from its note mid-word. Focus goes back where it was.
          this._onBlur = () => setTimeout(() => {
            const a = document.activeElement;
            if (a?.tagName !== 'IFRAME' || !this._root?.contains(a)) return;
            const i = this.panels().indexOf(a.closest('[data-slide]'));
            if ((i >= 0 && i !== this.at) || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) {
              a.blur();
              if (this._lastFocus?.isConnected) this._lastFocus.focus({ preventScroll: true });
            }
          }, 0);
          window.addEventListener('blur', this._onBlur);
          this.$el.addEventListener('focusin', (e) => { if (e.target.tagName !== 'IFRAME') this._lastFocus = e.target; });
        },
        // The strip's Left and Right, by the kit's rule for an embedded strip.
        wireKeys() {
          const sec = this._root?.querySelector('[data-swipe-section]');
          if (!sec || !window.swipeDeck?.keys) return;
          this._offKeys?.();
          this._offKeys = window.swipeDeck.keys(sec, (d) => this.go(this.at + d), () => this.mats.length);
        },
        destroy() {
          this._offKeys?.();
          sd?.destroy(); vd?.destroy(); sd = vd = null;
          if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
          if (this._onBlur) window.removeEventListener('blur', this._onBlur);
        },
        async load() {
          try {
            for (const k of ['kits/guide-render.js']) if (window.gh?.load && !window.GuideRender) await window.gh.load(k).catch(() => {});
            if (!window.TitleTip && window.gh?.load) window.gh.load('kits/title-tip.js').catch(() => {});
            if (!this.c && o.src) {
              const a = window.RepoAddress.parse(o.src);
              if (!a) throw new Error('A call address reads owner/repo[@ref]:user-calls/<id>.json');
              [this.repo, this.ref, this.path] = [a.repo, a.ref || 'main', a.path];
              this.c = JSON.parse((await new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.ref }).get(this.path)).text);
            }
            if (!this.path && this.c?.id) this.path = 'user-calls/' + this.c.id + '.json';
            this.comment = !!this.pr;
            if (this.c?.kind === 'documentation') this.loadDoc();
            this.loadAnswers();
            this.loadGloss();
            this.loadViews();
            this.loadTree();
            // The strips' kit. Once it is here both strips land on their slide
            // and the materials strip takes the arrows (wireKeys).
            const kit = () => { this.deckReady = true; this.drive()?.jump(this.at); this.viewDrive()?.jump(this.view); this.wireKeys(); };
            if (window.swipeDeck) this.$nextTick(kit); else window.gh?.load?.('kits/swipe-deck.js').then(kit).catch(() => {});
            this.head();
            if (this.pr) prFacts(this.c.pr).then((f) => { this.facts = f; this.head(); }).catch(() => {});
          } catch (e) { this.err = 'Could not open this call: ' + (e?.message || e); }
        },
        // ── The deck's header ─────────────────────────────────────────────
        // A host that frames calls in a deck is handed the call's kind and a
        // PR pill for its header, so the form does not repeat what the header
        // already says. The pill is plain DOM, since the header is not ours;
        // it opens the same PR panel the form's own chip does.
        head() {
          if (!o.onHead || !this.c) return;
          const merge = this.c.kind === 'merge';
          let mark = null;
          if (this.pr) {
            mark = this._mark || (this._mark = document.createElement('button'));
            mark.type = 'button';
            mark.setAttribute('data-pr-chip', '');
            mark.className = 'ml-1.5 inline-flex items-center gap-1 rounded-full border px-2 text-xs leading-5 font-normal hover:bg-base-200 shrink-0 ' + this.tone(this.facts?.state);
            // Only the number: the header is narrow, and the panel it opens
            // names the repo.
            mark.dataset.titleTip = this.pr.label;
            mark.innerHTML = '<i class="ph ph-git-pull-request"></i><span>#' + window.esc(this.pr.n) + '</span>';
            mark.onclick = (e) => { e.stopPropagation(); this.togglePr(mark); };
          }
          const doc = this.c.kind === 'documentation';
          o.onHead({ title: merge ? 'Confirm merge' : doc ? 'Documentation' : 'Decision',
                     icon: merge ? 'ph-git-merge' : doc ? 'ph-pencil-line' : 'ph-gavel', mark,
                     // A decision's answers are buttons in the card, so its header carries no circle.
                     action: merge || doc ? this.verdictEl() : null });
        },
        // ── The verdict circle ────────────────────────────────────────────
        // A merge's and a documentation call's; a decision's answers are
        // buttons in the card, since a check reads as approval and a decision
        // approves nothing. The approve page's filled green check, with one change: it starts
        // gray, and a tap drops the answers rather than sending one, so an
        // act that cannot be taken back is two taps and a read. Plain DOM,
        // for the same reason as the pill: a deck's header is not ours.
        get verdicts() {
          if (this.c?.kind === 'merge') return [
            { o: 'Merge', label: 'Approve the merge', icon: 'ph-check-circle', tone: 'text-success', hint: 'The session merges it' },
            { o: 'Message', label: 'Message instead', icon: 'ph-chat-circle-text', tone: 'opacity-70', hint: 'Type below; the PR stays open', msg: true },
          ];
          const rec = this.c?.recommend;
          return [...this.opts].sort((a, b) => (b === rec) - (a === rec)).map((x) => ({
            o: x, label: x, icon: x === rec ? 'ph-star-four' : 'ph-circle', tone: x === rec ? 'text-primary' : 'opacity-50',
            hint: x === rec ? 'Recommended' : '' }));
        },
        verdictEl() {
          if (this._vEl) return this._vEl;
          const b = this._vEl = document.createElement('button');
          b.type = 'button';
          b.setAttribute('data-verdict', '');
          b.onclick = (e) => {
            e.stopPropagation();
            if (this.c?.kind === 'documentation') { this.sendDoc(); return; }
            if (this.done || this.c?.closed || this.busy) return;
            if (this.vOpen) { this.vOpen = false; return; }
            const r = b.getBoundingClientRect();
            this.vAt = { x: Math.max(8, Math.min(r.right - 256, innerWidth - 264)), y: r.bottom + 6 };
            this.vOpen = true;
          };
          this.paintVerdict();
          return b;
        },
        paintVerdict() {
          const b = this._vEl;
          if (!b) return;
          const d = this.done || this.c?.closed?.answer || '';
          const yes = d && d !== 'Message';
          b.className = 'btn btn-sm btn-circle shrink-0 ' + (this.busy ? 'btn-ghost'
            : yes ? 'btn-success' : d ? 'btn-ghost opacity-70' : 'btn-outline border-base-300 text-base-content/40 hover:text-success hover:border-success');
          b.innerHTML = this.busy ? '<span class="loading loading-spinner loading-xs"></span>'
            : '<i class="ph text-lg ' + (d === 'Message' ? 'ph-chat-circle-text' : !d && this.c?.kind === 'documentation' ? 'ph-pencil-line' : 'ph-check') + '"></i>';
          const t = d ? (d === 'Message' ? 'Message sent; not merging' : 'Answered: ' + d)
            : this.c?.kind === 'documentation' ? (this.docOpen ? this.docOpen + ' edits to decide' : 'Record the answer') : 'Answer';
          b.dataset.titleTip = t; b.setAttribute('aria-label', t);
        },
        choose(v) {
          this.vOpen = false;
          if (v.msg) {
            this.$refs.msgIn?.focus();
            this.$refs.msgIn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return;
          }
          this.sendNow(v.o);
        },
        // ── Full screen ───────────────────────────────────────────────────
        // The materials as a deck of their own, over whatever deck holds this
        // form (drill), or over the page when none does: the house pattern
        // for looking at one more thing and coming back.
        async expand() {
          if (window.gh?.load && !window.swipeDeck) await window.gh.load('kits/swipe-deck.js').catch(() => {});
          const deck = window.swipeDeck, mats = this.mats;
          if (!deck || !mats.length) return;
          const parent = deck.top?.();
          const opts = {
            count: mats.length, start: this.at,
            slideScroll: false, innerClass: 'h-full w-full min-w-0',
            icon: mats[this.at].icon, title: mats[this.at].label,
            // Drilled, the parent's title (the call's kind) is prefixed for us.
            subtitle: [parent ? '' : ({ merge: 'Confirm merge', documentation: 'Documentation' }[this.c?.kind] || 'Decision'), this.pr?.label || ''].filter(Boolean).join(' · '),
            index: (i) => ({ title: mats[i].label, icon: mats[i].icon }),
            render: (i, slide) => {
              const m = mats[i], box = document.createElement('div');
              box.className = 'relative h-full w-full';
              if (m.kind === 'notes') {
                const d = document.createElement('div');
                d.className = PROSE + ' absolute inset-0 overflow-y-auto overflow-x-hidden mx-auto max-w-3xl';
                d.innerHTML = this.notes.map((n) => '<p><b>' + window.esc(n.asks) + '</b> ' + window.esc(n.aside) + '</p>').join('');
                box.append(d);
              } else if (m.kind === 'adjust') {
                const d = document.createElement('div');
                d.className = PROSE + ' absolute inset-0 overflow-y-auto mx-auto max-w-3xl';
                d.innerHTML = '<p>The adjustment is written in the call\'s own deck, under the question.</p>';
                box.append(d);
              } else if (m.peek?.kind === 'html') {
                const f = document.createElement('iframe');
                f.src = m.peek.url; f.className = 'absolute inset-0 w-full h-full border-0 bg-base-100';
                f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
                box.append(f);
              } else if (m.peek) {
                const d = document.createElement('div');
                d.className = PROSE + ' absolute inset-0 overflow-y-auto overflow-x-hidden mx-auto max-w-3xl';
                const put = () => { d.innerHTML = m.peek.html || ''; };
                put();
                if (!m.peek.html) fillPeek(m.peek).then(put);
                box.append(d);
              }
              slide.append(box);
            },
            onSlide: (i) => { if (h) { h.setTitle?.(mats[i].label); h.setIcon?.(mats[i].icon); } this.go(i); },
          };
          let h = null;
          h = parent ? deck.drill(parent, opts) : deck.open(opts);
        },
        // ── The PR panel ───────────────────────────────────────────────────
        async togglePr(el) {
          if (this.prOpen) { this.prOpen = false; return; }
          if (!this._prWired) {
            this._prWired = true;
            if (window.gh?.load && !window.PanelTip) await window.gh.load('kits/panel-tip.js').catch(() => {});
            if (window.PanelTip && this.$refs.prTip) {
              this.prClose = window.PanelTip.closeHTML(true);
              window.PanelTip.wire(this.$refs.prTip, { onClose: () => { this.prOpen = false; }, except: ['[data-pr-chip]'] });
            }
          }
          const r = el.getBoundingClientRect();
          const w = Math.min(innerWidth >= 768 ? 480 : 360, innerWidth - 16);
          this.prAt = { w, x: Math.max(8, Math.min(r.left, innerWidth - w - 8)), y: r.bottom + 6 };
          this.prOpen = true;
        },
        shortBranch() { return window.AssistantMark.shortBranch(this.facts?.branch); },
        branchItem() {
          const f = this.facts || {};
          return { slug: this.pr?.slug, branch: f.branch || '', pr: this.pr?.n, prState: f.state || '' };
        },
        branchHref() { return this.facts?.branch ? branchUrl(this.branchItem()) : (this.facts?.url || '#'); },
        openBranch() {
          this.prOpen = false;
          if (this.facts?.branch) openBranchDeck([this.branchItem()], 0);
        },
        answersPath() { return this.path.replace(/\.json$/, '.answers.jsonl'); },
        // ── A documentation call's edits ──────────────────────────────────
        // Staged against the file as the call names it, as the Docs tab stages
        // them: an edit found once is the owner's to keep or discard, and any
        // other standing (applied, stale, ambiguous, overlap) is its decision.
        async docKit() {
          if (!window.CallAnswer) await window.gh.load('kits/call-answer.js');
          await window.CallAnswer.ready();
          return window.CallAnswer;
        },
        async loadDoc() {
          try {
            const A = await this.docKit(), f = A.fileOf(this.c);
            if (!f) throw new Error('the call names no file');
            const base = (await new window.GH({ token: window.TOKEN, repo: f.repo, ref: f.ref }).get(f.path, window.GH.FRESH)).text;
            const { status } = A.stage(base, this.c.edits || []);
            this.doc = { ...this.doc, base, status, dec: status.map((x) => x === 'staged' ? 'open' : x), notes: status.map(() => ''), ready: true };
            this.$nextTick(() => this.drawDoc());
          } catch (e) { this.doc.err = 'Could not read the document: ' + (e?.message || e); }
        },
        // The document, drawn once it and its host are both here. Each md-diff
        // change is matched to the call edit whose text it holds; a change no
        // edit accounts for is drawn with no actions.
        docAt(el) { dh = el; this.drawDoc(); },
        docShow(v) {
          if (this.docView === v || !dh) return;
          this.docView = v;
          dh._drawn = false;
          const c = dh.closest('[data-doc-edits]')?.querySelector('[data-doc-controls]');
          if (c) c.textContent = '';
          this.drawDoc();
        },
        async drawDoc() {
          const host = dh;
          if (!host || !this.doc.ready || host._drawn) return;
          host._drawn = true;
          const A = window.CallAnswer, edits = this.c.edits || [];
          // OLD AND NEW are the whole file as it stands and with every edit
          // in it, drawn as md-diff draws an unchanged document; CHANGES is
          // the file with each edit as a container to decide.
          if (this.docView !== 'changes') {
            const md = this.docView === 'old' ? this.doc.base : A.stage(this.doc.base, edits).text;
            dmap = [];
            try { await window.mdDiff.render(host, md, md, { strip: false }); }
            catch (e) { this.doc.err = 'Could not draw the document: ' + (e?.message || e); }
            return;
          }
          const flat = (t) => String(t || '').replace(/\s+/g, ' ').trim();
          const has = (big, small) => !!flat(small) && flat(big).includes(flat(small));
          // Either way round: a block-sized edit holds its change, and a
          // section-sized edit is drawn by md-diff as several changes, each
          // inside the edit's text, all answered by the one decision.
          const editOf = (chg) => edits.findIndex((e, i) => this.doc.status[i] === 'staged'
            && (has(chg.new, e.to) || has(chg.old, e.from) || has(e.to, chg.new) || has(e.from, chg.old)));
          dmap = [];
          try {
            // md-diff's jump and layout controls go in the head, so the
            // document has one sticky band rather than two stacked.
            const controls = host.closest('[data-doc-edits]')?.querySelector('[data-doc-controls]') || undefined;
            await window.mdDiff.render(host, this.doc.base, A.stage(this.doc.base, edits).text, { controls, group: true,
              actions: (chg, k) => {
                const i = editOf(chg);
                dmap[k] = i;
                return i < 0 ? [] : [
                  { label: 'Keep', icon: 'ph-check', title: 'Keep this edit', run: () => this.docDecide(i, 'confirmed') },
                  { label: 'Discard', icon: 'ph-x', title: 'Discard this edit', run: () => this.docDecide(i, 'discarded') },
                  { label: 'Note', icon: 'ph-chat-circle-text', title: 'A note on this edit', run: () => this.docNoteOpen(i, k) },
                ];
              },
            });
          } catch (e) { this.doc.err = 'Could not draw the document: ' + (e?.message || e); }
          this.docPaint();
        },
        // Each edit's decision stays on its container, as a mark at its top
        // right, whether or not the container is selected. An edit md-diff
        // draws as several containers is named once, on its first, which
        // also carries its reason as a title-tip; the rest show only the
        // decision, once there is one.
        docPaint() {
          const host = dh;
          if (!host) return;
          const named = new Set();
          dmap.forEach((i, k) => {
            const box = host.querySelector('[data-md-diff-change="' + k + '"]');
            if (!box || i < 0) return;
            let m = box.querySelector(':scope > [data-doc-mark]');
            // In the place of md-diff's own index, as the Docs tab does, clear
            // of the reading tabs at the top right.
            if (!m) { m = document.createElement('span'); m.dataset.docMark = ''; box.append(m); box.querySelector('.md-diff-idx')?.classList.add('hidden'); }
            const d = this.doc.dec[i];
            m.dataset.docEdit = String(i + 1);
            m.dataset.decision = d;
            const first = !named.has(i), word = d === 'confirmed' ? 'kept' : d === 'discarded' ? 'discarded' : '';
            named.add(i);
            m.className = 'badge badge-sm absolute -top-2.5 left-1 z-10 gap-1 ' + (d === 'confirmed' ? 'badge-success' : d === 'discarded' ? 'badge-error' : 'badge-ghost border-base-300')
              + (first || word ? '' : ' hidden');
            m.textContent = first ? 'Edit ' + (i + 1) + (word ? ' · ' + word : '') : word;
            const keep = box.querySelector('.md-diff-actions [aria-label="Keep"]'), drop = box.querySelector('.md-diff-actions [aria-label="Discard"]');
            keep?.classList.add('text-success'); drop?.classList.add('text-error');
            keep?.classList.toggle('!bg-success/20', d === 'confirmed');
            drop?.classList.toggle('!bg-error/20', d === 'discarded');
            const why = first && this.c.edits?.[i]?.why;
            if (why) m.dataset.titleTip = why; else delete m.dataset.titleTip;
          });
        },
        // A NOTE IS THE CONTAINER'S LAST LINE, typed in place under a dashed
        // rule, so the document below does not jump and a note stays beside
        // the edit it is about. Left empty, the line goes when it loses focus.
        docNoteOpen(i, k) {
          const box = dh?.querySelector('[data-md-diff-change="' + k + '"]');
          if (!box || this.done) return;
          let inp = box.querySelector('[data-doc-note]');
          if (!inp) {
            const line = document.createElement('div');
            line.dataset.docNoteLine = '';
            line.className = 'mt-2 -mx-2 -mb-1 flex items-start gap-2 rounded-b-[4px] border-t border-dashed border-base-300 bg-base-200/40 px-2 py-1.5';
            line.innerHTML = '<i class="ph ph-chat-circle-text mt-1 text-[14px] text-base-content/50"></i>';
            inp = document.createElement('textarea');
            inp.rows = 1;
            inp.dataset.docNote = String(i + 1);
            inp.className = 'flex-1 min-w-0 resize-none border-0 bg-transparent p-0 text-[13px] leading-snug outline-none [field-sizing:content]';
            inp.placeholder = 'Note on edit ' + (i + 1);
            inp.value = this.doc.notes[i] || '';
            inp.addEventListener('input', () => { this.doc.notes[i] = inp.value; });
            inp.addEventListener('blur', () => { if (!inp.value.trim()) line.remove(); });
            line.append(inp);
            const bar = box.querySelector(':scope > .md-diff-actions');
            bar ? box.insertBefore(line, bar) : box.append(line);
          }
          inp.focus();
        },
        // The call's file read with the address grammar every page boots
        // (kits/repo-address.js), not CallAnswer, which may still be loading.
        get docFile() { const a = window.RepoAddress?.parse(String(this.c?.file || '').trim()); return a && a.path ? a : null; },
        get docPath() { return this.docFile?.path || this.c?.file || ''; },
        get docCount() {
          const n = this.doc.dec.length, staged = this.doc.status.filter((x) => x === 'staged').length;
          return !n ? '' : (n === 1 ? '1 edit' : n + ' edits') + (staged ? ' · ' + (staged - this.docOpen) + ' of ' + staged + ' decided' : '');
        },
        get docUnplaced() { return this.doc.status.map((x, i) => (x === 'staged' ? -1 : i)).filter((i) => i >= 0); },
        docDecide(i, d) {
          if (this.doc.status[i] !== 'staged' || this.done || this.busy) return;
          this.doc.dec[i] = this.doc.dec[i] === d ? 'open' : d;
          this.docPaint();
          this.paintVerdict();
        },
        docStanding(i) {
          return { applied: 'Already in the file', stale: 'The file no longer holds this text', ambiguous: 'Found more than once in the file',
                   overlap: 'Overlaps another edit' }[this.doc.status[i]] || '';
        },
        get docOpen() { return this.doc.dec.filter((d) => d === 'open').length; },
        get docTally() { return window.CallAnswer ? window.CallAnswer.summary(this.doc.dec) : ''; },
        async sendDoc() {
          if (this.busy || !this.doc.ready || this.docOpen || this.done || this.c?.closed) return;
          this.busy = true; this.sendErr = '';
          try {
            const A = window.CallAnswer, f = A.fileOf(this.c), ds = this.doc.dec;
            const decisions = ds.map((d, i) => { const note = String(this.doc.notes[i] || '').trim(); return { edit: i + 1, decision: d, ...(note ? { note } : {}) }; });
            const patch = ds.includes('confirmed') ? A.patch(f.path, this.doc.base, A.withConfirmed(this.doc.base, this.c.edits, ds)) : '';
            const entry = A.entry({ decisions, note: this.doc.note, call: this.repo + (this.ref !== 'main' ? '@' + this.ref : '') + ':' + this.path,
                                    file: f.repo + ':' + f.path, ...(patch ? { patch, apply: 'session' } : {}) });
            await A.record({ where: { repo: this.repo, ref: this.ref, path: this.path }, call: this.c, entry,
                             token: window.TOKEN, comment: this.comment, from: 'the call form' });
            this.answers = [...this.answers, entry];
            try { o.onAnswer?.(entry); } catch { /* the host's problem */ }
          } catch (e) { this.sendErr = 'Not sent: ' + (e?.message || e); }
          this.busy = false;
        },
        async loadAnswers() {
          try {
            const g = new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.ref });
            const t = (await g.get(this.answersPath(), window.GH.FRESH)).text;
            this.answers = t.split('\n').filter(Boolean)
              .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
          } catch { this.answers = []; }
        },
        sendNow(o) { this.pick = o; return this.send(); },
        sendAdjust() { if (this.note.trim()) this.sendNow('Adjust'); },
        async send() {
          if (!this.pick || this.busy) return;
          const adj = this.ta && this.pick === 'Adjust';
          if (adj && !this.note.trim()) return;
          this.busy = true; this.sendErr = '';
          try {
            const entry = { answer: this.pick, ...(adj ? { then: this.then } : {}), note: this.note.trim(), at: new Date().toISOString() };
            const what = adj ? '**Adjust**, then ' + (this.then === 'go' ? '**go**: make the change and carry on' : '**come back**: draft the change and file a new call before acting')
              : this.ta && this.pick === 'Take' ? '**Take**, the recommendation: ' + this.c.recommend : '**' + this.pick + '**';
            const body = '**User call: ' + this.c.question + '**\n\nAnswer: ' + what
              + (entry.note ? '\n\n> ' + entry.note : '') + '\n\n_' + (this.c.id || '') + ', sent from the call form._';
            await postAnswer({ repo: this.repo, ref: this.ref, path: this.answersPath(), entry,
                               pr: this.comment ? this.pr : null, comment: body });
            this.answers = [...this.answers, entry];
            this.pick = ''; this.note = ''; this.then = 'go';
            // The Adjust form leaves the deck once answered.
            this.$nextTick(() => { if (this.at >= this.mats.length) this.go(this.mats.length - 1); });
            try { o.onAnswer?.(entry); } catch { /* the host's problem */ }
          } catch (e) { this.sendErr = 'Not sent: ' + (e?.message || e); }
          this.busy = false;
        },

        // The materials strip, moved by swipe-deck's machinery (swipeDeck.strip).
        // arrived() runs what was waiting on the landing (toNotes' reveal).
        panels() { return this.$refs.strip ? [...this.$refs.strip.querySelectorAll(':scope > [data-slide]')] : []; },
        drive() {
          if (!sd && window.swipeDeck?.strip) sd = window.swipeDeck.strip({
            el: () => this.$refs.strip, at: () => this.at,
            onSlide: (i) => { this.at = i; },
            onArrive: () => this.arrived(),
          });
          return sd;
        },
        onStrip() { this.drive()?.scrolled(); },
        arrived() { const f = this._afterGo; this._afterGo = null; f?.(); },
        go(i) {
          const n = this.mats.length;
          if (!n) return;
          i = Math.max(0, Math.min(n - 1, i));
          this.at = i;
          if (!this.drive()?.go(i)) this.arrived();
        },
      };
    });
  };

  window.UserCallForm = { linkOf, prFacts, postAnswer, prOf, fillPeek, openBranchDeck, branchUrl };
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
