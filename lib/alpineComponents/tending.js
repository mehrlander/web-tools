document.addEventListener('alpine:init', function() {
  Alpine.data('tending', function() {
    // The Tending view: findings from the notes store,
    // folded by kits/findings.js.
    const REGISTRY = () => window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private';

    return {
      description: 'Tending view: findings from tending passes (work that never reached the owner, questions only the owner can answer, overlapping efforts, and what was settled), each linked to its subjects, with owner actions written back as notes.',

      notes: [],
      loading: false,
      err: '',
      open: {},          // finding id -> details open
      draft: {},         // finding id -> text in its reply box
      busy: '',          // finding id being written

      template: `
        <div class="w-full">
          <div class="flex items-center gap-2 mb-3 flex-wrap">
            <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit" role="tablist" data-slot="frame:tabs">
              <button role="tab" @click="setTab('attention')"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'attention' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-plant text-lg"></i>Open<span class="font-mono text-sm opacity-60" x-text="attention.length"></span></button>
              <button role="tab" @click="setTab('settled')"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'settled' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-check-circle text-lg"></i>Settled<span class="font-mono text-sm opacity-60" x-text="settled.length"></span></button>
            </div>
            <template x-if="repoFilter">
              <button @click="clearRepo()" class="badge badge-ghost gap-1 font-mono"
                      :data-title-tip="'Showing findings that touch ' + repoFilter + '; tap to show all'">
                <span x-text="repoFilter.split('/')[1]"></span><i class="ph ph-x"></i></button>
            </template>
            <div class="grow"></div>
            <button class="btn btn-ghost btn-sm btn-square" @click="load()" :disabled="loading"
                    data-title-tip="Reload findings">
              <i class="ph ph-arrows-clockwise text-lg" :class="loading && 'animate-spin'"></i></button>
          </div>

          <p x-show="!hasToken()" class="text-base text-base-content/60">Set a token (Repos, top right) to read findings.</p>
          <p x-show="err" class="text-base text-error font-mono" x-text="err"></p>
          <div x-show="loading && !notes.length" class="flex justify-center py-12"><span class="loading loading-spinner"></span></div>
          <p x-show="!loading && hasToken() && !shown.length && !err" class="text-base text-base-content/50 py-8 text-center"
             x-text="tab === 'attention' ? 'Nothing open.' : 'Nothing settled yet.'"></p>

          <!-- data-pattern and data-part declare this a List and name its
               parts (data/ui-units/codebook.md, "Declaring a pattern in
               markup"); nothing at runtime reads them. -->
          <div data-pattern="list" data-part="list">
            <template x-for="f in shown" :key="f.id">
              <article class="py-4 border-t border-base-300/70 first-of-type:border-t-0 first-of-type:pt-1" :id="'finding-' + f.id" :class="focus === f.id && 'bg-primary/5 -mx-2 px-2 rounded-lg'" data-part="item">
                <!-- The list reads as a list: kind, title, the next step and the
                     subjects. A decision is a user call among the subjects, read
                     and answered in Waiting. A tap opens why it matters, the
                     evidence and the history. -->
                <button @click="toggle(f)" class="w-full text-left" :aria-expanded="!!open[f.id]">
                  <div class="flex items-center gap-1.5 text-sm text-base-content/55 mb-1" data-part="meta">
                    <i class="ph text-base" :class="kindOf(f.kind).icon"></i>
                    <span x-text="kindOf(f.kind).label"></span>
                    <template x-if="f.status === 'resolved'"><span class="text-base-content/40">· handled</span></template>
                    <div class="grow"></div>
                    <span class="font-mono text-base-content/40" :data-title-tip="'Found ' + f.at.slice(0, 10) + ' by ' + f.author + (f.assessedAt !== f.at ? '; last assessed ' + f.assessedAt.slice(0, 10) : '')"
                          x-text="ago(f.assessedAt)"></span>
                    <i class="ph text-base text-base-content/40" :class="open[f.id] ? 'ph-caret-up' : 'ph-caret-down'"></i>
                  </div>
                  <h3 class="text-base font-semibold leading-snug" x-text="f.title" data-part="title"></h3>
                </button>

                <!-- The outstanding step stays on the row until someone does it:
                     the assessment being finished is not the work being done. -->
                <template x-if="f.next && f.open">
                  <p class="mt-2 text-base" :class="!open[f.id] && 'line-clamp-2'" data-part="body">
                    <span class="text-sm font-medium text-base-content/55 mr-1.5">Next</span><span x-text="f.next"></span></p>
                </template>
                <template x-if="!f.open">
                  <p class="mt-1.5 flex items-start gap-1.5 text-sm text-base-content/55" data-part="meta">
                    <i class="ph mt-0.5" :class="f.status === 'resolved' ? 'ph-user-check' : 'ph-check'"></i>
                    <span x-text="closedLine(f)"></span></p>
                </template>

                <div class="mt-2.5 flex flex-wrap gap-1.5" data-part="links">
                  <template x-for="s in f.subjects" :key="s">
                    <a :href="subjectHref(s)" :target="subjectHref(s).startsWith('http') ? '_blank' : null"
                       class="flex items-center gap-1 rounded-md bg-base-200/70 px-2 py-0.5 text-sm font-mono text-base-content/70 hover:text-primary max-w-full"
                       :data-title-tip="s">
                      <i class="ph shrink-0" :class="subjectIcon(s)"></i><span class="truncate" x-text="subjectLabel(s)"></span></a>
                  </template>
                </div>

                <template x-if="open[f.id]">
                  <div class="mt-3 space-y-2" data-part="body">
                    <p class="text-base text-base-content/80" x-text="f.why"></p>
                    <template x-if="f.next && !f.open">
                      <p class="text-base text-base-content/60"><span class="text-sm font-medium mr-1.5">Was next</span><span x-text="f.next"></span></p>
                    </template>
                  </div>
                </template>

                <template x-if="open[f.id]">
                  <div class="mt-2 space-y-3">
                    <template x-if="f.evidence.length">
                      <ul class="space-y-1 text-base text-base-content/75 list-disc pl-5" data-part="body">
                        <template x-for="e in f.evidence" :key="e"><li x-text="e"></li></template>
                      </ul>
                    </template>
                    <div data-part="body">
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
                      <div class="flex flex-wrap gap-2" data-part="actions">
                        <template x-if="f.open">
                          <button class="btn btn-sm btn-primary gap-1.5" @click="resolve(f)" :disabled="busy === f.id"
                                  data-title-tip="Close this finding with your note as the record of what was decided">
                            <i class="ph ph-check"></i>Handled</button>
                        </template>
                        <template x-if="!f.open">
                          <button class="btn btn-sm gap-1.5" @click="reopen(f)" :disabled="busy === f.id">
                            <i class="ph ph-arrow-counter-clockwise"></i>Reopen</button>
                        </template>
                        <button class="btn btn-sm btn-ghost gap-1.5" @click="comment(f)" :disabled="busy === f.id || !(draft[f.id] || '').trim()"
                                data-title-tip="A comment is kept with the finding and does not close it">
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
        // notes:changed (kits/notes.js) keeps this copy current.
        this.onNotes = (e) => { if (e.detail?.repo === REGISTRY()) this.take(e.detail.notes); };
        window.addEventListener('notes:changed', this.onNotes);
        this.load();
      },
      destroy() { window.removeEventListener('notes:changed', this.onNotes); },
      take(notes) { this.notes = notes; },

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
          this.notes = await window.Notes.load(this.reg());
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

      // ── Writing: a comment, a resolution, a reopening ────────────────────
      async write(f, make) {
        const text = (this.draft[f.id] || '').trim();
        this.busy = f.id; this.err = '';
        try {
          const gh = this.reg();
          const author = await window.Notes.author(gh);
          this.take(await window.Notes.append(gh, make(text, author)));
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
      ago(iso) { return window.GH?.ago?.(iso) || ''; },
      short(repo) { return String(repo || '').split('/')[1] || repo; },
      subjectLabel(s) {
        const p = window.Findings?.parse(s) || {};
        const r = this.short(p.repo);
        if (p.type === 'pr') return r + ' #' + p.number;
        if (p.type === 'branch') return r + ' / ' + window.AssistantMark.shortBranch(p.ref);
        if (p.type === 'session') return 'session ' + p.path.split('/').pop().replace(/\.json$/, '').slice(0, 10);
        if (p.type === 'call') return 'user call ' + p.path.split('/').pop().replace(/\.json$/, '').replace(/^[0-9a-f]{8}-/, '');
        if (p.type === 'snag') return r + ' snag ' + p.fragment;
        if (p.type === 'task') return r + ' task ' + p.path.split('/').pop().replace(/\.md$/, '');
        if (p.type === 'file') return r + ' ' + p.path.split('/').pop();
        return s;
      },
      subjectIcon(s) {
        const t = window.Findings?.parse(s)?.type;
        return { pr: 'ph-git-pull-request', branch: 'ph-git-branch', session: 'ph-terminal-window', snag: 'ph-warning', call: 'ph-tray',
                 task: 'ph-list-checks', file: 'ph-file-text', repo: 'ph-folder' }[t] || 'ph-link';
      },
      subjectHref(s) {
        const p = window.Findings?.parse(s) || {}, G = window.RepoAddress.github;
        if (p.type === 'pr') return G.pull(p.repo, p.number);
        if (p.type === 'branch') return '../pages/branch.html#gh=' + p.repo + '@' + p.ref;
        if (p.type === 'session') return '?view=sessions&session=' + p.path.split('/').pop().replace(/\.json$/, '').split('-').pop();
        if (p.type === 'snag') return G.blob(p.repo, 'main', p.path) + '#' + p.fragment;
        if (p.type === 'call') return '../pages/user-call.html#src=' + p.repo + ':' + p.path;
        if (p.path) return G.blob(p.repo, p.ref || 'main', p.path);
        if (p.type === 'repo') return G.repo(p.repo);
        return '#';
      },
    };
  });
});
