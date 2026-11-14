// usage.js — the Usage tab of the app's Activity row: where token spending
// goes across every recorded session, as five readings behind five pills.
//
// web-tools-private keeps one usage extract per session,
// sessions/usage/YYYY/MM/<record name>.json (schema usage/1, written at every
// Stop by sessions/tools/usage.py): tokens and times, no dollars. This view
// lists that folder, three levels of listings that give each file's blob sha,
// reads each file as a blob by that sha, and folds them with
// kits/usage-readings.js, which prices them from kits/session-usage.js's
// table. A read file is kept in this browser's IndexedDB under its sha
// (kits/persistence.js, the collection usage.extracts), so a later visit reads
// the listing and the files that changed.
//
// Mounted by estate.js as x-data="usage(cfg)":
//
//   cfg.label(short)          the session's title, from the sessions index, or ''
//   cfg.sessionHref(short)    the session's address in the app
//   cfg.compactionHref(name)  a compaction summary's address
//   cfg.openCompaction(name)  open that summary in the Compactions tab
//   cfg.shown()               whether this tab is the one on screen
//
// A row is one line. Where it has a bar, the bar is short and inline, on one
// scale down its list, and the row ends in the bar and a dollar figure, so a
// figure keeps its place from reading to reading.
//
//   Spend        one stacked bar of the four things the money goes on, then a
//                row per session: its day, its name, the same four as a bar,
//                its dollars. A pane of 48rem also has its prompts and its
//                idle re-loads; a narrower one gives them in the bar's tip.
//   Calls        a row per bin of calls per prompt: two bars on one scale, the
//                share of prompts, outlined, over the share of calls, filled,
//                then each share and count.
//   Re-loads     a row per thing that ended an idle gap: how many re-loads,
//                the median gap, and the dollars they wrote as its bar.
//   Continue     a row per session: how long idle, its name, its context's
//                size, and what the next message would cost as its bar,
//                orange where the cache has lapsed; where it is warm, grey,
//                with the bar it becomes in outline and the minutes left.
//   Compactions  a dot per compaction over the break-even curve, then a row
//                per compaction, of two lines in a narrow pane.
//
// NOTHING IN THE PANE MOVES THE READER UNLESS THEY ASKED TO LEAVE. A tap on a
// row, a bar or a dot marks it, and what else on the pane is the same thing,
// where it stands: a bar's part with its legend entry and the bars in its
// tone, a compaction's row with its dot. A tapped dot also gives its row's
// figures in a title-tip, at the dot, and the list does not scroll to the row.
// The one way out of a row is the small arrow after its name (OUT): a link
// to the session's Cost tab, the session, or the compaction's summary. The
// five pills keep their places: under a 42rem pane each is its icon alone, in
// five equal columns, and the open reading's name stands beside them; nothing
// in the strip scrolls. What arrives later has its room kept (rule 15): the
// reading line shows the progress and then the count in one slot, and the
// scatter's host is as tall as the chart before the chart is drawn.
//
// A hue means one thing on every pane and on the session's own chart
// (UsageChart.hues): blue is reading the context, orange an idle re-load, and
// grey is the rest of the spend. Calls is about neither, so it takes no hue:
// its two bars are the text colour, one filled and one outlined. An estimated
// figure (kits/usage-readings.js) leads with "≈", and "→" stands between
// a before and an after.
//
// The scatter's fill- and stroke- classes on theme colours compile because the
// app boots through lib/gh-boot.js, which registers the theme colours with
// Tailwind.
(() => {
  const ROOT = 'sessions/usage';
  const CACHE = 'usage.extracts';
  const READS = 8;
  const esc = (s) => window.esc(String(s ?? ''));
  // The extracts in hand, by record name: { sha, data }. Outside Alpine: two
  // hundred objects nothing on the page reacts to.
  const EXTRACTS = new Map();

  // A pill's tip is its name and what the reading is of: under a 42rem pane
  // the pill is its icon alone.
  const PANES = [
    { key: 'spend', label: 'Spend', icon: 'ph-coins', tip: 'Spend: four parts, in all and per session' },
    { key: 'calls', label: 'Calls', icon: 'ph-repeat', tip: 'Calls: model calls per prompt' },
    { key: 'reloads', label: 'Re-loads', icon: 'ph-hourglass', tip: 'Re-loads: idle re-loads by what ended the gap' },
    { key: 'continue', label: 'Continue', icon: 'ph-play', tip: 'Continue: what the next message to each session costs now' },
    { key: 'compactions', label: 'Compactions', icon: 'ph-arrows-in-line-vertical', tip: 'Compactions: what each cost against what it saved' },
  ];
  // A label is one word, the same word on every reading, and its tip says
  // the rest.
  const PARTS = [
    { key: 'read', label: 'Reads', tip: 'Context reads: each model call reads the whole context from the cache' },
    { key: 'reload', label: 'Re-loads', tip: 'Idle re-loads: a call after > 1 h idle rewrites the whole context to the cache' },
    { key: 'write', label: 'Writes', tip: 'Other cache writes: what each call adds to the cache + the first write after a compaction' },
    { key: 'output', label: 'Output', tip: 'What the model wrote' },
  ];
  const ENDERS = {
    owner: ['Owner', 'A prompt the owner typed'],
    session: ['Session', 'A message from another Claude session, or its handback'],
    pr: ['PR', 'GitHub activity on a watched pull request'],
    task: ['Task', 'A background command or agent that finished'],
    schedule: ['Schedule', 'A scheduled trigger'],
    agent: ['Subagent', 'A subagent handing back'],
    restart: ['Restart', 'The session restarted or resumed'],
    other: ['Other', 'Anything else, or nothing recorded in the gap'],
    unlisted: ['Unlisted', 'Counted before re-loads were listed one by one'],
  };
  const TIPS = {
    prices: 'API list prices for these tokens, not what a subscription bills',
    saved: 'In context reads: each later call reads the smaller context',
    prompts: 'Prompts the owner typed that the model answered',
    calls: 'Model calls: each request a session made of the model',
    gap: 'Median idle gap before the re-load',
  };

  // A ROW IS ONE LINE, and it ends in the same two columns on every reading,
  // a bar and a dollar figure, so a figure keeps its place from reading to
  // reading. The bar is short and inline, in a faint track that is the list's
  // one scale: the dearest row fills it. What a wider pane has room for goes
  // between the name and the bar.
  const GRID = 'grid min-w-0 items-center gap-x-2 @2xl:gap-x-3';
  const LINE = 'border-b border-base-200 py-1.5';
  // A list's head row: its columns named once, so a row carries figures alone.
  const HEAD = 'border-b border-base-200 py-1 text-xs text-base-content/60';
  // Spend: the day, the session and its way out; from 48rem its prompts and
  // its idle re-loads; the bar; the figure.
  const SPEND = GRID + ' grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_3.75rem] @2xl:grid-cols-[3rem_minmax(0,1fr)_8rem_5.5rem] @3xl:grid-cols-[3rem_minmax(0,1fr)_7rem_6.5rem_8rem_5.5rem]';
  // Continue: how long idle, the session with its context's size; the bar;
  // the figure. A warm session's minutes left go under its row, or before
  // the bar from 42rem, where every row keeps that room.
  const CONT = GRID + ' grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.75rem] @2xl:grid-cols-[3rem_minmax(0,1fr)_9rem_8rem_5.5rem]';
  // Re-loads: what ended the gap, how many times, the median gap; the bar;
  // the figure.
  const ENDS = GRID + ' grid-cols-[minmax(0,1fr)_3.25rem_3.75rem_3.5rem_3.75rem] @2xl:grid-cols-[minmax(0,1fr)_5rem_6rem_8rem_5.5rem]';
  // Calls: the bin, its two bars one over the other, then a share and a count
  // for the prompts and the same for the calls. The bars have what a narrow
  // pane leaves them, and no more than 24rem of a wide one.
  const BINS = GRID + ' grid-cols-[3.5rem_minmax(0,1fr)_2.5rem_2.75rem_2.5rem_3.5rem] @2xl:grid-cols-[3.5rem_minmax(0,24rem)_3.5rem_4.5rem_3.5rem_4.5rem]';
  const WHEN = 'font-mono text-xs tabular-nums text-base-content/60';
  const FACT = 'hidden whitespace-nowrap text-right text-base tabular-nums text-base-content/60 @3xl:block';
  const BAR = 'flex h-2.5 min-w-0 overflow-hidden rounded-sm bg-base-200/70';
  // A figure wider than its column runs left over the gap, never off the pane.
  const FIG = 'justify-self-end whitespace-nowrap text-right text-base tabular-nums';
  // A row a tap marks where it stands. A marked row drops its hover tint, or
  // the tint would hide the mark from the pointer that made it.
  const TAPS = 'cursor-pointer';
  const HOVER = 'hover:bg-base-200/60';
  const MARKED = 'bg-primary/10';
  // A row's way out, the one part of it that leaves the pane: a small arrow
  // after the name, as a session's brief writes "Open session" before one
  // (alpineComponents/session-brief.js). Its padding is the tap's room and
  // adds nothing to the row's height.
  const OUT = '-m-1.5 flex shrink-0 self-center rounded p-1.5 text-base leading-none text-base-content/50 hover:text-primary';
  const out = (href, tap, tip) => `<a :href="${href}" @click="${tap}" data-usage-out aria-label="${tip}" data-title-tip="${tip}" class="${OUT}"><i class="ph ph-arrow-up-right"></i></a>`;
  // A compaction's row has no bar: the chart over the list is its picture.
  // Wide, six columns: when, whose, the context before and after, the calls
  // that followed, the cost, the saving. Narrow, the calls sit at the end of
  // the first line and the other three figures under it.
  const COMP = 'grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-2 @2xl:grid-cols-[3rem_minmax(0,1fr)_8.5rem_5.5rem_6rem_7.5rem] @2xl:gap-x-3';
  // The scatter's plot is 170 tall under a 520px pane and 200 from there, with
  // 30 above it and 36 for the axis under it. HOLD is that height on the host,
  // so the rows under the chart are in place before it is drawn.
  const PLOT = { narrow: 170, wide: 200, at: 520, frame: 66 };
  const HOLD = 'min-h-[236px] @min-[520px]:min-h-[266px]';
  // Calls per prompt takes no hue of the spend's: both bars are the text
  // colour, the calls filled and the prompts outlined.
  const INK = { prompts: 'border border-base-content/60', calls: 'bg-base-content/60' };
  const CHIP = 'shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 max-sm:px-2 max-sm:py-0.5 text-sm font-medium transition-colors';

  const count = (n) => Math.round(n).toLocaleString('en-US');
  // A day (YYYY-MM-DD) or a time as a short date, the day as written and the
  // time in the reader's zone.
  const dayOf = (iso) => {
    const bare = /^\d{4}-\d{2}-\d{2}$/.test(iso || '');
    const t = new Date(bare ? iso + 'T12:00:00Z' : iso);
    return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString([], { month: 'short', day: 'numeric', ...(bare ? { timeZone: 'UTC' } : {}) });
  };

  // The compactions as a scatter, a string like kits/usage-chart.js's chart
  // and for its reasons: the context before each across, the calls that
  // followed it up on a log scale that still has a zero, and the break-even
  // curve of the typical compaction dashed across, the ground under it tinted.
  // A dot is named by data-usage-dot (the summary's name) and gives its row's
  // figures in a title-tip, under the session's name (o.name, cut short: a
  // title-tip does not scroll); the rows under the chart are the keyboard's
  // way to each. A dot in focus is ringed by the chart's own mark, as one
  // pointed at is, so it draws no outline box of its own.
  const brief = (s, n = 48) => { const cs = [...s]; return cs.length > n ? cs.slice(0, n - 1).join('').trimEnd() + '…' : s; };
  function scatter(c, W, o = {}) {
    const C = window.UsageChart, R = window.UsageReadings;
    const hue = C.hues(o.dark);
    const L = 40, RP = 10, T = 30, PH = o.ph || PLOT.narrow, FOOT = T + PH, H = FOOT + 36, FS = 12;
    const rows = c.rows.filter((x) => x.before != null && x.calls != null);
    const xMax = Math.max(250000, Math.ceil(Math.max(0, ...rows.map((x) => x.before)) / 250000) * 250000);
    const decades = Math.max(2, Math.ceil(Math.log10(1 + Math.max(0, ...rows.map((x) => x.calls)))));
    const pw = W - L - RP;
    const f = (v) => Math.round(v * 10) / 10;
    const X = (v) => L + (v / xMax) * pw;
    const Y = (v) => FOOT - (Math.log10(1 + v) / decades) * PH;
    const ink = 'fill="currentColor"';
    const S = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="block select-none" font-size="${FS}" role="img" aria-label="Each compaction: the context before it and the calls that followed">`];
    S.push(`<text x="0" y="12" ${ink} fill-opacity=".7">calls after</text>`);
    for (let d = 0; d <= decades; d++) {
      const v = 10 ** d, y = f(Y(v));
      S.push(`<line x1="${L}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/>`
        + `<text x="${L - 6}" y="${f(y + 4)}" text-anchor="end" ${ink} fill-opacity=".55">${v.toLocaleString('en-US')}</text>`);
    }
    S.push(`<line x1="${L}" x2="${W - RP}" y1="${FOOT}" y2="${FOOT}" stroke="currentColor" stroke-opacity=".3"/>`);
    const step = pw / (xMax / 250000) >= 56 ? 250000 : 500000;
    for (let v = 0; v <= xMax; v += step) {
      S.push(`<text x="${f(X(v))}" y="${FOOT + 14}" text-anchor="${v ? (v >= xMax ? 'end' : 'middle') : 'start'}" ${ink} fill-opacity=".55">${C.tok(v)}</text>`);
    }
    S.push(`<text x="${W - RP}" y="${FOOT + 30}" text-anchor="end" ${ink} fill-opacity=".7">context before</text>`);
    // Break-even: under the curve a compaction has not yet paid for itself.
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const x = (xMax * i) / 80, y = R.breakEven(x, c.typical);
      if (y != null && y <= 10 ** decades) pts.push([f(X(x)), f(Y(y))]);
    }
    if (pts.length > 1) {
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
      S.push(`<path data-usage-even-ground d="${line} L${pts[pts.length - 1][0]},${FOOT} L${pts[0][0]},${FOOT} Z" fill="currentColor" fill-opacity=".06"/>`
        + `<path data-usage-even d="${line}" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="4 3"/>`);
      // Its name sits over its right-hand end, above the curve along the
      // whole of its own length: the curve falls to the right.
      const end = pts[pts.length - 1], NAME = '≈ break-even', span = NAME.length * FS * 0.54;
      const over = Math.min(...pts.filter((q) => q[0] >= end[0] - span).map((q) => q[1]));
      S.push(`<text data-usage-even-name x="${end[0]}" y="${f(over - 6)}" text-anchor="end" ${ink} fill-opacity=".7">${NAME}</text>`);
    }
    const dot = (x) => {
      const cx = f(X(x.before)), cy = f(Y(x.calls));
      const tip = [dayOf(x.at), C.tok(x.before) + ' → ' + (x.after != null ? C.tok(x.after) : '?'), C.plural(x.calls, 'call'),
                   x.cost != null ? 'cost ≈ ' + C.money(x.cost) : '', x.saved != null ? 'saved ' + C.money(x.saved) : ''].filter(Boolean).join(' · ');
      const who = brief(String((o.name ? o.name(x) : '') || x.ask || x.short || ''));
      return `<g data-usage-dot="${esc(x.name)}" data-title-tip="${esc(tip)}" data-title-tip-lead="${esc(who)}" data-title-tip-bare class="cursor-pointer outline-none">`
        + `<circle cx="${cx}" cy="${cy}" r="9" fill="transparent"/>`
        + (x.paid
          ? `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${hue.a}" fill-opacity=".5"/>`
          : `<circle cx="${cx}" cy="${cy}" r="3.5" class="fill-base-100" stroke="currentColor" stroke-opacity=".8" stroke-width="1.5"/>`)
        + '</g>';
    };
    // Filled where it paid for itself. The hollow ones, which have not, are
    // drawn last, on top.
    for (const x of rows.filter((x) => x.paid)) S.push(dot(x));
    for (const x of rows.filter((x) => !x.paid)) S.push(dot(x));
    S.push(`<circle data-usage-mark r="6.5" cx="0" cy="0" fill="${hue.a}" class="stroke-base-100" stroke-width="2" visibility="hidden" pointer-events="none"/>`);
    S.push('</svg>');
    return S.join('');
  }

  // For the suite: the drawing and the vocabulary, without a page.
  window.Usage = { scatter, day: dayOf, PANES, PARTS, ENDERS, TIPS, EXTRACTS, ROOT, PLOT, HOLD };

  document.addEventListener('alpine:init', () => Alpine.data('usage', (cfg = null) => ({
    description: 'Usage: where token spending goes across every recorded session, read from the session store\'s usage extracts. Five readings behind five pills: the spend split four ways and per session, model calls per prompt, idle re-loads by what ended the gap, what the next message to each session would cost now, and what each compaction cost against what it saved.',
    cfg,
    loading: true, error: '', done: 0, of: 0, missed: 0,
    pane: 'spend', scope: 'all', r: null, readAt: 0, dark: false,
    get store() { return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
    get token() { return window.TOKEN || window.ghAuth?.resolve() || ''; },

    template: `
      <div class="@container flex min-w-0 flex-col gap-3" data-usage>
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <div class="grid shrink-0 grid-cols-5 gap-0.5 rounded-lg bg-base-200/60 p-0.5 @2xl:flex" role="tablist" aria-label="Usage readings" data-slot="frame:subtabs">
            ${PANES.map((p) => `
            <button type="button" role="tab" data-at="usage-tab-${p.key}" @click="show('${p.key}')" :aria-selected="pane === '${p.key}'"
                    aria-label="${p.label}" data-title-tip="${p.tip}"
                    class="flex h-9 w-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-base font-medium transition-colors @2xl:w-auto @2xl:px-3"
                    :class="pane === '${p.key}' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
              <i class="ph ${p.icon} text-lg"></i><span class="hidden @2xl:inline">${p.label}</span></button>`).join('')}
          </div>
          <span class="w-28 shrink-0 truncate text-base font-medium @2xl:hidden" data-usage-open aria-hidden="true" x-text="paneLabel"></span>
          <div x-show="r || loading" class="ml-auto flex min-h-8 min-w-0 items-center gap-x-2 text-sm text-base-content/60" data-usage-line>
            <span class="flex min-w-0 items-center justify-end @2xl:min-w-60">
              <span x-show="loading && !r" class="flex min-w-0 items-center gap-2" role="status">
                <span class="loading loading-spinner loading-xs shrink-0"></span>
                <span class="truncate tabular-nums" x-text="progress"></span>
              </span>
              <a x-show="r" :href="sourceHref" target="_blank" rel="noopener" data-usage-source data-title-tip="The usage files on GitHub" data-title-tip-bare
                 class="flex min-w-0 items-center gap-1 hover:text-primary">
                <i class="ph ph-github-logo shrink-0 text-base"></i><span class="truncate tabular-nums" x-text="span"></span></a>
            </span>
            <span class="shrink-0" data-title-tip="${TIPS.prices}">list prices</span>
            <button type="button" class="btn btn-ghost btn-sm btn-square shrink-0" @click="refresh()" :disabled="loading"
                    :data-title-tip="readNote" aria-label="Read the usage files again">
              <i class="ph ph-arrow-clockwise text-lg" :class="loading && 'animate-spin'"></i></button>
          </div>
        </div>

        <p x-show="!loading && !token" class="text-base text-base-content/60">
          Usage reads the private registry: add a token on Repos.</p>
        <div x-show="error" class="alert alert-error px-3 py-2">
          <i class="ph ph-warning-circle"></i><span x-text="error"></span>
        </div>
        <p x-show="missed" class="text-base text-warning" x-text="missed === 1 ? '1 file unread, left out' : missed + ' files unread, left out'"></p>

        <div x-show="r" data-pattern="figure" class="min-w-0">

          <section x-show="pane === 'spend'" data-at="usage-spend" data-at-open="usage-tab-spend" class="min-w-0">
            <template x-if="r && pane === 'spend'">
              <div class="flex min-w-0 flex-col gap-3" @pointerover="partOver($event)" @pointerleave="partLeave($event)" @click="partTap($event)">
                <div class="flex min-w-0 flex-col gap-2">
                  <div class="flex h-7 w-full overflow-hidden rounded-md" role="img" :aria-label="spendLabel" x-html="bar(r.spend.parts, r.spend.total)"></div>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 text-base @2xl:gap-x-6">
                    <template x-for="p in spendParts" :key="p.key">
                      <span class="flex items-baseline gap-1.5" :data-usage-part="p.key">
                        <span class="h-3 w-3 shrink-0 self-center rounded-sm" :class="tone[p.key]"></span>
                        <span :data-title-tip="p.tip" x-text="p.label"></span>
                        <span class="font-medium tabular-nums" x-text="money(p.cost)"></span>
                        <span class="tabular-nums text-base-content/60" x-text="pct(p.share)"></span>
                      </span>
                    </template>
                    <span class="flex items-baseline gap-1.5 text-base-content/60">
                      <span>total</span> <span class="font-medium tabular-nums text-base-content" x-text="money(r.spend.total)"></span>
                    </span>
                  </div>
                </div>
                <div class="flex min-w-0 flex-col border-t border-base-200" @click="rowTap($event)">
                  <template x-for="s in r.spend.rows" :key="s.id">
                    <div :data-usage-session="s.id" class="${SPEND} ${LINE} ${TAPS} ${HOVER}">
                      <span class="${WHEN}" x-text="day(s.day)"></span>
                      <span class="flex min-w-0 items-baseline gap-2">
                        <span class="min-w-0 truncate text-base" x-text="name(s)"></span>
                        ${out('costHref(s)', "openSession(s, $event, 'cost')", "Open the session's Cost tab")}
                      </span>
                      <span class="${FACT}" x-text="plural(prompts(s), 'prompt')"></span>
                      <span class="${FACT}" x-text="plural(reloads(s), 're-load')"></span>
                      <span class="${BAR}" :data-title-tip="spendTip(s)" data-title-tip-bare x-html="bar(s.parts, r.spend.max)"></span>
                      <span class="${FIG}" x-text="money(s.cost)"></span>
                    </div>
                  </template>
                </div>
                <p x-show="r.spend.unpriced.length" class="text-base text-base-content/60" x-text="unpricedNote"></p>
              </div>
            </template>
          </section>

          <section x-show="pane === 'calls'" data-at="usage-calls" data-at-open="usage-tab-calls" class="min-w-0">
            <template x-if="r && pane === 'calls'">
              <div class="flex min-w-0 flex-col gap-3" @pointerover="partOver($event)" @pointerleave="partLeave($event)" @click="partTap($event)">
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-base @2xl:gap-x-6">
                  <span class="flex items-baseline gap-1.5" data-usage-part="prompts">
                    <span class="h-3 w-3 shrink-0 self-center rounded-sm ${INK.prompts}"></span>
                    <span class="font-medium tabular-nums" x-text="count(r.calls.prompts)"></span> <span data-title-tip="${TIPS.prompts}">prompts</span>
                  </span>
                  <span class="flex items-baseline gap-1.5" data-usage-part="calls">
                    <span class="h-3 w-3 shrink-0 self-center rounded-sm ${INK.calls}"></span>
                    <span class="font-medium tabular-nums" x-text="count(r.calls.calls)"></span> <span data-title-tip="${TIPS.calls}">calls</span>
                  </span>
                  <span class="tabular-nums text-base-content/60" x-text="callsNote"></span>
                </div>
                <div class="flex min-w-0 flex-col border-t border-base-200">
                  <div class="${BINS} ${HEAD}">
                    <span class="col-span-2">calls / prompt</span> <span class="col-span-2 text-right">prompts</span> <span class="col-span-2 text-right">calls</span>
                  </div>
                  <template x-for="b in r.calls.bins" :key="b.lo">
                    <div class="${BINS} ${LINE} text-base" :data-usage-bin="b.lo">
                      <span class="whitespace-nowrap font-medium tabular-nums" x-text="bin(b)"></span>
                      <span class="flex min-w-0 flex-col gap-0.5">
                        <span class="h-1.5"><span class="block h-full rounded-sm ${INK.prompts}" data-usage-part="prompts" x-show="b.prompts" :style="'width:' + width(b.promptShare, r.calls.max) + '%'"></span></span>
                        <span class="h-1.5"><span class="block h-full rounded-sm ${INK.calls}" data-usage-part="calls" x-show="b.calls" :style="'width:' + width(b.callShare, r.calls.max) + '%'"></span></span>
                      </span>
                      <span class="text-right tabular-nums" x-text="pct(b.promptShare)"></span>
                      <span class="text-right tabular-nums text-base-content/60" x-text="tally(b.prompts)"></span>
                      <span class="text-right tabular-nums" x-text="pct(b.callShare)"></span>
                      <span class="text-right tabular-nums text-base-content/60" x-text="tally(b.calls)"></span>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </section>

          <section x-show="pane === 'reloads'" data-at="usage-reloads" data-at-open="usage-tab-reloads" class="min-w-0">
            <template x-if="r && pane === 'reloads'">
              <div class="flex min-w-0 flex-col gap-3">
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-base @2xl:gap-x-6">
                  <span class="flex items-baseline gap-1.5">
                    <span class="h-3 w-3 shrink-0 self-center rounded-sm" :class="tone.reload"></span>
                    <span class="font-medium tabular-nums" x-text="count(r.reloads.n)"></span>
                    <span data-title-tip="${PARTS[1].tip}">re-loads</span>
                    <span class="font-medium tabular-nums" x-text="money(r.reloads.cost)"></span>
                  </span>
                </div>
                <p x-show="!r.reloads.rows.length" class="text-base text-base-content/60">No re-loads.</p>
                <div x-show="r.reloads.rows.length" class="flex min-w-0 flex-col border-t border-base-200">
                  <div class="${ENDS} ${HEAD}">
                    <span>ended by</span> <span class="text-right">re-loads</span> <span class="text-right" data-title-tip="${TIPS.gap}">gap</span> <span></span> <span></span>
                  </div>
                  <template x-for="e in r.reloads.rows" :key="e.ender">
                    <div class="${ENDS} ${LINE}" :data-usage-ender="e.ender">
                      <span class="min-w-0 truncate text-base"><span :data-title-tip="ender(e)[1]" x-text="ender(e)[0]"></span></span>
                      <span class="text-right text-base tabular-nums" x-text="count(e.n)"></span>
                      <span class="whitespace-nowrap text-right text-base tabular-nums text-base-content/60" x-text="e.gap == null ? '' : gap(e.gap)"></span>
                      <span class="${BAR}"><span class="h-full rounded-sm" :class="tone.reload" :style="'width:' + width(e.cost, r.reloads.max) + '%'"></span></span>
                      <span class="${FIG}" x-text="money(e.cost)"></span>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </section>

          <section x-show="pane === 'continue'" data-at="usage-continue" data-at-open="usage-tab-continue" class="min-w-0">
            <template x-if="r && pane === 'continue'">
              <div class="flex min-w-0 flex-col gap-3">
                <div class="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5" data-slot="frame:count-chips">
                  <template x-for="c in scopes" :key="c.key">
                    <button type="button" @click="scope = c.key" class="${CHIP}" :data-title-tip="c.tip"
                            :class="scope === c.key ? 'bg-primary/10 text-primary' : 'bg-base-200/60 text-base-content/60 hover:text-base-content'">
                      <span class="h-2.5 w-2.5 rounded-sm" x-show="c.tone" :class="c.tone"></span>
                      <span x-text="c.label"></span> <span class="font-mono tabular-nums opacity-60" x-text="c.n"></span></button>
                  </template>
                </div>
                <p x-show="!continueRows.length" class="text-base text-base-content/60" x-text="scope === 'warm' ? 'No warm session.' : 'No session.'"></p>
                <div class="flex min-w-0 flex-col border-t border-base-200" @click="rowTap($event)">
                  <template x-for="s in continueRows" :key="s.id">
                    <div :data-usage-session="s.id" class="${CONT} ${LINE} ${TAPS} ${HOVER}">
                      <span class="${WHEN}" x-text="ago(s.continue.t)"></span>
                      <span class="flex min-w-0 items-baseline gap-2">
                        <span class="min-w-0 truncate text-base" x-text="name(s)"></span>
                        ${out('sessionHref(s)', 'openSession(s, $event)', 'Open the session')}
                        <span class="${WHEN} ml-auto shrink-0" x-text="tok(s.continue.context)"></span>
                      </span>
                      <span class="${BAR} @2xl:col-start-4" x-html="continueBar(s)"></span>
                      <span class="${FIG} @2xl:col-start-5" :class="s.continue.cost == null && 'text-base-content/50'" x-text="s.continue.cost == null ? 'no price' : money(s.continue.cost)"></span>
                      <template x-if="warm(s)">
                        <span class="col-span-full whitespace-nowrap text-right text-base tabular-nums text-base-content/70 @2xl:col-span-1 @2xl:col-start-3 @2xl:row-start-1" data-usage-ahead x-text="ahead(s)"></span>
                      </template>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </section>

          <section x-show="pane === 'compactions'" data-at="usage-compactions" data-at-open="usage-tab-compactions" class="min-w-0">
            <template x-if="r && pane === 'compactions'">
              <div class="flex min-w-0 flex-col gap-3">
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-base @2xl:gap-x-6">
                  <span class="flex items-baseline gap-1.5">
                    <span class="font-medium tabular-nums" x-text="count(r.compactions.n)"></span> <span>compactions ≈</span>
                    <span class="font-medium tabular-nums" x-text="money(r.compactions.cost)"></span>
                  </span>
                  <span class="flex items-baseline gap-1.5">
                    <span class="h-3 w-3 shrink-0 self-center rounded-full" :class="tone.read"></span>
                    <span data-title-tip="${TIPS.saved}">saved</span> <span class="font-medium tabular-nums" x-text="money(r.compactions.saved)"></span>
                  </span>
                  <span class="tabular-nums text-base-content/60" x-text="evenNote"></span>
                </div>
                <p x-show="!r.compactions.n" class="text-base text-base-content/60">No compactions.</p>
                <div x-show="r.compactions.n" data-usage-scatter class="${HOLD} w-full min-w-0 text-base-content"
                     x-effect="drawScatter($el, r, dark)"
                     @pointerover="dotOver($event)" @focusin="dotOver($event)" @pointerleave="unhover()" @click="dotTap($event)"></div>
                <div class="flex min-w-0 flex-col border-t border-base-200" x-ref="comps"
                     @pointerover="rowOver($event)" @focusin="rowOver($event)" @pointerleave="unhover()" @click="compTap($event)">
                  <template x-for="c in r.compactions.rows" :key="c.name">
                    <div :data-usage-compaction="c.name" class="${COMP} ${LINE} ${TAPS} ${HOVER}">
                      <span class="${WHEN}" x-text="day(c.at)"></span>
                      <span class="flex min-w-0 items-baseline gap-2">
                        <span class="min-w-0 truncate text-base" x-text="name(c)"></span>
                        ${out('compactionHref(c)', 'openCompaction(c, $event)', 'Open the summary')}
                      </span>
                      <span class="text-right text-base tabular-nums @2xl:order-2"><span x-text="c.calls == null ? '' : count(c.calls)"></span><span class="text-base-content/60" x-text="c.calls == null ? '' : (c.calls === 1 ? ' call' : ' calls')"></span></span>
                      <span class="col-span-3 grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem] items-baseline gap-x-2 text-base tabular-nums @2xl:contents">
                        <span class="@2xl:order-1 @2xl:text-right" x-text="tok(c.before) + ' → ' + tok(c.after)"></span>
                        <span class="text-right @2xl:order-3" :data-title-tip="evenTip(c)"><span class="text-base-content/60" x-text="c.cost == null ? '' : '≈ '"></span><span x-text="c.cost == null ? 'no price' : money(c.cost)"></span></span>
                        <span class="text-right @2xl:order-4"><span class="font-medium" x-text="c.saved == null ? '' : money(c.saved)"></span><span class="text-base-content/60" x-text="c.saved == null ? '' : ' saved'"></span></span>
                      </span>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </section>

        </div>
      </div>`,

    init() {
      this.$el.innerHTML = this.template;
      this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      // The bars take the chart's hues, which differ on a dark page.
      this._theme = window.MutationObserver ? new MutationObserver(() => this.readTheme()) : null;
      this._theme?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      // What the next message costs moves with the clock.
      this._clock = setInterval(() => {
        if (this.$el.isConnected && this.r && this.pane === 'continue' && this.cfg?.shown?.() !== false) this.refold();
      }, 60000);
      // A reader coming back to the tab gets the store as it is now.
      if (this.cfg?.shown) this.$watch(() => this.cfg.shown(), (on) => {
        if (on && this.readAt && Date.now() - this.readAt > 60000) this.refresh();
      });
      this.start();
    },
    destroy() {
      clearInterval(this._clock);
      this._theme?.disconnect();
      this._size?.disconnect();
      this._theme = this._size = null;
    },

    async deps() {
      if (!window.TitleTip) await gh.load('kits/title-tip.js');
      if (!window.SessionUsage) await gh.load('kits/session-usage.js');
      if (!window.UsageChart) await gh.load('kits/usage-chart.js');
      if (!window.UsageReadings) await gh.load('kits/usage-readings.js');
    },
    readTheme() {
      const dark = !!window.UsageChart?.dark(this.$el);
      if (dark !== this.dark) this.dark = dark;
    },

    async start() {
      try {
        await this.deps();
        this.readTheme();
        if (!this.token) return;
        this.gh = this.gh || new GH({ token: this.token, repo: this.store, ref: 'main' });
        await this.read();
      } catch (e) {
        this.error = ROOT + ': ' + (e?.message || e);
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      if (this.loading) return;
      this.loading = true; this.error = '';
      await this.start();
    },

    // Years, then months, then each month's files: the listings are the
    // index, and give each file's blob sha.
    async list() {
      const dirs = (xs) => xs.filter((x) => x.type === 'dir' && /^\d+$/.test(x.name)).map((x) => x.path);
      const years = dirs(await this.gh.ls(ROOT));
      const months = (await Promise.all(years.map((y) => this.gh.ls(y)))).flatMap(dirs);
      const files = (await Promise.all(months.map((m) => this.gh.ls(m)))).flat();
      return files.filter((f) => f.type === 'file' && f.name.endsWith('.json') && f.sha)
        .map((f) => ({ name: f.name.slice(0, -5), sha: f.sha }));
    },
    // This browser's copies, by record name. No store, a blocked one or a
    // slow one reads as none kept, and every file is then read from GitHub.
    async kept() {
      try {
        const all = window.persistence.collection(CACHE).all();
        const rows = await Promise.race([all, new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
        return new Map(rows.filter((x) => x && x.id && x.sha && x.data).map((x) => [x.id, x]));
      } catch { return new Map(); }
    },
    keep(name, sha, data) {
      try { window.persistence.collection(CACHE).put({ id: name, sha, data }).catch(() => {}); } catch {}
    },
    drop(name) {
      try { window.persistence.collection(CACHE).delete(name).catch(() => {}); } catch {}
    },
    // A blob by its sha: an address whose content cannot change.
    async blob(sha) {
      const b = await this.gh.req('git/blobs/' + sha);
      return JSON.parse(window.GH.decode(b.content));
    },

    async read() {
      const files = await this.list();
      const stale = files.filter((f) => EXTRACTS.get(f.name)?.sha !== f.sha);
      const kept = stale.length ? await this.kept() : new Map();
      const want = [];
      for (const f of stale) {
        const hit = kept.get(f.name);
        if (hit && hit.sha === f.sha) EXTRACTS.set(f.name, { sha: f.sha, data: hit.data });
        else want.push(f);
      }
      this.of = want.length; this.done = 0; this.missed = 0;
      let next = 0;
      const worker = async () => {
        while (next < want.length) {
          const f = want[next++];
          try {
            const data = await this.blob(f.sha);
            EXTRACTS.set(f.name, { sha: f.sha, data });
            this.keep(f.name, f.sha, data);
          } catch (e) {
            // A failed listing fails the view; one failed file is left out.
            if (e?.status === 401 || e?.status === 403) throw e;
            this.missed++;
          }
          this.done++;
        }
      };
      await Promise.all(Array.from({ length: Math.min(READS, want.length) }, worker));
      // A file the store no longer lists is no longer a session's usage.
      const listed = new Set(files.map((f) => f.name));
      for (const name of [...EXTRACTS.keys()]) if (!listed.has(name)) { EXTRACTS.delete(name); this.drop(name); }
      for (const name of kept.keys()) if (!listed.has(name)) this.drop(name);
      this.readAt = Date.now();
      this.refold();
    },
    // Nothing on the page reacts inside a reading, so it is handed over
    // frozen: Alpine wraps the one property, not five hundred rows.
    refold() {
      this._part = '';
      this.markPart(this.$el, '');
      this.r = Object.freeze(window.UsageReadings.fold([...EXTRACTS.values()].map((x) => x.data), { now: Date.now() }));
    },
    // A pill changes the reading and nothing else: no pill moves, and the
    // marks of the reading that closed go with it.
    show(key) {
      this.pane = key;
      this._part = this._pick = '';
      if (key === 'continue' && this.r && Date.now() - this.r.now > 30000) this.refold();
    },

    // ── Words and figures ────────────────────────────────────────────────
    money(v) { return window.UsageChart.money(v); },
    tok(v) { return v == null ? '?' : window.UsageChart.tok(v); },
    count,
    // A bin's count, short from a hundred thousand: its column is six characters.
    tally(n) { return n >= 1e5 ? Math.round(n / 1000) + 'k' : count(n); },
    plural(n, noun) { return window.UsageChart.plural(n, noun); },
    day: dayOf,
    pct(v) { const x = v * 100; return (x >= 9.95 || x === 0 ? Math.round(x) : x.toFixed(1)) + '%'; },
    width(v, max) { return max > 0 ? Math.max(0, Math.min(100, (100 * v) / max)).toFixed(2) : 0; },
    bin(b) { return b.hi === b.lo ? String(b.lo) : Number.isFinite(b.hi) ? b.lo + '-' + b.hi : b.lo + '+'; },
    ago(t) {
      const m = Math.max(0, (this.r.now - t) / 60000);
      return m < 60 ? Math.round(m) + 'm' : m < 2880 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd';
    },
    gap(ms) {
      const h = ms / 3600000;
      return h < 1 ? Math.round(ms / 60000) + ' min' : h < 48 ? +h.toFixed(1) + ' h' : +(h / 24).toFixed(1) + ' d';
    },
    // A session by the title the sessions index gives it, else what it was
    // first asked, else its short id.
    name(s) { return (this.cfg?.label?.(s.short) || '').trim() || s.ask || s.short; },
    ender(e) { return ENDERS[e.ender] || ENDERS.other; },
    // What a session's row says of it beside its money: the prompts that
    // drew a model call, as Calls counts them, and its idle re-loads.
    prompts(s) { return s.steps.filter((n) => n > 0).length; },
    reloads(s) { return s.unlisted ? s.unlisted.n : s.reloads.length; },
    // A session's bar is too short to read a part's dollars from, so its
    // title-tip gives the four, and the two counts a narrow pane has no column for.
    spendTip(s) {
      return [...PARTS.map((p) => p.label + ' ' + this.money(s.parts[p.key])),
              this.plural(this.prompts(s), 'prompt'), this.plural(this.reloads(s), 're-load')].join(' · ');
    },
    get tone() {
      const h = window.UsageChart.hues(this.dark);
      return { read: 'bg-[' + h.a + ']', reload: 'bg-[' + h.b + ']', write: 'bg-base-content/40', output: 'bg-base-content/20',
               ahead: 'border-[' + h.b + ']' };
    },
    get paneLabel() { return PANES.find((p) => p.key === this.pane)?.label || ''; },
    // The first read, in the slot the count of sessions then takes. The count
    // so far is padded to the width of the total, so the line holds still.
    get progress() {
      if (!this.of) return 'Listing sessions';
      return 'Reading ' + String(this.done).padStart(String(this.of).length, '\u2007') + ' / ' + this.of + ' sessions';
    },
    get span() {
      const s = this.r?.spend;
      if (!s) return '';
      return window.UsageChart.plural(s.sessions, 'session') + (s.from ? ' · ' + dayOf(s.from) + ' → ' + dayOf(s.to) : '');
    },
    // The view's jump-over: the folder it reads, on GitHub.
    get sourceHref() { return window.RepoAddress.github.tree(this.store, 'main', ROOT); },
    get readNote() {
      return this.readAt ? 'Read ' + new Date(this.readAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '. Read again' : 'Read again';
    },
    get spendParts() {
      const s = this.r.spend;
      return PARTS.map((p) => ({ ...p, cost: s.parts[p.key], share: s.total ? s.parts[p.key] / s.total : 0 }));
    },
    get spendLabel() {
      return this.spendParts.map((p) => p.label + ' ' + this.money(p.cost)).join(', ');
    },
    get unpricedNote() {
      return 'No price: ' + this.r.spend.unpriced.map((u) => u.model + ' (' + window.UsageChart.plural(u.sessions, 'session') + ')').join(', ');
    },
    get callsNote() {
      const c = this.r.calls;
      if (!c.prompts) return '';
      return 'median ' + c.median + ' · mean ' + Math.round(c.mean) + ' / prompt' + (c.none ? ' · ' + c.none + ' with none' : '');
    },
    get evenNote() {
      const c = this.r.compactions;
      if (c.even == null) return '';
      return c.paid + ' / ' + c.judged + ' paid back · break-even ≈ ' + window.UsageChart.plural(Math.round(c.even), 'call');
    },
    evenTip(c) {
      if (c.cost == null) return 'No price for ' + (c.model || 'its model');
      return '≈ ' + this.money(c.summary) + ' summary + ' + this.money(c.first) + ' new context'
        + (c.even != null ? ' · paid back after ≈ ' + window.UsageChart.plural(Math.ceil(c.even), 'call') : '');
    },
    get scopes() {
      const c = this.r.continue;
      return [
        { key: 'all', label: 'All', n: c.rows.length, tone: '', tip: 'Every session with a context' },
        { key: 'warm', label: 'Warm', n: c.warm, tone: this.tone.write, tip: 'Last call < 1 h ago: the next message reads the cache' },
        { key: 'lapsed', label: 'Lapsed', n: c.lapsed, tone: this.tone.reload, tip: 'Idle > 1 h: the next message rewrites the whole context' },
      ];
    },
    get continueRows() {
      const rows = this.r.continue.rows;
      return this.scope === 'all' ? rows : rows.filter((s) => s.continue.lapsed === (this.scope === 'lapsed'));
    },
    // The scale of the Continue bars: the dearest next message, or the dearest
    // a warm session would become.
    get continueMax() {
      return Math.max(0, ...this.r.continue.rows.map((s) => Math.max(s.continue.cost || 0, s.continue.lapsed ? 0 : s.continue.cold || 0)));
    },

    // ── Bars, as strings: one binding a row ──────────────────────────────
    // The four parts of a spend on a scale of `max`.
    bar(parts, max) {
      const t = this.tone;
      return PARTS.map((p) => `<span class="h-full ${t[p.key]}" data-usage-part="${p.key}" style="width:${this.width(parts[p.key], max)}%"></span>`).join('');
    },
    // The next message, in the row's track: an orange bar where the cache has
    // lapsed; where it is warm, a grey one and then, in outline, the rest of
    // the bar it becomes.
    continueBar(s) {
      const c = s.continue, t = this.tone, max = this.continueMax;
      if (c.cost == null) return '';
      if (c.lapsed) return `<span class="h-full rounded-sm ${t.reload}" style="width:${this.width(c.cost, max)}%"></span>`;
      return `<span class="h-full min-w-0.5 shrink-0 rounded-sm ${t.write}" style="width:${this.width(c.cost, max)}%"></span>`
        + `<span class="h-full rounded-sm border border-dashed ${t.ahead}" style="width:${this.width(c.cold - c.cost, max)}%"></span>`;
    },
    // A warm session's row says what is ahead of it: the minutes its cache has
    // left, and what the next message costs after them.
    warm(s) { return s.continue.cost != null && !s.continue.lapsed; },
    ahead(s) { return Math.max(1, Math.round(s.continue.left / 60000)) + ' min → ' + this.money(s.continue.cold); },

    // ── A part and what is drawn in its tone ─────────────────────────────
    // A legend entry and the bars in its tone are one thing: pointing at any
    // of them fades every other part in the pane, and a tap on any of them, a
    // session's bar included, keeps the mark until the next tap.
    partOf(e) { return e.target instanceof Element ? e.target.closest('[data-usage-part]')?.getAttribute('data-usage-part') || '' : ''; },
    markPart(root, key) {
      for (const x of root.querySelectorAll('[data-usage-part]')) x.classList.toggle('opacity-25', !!key && x.getAttribute('data-usage-part') !== key);
    },
    partOver(e) { this.markPart(e.currentTarget, this.partOf(e) || this._part || ''); },
    partLeave(e) { this.markPart(e.currentTarget, this._part || ''); },
    partTap(e) {
      if (!(e.target instanceof Element) || e.target.closest('[data-usage-out]')) return;
      const key = this.partOf(e);
      // A tap on a row beside its bar is the row's (rowTap) and leaves the parts as they are.
      if (!key && e.target.closest('[data-usage-session]')) return;
      this._part = key && key !== this._part ? key : '';
      this.markPart(e.currentTarget, this._part);
    },

    // ── A row ────────────────────────────────────────────────────────────
    // A tap on a session's row marks the row where it stands, and a second
    // tap lets it go. It goes nowhere: the row's arrow is the way out, and a
    // tap on the row's bar is its part's (partTap).
    setMark(row, on) {
      row.toggleAttribute('data-usage-marked', on);
      row.classList.toggle(MARKED, on);
      row.classList.toggle(HOVER, !on);
    },
    rowTap(e) {
      const t = e.target instanceof Element ? e.target : null;
      const row = t?.closest('[data-usage-session]');
      if (!row || t.closest('[data-usage-out], [data-usage-part]')) return;
      const on = !row.hasAttribute('data-usage-marked');
      for (const x of e.currentTarget.querySelectorAll('[data-usage-marked]')) this.setMark(x, false);
      this.setMark(row, on);
    },

    // ── A row's way out ──────────────────────────────────────────────────
    sessionHref(s) { return this.cfg?.sessionHref?.(s.short) || '?view=sessions&session=' + encodeURIComponent(s.short); },
    costHref(s) { return this.sessionHref(s) + '&pane=cost'; },
    compactionHref(c) { return this.cfg?.compactionHref?.(c.name) || '?view=compactions&item=' + encodeURIComponent(c.name); },
    // The app opens the session's card, as its own session links do.
    openSession(s, e, pane) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('web-tools:open-session', { detail: { id: s.short, day: s.day, ...(pane ? { pane } : {}) } }));
    },
    openCompaction(c, e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || !this.cfg?.openCompaction) return;
      e.preventDefault();
      this.cfg.openCompaction(c.name);
    },

    // ── The compactions scatter ──────────────────────────────────────────
    // Drawn at the host's own width, and again when that, the readings or
    // the theme change. The host keeps the chart's height (HOLD), so the rows
    // under it do not move when the chart lands.
    drawScatter(host, r, dark) {
      if (!r || !host) return;
      if (!this._size && window.ResizeObserver) this._size = new ResizeObserver((es) => { for (const e of es) this.paintScatter(e.target); });
      if (host !== this._scatter) { this._scatter && this._size?.unobserve(this._scatter); this._scatter = host; this._size?.observe(host); }
      host._w = 0;
      requestAnimationFrame(() => this.paintScatter(host));
    },
    paintScatter(host) {
      if (!host.isConnected || !this.r) return;
      const w = Math.floor(host.clientWidth || 0);
      if (!w || (w === host._w && this.dark === host._dark)) return;
      host._w = w; host._dark = this.dark;
      host.innerHTML = scatter(this.r.compactions, w, { dark: this.dark, ph: w < PLOT.at ? PLOT.narrow : PLOT.wide, name: (c) => this.name(c) });
      // A new drawing has no mark: the tapped compaction's is put back.
      this._marked = null;
      this.markCompaction(this._pick || '');
    },
    // A dot and its row are one compaction: marking either marks both, where
    // each stands. Nothing here scrolls.
    markCompaction(name) {
      if (name === this._marked) return;
      this._marked = name;
      const host = this._scatter, list = this.$refs.comps;
      const mark = host?.querySelector('[data-usage-mark]');
      const dot = name ? [...(host?.querySelectorAll('[data-usage-dot]') || [])].find((d) => d.getAttribute('data-usage-dot') === name) : null;
      if (mark) {
        const c = dot?.querySelector('circle');
        if (c) { mark.setAttribute('cx', c.getAttribute('cx')); mark.setAttribute('cy', c.getAttribute('cy')); }
        mark.setAttribute('visibility', c ? 'visible' : 'hidden');
      }
      for (const row of list?.querySelectorAll('[data-usage-marked]') || []) this.setMark(row, false);
      const row = name ? [...(list?.querySelectorAll('[data-usage-compaction]') || [])].find((x) => x.getAttribute('data-usage-compaction') === name) : null;
      if (row) this.setMark(row, true);
    },
    // Pointing marks for as long as the pointer stays; a tap keeps the mark
    // (_pick), and leaving returns to it.
    dotOf(e) { return e.target instanceof Element ? e.target.closest('[data-usage-dot]') : null; },
    dotOver(e) { const dot = this.dotOf(e); if (dot) this.markCompaction(dot.getAttribute('data-usage-dot')); },
    rowOver(e) {
      const name = e.target instanceof Element ? e.target.closest('[data-usage-compaction]')?.getAttribute('data-usage-compaction') : '';
      if (name) this.markCompaction(name);
    },
    unhover() { this.markCompaction(this._pick || ''); },
    // A tap on a dot marks it and its row, and opens the dot's title-tip: the
    // row's figures, at the dot. The row may be out of view and stays there.
    // A tap on the plot beside the dots lets the mark go.
    dotTap(e) {
      const dot = this.dotOf(e);
      this._pick = dot ? dot.getAttribute('data-usage-dot') : '';
      this.markCompaction(this._pick);
      if (dot) window.TitleTip?.open?.(dot);
    },
    // A tap on a row marks it and its dot; a second tap lets them go. The
    // row's arrow is the way to its summary.
    compTap(e) {
      const t = e.target instanceof Element ? e.target : null;
      const name = t?.closest('[data-usage-compaction]')?.getAttribute('data-usage-compaction');
      if (!name || t.closest('[data-usage-out]')) return;
      this._pick = name === this._pick ? '' : name;
      this.markCompaction(this._pick);
    },
  })));
})();
