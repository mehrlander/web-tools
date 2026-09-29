// alpineComponents/call-form.js — one call as a form.
//
// A call is one decision a session needs from the owner (call/1, written by
// web-tools-private calls/call.py, one file per call at calls/<session>-<slug>.json
// in the repo it governs). This is its form, and it is shaped like the branch
// page for the same reason the session page is: a head that says what this is,
// over a pane of files to move through.
//
//   Top      the question, the background, each option with what choosing it
//            does, the recommendation and why, live facts for a linked PR, and
//            the answer: pick, note, send.
//   Bottom   the materials, one per slide in a snap swiper, as branch-brief's
//            Files pane swipes: a page rendered, a document as prose, anything
//            else a button out. n/m, arrows, and a contents list off the mark,
//            because a swipe that starts on a framed page goes to the page.
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
  const PEEKS = new Map();

  const prOf = (ref) => {
    const m = String(ref || '').match(/^([^/]+\/[^#]+)#(\d+)$/);
    return m ? { slug: m[1], n: m[2], label: m[1].split('/').pop() + ' #' + m[2] } : null;
  };

  // A page or a document, in the shape a peek or a slide draws; a document's
  // prose is fetched once, on first use, and kept.
  function peekOf(slug, ref, path, md, url) {
    const key = slug + '@' + ref + ':' + path;
    if (PEEKS.has(key)) return PEEKS.get(key);
    const v = window.Alpine.reactive({ key, kind: md ? 'md' : 'html', path, url, html: '', _asked: false });
    PEEKS.set(key, v);
    return v;
  }
  async function fillPeek(v) {
    if (!v || v.kind !== 'md' || v._asked || v.html) return;
    v._asked = true;
    const m = v.key.match(/^([^@]+)@([^:]+):(.+)$/);
    try {
      if (window.gh?.load && !window.chatRender) await window.gh.load('kits/chat-render.js').catch(() => {});
      await window.chatRender?.ready?.().catch(() => {});
      const text = (await new window.GH({ token: window.TOKEN, repo: m[1], ref: m[2] }).get(m[3])).text;
      v.html = window.marked ? window.marked.parse(text) : '';
    } catch { v.html = ''; }
  }

  // One typed link ({kind, ref, label?}) to where it goes, its mark, and for a
  // page or a document, the peek.
  function linkOf(l, prState) {
    const ref = String(l?.ref || '');
    const out = { href: ref, label: l?.label || ref, icon: 'ph-link', tone: 'border-base-300', peek: null, card: 0 };
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
        out.href = t ? t.url : 'https://github.com/' + slug + '/blob/' + encodeURIComponent(r) + '/' + path;
        out.label = l.label || path.split('/').pop();
        out.icon = md ? 'ph-file-text' : page ? 'ph-browser' : 'ph-file-code';
        // A page is its render, a document its prose; anything else is
        // source, which its GitHub view already shows best.
        if (md || page) out.peek = peekOf(slug, r, path, md, out.href);
      }
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
             del: pr.deletions, title: pr.title, url: pr.html_url };
  }

  // Append one answer line; comment it on a PR first when asked, so the
  // comment's address rides in the line. Read fresh, PUT with the sha, and on
  // a lost race read again, as kits/notes.js appends.
  async function postAnswer({ repo, ref, path, entry, pr, comment }) {
    if (!window.GH.toBase64 && window.gh?.load) await window.gh.load('gh-store.js');
    const g = new window.GH({ token: window.TOKEN, repo, ref });
    entry.by = entry.by || (await g.req('/user').catch(() => ({})))?.login || '';
    if (pr && comment) {
      const c = await new window.GH({ token: window.TOKEN, repo: pr.slug })
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

  const TEMPLATE = `
    <div class="h-full flex flex-col min-h-0 bg-base-100">
      <div x-show="err" class="m-3 alert alert-warning" x-text="err"></div>
      <div x-show="!c && !err" class="flex-1 flex items-center justify-center">
        <span class="loading loading-spinner text-primary"></span></div>
      <!-- Two cards on the page's own ground, as branch-brief lays out its
           guide and its Files pane: the framing above, the materials below. -->
      <template x-if="c">
        <div class="flex-1 min-h-0 flex flex-col gap-2 p-3 bg-base-200/40">
          <div class="shrink-0 max-h-[55%] overflow-y-auto rounded-xl border border-base-300 bg-base-100 px-4 py-3 grid gap-2.5">
            <div class="text-lg font-semibold leading-snug" x-text="c.question"></div>
            <div x-show="facts" class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs opacity-75">
              <a :href="facts?.url" target="_blank" rel="noopener" class="rounded-full border px-2 leading-5 hover:underline"
                 :class="tone(facts?.state)" x-text="(pr?.label || '') + ' ' + (facts?.state || '')"></a>
              <span x-show="facts?.ci" x-text="'CI ' + facts?.ci"></span>
              <span x-show="facts?.mergeable" x-text="'· ' + facts?.mergeable"></span>
              <span x-text="'· ' + facts?.files + ' files, +' + facts?.add + ' −' + facts?.del"></span>
            </div>
            <p x-show="c.background" class="text-base leading-relaxed opacity-85" x-text="c.background"></p>
            <div class="grid gap-1.5">
              <template x-for="o in (c.options || [])" :key="o.label">
                <button type="button" @click="pick = pick === o.label ? '' : o.label" :disabled="!!c.closed"
                        class="rounded-lg border px-3 py-2 text-left grid gap-0.5 transition-colors"
                        :class="done === o.label ? 'border-primary bg-primary/15'
                                : pick === o.label ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200/60'">
                  <span class="flex items-center gap-1.5 font-semibold">
                    <i class="ph" :class="(pick || done) === o.label ? 'ph-radio-button text-primary' : 'ph-circle opacity-40'"></i>
                    <span x-text="o.label"></span>
                    <span x-show="o.label === c.recommend" class="ml-auto text-xs font-normal text-primary inline-flex items-center gap-1">
                      <i class="ph ph-star-four"></i>Recommended</span>
                  </span>
                  <span x-show="o.effect" class="text-sm opacity-75 leading-snug" x-text="o.effect"></span>
                </button>
              </template>
            </div>
            <p x-show="c.why" class="text-sm opacity-75 leading-snug">
              <span class="font-semibold">Why I recommend it:</span> <span x-text="c.why"></span></p>
            <div x-show="pick" class="grid gap-1.5 rounded-lg border border-primary/40 p-2">
              <input type="text" class="input input-sm input-bordered w-full" placeholder="Add a note (optional)"
                     x-model="note" @keydown.enter="send()">
              <label x-show="pr" class="flex items-center gap-2 text-sm">
                <input type="checkbox" class="checkbox checkbox-xs" x-model="comment">
                <span x-text="'Also comment on ' + (pr?.label || '') + ', which wakes a subscribed session'"></span></label>
              <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-primary" @click="send()" :disabled="!!busy">
                  <span x-show="busy" class="loading loading-spinner loading-xs"></span><span x-text="'Send ' + pick"></span></button>
                <span x-show="sendErr" class="text-sm text-error" x-text="sendErr"></span>
              </div>
            </div>
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

          <!-- The materials: branch-brief's Files pane, as a swiper. -->
          <div x-show="mats.length" data-swipe-section
               @pointerenter="hovered = true" @pointerleave="hovered = false" @pointerdown="hovered = true"
               class="relative flex-1 min-h-0 flex flex-col rounded-xl border border-base-300 bg-base-100 overflow-hidden">
            <div class="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200/60 min-w-0">
              <button type="button" data-mat-list-btn @click="listOpen = !listOpen"
                      class="btn btn-sm btn-square btn-ghost shrink-0 -ml-1" :class="listOpen && 'bg-primary/10 text-primary'"
                      :title="listOpen ? 'Back to the file' : 'Contents'">
                <i class="ph text-lg" :class="listOpen ? 'ph-caret-up' : mats[at]?.icon"></i></button>
              <span class="truncate grow text-sm" x-text="mats[at]?.label"></span>
              <div x-show="mats.length > 1" class="flex items-center shrink-0">
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at - 1)" :disabled="at <= 0">
                  <i class="ph ph-caret-left"></i></button>
                <span class="font-mono text-xs opacity-60 tabular-nums px-1" x-text="(at + 1) + '/' + mats.length"></span>
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at + 1)" :disabled="at >= mats.length - 1">
                  <i class="ph ph-caret-right"></i></button>
              </div>
              <a :href="mats[at]?.href" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-square shrink-0" title="Open in a new tab">
                <i class="ph ph-arrow-square-out text-lg"></i></a>
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
                  <template x-if="m.peek?.kind === 'md'">
                    <div x-init="fill(m.peek)" class="absolute inset-0 overflow-y-auto px-4 py-3 text-base leading-7
                                [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_p]:my-2
                                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:link [&_code]:font-mono
                                [&_code]:text-sm [&_table]:text-sm"
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
        facts: null, answers: [], at: 0, listOpen: false, seen: {}, hovered: false, _aim: -1, _aimT: 0,

        get pr() { return prOf(this.c?.pr); },
        get mats() { return (this.c?.materials || []).map((l) => linkOf(l)); },
        get done() {
          if (this.c?.closed?.answer) return this.c.closed.answer;
          return this.answers.length ? this.answers[this.answers.length - 1].answer : '';
        },
        tone(s) { return PR_TONE[s] || 'border-base-300'; },
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
            if (this.pr) prFacts(this.c.pr).then((f) => { this.facts = f; }).catch(() => {});
          } catch (e) { this.err = 'Could not open this call: ' + (e?.message || e); }
        },
        answersPath() { return this.path.replace(/\.json$/, '.answers.jsonl'); },
        async loadAnswers() {
          try {
            const g = new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.ref });
            const t = (await g.get(this.answersPath(), window.GH.FRESH)).text;
            this.answers = t.split('\n').filter(Boolean)
              .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
          } catch { this.answers = []; }
        },
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

  window.CallForm = { linkOf, prFacts, postAnswer, prOf, fillPeek };
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
