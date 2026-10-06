document.addEventListener('alpine:init', function() {
  Alpine.data('waiting', function() {
    // The Waiting view: what waits on the owner, in one place (owner,
    // 2026-10-04: "is there somewhere in the app I can see them, and does it
    // include doc calls?"). Two queues, read by lib/kits/user-calls.js: the
    // open user calls, and the Text collection's proposals Dictate would stage
    // on each file as it stands.
    //
    // THREE TABS: Calls, Edits, Tighten (owner, 2026-10-06: "group and
    // rename"). The proposals split by what their variant's purpose does to
    // the text (mdVariants.kind): an edit changes what a paragraph says, most
    // often an update after a change elsewhere made a claim wrong; a
    // tightening keeps what it says in fewer or plainer words. The two differ
    // in urgency, since an unapplied edit leaves a wrong statement and an
    // unapplied tightening costs nothing, so Edits comes first. A file with
    // both kinds is a row in each tab, and its Review opens Dictate with only
    // that tab's kind staged (&proposed=edit or &proposed=tighten).
    //
    // TWO CONTAINERS AND NOTHING ABOVE THEM (owner, 2026-10-06, on a phone:
    // "the list on the top and then the embedded swiper basically on the
    // bottom in its own container ... the standing calls would be in one tab,
    // and then the list of the other proposals would be in another tab"). The
    // list holds the tabs in its own head row, so the view spends no height on
    // a title. Below the list, a STRIP of detail cards, one per row the list
    // shows: a swipe moves to the next row's card and the list's selection
    // follows it, kept in view inside the list and never by scrolling the
    // page; a pick in the list moves the strip. One head row above the strip
    // counts the card in view, carries its action (Review in Dictate, or
    // Answer), and can hand the strip the whole height. At @3xl the two
    // containers sit side by side instead of stacked.
    //
    // THE HEAD ROW NAMES THE CARD ONLY WHEN THE LIST IS HIDDEN (owner,
    // 2026-10-06, of the question printed twice: "Is the redundancy at the top
    // not intended?"). The list marks the selected row and keeps it in view on
    // every swipe and pick, so while the list shows, a name in the head row
    // says the same thing a second time, and on a phone a call's question
    // costs it three lines. Given the whole height, the list is gone and the
    // head row is the only place left to say which card this is, so the name
    // comes back there.
    //
    // The pattern is budget-drs's corpusSwiper (home, app/view/views/
    // corpora.js, the Comp and CSM tabs), which took it from this repo's
    // branch page (branch-brief.js, its file strip). The strip is built the
    // branch page's way, in Alpine, rather than on swipeDeck.core(): a card
    // here is Alpine markup with md-diff mounted into it, and a core slide is
    // filled by a render callback outside Alpine's tree.
    //
    // The detail is what was a click away before 2026-10-05: a call's brief
    // and recommendation, and each edit's reason above the edit itself, drawn
    // as md-diff's inline reading (the words that leave struck, the words that
    // arrive tinted); a file's staged proposals the same way, with who
    // proposed each and on what basis. A card mounts when the strip comes
    // within one card of it and then stays mounted, so swiping back is instant.
    //
    // Calls are cheap (one listing and a read each) and come first; the
    // proposals need the collection's passages, so they arrive after, their tab
    // saying so meanwhile. The nav entry is standing, with the count of open
    // calls as its badge (the shell's waitingCount).
    const U = () => window.UserCalls;

    return {
      description: 'Waiting view: the open user calls (decision, merge, documentation) from web-tools-private user-calls/, and the Text collection\'s proposals that Dictate would stage, by file, split into edits (what a paragraph says changes) and tightenings (only its wording does), in three tabs, each a list over a strip of detail cards that a swipe moves through with the list following.',

      calls: [],
      callsErr: '',
      loadingCalls: false,
      pending: null,
      pendingErr: '',
      loadingPending: false,
      showAnswered: false,
      tab: 'calls',        // 'calls' | 'edit' | 'tighten'
      tabChosen: false,    // the reader picked a tab, so loading stops choosing
      picked: { calls: '', edit: '', tighten: '' },   // each tab's selected row key
      mounted: {},         // row ids whose card has mounted
      full: false,         // the strip has the whole height, the list hidden
      hovered: false,
      _aim: -1, _aimT: 0, _raf: 0,

      template: `
        <div class="@container h-full" data-waiting>
          <!-- data-pattern and data-slot name the unit's body and its tabs
               (data/ui-units/codebook.md, "Slots"); nothing at runtime reads
               them. -->
          <div class="h-full flex flex-col gap-3 @3xl:flex-row @3xl:gap-4" data-pattern="linked-swiper">

            <!-- THE LIST: the tabs as its head row, then the tab's rows. As
                 tall as its rows up to 40% of the view, so one open call
                 leaves the strip nearly all of it. -->
            <section x-show="!full" data-waiting-list
                     class="shrink-0 min-h-0 max-h-[40%] flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100
                            @3xl:max-h-none @3xl:w-[22rem]">
              <div class="flex items-center gap-1 shrink-0 pl-1 pr-1 border-b border-base-300 bg-base-200/60">
                <div role="tablist" class="tabs tabs-border tabs-sm grow min-w-0 flex-nowrap" data-waiting-tabs data-slot="frame:tabs">
                  <template x-for="t in tabs" :key="t.key">
                    <button type="button" role="tab" class="tab gap-1.5 px-2.5" :data-waiting-tab="t.key"
                            :class="tab === t.key && 'tab-active'" :aria-selected="String(tab === t.key)" @click="setTab(t.key)">
                      <span x-text="t.label"></span>
                      <span x-show="t.loading" class="loading loading-dots loading-xs opacity-40"></span>
                      <span x-show="t.n != null" class="badge badge-xs tabular-nums" :class="t.warn && t.n ? 'badge-warning' : 'badge-ghost'" x-text="t.n"></span>
                    </button>
                  </template>
                </div>
                <button type="button" class="btn btn-ghost btn-xs btn-square text-base-content/50 shrink-0" @click="load(true)"
                        :disabled="!!(loadingCalls || loadingPending)" title="Refresh" aria-label="Refresh">
                  <i class="ph ph-arrows-clockwise text-base"></i></button>
              </div>

              <div x-ref="list" class="min-h-0 overflow-y-auto overscroll-contain" data-waiting-rows
                   @keydown.down.prevent="key(1)" @keydown.up.prevent="key(-1)">
                <template x-if="tab === 'calls'">
                  <div class="flex flex-col p-1" data-waiting-calls>
                    <div x-show="loadingCalls && !calls.length" class="flex px-2 py-2"><span class="loading loading-dots loading-sm opacity-40"></span></div>
                    <div x-show="callsErr" class="text-sm text-error px-2 py-1" x-text="callsErr"></div>
                    <div x-show="!loadingCalls && !callsErr && !openCalls.length" class="text-sm text-base-content/50 px-2 py-1">None open.</div>
                    <template x-for="c in openCalls" :key="c.id">
                      <button type="button" @click="pickRow(c.id)" data-waiting-call :data-kind="c.kind" :data-key="'call:' + c.id"
                              class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-base-200"
                              :class="isOn('call:' + c.id) && 'bg-primary/10 hover:bg-primary/10'" :aria-current="isOn('call:' + c.id) ? 'true' : null">
                        <i class="ph text-lg mt-0.5 text-primary shrink-0" :class="kindIcon(c)"></i>
                        <span class="min-w-0 flex flex-col">
                          <span class="text-sm font-medium line-clamp-2" x-text="c.question"></span>
                          <span class="text-xs text-base-content/50" x-text="callLine(c)"></span>
                        </span>
                      </button>
                    </template>
                    <template x-if="answeredCalls.length">
                      <div class="flex flex-col">
                        <button type="button" @click="showAnswered = !showAnswered" data-waiting-answered-toggle
                                class="self-start flex items-center gap-1.5 px-2 py-1 text-xs text-base-content/50 hover:text-base-content/80">
                          <i class="ph" :class="showAnswered ? 'ph-caret-down' : 'ph-caret-right'"></i>
                          <span x-text="answeredCalls.length + ' answered'"></span></button>
                        <template x-if="showAnswered">
                          <div class="flex flex-col">
                            <template x-for="c in answeredCalls" :key="c.id">
                              <button type="button" @click="pickRow(c.id)" data-waiting-answered :data-key="'call:' + c.id"
                                      class="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-base-200"
                                      :class="isOn('call:' + c.id) && 'bg-primary/10 hover:bg-primary/10'" :aria-current="isOn('call:' + c.id) ? 'true' : null">
                                <i class="ph text-base-content/40 shrink-0" :class="kindIcon(c)"></i>
                                <span class="min-w-0 flex-1 truncate" x-text="c.question"></span>
                                <span class="text-xs text-base-content/60 shrink-0" x-text="lastAnswer(c)"></span>
                              </button>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>
                    <a :href="'https://github.com/' + store + '/tree/main/user-calls'" target="_blank" rel="noopener"
                       class="self-start flex items-center gap-1.5 px-2 py-1 text-xs text-base-content/40 hover:text-primary">
                      <i class="ph ph-github-logo"></i><span>user-calls/ on GitHub</span></a>
                  </div>
                </template>

                <template x-if="tab !== 'calls'">
                  <div class="flex flex-col pb-1" data-waiting-proposed :data-proposed-kind="tab">
                    <div x-show="loadingPending" class="flex items-center gap-2 px-3 py-2 text-sm text-base-content/50">
                      <span class="loading loading-dots loading-sm opacity-40"></span><span>Reading the Text collection</span></div>
                    <div x-show="pendingErr" class="text-sm text-error px-3 py-1" x-text="pendingErr"></div>
                    <div x-show="pending && !groupsOf(tab).length" class="text-sm text-base-content/50 px-3 py-2">None pending.</div>
                    <template x-for="g in groupsOf(tab)" :key="g.repo">
                      <div class="flex flex-col" data-waiting-repo :data-repo="g.repo">
                        <div class="sticky top-0 z-10 flex items-baseline gap-2 px-3 pt-2 pb-1 bg-base-100">
                          <span class="text-xs font-semibold text-base-content/70" x-text="g.repo.split('/')[1]"></span>
                          <span class="text-xs text-base-content/40 tabular-nums" x-text="g.staged + ' in ' + g.files.length + (g.files.length === 1 ? ' file' : ' files')"></span>
                        </div>
                        <template x-for="f in g.files" :key="f.file">
                          <button type="button" @click="pickRow(f.file)" data-waiting-file :data-file="f.file" :data-key="tab + ':' + f.file"
                                  class="mx-1 flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-base-200"
                                  :class="isOn(tab + ':' + f.file) && 'bg-primary/10 hover:bg-primary/10'" :aria-current="isOn(tab + ':' + f.file) ? 'true' : null">
                            <span class="font-mono text-sm min-w-0 truncate" x-text="f.path"></span>
                            <span class="ml-auto badge badge-sm badge-ghost tabular-nums shrink-0" x-text="f.staged"></span>
                          </button>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </section>

            <!-- THE STRIP: one card per row the list shows, under one head row
                 that counts the card in view, and names it when the list is
                 hidden. -->
            <section data-waiting-detail class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
                     @pointerenter="hovered = true" @pointerleave="hovered = false">
              <div data-waiting-head class="flex items-center gap-1 shrink-0 min-h-12 pl-3 pr-1 py-1 border-b border-base-300 bg-base-200/60">
                <template x-if="cur && full">
                  <div class="min-w-0 grow flex items-center gap-2" data-waiting-name>
                    <i class="ph text-lg text-primary shrink-0" :class="cur.kind === 'call' ? kindIcon(cur.c) : 'ph-file-text'"></i>
                    <div class="min-w-0 flex flex-col leading-tight">
                      <span class="text-sm font-semibold line-clamp-2" :class="cur.kind === 'file' && 'font-mono break-all'"
                            x-text="cur.kind === 'call' ? cur.c.question : cur.f.path"></span>
                      <span class="text-xs text-base-content/50 truncate" x-text="cur.kind === 'call' ? callLine(cur.c) : fileLine(cur.f, cur.k)"></span>
                    </div>
                  </div>
                </template>
                <span x-show="!cur" class="grow text-sm text-base-content/50" x-text="emptyLine"></span>
                <!-- n/m shows everywhere, and the arrows too unless the name
                     is up and a phone needs the width for it; a phone swipes. -->
                <div x-show="rows.length > 1" data-waiting-pager class="flex items-center shrink-0" :class="cur && !full && '-ml-2'">
                  <button type="button" class="btn btn-xs btn-ghost btn-square" :class="full && 'max-sm:hidden'" @click="go(at - 1)"
                          :disabled="at <= 0" title="Previous" aria-label="Previous"><i class="ph ph-caret-left"></i></button>
                  <span class="font-mono text-xs opacity-60 tabular-nums px-1" data-waiting-pos x-text="(at + 1) + '/' + rows.length"></span>
                  <button type="button" class="btn btn-xs btn-ghost btn-square" :class="full && 'max-sm:hidden'" @click="go(at + 1)"
                          :disabled="at >= rows.length - 1" title="Next" aria-label="Next"><i class="ph ph-caret-right"></i></button>
                </div>
                <span x-show="!!cur && !full" class="grow"></span>
                <a x-show="!!cur" :href="actionHref(cur)" target="_blank" rel="noopener" class="btn btn-sm btn-primary shrink-0 gap-1.5"
                   data-waiting-open :data-kind="cur && cur.kind">
                  <i class="ph" :class="actionIcon(cur)"></i><span x-text="actionLabel(cur)"></span></a>
                <button type="button" class="btn btn-sm btn-ghost btn-square shrink-0" @click="toggleFull()" data-waiting-full
                        :title="full ? 'Show the list' : 'Detail only'" :aria-label="full ? 'Show the list' : 'Detail only'" :aria-pressed="String(full)">
                  <i class="ph text-lg" :class="full ? 'ph-arrows-in-simple' : 'ph-arrows-out-simple'"></i></button>
              </div>

              <div x-show="!rows.length" class="flex-1 min-h-0"></div>
              <!-- data-no-swipe: a sideways drag here is the strip's, never the
                   shell's view pager, even with one card and nothing to scroll. -->
              <div x-ref="strip" x-show="rows.length > 0" data-waiting-strip data-no-swipe @scroll.passive="stripScroll()"
                   class="flex-1 min-h-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <template x-for="r in rows" :key="r.id">
                  <div data-slide :data-key="r.id" class="w-full shrink-0 snap-center min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 @3xl:px-5 @3xl:py-4">

                    <template x-if="mounted[r.id] && r.kind === 'call'">
                      <article class="flex flex-col gap-4" data-waiting-detail-call :data-id="r.c.id">
                        <p x-show="r.c.brief" class="text-base text-base-content/80 text-pretty" x-text="r.c.brief"></p>
                        <div x-show="r.c.recommend" class="text-base text-pretty" data-waiting-recommend>
                          <span class="font-medium">Recommended:</span>
                          <span x-text="r.c.recommend"></span><span x-show="r.c.why" class="text-base-content/60" x-text="', since ' + r.c.why"></span>
                        </div>
                        <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                          <a x-show="r.c.file" :href="fileGh(r.c)" target="_blank" rel="noopener" class="font-mono hover:text-primary break-all" x-text="shortFile(r.c)"></a>
                          <a x-show="r.c.session" :href="sessionHref(r.c)" target="_blank" rel="noopener" class="hover:text-primary" x-text="'session ' + r.c.session"></a>
                          <a x-show="r.c.pr" :href="prUrl(r.c.pr)" target="_blank" rel="noopener" class="hover:text-primary" x-text="r.c.pr"></a>
                        </div>
                        <template x-if="(r.c.answers || []).length">
                          <div class="text-base rounded-lg bg-base-200/60 px-3 py-2" data-waiting-answer>
                            <span class="font-medium">Answered:</span> <span x-text="lastAnswer(r.c)"></span>
                            <span class="text-sm text-base-content/50" x-text="answerBy(r.c)"></span>
                            <p x-show="lastNote(r.c)" class="text-base-content/70 mt-1" x-text="lastNote(r.c)"></p>
                          </div>
                        </template>
                        <ol class="flex flex-col gap-5" data-waiting-edits>
                          <template x-for="(e, i) in (r.c.edits || [])" :key="r.c.id + ':' + i">
                            <li class="flex flex-col gap-1.5" data-waiting-edit>
                              <div class="flex items-baseline gap-2">
                                <span class="badge badge-sm tabular-nums shrink-0" x-text="i + 1"></span>
                                <span x-show="decisionOf(r.c, i)" class="badge badge-sm shrink-0" :class="decisionTone(decisionOf(r.c, i))" x-text="decisionOf(r.c, i)"></span>
                                <span class="text-base text-base-content/80 text-pretty" x-text="e.why || ''"></span>
                              </div>
                              <div class="rounded-lg border border-base-300 px-3 py-2" x-init="mountDiff($el, e.from, e.to)" data-waiting-diff></div>
                            </li>
                          </template>
                        </ol>
                      </article>
                    </template>

                    <template x-if="mounted[r.id] && r.kind === 'file'">
                      <article class="flex flex-col gap-4" data-waiting-detail-file :data-file="r.f.file">
                        <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-base-content/50">
                          <span x-text="r.f.repo"></span>
                          <a :href="'https://github.com/' + r.f.repo + '/blob/main/' + r.f.path" target="_blank" rel="noopener"
                             class="flex items-center gap-1 hover:text-primary"><i class="ph ph-github-logo"></i>on GitHub</a>
                        </div>
                        <ol class="flex flex-col gap-5" data-waiting-items>
                          <template x-for="(it, i) in r.f.items" :key="r.f.file + ':' + i">
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
                </template>
              </div>
            </section>
          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          // A strip that changed width (a phone turned, the list hidden, the
          // view back from display:none) has every card at a new offset, so it
          // is put back on the card it was showing, at once.
          try {
            let w = 0;
            this._ro = new ResizeObserver(() => {
              const nw = this.$refs.strip?.clientWidth || 0;
              if (nw && nw !== w) { w = nw; this.jump(); }
            });
            if (this.$refs.strip) this._ro.observe(this.$refs.strip);
          } catch {}
        });
        // Mount the card in view and its neighbours.
        this.$watch(() => this.tab + '|' + this.at + '|' + this.rows.length, () => this.markNear());
        // The rows changed under the strip (a tab, the answered fold, a load),
        // so the strip is rebuilt and has to be put on the selected card.
        this.$watch(() => this.tab + '|' + this.rows.map((r) => r.id).join('\n'), () => {
          this.ensurePick();
          this.$nextTick(() => { this.jump(); this.reveal(); });
        });
        // Left and right move the strip while the pointer or focus is in the
        // view. Nothing in the shell binds the arrows; capture is so a focused
        // control inside a card does not swallow them first.
        this._onKey = (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
          const t = e.target;
          if (t && (/^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName) || t.isContentEditable)) return;
          if (!this.$el.isConnected || !this.$el.offsetParent) return;
          if (!this.hovered && !this.$el.contains(document.activeElement)) return;
          if (this.rows.length < 2) return;
          e.preventDefault();
          this.go(this.at + (e.key === 'ArrowRight' ? 1 : -1));
        };
        window.addEventListener('keydown', this._onKey, true);
        this.load();
      },
      destroy() {
        window.removeEventListener('keydown', this._onKey, true);
        try { this._ro?.disconnect(); } catch {}
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
        this.chooseTab();
        this.loadingPending = true; this.pendingErr = '';
        try { this.pending = await U().pendingEdits({ fresh }); }
        catch (e) { this.pendingErr = 'Proposed edits could not be read: ' + (e?.message || e); }
        finally { this.loadingPending = false; }
        this.chooseTab();
      },
      // Until the reader picks one, the tab is the first with something in it,
      // in the tabs' order: calls, then edits, then tightenings.
      chooseTab() {
        if (!this.tabChosen) this.tab = this.tabs.find((t) => t.n)?.key || 'calls';
        this.ensurePick();
      },
      setTab(t) { this.tabChosen = true; this.tab = t; },
      // Each tab keeps its own selection, and never shows a blank card while
      // it has a row: a selection the rows no longer hold falls to the first.
      ensurePick() {
        for (const t of ['calls', 'edit', 'tighten']) {
          const rows = this.rowsOf(t);
          if (!rows.some((r) => r.key === this.picked[t])) this.picked[t] = rows[0]?.key || '';
        }
      },

      // ── The rows and the strip ──────────────────────────────────────────
      // A row is what the list draws and the strip shows a card for: a call
      // (the open ones, then the answered while the fold is open) or a file,
      // holding only the proposals of the tab's kind.
      rowsOf(t) {
        if (t === 'calls') {
          const cs = [...this.openCalls, ...(this.showAnswered ? this.answeredCalls : [])];
          return cs.map((c) => ({ id: 'call:' + c.id, key: c.id, kind: 'call', c }));
        }
        return this.groupsOf(t).flatMap((g) => g.files).map((f) => ({ id: t + ':' + f.file, key: f.file, kind: 'file', f, k: t }));
      },
      get rows() { return this.rowsOf(this.tab); },
      get at() { const i = this.rows.findIndex((r) => r.key === this.picked[this.tab]); return i < 0 ? 0 : i; },
      get cur() { return this.rows[this.at] || null; },
      isOn(id) { return this.cur?.id === id; },
      markNear() {
        const rows = this.rows;
        for (let i = Math.max(0, this.at - 1); i <= Math.min(rows.length - 1, this.at + 1); i++) {
          if (!this.mounted[rows[i].id]) this.mounted[rows[i].id] = true;
        }
      },
      panels() {
        const el = this.$refs.strip;
        return el ? [...el.querySelectorAll(':scope > [data-slide]')] : [];
      },
      // The card nearest the strip's left edge, measured rather than divided
      // out of scrollLeft, which is what branch-brief learned to do.
      nearest() {
        const el = this.$refs.strip;
        if (!el) return -1;
        const x0 = el.getBoundingClientRect().left;
        let best = -1, near = Infinity;
        this.panels().forEach((k, i) => {
          const d = Math.abs(k.getBoundingClientRect().left - x0);
          if (d < near) { near = d; best = i; }
        });
        return best;
      },
      // A swipe: the selection follows the card in view, once per frame.
      stripScroll() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
          this._raf = 0;
          if (!this.$refs.strip?.clientWidth) return;
          const best = this.nearest();
          if (best < 0) return;
          // A go() is in flight: its scroll passes the cards between, and
          // reading those back would walk the selection through each of them.
          if (this._aim >= 0) {
            if (best !== this._aim) return;
            this._aim = -1; clearTimeout(this._aimT);
          }
          if (best !== this.at && this.rows[best]) { this.picked[this.tab] = this.rows[best].key; this.reveal(); }
        });
      },
      // Move to row i: the selection at once, the strip after it. `instant`
      // for a pick in the list, where animating past twenty cards is noise.
      go(i, instant = false) {
        const rows = this.rows;
        if (!rows.length) return;
        i = Math.max(0, Math.min(rows.length - 1, i));
        this.picked[this.tab] = rows[i].key;
        this.reveal();
        this.scrollTo(i, instant);
      },
      // Be on the selected card, without travelling to it.
      jump() { this.scrollTo(this.at, true); },
      scrollTo(i, instant) {
        const el = this.$refs.strip, k = this.panels()[i];
        if (!el || !k || !el.clientWidth) return;
        const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        if (Math.abs(el.scrollLeft - x) < 2) return;
        this._aim = i; clearTimeout(this._aimT);
        this._aimT = setTimeout(() => { this._aim = -1; this.stripScroll(); }, 900);
        el.scrollTo({ left: x, behavior: instant ? 'instant' : 'smooth' });
        if (Math.abs(el.scrollLeft - x) < 2) { this._aim = -1; clearTimeout(this._aimT); }
      },
      pickRow(key) {
        const i = this.rows.findIndex((r) => r.key === key);
        if (i >= 0) this.go(i, true);
      },
      // Up and down in the list step the selection, the strip following, and
      // focus moves to the row without scrolling anything but the list.
      key(d) {
        this.go(this.at + d, true);
        this.$nextTick(() => this.rowEl()?.focus({ preventScroll: true }));
      },
      rowEl() {
        const id = this.cur?.id;
        return id ? this.$refs.list?.querySelector('[data-key="' + CSS.escape(id) + '"]') : null;
      },
      // Keep the selected row in view INSIDE THE LIST, never by scrolling the
      // page: a swipe through the cards walks the selection down rows the
      // reader may have scrolled away from. The lead clears the sticky
      // repository label over the proposed edits.
      reveal() {
        this.$nextTick(() => {
          const list = this.$refs.list, row = this.rowEl();
          if (!list || !row || !list.clientHeight) return;
          const box = list.getBoundingClientRect(), r = row.getBoundingClientRect();
          const lead = this.tab === 'calls' ? 4 : 30;
          if (r.top < box.top + lead) list.scrollTop -= box.top + lead - r.top;
          else if (r.bottom > box.bottom - 4) list.scrollTop += r.bottom - box.bottom + 4;
        });
      },
      toggleFull() { this.full = !this.full; this.$nextTick(() => { this.jump(); this.reveal(); }); },

      // One edit as md-diff draws a change's `both` stop, mounted when its card
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
      // One kind's files: each file's proposals of that kind, and the files
      // that have any.
      filesOf(k) {
        return this.files.map((f) => { const items = f.items.filter((it) => it.kind === k); return { ...f, items, staged: items.length }; })
          .filter((f) => f.staged);
      },
      // By repository, the repository with most waiting first, and within it
      // the file with most.
      groupsOf(k) {
        const by = new Map();
        for (const f of this.filesOf(k)) {
          if (!by.has(f.repo)) by.set(f.repo, { repo: f.repo, staged: 0, files: [] });
          const g = by.get(f.repo); g.staged += f.staged; g.files.push(f);
        }
        for (const g of by.values()) g.files.sort((a, b) => b.staged - a.staged || a.path.localeCompare(b.path));
        return [...by.values()].sort((a, b) => b.staged - a.staged || a.repo.localeCompare(b.repo));
      },
      count(k) { return this.filesOf(k).reduce((t, f) => t + f.staged, 0); },
      // The tab row: a count once its queue has been read, a spinner before.
      get tabs() {
        const read = !!this.pending;
        return [
          { key: 'calls', label: 'Calls', n: this.loadingCalls && !this.calls.length ? null : this.openCalls.length, warn: true },
          { key: 'edit', label: 'Edits', n: read ? this.count('edit') : null, loading: this.loadingPending },
          { key: 'tighten', label: 'Tighten', n: read ? this.count('tighten') : null, loading: this.loadingPending },
        ];
      },
      get summary() {
        const n = this.openCalls.length, parts = [n + (n === 1 ? ' call' : ' calls')];
        if (this.pending) parts.push(this.count('edit') + ' edits', this.count('tighten') + ' tightenings');
        return parts.join(' · ');
      },
      get emptyLine() {
        if (this.tab === 'calls') return this.loadingCalls ? 'Reading user calls' : 'No user call is open.';
        if (this.loadingPending) return 'Reading the Text collection';
        return this.tab === 'edit' ? 'No edit is proposed.' : 'No tightening is proposed.';
      },

      // The head row's action: a documentation call and a file open in
      // Dictate, any other call on the call page.
      actionHref(r) { return !r ? '#' : r.kind === 'call' ? this.href(r.c) : this.dictate(r.f, r.k); },
      actionLabel(r) { return r && r.kind === 'call' && r.c.kind !== 'documentation' ? 'Answer' : 'Review'; },
      actionIcon(r) { return r && r.kind === 'call' && r.c.kind !== 'documentation' ? 'ph-scales' : 'ph-pencil-line'; },
      href(c) { return U()?.href(c) || '#'; },
      sessionHref(c) { return U()?.sessionHref(c) || ''; },
      dictate(f, k) { return U()?.dictateHref({ file: f.file, proposed: k || true }) || '#'; },
      fileOf(c) { return U()?.fileKey(c.file) || c.file; },
      // owner/repo:path, said as the repo's name and the path.
      shortFile(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? f : f.slice(0, i).split('/').pop() + '/' + f.slice(i + 1); },
      fileGh(c) { const f = this.fileOf(c), i = f.indexOf(':'); return i < 0 ? '#' : 'https://github.com/' + f.slice(0, i) + '/blob/main/' + f.slice(i + 1); },
      kindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      kindLabel(c) { return { documentation: 'Documentation', merge: 'Merge' }[c.kind] || 'Decision'; },
      // A call's second line: the kind, what it holds, and its age.
      callLine(c) {
        const n = (c.edits || []).length;
        return [this.kindLabel(c), c.kind === 'documentation' && n ? n + (n === 1 ? ' edit' : ' edits') : '', this.ago(c.created)]
          .filter(Boolean).join(' · ');
      },
      // A file's second line: its repository and how many of the tab's kind
      // Dictate would stage.
      fileLine(f, k) {
        const n = f.staged, noun = k === 'tighten' ? 'tightening' : 'edit';
        return f.repo.split('/').pop() + ' · ' + n + ' ' + noun + (n === 1 ? '' : 's');
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
