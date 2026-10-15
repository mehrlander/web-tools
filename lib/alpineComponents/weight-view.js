// weight-view.js — Weight, the Activity pane at ?view=weight.
//
// What THE OPEN PAGE carries and what it has done since it loaded, read from
// memory. Three figures head it: the files the page loaded (the document, its
// script and style tags, fonts, images), the memory it holds, and the calls it
// has made since. Below them, every job the page started on its own (a cache
// check on arrival, a poll on a timer, a refresh a tap began) with the calls
// each made, and the calls no job claimed, filed by the view that was on screen
// when they went out. Every other Activity pane reads the estate as git records
// it and reads the same on every device; this one reads one open page and is
// gone on reload, which is why it sits beside State, set apart from the panes
// that describe work.
//
// The data is gh-boot.js's: window.__jobs (the job ledger, with the frame that
// attributes a call to its job), window.__traffic (the call ledger, capped at
// 400 rows), window.__trafficTotals (counts that outlive the cap) and
// window.__jobArmed (what is scheduled next), plus the browser's Resource
// Timing entries for the files. The arithmetic is lib/kits/traffic.js's
// (pageFiles, jobRows, rowCalls, tabTotals), so it tests without a browser.
// This file only reads and draws.
//
// It costs nothing while closed: the pane mounts by x-if, and its one listener
// and its clock go with it. Registered as Alpine.data('weightView').
document.addEventListener('alpine:init', function () {
  Alpine.data('weightView', function () {

    const CAUSE = {
      boot:    { label: 'on load',       icon: 'ph-power' },
      arrival: { label: 'on arrival',    icon: 'ph-sign-in' },
      return:  { label: 'on return',     icon: 'ph-eye' },
      timer:   { label: 'on a timer',    icon: 'ph-timer' },
      tap:     { label: 'on a tap',      icon: 'ph-hand-tap' },
    };
    const T = () => window.Traffic;
    const clockTime = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } };
    const ago = (ms) => {
      const s = Math.max(0, Math.round(ms / 1000));
      if (s < 60) return s + 's';
      const m = Math.round(s / 60);
      if (m < 60) return m + 'm';
      const h = Math.floor(m / 60);
      return h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
    };

    return {
      jobs: [], calls: [], armed: {},
      rows: { jobs: [], free: [] }, tt: {}, shown: [],
      files: null, heap: null, elements: 0,
      now: Date.now(),
      selected: '',

      template: `
        <div class="flex flex-col gap-4 min-w-0">
          <div class="flex items-baseline gap-3 text-base">
            <span class="font-semibold"><i class="ph ph-barbell text-lg text-base-content/50 align-middle mr-1.5"></i>Weight</span>
            <span class="font-mono text-base-content/60" x-text="'loaded ' + ago(now - loadedAt) + ' ago'"></span>
          </div>

          <!-- The figures, one labelled row each, so the three readings of the
               page line up: what it loaded, what it holds, what it has fetched
               since, and what is armed to run next. -->
          <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 items-baseline text-base" data-part="meta">
            <span class="font-mono text-sm uppercase tracking-widest text-base-content/40">Files</span>
            <span class="font-mono text-base-content/70" x-text="filesLine()"></span>
            <span class="font-mono text-sm uppercase tracking-widest text-base-content/40">Memory</span>
            <span class="font-mono text-base-content/70" x-text="memoryLine()"></span>
            <span class="font-mono text-sm uppercase tracking-widest text-base-content/40">Calls</span>
            <span class="font-mono text-base-content/70">
              <span x-text="callsLine()"></span><span x-show="tt.errors" class="text-error" x-text="' · ' + tt.errors + ' failed'"></span><span
                    x-show="tt.trimmed" class="text-base-content/50"
                    data-title-tip="The call list keeps the newest 400; the counts here include every call since the page loaded"
                    x-text="' · last ' + tt.held + ' listed'"></span>
            </span>
            <span x-show="armedRows().length" class="font-mono text-sm uppercase tracking-widest text-base-content/40">Next</span>
            <span x-show="armedRows().length" class="flex items-center gap-x-4 gap-y-1 flex-wrap">
              <template x-for="a in armedRows()" :key="a.key">
                <span class="flex items-center gap-1.5">
                  <i class="ph ph-alarm text-base-content/40"></i>
                  <span x-text="a.name"></span>
                  <span class="font-mono text-base-content/60" x-text="a.at > now ? 'in ' + ago(a.at - now) : 'due'"></span>
                </span>
              </template>
            </span>
          </div>

          <!-- The list: jobs, then the calls no job claimed. Capped near 40% of
               the height and scrolled inside itself, over the calls of the row
               picked in it. -->
          <div class="flex flex-col gap-3" data-part="list">
            <div class="max-h-[40vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100 divide-y divide-[var(--color-base-200)]">
              <div class="px-3 py-2 flex items-center gap-2 sticky top-0 bg-base-100 z-10">
                <span class="font-mono text-sm uppercase tracking-widest text-base-content/40">Jobs</span>
                <span class="font-mono text-sm text-base-content/40" x-text="rows.jobs.length || ''"></span>
                <div class="grow"></div>
                <button type="button" x-show="selected" @click="selected = ''; pickCalls()"
                        class="btn btn-xs btn-ghost gap-1 text-base-content/60">
                  <i class="ph ph-list text-sm"></i><span>All calls</span></button>
              </div>
              <template x-if="!rows.jobs.length">
                <div class="px-3 py-3 text-base text-base-content/50">No jobs yet</div>
              </template>
              <template x-for="r in rows.jobs" :key="r.key">
                <button type="button" @click="pick(r)" :id="'weightjob-' + r.id"
                        class="w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-base-200/60 transition-colors"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph text-lg mt-0.5 shrink-0" :class="r.running ? 'ph-circle-notch animate-spin text-primary' : r.failed ? 'ph-x-circle text-error' : 'ph-check-circle text-base-content/40'"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-base truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="r.name"></div>
                    <div class="flex items-center gap-x-3 gap-y-0.5 flex-wrap font-mono text-sm text-base-content/60">
                      <span class="flex items-center gap-1"><i class="ph" :class="cause(r.cause).icon"></i><span x-text="cause(r.cause).label"></span></span>
                      <span x-text="clockTime(r.t)"></span>
                      <span x-text="r.running ? 'for ' + ms(now - r.t) : ms(r.ms)"></span>
                      <span x-show="!r.running" :class="r.failed ? 'text-error' : ''" class="truncate max-w-full" x-text="r.outcome"></span>
                    </div>
                  </div>
                  <div class="shrink-0 flex flex-col items-end font-mono text-sm tabular-nums">
                    <span class="text-base" x-text="r.calls + (r.calls === 1 ? ' call' : ' calls')"></span>
                    <span class="text-base-content/60" x-text="size(r)"></span>
                    <span x-show="r.hiddenCalls" class="flex items-center gap-1 text-base-content/60"
                          data-title-tip="Calls made while the tab was in the background">
                      <i class="ph ph-eye-slash"></i><span x-text="r.hiddenCalls"></span></span>
                  </div>
                </button>
              </template>

              <div class="px-3 py-2 sticky top-0 bg-base-100 z-10" x-show="rows.free.length">
                <span class="font-mono text-sm uppercase tracking-widest text-base-content/40"
                      data-title-tip="Calls no job claimed, filed by the view on screen when each went out">Not in a job</span>
              </div>
              <template x-for="r in rows.free" :key="r.key">
                <button type="button" @click="pick(r)"
                        class="w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-base-200/60 transition-colors"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph ph-arrow-square-out text-lg mt-0.5 shrink-0 text-base-content/40"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-base truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="whereLabel(r.where)"></div>
                    <div class="font-mono text-sm text-base-content/60" x-text="clockTime(r.t) + (r.last > r.t ? ' to ' + clockTime(r.last) : '')"></div>
                  </div>
                  <div class="shrink-0 flex flex-col items-end font-mono text-sm tabular-nums">
                    <span class="text-base" x-text="r.calls + (r.calls === 1 ? ' call' : ' calls')"></span>
                    <span class="text-base-content/60" x-text="size(r)"></span>
                    <span x-show="r.hiddenCalls" class="flex items-center gap-1 text-base-content/60"
                          data-title-tip="Calls made while the tab was in the background">
                      <i class="ph ph-eye-slash"></i><span x-text="r.hiddenCalls"></span></span>
                  </div>
                </button>
              </template>
            </div>

            <!-- The calls of the row picked above, or every call held. -->
            <div class="max-h-[50vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100 divide-y divide-[var(--color-base-200)]" data-part="detail">
              <div class="px-3 py-2 flex items-center gap-2 sticky top-0 bg-base-100 z-10">
                <span class="font-mono text-sm uppercase tracking-widest text-base-content/40">Calls</span>
                <span class="text-base truncate min-w-0" x-text="selectedLabel()"></span>
                <span class="font-mono text-sm text-base-content/40 shrink-0" x-text="shown.length"></span>
              </div>
              <template x-if="!shown.length">
                <div class="px-3 py-3 text-base text-base-content/50"
                     x-text="selRow() && selRow().calls ? 'Its calls have scrolled out of the 400 kept' : 'No calls'"></div>
              </template>
              <template x-for="e in shown" :key="e.n">
                <div class="px-3 py-1.5 flex items-center gap-3 min-w-0">
                  <span class="font-mono text-sm text-base-content/50 shrink-0 tabular-nums hidden sm:inline" x-text="clockTime(e.t)"></span>
                  <span x-show="isWrite(e)" class="font-mono text-sm text-warning shrink-0" x-text="e.method"></span>
                  <div class="min-w-0 flex-1">
                    <div class="text-base truncate" :data-title-tip="e.url" x-text="callLabel(e)"></div>
                    <!-- On a phone the time joins this line, so the path keeps the row's width. -->
                    <div class="font-mono text-sm text-base-content/50 truncate" :class="!selected && e.job != null ? '' : 'sm:hidden'">
                      <span class="sm:hidden" x-text="clockTime(e.t)"></span><span class="sm:hidden" x-show="!selected && e.job != null"> · </span><span
                            x-show="!selected && e.job != null" x-text="jobName(e.job)"></span></div>
                  </div>
                  <i x-show="e.jobBy === 'time'" class="ph ph-approximate-equals text-base-content/50 shrink-0"
                     data-title-tip="Credited by timing: the only job running when it went out, in a browser that cannot tell from its stack"></i>
                  <i x-show="e.hidden" class="ph ph-eye-slash text-base-content/50 shrink-0"
                     data-title-tip="Made while the tab was in the background"></i>
                  <span class="font-mono text-sm tabular-nums shrink-0 w-10 text-right"
                        :class="e.error || e.status >= 400 ? 'text-error' : 'text-base-content/60'"
                        x-text="e.error ? 'fail' : (e.status || '…')"></span>
                  <span class="font-mono text-sm tabular-nums shrink-0 w-14 text-right text-base-content/60 hidden sm:inline" x-text="e.ms ? ms(e.ms) : ''"></span>
                  <span class="font-mono text-sm tabular-nums shrink-0 w-16 text-right text-base-content/60" x-text="T().fmtBytesShort(e.wire)"></span>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.read();
        this._onTraffic = () => this.read();
        window.addEventListener('traffic', this._onTraffic);
        // Durations and countdowns move by the second while the pane is open;
        // a hidden tab skips the tick, since nobody is reading it.
        this._tick = setInterval(() => { if (!document.hidden) this.now = Date.now(); }, 1000);
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      },
      destroy() {
        window.removeEventListener('traffic', this._onTraffic);
        clearInterval(this._tick);
      },

      // A copy, so Alpine sees a change: the ledgers are plain arrays that
      // gh-boot mutates in place. Everything the lists draw is computed here,
      // once per ledger event, so the clock's tick moves only the labels that
      // read `now`.
      read() {
        this.jobs = (window.__jobs || []).map(j => ({ ...j }));
        this.calls = (window.__traffic || []).map(e => ({ ...e }));
        this.armed = { ...(window.__jobArmed || {}) };
        this.now = Date.now();
        if (!T()) return;
        this.rows = T().jobRows(this.jobs, this.calls, this.now);
        this.tt = T().tabTotals(window.__trafficTotals, this.calls, this.jobs);
        this.files = T().readFiles();
        // Chrome alone reports the script heap, and coarsely; elsewhere the
        // line says so rather than showing a zero.
        try { this.heap = performance.memory ? performance.memory.usedJSHeapSize : null; } catch (e) { this.heap = null; }
        this.elements = document.getElementsByTagName('*').length;
        this.pickCalls();
      },
      pickCalls() {
        const r = this.selRow();
        this.shown = r ? T().rowCalls(this.calls, r) : [...this.calls].sort((a, b) => b.t - a.t);
      },

      get loadedAt() { return performance.timeOrigin || this.now; },
      // Unpacked size first, since that is what the browser parses and holds;
      // what crossed the network after it. A file served from cache cost no
      // transfer, and one whose server disclosed no size is counted apart.
      filesLine() {
        const f = this.files;
        if (!f || !T()) return '';
        const bits = [f.count + (f.count === 1 ? ' file' : ' files'), T().fmtBytesShort(f.decoded),
                      T().fmtBytesShort(f.wire) + ' transferred'];
        if (f.cached) bits.push(f.cached + ' from cache');
        if (f.undisclosed) bits.push(f.undisclosed + ' size unknown');
        return bits.join(' · ');
      },
      memoryLine() {
        const heap = this.heap == null ? 'script heap not reported by this browser' : T().fmtBytesShort(this.heap) + ' script heap';
        return heap + ' · ' + this.elements.toLocaleString() + ' elements';
      },
      callsLine() {
        const t = this.tt;
        if (!T()) return '';
        const bits = [t.calls + (t.calls === 1 ? ' call' : ' calls'), T().fmtBytesShort(t.wire)];
        if (t.hidden) bits.push(t.hidden + ' while hidden');
        if (t.running) bits.push(t.running + (t.running === 1 ? ' job' : ' jobs') + ' running');
        return bits.join(' · ');
      },
      armedRows() {
        return Object.entries(this.armed).map(([key, a]) => ({ key, ...a })).sort((a, b) => a.at - b.at);
      },

      pick(r) { this.selected = this.selected === r.key ? '' : r.key; this.pickCalls(); },
      selRow() {
        if (!this.selected) return null;
        const r = this.rows;
        return r.jobs.find(x => x.key === this.selected) || r.free.find(x => x.key === this.selected) || null;
      },
      selectedLabel() {
        const r = this.selRow();
        if (!r) return 'everything held';
        return r.kind === 'job' ? r.name : this.whereLabel(r.where);
      },

      cause(c) { return CAUSE[c] || { label: c || 'unstated', icon: 'ph-question' }; },
      jobName(id) { return this.jobs.find(j => j.id === id)?.name || 'job ' + id; },
      whereLabel(w) {
        if (!w) return 'Page start';
        return window.__shell?.routeLabel?.(w) || w;
      },
      size(r) {
        if (!T()) return '';
        if (!r.calls) return '';
        if (r.unknown === r.calls) return 'size unknown';
        return T().fmtBytesShort(r.wire) + (r.unknown ? ' +' + r.unknown + ' unknown' : '');
      },
      isWrite(e) { return T()?.isWrite(e); },
      // A GitHub API call reads as its repo and path, the host and owner being
      // the same on nearly every row; anything else as the kit's label.
      callLabel(e) {
        if (e.via) return e.via;
        const s = String(e.url || '');
        const m = s.match(/^https:\/\/api\.github\.com\/(?:repos\/[^/]+\/([^/?#]+)\/)?([^?#]*)/);
        if (m) return (m[1] ? m[1] + ' · ' : '') + (m[2] || '/');
        return T() ? T().label(s) : s;
      },
      clockTime, ago,
      ms(v) { return T() ? T().fmtMs(v) : ''; },
      T,
    };
  });
});
