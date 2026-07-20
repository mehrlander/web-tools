document.addEventListener('alpine:init', function() {
  Alpine.data('branches', function() {
    // The branch-review view: every branch of the open repo with a
    // landed/stranded rollup on the content-level signal, the browser port of
    // home's tools/branch-survey.sh. Advisory and read-only: it frames the
    // per-branch reconcile judgment (delete / rescue / leave) and decides
    // nothing; every row keeps one-tap routes to GitHub's tree and compare
    // views, and the header links GitHub's branches UI, where the delete
    // action itself lives.
    //
    // The signal, per branch: which of its uniquely-touched paths hold, at
    // the branch tip, bytes that exist on the default branch right now (same
    // path or moved anywhere). Squashes and history rewrites make ref-level
    // "unmerged" unreliable, so DO NOT key on ahead_by: a rewrite-orphaned
    // branch's count spans its whole line (marked * here, like the CLI). The
    // math lives in lib/branch-survey.js (unit-tested, checked for agreement
    // against the CLI by scripts/check-branch-survey.mjs); this component is
    // the fetch plumbing and the render.
    //
    // API cost: one branch list (GraphQL when authed, REST fallback), one
    // recursive tree for the default branch, then per branch one compare (the
    // uniquely-touched paths; on a no-merge-base 404, a commits-list +
    // compare-from-oldest-parent fallback) and one recursive tree, streamed
    // through a small pool so rows fill in as they land. A later registry
    // activity cache (tracker: "Estate activity signals") could feed the same
    // shapes without the per-visit fanout; surveyBranch is kept a plain
    // per-branch step with that seam in mind.
    const GROUPS = {
      active: {
        title: 'Recently active', icon: 'ph-pulse text-info',
        note: 'Commits in the last 14 days; judge nothing yet.',
      },
      landed: {
        title: 'Likely landed', icon: 'ph-check-circle text-success',
        note: 'Nothing missing, or 80%+ of touched paths match the default branch byte-for-byte. Squashes hide ref-level merges; these refs are likely history.',
      },
      stranded: {
        title: 'Likely stranded', icon: 'ph-warning-circle text-warning',
        note: 'Content that exists nowhere on the default branch. Honest limits: files that landed and kept evolving (or moved and evolved) still read stranded; the compare link is ground truth.',
      },
    };
    const COMMIT_CAP = 50;   // history reach for orphaned branches, like the CLI
    const POOL = 4;          // concurrent per-branch surveys

    return {
      description: 'Branch-review view: every branch with a content-level landed/stranded rollup, ported from home’s branch-survey.sh',

      template: `
        <div>
          <div class="flex items-center gap-2 mb-5">
            <h1 class="text-2xl font-bold tracking-tight">Branches</h1>
            <a :href="'https://github.com/' + repo + '/branches'" target="_blank"
               class="text-base-content/30 hover:text-base-content/70 transition-colors"
               title="Manage branches on GitHub (delete lives there)">
              <i class="ph ph-github-logo text-lg leading-none"></i>
            </a>
            <span x-show="surveying" class="flex items-center gap-1.5 text-xs text-base-content/40 font-mono">
              <span class="loading loading-spinner loading-xs"></span>
              <span x-text="doneCount + '/' + rows.length"></span>
            </span>
            <div class="grow"></div>
            <button @click="load()" :disabled="surveying" class="btn btn-ghost btn-xs gap-1" title="Re-run the survey">
              <i class="ph ph-arrows-clockwise" :class="surveying && 'animate-spin'"></i>Refresh
            </button>
          </div>

          <div x-show="loading" class="flex justify-center py-16">
            <span class="loading loading-dots loading-md opacity-30"></span>
          </div>
          <div x-show="error" class="alert alert-error py-2 px-3 text-sm" x-text="error"></div>
          <p x-show="!loading && !error && !rows.length" class="text-base-content/40 italic text-sm py-8">
            No branches beside the default branch.
          </p>

          <template x-for="g in groupList" :key="g.key">
            <section class="mb-6" x-show="g.rows.length">
              <div class="flex items-center gap-2 mb-2 px-1 cursor-help" :title="g.note">
                <i class="ph text-base" :class="g.icon"></i>
                <h2 class="text-sm font-semibold" x-text="g.title"></h2>
                <span class="badge badge-ghost badge-sm" x-text="g.rows.length"></span>
              </div>
              <div class="border border-base-300 rounded-lg bg-base-100 overflow-hidden divide-y divide-base-200">
                <template x-for="r in g.rows" :key="r.name">
                  <div class="flex items-start gap-3 px-3 py-2 hover:bg-base-200/40">
                    <!-- Branch identity: name (+ orphan flag) over its top commit. -->
                    <div class="min-w-0 flex-1">
                      <button @click="openBranch(r)" :title="'Browse ' + r.name + ' here'"
                              class="font-mono text-xs font-medium hover:text-primary transition-colors cursor-pointer
                                     text-left flex items-center gap-1 max-w-full">
                        <span class="truncate" x-text="r.name"></span>
                        <span x-show="r.noBase" class="text-warning shrink-0"
                              title="No shared ancestor with the default branch: content counts span the whole line">*</span>
                      </button>
                      <div class="flex items-baseline gap-1.5 text-[11px] mt-0.5">
                        <span class="text-base-content/40 shrink-0 whitespace-nowrap" x-text="r.ago"></span>
                        <span class="text-base-content/50 truncate" :title="r.subject" x-text="r.subject"></span>
                      </div>
                    </div>

                    <!-- Content signal: landed count, then the strong stranded
                         evidence (missing paths) called out in amber. -->
                    <div class="shrink-0 font-mono text-xs text-right whitespace-nowrap pt-0.5 w-24">
                      <span x-show="r.state==='pending'" class="loading loading-dots loading-xs opacity-30"></span>
                      <span x-show="r.state==='error'" class="text-error" :title="r.err">survey failed</span>
                      <template x-if="r.state==='done'">
                        <span>
                          <span :class="r.nMissing ? 'text-base-content/50' : 'text-success'"
                                :title="r.nLanded + ' of ' + r.nUnique + ' touched paths present on the default branch'"
                                x-text="r.nLanded + '/' + r.nUnique"></span>
                          <span x-show="r.nMissing" class="text-warning font-semibold block"
                                :title="r.missingPaths.slice(0, 12).join('\\n')"><span x-text="r.nMissing"></span> missing</span>
                        </span>
                      </template>
                    </div>

                    <!-- The three routes out: in-shell compare, GitHub tree, GitHub compare. -->
                    <div class="shrink-0 flex items-center gap-1.5 pt-0.5 text-base">
                      <button @click="openCompare(r)" class="text-base-content/30 hover:text-primary transition-colors"
                              :title="'Compare ' + defaultRef + '...' + r.name + ' here'">
                        <i class="ph ph-git-pull-request"></i></button>
                      <a :href="'https://github.com/' + repo + '/tree/' + encodeURIComponent(r.name)" target="_blank"
                         class="text-base-content/30 hover:text-base-content/70 transition-colors" title="Branch tree on GitHub">
                        <i class="ph ph-github-logo"></i></a>
                      <a :href="'https://github.com/' + repo + '/compare/' + encodeURIComponent(defaultRef) + '...' + encodeURIComponent(r.name)"
                         target="_blank" class="text-base-content/30 hover:text-primary transition-colors"
                         title="Compare on GitHub (ground truth)">
                        <i class="ph ph-arrow-square-out"></i></a>
                    </div>
                  </div>
                </template>
              </div>
            </section>
          </template>

          <p x-show="treeTruncated" class="text-xs text-warning flex items-center gap-1.5 mb-4 px-1">
            <i class="ph ph-warning"></i>
            Default-branch tree truncated by the API; counts may undercount.
          </p>
        </div>`,

      loading: true,
      surveying: false,
      error: '',
      rows: [],           // [{name, date, ago, sha, subject, state, ahead, noBase, nUnique, nLanded, nMissing, missingPaths, group, err}]
      treeTruncated: false,
      _runKey: '',

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.load();
        // Track repo switches (a ref switch doesn't re-key: the survey always
        // reads against the default branch).
        this.$watch(() => Alpine.store('browser').repo, () => this.load());
      },

      get gh(){ return Alpine.store('browser').gh; },
      get repo(){ return Alpine.store('browser').repo; },
      get defaultRef(){ return Alpine.store('browser').defaultRef || 'main'; },
      get doneCount(){ return this.rows.filter(r => r.state !== 'pending').length; },
      get groupList(){
        return ['active', 'landed', 'stranded'].map(key => ({
          key, ...GROUPS[key],
          rows: this.rows.filter(r => r.group === key)
            .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        }));
      },

      async load(){
        const gh = this.gh, repo = this.repo;
        if (!gh || !repo) return;
        // A fresh key per load, so a stale in-flight survey pool (repo
        // switched, or Refresh pressed) stops at its next stale-check.
        const key = repo + '#' + (this._runSeq = (this._runSeq || 0) + 1);
        this._runKey = key;
        this.loading = true; this.error = ''; this.rows = []; this.treeTruncated = false;
        try {
          const B = window.BranchSurvey;
          if (!B) throw new Error('branch-survey.js not loaded');

          // Branch list: GraphQL (dates + tips in one call) when a token is
          // present; REST fallback otherwise, dates filled per branch during
          // the survey.
          let list;
          try { list = await gh.branchesDated(); }
          catch { list = (await gh.branches()).map(b => ({ name: b.name, date: '', ago: '', sha: b.commit?.sha || '', subject: '' })); }
          if (this._runKey !== key) return;

          const def = this.defaultRef;
          const rows = list.filter(b => b.name !== def).map(b => ({
            ...b, state: 'pending', ahead: null, noBase: false,
            nUnique: 0, nLanded: 0, nMissing: 0, missingPaths: [],
            // Until surveyed, group by recency alone so the view is useful
            // from the first paint.
            group: b.date && B.daysAgo(b.date, Date.now()) <= B.RECENT_DAYS ? 'active' : 'stranded',
          }));
          this.rows = rows;
          this.loading = false;
          if (!rows.length) return;

          // One recursive tree for the default branch: the blob and path sets
          // every branch is read against.
          const mainTree = await gh.req('git/trees/' + encodeURIComponent(def) + '?recursive=1');
          if (this._runKey !== key) return;
          this.treeTruncated = !!mainTree.truncated;
          const main = B.treeSets(mainTree.tree);

          // Survey through a small pool; each row updates as it lands.
          this.surveying = true;
          let i = 0;
          const next = async () => {
            while (i < rows.length) {
              const r = rows[i++];
              if (this._runKey !== key) return;
              try { await this.surveyBranch(r, main, B); }
              catch (e) { r.state = 'error'; r.err = e?.message || String(e); }
            }
          };
          await Promise.all(Array.from({ length: Math.min(POOL, rows.length) }, next));
        } catch (e) {
          if (this._runKey === key) this.error = 'Branch survey failed: ' + (e?.message || e);
        } finally {
          if (this._runKey === key) { this.loading = false; this.surveying = false; }
        }
      },

      // One branch: its uniquely-touched paths (compare against the default
      // branch; on a no-merge-base 404 — the history-rewrite case — fall back
      // to the diff across its newest COMMIT_CAP commits), its tip tree, then
      // the pure signal + classification.
      async surveyBranch(r, main, B){
        const gh = this.gh, def = this.defaultRef;
        let unique = [];
        try {
          const d = await gh.compare(def, r.name);
          r.ahead = d.ahead_by;
          unique = (d.files || []).map(f => f.filename);
          if (!r.subject && (d.commits || []).length) r.subject = (d.commits[d.commits.length - 1].commit?.message || '').split('\n')[0];
          if (!r.date && (d.commits || []).length) r.date = d.commits[d.commits.length - 1].commit?.committer?.date || '';
        } catch (e) {
          if (e?.status !== 404) throw e;
          // No shared ancestor. Reach back like the CLI: the diff across the
          // branch's newest COMMIT_CAP commits (from the oldest one's parent;
          // a root commit's own changes stay out of reach, same as the cap).
          r.noBase = true;
          const commits = await gh.req('commits?sha=' + encodeURIComponent(r.name) + '&per_page=' + COMMIT_CAP);
          if (!r.date && commits.length) r.date = commits[0].commit?.committer?.date || '';
          if (!r.subject && commits.length) r.subject = (commits[0].commit?.message || '').split('\n')[0];
          const oldest = commits[commits.length - 1];
          const from = oldest?.parents?.[0]?.sha;
          if (from) {
            const d = await gh.compare(from, r.sha || r.name);
            unique = (d.files || []).map(f => f.filename);
          }
        }
        if (!r.ago && r.date && gh.ago) r.ago = gh.ago(r.date);

        const tipTree = await gh.req('git/trees/' + encodeURIComponent(r.sha || r.name) + '?recursive=1');
        const tip = B.treeSets(tipTree.tree);
        const s = B.landedSignal(unique, tip, main);
        Object.assign(r, s);
        r.group = B.classify({ daysAgo: r.date ? B.daysAgo(r.date, Date.now()) : 0, ...s });
        r.state = 'done';
      },

      // In-shell drill-ins: browse the branch (switch the open ref), or open
      // the stage view's compare pre-run on default...branch.
      async openBranch(r){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(this.repo, r.name);
        window.__shell.goFiles();
      },
      // The ref compare mounts right below this view now, so no navigation:
      // just open it with the pair.
      openCompare(r){
        const c = document.getElementById('compare')?.__compare;
        if (c) c.openWith(this.defaultRef, r.name);
      },
    };
  });
});
