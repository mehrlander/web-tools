// alpineComponents/quick-find.js — the sidebar's always-ready finder.
//
// One input at the top of the sidebar, sitting ready on desktop and one drawer
// tap away on a phone. It is a DISPATCHER over what the app already holds, not
// a search engine: every lane resolves from client-side state or a cached
// read, and nothing is indexed or committed anywhere. The query's shape picks
// the lane:
//
//   #123 or 123     a PR in ANY state, estate-wide (the activity cache's
//                   openPRs plus its any-state branchPRs index), the row
//                   marked merged / closed / draft / ready; `#` alone lists
//                   the OPEN ones, since that question is "what is in
//                   flight". Opens the branch-detail takeover, the same
//                   reader an Open row's name opens.
//   @               repo-then-file NAVIGATION, the mention picker's reading
//                   of the trigger: `@` lists the estate repos, picking one
//                   completes to `@repo/` and lists that repo's root, folders
//                   complete deeper, a file opens. Typing past the slash
//                   filters the current folder AND fuzzy-matches the whole
//                   tree, so `@web-tools/ghapi` lands on lib/gh-api.js
//                   without walking. One recursive tree call per repo, cached
//                   (the stage's Browse/Search share this economy).
//   owner/repo[@ref]:path   a pasted address (RepoAddress, the estate's one
//                   grammar) opens the file; the repo half accepts the short
//                   name when exactly one estate repo matches. `repo@branch`
//                   opens that branch's takeover. PASTE-ONLY lanes: they
//                   resolve exactly and suggest nothing, because nobody types
//                   a branch name from memory hoping for IntelliSense
//                   (measured: the suggestion lists were noise).
//   +idea           an explicit jot: the one row is "Jot this", Enter files it.
//   anything else   substring match over estate repos, the app's nav
//                   (estateNav + appNav), FILE NAMES in every estate repo, and
//                   open PR titles. File names come from the registry's index
//                   (state/files.json, lib/kits/file-index.js), read once on
//                   first focus, so every repo answers on the first keystroke
//                   with no tree read. A registry with no index yet falls back
//                   to the trees already cached (the open repo's loads on first
//                   use) behind a "File names, every repo" tap.
//                   Two DEEPER passes ride a tap gate. "File
//                   contents" ROUTES to the Search view (shell.goSearch) with
//                   the query carried over: a content search wants parameters
//                   and room for results, which a panel does not have, and
//                   its caveats (default branches, indexing lag) live there.
//                   "Sessions" greps the captured records in place
//                   (EstateSearch.sessions: search.py's --grep in the
//                   browser, hits opening the Sessions pane's reader via
//                   web-tools:open-session). A ran search's rows replace the
//                   lanes while the query stays put, under a clear row that
//                   dismisses them; editing a character falls back. Every
//                   fetch and cache is lib/kits/estate-search.js, shared with the
//                   Search view, so neither surface pays twice.
//
// RESULTS ARE GROUPED AND REPLACE THE SIDEBAR LIST. Each kind of answer sits
// under its own heading with its count (Go to, Files, Pull requests, Search
// further, Keep), the shape the budget-drs sidebar search settled on, because
// a file, a PR, a route out and a jot are each a different click and a flat
// list left the reader to learn the icons. While a query has rows the panel
// takes the sidebar's height and the repo list under it hides (the `finder`
// store), rather than a dropdown floating over it at 60% of the screen.
//
// The last row is always "Jot this" (token-gated): a query that found nothing
// is usually an idea, and the pile (lists/jots.json in the registry) is where
// an idea waits. That makes the box's contract total: what you type is either
// found or kept.
//
// PR rows resolve through the activity cache (state/activity.json,
// lib/kits/repo-activity-cache.js), read lazily ONCE on first focus and re-read on
// web-tools:activity-refreshed. Opening a branch dispatches
// web-tools:open-branch-detail, which the estate consumes exactly like a
// &detail= deep link: switch to the Open list, open the takeover, tolerate a
// row the cache does not carry.
//
// THE KEY THAT REACHES THIS BOX IS NOT REGISTERED HERE. `/` used to be, on a
// window listener this component owned; the shell's wireAppTypeahead now routes
// every bare printable key to a search box, and `/` is one case of that rule,
// so there is one owner rather than two listeners racing for the same
// keystroke. The contract left behind is the input's id, `quick-find-box`,
// which is what the router names. A page that mounts quickFind outside that
// shell gets no keyboard route until it wires one.
//
// Results are a flat keyboard list (down/up/enter, escape clears then closes);
// completion rows rewrite the input and keep focus instead of acting, which is
// what makes the @ walk a walk.
//
// Reads the shell through window.__shell (raw, untracked — fine here, since
// every render is driven by the local `q`, `act_`, and `trees_`, all
// reactive) and mounts by the crumb-bar idiom: template injected in init,
// then Alpine.initTree.

