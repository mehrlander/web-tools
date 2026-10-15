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
    // Columns in the timeline: enough to show a burst, few enough that each
    // stays a few pixels wide on a phone.
    const STRIP = 48;
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
      strip: { slices: [], hidden: [], max: 0, from: null },
      now: Date.now(),
      selected: '',
      // What the row bars measure: the number of calls, or the bytes they
      // brought. One at a time, so the bars share one scale.
      metric: 'calls',

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

          <!-- The page's life as columns of calls, oldest at the left. A column's
               dark part is calls that went out while the tab was hidden, its
               light part calls made in view, and a grey wash behind marks the
               stretches the tab spent in the background. The same two steps of
               the accent mark hidden and visible on every bar in the pane. -->
          <div class="flex flex-col gap-1.5" x-show="strip.max">
            <div class="flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-sm text-base-content/60">
              <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-[2px] bg-primary"></span>while hidden</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-[2px] bg-primary/50"></span>in view</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-[2px] bg-base-300/70 border border-base-content/20"></span>tab hidden</span>
              <div class="grow"></div>
              <span x-text="'peak ' + strip.max + (strip.max === 1 ? ' call' : ' calls') + ' per ' + (sliceMs() < 60000 ? ms(sliceMs()) : ago(sliceMs()))"></span>
            </div>
            <div class="relative h-16 flex items-end gap-[2px] border-b border-base-300">
              <template x-for="h in strip.hidden" :key="h.t0">
                <div class="absolute inset-y-0 bg-base-300/70 pointer-events-none"
                     :style="'left:' + (h.left * 100) + '%;width:' + Math.max(h.width * 100, 0.4) + '%'"></div>
              </template>
              <template x-for="(sl, i) in strip.slices" :key="i">
                <div class="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center" :data-title-tip="sliceTip(sl)">
                  <div x-show="sl.calls - sl.hidden > 0" class="w-full max-w-6 bg-primary/50 rounded-t-[4px]"
                       :class="sl.hidden ? 'mb-[2px]' : ''"
                       :style="'height:' + ((sl.calls - sl.hidden) / strip.max * 100) + '%'"></div>
                  <div x-show="sl.hidden > 0" class="w-full max-w-6 bg-primary"
                       :class="sl.calls - sl.hidden > 0 ? '' : 'rounded-t-[4px]'"
                       :style="'height:' + (sl.hidden / strip.max * 100) + '%'"></div>
                </div>
              </template>
            </div>
            <div class="flex items-center justify-between font-mono text-sm text-base-content/50">
              <span x-text="'loaded ' + clockTime(loadedAt)"></span>
              <span x-show="tt.trimmed && strip.from" x-text="'calls before ' + clockTime(strip.from) + ' dropped'"></span>
              <span>now</span>
            </div>
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
                <div class="flex items-center rounded-lg bg-base-200/60 p-0.5" role="tablist" aria-label="Bars measure">
                  <template x-for="m in [['calls', 'Calls'], ['wire', 'Data']]" :key="m[0]">
                    <button type="button" role="tab" @click="metric = m[0]" :aria-selected="metric === m[0]"
                            class="px-2 py-0.5 rounded-md font-mono text-sm transition-colors"
                            :class="metric === m[0] ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'"
                            x-text="m[1]"></button>
                  </template>
                </div>
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
                    <div class="mt-1.5 h-1.5 flex items-stretch gap-[2px]" :data-title-tip="barTip(r)">
                      <div x-show="barPart(r, true)" class="bg-primary" :class="barPart(r, false) ? '' : 'rounded-r-[3px]'" :style="'width:' + barPart(r, true) + '%'"></div>
                      <div x-show="barPart(r, false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + barPart(r, false) + '%'"></div>
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
                    <div class="mt-1.5 h-1.5 flex items-stretch gap-[2px]" :data-title-tip="barTip(r)">
                      <div x-show="barPart(r, true)" class="bg-primary" :class="barPart(r, false) ? '' : 'rounded-r-[3px]'" :style="'width:' + barPart(r, true) + '%'"></div>
                      <div x-show="barPart(r, false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + barPart(r, false) + '%'"></div>
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
                  <span class="hidden sm:flex w-12 h-1.5 shrink-0 justify-end">
                    <span class="rounded-l-[3px]" :class="e.hidden ? 'bg-primary' : 'bg-primary/50'" :style="'width:' + callBar(e) + '%'"></span>
                  </span>
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
        this.strip = T().timeline(this.calls, window.__visibility, this.loadedAt, this.now, STRIP);
        this.pickCalls();
      },
      pickCalls() {
        const r = this.selRow();
        this.shown = r ? T().rowCalls(this.calls, r) : [...this.calls].sort((a, b) => b.t - a.t);
        this.callMax = this.shown.reduce((m, e) => Math.max(m, e.wire || 0), 0);
      },
      callMax: 0,

      // The row bars: one scale across jobs and views, so a row's bar compares
      // with every other row's. The dark part is what went out hidden.
      rowValue(r, hiddenOnly) {
        return this.metric === 'wire' ? (hiddenOnly ? r.hiddenWire : r.wire) : (hiddenOnly ? r.hiddenCalls : r.calls);
      },
      get rowMax() {
        return [...this.rows.jobs, ...this.rows.free].reduce((m, r) => Math.max(m, this.rowValue(r, false) || 0), 0);
      },
      barPart(r, hidden) {
        const max = this.rowMax;
        if (!max) return 0;
        const h = this.rowValue(r, true) || 0;
        return ((hidden ? h : (this.rowValue(r, false) || 0) - h) / max) * 100;
      },
      barTip(r) {
        const total = this.rowValue(r, false) || 0, h = this.rowValue(r, true) || 0;
        const fmt = this.metric === 'wire' ? (v) => T().fmtBytesShort(v) : (v) => v + (v === 1 ? ' call' : ' calls');
        return fmt(total) + (h ? ', ' + fmt(h) + ' while hidden' : ', all in view');
      },
      callBar(e) { return this.callMax && e.wire ? Math.max(4, e.wire / this.callMax * 100) : 0; },
      sliceMs() { return this.strip.slices.length ? this.strip.slices[0].t1 - this.strip.slices[0].t0 : 0; },
      sliceTip(sl) {
        if (!sl.calls) return clockTime(sl.t0) + ' to ' + clockTime(sl.t1) + ': no calls';
        return clockTime(sl.t0) + ' to ' + clockTime(sl.t1) + ': ' + sl.calls + (sl.calls === 1 ? ' call' : ' calls')
             + (sl.hidden ? ', ' + sl.hidden + ' while hidden' : '') + (sl.jobCalls ? ', ' + sl.jobCalls + ' by jobs' : '');
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
