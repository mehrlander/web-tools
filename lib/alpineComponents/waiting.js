document.addEventListener('alpine:init', function() {
  Alpine.data('waiting', function() {
    // The Waiting view: what waits on the owner, in one place (owner,
    // 2026-10-04: "is there somewhere in the app I can see them, and does it
    // include doc calls?"). Two queues, read by lib/kits/user-calls.js:
    //
    //   User calls, open ones first: each with its question and brief, and a
    //   documentation call's edits listed by their reasons, so what is being
    //   asked can be read before anything is opened. Its button goes where the
    //   call is answered: Dictate for a documentation call, the call page for
    //   the rest. Answered calls fold under the open ones.
    //
    //   Proposed edits: the Text collection's proposals that Dictate would
    //   stage on each file as it stands, grouped by repository, each file a
    //   row with its count, the change that proposed it, and Dictate's
    //   &proposed one tap away.
    //
    // Calls are cheap (one listing and a read each) and come first; the
    // proposals need the collection's passages, so they arrive after, with
    // their section saying so meanwhile. The nav entry is standing, with the
    // count of open calls as its badge (the shell's waitingCount).
    const U = () => window.UserCalls;

    return {
      description: 'Waiting view: the open user calls (decision, merge, documentation) from web-tools-private user-calls/, and the Text collection\'s proposed edits that Dictate would stage, by file. Opens each where it is answered.',

      calls: [],
      callsErr: '',
      loadingCalls: false,
      pending: null,
      pendingErr: '',
      loadingPending: false,
      showAnswered: false,

      template: `
        <div class="w-full flex flex-col gap-8" data-waiting>
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="text-lg font-semibold">Waiting</h2>
            <span class="text-sm text-base-content/60 tabular-nums" data-waiting-summary x-text="summary"></span>
            <div class="ml-auto flex items-center gap-1">
              <a :href="'https://github.com/' + store + '/tree/main/user-calls'" target="_blank" rel="noopener"
                 class="btn btn-ghost btn-sm btn-square text-base-content/50" data-title-tip="user-calls/ on GitHub" aria-label="user-calls/ on GitHub">
                <i class="ph ph-github-logo text-lg"></i></a>
              <button type="button" class="btn btn-ghost btn-sm gap-1.5" @click="load(true)" :disabled="!!(loadingCalls || loadingPending)" aria-label="Refresh">
                <i class="ph ph-arrows-clockwise"></i><span class="hidden sm:inline">Refresh</span></button>
            </div>
          </div>

          <section class="flex flex-col gap-3" data-waiting-calls>
            <h3 class="flex items-baseline gap-2">
              <span class="text-base font-semibold">User calls</span>
              <span class="text-sm text-base-content/50 tabular-nums" x-text="openCalls.length"></span>
            </h3>
            <div x-show="loadingCalls && !calls.length" class="flex py-4"><span class="loading loading-dots loading-sm opacity-40"></span></div>
            <div x-show="callsErr" class="text-base text-error" x-text="callsErr"></div>
            <div x-show="!loadingCalls && !callsErr && !openCalls.length" class="text-base text-base-content/50">None open.</div>
            <template x-for="c in openCalls" :key="c.id">
              <article class="rounded-box border border-base-300 bg-base-100 p-3 sm:p-4 flex flex-col gap-2" data-waiting-call :data-kind="c.kind">
                <div class="flex items-start gap-3">
                  <i class="ph text-xl mt-0.5 text-primary shrink-0" :class="kindIcon(c)"></i>
                  <div class="min-w-0 flex-1 flex flex-col gap-1">
                    <div class="text-base font-medium text-balance" x-text="c.question"></div>
                    <p x-show="c.brief" class="text-base text-base-content/70 text-pretty" x-text="c.brief"></p>
                  </div>
                  <a :href="href(c)" target="_blank" rel="noopener" class="hidden sm:inline-flex btn btn-sm btn-primary shrink-0 gap-1.5" data-waiting-open>
                    <i class="ph" :class="c.kind === 'documentation' ? 'ph-pencil-line' : 'ph-scales'"></i>
                    <span x-text="c.kind === 'documentation' ? 'Review' : 'Answer'"></span></a>
                </div>
                <template x-if="c.kind === 'documentation' && (c.edits || []).length">
                  <ol class="flex flex-col gap-1 pl-9" data-waiting-edits>
                    <template x-for="(e, i) in c.edits" :key="i">
                      <li class="flex gap-2 text-base text-base-content/80">
                        <span class="text-sm tabular-nums text-base-content/40 w-4 shrink-0 pt-0.5 text-right" x-text="i + 1"></span>
                        <span class="min-w-0 text-pretty" x-text="e.why || excerpt(e.from)"></span>
                      </li>
                    </template>
                  </ol>
                </template>
                <div class="pl-9 flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                  <span x-text="kindLabel(c)"></span>
                  <span x-show="c.file" class="font-mono break-all" :data-title-tip="fileOf(c)" x-text="shortFile(c)"></span>
                  <a x-show="c.session" :href="sessionHref(c)" target="_blank" rel="noopener" class="hover:text-primary"
                     x-text="'session ' + c.session"></a>
                  <span x-show="c.created" x-text="ago(c.created)"></span>
                  <a x-show="c.pr" :href="prUrl(c.pr)" target="_blank" rel="noopener" class="hover:text-primary" x-text="c.pr"></a>
                  <!-- On a phone the button closes the card, so the brief and
                       the edits keep the card's width. -->
                  <a :href="href(c)" target="_blank" rel="noopener" class="sm:hidden ml-auto btn btn-sm btn-primary gap-1.5" data-waiting-open-narrow>
                    <i class="ph" :class="c.kind === 'documentation' ? 'ph-pencil-line' : 'ph-scales'"></i>
                    <span x-text="c.kind === 'documentation' ? 'Review' : 'Answer'"></span></a>
                </div>
              </article>
            </template>
            <template x-if="answeredCalls.length">
              <div class="flex flex-col gap-1">
                <button type="button" @click="showAnswered = !showAnswered" data-waiting-answered-toggle
                        class="self-start flex items-center gap-1.5 text-sm text-base-content/50 hover:text-base-content/80">
                  <i class="ph" :class="showAnswered ? 'ph-caret-down' : 'ph-caret-right'"></i>
                  <span x-text="answeredCalls.length + ' answered'"></span></button>
                <template x-if="showAnswered">
                  <div class="flex flex-col">
                    <template x-for="c in answeredCalls" :key="c.id">
                      <div class="flex items-baseline gap-3 py-1.5 border-b border-base-200 text-base" data-waiting-answered>
                        <i class="ph text-base-content/40 shrink-0" :class="kindIcon(c)"></i>
                        <span class="min-w-0 flex-1 truncate" x-text="c.question"></span>
                        <span class="text-sm text-base-content/60 shrink-0" x-text="lastAnswer(c)"></span>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </template>
          </section>

          <section class="flex flex-col gap-3" data-waiting-proposed>
            <h3 class="flex items-baseline gap-2">
              <span class="text-base font-semibold">Proposed edits</span>
              <span x-show="pending" class="text-sm text-base-content/50 tabular-nums" x-text="proposedLine"></span>
            </h3>
            <div x-show="loadingPending" class="flex items-center gap-2 text-sm text-base-content/50">
              <span class="loading loading-dots loading-sm opacity-40"></span><span>Reading the Text collection</span></div>
            <div x-show="pendingErr" class="text-base text-error" x-text="pendingErr"></div>
            <div x-show="pending && !groups.length" class="text-base text-base-content/50">None pending.</div>
            <template x-for="g in groups" :key="g.repo">
              <div class="flex flex-col" data-waiting-repo :data-repo="g.repo">
                <div class="flex items-baseline gap-2 pb-1 border-b border-base-300">
                  <span class="text-sm font-semibold text-base-content/70" x-text="g.repo.split('/')[1]"></span>
                  <span class="text-sm text-base-content/40 tabular-nums" x-text="g.staged + ' in ' + g.files.length + (g.files.length === 1 ? ' file' : ' files')"></span>
                </div>
                <template x-for="f in g.files" :key="f.file">
                  <div class="flex items-center gap-3 py-1.5 border-b border-base-200" data-waiting-file :data-file="f.file">
                    <a :href="dictate(f)" target="_blank" rel="noopener"
                       class="font-mono text-sm min-w-0 break-all hover:text-primary" x-text="f.path"></a>
                    <span class="badge badge-sm badge-ghost tabular-nums shrink-0" x-text="f.staged"></span>
                    <div class="grow"></div>
                    <template x-for="b in f.bases" :key="b">
                      <a :href="b" target="_blank" rel="noopener" class="hidden sm:inline text-sm text-base-content/50 hover:text-primary truncate"
                         x-text="basisLabel(b)"></a>
                    </template>
                    <a :href="'https://github.com/' + f.repo + '/blob/main/' + f.path" target="_blank" rel="noopener"
                       class="text-base-content/30 hover:text-primary shrink-0" aria-label="On GitHub"><i class="ph ph-github-logo"></i></a>
                    <a :href="dictate(f)" target="_blank" rel="noopener" class="btn btn-xs shrink-0" data-waiting-review>Review</a>
                  </div>
                </template>
              </div>
            </template>
          </section>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.load();
      },

      get store() { return U()?.STORE || 'mehrlander/web-tools-private'; },

      async load(fresh = false) {
        if (!window.UserCalls) await window.gh?.load?.('kits/user-calls.js');
        if (!U()) { this.callsErr = 'The user-calls kit did not load.'; return; }
        this.loadingCalls = true; this.callsErr = '';
        try { this.calls = await U().list({ fresh }); }
        catch (e) { this.callsErr = 'User calls could not be read: ' + (e?.message || e); }
        finally { this.loadingCalls = false; }
        window.__shell && (window.__shell.waitingCount = this.openCalls.length);
        this.loadingPending = true; this.pendingErr = '';
        try { this.pending = await U().pendingEdits({ fresh }); }
        catch (e) { this.pendingErr = 'Proposed edits could not be read: ' + (e?.message || e); }
        finally { this.loadingPending = false; }
      },

      get openCalls() { return this.calls.filter((c) => c.open); },
      get answeredCalls() { return this.calls.filter((c) => !c.open).slice(0, 8); },
      get files() {
        return [...(this.pending?.values() || [])].filter((f) => f.staged)
          .map((f) => { const i = f.file.indexOf(':'); return { ...f, repo: f.file.slice(0, i), path: f.file.slice(i + 1) }; });
      },
      // By repository, the repository with most waiting first, and within it
      // the file with most.
      get groups() {
        const by = new Map();
        for (const f of this.files) {
          if (!by.has(f.repo)) by.set(f.repo, { repo: f.repo, staged: 0, files: [] });
          const g = by.get(f.repo); g.staged += f.staged; g.files.push(f);
        }
        for (const g of by.values()) g.files.sort((a, b) => b.staged - a.staged || a.path.localeCompare(b.path));
        return [...by.values()].sort((a, b) => b.staged - a.staged || a.repo.localeCompare(b.repo));
      },
      get proposedLine() {
        const n = this.files.reduce((t, f) => t + f.staged, 0);
        return n + ' in ' + this.files.length + (this.files.length === 1 ? ' file' : ' files');
      },
      get summary() {
        const parts = [];
        const n = this.openCalls.length;
        parts.push(n + (n === 1 ? ' user call' : ' user calls'));
        if (this.pending) {
          const e = this.files.reduce((t, f) => t + f.staged, 0);
          parts.push(e + (e === 1 ? ' proposed edit' : ' proposed edits'));
        }
        return parts.join(' · ');
      },

      href(c) { return U()?.href(c) || '#'; },
      sessionHref(c) { return U()?.sessionHref(c) || ''; },
      dictate(f) { return U()?.dictateHref({ file: f.file, proposed: true }) || '#'; },
      fileOf(c) { return U()?.fileKey(c.file) || c.file; },
      // owner/repo:path, said as the repo's name and the path.
      shortFile(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? f : f.slice(0, i).split('/').pop() + '/' + f.slice(i + 1); },
      kindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      kindLabel(c) { return { documentation: 'Documentation', merge: 'Merge' }[c.kind] || 'Decision'; },
      prUrl(pr) {
        const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(String(pr || ''));
        return m ? 'https://github.com/' + m[1] + '/pull/' + m[2] : '#';
      },
      // What proposed an edit, said short: a pull request as repo#n, a run by
      // its folder, anything else by its last path segment.
      basisLabel(b) {
        const s = String(b || '');
        const pr = /github\.com\/[\w.-]+\/([\w.-]+)\/pull\/(\d+)/.exec(s);
        if (pr) return pr[1] + '#' + pr[2];
        const run = /\/runs\/([^/]+)\//.exec(s);
        if (run) return run[1];
        return s.replace(/\/+$/, '').split('/').pop() || s;
      },
      excerpt(t) { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 90 ? s.slice(0, 89) + '…' : s; },
      lastAnswer(c) { const as = c.answers || [], a = as[as.length - 1]; return a ? a.answer : (c.status === 'closed' ? 'closed' : ''); },
      ago(at) {
        const t = Date.parse(at); if (!Number.isFinite(t)) return '';
        const m = Math.round((Date.now() - t) / 60000);
        if (m < 60) return Math.max(1, m) + 'm ago';
        const h = Math.round(m / 60); if (h < 48) return h + 'h ago';
        return Math.round(h / 24) + 'd ago';
      },
    };
  });
});