document.addEventListener('alpine:init', function () {
  // Whether the finder's results are showing, for the shell's sidebar list to
  // step aside. One flag, written by the finder alone.
  if (!Alpine.store('finder')) Alpine.store('finder', { open: false });
  Alpine.data('quickFind', function () {
    const JOTS_PATH = 'lists/jots.json';
    const CAP = 8;                    // rows per lane, so the panel stays a panel
    const FILES_SHOWN = 6;            // file rows before "+N more"
    const FILES_MORE = 30;            // file rows after it; past this, the Search view
    const short = (repo) => String(repo || '').split('/')[1] || repo;
    // The grouped answer for one query, kept OUTSIDE the reactive object: the
    // template asks for it several times a render (sections, rows, the active
    // key), and an index search per ask would repeat the same work. `rev_`
    // moves whenever an input it cannot see changes.
    let memo = null;

    return {
      description: 'Sidebar finder: #PR, @ repo-then-file navigation, pasted addresses, file-name search over cached trees, with a Jot-this fallback',

      template: `
        <div class="flex flex-col min-h-0 h-full" @click.outside="open = false"
             x-effect="$store.finder.open = open && rows.length > 0">
          <div class="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-base-300 bg-base-200/50 focus-within:border-primary/50 focus-within:bg-base-100 transition-colors shrink-0">
            <i class="ph ph-magnifying-glass text-base leading-none text-base-content/40 shrink-0"></i>
            <input x-ref="box" id="quick-find-box" x-model="q" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                   placeholder="Find: #PR, @repo/file, name"
                   aria-label="Find" role="combobox" :aria-expanded="open" aria-controls="quick-find-results"
                   class="grow min-w-0 appearance-none border-0 bg-transparent outline-none text-base placeholder:text-base-content/30"
                   @focus="onFocus()" @input="onInput()"
                   @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
                   @keydown.enter.prevent="go()" @keydown.escape="onEscape($event)">
            <kbd x-show="!q" class="kbd kbd-xs hidden lg:inline-flex opacity-50">/</kbd>
            <button type="button" x-show="q" @click="q = ''; $refs.box.focus()" tabindex="-1"
                    class="shrink-0 text-base-content/30 hover:text-base-content/70 transition-colors" title="Clear">
              <i class="ph ph-x text-sm leading-none"></i>
            </button>
          </div>
          <!-- In the sidebar's flow rather than floating over it: the repo list
               below steps aside while this shows (the finder store), so the
               answer gets the sidebar's whole height. No transition: the panel
               opens per keystroke, and Alpine rejects a cancelled transition's
               promise, which a fast open/close toggle (typing) does routinely. -->
          <section x-cloak x-show="open && rows.length"
                   id="quick-find-results" role="listbox"
                   class="-mx-3 mt-1 flex-1 min-h-0 overflow-y-auto pb-3">
            <template x-for="s in sections" :key="s.id">
              <div class="flex flex-col">
                <!-- A heading per kind of answer, in the sidebar's own heading
                     type, with the count of what it found rather than of what
                     it shows. -->
                <div class="flex items-center gap-2 px-5 pt-3 pb-1">
                  <span class="text-sm font-mono uppercase tracking-widest text-base-content/40" x-text="s.title"></span>
                  <span class="h-px grow bg-base-300"></span>
                  <span x-show="s.total > 1" class="text-sm font-mono tabular-nums text-base-content/35" x-text="s.total.toLocaleString()"></span>
                </div>
                <template x-for="r in s.rows" :key="r.key">
                  <button type="button" role="option" :aria-selected="activeKey === r.key"
                          @click="act(r)" @mouseenter="active = indexOf(r.key)"
                          class="w-full min-h-10 flex flex-col justify-center px-5 py-1.5 text-left text-base transition-colors"
                          :class="activeKey === r.key ? 'bg-base-200' : ''">
                    <span class="flex items-center gap-2.5 w-full">
                      <i class="ph shrink-0 text-lg text-base-content/50"
                         :class="[r.icon, r.spin && 'animate-spin']"></i>
                      <!-- A tail-marked label (a path) truncates from the LEFT:
                           the filename is the informative end, and clipping from
                           the right on a phone left every path reading the same.
                           (No backticks in this comment: the markup is a JS
                           template literal.) -->
                      <span class="min-w-0 flex-1 truncate"
                            :class="[r.mono && 'font-mono', r.tail && '[direction:rtl] text-left', r.dim && 'text-base-content/50']"
                            x-text="r.label"></span>
                      <span x-show="r.sub" class="shrink-0 max-w-[45%] truncate text-sm text-base-content/40" x-text="r.sub"></span>
                    </span>
                    <!-- The matched fragment, when a row carries one (a content
                         or session hit): one dim line under the label. -->
                    <span x-show="r.note" class="w-full truncate pl-[1.9rem] text-sm text-base-content/40" x-text="r.note"></span>
                  </button>
                </template>
              </div>
            </template>
          </section>
        </div>`,

      q: '',
      open: false,
      active: 0,
      act_: {},            // activity cache, repos map; reactive so rows recompute when it lands
      _actLoaded: false,
      trees_: {},          // repo -> { paths: [blob paths], truncated }; the walk and file lanes
      _treeLoading: {},
      deepLoading: false,
      sess_: null,         // { q, hits, loading, error }: the last session search
      idx_: null,          // the registry's file index; false when it has none
      _idxAsked: false,
      rev_: 0,             // moves when an input the grouped answer reads changes
      expanded_: {},       // section id -> true once its "+N more" was tapped

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.$watch('q', () => { this.active = 0; this.expanded_ = {}; this.open = !!this.q.trim(); });
        // The crawl commits a fresh cache and announces it; re-read so PR rows
        // track the estate rather than the first read of the day.
        // The crawl hands its document along on the event; take it rather than
        // reading the file back (an older shell's detail-less event still reads).
        this._refreshed = (e) => {
          // The crawl that refreshed activity may also have rewritten the file
          // index (it is a leg of the same crawl and hands its write to
          // EstateSearch), so the next focus asks for it again.
          this._idxAsked = false;
          const doc = e?.detail?.cache;
          if (doc?.repos) { this.act_ = doc.repos; this._actLoaded = true; this.rev_++; return; }
          this._actLoaded = false; this.ensureActivity();
        };
        document.addEventListener('web-tools:activity-refreshed', this._refreshed);
      },
      destroy() {
        document.removeEventListener('web-tools:activity-refreshed', this._refreshed);
      },

      onFocus() { this.ensureActivity(); this.ensureIndex(); this.open = !!this.q.trim(); },
      // The fetch side-effects live here, not in the rows getter: a getter
      // runs on every render and must stay pure. Each is one-shot per key and
      // cheap to re-request.
      onInput() {
        this.ensureActivity();
        this.ensureIndex();
        const q = this.q.trim();
        const walk = this.parseWalk(q);
        if (walk?.repo) this.ensureTree(walk.repo);
        else if (!this.idx_ && !/^[#+@]/.test(q) && q.length >= 2) {
          const open = window.Alpine?.store?.('browser')?.repo;
          if (open) this.ensureTree(open);
        }
      },
      onEscape(e) {
        if (this.q) { this.q = ''; e.stopPropagation(); }
        else { this.open = false; this.$refs.box?.blur(); }
      },
      get activeKey() { return this.rows[this.active]?.key || ''; },
      indexOf(key) { return this.rows.findIndex(r => r.key === key); },
      move(d) {
        const n = this.rows.length;
        if (!n) return;
        this.active = ((this.active + d) % n + n) % n;
      },
      go() {
        const r = this.rows[this.active];
        if (r) this.act(r);
      },

      // One read of the registry's activity cache, the same file the estate's
      // Open list renders from. Token-gated; a signed-out viewer keeps the
      // repo/view lanes and simply has no PR rows to match.
      async ensureActivity() {
        const S = window.__shell;
        if (this._actLoaded || !S?.hasToken?.()) return;
        this._actLoaded = true;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: S.REGISTRY_REPO, ref: 'main' });
          const path = window.RepoActivityCache?.CACHE_PATH || 'state/activity.json';
          this.act_ = JSON.parse((await reg.get(path)).text).repos || {};
        } catch { this.act_ = {}; }
        this.rev_++;
      },

      // The registry's file index, once per page through the shared core
      // (EstateSearch.fileIndex), which also holds whatever this page's own
      // crawl last wrote. `false` is a registry with no index yet, which keeps
      // the tree-read fallback and its tap gate in play.
      async ensureIndex() {
        const S = window.__shell;
        if (this._idxAsked || !S?.hasToken?.() || !window.EstateSearch?.fileIndex) return;
        this._idxAsked = true;
        const doc = await window.EstateSearch.fileIndex({ registry: S.REGISTRY_REPO, token: window.TOKEN });
        this.idx_ = doc && window.FileIndex ? doc : false;
        this.rev_++;
      },

      // One recursive tree call per repo, from the shared cache
      // (EstateSearch.tree; the stage's Browse/Search economy). The result is
      // copied into local reactive state so the rows getter recomputes; a
      // FAILED fetch caches nothing here, so the lane recovers after the
      // core's brief backoff instead of staying dead until reload.
      async ensureTree(repo) {
        if (!repo || this.trees_[repo] || this._treeLoading[repo]) return;
        if (!window.__shell?.hasToken?.()) return;
        this._treeLoading[repo] = true;
        try { this.trees_[repo] = await window.EstateSearch.tree(repo, 'HEAD', window.TOKEN); }
        catch { /* the core remembers the failure briefly; retry is free */ }
        finally { this._treeLoading[repo] = false; this.rev_++; }
      },
      // The estate-wide pass, gated behind a tap (the "search every repo" row):
      // load whatever trees are still missing, then the file lane simply sees
      // more. The stage's loadAllTrees is this same move.
      async loadAllTrees() {
        const S = window.__shell;
        if (this.deepLoading || !S?.hasToken?.()) return;
        this.deepLoading = true;
        this.rev_++;
        try { await Promise.all((S.estateRepos || []).map(r => this.ensureTree(r.repo))); }
        finally { this.deepLoading = false; this.rev_++; }
      },
      get treesMissing() {
        return (window.__shell?.estateRepos || []).some(r => !this.trees_[r.repo]);
      },

      clipAround(text, q) { return window.EstateSearch?.clip?.(text, q) ?? String(text || ''); },

      // ── Session search: the shared core's grep, kept in-panel ────────────
      // The corpus is small and the reader (the Sessions pane's paged
      // conversation) is one event away, so this pass pays off without a
      // parameter surface. Contents search is the one that routed out.
      async searchSessions(q) {
        if (this.sess_?.loading) return;
        this.sess_ = { q, hits: [], loading: true, error: '' };
        this.rev_++;
        try {
          const S = window.__shell;
          // The index kit, loaded on the tap that asks for it. The lane reads
          // it through window, so without it the search silently narrows to
          // the session rows; the Search view says so in a line and this one
          // has nowhere to, which is why it loads rather than hoping.
          if (!window.SessionIndex) await window.gh?.load?.('kits/session-index.js');
          const { hits } = await window.EstateSearch.sessions(
            { q, registry: S.REGISTRY_REPO, token: window.TOKEN });
          this.sess_ = { q, hits, loading: false, error: '' };
        } catch (e) { this.sess_ = { q, hits: [], loading: false, error: String(e?.message || e) }; }
        this.rev_++;
      },

      get prRows() {
        const out = [];
        for (const [repo, e] of Object.entries(this.act_)) {
          for (const p of (e.openPRs || [])) {
            if (!p.head) continue;
            out.push({ repo, number: p.number, title: p.title || '', draft: !!p.draft,
                       head: p.head, state: 'open' });
          }
        }
        return out;
      },

      // Every PR the cache knows of, in any state: the open rows above plus
      // the crawl's any-state index (`branchPRs`), deduped by repo and number
      // with the open row winning, since it carries the session and the body.
      //
      // Why this exists beside prRows rather than replacing it: the two lanes
      // want different sets. Typing a NUMBER is a lookup, and #425 meaning
      // nothing because the PR merged last week is the finder failing at the
      // one thing a number can ask. Typing WORDS is discovery, competing for
      // three slots against file and session hits, and a hundred merged PRs
      // per repo would crowd it with history. So the number lane reads this
      // and the text lane keeps to what is open.
      get prAllRows() {
        const out = [...this.prRows];
        const seen = new Set(out.map(p => p.repo + '#' + p.number));
        for (const [repo, e] of Object.entries(this.act_)) {
          for (const p of (e.branchPRs || [])) {
            if (!p.head || seen.has(repo + '#' + p.number)) continue;
            out.push({ repo, number: p.number, title: p.title || '', draft: !!p.draft,
                       head: p.head, state: p.state || '' });
          }
        }
        return out;
      },

      // `@…` split into { repoFrag } (still choosing a repo) or { repo, path }
      // (inside one). The first slash is the boundary; repo is matched on the
      // estate short name, exactly, so the walk never guesses.
      parseWalk(q) {
        if (!q.startsWith('@')) return null;
        const rest = q.slice(1);
        const i = rest.indexOf('/');
        if (i < 0) return { repoFrag: rest };
        const frag = rest.slice(0, i).toLowerCase();
        const hit = (window.__shell?.estateRepos || []).find(r => short(r.repo).toLowerCase() === frag);
        return hit ? { repo: hit.repo, path: rest.slice(i + 1) } : { repoFrag: frag };
      },
      // The immediate children of `dir` in a flat path list: folders first.
      listDir(paths, dir) {
        const seen = new Map();
        const p = dir ? dir + '/' : '';
        for (const path of paths) {
          if (!path.startsWith(p)) continue;
          const rest = path.slice(p.length);
          const i = rest.indexOf('/');
          if (i < 0) seen.set(rest, false);
          else if (!seen.has(rest.slice(0, i))) seen.set(rest.slice(0, i), true);
        }
        return [...seen.entries()].map(([name, isDir]) => ({ name, isDir }))
          .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
      },

      // The dispatcher. Lanes are exclusive by query shape; the Jot fallback
      // rides every non-empty query. Each lane answers as SECTIONS, a heading
      // over its rows with the count of what it found; `rows` is their rows in
      // order, which is what the keyboard walks.
      get sections() {
        const S = window.__shell;
        const q = this.q.trim();
        if (!S || !q) return [];
        const openRepo = window.Alpine?.store?.('browser')?.repo || '';
        const key = [q, this.rev_, Object.keys(this.expanded_).join(','), openRepo,
                     (S.estateRepos || []).length, S.hasToken?.() ? 1 : 0].join('|');
        if (memo?.key === key) return memo.val;
        const val = this.compute(S, q, openRepo);
        memo = { key, val };
        return val;
      },
      get rows() { return this.sections.flatMap(s => s.rows); },

      compute(S, q, openRepo) {
        const ql = q.toLowerCase();
        const secs = [];
        // A section shows only when it has rows; `total` is what it found,
        // which can exceed what it shows.
        const sec = (id, title, rows, total = rows.length) => {
          if (rows.length) secs.push({ id, title, rows, total });
        };

        // A PR's state decides its mark and its sub, so a merged row is not
        // mistaken for live work at a glance. The row still opens the BRANCH,
        // which is why a merged PR is worth finding at all: its branch is
        // still there, and the takeover is where you read it.
        const PR_STATE = {
          merged: { icon: 'ph-git-merge', word: 'merged' },
          closed: { icon: 'ph-x-circle', word: 'closed' },
        };
        const prRow = (p) => {
          const st = PR_STATE[p.state] || { icon: 'ph-git-pull-request', word: p.draft ? 'draft' : 'ready' };
          return {
            key: 'p:' + p.repo + '#' + p.number, icon: st.icon,
            label: '#' + p.number + ' ' + (p.title || p.head),
            sub: short(p.repo) + ' · ' + st.word,
            kind: 'branch', repo: p.repo, name: p.head,
          };
        };
        // `tail` marks a label whose informative end is its END (a path), so
        // the template truncates it from the left and the filename survives a
        // phone's width.
        const fileRow = (repo, path, sub, label) => ({
          key: 'f:' + repo + ':' + path, icon: 'ph-file', mono: true, tail: !label,
          label: label || path, sub: sub ?? short(repo), kind: 'file', repo, path,
        });
        const repoWalkRow = (r) => ({
          key: 'wr:' + r.repo, icon: r.icon || 'ph-folder', mono: true,
          label: short(r.repo), sub: 'open ▸', kind: 'complete', to: '@' + short(r.repo) + '/',
        });
        // Open-repo hits first; within a rank, the caller's order stands.
        const homeFirst = (list, repoOf) =>
          [...list].sort((a, b) => (repoOf(a) === openRepo ? 0 : 1) - (repoOf(b) === openRepo ? 0 : 1));
        const jotRow = (text, label, sub) => ({ key: 'jot', icon: 'ph-note-pencil', label, sub, kind: 'jot', text });

        // ── +idea: an explicit jot, the one-row lane ──────────────────────
        if (q.startsWith('+')) {
          const text = q.slice(1).trim();
          if (text && S.hasToken?.()) sec('keep', 'Keep', [jotRow(text, 'Jot this: "' + text + '"', 'save to the pile')]);
          return secs;
        }

        // ── #123 / 123: a PR number, estate-wide ──────────────────────────
        const dm = q.match(/^#(\d*)$|^(\d+)$/);
        if (dm) {
          const digits = dm[1] ?? dm[2] ?? '';
          // `#` alone is a LIST and digits are a LOOKUP, which is why the two
          // read different sets. Bare `#` answers "what is in flight", where
          // every PR the estate ever had would bury the handful that are open;
          // a number is asking after one PR, and its state is the answer, not
          // the filter.
          const pool = digits ? this.prAllRows : this.prRows;
          const hits = pool.filter(p => String(p.number).startsWith(digits));
          sec('prs', digits ? 'Pull requests' : 'Open pull requests',
              homeFirst(hits, p => p.repo).slice(0, CAP).map(prRow), hits.length);
        } else if (q.startsWith('@')) {
          // ── @: repo-then-file navigation ──────────────────────────────
          const w = this.parseWalk(q);
          const out = [];
          if (w.repo == null) {
            // Still choosing the repository.
            const fl = (w.repoFrag || '').toLowerCase();
            const repos = (S.estateRepos || []).filter(r => short(r.repo).toLowerCase().includes(fl));
            sec('walk', 'Repos', repos.slice(0, CAP).map(repoWalkRow), repos.length);
            return secs;
          } else if (!this.trees_[w.repo]) {
            out.push({ key: 'load:' + w.repo, icon: 'ph-circle-notch', kind: 'noop', spin: true,
                       label: 'Loading ' + short(w.repo) + ' tree…' });
          } else {
            const { paths, truncated } = this.trees_[w.repo];
            const cut = w.path.lastIndexOf('/');
            const dir = cut < 0 ? '' : w.path.slice(0, cut);
            const rem = (cut < 0 ? w.path : w.path.slice(cut + 1)).toLowerCase();
            const base = '@' + short(w.repo) + '/' + (dir ? dir + '/' : '');
            for (const e of this.listDir(paths, dir).filter(e => e.name.toLowerCase().includes(rem)).slice(0, CAP)) {
              out.push(e.isDir
                ? { key: 'wd:' + w.repo + ':' + dir + '/' + e.name, icon: 'ph-folder', mono: true,
                    label: e.name + '/', sub: 'open ▸', kind: 'complete', to: base + e.name + '/' }
                : fileRow(w.repo, (dir ? dir + '/' : '') + e.name, '', e.name));
            }
            // The fuzzy layer: the whole tree, so a fragment lands without a
            // walk. Skipped for hits the listing already shows.
            if (rem.length >= 2) {
              const listed = new Set(out.map(r => r.path));
              const frag = w.path.toLowerCase();
              const fz = paths.filter(p => p.toLowerCase().includes(frag) && !listed.has(p));
              out.push(...fz.slice(0, CAP).map(p => fileRow(w.repo, p, '')));
            }
            if (truncated) out.push({ key: 'trunc', icon: 'ph-warning', kind: 'noop',
                                      label: 'Tree truncated by GitHub; deep paths may be missing' });
          }
          sec('walk', short(w.repo) + '/' + (w.path.lastIndexOf('/') > 0 ? w.path.slice(0, w.path.lastIndexOf('/')) : ''), out);
          return secs;
        } else if (/[@:]/.test(q)) {
          // ── A pasted address: resolve exactly, suggest nothing ──────────
          // Expand a short repo head ("home@x", "wt:lib/…") to owner/name when
          // exactly one estate repo matches; a full owner/repo passes through.
          const em = q.match(/^([\w.-]+)([@:].*)$/);
          let eq = q;
          if (em && !/^[\w.-]+\/[\w.-]+[@:]/.test(q)) {
            const m = (S.estateRepos || []).filter(r => short(r.repo).toLowerCase() === em[1].toLowerCase());
            if (m.length === 1) eq = m[0].repo + em[2];
          }
          const addr = window.RepoAddress?.parse(eq);
          if (addr) {
            sec('address', 'Address', [{ key: 'a:' + eq, icon: 'ph-file-code', mono: true, tail: true,
                       label: window.RepoAddress.fmt(addr), sub: 'open file',
                       kind: 'addr', addr }]);
          } else {
            const bm = eq.match(/^([\w.-]+\/[\w.-]+)@(.+)$/);
            if (bm) sec('address', 'Address', [{ key: 'b:' + bm[1] + '@' + bm[2], icon: 'ph-git-branch', mono: true,
                               label: short(bm[1]) + '@' + bm[2], sub: 'open branch',
                               kind: 'branch', repo: bm[1], name: bm[2] }]);
          }
          return secs;
        } else if (this.sess_ && this.sess_.q === q) {
          // ── Results mode: a ran session search for THIS query replaces the
          // lanes until the query changes or the clear row dismisses it.
          // Editing a character falls back; retyping the query returns the
          // cached hits, which is why the clear row exists.
          const slot = this.sess_;
          if (slot.loading) {
            sec('sessions', 'Sessions', [{ key: 'sess:load', icon: 'ph-circle-notch', kind: 'noop', spin: true,
                       label: 'Searching sessions…' }]);
          } else if (slot.error) {
            // The full error rides the fragment line, where there is room: a
            // truncated error is the one row that cannot be allowed to clip.
            sec('sessions', 'Sessions', [{ key: 'sess:err', icon: 'ph-warning', kind: 'clear',
                       label: 'Session search failed', sub: 'clear', note: slot.error }]);
          } else {
            sec('sessions', 'Sessions', [
              { key: 'sess:head', icon: 'ph-x-circle', kind: 'clear',
                label: slot.hits.length + ' session ' + (slot.hits.length === 1 ? 'hit' : 'hits'),
                sub: 'clear' },
              ...slot.hits.map(h => ({
                key: 's:' + h.id, icon: 'ph-chat-circle-text',
                label: h.ask ? String(h.ask).replace(/\s+/g, ' ').slice(0, 80) : h.id,
                sub: h.day, note: h.frag,
                kind: 'session', id: h.id, day: h.day, find: slot.q,
              })),
            ], slot.hits.length);
          }
        } else {
          // ── Plain text: where to go, file names, PR titles, deeper passes ─
          const pre = (s) => (s.toLowerCase().startsWith(ql) ? 0 : 1);
          const repos = (S.estateRepos || [])
            .filter(r => r.repo.toLowerCase().includes(ql))
            .sort((a, b) => pre(short(a.repo)) - pre(short(b.repo)));
          const views = [...(S.estateNav || []), ...(S.appNav || [])]
            .filter(v => (v.label || '').toLowerCase().includes(ql));
          sec('go', 'Go to', [
            ...repos.slice(0, 4).map(r => ({
              key: 'r:' + r.repo, icon: r.icon || 'ph-folder', mono: true,
              label: short(r.repo), sub: 'repo', kind: 'repo', repo: r.repo,
            })),
            ...views.slice(0, 4).map(v => ({
              key: 'v:' + (v.key || v.view) + ':' + v.label, icon: v.icon || 'ph-square',
              label: v.label, sub: 'view', kind: 'view', go: v.go,
            })),
          ]);

          const further = [];
          if (ql.length >= 2) {
            const members = new Set((S.estateRepos || []).map(r => r.repo));
            if (this.idx_ && window.FileIndex) {
              // Every estate repo at its default branch, from the registry's
              // index. Scoped to the sidebar's members, so a hidden repo stays
              // hidden here as it does everywhere else.
              const scoped = { repos: Object.fromEntries(Object.entries(this.idx_.repos || {})
                .filter(([r]) => !members.size || members.has(r))) };
              const res = window.FileIndex.search(scoped, q, { preferRepo: openRepo, cap: FILES_MORE });
              const shown = this.expanded_.files ? FILES_MORE : FILES_SHOWN;
              const rows = res.hits.slice(0, shown).map(h => fileRow(h.repo, h.path));
              // A folder stored as its count (file-index.js, FOLDER_CAP) answers
              // as itself: the files in it are not listed, the folder is.
              rows.push(...res.folders.slice(0, 3).map(f => ({
                key: 'fd:' + f.repo + ':' + f.path, icon: 'ph-folder', mono: true, tail: true,
                label: f.path + '/', sub: short(f.repo) + ' · ' + f.count.toLocaleString() + ' files',
                kind: 'folder', repo: f.repo, path: f.path,
              })));
              if (res.total > shown && !this.expanded_.files) {
                rows.push({ key: 'more:files', icon: 'ph-caret-down', kind: 'more', sec: 'files', dim: true,
                            label: (res.total - shown).toLocaleString() + ' more' });
              } else if (res.total > shown) {
                rows.push({ key: 'all:files', icon: 'ph-arrow-right', kind: 'search-names', dim: true,
                            label: 'All ' + res.total.toLocaleString() + ' in Search', sub: 'Search →' });
              }
              sec('files', 'Files', rows, res.total + res.folders.length);
            } else {
              // No index yet: the trees already cached, the open repo's first.
              const files = [];
              for (const [repo, t] of Object.entries(this.trees_)) {
                for (const p of t.paths) if (p.toLowerCase().includes(ql)) files.push({ repo, path: p });
              }
              const ranked = files.sort((a, b) =>
                   (a.repo === openRepo ? 0 : 1) - (b.repo === openRepo ? 0 : 1)
                || pre(a.path.split('/').pop()) - pre(b.path.split('/').pop()));
              sec('files', Object.keys(this.trees_).length === 1 && openRepo ? 'Files in ' + short(openRepo) : 'Files',
                  ranked.slice(0, CAP).map(f => fileRow(f.repo, f.path)), files.length);
              if (S.hasToken?.() && this.treesMissing) {
                further.push({ key: 'deep', icon: this.deepLoading ? 'ph-circle-notch' : 'ph-binoculars',
                               kind: this.deepLoading ? 'noop' : 'deep', spin: this.deepLoading,
                               label: this.deepLoading ? 'Loading estate trees…' : 'File names, every repo' });
              }
            }
          }

          const prs = this.prRows.filter(p => p.title.toLowerCase().includes(ql));
          sec('prs', 'Pull requests', homeFirst(prs, p => p.repo).slice(0, 3).map(prRow), prs.length);

          // The two deeper passes, each behind a tap: file CONTENTS through
          // the code-search API, and the captured SESSION records greped
          // client-side. Three characters before either offers, since a
          // shorter needle matches everything. NO gate repeats the query: it
          // is sitting in the input directly above, and on a phone the
          // repetition truncated every label to the same word (measured: four
          // rows all reading "Search…", indistinguishable). The label leads
          // with what is DIFFERENT about each pass.
          if (S.hasToken?.() && ql.length >= 3) {
            further.push({ key: 'code-gate', icon: 'ph-file-magnifying-glass', kind: 'code-gate',
                           label: 'File contents', sub: 'Search →' });
            further.push({ key: 'sess-gate', icon: 'ph-chat-circle-text', kind: 'sess-gate',
                           label: 'Sessions', sub: 'captured records' });
          }
          sec('further', 'Search further', further, 0);
        }

        // ── The floor: nothing typed here is lost ─────────────────────────
        // Plain text and #digits only: a walk in progress or a pasted address
        // is never an idea, so offering to jot it mid-walk is noise (both
        // returned above). Like the gates, it does not repeat the query.
        if (S.hasToken?.()) sec('keep', 'Keep', [jotRow(q, 'Jot this', 'to the pile')]);
        return secs;
      },

      act(r) {
        const S = window.__shell;
        if (r.kind === 'noop') return;
        // Completion rows rewrite the input and keep the walk going; every
        // other kind acts and clears.
        if (r.kind === 'complete') {
          this.q = r.to;
          this.active = 0;
          this.$refs.box?.focus();
          const w = this.parseWalk(r.to);
          if (w?.repo) this.ensureTree(w.repo);
          return;
        }
        if (r.kind === 'deep') { this.loadAllTrees(); this.$refs.box?.focus(); return; }
        if (r.kind === 'more') { this.expanded_ = { ...this.expanded_, [r.sec]: true }; this.$refs.box?.focus(); return; }
        if (r.kind === 'sess-gate') { this.searchSessions(this.q.trim()); this.$refs.box?.focus(); return; }
        if (r.kind === 'clear') { this.sess_ = null; this.rev_++; this.$refs.box?.focus(); return; }
        if (r.kind === 'code-gate' || r.kind === 'search-names') {
          const q = this.q.trim();
          this.q = ''; this.open = false;
          S?.goSearch?.({ q, mode: r.kind === 'code-gate' ? 'contents' : 'names' });
          return;
        }
        // A folder the index holds as a count: the Search view lists it, one
        // level, which is where a folder of thousands is readable at all.
        if (r.kind === 'folder') {
          this.q = ''; this.open = false;
          S?.goSearch?.({ q: '', mode: 'names', repo: r.repo, path: r.path });
          return;
        }
        this.q = '';
        this.open = false;
        if (r.kind === 'repo') S?.openPinned?.(r.repo);
        else if (r.kind === 'view') r.go?.();
        else if (r.kind === 'branch') {
          document.dispatchEvent(new CustomEvent('web-tools:open-branch-detail',
            { detail: { repo: r.repo, name: r.name } }));
        }
        else if (r.kind === 'session') {
          document.dispatchEvent(new CustomEvent('web-tools:open-session',
            { detail: { id: r.id, day: r.day, find: r.find || '' } }));
        }
        else if (r.kind === 'file') this.openAddr({ repo: r.repo, ref: '', path: r.path });
        else if (r.kind === 'addr') this.openAddr(r.addr);
        else if (r.kind === 'jot') this.jotThis(r.text);
      },

      // A file opens where the app reads files: browse the repo at the
      // address's ref (unspecified falls through to the default branch,
      // RepoAddress's rule) and open the path.
      async openAddr(addr) {
        const S = window.__shell;
        if (!S) return;
        await S.ensureBrowser?.(addr.repo, addr.ref || undefined);
        S.openFile?.(addr.path);
      },

      // Append to the pile. Reads the file fresh rather than trusting a copy,
      // since the Lists pane is a second writer; same shape and commit-message
      // idiom as the estate's addJot.
      async jotThis(text) {
        const S = window.__shell;
        if (!text || !S?.hasToken?.()) return;
        const toast = window.Alpine?.store?.('toast');
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: S.REGISTRY_REPO, ref: 'main' });
          if (typeof reg.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          let items = [];
          try {
            const raw = JSON.parse((await reg.get(JOTS_PATH)).text);
            items = Array.isArray(raw.items) ? raw.items : [];
          } catch {}
          items.push({ id: 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                       text, created_at: new Date().toISOString() });
          const clip = text.length > 40 ? text.slice(0, 40) + '…' : text;
          await reg.save(JOTS_PATH, { items }, 'Jot "' + clip + '" via Web Tools');
          toast?.('note-pencil', 'Jotted', 'alert-success', 2200);
        } catch (e) {
          toast?.('warning', 'Jot failed: ' + (e?.message || e), 'alert-error', 5600);
        }
      },
    };
  });
});
