document.addEventListener('alpine:init', function() {
  Alpine.data('tending', function() {
    // The Tending view: what tending passes have concluded about the estate's
    // work, read as findings rather than as alerts.
    //
    // A finding is a note in the registry's notes store that carries a
    // `finding` object (kits/findings.js states the record and the fold). It
    // names its subjects (branches, pull requests, tracker tasks, snags,
    // session records), says why it matters, recommends a next step, and
    // isolates the one choice that needs the owner, when there is one.
    //
    // Two lists, one control: Attention (open findings, a question for the
    // owner first) and Settled (what tending or the owner put down, kept to
    // be inspected rather than hidden). A comment here is an ordinary reply
    // and changes nothing; Handled writes a reply that carries
    // `finding.status: "resolved"`, which is the only way the owner closes a
    // finding, and Reopen is its inverse.
    //
    // Each open finding's witnesses are checked against GitHub on sight: the
    // branch tips, files and pull requests its conclusion rested on, which
    // may lie outside its subjects. A witness that moved marks the finding as
    // changed since it was assessed, so a reader knows to weigh it again and
    // the next pass knows to reassess it.
    const REGISTRY = () => window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private';

    return {
      description: 'Tending view: findings from tending passes (work that never reached the owner, questions only the owner can answer, overlapping efforts, and what was settled), each linked to its subjects, with witnesses checked against GitHub and owner actions written back as notes.',

      notes: [],
      loading: false,
      err: '',
      open: {},          // finding id -> details open
      draft: {},         // finding id -> text in its reply box
      busy: '',          // finding id being written
      seen: {},          // witness key -> { verdict, detail } once checked
      checking: 0,

      template: `
        <div class="w-full">
          <div class="flex items-center gap-2 mb-3 flex-wrap">
            <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit" role="tablist">
              <button role="tab" @click="setTab('attention')"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'attention' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-plant text-lg"></i>Attention<span class="font-mono text-sm opacity-60" x-text="attention.length"></span></button>
              <button role="tab" @click="setTab('settled')"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'settled' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-check-circle text-lg"></i>Settled<span class="font-mono text-sm opacity-60" x-text="settled.length"></span></button>
            </div>
            <template x-if="repoFilter">
              <button @click="clearRepo()" class="badge badge-ghost gap-1 font-mono"
                      :data-title-tip="'Showing findings that touch ' + repoFilter + '; tap to show all'" data-title-tip-bare>
                <span x-text="repoFilter.split('/')[1]"></span><i class="ph ph-x"></i></button>
            </template>
            <div class="grow"></div>
            <span x-show="checking" class="text-sm text-base-content/40 font-mono" x-text="'checking ' + checking"></span>
            <button class="btn btn-ghost btn-sm btn-square" @click="load()" :disabled="loading"
                    data-title-tip="Reload findings and check their witnesses again" data-title-tip-bare>
              <i class="ph ph-arrows-clockwise text-lg" :class="loading && 'animate-spin'"></i></button>
          </div>

          <p x-show="!hasToken()" class="text-base text-base-content/60">Set a token (Repos, top right) to read findings.</p>
          <p x-show="err" class="text-base text-error font-mono" x-text="err"></p>
          <div x-show="loading && !notes.length" class="flex justify-center py-12"><span class="loading loading-spinner"></span></div>
          <p x-show="!loading && hasToken() && !shown.length && !err" class="text-base text-base-content/50 py-8 text-center"
             x-text="tab === 'attention' ? 'Nothing open.' : 'Nothing settled yet.'"></p>

          <div>
            <template x-for="f in shown" :key="f.id">
              <article class="py-4 border-t border-base-300/70 first-of-type:border-t-0 first-of-type:pt-1" :id="'finding-' + f.id" :class="focus === f.id && 'bg-primary/5 -mx-2 px-2 rounded-lg'">
                <div class="flex items-center gap-1.5 text-sm text-base-content/55 mb-1">
                  <i class="ph text-base" :class="kindOf(f.kind).icon"></i>
                  <span x-text="kindOf(f.kind).label"></span>
                  <template x-if="f.status === 'resolved'"><span class="text-base-content/40">· handled</span></template>
                  <div class="grow"></div>
                  <span class="font-mono text-base-content/40" :data-title-tip="'Found ' + f.at.slice(0, 10) + ' by ' + f.author + (f.assessedAt !== f.at ? '; last assessed ' + f.assessedAt.slice(0, 10) : '')"
                        data-title-tip-bare x-text="ago(f.assessedAt)"></span>
                </div>
                <h3 class="text-base font-semibold text-balance leading-snug" x-text="f.title"></h3>

                <template x-if="changed(f).length">
                  <div class="mt-2 flex items-start gap-1.5 text-base text-warning">
                    <i class="ph ph-arrows-counter-clockwise text-lg shrink-0 mt-0.5"></i>
                    <div><span class="font-medium">Changed since assessed: </span>
                      <template x-for="(c, i) in changed(f)" :key="c.ref">
                        <span><span x-text="(i ? '; ' : '') + refLabel(c.ref)"></span><span class="text-base-content/60" x-text="c.detail ? ' (' + c.detail + ')' : ''"></span></span>
                      </template></div>
                  </div>
                </template>

                <template x-if="f.choice && f.open">
                  <div class="mt-2 border-l-2 border-primary pl-3">
                    <div class="text-sm font-medium text-primary">Your call</div>
                    <p class="text-base text-pretty" x-text="f.choice"></p>
                  </div>
                </template>

                <p class="mt-2 text-base text-base-content/80 text-pretty" x-text="f.why"></p>
                <template x-if="f.next && f.open">
                  <p class="mt-2 text-base text-pretty"><span class="text-sm font-medium text-base-content/55 mr-1.5">Next</span><span x-text="f.next"></span></p>
                </template>

                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <template x-for="s in f.subjects" :key="s">
                    <a :href="subjectHref(s)" :target="subjectHref(s).startsWith('http') ? '_blank' : null"
                       class="flex items-center gap-1 rounded-md bg-base-200/70 px-2 py-0.5 text-sm font-mono text-base-content/70 hover:text-primary max-w-full"
                       :data-title-tip="s" data-title-tip-bare>
                      <i class="ph shrink-0" :class="subjectIcon(s)"></i><span class="truncate" x-text="subjectLabel(s)"></span></a>
                  </template>
                </div>

                <button @click="toggle(f)" class="mt-2 flex items-center gap-1 text-sm text-base-content/50 hover:text-primary">
                  <i class="ph" :class="open[f.id] ? 'ph-caret-down' : 'ph-caret-right'"></i>
                  <span x-text="detailLabel(f)"></span></button>

                <template x-if="open[f.id]">
                  <div class="mt-2 space-y-3">
                    <template x-if="f.evidence.length">
                      <ul class="space-y-1 text-base text-base-content/75 list-disc pl-5">
                        <template x-for="e in f.evidence" :key="e"><li class="text-pretty" x-text="e"></li></template>
                      </ul>
                    </template>
                    <template x-if="f.witnesses.length">
                      <div>
                        <div class="text-sm font-medium text-base-content/55 mb-1">Rests on</div>
                        <ul class="space-y-1">
                          <template x-for="w in f.witnesses" :key="w.ref">
                            <li class="flex items-start gap-1.5 text-base">
                              <i class="ph shrink-0 mt-1" :class="verdictIcon(verdict(f, w).verdict)"></i>
                              <span class="min-w-0"><span class="font-mono text-sm break-all" x-text="refLabel(w.ref)"></span>
                                <span class="text-base-content/60" x-text="w.why ? ' ' + w.why : ''"></span>
                                <span class="text-sm text-base-content/45" x-text="verdict(f, w).detail ? ' · ' + verdict(f, w).detail : ''"></span></span>
                            </li>
                          </template>
                        </ul>
                      </div>
                    </template>
                    <div>
                      <div class="text-sm font-medium text-base-content/55 mb-1">History</div>
                      <ul class="space-y-1">
                        <template x-for="h in f.history" :key="h.id">
                          <li class="text-base"><span class="font-mono text-sm text-base-content/45 mr-1.5" x-text="h.at.slice(0, 10)"></span>
                            <span class="text-sm font-medium mr-1" :class="h.type === 'comment' ? 'text-base-content/55' : 'text-primary'" x-text="historyLabel(h)"></span>
                            <span class="text-base-content/75" x-text="h.type === 'found' ? h.author : h.text"></span></li>
                        </template>
                      </ul>
                    </div>
                    <div x-show="hasToken()" class="space-y-2">
                      <textarea x-model="draft[f.id]" rows="2" class="textarea textarea-bordered w-full text-base"
                                :placeholder="f.open ? 'What you decided, or a comment' : 'Why it should reopen, or a comment'"></textarea>
                      <div class="flex flex-wrap gap-2">
                        <template x-if="f.open">
                          <button class="btn btn-sm btn-primary gap-1.5" @click="resolve(f)" :disabled="busy === f.id"
                                  data-title-tip="Close this finding with your note as the record of what was decided" data-title-tip-bare>
                            <i class="ph ph-check"></i>Handled</button>
                        </template>
                        <template x-if="!f.open">
                          <button class="btn btn-sm gap-1.5" @click="reopen(f)" :disabled="busy === f.id">
                            <i class="ph ph-arrow-counter-clockwise"></i>Reopen</button>
                        </template>
                        <button class="btn btn-sm btn-ghost gap-1.5" @click="comment(f)" :disabled="busy === f.id || !(draft[f.id] || '').trim()"
                                data-title-tip="A comment is kept with the finding and does not close it" data-title-tip-bare>
                          <i class="ph ph-chat-circle-text"></i>Comment</button>
                      </div>
                    </div>
                  </div>
                </template>
              </article>
            </template>
          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.load();
      },

      hasToken() { return !!window.__shell?.hasToken?.(); },
      reg() { return new window.GH({ token: window.TOKEN, repo: REGISTRY(), ref: 'main' }); },

      // The shell owns the address: which list, which finding, and the repo a
      // card sent the reader in with.
      get tab() { return window.__shell?.tendingTab === 'settled' ? 'settled' : 'attention'; },
      get focus() { return window.__shell?.tendingItem || ''; },
      get repoFilter() { return window.__shell?.tendingRepo || ''; },
      setTab(t) { window.__shell?.goTending?.({ tab: t === 'settled' ? 'settled' : '' }); },
      clearRepo() { if (window.__shell) window.__shell.tendingRepo = ''; },

      get findings() { return window.Findings ? window.Findings.fold(this.notes) : []; },
      get filtered() {
        const r = this.repoFilter;
        return r ? this.findings.filter(f => window.Findings.touchesRepo(f, r)) : this.findings;
      },
      get attention() { return window.Findings ? window.Findings.sortOpen(this.filtered.filter(f => f.open)) : []; },
      get settled() { return window.Findings ? window.Findings.sortClosed(this.filtered.filter(f => !f.open)) : []; },
      get shown() { return this.tab === 'settled' ? this.settled : this.attention; },

      async load() {
        if (!this.hasToken()) return;
        this.loading = true; this.err = '';
        try {
          if (!window.Notes && window.gh?.load) await window.gh.load('kits/notes.js');
          if (!window.Findings && window.gh?.load) await window.gh.load('kits/findings.js');
          this.seen = {};
          this.notes = await window.Notes.load(this.reg());
          // Open findings are checked on sight; a settled one when its details open.
          for (const f of this.findings) if (f.open) this.checkWitnesses(f);
          const id = this.focus;
          if (id) {
            this.open[id] = true;
            this.$nextTick(() => document.getElementById('finding-' + id)?.scrollIntoView({ block: 'start' }));
          }
        } catch (e) {
          this.err = e?.message || String(e);
        } finally { this.loading = false; }
      },

      toggle(f) {
        this.open[f.id] = !this.open[f.id];
        if (this.open[f.id] && !f.open) this.checkWitnesses(f);
      },

      // ── Witnesses ────────────────────────────────────────────────────────
      wkey(f, w) { return f.assessedAt + ' ' + w.ref; },
      verdict(f, w) { return this.seen[this.wkey(f, w)] || { verdict: 'pending', detail: '' }; },
      changed(f) {
        return f.witnesses.map(w => ({ ref: w.ref, ...this.verdict(f, w) }))
          .filter(v => v.verdict === 'changed' || v.verdict === 'broken');
      },
      async checkWitnesses(f) {
        const F = window.Findings, gh = this.reg();
        for (const w of f.witnesses) {
          const key = this.wkey(f, w);
          if (this.seen[key]) continue;
          this.seen[key] = { verdict: 'pending', detail: '' };
          this.checking++;
          let observed;
          try { observed = await this.observe(gh, F.witnessPlan(w), f.assessedAt); }
          catch (e) { observed = { error: e?.status === 403 ? 'not readable with this token' : (e?.message || String(e)) }; }
          this.seen[key] = F.compare(w, observed);
          this.checking--;
        }
      },
      async observe(gh, plan, since) {
        const r = (p) => '/repos/' + plan.repo + '/' + p;
        const gone = (e) => e?.status === 404 || e?.status === 422;
        if (plan.type === 'branch') {
          try { return { sha: (await gh.req(r('branches/' + encodeURIComponent(plan.ref)))).commit.sha }; }
          catch (e) { if (gone(e)) return { missing: true }; throw e; }
        }
        if (plan.type === 'path') {
          const q = 'commits?sha=' + encodeURIComponent(plan.ref || 'HEAD') + '&path=' + encodeURIComponent(plan.path)
            + '&since=' + encodeURIComponent(since) + '&per_page=1';
          const list = await gh.req(r(q));
          return { commits: (list || []).map(c => ({ sha: c.sha, date: c.commit?.committer?.date || '',
                                                   message: String(c.commit?.message || '').split('\n')[0].slice(0, 80) })) };
        }
        if (plan.type === 'pr') {
          const p = await gh.req(r('pulls/' + plan.number));
          return { state: p.merged_at ? 'merged' : p.state, updated: p.updated_at };
        }
        return { error: 'unreadable ref' };
      },
      verdictIcon(v) {
        return v === 'ok' ? 'ph-check text-success' : v === 'changed' ? 'ph-arrows-counter-clockwise text-warning'
          : v === 'broken' ? 'ph-x text-error' : v === 'pending' ? 'ph-circle-notch text-base-content/30' : 'ph-question text-base-content/40';
      },

      // ── Writing: a comment, a resolution, a reopening ────────────────────
      async write(f, make) {
        const text = (this.draft[f.id] || '').trim();
        this.busy = f.id; this.err = '';
        try {
          const gh = this.reg();
          const author = await window.Notes.author(gh);
          this.notes = await window.Notes.append(gh, make(text, author));
          this.draft[f.id] = '';
        } catch (e) { this.err = e?.message || String(e); }
        finally { this.busy = ''; }
      },
      comment(f) { return this.write(f, (text, author) => window.Notes.make({ about: 'note:' + f.id, text, author })); },
      resolve(f) { return this.write(f, (text, author) => window.Findings.resolution(f.id, text || 'Handled.', author)); },
      reopen(f) { return this.write(f, (text, author) => window.Findings.reopening(f.id, text || 'Reopened.', author)); },

      // ── Labels and links ─────────────────────────────────────────────────
      kindOf(k) { return window.Findings ? window.Findings.kindOf(k) : { label: k, icon: 'ph-lightbulb' }; },
      detailLabel(f) {
        const parts = [];
        if (f.evidence.length) parts.push(f.evidence.length + ' facts');
        if (f.witnesses.length) parts.push('rests on ' + f.witnesses.length);
        const c = f.history.filter(h => h.type === 'comment').length;
        if (c) parts.push(c + (c === 1 ? ' comment' : ' comments'));
        return parts.join(' · ') || 'Details';
      },
      historyLabel(h) {
        return { found: 'Found', advanced: 'Advanced', settled: 'Settled', resolved: 'Handled',
                 reopened: 'Reopened', comment: 'Comment' }[h.type] || h.type;
      },
      ago(iso) {
        const d = (Date.now() - Date.parse(iso)) / 864e5;
        return !Number.isFinite(d) ? '' : d < 1 ? 'today' : d < 2 ? '1d' : Math.floor(d) + 'd';
      },
      short(repo) { return String(repo || '').split('/')[1] || repo; },
      subjectLabel(s) {
        const p = window.Findings?.parse(s) || {};
        const r = this.short(p.repo);
        if (p.type === 'pr') return r + ' #' + p.number;
        if (p.type === 'branch') return r + ' / ' + p.ref.replace(/^(claude|codex|gemini|grok)\//, '');
        if (p.type === 'session') return 'session ' + p.path.split('/').pop().replace(/\.json$/, '').slice(0, 10);
        if (p.type === 'snag') return r + ' snag ' + p.fragment;
        if (p.type === 'task') return r + ' task ' + p.path.split('/').pop().replace(/\.md$/, '');
        if (p.type === 'file') return r + ' ' + p.path.split('/').pop();
        return s;
      },
      subjectIcon(s) {
        const t = window.Findings?.parse(s)?.type;
        return { pr: 'ph-git-pull-request', branch: 'ph-git-branch', session: 'ph-terminal-window', snag: 'ph-warning',
                 task: 'ph-list-checks', file: 'ph-file-text', repo: 'ph-folder' }[t] || 'ph-link';
      },
      subjectHref(s) {
        const p = window.Findings?.parse(s) || {};
        if (p.type === 'pr') return 'https://github.com/' + p.repo + '/pull/' + p.number;
        if (p.type === 'branch') return '../pages/branch.html#gh=' + p.repo + '@' + p.ref;
        if (p.type === 'session') return '?view=sessions&session=' + p.path.split('/').pop().replace(/\.json$/, '').split('-').pop();
        if (p.type === 'snag') return 'https://github.com/' + p.repo + '/blob/main/' + p.path + '#' + p.fragment;
        if (p.path) return 'https://github.com/' + p.repo + '/blob/' + (p.ref || 'main') + '/' + p.path;
        if (p.type === 'repo') return 'https://github.com/' + p.repo;
        return '#';
      },
      // A witness ref, read the way a subject chip is, plus its path on a ref.
      refLabel(ref) {
        const p = window.Findings?.parse(ref) || {};
        if (p.path && p.type !== 'session') return this.short(p.repo) + (p.ref && p.ref !== 'main' ? '@' + p.ref : '') + ':' + p.path;
        return this.subjectLabel(ref);
      },
    };
  });
});
