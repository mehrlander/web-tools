document.addEventListener('alpine:init', function() {
  Alpine.data('branches', function() {
    // The branch-review view: every branch of the open repo, split across three
    // tabs on the content-level landed/stranded signal (the browser port of
    // home's tools/branch-survey.sh). Advisory and read-only: it frames the
    // per-branch reconcile judgment (delete / rescue / leave) and decides
    // nothing; every row keeps one-tap routes to GitHub's tree and compare
    // views, and the header links GitHub's branches UI, where the delete
    // action itself lives.
    //
    // COST DISCIPLINE (the reason for the tabs). A big repo has hundreds of
    // branches, and the content survey costs ~2 calls per branch (a compare and
    // a tree), so surveying every branch on every visit is a flood. Two levers
    // keep the default cheap:
    //   1. The Recent tab is date-only. Recently-active branches are 'active'
    //      regardless of content, so they never need a survey; they come
    //      straight from the branch list (one call) and are the default tab.
    //   2. Only OLDER branches (the landed/stranded candidates) are surveyed,
    //      and only SURVEY_CAP of them (most-recent-first) by default. "Survey
    //      all" lifts the cap for the full reconcile pass.
    //
    // The signal, per older branch: which of its uniquely-touched paths hold, at
    // the branch tip, bytes that exist on the default branch right now (same
    // path or moved anywhere). Squashes and history rewrites make ref-level
    // "unmerged" unreliable, so DO NOT key on ahead_by. The math lives in
    // lib/branch-survey.js (unit-tested, checked against the CLI by
    // scripts/check-branch-survey.mjs); this component is the fetch plumbing and
    // the render.
    const TAB_META = {
      active: {
        title: 'Recent', icon: 'ph-pulse',
        note: 'Commits in the last 14 days. Date-only, not surveyed: judge nothing yet.',
      },
      landed: {
        title: 'Landed', icon: 'ph-check-circle',
        note: 'Older branches whose content is on the default branch (nothing missing, or 80%+ of touched paths match byte-for-byte). Squashes hide ref-level merges; these are likely history.',
      },
      stranded: {
        title: 'Stranded', icon: 'ph-warning-circle',
        note: 'Older branches holding content that exists nowhere on the default branch. Honest limit: files that landed and then kept evolving still read stranded; the compare link is ground truth.',
      },
    };
    const SURVEY_CAP = 30;   // older branches surveyed by default
    const COMMIT_CAP = 50;   // history reach for orphaned branches, like the CLI
    const POOL = 4;          // concurrent per-branch surveys

    return {
      description: 'Branch-review view: tabbed recent / landed / stranded rollup with a capped content survey, ported from home’s branch-survey.sh',

      template: `
        <div>
          <div class="flex items-center gap-2 mb-3">
            <h1 class="text-2xl font-bold tracking-tight">Branches</h1>
            <a :href="'https://github.com/' + repo + '/branches'" target="_blank"
               class="text-base-content/30 hover:text-base-content/70 transition-colors"
               title="Manage branches on GitHub (delete lives there)">
              <i class="ph ph-github-logo text-lg leading-none"></i>
            </a>
            <span x-show="!loading" class="text-xs text-base-content/40 font-mono" x-text="list.length + ' total'"></span>
            <span x-show="surveying" class="flex items-center gap-1.5 text-xs text-base-content/40 font-mono">
              <span class="loading loading-spinner loading-xs"></span>
              <span x-text="'surveying ' + surveyedCount + '/' + surveyTarget"></span>
            </span>
            <div class="grow"></div>
            <button @click="reload()" :disabled="surveying || loading" class="btn btn-ghost btn-xs gap-1" title="Reload branches and re-run the capped survey">
              <i class="ph ph-arrows-clockwise" :class="surveying && 'animate-spin'"></i>Refresh
            </button>
          </div>

          <div x-show="loading" class="flex justify-center py-16">
            <span class="loading loading-dots loading-md opacity-30"></span>
          </div>
          <div x-show="error" class="alert alert-error py-2 px-3 text-sm" x-text="error"></div>
          <p x-show="!loading && !error && !list.length" class="text-base-content/40 italic text-sm py-8">
            No branches beside the default branch.
          </p>

          <div x-show="!loading && !error && list.length">
            <!-- Tabs: one table at a time. Each carries its own count and a
                 tooltip definition, so no prose sits on the page. -->
            <div role="tablist" class="tabs tabs-boxed bg-base-200/50 w-fit mb-4">
              <template x-for="t in tabList" :key="t.key">
                <a role="tab" class="tab gap-1.5" :class="t.key===activeTab && 'tab-active'"
                   @click="activeTab=t.key" :title="t.note">
                  <i class="ph" :class="t.icon"></i>
                  <span x-text="t.title"></span>
                  <span class="badge badge-ghost badge-sm" x-text="t.count"></span>
                </a>
              </template>
            </div>

            <p x-show="activeTab!=='active' && !surveying && !surveyStarted" class="text-sm text-base-content/40 italic py-6">
              Nothing surveyed yet.
            </p>

            <!-- The table is its own bounded scroll region so the header pins
                 within it (a sticky thead needs its scroll container to be the
                 nearest overflow ancestor; the outer shell scroll is too far). -->
            <div x-show="rows.length" class="border border-base-300 rounded-lg bg-base-100 overflow-y-auto max-h-[70vh]">
              <table class="table table-sm table-fixed w-full">
                <thead>
                  <tr class="sticky top-0 z-10 bg-base-100 text-base-content/50 [&>th]:border-b [&>th]:border-base-300">
                    <th>Branch</th>
                    <th x-show="activeTab!=='active'" class="text-right whitespace-nowrap w-24"
                        title="Touched paths present on the default branch / total, then any missing">Content</th>
                    <th class="text-right w-16">Age</th>
                    <th class="text-right w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  <template x-for="r in rows" :key="r.name">
                    <tr class="hover:bg-base-200/40 align-top">
                      <td>
                        <button @click="openBranch(r)" :title="'Browse ' + r.name + ' here'"
                                class="font-mono text-xs font-medium hover:text-primary transition-colors cursor-pointer
                                       text-left flex items-center gap-1 max-w-full">
                          <span class="truncate" x-text="r.name"></span>
                          <span x-show="r.noBase" class="text-warning shrink-0"
                                title="No shared ancestor with the default branch: content counts span the whole line">*</span>
                        </button>
                        <span class="text-[11px] text-base-content/50 truncate block" :title="r.subject" x-text="r.subject"></span>
                      </td>
                      <td x-show="activeTab!=='active'" class="text-right whitespace-nowrap font-mono text-xs align-middle">
                        <span x-show="r.state==='pending'" class="loading loading-dots loading-xs opacity-30"></span>
                        <span x-show="r.state==='error'" class="text-error" :title="r.err">failed</span>
                        <template x-if="r.state==='done'">
                          <span>
                            <span :class="r.nMissing ? 'text-base-content/50' : 'text-success'"
                                  :title="r.nLanded + ' of ' + r.nUnique + ' touched paths present on the default branch'"
                                  x-text="r.nLanded + '/' + r.nUnique"></span>
                            <span x-show="r.nMissing" class="text-warning font-semibold block leading-tight"
                                  :title="r.missingPaths.slice(0, 12).join('\\n')"><span x-text="r.nMissing"></span> missing</span>
                          </span>
                        </template>
                      </td>
                      <td class="text-right whitespace-nowrap text-[11px] text-base-content/40 align-middle" x-text="r.ago"></td>
                      <td class="text-right whitespace-nowrap align-middle">
                        <div class="flex items-center gap-1.5 text-base justify-end">
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
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <!-- Cap notice: how many older branches remain unsurveyed, and the
                 opt-in to the full pass. Only on the surveyed tabs. -->
            <div x-show="activeTab!=='active' && unsurveyed > 0" class="flex items-center gap-2 mt-3 px-1 text-xs text-base-content/50">
              <span x-text="'Surveyed ' + surveyedCount + ' of ' + older.length + ' older branches.'"></span>
              <button @click="surveyAll()" :disabled="surveying" class="btn btn-ghost btn-xs gap-1 text-primary">
                <i class="ph ph-magnifying-glass"></i>Survey all
              </button>
            </div>

            <p x-show="treeTruncated" class="text-xs text-warning flex items-center gap-1.5 mt-3 px-1">
              <i class="ph ph-warning"></i>
              Default-branch tree truncated by the API; counts may undercount.
            </p>
          </div>
        </div>`,

      loading: true,
      surveying: false,
      surveyStarted: false,
      error: '',
      activeTab: 'active',
      list: [],           // every non-default branch: {name, date, ago, sha, subject, daysAgo}
      recent: [],         // list where daysAgo <= RECENT_DAYS (date-only, never surveyed)
      older: [],          // survey candidates: {...branch, state, noBase, nUnique, nLanded, nMissing, missingPaths, group, err}
      surveyCap: SURVEY_CAP,
      treeTruncated: false,
      _main: null,        // cached default-branch treeSets
      _runKey: '',

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.load();
        // A ref switch doesn't re-key (the survey always reads against the
        // default branch); a repo switch reloads.
        this.$watch(() => Alpine.store('browser').repo, () => this.load());
      },

      get gh(){ return Alpine.store('browser').gh; },
      get repo(){ return Alpine.store('browser').repo; },
      get defaultRef(){ return Alpine.store('browser').defaultRef || 'main'; },

      // ── Tab plumbing ─────────────────────────────────────────────────────────
      get rows(){
        if (this.activeTab === 'active') return this.recent;
        return this.older
          .filter(r => r.group === this.activeTab)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      },
      get tabList(){
        return ['active', 'landed', 'stranded'].map(key => ({
          key, ...TAB_META[key],
          icon: TAB_META[key].icon + (key === this.activeTab ? ' text-primary' : ''),
          count: key === 'active' ? this.recent.length : this.older.filter(r => r.group === key).length,
        }));
      },
      get surveyedCount(){ return this.older.filter(r => r.state === 'done' || r.state === 'error').length; },
      get unsurveyed(){ return this.older.filter(r => r.state === 'idle').length; },
      // The count the current survey pass is driving toward (for the header).
      get surveyTarget(){ return Math.min(this.surveyCap, this.older.length); },

      async reload(){ this.surveyCap = SURVEY_CAP; await this.load(); },

      async load(){
        const gh = this.gh, repo = this.repo;
        if (!gh || !repo) return;
        const key = repo + '#' + (this._runSeq = (this._runSeq || 0) + 1);
        this._runKey = key;
        this.loading = true; this.error = ''; this.list = []; this.recent = []; this.older = [];
        this.treeTruncated = false; this.surveyStarted = false; this._main = null;
        try {
          const B = window.BranchSurvey;
          if (!B) throw new Error('branch-survey.js not loaded');

          // Branch list: GraphQL (dates + tips in one call) when a token is
          // present; REST fallback otherwise. This single call is the whole cost
          // of the default Recent tab.
          let list;
          try { list = await gh.branchesDated(); }
          catch { list = (await gh.branches()).map(b => ({ name: b.name, date: '', ago: '', sha: b.commit?.sha || '', subject: '' })); }
          if (this._runKey !== key) return;

          const def = this.defaultRef, now = Date.now();
          this.list = list.filter(b => b.name !== def).map(b => ({
            ...b, daysAgo: b.date ? B.daysAgo(b.date, now) : Infinity,
          }));
          this.recent = this.list
            .filter(b => b.daysAgo <= B.RECENT_DAYS)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          this.older = this.list
            .filter(b => b.daysAgo > B.RECENT_DAYS)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .map(b => ({ ...b, state: 'idle', noBase: false, nUnique: 0, nLanded: 0, nMissing: 0, missingPaths: [], group: null, err: '' }));
          this.loading = false;

          // Kick off the capped survey so the Landed/Stranded tabs fill without a
          // click, but bounded. The Recent tab is already usable.
          if (this.older.length) this.runSurvey(key, B);
        } catch (e) {
          if (this._runKey === key) { this.error = 'Branch load failed: ' + (e?.message || e); this.loading = false; }
        }
      },

      // Survey the idle older branches up to surveyCap, most-recent-first,
      // through a small pool. Fetches the default-branch tree once and caches it.
      async runSurvey(key, B){
        B = B || window.BranchSurvey;
        this.surveyStarted = true;
        this.surveying = true;
        try {
          if (!this._main){
            const def = this.defaultRef;
            const mainTree = await this.gh.req('git/trees/' + encodeURIComponent(def) + '?recursive=1');
            if (this._runKey !== key) return;
            this.treeTruncated = !!mainTree.truncated;
            this._main = B.treeSets(mainTree.tree);
          }
          const queue = this.older.filter(r => r.state === 'idle').slice(0, this.surveyCap - this.surveyedCount);
          queue.forEach(r => { r.state = 'pending'; });
          let i = 0;
          const next = async () => {
            while (i < queue.length){
              const r = queue[i++];
              if (this._runKey !== key) return;
              try { await this.surveyBranch(r, this._main, B); }
              catch (e) { r.state = 'error'; r.err = e?.message || String(e); }
            }
          };
          await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, next));
        } finally {
          if (this._runKey === key) this.surveying = false;
        }
      },

      // Lift the cap and survey the rest of the older branches.
      async surveyAll(){
        this.surveyCap = this.older.length;
        await this.runSurvey(this._runKey);
      },

      // One older branch: its uniquely-touched paths (compare against the default
      // branch; on a no-merge-base 404 — the history-rewrite case — the diff
      // across its newest COMMIT_CAP commits), its tip tree, then the pure signal
      // and its landed/stranded classification.
      async surveyBranch(r, main, B){
        const gh = this.gh, def = this.defaultRef;
        let unique = [];
        try {
          const d = await gh.compare(def, r.name);
          unique = (d.files || []).map(f => f.filename);
          if (!r.subject && (d.commits || []).length) r.subject = (d.commits[d.commits.length - 1].commit?.message || '').split('\n')[0];
          if (!r.date && (d.commits || []).length) r.date = d.commits[d.commits.length - 1].commit?.committer?.date || '';
        } catch (e) {
          if (e?.status !== 404) throw e;
          r.noBase = true;
          const commits = await gh.req('commits?sha=' + encodeURIComponent(r.name) + '&per_page=' + COMMIT_CAP);
          if (!r.date && commits.length) r.date = commits[0].commit?.committer?.date || '';
          if (!r.subject && commits.length) r.subject = (commits[0].commit?.message || '').split('\n')[0];
          const oldest = commits[commits.length - 1];
          const from = oldest?.parents?.[0]?.sha;
          if (from){
            const d = await gh.compare(from, r.sha || r.name);
            unique = (d.files || []).map(f => f.filename);
          }
        }
        if (!r.ago && r.date && gh.ago) r.ago = gh.ago(r.date);

        const tipTree = await gh.req('git/trees/' + encodeURIComponent(r.sha || r.name) + '?recursive=1');
        const tip = B.treeSets(tipTree.tree);
        const s = B.landedSignal(unique, tip, main);
        Object.assign(r, s);
        // Older by construction, so classify returns landed | stranded.
        r.group = B.classify({ daysAgo: r.date ? B.daysAgo(r.date, Date.now()) : 999, ...s });
        r.state = 'done';
      },

      // In-shell drill-ins: browse the branch (switch the open ref), or open the
      // ref-compare (mounted below this view by the shell) pre-run on
      // default...branch.
      async openBranch(r){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(this.repo, r.name);
        window.__shell.goFiles();
      },
      openCompare(r){
        const c = document.getElementById('compare')?.__compare;
        if (c) c.openWith(this.defaultRef, r.name);
      },
    };
  });
});
