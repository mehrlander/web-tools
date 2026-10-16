// traffic-view.js — Traffic, the Activity pane at ?view=traffic.
//
// The calls THE OPEN PAGE has made since it loaded, and the work that made
// them, read from memory. A lane heads it: the requests in each slice of the
// page's life, load to now. Below it everything is a row: the timers armed to
// start work, every job the page started on its own (a cache check on
// arrival, a poll on a timer, a refresh a tap began), the page's own load (its
// files and the calls it made before a view was on screen), and the calls made
// for each view. Picking a row lists its calls below; the failed and
// not-found calls are filters on that list. Every other Activity pane reads
// the estate as git records it and reads the same on every device; this one
// reads one open page and is gone on reload, which is why it sits beside
// State, set apart from the panes that describe work. The FAB's Traffic tab
// reads the same call ledger from any page; this is the app's fuller view of
// it, with the job behind each call. What outlives the reload is the traffic
// log (lib/kits/traffic-log.js), which files the findings worth reading.
//
// The data is gh-boot.js's: window.__jobs (the job ledger, with the frame that
// attributes a call to its job), window.__traffic (the call ledger, capped at
// 400 rows), window.__trafficTotals (counts that outlive the cap),
// window.__jobArmed (what is scheduled next) and window.__visibility (when the
// tab was hidden), plus the browser's Resource Timing entries for the files.
// The arithmetic is lib/kits/traffic.js's, so it tests without a browser.
// This file only reads and draws.
//
// It costs nothing while closed: the pane mounts by x-if, and its one listener
// and its clock go with it. Registered as Alpine.data('trafficView').
document.addEventListener('alpine:init', function () {
  Alpine.data('trafficView', function () {

    const CAUSE = {
      boot:    { label: 'on load',       icon: 'ph-power' },
      arrival: { label: 'on arrival',    icon: 'ph-sign-in' },
      return:  { label: 'on return',     icon: 'ph-eye' },
      timer:   { label: 'on a timer',    icon: 'ph-timer' },
      tap:     { label: 'on a tap',      icon: 'ph-hand-tap' },
    };
    const T = () => window.Traffic;
    // The two tables' columns, one string each so every row of a table, its
    // head included, lines up. They follow the table's own width (container
    // queries): a narrow table folds its timing columns into a second line
    // under the name and keeps the bars.
    const JOB_GRID = 'grid grid-cols-[1rem_minmax(0,1fr)_4.75rem_5.75rem] @3xl:grid-cols-[1rem_minmax(0,1fr)_6rem_5.5rem_3.5rem_minmax(0,6.5rem)_3.5rem_6.5rem_6.5rem] gap-x-2 items-center';
    const CALL_GRID = 'grid grid-cols-[minmax(0,1fr)_2.5rem_5rem] @2xl:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,8rem)_1rem_2.5rem_3.5rem_6.5rem] gap-x-2 items-center';
    const GROUP = 'px-2 py-1 border-t border-base-300 bg-base-200/50 font-mono text-xs uppercase tracking-wider text-base-content/50';
    const LABEL = 'font-mono text-xs uppercase tracking-wider text-base-content/40';
    const META = 'font-mono text-xs text-base-content/60';
    const DIM = 'font-mono text-xs text-base-content/50';
    const HEAD = 'font-mono text-xs uppercase tracking-wider text-base-content/50';
    // A row's two bars, calls and data, each value right-aligned before a bar
    // whose dark part went out while the tab was hidden.
    const bars = (r) => `
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(${r}, 'calls')">
                    <span class="w-7 shrink-0 whitespace-nowrap text-right font-mono tabular-nums" x-text="${r}.calls"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(${r}, 'calls', true)" class="bg-primary" :class="bar(${r}, 'calls', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(${r}, 'calls', true) + '%'"></span>
                      <span x-show="bar(${r}, 'calls', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(${r}, 'calls', false) + '%'"></span>
                    </span>
                  </span>
                  <span class="flex items-center gap-1.5 min-w-0" data-title-tip-bare :data-title-tip="barTip(${r}, 'wire')">
                    <span class="w-12 shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-xs" x-text="size(${r})"></span>
                    <span class="flex-1 h-1.5 flex gap-[2px]">
                      <span x-show="bar(${r}, 'wire', true)" class="bg-primary" :class="bar(${r}, 'wire', false) ? '' : 'rounded-r-[3px]'" :style="'width:' + bar(${r}, 'wire', true) + '%'"></span>
                      <span x-show="bar(${r}, 'wire', false)" class="bg-primary/50 rounded-r-[3px]" :style="'width:' + bar(${r}, 'wire', false) + '%'"></span>
                    </span>
                  </span>`;
    // The lane's left column, what it reads and its figure: beside the lane on
    // a wide screen, one line above it on a phone.
    const GUTTER = 'flex sm:flex-col items-baseline sm:items-start gap-x-2 min-w-0';
    const FIG = 'font-mono text-xs tabular-nums whitespace-nowrap text-base-content/80';
    // The stretches the tab spent hidden, as a wash behind the lane.
    const WASH = `
              <template x-for="h in strip.hidden" :key="h.t0">
                <div class="absolute inset-y-0 bg-base-300/70 pointer-events-none"
                     :style="'left:' + (h.left * 100) + '%;width:' + Math.max(h.width * 100, 0.4) + '%'"></div>
              </template>`;
    // The crosshair: a hairline at the slice pointed at, with that slice's
    // requests beside it.
    const CROSS = `
              <div x-show="hover != null" class="absolute inset-y-0 w-px bg-base-content/50 pointer-events-none" :style="'left:' + crossAt() + '%'"></div>
              <span x-show="hover != null" class="absolute top-0 z-10 px-1 rounded bg-base-100/90 font-mono text-xs tabular-nums whitespace-nowrap text-base-content pointer-events-none"
                    :style="crossLabel()" x-text="hoverFig()"></span>`;
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
      files: null, fileRows: [], load: null,
      strip: { slices: [], hidden: [], max: 0, from: null, step: 0 },
      grid: [], labelStep: 0,
      // The slice pointed at, or null.
      hover: null,
      // The largest calls and bytes across every row, so each column of bars
      // shares one scale.
      maxCalls: 0, maxWire: 0, callMax: 0,
      now: Date.now(),
      // A row's key ('job:3', 'free:sessions', 'load'), a kind of call
      // ('failed', 'notfound'), or '' for every call.
      selected: '',

      template: `
        <div class="flex flex-col gap-2.5 min-w-0 text-sm">
          <div class="font-semibold text-base"><i class="ph ph-arrows-down-up text-lg text-base-content/50 align-middle mr-1"></i>Traffic</div>

          <!-- The requests in each slice of the page's life, oldest at the
               left, files included, so the load is the first burst. The lane
               runs from load to now and redraws every second. Its bins are cut
               on the clock (Traffic.timeline), so a bar keeps its edges while
               the scale squeezes, and they sit edge to edge, a hairline apart,
               since each stands for a stretch of time rather than a moment;
               as the page ages the bins widen in steps. Gridlines at round
               clock times fade by their spacing (Traffic.timeGrid): fine ones
               wash out as they close up and coarse ones take the labels. A
               bar's dark part went out while the tab was hidden, its light
               part in view, and a grey wash behind marks the stretches the tab
               spent in the background; the two steps of the accent mark hidden
               and visible on every bar in the pane. The figure is the scale,
               the busiest bin. Pointing at the lane draws a crosshair on the
               bin beneath with its requests beside it and its time on the
               axis, and the lane holds still until the pointer leaves. -->
          <div class="grid sm:grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1" data-part="lanes"
               @pointermove="point($event)" @pointerdown="point($event)"
               @pointerleave="$event.pointerType === 'mouse' && unpoint()" @click.outside="unpoint()">
            <div class="${GUTTER}"><span class="${LABEL}">Requests</span><span class="${FIG}" x-text="requestsFig()"></span></div>
            <div class="relative h-12 border-b border-base-300 [contain:layout_paint]" data-lane>
              ${WASH}
              <template x-for="k in grid" :key="k.t">
                <div class="absolute inset-y-0 w-px pointer-events-none" :class="k.label ? 'bg-base-content/25' : 'bg-base-content/15'"
                     :style="'left:' + (k.left * 100) + '%;opacity:' + Math.max(k.alpha, k.label)"></div>
              </template>
              <template x-for="sl in strip.slices" :key="sl.t0">
                <div x-show="sl.calls" class="absolute bottom-0 h-full pr-px flex flex-col justify-end"
                     :style="'left:' + (sl.left * 100) + '%;width:' + (sl.width * 100) + '%'">
                  <div x-show="sl.calls - sl.hidden > 0" class="bg-primary/50 rounded-t-[2px]"
                       :class="sl.hidden ? 'mb-[2px]' : ''"
                       :style="'height:' + ((sl.calls - sl.hidden) / strip.max * 100) + '%'"></div>
                  <div x-show="sl.hidden > 0" class="bg-primary"
                       :class="sl.calls - sl.hidden > 0 ? '' : 'rounded-t-[2px]'"
                       :style="'height:' + (sl.hidden / strip.max * 100) + '%'"></div>
                </div>
              </template>${CROSS}
            </div>
            <div class="hidden sm:block"></div>
            <div class="relative h-4 font-mono text-xs whitespace-nowrap [contain:layout_paint]">
              <div :class="hover != null ? 'invisible' : ''">
                <template x-for="k in grid" :key="k.t">
                  <span x-show="k.label" class="absolute top-0 text-base-content/50"
                        :style="'left:' + (k.left * 100) + '%;transform:translateX(-' + (k.left * 100) + '%);opacity:' + k.label" x-text="tickLabel(k.t)"></span>
                </template>
              </div>
              <span x-show="hover != null" class="absolute top-0 text-base-content"
                    :style="'left:' + crossAt() + '%;transform:translateX(-' + crossAt() + '%)'" x-text="hoverTime()"></span>
            </div>
            <div class="hidden sm:block"></div>
            <div class="flex items-center gap-x-4 gap-y-0.5 flex-wrap font-mono text-xs text-base-content/50">
              <span x-text="'loaded ' + clockTime(loadedAt) + ', ' + ago(now - loadedAt) + ' ago'"></span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary"></span>hidden</span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary/50"></span>in view</span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-base-300/70 border border-base-content/20"></span>tab hidden</span>
              <span x-show="tt.trimmed && strip.from" x-text="'calls before ' + clockTime(strip.from) + ' dropped'"></span>
              <span class="ml-auto">now</span>
            </div>
          </div>

          <!-- Two tables, stacked, side by side on the widest screens: what the
               page did, as rows, over the requests of the row picked. Each
               scrolls inside itself and is only as tall as its rows. -->
          <div class="grid gap-2.5 items-start 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div class="@container max-h-[50vh] 2xl:max-h-[65vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100" data-part="list">
              <div class="sticky top-0 z-10 bg-base-200 ${JOB_GRID} px-2 py-1 ${HEAD}">
                <span></span><span></span>
                <span class="hidden @3xl:block">Why</span>
                <span class="hidden @3xl:block">At</span>
                <span class="hidden @3xl:block text-right">Took</span>
                <span class="hidden @3xl:block">Ended</span>
                <span class="hidden @3xl:block text-right" data-title-tip-bare data-title-tip="Calls made while tab was hidden">Hidden</span>
                <span>Calls</span>
                <span>Data</span>
              </div>

              <!-- Armed: work scheduled to start, soonest first. -->
              <div x-show="armedRows().length" class="${GROUP}">Armed</div>
              <template x-for="a in armedRows()" :key="'armed:' + a.key">
                <div class="${JOB_GRID} px-2 py-1 border-t border-base-200">
                  <i class="ph ph-alarm text-base-content/40"></i>
                  <span class="min-w-0 col-span-3 @3xl:col-span-1">
                    <span class="block truncate" x-text="a.name"></span>
                    <span class="@3xl:hidden block truncate ${DIM}" x-text="'on a timer · ' + countdown(a)"></span>
                  </span>
                  <span class="hidden @3xl:flex items-center gap-1 ${META} truncate"><i class="ph ph-timer"></i><span>on a timer</span></span>
                  <span class="hidden @3xl:block ${META}" x-text="clockTime(a.at)"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="countdown(a)"></span>
                  <span class="hidden @3xl:block"></span><span class="hidden @3xl:block"></span>
                  <span class="hidden @3xl:block"></span><span class="hidden @3xl:block"></span>
                </div>
              </template>

              <!-- Jobs: work the page started on its own, newest first. -->
              <div class="${GROUP}" x-text="'Jobs ' + (rows.jobs.length || '')"></div>
              <template x-if="!rows.jobs.length">
                <div class="px-2 py-1 border-t border-base-200 text-base-content/50">None yet</div>
              </template>
              <template x-for="r in rows.jobs" :key="r.key">
                <button type="button" @click="pick(r)" :id="'trafficjob-' + r.id"
                        class="w-full text-left ${JOB_GRID} px-2 py-1 border-t border-base-200 hover:bg-base-200/60"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph" :class="r.running ? 'ph-circle-notch animate-spin text-primary' : r.failed ? 'ph-x-circle text-error' : 'ph-check-circle text-base-content/40'"></i>
                  <span class="min-w-0">
                    <span class="block truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="r.name"></span>
                    <span class="@3xl:hidden block truncate ${DIM}"
                          x-text="[cause(r.cause).label, clockTime(r.t), r.running ? 'for ' + ms(now - r.t) : ms(r.ms), r.running ? '' : r.outcome].filter(Boolean).join(' · ')"></span>
                  </span>
                  <span class="hidden @3xl:flex items-center gap-1 ${META} truncate"><i class="ph" :class="cause(r.cause).icon"></i><span x-text="cause(r.cause).label"></span></span>
                  <span class="hidden @3xl:block ${META}" x-text="clockTime(r.t)"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="r.running ? ms(now - r.t) : ms(r.ms)"></span>
                  <span class="hidden @3xl:block font-mono text-xs truncate" :class="r.failed ? 'text-error' : 'text-base-content/60'" x-text="r.running ? 'running' : r.outcome"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="r.hiddenCalls || ''"></span>
                  ${bars('r')}
                </button>
              </template>

              <!-- Not in a job: the page's own load first, then the requests
                   each view made for itself. -->
              <div class="${GROUP}" data-title-tip-bare data-title-tip="Requests no job made: page load, then each view">Not in a job</div>
              <template x-if="load">
                <button type="button" @click="pick(load)"
                        class="w-full text-left ${JOB_GRID} px-2 py-1 border-t border-base-200 hover:bg-base-200/60"
                        :class="selected === 'load' ? 'bg-primary/10' : ''">
                  <i class="ph ph-download-simple text-base-content/40"></i>
                  <span class="min-w-0">
                    <span class="block truncate" :class="selected === 'load' ? 'text-primary font-medium' : ''">Page load</span>
                    <span class="@3xl:hidden block truncate ${DIM}" x-text="['on load', clockTime(loadedAt), ms(load.ms), loadEnded()].filter(Boolean).join(' · ')"></span>
                  </span>
                  <span class="hidden @3xl:flex items-center gap-1 ${META} truncate"><i class="ph ph-power"></i><span>on load</span></span>
                  <span class="hidden @3xl:block ${META}" x-text="clockTime(loadedAt)"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="ms(load.ms)"></span>
                  <span class="hidden @3xl:block ${META} truncate" x-text="loadEnded()"></span>
                  <span class="hidden @3xl:block"></span>
                  ${bars('load')}
                </button>
              </template>
              <template x-for="r in views()" :key="r.key">
                <button type="button" @click="pick(r)"
                        class="w-full text-left ${JOB_GRID} px-2 py-1 border-t border-base-200 hover:bg-base-200/60"
                        :class="selected === r.key ? 'bg-primary/10' : ''">
                  <i class="ph ph-arrow-square-out text-base-content/40"></i>
                  <span class="min-w-0">
                    <span class="block truncate" :class="selected === r.key ? 'text-primary font-medium' : ''" x-text="whereLabel(r.where)"></span>
                    <span class="@3xl:hidden block truncate ${DIM}" x-text="'by view · ' + clockTime(r.t) + (r.last > r.t ? ' to ' + clockTime(r.last) : '')"></span>
                  </span>
                  <span class="hidden @3xl:block ${META}">by view</span>
                  <span class="hidden @3xl:block ${META}" x-text="clockTime(r.t)"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="r.last > r.t ? ms(r.last - r.t) : ''"></span>
                  <span class="hidden @3xl:block"></span>
                  <span class="hidden @3xl:block ${META} text-right tabular-nums" x-text="r.hiddenCalls || ''"></span>
                  ${bars('r')}
                </button>
              </template>
            </div>

            <!-- The requests of the row picked, or of one kind, or all of them.
                 Its head carries the totals and the kinds as filters. -->
            <div class="@container max-h-[50vh] 2xl:max-h-[65vh] overflow-y-auto overscroll-contain rounded-box border border-base-300 bg-base-100" data-part="detail">
              <div class="sticky top-0 z-10 bg-base-200 flex items-center gap-x-2 gap-y-1 flex-wrap px-2 py-1">
                <span class="${HEAD}">Calls</span>
                <span class="truncate min-w-0 font-medium" x-show="selected" x-text="selectedLabel()"></span>
                <span class="${META}" x-text="shownLine()"></span>
                <div class="grow"></div>
                <div class="flex items-center rounded-lg bg-base-300/50 p-0.5 font-mono text-xs" role="tablist" aria-label="Which calls">
                  <button type="button" role="tab" @click="selected = ''; pickCalls()" :aria-selected="!selected"
                          class="px-1.5 py-0.5 rounded-md" :class="!selected ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">All</button>
                  <button type="button" role="tab" x-show="tt.failed" @click="pickKind('failed')" :aria-selected="selected === 'failed'"
                          class="px-1.5 py-0.5 rounded-md text-error" :class="selected === 'failed' ? 'bg-base-100 shadow-sm' : 'hover:bg-base-100/60'"
                          data-title-tip-bare data-title-tip="Answered with an error, or not at all" x-text="'Failed ' + tt.failed"></button>
                  <button type="button" role="tab" x-show="tt.notFound" @click="pickKind('notfound')" :aria-selected="selected === 'notfound'"
                          class="px-1.5 py-0.5 rounded-md" :class="selected === 'notfound' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'"
                          data-title-tip-bare data-title-tip="Asked for a file that does not exist (404)" x-text="'Not found ' + tt.notFound"></button>
                </div>
              </div>
              <template x-if="!shown.length">
                <div class="px-2 py-2 text-base-content/50"
                     x-text="selRow() && selRow().calls ? 'Its calls have scrolled out of the 400 kept' : 'No calls'"></div>
              </template>
              <template x-for="e in shown" :key="e.n">
                <div class="${CALL_GRID} px-2 py-0.5 border-t border-base-200">
                  <span class="hidden @2xl:block ${DIM} tabular-nums" x-text="clockTime(e.t)"></span>
                  <span class="min-w-0">
                    <span class="block truncate" data-title-tip-bare :data-title-tip="e.url"><span x-show="isWrite(e)" class="font-mono text-xs text-warning mr-1" x-text="e.method"></span><span x-text="callLabel(e)"></span></span>
                    <span x-show="e.error || e.status >= 400" class="block truncate font-mono text-xs"
                          :class="T().isFailed(e) ? 'text-error' : 'text-base-content/50'" x-text="e.error || e.msg || ''"></span>
                    <span class="@2xl:hidden block truncate ${DIM}"
                          x-text="[clockTime(e.t), e.ms ? ms(e.ms) : '', callOwner(e), e.hidden ? 'hidden' : ''].filter(Boolean).join(' · ')"></span>
                  </span>
                  <span class="hidden @2xl:block truncate ${DIM}" x-text="callOwner(e)"></span>
                  <span class="hidden @2xl:flex items-center text-base-content/50">
                    <i x-show="e.jobBy === 'time'" class="ph ph-approximate-equals" data-title-tip="Credited by timing, not by stack"></i>
                    <i x-show="e.hidden && e.jobBy !== 'time'" class="ph ph-eye-slash" data-title-tip="Made while tab was hidden"></i>
                  </span>
                  <span class="font-mono text-xs tabular-nums text-right" :class="T().isFailed(e) ? 'text-error' : 'text-base-content/60'"
                        x-text="e.file ? (e.cached ? 'cache' : '') : (e.error ? 'fail' : (e.status || '…'))"></span>
                  <span class="hidden @2xl:block ${META} text-right tabular-nums" x-text="e.ms ? ms(e.ms) : ''"></span>
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="w-12 shrink-0 whitespace-nowrap text-right font-mono text-xs tabular-nums text-base-content/60" x-text="T().fmtBytesShort(e.wire)"></span>
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
        // Durations, countdowns and the lane move by the second while the pane
        // is open; a hidden tab skips the tick, since nobody is reading it.
        // The lane steps rather than glides: a transition on its bars and
        // lines would keep it animating, and relaying out, every frame for as
        // long as the pane is open, and each step's layout stays inside the
        // lane (contain: layout paint).
        this._tick = setInterval(() => {
          if (document.hidden) return;
          this.now = Date.now();
          this.drawLanes();
        }, 1000);
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      },
      destroy() {
        window.removeEventListener('traffic', this._onTraffic);
        clearInterval(this._tick);
      },

      // A copy, so Alpine sees a change: the ledgers are plain arrays that
      // gh-boot mutates in place. Everything the tables draw is computed here,
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
        this.fileRows = T().fileCalls(this.files, this.loadedAt);
        this.load = T().loadRow(this.files, this.calls, this.loadedAt);
        this.drawLanes();
        const all = [this.load, ...this.rows.jobs, ...this.views()];
        this.maxCalls = all.reduce((m, r) => Math.max(m, r.calls || 0), 0);
        this.maxWire = all.reduce((m, r) => Math.max(m, r.wire || 0), 0);
        this.pickCalls();
      },
      // The lane alone, from the ledgers already copied, so the clock can move
      // its time axis without redrawing the tables.
      drawLanes() {
        if (!T()) return;
        // A lane redrawn under the pointer moves the slice it points at, so a
        // redraw waits until the pointer leaves.
        if (this.hover != null) { this._lanesStale = true; return; }
        this.now = Date.now();
        const w = this.$el.querySelector?.('[data-lane]')?.clientWidth || 600;
        const tz = new Date().getTimezoneOffset();
        // Bins no narrower than about 14 pixels, and no more than 60 of them.
        const step = T().binStep(this.now - this.loadedAt, Math.max(8, Math.min(60, Math.floor(w / 14))));
        this.strip = T().timeline([...this.fileRows, ...this.calls], window.__visibility, this.loadedAt, this.now, step, tz);
        this.grid = T().timeGrid(this.loadedAt, this.now, w, tz);
        // Labels read as fine as the finest level showing one.
        this.labelStep = this.grid.reduce((m, k) => k.label > 0 ? Math.min(m, k.level) : m, Infinity);
      },
      // The view rows, without the page's own early calls, which belong to
      // the load row.
      views() { return this.rows.free.filter(r => r.where); },

      pick(r) { this.selected = this.selected === r.key ? '' : r.key; this.pickCalls(); },
      pickKind(k) { this.selected = this.selected === k ? '' : k; this.pickCalls(); },
      pickCalls() {
        const sel = this.selected;
        const newest = (a, b) => b.t - a.t;
        if (sel === 'load') {
          this.shown = [...this.fileRows, ...this.calls.filter(e => e.job == null && !e.where)].sort(newest);
        } else if (sel === 'failed' || sel === 'notfound') {
          this.shown = this.calls.filter(sel === 'failed' ? T().isFailed : T().isNotFound).sort(newest);
        } else {
          const r = this.selRow();
          this.shown = r ? T().rowCalls(this.calls, r) : [...this.calls].sort(newest);
        }
        this.callMax = this.shown.reduce((m, e) => Math.max(m, e.wire || 0), 0);
      },
      selRow() {
        if (!this.selected) return null;
        if (this.selected === 'load') return this.load;
        const r = this.rows;
        return r.jobs.find(x => x.key === this.selected) || r.free.find(x => x.key === this.selected) || null;
      },
      selectedLabel() {
        if (this.selected === 'failed') return 'failed';
        if (this.selected === 'notfound') return 'not found';
        const r = this.selRow();
        if (!r) return '';
        return r.kind === 'job' || r.kind === 'load' ? r.name : this.whereLabel(r.where);
      },
      // The calls table's head: every call since the page loaded when nothing
      // is picked, otherwise what the picked set holds.
      shownLine() {
        if (!T()) return '';
        if (!this.selected) {
          const t = this.tt;
          const bits = [t.calls + (t.calls === 1 ? ' call' : ' calls'), T().fmtBytesShort(t.wire), (t.hidden || 'none') + ' hidden'];
          if (t.trimmed) bits.push('newest ' + t.held + ' listed');
          return bits.join(' · ');
        }
        const wire = this.shown.reduce((s, e) => s + (e.wire || 0), 0);
        return this.shown.length + ' · ' + T().fmtBytesShort(wire);
      },

      // A row's bar in one column, `key` being 'calls' or 'wire': the dark
      // part is what went out hidden, the light part the rest, both as a share
      // of the column's largest row.
      bar(r, key, hidden) {
        const max = key === 'wire' ? this.maxWire : this.maxCalls;
        if (!max || !r) return 0;
        const total = r[key] || 0;
        const h = (key === 'wire' ? r.hiddenWire : r.hiddenCalls) || 0;
        return ((hidden ? h : total - h) / max) * 100;
      },
      barTip(r, key) {
        if (!r) return '';
        const fmt = key === 'wire' ? (v) => T().fmtBytesShort(v) : (v) => v + (v === 1 ? ' call' : ' calls');
        const h = (key === 'wire' ? r.hiddenWire : r.hiddenCalls) || 0;
        const unsized = key === 'wire' && r.unknown ? ', ' + r.unknown + ' without size' : '';
        return fmt(r[key] || 0) + (h ? ', ' + fmt(h) + ' while hidden' : ', all in view') + unsized;
      },
      callBar(e) { return this.callMax && e.wire ? Math.max(4, e.wire / this.callMax * 100) : 0; },
      // One bin's span, as the Requests lane's figure states it.
      sliceSpan() {
        const w = this.strip.step || 0;
        return w < 60000 ? this.ms(w) : ago(w);
      },
      // The crosshair. A pointer over the lane picks the bin under it; a
      // mouse that leaves, or a tap elsewhere, lets the lane move again.
      point(e) {
        const el = e.target.closest && e.target.closest('[data-lane]');
        const sl = this.strip.slices;
        if (!el || !sl.length) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const i = sl.findIndex(b => x < b.left + b.width);
        this.hover = i < 0 ? sl.length - 1 : i;
      },
      unpoint() {
        if (this.hover == null) return;
        this.hover = null;
        if (this._lanesStale) { this._lanesStale = false; this.drawLanes(); }
      },
      crossAt() {
        const b = this.hover == null ? null : this.strip.slices[this.hover];
        return b ? (b.left + b.width / 2) * 100 : 0;
      },
      // A gridline's label, as fine as the finest labeled level: seconds
      // under a minute, minutes under an hour, the hour alone beyond.
      tickLabel(t) {
        const s = this.labelStep;
        const o = s < 60000 ? { hour: 'numeric', minute: '2-digit', second: '2-digit' }
                : s < 3600000 ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' };
        try { return new Date(t).toLocaleTimeString([], o); } catch (e) { return ''; }
      },
      hoverTime() {
        const sl = this.strip.slices[this.hover];
        return sl ? clockTime(sl.t0) : '';
      },
      // The crosshair's label: right of the line, or left of it in the last
      // quarter, so it stays inside the lane.
      crossLabel() {
        const x = this.crossAt();
        return 'left:' + x + '%;transform:' + (x > 75 ? 'translateX(calc(-100% - 4px))' : 'translateX(4px)');
      },
      // The requests of the slice pointed at.
      hoverFig() {
        const sl = this.hover == null ? null : this.strip.slices[this.hover];
        return !sl ? '' : sl.calls + (sl.hidden ? ' · ' + sl.hidden + ' hidden' : '');
      },
      // The lane's figure: its scale, the busiest slice.
      requestsFig() {
        return this.strip.max ? 'peak ' + this.strip.max + ' per ' + this.sliceSpan() : 'none yet';
      },
      get loadedAt() { return performance.timeOrigin || this.now; },

      // What the load row's Ended column says: its files, and how many came
      // from cache.
      loadEnded() {
        const l = this.load;
        if (!l) return '';
        return l.files + (l.files === 1 ? ' file' : ' files') + (l.cached ? ', ' + l.cached + ' cached' : '');
      },
      armedRows() {
        return Object.entries(this.armed).map(([key, a]) => ({ key, ...a })).sort((a, b) => a.at - b.at);
      },
      countdown(a) { return a.at > this.now ? 'in ' + ago(a.at - this.now) : 'due'; },

      cause(c) { return CAUSE[c] || { label: c || 'unstated', icon: 'ph-question' }; },
      jobName(id) { return this.jobs.find(j => j.id === id)?.name || 'job ' + id; },
      // Who a call belongs to, for the calls table's middle column when the
      // table is not already one row's: a job, or a file's kind.
      callOwner(e) {
        if (e.file) return e.kind || 'file';
        if (this.selected && this.selected !== 'failed' && this.selected !== 'notfound') return '';
        return e.job != null ? this.jobName(e.job) : '';
      },
      whereLabel(w) {
        if (!w) return 'Page load';
        return window.__shell?.routeLabel?.(w) || w;
      },
      // A row's bytes, short enough for its column; calls with no disclosed
      // size are left out of the figure and counted in the tip.
      size(r) {
        if (!T() || !r || !r.calls) return '';
        return r.unknown === r.calls ? '?' : T().fmtBytesShort(r.wire);
      },
      isWrite(e) { return T()?.isWrite(e); },
      // A GitHub API call reads as its repo and path, the host and owner being
      // the same on nearly every row; a file, and anything else, as the kit's
      // label.
      callLabel(e) {
        if (e.via) return e.via;
        const s = String(e.url || '');
        if (!e.file) {
          const m = s.match(/^https:\/\/api\.github\.com\/(?:repos\/[^/]+\/([^/?#]+)\/)?([^?#]*)/);
          if (m) return (m[1] ? m[1] + ' · ' : '') + (m[2] || '/');
        }
        return T() ? T().label(s) : s;
      },
      clockTime, ago,
      ms(v) { return T() ? T().fmtMs(v) : ''; },
      T,
    };
  });
});
