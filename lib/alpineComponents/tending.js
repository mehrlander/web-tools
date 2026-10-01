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
    // Two lists, one control. Attention holds every finding with work
    // outstanding, whatever its kind (an overtaken PR still waits to be
    // closed), plus any settled finding whose evidence has since moved.
    // Settled holds the rest, kept to be inspected rather than hidden. A
    // comment here is an ordinary reply and changes nothing; Handled writes a
    // reply that carries `finding.status: "resolved"`, which is the only way
    // the owner closes a finding, and Reopen is its inverse.
    //
    // Every finding's witnesses are checked against GitHub on sight, settled
    // ones included, by the rule kits/findings.js compare() states and
    // skills/tend/findings.py check applies: the pinned tip, contained commit,
    // object or pull-request state against what holds now. A witness that
    // moved marks the finding changed since it was assessed, so a reader knows
    // to weigh it again and the next pass knows to reassess it.
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
                <!-- The list reads as a list: kind, title, the owner's call when
                     there is one, and the subjects. A tap opens why it matters,
                     the next step, the evidence, the witnesses and the history,
                     which on a phone is a screen per finding and so is not the
                     default. -->
                <button @click="toggle(f)" class="w-full text-left" :aria-expanded="!!open[f.id]">
                  <div class="flex items-center gap-1.5 text-sm text-base-content/55 mb-1">
                    <i class="ph text-base" :class="kindOf(f.kind).icon"></i>
                    <span x-text="kindOf(f.kind).label"></span>
                    <template x-if="f.status === 'resolved'"><span class="text-base-content/40">· handled</span></template>
                    <div class="grow"></div>
                    <span class="font-mono text-base-content/40" :data-title-tip="'Found ' + f.at.slice(0, 10) + ' by ' + f.author + (f.assessedAt !== f.at ? '; last assessed ' + f.assessedAt.slice(0, 10) : '')"
                          data-title-tip-bare x-text="ago(f.assessedAt)"></span>
                    <i class="ph text-base text-base-content/40" :class="open[f.id] ? 'ph-caret-up' : 'ph-caret-down'"></i>
                  </div>
                  <h3 class="text-base font-semibold text-balance leading-snug" x-text="f.title"></h3>
                </button>

                <template x-if="changed(f).length">
                  <div class="mt-2 flex items-start gap-1.5 text-base text-warning">
                    <i class="ph ph-arrows-counter-clockwise text-lg shrink-0 mt-0.5"></i>
                    <div><span class="font-medium" x-text="f.open ? 'Changed since assessed: ' : 'Settled, but changed since: '"></span>
                      <template x-for="(c, i) in changed(f)" :key="c.ref">
                        <span><span x-text="(i ? '; ' : '') + refLabel(c.ref)"></span><span class="text-base-content/60" x-text="c.detail ? ' (' + c.detail + ')' : ''"></span></span>
                      </template></div>
                  </div>
                </template>

                <template x-if="f.choice && f.open">
                  <div class="mt-2 border-l-2 border-primary pl-3">
                    <div class="text-sm font-medium text-primary">Your call</div>
                    <p class="text-base text-pretty" :class="!open[f.id] && 'line-clamp-3'" x-text="f.choice"></p>
                  </div>
                </template>
                <!-- The outstanding step stays on the row until someone does it:
                     the assessment being finished is not the work being done. -->
                <template x-if="f.next && f.open">
                  <p class="mt-2 text-base text-pretty" :class="!open[f.id] && 'line-clamp-2'">
                    <span class="text-sm font-medium text-base-content/55 mr-1.5">Next</span><span x-text="f.next"></span></p>
                </template>
                <template x-if="!f.open">
                  <p class="mt-1.5 flex items-start gap-1.5 text-sm text-base-content/55">
                    <i class="ph mt-0.5" :class="f.status === 'resolved' ? 'ph-user-check' : 'ph-check'"></i>
                    <span x-text="closedLine(f)"></span></p>
                </template>

                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <template x-for="s in f.subjects" :key="s">
                    <a :href="subjectHref(s)" :target="subjectHref(s).startsWith('http') ? '_blank' : null"
                       class="flex items-center gap-1 rounded-md bg-base-200/70 px-2 py-0.5 text-sm font-mono text-base-content/70 hover:text-primary max-w-full"
                       :data-title-tip="s" data-title-tip-bare>
                      <i class="ph shrink-0" :class="subjectIcon(s)"></i><span class="truncate" x-text="subjectLabel(s)"></span></a>
                  </template>
                </div>

                <template x-if="open[f.id]">
                  <div class="mt-3 space-y-2">
                    <p class="text-base text-base-content/80 text-pretty" x-text="f.why"></p>
                    <template x-if="f.next && !f.open">
                      <p class="text-base text-pretty text-base-content/60"><span class="text-sm font-medium mr-1.5">Was next</span><span x-text="f.next"></span></p>
                    </template>
                  </div>
                </template>

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
      // A settled finding whose evidence moved comes back to Attention until a
      // pass reassesses it, so a change under a closed finding is never only
      // visible to someone who opens it.
      verdictsOf(f) { return f.witnesses.map(w => this.verdict(f, w)); },
      get attention() {
        if (!window.Findings) return [];
        const F = window.Findings;
        return F.sortOpen(this.filtered.filter(f => F.needsAttention(f, this.verdictsOf(f))));
      },
      get settled() {
        if (!window.Findings) return [];
        const F = window.Findings;
        return F.sortClosed(this.filtered.filter(f => !F.needsAttention(f, this.verdictsOf(f))));
      },
      get shown() { return this.tab === 'settled' ? this.settled : this.attention; },

      async load() {
        if (!this.hasToken()) return;
        this.loading = true; this.err = '';
        try {
          if (!window.Notes && window.gh?.load) await window.gh.load('kits/notes.js');
          if (!window.Findings && window.gh?.load) await window.gh.load('kits/findings.js');
          this.seen = {};
          this.notes = await window.Notes.load(this.reg());
          // Every finding is checked on sight, open ones first, a few calls at
          // a time: a settled finding's evidence moving is what brings it back.
          const all = this.findings;
          this.checkAll([...all.filter(f => f.open), ...all.filter(f => !f.open)]);
          const id = this.focus;
          if (id) {
            this.open[id] = true;
            this.$nextTick(() => document.getElementById('finding-' + id)?.scrollIntoView({ block: 'start' }));
          }
        } catch (e) {
          this.err = e?.message || String(e);
        } finally { this.loading = false; }
      },

      toggle(f) { this.open[f.id] = !this.open[f.id]; },

      // ── Witnesses ────────────────────────────────────────────────────────
      wkey(f, w) { return f.assessedAt + ' ' + w.ref; },
      verdict(f, w) { return this.seen[this.wkey(f, w)] || { verdict: 'pending', detail: '' }; },
      changed(f) {
        return f.witnesses.map(w => ({ ref: w.ref, ...this.verdict(f, w) }))
          .filter(v => v.verdict === 'changed' || v.verdict === 'broken');
      },
      // A queue drained by a few workers, so a store of dozens of findings
      // does not open a hundred requests at once.
      async checkAll(fs, workers = 6) {
        const jobs = fs.flatMap(f => f.witnesses.map(w => [f, w]));
        const F = window.Findings, gh = this.reg();
        const run = async () => {
          for (let job = jobs.shift(); job; job = jobs.shift()) {
            const [f, w] = job, key = this.wkey(f, w);
            if (this.seen[key]) continue;
            this.seen[key] = { verdict: 'pending', detail: '' };
            this.checking++;
            let observed;
            try { observed = await this.observe(gh, F.witnessPlan(w), w, f.assessedAt); }
            catch (e) { observed = { error: e?.status === 403 || e?.status === 401 ? 'not readable with this token' : (e?.message || String(e)) }; }
            this.seen[key] = F.compare(w, observed);
            this.checking--;
          }
        };
        await Promise.all(Array.from({ length: workers }, run));
      },
      // What holds now for one witness, in the shapes compare() reads. A path
      // is read through its parent folder's listing, which reports the blob
      // sha of a file and the tree sha of a folder alike: the same object the
      // command line reads with git rev-parse, so a change made between the
      // investigation and the recording still shows.
      async observe(gh, plan, w, since) {
        const r = (p) => '/repos/' + plan.repo + '/' + p;
        const gone = (e) => e?.status === 404 || e?.status === 422;
        const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
        if (plan.type === 'branch') {
          try { return { sha: (await gh.req(r('branches/' + encodeURIComponent(plan.ref)))).commit.sha }; }
          catch (e) { if (gone(e)) return { missing: true }; throw e; }
        }
        if (plan.type === 'contains') {
          try {
            const c = await gh.req(r('compare/' + encodeURIComponent(plan.commit) + '...' + encodeURIComponent(plan.ref)));
            return { contained: c.status === 'ahead' || c.status === 'identical' };
          } catch (e) { if (gone(e)) return { missing: true }; throw e; }
        }
        if (plan.type === 'path') {
          if (!w.sha) {
            const q = 'commits?sha=' + encodeURIComponent(plan.ref) + '&path=' + encodeURIComponent(plan.path)
              + '&since=' + encodeURIComponent(since) + '&per_page=1';
            const list = await gh.req(r(q));
            return { commits: (list || []).map(c => ({ sha: c.sha, message: String(c.commit?.message || '').split('\n')[0].slice(0, 80) })) };
          }
          const cut = plan.path.lastIndexOf('/');
          const parent = cut < 0 ? '' : plan.path.slice(0, cut), name = plan.path.slice(cut + 1);
          let listing;
          try { listing = await gh.req(r('contents/' + enc(parent) + '?ref=' + encodeURIComponent(plan.ref))); }
          catch (e) { if (gone(e)) return { missing: true }; throw e; }
          const hit = Array.isArray(listing) ? listing.find(x => x.name === name) : null;
          if (!hit) return { missing: true };
          let detail = '';
          if (!String(hit.sha).startsWith(w.sha) && !String(w.sha).startsWith(hit.sha)) {
            const last = await gh.req(r('commits?sha=' + encodeURIComponent(plan.ref) + '&path=' + encodeURIComponent(plan.path) + '&per_page=1')).catch(() => []);
            const c = (last || [])[0];
            if (c) detail = 'last touched by ' + String(c.sha).slice(0, 7) + ' ' + String(c.commit?.message || '').split('\n')[0].slice(0, 60);
          }
          return { sha: hit.sha, detail };
        }
        if (plan.type === 'pr') {
          try {
            const p = await gh.req(r('pulls/' + plan.number));
            return { state: p.merged_at ? 'merged' : p.state, updated: p.updated_at };
          } catch (e) { if (gone(e)) return { error: 'pull request not found' }; throw e; }
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
      // What closed a finding, which is the other half of "assessed": nothing
      // was left to do, tending did it, or the owner handled it.
      closedLine(f) {
        const c = f.closedBy;
        if (f.status === 'resolved') return 'Handled' + (c ? ' ' + c.at.slice(0, 10) + (c.text ? ': ' + c.text : '') : '');
        if (c?.did) return 'Done ' + c.at.slice(0, 10) + ': ' + c.did;
        if (c) return 'Settled ' + c.at.slice(0, 10) + (c.text ? ': ' + c.text : '');
        return 'Nothing left to do';
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
