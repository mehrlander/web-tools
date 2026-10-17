// traffic-view.js — Traffic, the Activity pane at ?view=traffic.
//
// The calls THE OPEN PAGE has made since it loaded, and the work that made
// them, read from memory. A lane heads it: this browser's calls over the last
// 24 hours, 7 days or 30 days, from the stores the traffic log keeps
// (lib/kits/traffic-log.js), so it outlives a reload and adds up every app
// tab in the browser; tapping a bar opens what it counts. Below it everything
// is this page's: the timers armed to start work, every job the page started
// on its own (a cache check on arrival, a poll on a timer, a refresh a tap
// began), the page's own load (its files and the calls it made before a view
// was on screen), and the calls made for each view. Picking a row lists its calls below; the failed and
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
    // The lane's figure: what the range holds.
    const FIG = 'font-mono text-xs tabular-nums whitespace-nowrap text-base-content/80';
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
      // The range picked (a key of Traffic.RANGES), its bars of this
      // browser's calls, oldest first, the scale's round top, where the axis
      // is marked, and when the store's record begins.
      range: 'day', ranges: [], bins: [], scaleMax: 0, marks: [], start: null,
      // Which browser the bars are this one: the reader's name for it from the
      // Here view, else its kind (lib/kits/browser-kind.js). The Here view is
      // where it is named, so the name links there.
      browserName: window.BrowserKind ? window.BrowserKind.name() : 'this browser',
      // The bar whose panel-tip is open, by key, so it stays on its bar as the
      // lane redraws; where the panel sits; and its ✕.
      tip: null, tipAt: { x: 0, y: 0, w: 0 }, tipClose: '',
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

          <!-- This browser's calls over the range picked, from the stores the
               traffic log keeps. The options are the record's extent: the
               stores keep exactly what the longest range draws
               (Traffic.RANGES). A bar's dark part went out while the tab was
               hidden, its light part in view; the two steps of the accent mark
               hidden and visible on every bar in the pane. The scale's round
               top stands at the right, the clock under the bars, the bar's
               length in the legend. It redraws once a minute, so it holds
               still while read. Tapping a bar opens its panel-tip, which steps
               to its neighbours; kits/panel-tip.js owns the way out. -->
          <div class="grid gap-1" data-part="lanes">
            <div class="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0">
              <div class="join" role="group" aria-label="Range">
                <template x-for="r in ranges" :key="r.key">
                  <button type="button" class="btn btn-xs join-item" :class="range === r.key && 'btn-active'"
                          :aria-pressed="range === r.key ? 'true' : 'false'" @click="setRange(r.key)" x-text="r.label"></button>
                </template>
              </div>
              <span class="${FIG}" x-text="rangeFig()"></span>
              <button type="button" class="${DIM} hover:text-base-content hover:underline truncate min-w-0" @click="window.__shell?.goHere()" x-text="browserName"></button>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-1.5">
              <div class="relative h-14 flex items-end border-b border-base-300 cursor-pointer" data-lane @click="tapLane($event)">
                <div x-show="scaleMax" class="absolute inset-x-0 top-0 border-t border-dashed border-base-300 pointer-events-none"></div>
                <template x-for="m in marks.filter(m => m.line)" :key="'line:' + m.t">
                  <div class="absolute inset-y-0 w-px bg-base-300 pointer-events-none" :style="'left:' + (m.i / bins.length * 100) + '%'"></div>
                </template>
                <div x-show="tip" class="absolute inset-y-0 bg-base-content/10 pointer-events-none"
                     :style="tipBand()"></div>
                <template x-for="b in bins" :key="b.key">
                  <div class="relative flex-1 min-w-0 h-full pr-px flex flex-col justify-end pointer-events-none">
                    <div x-show="b.calls - b.hidden > 0" class="bg-primary/50 rounded-t-[1px]"
                         :style="'height:' + barH(b.calls - b.hidden) + '%'"></div>
                    <div x-show="b.hidden > 0" class="bg-primary"
                         :class="b.calls - b.hidden > 0 ? '' : 'rounded-t-[1px]'"
                         :style="'height:' + barH(b.hidden) + '%'"></div>
                  </div>
                </template>
              </div>
              <div class="h-14 flex flex-col justify-between items-end ${DIM} tabular-nums leading-none">
                <span x-text="scaleMax ? scaleMax.toLocaleString() : ''"></span><span>0</span>
              </div>
              <div class="relative h-4 font-mono text-xs whitespace-nowrap text-base-content/50">
                <template x-for="m in marks" :key="'mark:' + m.t">
                  <span class="absolute top-0" :style="markAt(m)" x-text="markLabel(m)"></span>
                </template>
              </div>
              <div></div>
            </div>
            <div class="flex items-center gap-x-4 gap-y-0.5 flex-wrap font-mono text-xs text-base-content/50">
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary"></span>hidden</span>
              <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-[2px] bg-primary/50"></span>in view</span>
              <span x-text="'calls per ' + spanLabel()"></span>
              <span class="ml-auto">now</span>
            </div>
            <div x-ref="barTip" x-show="tip" role="dialog" aria-label="Calls in this bar"
                 class="fixed z-[1000] rounded-xl border border-base-300 bg-base-100 shadow-lg px-4 py-3 text-sm leading-6"
                 :style="{ left: tipAt.x + 'px', top: tipAt.y + 'px', width: tipAt.w + 'px' }">
              <div x-html="tipClose"></div>
              <template x-if="tipBar()">
                <div class="grid gap-1 pr-6">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-medium text-balance" x-text="tipWhen()"></span>
                    <span class="join ml-auto shrink-0">
                      <button type="button" class="btn btn-xs btn-square join-item" aria-label="Earlier" :disabled="tipIndex() <= 0" @click="stepTip(-1)"><i class="ph ph-caret-left"></i></button>
                      <button type="button" class="btn btn-xs btn-square join-item" aria-label="Later" :disabled="tipIndex() >= bins.length - 1" @click="stepTip(1)"><i class="ph ph-caret-right"></i></button>
                    </span>
                  </div>
                  <div class="font-mono text-xs tabular-nums" x-text="tipFig()"></div>
                  <template x-for="o in tipOwners()" :key="o.who">
                    <div class="flex items-baseline gap-2 min-w-0">
                      <span class="truncate" x-text="o.who"></span>
                      <span class="ml-auto font-mono text-xs tabular-nums" x-text="o.n"></span>
                    </div>
                  </template>
                </div>
              </template>
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
        // Durations and countdowns move by the second while the pane is open,
        // and the lane once a minute; a hidden tab skips the tick, since
        // nobody is reading it.
        this._tick = setInterval(() => {
          if (document.hidden) return;
          this.now = Date.now();
          if (this.now - (this._laneAt || 0) >= 60000) this.drawLanes();
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
        // The lane keeps its own minute; a call does not redraw it.
        if (!this._laneAt) this.drawLanes();
        const all = [this.load, ...this.rows.jobs, ...this.views()];
        this.maxCalls = all.reduce((m, r) => Math.max(m, r.calls || 0), 0);
        this.maxWire = all.reduce((m, r) => Math.max(m, r.wire || 0), 0);
        this.pickCalls();
      },
      // The lane: the range's bars, from the browser's store for it, this
      // tab's newest calls added first.
      drawLanes() {
        if (!T()) return;
        this._laneAt = Date.now();
        this.ranges = T().RANGES;
        const r = this.rangeDef(), off = new Date().getTimezoneOffset();
        const store = (window.TrafficLog ? window.TrafficLog.stores() : {})[r.store] || {};
        this.bins = T().lastBins(store, this._laneAt, r, off);
        this.start = T().recordStart(store, off);
        this.scaleMax = T().niceMax(this.bins.reduce((m, b) => Math.max(m, b.calls), 0));
        // A day is named every three hours where an hour is 30 pixels or wider.
        const w = this.lane()?.clientWidth || 600;
        this.marks = T().axisMarks(this.bins, r, w / 24 >= 30 ? 3 : 6);
        if (this.tip && this.tipIndex() < 0) this.closeTip();
      },
      // From the component's root, since a method run from a handler gets
      // that element as its $el, and the first draw runs before refs exist.
      lane() { return this.$root?.querySelector('[data-lane]'); },
      rangeDef() { return T().RANGES.find(r => r.key === this.range) || T().RANGES[0]; },
      setRange(k) {
        if (k === this.range) return;
        this.closeTip();
        this.range = k;
        this.drawLanes();
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
      // The lane's figure: the range's calls, and when the record begins if
      // that is inside the range.
      rangeFig() {
        const n = this.bins.reduce((m, b) => m + b.calls, 0);
        const fig = n.toLocaleString() + (n === 1 ? ' call' : ' calls');
        if (!this.start || !this.bins.length || this.start <= this.bins[0].t0) return fig;
        const day = this.range === 'day' ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' };
        try { return fig + ' since ' + new Date(this.start).toLocaleString([], day); } catch (e) { return fig; }
      },
      barH(v) { return this.scaleMax ? v / this.scaleMax * 100 : 0; },
      spanLabel() {
        const m = this.rangeDef().span;
        return m < 60 ? m + ' minutes' : m === 60 ? 'hour' : (m / 60) + ' hours';
      },
      // An axis mark's place: centred on its bar's left edge, held inside the
      // lane at either end.
      markAt(m) {
        const x = m.i / (this.bins.length || 1) * 100;
        return 'left:' + x + '%;transform:translateX(-' + x + '%)';
      },
      markLabel(m) {
        const as = { hour: { hour: 'numeric' }, weekday: { weekday: 'short' }, date: { month: 'short', day: 'numeric' } }[m.label];
        try { return m.label === 'hour' ? new Date(m.t).toLocaleTimeString([], as) : new Date(m.t).toLocaleDateString([], as); } catch (e) { return ''; }
      },

      // The bar panel-tip. A tap on the lane picks the bar under it; a tap on
      // the same bar, the ✕, Escape or a press outside closes it.
      async tapLane(e) {
        const el = this.lane();
        if (!el || !this.bins.length) return;
        const r = el.getBoundingClientRect();
        const i = Math.max(0, Math.min(this.bins.length - 1, Math.floor((e.clientX - r.left) / r.width * this.bins.length)));
        if (this.tip === this.bins[i].key) return this.closeTip();
        await this.wireTip();
        this.openTip(i);
      },
      async wireTip() {
        if (this._tipWired) return;
        this._tipWired = true;
        await window.gh?.load?.('kits/panel-tip.js').catch(() => {});
        if (!window.PanelTip || !this.$refs.barTip) return;
        window.PanelTip.wire(this.$refs.barTip, { onClose: () => this.closeTip(), except: ['[data-lane]'] });
      },
      openTip(i) {
        const lane = this.lane();
        if (!lane || !this.bins[i]) return;
        const r = lane.getBoundingClientRect();
        const w = Math.min(320, innerWidth - 16);
        const x = r.left + (i + 0.5) / this.bins.length * r.width;
        this.tipClose = window.PanelTip ? window.PanelTip.closeHTML(true) : '';
        this.tip = this.bins[i].key;
        this.tipAt = { w, x: Math.max(8, Math.min(x - w / 2, innerWidth - w - 8)), y: r.bottom + 22 };
        // Above the lane when below it would run off the screen.
        this.$nextTick(() => {
          const h = this.$refs.barTip?.offsetHeight || 0;
          if (this.tip && r.bottom + 22 + h > innerHeight - 8 && r.top - 6 - h >= 8) this.tipAt.y = r.top - 6 - h;
        });
      },
      closeTip() { this.tip = null; },
      stepTip(d) {
        const i = this.tipIndex() + d;
        if (this.bins[i]) this.tip = this.bins[i].key;
      },
      tipIndex() { return this.bins.findIndex(b => b.key === this.tip); },
      tipBar() { return this.tip ? this.bins[this.tipIndex()] || null : null; },
      // An object, not a string: a string :style replaces the attribute and
      // with it the display x-show sets, which drew the band of a closed tip.
      tipBand() {
        const i = this.tipIndex(), n = this.bins.length || 1;
        return { left: (i / n * 100) + '%', width: (100 / n) + '%' };
      },
      // The bar's span on the reader's clock, minutes only where a bar has
      // them: "Thu, Oct 16, 2:15 PM to 2:30 PM", "Thu, Oct 16, 6 AM to 8 AM".
      tipWhen() {
        const b = this.tipBar();
        if (!b) return '';
        const at = (t) => new Date(t).toLocaleTimeString([], new Date(t).getMinutes()
          ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
        try {
          return new Date(b.t0).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ', '
            + at(b.t0) + ' to ' + at(b.t1);
        } catch (e) { return ''; }
      },
      tipFig() {
        const b = this.tipBar();
        if (!b) return '';
        if (!b.calls) return 'no calls';
        const seen = b.hidden === 0 ? 'all in view' : b.hidden === b.calls ? 'all hidden'
          : (b.calls - b.hidden) + ' in view · ' + b.hidden + ' hidden';
        const bits = [b.calls + (b.calls === 1 ? ' call' : ' calls'), seen, T().fmtBytesShort(b.wire)];
        if (b.errors) bits.push(b.errors + ' failed');
        return bits.join(' · ');
      },
      // Who made the bar's calls, busiest first: a job by name, or the view
      // on screen.
      tipOwners() {
        const b = this.tipBar();
        return b ? Object.entries(b.by).map(([who, n]) => ({ who, n })).sort((x, y) => y.n - x.n) : [];
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
