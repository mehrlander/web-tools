// alpineComponents/call-form.js — one call as a form.
//
// A call is one decision a session needs from the owner (call/1, written by
// web-tools-private calls/call.py, one file per call at calls/<session>-<slug>.json
// in the repo it governs). This is its form, and it is shaped like the branch
// page for the same reason the session page is: a head that says what this is,
// over a pane of files to move through.
//
//   Top      what an executive would be shown: the question, one line of
//            what is at stake, live facts for a linked PR, the answers as
//            buttons that are only answers, the recommendation in a clause,
//            and a note and Send once one is picked. No prose per answer; the
//            depth is below.
//   Bottom   the materials, one per slide in a snap swiper, as branch-brief's
//            Files pane swipes: a page rendered, a document as prose, anything
//            else a button out. n/m, arrows, and a contents list off the mark,
//            because a swipe that starts on a framed page goes to the page.
//
// A documentation call is the one kind not answered here: its edits are read
// and decided in Dictate (pages/dictate.html, ?file= and ?call=), which writes
// the answer beside the call. The form shows its head and opens Dictate, from
// a button and from the verdict circle.
//
// Mounted two ways, as branch-brief is: as a slide in the session page's deck
// of calls, and on its own at pages/call.html. A host passes:
//   call      the envelope, already read (the deck has it)
//   src       owner/repo[@ref]:calls/<id>.json, read here when `call` is absent
//   repo, ref, path   where the call lives, for the answers file beside it
//   onAnswer  (entry) => void, told when an answer is sent
//
// Answers go to <id>.answers.jsonl beside the call, one JSON line each,
// appended through the owner's token and never edited; the latest line wins.
// Where the call names a PR and the box is ticked, the answer is first
// commented there, which wakes a session subscribed to it.
//
// window.CallForm carries the helpers the session page shares: linkOf (a typed
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
    const v = window.Alpine.reactive({ key, kind, path, url, html: '', _asked: false });
    PEEKS.set(key, v);
    return v;
  }
  async function fillPeek(v) {
    if (!v || v.kind === 'html' || v._asked || v.html) return;
    v._asked = true;
    const m = v.key.match(/^([^@]+)@([^:]+):(.+)$/);
    try {
      const text = (await new window.GH({ token: window.TOKEN, repo: m[1], ref: m[2] }).get(m[3])).text;
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
        out.href = 'https://github.com/' + p.slug + '/pull/' + p.n;
        out.label = l.label ? l.label + ' · #' + p.n : p.label;
        out.icon = 'ph-git-pull-request';
        out.tone = PR_TONE[prState?.(p)] || out.tone;
      }
    } else if (l?.kind === 'branch') {
      const [slug, br] = ref.split('@');
      out.href = 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=' + slug + '@' + encodeURIComponent(br || '');
      out.label = l.label || slug.split('/').pop() + ' @ ' + String(br || '').replace(/^(claude|codex|gemini|grok)\//, '');
      out.icon = 'ph-git-branch';
    } else if (l?.kind === 'file') {
      const m = ref.match(/^([^/@]+\/[^@:]+)@([^:]+):(.+)$/);
      if (m) {
        const [, slug, r, path] = m;
        const md = /\.(md|markdown)$/i.test(path), page = /\.html?$/i.test(path);
        const t = page ? (window.GuideRender?.pageTargets?.(slug, r, [path], null) || [])[0] : null;
        out.gh = 'https://github.com/' + slug + '/blob/' + encodeURIComponent(r) + '/' + path;
        out.href = t ? t.url : out.gh;
        out.label = l.label || path.split('/').pop();
        out.icon = md ? 'ph-file-text' : page ? 'ph-browser' : 'ph-file-code';
        // A page is its render, a document its prose, anything else its
        // source as wrapped text.
        out.peek = peekOf(slug, r, path, md ? 'md' : page ? 'html' : 'text', out.href);
        out.kind = md ? 'md' : page ? 'html' : 'code';
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
  async function openBranchDeck(items, start = 0) {
    const list = (items || []).map((b) => ({ repoShort: b.slug.split('/').pop(), icon: 'ph-git-branch',
      short: String(b.branch).replace(/^(claude|codex|gemini|grok)\//, ''), url: branchUrl(b), ...b }));
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
        window[key] = { repo: b.slug, branch: b.branch, base: 'main', pr: b.pr ? String(b.pr) : '', framed: true };
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
          <div class="shrink-0 max-h-[40%] overflow-y-auto rounded-xl border border-base-300 bg-base-100 px-4 py-2.5 grid gap-2">
            <!-- AN EXECUTIVE'S GLANCE: the question, one line of what is at
                 stake, and answers that are only answers. Depth is in the
                 materials below, never in the answers. -->
            <div x-show="c.kind !== 'merge'" class="flex items-start gap-2">
              <div class="grow text-xl font-semibold leading-snug" x-text="c.question"></div>
              <span x-show="!hosted" class="shrink-0" x-init="hosted || $el.replaceChildren(verdictEl())"></span>
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
                         :class="tone(facts?.state)" :aria-expanded="prOpen ? 'true' : 'false'" :title="pr?.label">
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
            <p x-show="c.brief" class="text-base leading-snug">
              <span class="opacity-80" x-text="c.brief"></span>
              <button type="button" x-show="pr" data-pr-chip @click="togglePr($el)"
                 class="ml-1 inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 align-middle hover:bg-base-200"
                 :class="tone(facts?.state)" :aria-expanded="prOpen ? 'true' : 'false'">
                <i class="ph ph-git-pull-request"></i><span x-text="'#' + (pr?.n || '')"></span></button>
            </p>
            <p x-show="blocker" class="text-sm text-warning flex items-center gap-1">
              <i class="ph ph-warning-circle"></i><span x-text="blocker"></span></p>
            <p x-show="c.recommend" class="text-sm opacity-70">
              <i class="ph ph-star-four text-primary"></i>
              <span x-text="'I recommend ' + c.recommend + (c.why ? ': ' + c.why : '.')"></span></p>
            <!-- A DOCUMENTATION CALL is answered where its edits can be read:
                 Dictate, with the file open and each edit a change card. The
                 verdict circle opens the same address. -->
            <template x-if="c.kind === 'documentation'">
              <div class="flex flex-wrap items-center gap-2">
                <a :href="dictateHref" target="_blank" rel="noopener" data-dictate-link class="btn btn-sm btn-primary gap-1.5">
                  <i class="ph ph-pencil-line"></i><span x-text="'Review ' + (c.edits || []).length + ' edit' + ((c.edits || []).length === 1 ? '' : 's') + ' in Dictate'"></span></a>
                <span x-show="done" class="text-sm opacity-70" x-text="'Answered: ' + done"></span>
              </div>
            </template>
            <!-- The answer is picked from the verdict circle's menu; what is
                 typed here rides with it. -->
            <div x-show="c.kind !== 'merge' && c.kind !== 'documentation' && !done && !c.closed" class="flex flex-wrap items-center gap-2">
              <input type="text" x-ref="noteIn" class="input input-sm input-bordered grow min-w-40" placeholder="Say more with your answer (optional)"
                     x-model="note">
              <label x-show="pr" class="flex items-center gap-1.5 text-sm opacity-80" :title="'Comments the answer on ' + (pr?.label || '') + ', which wakes a subscribed session'">
                <input type="checkbox" class="checkbox checkbox-xs" x-model="comment"><span x-text="'Post on ' + (pr?.label || '')"></span></label>
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
                    <span class="mt-0.5 size-5 shrink-0 rounded-full inline-flex items-center justify-center text-xs" :class="kindOf(x).tone" :title="kindOf(x).label">
                      <i class="ph-bold" :class="kindOf(x).icon"></i></span>
                    <div class="grid gap-0.5 min-w-0">
                      <div class="flex items-center gap-2 min-w-0">
                        <span x-show="x?.head" class="font-semibold shrink-0" x-text="x?.head"></span>
                        <button type="button" x-show="shipProof(x)" @click="showProof(x)"
                                class="inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 hover:brightness-95 max-w-full min-w-0"
                                :class="KIND_TONE[proofMark(x).kind] || 'bg-base-200 border-base-300'"
                                :title="'Show ' + (proofMark(x).label || 'the proof') + ' below'">
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
                  <button type="button" class="btn btn-sm btn-ghost btn-square shrink-0" title="Send the message; don't merge"
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
                  <span x-text="'Answered ' + a.answer + ' · ' + ago(a.at)"></span>
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
                        title="Open the branch here"><i class="ph ph-cards-three text-lg"></i></button>
                <a :href="branchHref()" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-square shrink-0"
                   title="Open the branch page"><i class="ph ph-arrow-square-out text-lg"></i></a>
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

          <!-- The materials: branch-brief's Files pane, as a swiper. -->
          <div x-show="mats.length" data-swipe-section
               @pointerenter="hovered = true" @pointerleave="hovered = false" @pointerdown="hovered = true"
               class="relative flex-1 min-h-0 flex flex-col rounded-xl border border-base-300 bg-base-100 overflow-hidden">
            <div class="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200/60 min-w-0">
              <button type="button" data-mat-list-btn @click="listOpen = !listOpen"
                      class="btn btn-sm btn-square btn-ghost shrink-0 -ml-1" :class="listOpen && 'bg-primary/10 text-primary'"
                      :title="listOpen ? 'Back to the file' : 'Contents'">
                <i class="ph text-lg" :class="listOpen ? 'ph-caret-up' : mats[at]?.icon"></i></button>
              <span class="truncate text-sm" x-text="mats[at]?.label"></span>
              <!-- GitHub only as its own mark beside the name, never as the
                   way to open a thing: the estate's rule for any file. -->
              <a x-show="mats[at]?.gh" :href="mats[at]?.gh" target="_blank" rel="noopener"
                 class="btn btn-ghost btn-xs btn-square shrink-0 opacity-50 hover:opacity-100" title="On GitHub">
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
              <button type="button" x-show="mats[at]?.peek" @click="expand()"
                      class="btn btn-ghost btn-sm btn-square shrink-0" title="Full screen">
                <i class="ph ph-arrows-out text-lg"></i></button>
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
                 class="flex-1 min-h-0 flex gap-3 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
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
                                [&_code]:text-sm [&_table]:text-sm [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6"
                         x-html="m.peek.html || ''"></div>
                  </template>
                  <template x-if="!m.peek">
                    <div class="absolute inset-0 flex items-center justify-center p-6">
                      <a :href="m.href" target="_blank" rel="noopener" class="btn btn-soft">
                        <i class="ph" :class="m.icon"></i><span x-text="'Open ' + m.label"></span></a>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>`;

  const register = function () {
    Alpine.data('callForm', function (opts) {
      const o = opts || {};
      return {
        description: 'One call: a decision put to the owner, framed above, its materials swiped below, answered in place',

        c: o.call || null, err: '',
        repo: o.repo || STORE, ref: o.ref || 'main', path: o.path || '',
        pick: '', note: '', comment: false, busy: false, sendErr: '',
        prOpen: false, prAt: null, prClose: '', _prWired: false,
        hosted: !!o.onHead, _mark: null, _onKey: null, _vEl: null, vOpen: false, vAt: null, KIND_TONE, facts: null, answers: [], at: 0, listOpen: false, seen: {}, hovered: false, _aim: -1, _aimT: 0,

        get pr() { return prOf(this.c?.pr); },
        // Answers are plain strings; an older call's {label} objects still read.
        get opts() { return (this.c?.options || []).map((o) => typeof o === 'string' ? o : o?.label).filter(Boolean); },
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
        get mats() { return this.matLinks.map((l) => linkOf(l)); },
        shipText(x) { return typeof x === 'string' ? x : x?.text || x?.new || x?.old || ''; },
        kindOf(x) { return CHANGE_KIND[x?.kind] || { icon: 'ph-check', tone: 'bg-success/30 text-success-content', label: 'Shipped' }; },
        shipProof(x) { return x && typeof x === 'object' ? x.proof : null; },
        proofMark(x) { const p = this.shipProof(x); return p ? linkOf(p) : { label: '', icon: '' }; },
        // A proof opens in the materials pane, never away from the page.
        showProof(x) {
          const p = this.shipProof(x);
          const i = p ? this.matLinks.findIndex((l) => l.kind === p.kind && l.ref === p.ref) : -1;
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
        ago(iso) {
          const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
          if (!(m >= 0)) return '';
          return m < 60 ? m + 'm ago' : m < 60 * 36 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
        },

        init() {
          this.$el.innerHTML = TEMPLATE;
          this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
          this.load();
          this.$watch('busy', () => this.paintVerdict());
          this.$watch('answers', () => this.paintVerdict());
          // THE INNER SWIPER TAKES THE ARROWS while the pointer or focus is in
          // it, before the deck around it sees them: branch-brief's rule, on the
          // capture phase for the same reason, since the deck listens on window.
          this._onKey = (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) return;
            if (!this.$el?.isConnected) return;
            const r = this.$el.getBoundingClientRect();
            if (r.width > 0 && (r.right <= 0 || r.left >= window.innerWidth)) return;
            const sec = this.$el.querySelector('[data-swipe-section]');
            const active = this.hovered || (sec && sec.contains(document.activeElement));
            if (!active || this.mats.length < 2) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            this.go(this.at + (e.key === 'ArrowRight' ? 1 : -1));
          };
          window.addEventListener('keydown', this._onKey, true);
        },
        destroy() { if (this._onKey) window.removeEventListener('keydown', this._onKey, true); },
        async load() {
          try {
            for (const k of ['kits/guide-render.js']) if (window.gh?.load && !window.GuideRender) await window.gh.load(k).catch(() => {});
            if (!this.c && o.src) {
              const m = String(o.src).match(/^([^/@:]+\/[^@:]+)(?:@([^:]+))?:(.+)$/);
              if (!m) throw new Error('A call address reads owner/repo[@ref]:calls/<id>.json');
              [this.repo, this.ref, this.path] = [m[1], m[2] || 'main', m[3]];
              this.c = JSON.parse((await new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.ref }).get(this.path)).text);
            }
            if (!this.path && this.c?.id) this.path = 'calls/' + this.c.id + '.json';
            this.comment = !!this.pr;
            this.loadAnswers();
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
            mark.title = this.pr.label;
            mark.innerHTML = '<i class="ph ph-git-pull-request"></i><span>#' + window.esc(this.pr.n) + '</span>';
            mark.onclick = (e) => { e.stopPropagation(); this.togglePr(mark); };
          }
          const doc = this.c.kind === 'documentation';
          o.onHead({ title: merge ? 'Confirm merge' : doc ? 'Documentation' : 'Decision',
                     icon: merge ? 'ph-git-merge' : doc ? 'ph-pencil-line' : 'ph-gavel', mark, action: this.verdictEl() });
        },
        // ── The verdict circle ────────────────────────────────────────────
        // The approve page's filled green check, with one change: it starts
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
            if (this.c?.kind === 'documentation') { window.open(this.dictateHref, '_blank', 'noopener'); return; }
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
            : this.c?.kind === 'documentation' ? 'Review in Dictate' : 'Answer';
          b.title = t; b.setAttribute('aria-label', t);
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
          const sd = window.swipeDeck, mats = this.mats;
          if (!sd || !mats.length) return;
          const parent = sd.top?.();
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
              if (m.peek?.kind === 'html') {
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
          h = parent ? sd.drill(parent, opts) : sd.open(opts);
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
        shortBranch() { return String(this.facts?.branch || '').replace(/^(claude|codex|gemini|grok)\//, ''); },
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
        // Where a documentation call is answered: Dictate on its file, reading
        // the call from where this form read it.
        get dictateHref() {
          if (this.c?.kind !== 'documentation') return '';
          return 'https://mehrlander.github.io/web-tools/pages/dictate.html?file=' + (this.c.file || '')
            + '&call=' + this.repo + '@' + this.ref + ':' + this.path;
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
        async send() {
          if (!this.pick || this.busy) return;
          this.busy = true; this.sendErr = '';
          try {
            const entry = { answer: this.pick, note: this.note.trim(), at: new Date().toISOString() };
            const body = '**Call: ' + this.c.question + '**\n\nAnswer: **' + this.pick + '**'
              + (entry.note ? '\n\n> ' + entry.note : '') + '\n\n_' + (this.c.id || '') + ', sent from the call form._';
            await postAnswer({ repo: this.repo, ref: this.ref, path: this.answersPath(), entry,
                               pr: this.comment ? this.pr : null, comment: body });
            this.answers = [...this.answers, entry];
            this.pick = ''; this.note = '';
            try { o.onAnswer?.(entry); } catch { /* the host's problem */ }
          } catch (e) { this.sendErr = 'Not sent: ' + (e?.message || e); }
          this.busy = false;
        },

        // The strip, read as branch-brief reads its own: the slide nearest the
        // strip's left edge is the one showing.
        panels() { return this.$refs.strip ? [...this.$refs.strip.querySelectorAll(':scope > [data-slide]')] : []; },
        onStrip() {
          const el = this.$refs.strip;
          if (!el) return;
          const x0 = el.getBoundingClientRect().left;
          let best = 0, near = Infinity;
          this.panels().forEach((k, i) => {
            const d = Math.abs(k.getBoundingClientRect().left - x0);
            if (d < near) { near = d; best = i; }
          });
          // A programmatic go() is in flight: the scroll it started passes
          // the old slide first, and reading that back would flip the name to
          // the old file and then to the new one. Hold until it arrives.
          if (this._aim >= 0) {
            if (best !== this._aim) return;
            this._aim = -1; clearTimeout(this._aimT);
          }
          if (this.at !== best) this.at = best;
        },
        go(i) {
          const n = this.mats.length;
          if (!n) return;
          i = Math.max(0, Math.min(n - 1, i));
          this.at = i;
          this._aim = i; clearTimeout(this._aimT);
          this._aimT = setTimeout(() => { this._aim = -1; this.onStrip(); }, 900);
          const el = this.$refs.strip, k = this.panels()[i];
          if (!el || !k) return;
          const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
          el.scrollTo({ left: x, behavior: 'smooth' });
          if (Math.abs(el.scrollLeft - x) < 2) { this._aim = -1; clearTimeout(this._aimT); }
        },
      };
    });
  };

  window.CallForm = { linkOf, prFacts, postAnswer, prOf, fillPeek, openBranchDeck, branchUrl };
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
