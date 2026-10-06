document.addEventListener('alpine:init', function() {
  Alpine.data('waiting', function() {
    // The Waiting view: what waits on the owner, in one place (owner,
    // 2026-10-04: "is there somewhere in the app I can see them, and does it
    // include doc calls?"). Two queues, read by lib/kits/user-calls.js: the
    // open user calls, and the Text collection's proposals Dictate would stage
    // on each file as it stands.
    //
    // A LIST AND ITS DETAIL (owner, 2026-10-05: "more of a list detail
    // approach, so we can see through a little more without clicking"), on the
    // Installation view's pattern (installation-view.js): the list in a column
    // of its own, the selected item beside it, both read off the container
    // rather than the window, and below @3xl the list and the detail take
    // turns, with a back arrow. The detail is what was a click away: a call's
    // question, brief and recommendation, and each edit's reason above the
    // edit itself, drawn as md-diff's inline reading (the words that leave
    // struck, the words that arrive tinted); a file's staged proposals the
    // same way, with who proposed each and on what basis. The button to act
    // stays one tap away at the head of the detail.
    //
    // Calls are cheap (one listing and a read each) and come first; the
    // proposals need the collection's passages, so they arrive after, their
    // section saying so meanwhile. The nav entry is standing, with the count
    // of open calls as its badge (the shell's waitingCount).
    const U = () => window.UserCalls;

    return {
      description: 'Waiting view: the open user calls (decision, merge, documentation) from web-tools-private user-calls/, and the Text collection\'s proposed edits that Dictate would stage, by file, as a list with the selected item\'s edits drawn inline beside it.',

      calls: [],
      callsErr: '',
      loadingCalls: false,
      pending: null,
      pendingErr: '',
      loadingPending: false,
      showAnswered: false,
      sel: null,           // { kind: 'call' | 'file', key }
      wide: true,          // the container holds both columns (@3xl)

      template: `
        <div class="@container w-full flex flex-col gap-6" data-waiting>
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

          <div class="grid gap-6 @3xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] items-start">

            <!-- THE LIST: user calls, then the files with proposed edits by
                 repository. Hidden on a narrow pane while an item is open. -->
            <div class="flex flex-col gap-6 min-w-0" :class="sel ? 'hidden @3xl:flex' : 'flex'" data-waiting-list
                 @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)">
              <section class="flex flex-col gap-1" data-waiting-calls>
                <h3 class="flex items-baseline gap-2 px-2">
                  <span class="text-base font-semibold">User calls</span>
                  <span class="text-sm text-base-content/50 tabular-nums" x-text="openCalls.length"></span>
                </h3>
                <div x-show="loadingCalls && !calls.length" class="flex px-2 py-2"><span class="loading loading-dots loading-sm opacity-40"></span></div>
                <div x-show="callsErr" class="text-base text-error px-2" x-text="callsErr"></div>
                <div x-show="!loadingCalls && !callsErr && !openCalls.length" class="text-base text-base-content/50 px-2">None open.</div>
                <template x-for="c in openCalls" :key="c.id">
                  <button type="button" @click="pick('call', c.id)" data-waiting-call :data-kind="c.kind" :data-key="'call:' + c.id"
                          class="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-base-200"
                          :class="isSel('call', c.id) && 'bg-primary/10 hover:bg-primary/10'">
                    <i class="ph text-lg mt-0.5 text-primary shrink-0" :class="kindIcon(c)"></i>
                    <span class="min-w-0 flex flex-col">
                      <span class="text-base font-medium line-clamp-2" x-text="c.question"></span>
                      <span class="text-sm text-base-content/50" x-text="callLine(c)"></span>
                    </span>
                  </button>
                </template>
                <template x-if="answeredCalls.length">
                  <div class="flex flex-col">
                    <button type="button" @click="showAnswered = !showAnswered" data-waiting-answered-toggle
                            class="self-start flex items-center gap-1.5 px-2 py-1 text-sm text-base-content/50 hover:text-base-content/80">
                      <i class="ph" :class="showAnswered ? 'ph-caret-down' : 'ph-caret-right'"></i>
                      <span x-text="answeredCalls.length + ' answered'"></span></button>
                    <template x-if="showAnswered">
                      <div class="flex flex-col">
                        <template x-for="c in answeredCalls" :key="c.id">
                          <button type="button" @click="pick('call', c.id)" data-waiting-answered
                                  class="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-left text-base hover:bg-base-200"
                                  :class="isSel('call', c.id) && 'bg-primary/10 hover:bg-primary/10'">
                            <i class="ph text-base-content/40 shrink-0" :class="kindIcon(c)"></i>
                            <span class="min-w-0 flex-1 truncate" x-text="c.question"></span>
                            <span class="text-sm text-base-content/60 shrink-0" x-text="lastAnswer(c)"></span>
                          </button>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>
              </section>

              <section class="flex flex-col gap-1" data-waiting-proposed>
                <h3 class="flex items-baseline gap-2 px-2">
                  <span class="text-base font-semibold">Proposed edits</span>
                  <span x-show="pending" class="text-sm text-base-content/50 tabular-nums" x-text="proposedLine"></span>
                </h3>
                <div x-show="loadingPending" class="flex items-center gap-2 px-2 text-sm text-base-content/50">
                  <span class="loading loading-dots loading-sm opacity-40"></span><span>Reading the Text collection</span></div>
                <div x-show="pendingErr" class="text-base text-error px-2" x-text="pendingErr"></div>
                <div x-show="pending && !groups.length" class="text-base text-base-content/50 px-2">None pending.</div>
                <template x-for="g in groups" :key="g.repo">
                  <div class="flex flex-col" data-waiting-repo :data-repo="g.repo">
                    <div class="flex items-baseline gap-2 px-2 pt-2 pb-1">
                      <span class="text-sm font-semibold text-base-content/70" x-text="g.repo.split('/')[1]"></span>
                      <span class="text-sm text-base-content/40 tabular-nums" x-text="g.staged + ' in ' + g.files.length + (g.files.length === 1 ? ' file' : ' files')"></span>
                    </div>
                    <template x-for="f in g.files" :key="f.file">
                      <button type="button" @click="pick('file', f.file)" data-waiting-file :data-file="f.file" :data-key="'file:' + f.file"
                              class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-base-200"
                              :class="isSel('file', f.file) && 'bg-primary/10 hover:bg-primary/10'">
                        <span class="font-mono text-sm min-w-0 truncate" x-text="f.path"></span>
                        <span class="ml-auto badge badge-sm badge-ghost tabular-nums shrink-0" x-text="f.staged"></span>
                      </button>
                    </template>
                  </div>
                </template>
              </section>
            </div>

            <!-- THE DETAIL: the selected call or file, its edits drawn inline.
                 Sticky on a wide pane, so it stays in view while the list
                 scrolls; its own screen on a narrow one. -->
            <div class="min-w-0 @3xl:sticky @3xl:top-2 @3xl:max-h-[calc(100dvh-7rem)] @3xl:overflow-y-auto"
                 :class="sel ? 'block' : 'hidden @3xl:block'" data-waiting-detail>
              <template x-if="!current">
                <div class="text-base text-base-content/40 py-8">Nothing selected.</div>
              </template>

              <template x-if="current && current.kind === 'call'">
                <article class="flex flex-col gap-4" data-waiting-detail-call :data-id="current.c.id">
                  <div class="flex items-start gap-2">
                    <button type="button" @click="back()" class="btn btn-ghost btn-sm btn-square @3xl:hidden" aria-label="Back to the list">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <i class="ph text-xl mt-1 text-primary shrink-0" :class="kindIcon(current.c)"></i>
                    <h3 class="min-w-0 grow text-lg font-semibold text-balance" x-text="current.c.question"></h3>
                    <a :href="href(current.c)" target="_blank" rel="noopener" class="btn btn-sm btn-primary shrink-0 gap-1.5" data-waiting-open>
                      <i class="ph" :class="current.c.kind === 'documentation' ? 'ph-pencil-line' : 'ph-scales'"></i>
                      <span x-text="current.c.kind === 'documentation' ? 'Review' : 'Answer'"></span></a>
                  </div>
                  <p x-show="current.c.brief" class="text-base text-base-content/80 text-pretty" x-text="current.c.brief"></p>
                  <div x-show="current.c.recommend" class="text-base text-pretty" data-waiting-recommend>
                    <span class="font-medium">Recommended:</span>
                    <span x-text="current.c.recommend"></span><span x-show="current.c.why" class="text-base-content/60" x-text="', since ' + current.c.why"></span>
                  </div>
                  <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                    <span x-text="kindLabel(current.c)"></span>
                    <a x-show="current.c.file" :href="fileGh(current.c)" target="_blank" rel="noopener" class="font-mono hover:text-primary break-all" x-text="shortFile(current.c)"></a>
                    <a x-show="current.c.session" :href="sessionHref(current.c)" target="_blank" rel="noopener" class="hover:text-primary" x-text="'session ' + current.c.session"></a>
                    <span x-show="current.c.created" x-text="ago(current.c.created)"></span>
                    <a x-show="current.c.pr" :href="prUrl(current.c.pr)" target="_blank" rel="noopener" class="hover:text-primary" x-text="current.c.pr"></a>
                  </div>
                  <template x-if="(current.c.answers || []).length">
                    <div class="text-base rounded-lg bg-base-200/60 px-3 py-2" data-waiting-answer>
                      <span class="font-medium">Answered:</span> <span x-text="lastAnswer(current.c)"></span>
                      <span class="text-sm text-base-content/50" x-text="answerBy(current.c)"></span>
                      <p x-show="lastNote(current.c)" class="text-base-content/70 mt-1" x-text="lastNote(current.c)"></p>
                    </div>
                  </template>
                  <ol class="flex flex-col gap-5" data-waiting-edits>
                    <template x-for="(e, i) in (current.c.edits || [])" :key="current.c.id + ':' + i">
                      <li class="flex flex-col gap-1.5" data-waiting-edit>
                        <div class="flex items-baseline gap-2">
                          <span class="badge badge-sm tabular-nums shrink-0" x-text="i + 1"></span>
                          <span x-show="decisionOf(current.c, i)" class="badge badge-sm shrink-0" :class="decisionTone(decisionOf(current.c, i))" x-text="decisionOf(current.c, i)"></span>
                          <span class="text-base text-base-content/80 text-pretty" x-text="e.why || ''"></span>
                        </div>
                        <div class="rounded-lg border border-base-300 px-3 py-2" x-init="mountDiff($el, e.from, e.to)" data-waiting-diff></div>
                      </li>
                    </template>
                  </ol>
                </article>
              </template>

              <template x-if="current && current.kind === 'file'">
                <article class="flex flex-col gap-4" data-waiting-detail-file :data-file="current.f.file">
                  <div class="flex items-start gap-2">
                    <button type="button" @click="back()" class="btn btn-ghost btn-sm btn-square @3xl:hidden" aria-label="Back to the list">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <div class="min-w-0 grow flex flex-col">
                      <h3 class="text-lg font-semibold font-mono break-all" x-text="current.f.path"></h3>
                      <span class="text-sm text-base-content/50" x-text="current.f.repo + ' · ' + current.f.staged + (current.f.staged === 1 ? ' proposal' : ' proposals') + ' Dictate would stage'"></span>
                    </div>
                    <a :href="'https://github.com/' + current.f.repo + '/blob/main/' + current.f.path" target="_blank" rel="noopener"
                       class="btn btn-ghost btn-sm btn-square text-base-content/50 shrink-0" aria-label="On GitHub"><i class="ph ph-github-logo text-lg"></i></a>
                    <a :href="dictate(current.f)" target="_blank" rel="noopener" class="btn btn-sm btn-primary shrink-0 gap-1.5" data-waiting-review>
                      <i class="ph ph-pencil-line"></i><span>Review</span></a>
                  </div>
                  <ol class="flex flex-col gap-5" data-waiting-items>
                    <template x-for="(it, i) in current.f.items" :key="current.f.file + ':' + i">
                      <li class="flex flex-col gap-1.5" data-waiting-item>
                        <div class="flex items-baseline gap-2 flex-wrap text-sm text-base-content/50">
                          <span class="badge badge-sm tabular-nums shrink-0" x-text="i + 1"></span>
                          <span x-text="[it.author, it.purpose].filter(Boolean).join(' · ')"></span>
                          <a x-show="it.basis" :href="it.basis" target="_blank" rel="noopener" class="hover:text-primary" x-text="basisLabel(it.basis)"></a>
                        </div>
                        <div class="rounded-lg border border-base-300 px-3 py-2" x-init="mountDiff($el, it.from, it.to)" data-waiting-diff></div>
                      </li>
                    </template>
                  </ol>
                </article>
              </template>
            </div>
          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        // Wide enough for both columns: the grid's own breakpoint, 48rem.
        const measure = () => { this.wide = (this.$el.clientWidth || 0) >= 768; };
        measure();
        try { new ResizeObserver(measure).observe(this.$el); } catch {}
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
        this.autoPick();
        this.loadingPending = true; this.pendingErr = '';
        try { this.pending = await U().pendingEdits({ fresh }); }
        catch (e) { this.pendingErr = 'Proposed edits could not be read: ' + (e?.message || e); }
        finally { this.loadingPending = false; }
        this.autoPick();
      },
      // On a wide pane the detail is never blank while there is something to
      // show: the first open call, else the file with most waiting. On a
      // narrow one the list comes first, so nothing is chosen for the reader.
      autoPick() {
        if (this.current || !this.wide) return;
        if (this.openCalls.length) this.sel = { kind: 'call', key: this.openCalls[0].id };
        else if (this.groups.length) this.sel = { kind: 'file', key: this.groups[0].files[0].file };
      },
      // On a narrow pane the detail replaces the list, so it opens at the
      // top and the back arrow returns the list to where it was.
      pane() { return this.$el.closest('[data-pane]'); },
      pick(kind, key) {
        const p = this.pane();
        if (!this.wide && p) { this._listTop = p.scrollTop; this.$nextTick(() => { p.scrollTop = 0; }); }
        this.sel = { kind, key };
      },
      back() {
        const p = this.pane(), top = this._listTop || 0;
        this.sel = null;
        if (p) this.$nextTick(() => { p.scrollTop = top; });
      },
      // Up and down step through the list in its order, calls then files, and
      // the focus follows, so a keyboard reads the whole queue in the detail.
      get flat() {
        return [...this.openCalls.map((c) => ({ kind: 'call', key: c.id })),
                ...this.groups.flatMap((g) => g.files.map((f) => ({ kind: 'file', key: f.file })))];
      },
      step(d) {
        const all = this.flat;
        if (!all.length) return;
        const i = this.sel ? all.findIndex((x) => x.kind === this.sel.kind && x.key === this.sel.key) : -1;
        const next = all[Math.min(all.length - 1, Math.max(0, i + d))];
        this.sel = next;
        this.$nextTick(() => this.$el.querySelector('[data-key="' + CSS.escape(next.kind + ':' + next.key) + '"]')?.focus({ preventScroll: false }));
      },
      isSel(kind, key) { return !!this.sel && this.sel.kind === kind && this.sel.key === key; },
      get current() {
        if (!this.sel) return null;
        if (this.sel.kind === 'call') { const c = this.calls.find((x) => x.id === this.sel.key); return c ? { kind: 'call', c } : null; }
        const f = this.files.find((x) => x.file === this.sel.key);
        return f ? { kind: 'file', f } : null;
      },
      // One edit as md-diff draws a change's `both` stop, mounted when its row
      // is: the words that leave struck, the words that arrive tinted.
      async mountDiff(host, from, to) {
        try {
          if (!window.mdDiff) await window.gh?.load?.('kits/md-diff.js');
          const box = await window.mdDiff.inline(from, to);
          if (host.isConnected || host.parentNode) host.replaceChildren(box);
        } catch (e) {
          host.textContent = String(to || '');
        }
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
      fileGh(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? '#' : 'https://github.com/' + f.slice(0, i) + '/blob/main/' + f.slice(i + 1); },
      kindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      kindLabel(c) { return { documentation: 'Documentation', merge: 'Merge' }[c.kind] || 'Decision'; },
      // The list row's second line: the kind, what it holds, and its age.
      callLine(c) {
        const n = (c.edits || []).length;
        return [this.kindLabel(c), c.kind === 'documentation' && n ? n + (n === 1 ? ' edit' : ' edits') : '', this.ago(c.created)]
          .filter(Boolean).join(' · ');
      },
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
      lastOf(c) { const as = c.answers || []; return as[as.length - 1] || null; },
      lastAnswer(c) { const a = this.lastOf(c); return a ? a.answer : (c.status === 'closed' ? 'closed' : ''); },
      lastNote(c) { return this.lastOf(c)?.note || ''; },
      answerBy(c) { const a = this.lastOf(c); return a ? [a.by, this.ago(a.at)].filter(Boolean).join(' · ') : ''; },
      // A documentation answer's decision on edit i, as Dictate recorded it.
      decisionOf(c, i) { return (this.lastOf(c)?.decisions || []).find((d) => d.edit === i + 1)?.decision || ''; },
      decisionTone(d) { return { confirmed: 'badge-success', amended: 'badge-info', discarded: 'badge-error badge-outline' }[d] || 'badge-ghost'; },
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
