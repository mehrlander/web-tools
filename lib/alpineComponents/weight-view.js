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
      // The largest calls and bytes across every row, jobs and views together,
      // so each column of bars shares one scale.
      maxCalls: 0, maxWire: 0,
      now: Date.now(),
      selected: '',

      template: `
        <div class="flex flex-col gap-2.5 min-w-0 text-sm">
          <!-- The figures on one wrapping line: what the page loaded, what it
               holds, what it has fetched since, and what is armed next. -->
          <div class="flex items-baseline gap-x-5 gap-y-1 flex-wrap" data-part="meta">
            <span class="font-semibold text-base"><i class="ph ph-barbell text-lg text-base-content/50 align-middle mr-1"></i>Weight</span>
            <span class="font-mono text-base-content/60" x-text="'loaded ' + ago(now - loadedAt) + ' ago'"></span>
            <span class="flex items-baseline gap-1.5 min-w-0"><span class="font-mono text-xs uppercase tracking-wider text-base-content/40">Files</span><span class="font-mono" x-text="filesLine()"></span></span>
            <span class="flex items-baseline gap-1.5 min-w-0"><span class="font-mono text-xs uppercase tracking-wider text-base-content/40">Memory</span><span class="font-mono" x-text="memoryLine()"></span></span>
            <span class="flex items-baseline gap-1.5 min-w-0"><span class="font-mono text-xs uppercase tracking-wider text-base-content/40">Calls</span><span class="font-mono"><span x-text="callsLine()"></span><span
                  x-show="tt.errors" class="text-error" x-text="' · ' + tt.errors + ' failed'"></span><span
                  x-show="tt.trimmed" class="text-base-content/50"
                  data-title-tip="The call list keeps the newest 400; the counts here include every call since the page loaded"
                  x-text="' · last ' + tt.held + ' listed'"></span></span></span>
            <span x-show="armedRows().length" class="flex items-baseline gap-x-3 gap-y-1 flex-wrap min-w-0">
              <span class="font-mono text-xs uppercase tracking-wider text-base-content/40">Next</span>
              <template x-for="a in armedRows()" :key="a.key">
                <span><span x-text="a.name"></span> <span class="font-mono text-base-content/60" x-text="a.at > now ? 'in ' + ago(a.at - now) : 'due'"></span></span>
              </template>
            </span>
          </div>

          <!-- The page's life as columns of calls, oldest at the left. A column's
               dark part is calls that went out while the tab was hidden, its
               light part calls made in view, and a grey wash behind marks the
               stretches the tab spent in the background. The same two steps of
               the accent mark hidden and visible on every bar in the pane. -->
          <div class="flex flex-col gap-1" x-show="strip.max">
            <div class="relative h-12 flex items-end gap-[2px] border-b border-base-300">
              <template x-for="h in strip.hidden" :key="h.t0">
                <div class="absolute inset-y-0 bg-base-300/70 pointer-events-none"
                     :style="'left:' + (h.left * 100) + '%;width:' + Math.max(h.width * 100, 0.4) + '%'"></div>
              </template>
              <template x-for="(sl, i) in strip.slices" :key="i">
                <div class="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center" data-title-tip-bare :data-title-tip="sliceTip(sl)">
                  <div x-show="sl.calls - sl.hidden > 0" class="w-full max-w-6 bg-primary/50 rounded-t-[4px]"
                       :class="sl.hidden ? 'mb-[2px]' : ''"
                       :style="'height:' + ((sl.calls - sl.hidden) / strip.max * 100) + '%'"></div>
                  <div x-show="sl.hidden > 0" class="w-full max-w-6 bg-primary"
                       :class="sl.calls - sl.hidden > 0 ? '' : 'rounded-t-[4px]'"
                       :style="'height:' + (sl.hidden / strip.max * 100) + '%'"></div>
                </div>
              </template>
            </div>
            <div class="flex items-center gap-x-4 gap-y-0.5 flex-wrap font-mono text-xs text-base-content/50">
              <span x-text="'loaded ' + clockTime(loadedAt)"></span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary"></span>hidden</span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary/50"></span>in view</span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-base-300/70 border border-base-content/20"></span>tab hidden</span>
              <span x-text="'peak ' + strip.max + ' per ' + (sliceMs() < 60000 ? ms(sliceMs()) : ago(sliceMs()))"></span>
              <span x-show="tt.trimmed && strip.from" x-text="'calls before ' + clockTime(strip.from) + ' dropped'"></span>
              <span class="ml-auto">now</span>
            </div>
          </div>

          <!-- Two tables, stacked, side by side on the widest screens: jobs and
               the calls no job claimed, over the calls of the row picked. Each
               scrolls inside itself. Their columns follow the table's own width
               (a container query), so a narrow one folds its timing columns
               into a second line under the name rather than overflowing. -->
          <div class="grid gap-2.5 items-start 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div class="@container max-h-[45vh] 2xl:max-h-[65vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100" data-part="list">
              <div class="sticky top-0 z-10 bg-base-200 grid grid-cols-[1rem_minmax(0,1fr)_4.75rem_5.75rem] @3xl:grid-cols-[1rem_minmax(0,1fr)_6rem_5.5rem_3.5rem_minmax(0,6rem)_3.5rem_6.5rem_6.5rem] gap-x-2 px-2 py-1 font-mono text-xs uppercase tracking-wider text-base-content/50">
                <span></span>
                <span x-text="'Jobs ' + (rows.jobs.length || '')"></span>
                <span class="hidden @3xl:block">Why</span>
                <span class="hidden @3xl:block">At</span>
                <span class="hidden @3xl:block text-right">Took</span>
                <span class="hidden @3xl:block">Ended</span>
                <span class="hidden @3xl:block text-right" data-title-tip-bare data-title-tip="Calls made while the tab was in the background">Hidden</span>
                <span>Calls</span>
                <span>Data</span>
              </div>
              <template x-if="!rows.jobs.length">
                <div class="px-2 py-2 text-base-content/50">No jobs yet</div>
              </template>
              <template x-for="r in rows.jobs" :key="r.key">
                <button type="button" @click="pick(r)" :id="'weightjob-' + r.id"
                        class="w-full text-left grid grid-cols-[1rem_minmax(0,1fr)_4.75rem_5.75rem] @3xl:grid-cols-[1rem_minmax(0,1fr)_6rem_5.5rem_3.5rem_minmax(0,6rem)_3.5rem_6.5rem_6.5rem] gap-x-2 items-center px-2 py-1 border-t border-base-200 hover:bg-base-200/60"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph" :class="r.running ? 'ph-circle-notch animate-spin text-primary' : r.failed ? 'ph-x-circle text-error' : 'ph-check-circle text-base-content/40'"></i>
                  <span class="min-w-0">
                    <span class="block truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="r.name"></span>
                    <span class="@3xl:hidden block truncate font-mono text-xs text-base-content/50"
                          x-text="[cause(r.cause).label, clockTime(r.t), r.running ? 'for ' + ms(now - r.t) : ms(r.ms), r.running ? '' : r.outcome].filter(Boolean).join(' · ')"></span>
                  </span>
                  <span class="hidden @3xl:flex items-center gap-1 font-mono text-xs text-base-content/60 truncate"><i class="ph" :class="cause(r.cause).icon"></i><span x-text="cause(r.cause).label"></span></span>
                  <span class="hidden @3xl:block font-mono text-xs text-base-content/60" x-text="clockTime(r.t)"></span>
                  <span class="hidden @3xl:block font-mono text-xs text-base-content/60 text-right tabular-nums" x-text="r.running ? ms(now - r.t) : ms(r.ms)"></span>
                  <span class="hidden @3xl:block font-mono text-xs truncate" :class="r.failed ? 'text-error' : 'text-base-content/60'" x-text="r.running ? 'running' : r.outcome"></span>
                  <span class="hidden @3xl:block font-mono text-xs text-right tabular-nums text-base-content/60" x-text="r.hiddenCalls || ''"></span>
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(r, 'calls')">
                    <span class="w-6 shrink-0 text-right font-mono tabular-nums" x-text="r.calls"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(r, 'calls', true)" class="bg-primary" :class="bar(r, 'calls', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(r, 'calls', true) + '%'"></span>
                      <span x-show="bar(r, 'calls', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(r, 'calls', false) + '%'"></span>
                    </span>
                  </span>
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(r, 'wire')">
                    <span class="w-10 shrink-0 text-right font-mono tabular-nums text-xs" x-text="size(r)"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(r, 'wire', true)" class="bg-primary" :class="bar(r, 'wire', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(r, 'wire', true) + '%'"></span>
                      <span x-show="bar(r, 'wire', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(r, 'wire', false) + '%'"></span>
                    </span>
                  </span>
                </button>
              </template>

              <div x-show="rows.free.length" class="px-2 py-1 border-t border-base-300 bg-base-200/50 font-mono text-xs uppercase tracking-wider text-base-content/50"
                   data-title-tip="Calls no job claimed, filed by the view on screen when each went out">Not in a job</div>
              <template x-for="r in rows.free" :key="r.key">
                <button type="button" @click="pick(r)"
                        class="w-full text-left grid grid-cols-[1rem_minmax(0,1fr)_4.75rem_5.75rem] @3xl:grid-cols-[1rem_minmax(0,1fr)_6rem_5.5rem_3.5rem_minmax(0,6rem)_3.5rem_6.5rem_6.5rem] gap-x-2 items-center px-2 py-1 border-t border-base-200 hover:bg-base-200/60"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph ph-arrow-square-out text-base-content/40"></i>
                  <span class="min-w-0">
                    <span class="block truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="whereLabel(r.where)"></span>
                    <span class="@3xl:hidden block truncate font-mono text-xs text-base-content/50" x-text="clockTime(r.t) + (r.last > r.t ? ' to ' + clockTime(r.last) : '')"></span>
                  </span>
                  <span class="hidden @3xl:block font-mono text-xs text-base-content/60">by view</span>
                  <span class="hidden @3xl:block font-mono text-xs text-base-content/60" x-text="clockTime(r.t)"></span>
                  <span class="hidden @3xl:block font-mono text-xs text-base-content/60 text-right tabular-nums" x-text="r.last > r.t ? ms(r.last - r.t) : ''"></span>
                  <span class="hidden @3xl:block"></span>
                  <span class="hidden @3xl:block font-mono text-xs text-right tabular-nums text-base-content/60" x-text="r.hiddenCalls || ''"></span>
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(r, 'calls')">
                    <span class="w-6 shrink-0 text-right font-mono tabular-nums" x-text="r.calls"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(r, 'calls', true)" class="bg-primary" :class="bar(r, 'calls', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(r, 'calls', true) + '%'"></span>
                      <span x-show="bar(r, 'calls', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(r, 'calls', false) + '%'"></span>
                    </span>
                  </span>
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(r, 'wire')">
                    <span class="w-10 shrink-0 text-right font-mono tabular-nums text-xs" x-text="size(r)"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(r, 'wire', true)" class="bg-primary" :class="bar(r, 'wire', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(r, 'wire', true) + '%'"></span>
                      <span x-show="bar(r, 'wire', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(r, 'wire', false) + '%'"></span>
                    </span>
                  </span>
                </button>
              </template>
            </div>

            <!-- The calls of the row picked above, or every call held. -->
            <div class="@container max-h-[45vh] 2xl:max-h-[65vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100" data-part="detail">
              <div class="sticky top-0 z-10 bg-base-200 flex items-center gap-2 px-2 py-1 font-mono text-xs uppercase tracking-wider text-base-content/50">
                <span>Calls</span>
                <span class="normal-case tracking-normal truncate min-w-0 text-base-content/70" x-text="selectedLabel()"></span>
                <span x-text="shown.length"></span>
                <div class="grow"></div>
                <button type="button" x-show="selected" @click="selected = ''; pickCalls()"
                        class="normal-case tracking-normal text-base-content/60 hover:text-primary">show all</button>
              </div>
              <template x-if="!shown.length">
                <div class="px-2 py-2 text-base-content/50"
                     x-text="selRow() && selRow().calls ? 'Its calls have scrolled out of the 400 kept' : 'No calls'"></div>
              </template>
              <template x-for="e in shown" :key="e.n">
                <div class="grid grid-cols-[minmax(0,1fr)_2.25rem_5rem] @2xl:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,8rem)_1rem_2.25rem_3.5rem_6.5rem] gap-x-2 items-center px-2 py-0.5 border-t border-base-200">
                  <span class="hidden @2xl:block font-mono text-xs text-base-content/50 tabular-nums" x-text="clockTime(e.t)"></span>
                  <span class="min-w-0">
                    <span class="block truncate" data-title-tip-bare :data-title-tip="e.url"><span x-show="isWrite(e)" class="font-mono text-xs text-warning mr-1" x-text="e.method"></span><span x-text="callLabel(e)"></span></span>
                    <span class="@2xl:hidden block truncate font-mono text-xs text-base-content/50"
                          x-text="[clockTime(e.t), e.ms ? ms(e.ms) : '', !selected && e.job != null ? jobName(e.job) : '', e.hidden ? 'hidden' : ''].filter(Boolean).join(' · ')"></span>
                  </span>
                  <span class="hidden @2xl:block truncate font-mono text-xs text-base-content/50" x-text="!selected && e.job != null ? jobName(e.job) : ''"></span>
                  <span class="hidden @2xl:flex items-center text-base-content/50">
                    <i x-show="e.jobBy === 'time'" class="ph ph-approximate-equals"
                       data-title-tip="Credited by timing: the only job running when it went out, in a browser that cannot tell from its stack"></i>
                    <i x-show="e.hidden && e.jobBy !== 'time'" class="ph ph-eye-slash" data-title-tip="Made while the tab was in the background"></i>
                  </span>
                  <span class="font-mono text-xs tabular-nums text-right" :class="e.error || e.status >= 400 ? 'text-error' : 'text-base-content/60'"
                        x-text="e.error ? 'fail' : (e.status || '…')"></span>
                  <span class="hidden @2xl:block font-mono text-xs tabular-nums text-right text-base-content/60" x-text="e.ms ? ms(e.ms) : ''"></span>
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-base-content/60" x-text="T().fmtBytesShort(e.wire)"></span>
                    <span class="flex-1 h-1.5 flex"><span :class="e.hidden ? 'bg-primary' : 'bg-primary/50'" class="rounded-r-[3px]" :style="'width:' + callBar(e) + '%'"></span></span>
                  </span>
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
        const all = [...this.rows.jobs, ...this.rows.free];
        this.maxCalls = all.reduce((m, r) => Math.max(m, r.calls || 0), 0);
        this.maxWire = all.reduce((m, r) => Math.max(m, r.wire || 0), 0);
        this.pickCalls();
      },
      pickCalls() {
        const r = this.selRow();
        this.shown = r ? T().rowCalls(this.calls, r) : [...this.calls].sort((a, b) => b.t - a.t);
        this.callMax = this.shown.reduce((m, e) => Math.max(m, e.wire || 0), 0);
      },
      callMax: 0,

      // A row's bar in one column, `key` being 'calls' or 'wire': the dark
      // part is what went out hidden, the light part the rest, both as a share
      // of the column's largest row.
      bar(r, key, hidden) {
        const max = key === 'wire' ? this.maxWire : this.maxCalls;
        if (!max) return 0;
        const total = r[key] || 0;
        const h = (key === 'wire' ? r.hiddenWire : r.hiddenCalls) || 0;
        return ((hidden ? h : total - h) / max) * 100;
      },
      barTip(r, key) {
        const fmt = key === 'wire' ? (v) => T().fmtBytesShort(v) : (v) => v + (v === 1 ? ' call' : ' calls');
        const h = (key === 'wire' ? r.hiddenWire : r.hiddenCalls) || 0;
        const unsized = key === 'wire' && r.unknown ? ', ' + r.unknown + ' without a size' : '';
        return fmt(r[key] || 0) + (h ? ', ' + fmt(h) + ' while hidden' : ', all in view') + unsized;
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
      // A row's bytes, short enough for its column; calls with no disclosed
      // size are left out of the figure and counted in the tip.
      size(r) {
        if (!T() || !r.calls) return '';
        return r.unknown === r.calls ? '?' : T().fmtBytesShort(r.wire);
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
