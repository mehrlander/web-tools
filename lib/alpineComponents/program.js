// alpineComponents/program.js — one program as a page, at
// ?view=program&program=<name>.
//
// A program organizes work around an ongoing concern (docs/CONSTELLATION.md,
// Projects and research): a repository declares it under `programs` in its
// .web-tools.json, and the program's folder holds its charter as README.md.
// This is the program's own space in the app, shaped as the Project view is: a
// masthead on one line (the program's icon on a neutral tile, which opens the
// shell's anchored menu over every program, then its name, its charter and its
// repository) beside the program's tab row. Under it, the scope, marks of the
// program's state that each open the tab they count, and the app views that
// display it. The tabs are the charter's Areas table, the measures drawn as
// weekly columns, the latest commits to the files it governs, its open tasks
// and, signed in, the notes on its charter; a tab the program has nothing for
// is left out. It moved here from the Map's Programs tab on 2026-11-18, where
// it was a page inside the Map under two rows of tabs; the Map keeps the list,
// on which every program compares with the others.
//
// The shell owns the address (programName, programTab, goProgram and
// goProgramTab in app/index.html), as it does Tending's, so a tab tap is a
// history entry and a link reopens the tab.
//
// THE DECLARATION IS READ ONE WAY, beside the component: window.Programs, which
// the Map's Programs list, this view and the shell's sidebar all draw from, so a
// program cannot be one thing in the list and another on its page. A namespace
// in a component file rather than a kit, because the sidebar's getter and the
// Map's list read it synchronously, and a component file runs before Alpine
// starts where a kit the app loads itself runs after (docs/loader.md,
// invariant 8; docs/code-layers.md, "A component beats a namespace").
//
//   Programs.rows(sources)        [{ repo, ref, config }] -> one row per named
//                                 program, the hub's first: key, repo, ref, name,
//                                 label, icon (a ph- glyph), iconFile (an SVG in
//                                 the repo), proposed, scope, path, charter,
//                                 governs, measures, reviewers, views, root (the
//                                 declaring repository's tracker)
//   Programs.iconSrc(p)           the program's SVG as a data URL, read at the
//                                 revision its declaration came from; '' until read
//   Programs.readBoard(repo, ref, file, token)
//                                 a tracker's board.csv as open counts:
//                                 { deck, doing, blocked, byProject, openByProject },
//                                 null when unreadable
//   Programs.measureName(m)       a measure address's file name
//   Programs.viewLabel(v), viewIcon(v)
//                                 a view address's name and icon: a Map tab's own,
//                                 from window.MapTabs, else the view's key
(() => {
  const HUB = 'mehrlander/web-tools';
  // A repo-relative path a declaration may name: no scheme, drive, query or
  // climb. The Map's workPath holds research and projects to the same rule.
  const safePath = p => typeof p === 'string' && !/[:\\\r\n?#]/.test(p) &&
    p.split('/').every(s => s && s !== '.' && s !== '..');
  const ICONS_ASKED = new Set();
  let icons = null;
  const viewQuery = v => new URLSearchParams(String(v).replace(/^\?/, ''));
  const viewTab = v => { const tab = viewQuery(v).get('tab'); return tab ? window.MapTabs?.find?.(tab) || null : null; };
  window.Programs = {
    rows(sources){
      const list = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
      const order = (a, b) => (a.repo === HUB ? -1 : b.repo === HUB ? 1 : 0) || a.repo.localeCompare(b.repo);
      return (sources || []).filter(s => s && s.repo && s.config).slice().sort(order)
        .flatMap(s => (Array.isArray(s.config.programs) ? s.config.programs : [])
          .filter(p => p && typeof p.name === 'string' && p.name).map(p => ({
            key: s.repo + ':' + p.name, repo: s.repo, ref: s.ref || '', name: p.name, label: p.label || p.name,
            // A program's icon is a Phosphor glyph or an SVG file in its
            // repository, as a project's is.
            icon: typeof p.icon === 'string' && p.icon.startsWith('ph-') ? p.icon : 'ph-gauge',
            iconFile: typeof p.icon === 'string' && /\.svg$/.test(p.icon) && safePath(p.icon) ? p.icon : '',
            proposed: p.status === 'proposed',
            scope: typeof p.scope === 'string' ? p.scope : '',
            path: typeof p.path === 'string' && safePath(p.path) ? p.path : '',
            charter: p.status !== 'proposed' && typeof p.path === 'string' && safePath(p.path) ? p.path + '/README.md' : '',
            governs: list(p.governs), measures: list(p.measures), reviewers: list(p.reviewers), views: list(p.views),
            root: { kind: 'repo', repo: s.repo, ref: s.ref || '',
              tracker: typeof s.config.tracker === 'string' && safePath(s.config.tracker) ? s.config.tracker : '' } })));
    },
    // Read at the declaration's revision, so a branch that adds or moves a
    // mark shows it; asked once per file, outside the render that wanted it.
    iconSrc(p){
      if (!p?.iconFile || !window.GH) return '';
      icons ||= window.Alpine?.reactive ? window.Alpine.reactive({}) : {};
      const key = p.repo + '@' + (p.ref || '') + ':' + p.iconFile;
      if (!ICONS_ASKED.has(key)) {
        ICONS_ASKED.add(key);
        queueMicrotask(() => new window.GH({ token: window.TOKEN, repo: p.repo, ref: p.ref || 'main' }).get(p.iconFile)
          .then(j => { icons[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(j.text); })
          .catch(() => {}));
      }
      return icons[key] || '';
    },
    // A project's open rows, for a program's tasks: the board file's own
    // folder plus the row's href is the task file.
    async readBoard(repo, ref, file, token){
      try {
        const gh = new window.GH({ token: token || '', repo, ref: ref || 'main' });
        const rows = window.Csv.rows((await gh.get(file)).text);
        const n = s => rows.filter(r => r.status === s).length, byProject = {}, openByProject = {};
        const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
        for (const r of rows) if (r.project && ['backlog', 'in-progress', 'blocked'].includes(r.status)) {
          byProject[r.project] = (byProject[r.project] || 0) + 1;
          (openByProject[r.project] ||= []).push({ id: r.id, title: r.title || r.id, status: r.status,
            path: dir + (r.href || 'tasks/' + r.id + '.md') });
        }
        return { deck: n('backlog'), doing: n('in-progress'), blocked: n('blocked'), byProject, openByProject };
      } catch { return null; }
    },
    // A measure's file name; its locator stays in the row's peek target.
    measureName(m){ return String(m).split(':').pop().split('/').pop(); },
    viewLabel(v){
      const hit = viewTab(v), view = viewQuery(v).get('view') || '';
      return hit ? hit.n : view ? view[0].toUpperCase() + view.slice(1) : String(v);
    },
    // A Map tab's own icon, or a door out for another view.
    viewIcon(v){ return viewTab(v)?.i || 'ph-arrow-square-out'; },
  };
})();

document.addEventListener('alpine:init', function() {
  const HUB = 'mehrlander/web-tools';
  // A program page's recent changes: at most this many, read from at most this
  // many governed paths when signed out (loadCommits), and the days the count
  // of recent commits looks back (recent).
  const PROGRAM_COMMITS = 15, PROGRAM_PUBLIC_PATHS = 8, PROGRAM_RECENT_DAYS = 14;
  // The web-tools ref the hub's declarations are read at: the selection, else
  // ?use=, else main, as the Map reads them, so a preview of a branch shows the
  // branch's programs.
  const useRef = () => {
    try { return window.GH?.refFor?.(HUB) || new URLSearchParams(location.search).get('use') || 'main'; }
    catch { return 'main'; }
  };
  // Another repository's ref: what the selection names for it, else main.
  const selRef = (repo, path) => window.GH?.refFor?.(repo, path) || 'main';
  // A measure file's weekly view, by the parsed file it came from, so drawing a
  // measure never writes reactive state.
  const MEASURE_VIEWS = new WeakMap();
  // Board reads already started, by repo@ref:path, kept outside the component
  // so a render that asks for a board never writes reactive state it read.
  const BOARDS = new Map();
  // The charter's bytes, by repo@ref:path, so the deck shows what the Areas
  // tab read without a second read.
  const CHARTERS = new Map();
  // The Map's chip shape, for the measures' legend.
  const chip = 'shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 max-sm:px-2 max-sm:py-0.5 text-sm whitespace-nowrap transition-colors';
  const chipOn = 'bg-primary/10 text-primary';
  const chipOff = 'bg-base-200/60 text-base-content/60 hover:text-base-content';
  const mark = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm tabular-nums bg-base-200/60 text-base-content/70 hover:text-primary';
  // The Markdown helpers the Areas tab needs. The Map keeps its own copies
  // for its other readers; these three are small and pure.
  let markedP = null;
  const loadMarked = () => markedP ||= window.marked ? Promise.resolve() :
    new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js';
      s.onload = res; s.onerror = () => { markedP = null; rej(new Error('marked failed to load')); };
      document.head.appendChild(s);
    });
  // The first table under a `## <heading>`, before the next heading of that
  // level or above: its header cells and its rows, cell by cell as written.
  // A cell splits on an unescaped pipe. Null where the section has no table.
  const mdSectionTable = (md, heading) => {
    const lines = String(md || '').split('\n'), want = '## ' + heading.toLowerCase();
    const cells = l => l.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
    const at = lines.findIndex(l => l.trim().toLowerCase() === want);
    if (at < 0) return null;
    let i = at + 1;
    while (i < lines.length && !/^#{1,2}\s/.test(lines[i]) && !lines[i].trim().startsWith('|')) i++;
    if (i >= lines.length || !lines[i].trim().startsWith('|')) return null;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) rows.push(cells(lines[j]));
    return { head: cells(lines[i]), rows };
  };
  // A document's first paragraph of prose: past any frontmatter, headings,
  // tables, quotes and rules, its lines joined.
  const mdLead = md => (String(md || '').replace(/^---\n[\s\S]*?\n---\n/, '').split(/\n\s*\n/)
    .find(b => b.trim() && !/^\s*(#|\||>|---|```)/.test(b)) || '').replace(/\s+/g, ' ').trim();
  // Inline Markdown as HTML: links open in a new tab and wear the link style,
  // and `resolve` turns a relative href into one that means something here.
  const inlineMd = (s, resolve) => {
    if (!s) return '';
    const d = document.createElement('div');
    d.innerHTML = window.marked?.parseInline ? window.marked.parseInline(s) : window.esc(s);
    for (const a of d.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href');
      if (!/^(https?:|#)/.test(h) && resolve) a.setAttribute('href', resolve(h) || h);
      a.setAttribute('target', '_blank');
      a.className = 'link link-primary';
    }
    for (const c of d.querySelectorAll('code')) c.className = 'font-mono';
    return d.innerHTML;
  };

  // A program's measures, drawn (measureView), side by side where the pane
  // holds two, each with `p` in scope.
  const measures = `
                  <div x-show="p.measures.length" class="grid grid-cols-1 gap-x-10 gap-y-6 pt-1 pb-5" :class="p.measures.length > 1 && '@4xl:grid-cols-2'" data-part="body">
                    <template x-for="m in p.measures" :key="m">
                      <div class="min-w-0" :data-program-measure="measureName(m)">
                        <div class="flex items-baseline gap-2 flex-wrap mb-2">
                          <a x-blob="measurePeek(m)" class="font-mono text-base font-medium hover:text-primary" x-text="measureName(m)"></a>
                          <span x-show="measureView(m)?.generated" class="text-sm text-base-content/40"
                                x-text="'written ' + agoOf(measureView(m)?.generated || '')"></span>
                          <button type="button" x-show="measureView(m)?.caveats.length" data-chart-tip
                                  @click="toggleChartTip('notes:' + m, $el, measureNotes(m))"
                                  class="text-base-content/40 hover:text-primary" aria-label="How to read this measure">
                            <i class="ph ph-info"></i></button>
                        </div>
                        <p x-show="measureState(m) === 'loading'" class="text-base text-base-content/40">Loading…</p>
                        <p x-show="measureState(m) === 'locked'" class="text-base text-base-content/50">Sign in to read it.</p>
                        <p x-show="measureState(m) === 'missing'" class="text-base text-base-content/50">
                          Not written yet at <span class="font-mono text-sm" x-text="m"></span></p>
                        <p x-show="measureState(m) === 'error'" class="text-sm text-error font-mono break-all" x-text="measureData[m]?.err"></p>
                        <p x-show="measureState(m) === 'ok' && !measureView(m)" class="text-base text-base-content/50">Not a shape this view draws.</p>
                        <template x-if="measureView(m)">
                          <div>
                            <!-- The figure's legend, with values, so it wraps rather
                                 than scrolling the marked category out of view; its
                                 chips mark a category and filter nothing. -->
                            <div class="flex flex-wrap items-center gap-1.5 mb-3" role="radiogroup" aria-label="Marked category">
                              <template x-for="c in measureCats(m)" :key="c.key">
                                <button type="button" role="radio" :aria-checked="String(measureMarkOf(m) === c.key)"
                                        @click="measureMark[m] = c.key" :data-title-tip="c.tip || null"
                                        class="${chip}" :class="measureMarkOf(m) === c.key ? '${chipOn}' : '${chipOff}'">
                                  <span x-text="c.glyph && measureMarkOf(m) !== c.key ? c.glyph : c.label"></span><span class="opacity-60 tabular-nums" x-text="c.last"></span></button>
                              </template>
                            </div>
                            <div class="overflow-x-auto" x-init="requestAnimationFrame(() => requestAnimationFrame(() => $el.scrollLeft = $el.scrollWidth))">
                              <div class="flex items-stretch gap-1 sm:gap-1.5">
                                <div class="shrink-0 flex flex-col items-end gap-1 pr-1 text-xs text-base-content/40" aria-hidden="true">
                                  <span>&nbsp;</span><span class="h-36"></span><span class="leading-4">&nbsp;<br>week</span>
                                  <span x-text="(measureView(m)?.unit || '').split(' ').pop()"></span>
                                </div>
                                <template x-for="w in measureWeeks(m)" :key="w.week">
                                  <div class="flex-1 min-w-5 flex flex-col items-center gap-1">
                                    <span class="text-xs tabular-nums text-primary" x-text="w.share"></span>
                                    <button type="button" data-chart-tip
                                            @click="toggleChartTip('m:' + m + ':' + w.week, $el, measureTip(m, w))"
                                            @mouseenter="hoverChartTip('m:' + m + ':' + w.week, $el, measureTip(m, w))" @mouseleave="leaveChartTip()"
                                            :aria-label="'Week of ' + weekLabel(w.week) + ': ' + (w.share || 'none')"
                                            class="w-full h-36 flex flex-col-reverse rounded-sm overflow-hidden bg-base-200/50"
                                            :class="[w.partial ? 'opacity-50' : '', chartTipIs('m:' + m + ':' + w.week) ? 'ring-2 ring-primary/40' : '']">
                                      <template x-for="s in w.segs" :key="s.key">
                                        <span class="block w-full shrink-0" :class="s.cls" :style="'height:' + s.pct + '%'"></span>
                                      </template>
                                    </button>
                                    <span class="text-xs text-base-content/60 tabular-nums text-center leading-4"><span class="block" x-text="w.parts.mon || ' '"></span><span class="block" x-text="w.parts.day"></span></span>
                                    <span class="text-xs text-base-content/30 tabular-nums" x-text="w.n.toLocaleString()"></span>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>`;

  Alpine.data('program', function() {
    return {
      description: 'Program view: one declared program, its charter areas, measures, recent changes to the files it governs, open tasks and charter notes',

      hubSource: null,   // { repo, ref, config }: the hub's declarations at the selected revision
      picked: {},        // repo -> a source the selection reads at another ref than main
      loading: false,
      error: '',
      _run: 0,
      charters: {},
      commits: {},
      notes: {},
      boards: {},
      measureData: {},
      measureMark: {},
      // The chart panel-tip, the Map's contract for a measure's marks: a mark
      // passes its key and the body to show: { title, sub, rows: [{ label, n,
      // share, on }], notes: [text] }.
      chartTip: null, chartTipClose: '', _chartTipT: null, _chartTipWired: false,
      _deck: null,

      template: `
        <div class="flex flex-col h-full min-h-0" data-program-view>
          <div x-show="!page" class="px-4 sm:px-6 pt-6 flex flex-col items-start gap-2">
            <p x-show="loading" class="text-base text-base-content/50">Loading programs…</p>
            <p x-show="!loading && !!error" x-text="error" class="text-sm text-error" role="status"></p>
            <p x-show="!loading && !error && !!hubSource" class="text-base text-base-content/60" data-program-missing>
              No program is named <span class="font-mono" x-text="name"></span>.</p>
            <button type="button" x-show="!loading" @click="openList()" class="inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary">
              <i class="ph ph-gauge"></i><span>Every program</span></button>
          </div>
          <template x-for="p in (page ? [page] : [])" :key="p.key">
            <div class="flex flex-col h-full min-h-0" data-program-page :data-program="p.name" x-effect="loadPage(p)">
              <div class="shrink-0 px-4 sm:px-6 pt-3">
                <!-- The masthead and the tab row share one line where they fit,
                     and the tabs wrap under the masthead where they do not, as
                     the Project view's do. The mark is the program's own icon,
                     drawn in its own colour on a neutral tile, and opens the
                     switcher: every program in the shell's anchored menu, with
                     this one's folder on GitHub. Then the name, its charter
                     (opened in the deck) and its repository. -->
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div class="flex items-center gap-2.5 min-w-[7rem] shrink" data-part="title">
                    <button type="button" @click="toggleSwitcher(p, $event.currentTarget)"
                            class="relative shrink-0 size-9 rounded-xl flex items-center justify-center transition-colors bg-base-200 hover:bg-base-300"
                            :aria-expanded="switcherOpen()" aria-haspopup="menu"
                            data-title-tip="Programs" aria-label="Programs" data-program-switch>
                      <img x-show="iconSrc(p)" :src="iconSrc(p)" alt="" class="block size-5">
                      <i x-show="!iconSrc(p)" class="ph-duotone text-xl text-base-content/60" :class="p.icon"></i>
                      <i class="ph-bold ph-caret-down absolute -bottom-0.5 -right-0.5 text-[10px] leading-none rounded-full bg-base-100 p-0.5 text-base-content/60"></i></button>
                    <h1 class="text-xl font-bold tracking-tight truncate" x-text="p.label"></h1>
                    <span x-show="p.proposed" class="badge badge-sm badge-ghost shrink-0">proposed</span>
                    <button type="button" x-show="p.charter" @click="openCharter(p)" data-program-charter-open
                            :data-title-tip="'Read the charter, ' + p.charter" :aria-label="'Read the charter, ' + p.charter"
                            class="shrink-0 rounded p-0.5 transition-colors hover:bg-base-200">
                      <i class="ph ph-file-text text-base text-primary"></i></button>
                    <button type="button" @click="openRepo(p)" data-program-repo
                            class="hidden sm:block min-w-0 truncate font-mono text-xs text-base-content/40 hover:text-primary transition-colors"
                            :data-title-tip="p.repo" x-text="p.repo"></button>
                  </div>
                  <!-- The tab row, every tab named. Below sm a tab is its label
                       alone; the icons return from sm up. -->
                  <div class="shrink-0 inline-flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5"
                       role="tablist" aria-label="Program" data-slot="frame:tabs" data-program-tabs>
                    <template x-for="t in tabs(p)" :key="t.k">
                      <button type="button" role="tab" @click="setTab(t.k)" :aria-selected="tabOf(p) === t.k" :data-program-tab="t.k"
                              class="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors"
                              :class="tabOf(p) === t.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                        <i class="ph text-base hidden sm:inline" :class="t.i"></i><span x-text="t.n"></span></button>
                    </template>
                  </div>
                  <button type="button" @click="refresh(p)" :disabled="loading" data-title-tip="Read again" aria-label="Read again"
                          class="ml-auto shrink-0 rounded p-1 text-base-content/40 hover:text-primary transition-colors" data-program-refresh>
                    <i class="ph ph-arrow-clockwise text-base"></i></button>
                </div>
              </div>

              <div class="grow min-h-0 overflow-y-auto px-4 sm:px-6 pb-8 mt-3 @container" data-program-body>
                <!-- The scope, and marks of the program's state, each opening
                     the tab it counts; then the app views that display it, on
                     one line that scrolls sideways. -->
                <div class="flex flex-col gap-2 mb-4 min-w-0">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0" data-part="meta">
                    <p x-show="p.scope" class="text-base text-base-content/70 break-words" x-text="p.scope" data-program-scope></p>
                    <div class="flex flex-wrap items-center gap-1.5" data-program-marks>
                      <button type="button" x-show="tasksOf(p) !== null" @click="setTab('tasks')" data-program-mark="tasks"
                              data-title-tip="Open tasks on the tracker" class="${mark}">
                        <i class="ph ph-list-checks"></i><span x-text="tasksOf(p) + ' open'"></span></button>
                      <button type="button" x-show="p.governs.length && commitsOf(p).state === 'ok'" @click="setTab('changes')" data-program-mark="changes"
                              :data-title-tip="'Commits in the last ${PROGRAM_RECENT_DAYS} days, among the latest read from ' + plural(commitsOf(p).read, 'governed path')"
                              class="${mark}">
                        <i class="ph ph-git-commit"></i><span x-text="recent(p) + ' in ${PROGRAM_RECENT_DAYS} days'"></span></button>
                      <button type="button" x-show="hasToken() && p.charter && notesOf(p).state === 'ok'" @click="setTab('notes')" data-program-mark="notes"
                              data-title-tip="Notes on the charter" class="${mark}">
                        <i class="ph ph-note"></i><span x-text="plural(notesOf(p).rows.length, 'note')"></span></button>
                    </div>
                  </div>
                  <div x-show="p.views.length" class="relative flex flex-nowrap min-w-0 max-w-full overflow-x-auto py-0.5 whitespace-nowrap [scrollbar-width:thin] items-center gap-x-3 text-sm"
                       data-part="links" data-program-views>
                    <template x-for="v in p.views" :key="v">
                      <a :href="viewHref(v)" @click="if (!$event.metaKey && !$event.ctrlKey && !$event.shiftKey) { $event.preventDefault(); openView(v); }"
                         class="shrink-0 inline-flex items-center gap-1 text-base-content/80 hover:text-primary">
                        <i class="ph text-base-content/50" :class="viewIcon(v)"></i><span x-text="viewLabel(v)"></span></a>
                    </template>
                  </div>
                </div>

                <!-- Areas: the rows of the charter's Areas table, on its own two
                     columns; without one, the charter's first paragraph. -->
                <div x-show="tabOf(p) === 'areas'" role="tabpanel" class="min-w-0" data-program-areas>
                  <p x-show="charterOf(p).state === 'loading'" class="text-base text-base-content/40">Loading…</p>
                  <p x-show="charterOf(p).state === 'error'" class="text-sm text-error font-mono break-all" x-text="charterOf(p).err"></p>
                  <div x-show="charterOf(p).areas.length" class="flex flex-col" data-pattern="list" data-part="list">
                    <div class="hidden @2xl:grid @2xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-6 pb-2 border-b border-base-300 text-sm text-base-content/50">
                      <span x-text="charterOf(p).head[0] || 'Area'"></span><span x-text="charterOf(p).head[1] || 'Covers'"></span>
                    </div>
                    <template x-for="a in charterOf(p).areas" :key="a.key">
                      <div class="grid grid-cols-1 gap-0.5 py-2.5 border-b border-base-200 @2xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] @2xl:gap-x-6"
                           data-part="item" data-program-area :data-area="a.key">
                        <span class="font-medium break-words" x-html="a.area"></span>
                        <span class="text-base text-base-content/80 break-words" x-html="a.covers"></span>
                      </div>
                    </template>
                  </div>
                  <div x-show="charterOf(p).state === 'ok' && !charterOf(p).areas.length" class="flex flex-col items-start gap-2" data-program-lead>
                    <p x-show="charterOf(p).lead" class="text-base text-base-content/80 break-words" x-html="charterOf(p).lead"></p>
                    <button type="button" @click="openCharter(p)" class="inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary">
                      <i class="ph ph-file-text"></i><span>Read the charter</span></button>
                  </div>
                </div>
                <!-- Measures mount with their tab, so a chart scrolls to its
                     newest week at a width it can measure. -->
                <template x-if="tabOf(p) === 'measures'">
                  <div role="tabpanel" class="min-w-0" data-program-measures>${measures}</div>
                </template>
                <section x-show="tabOf(p) === 'changes'" role="tabpanel" class="flex flex-col gap-2 min-w-0" data-program-commits>
                  <span x-show="commitsOf(p).read < p.governs.length" class="text-xs tabular-nums text-base-content/40"
                        data-title-tip="Signed in, every governed path is read"
                        x-text="'From ' + commitsOf(p).read + ' of ' + p.governs.length + ' paths'"></span>
                  <p x-show="!p.governs.length" class="text-base text-base-content/50">Governs no paths yet.</p>
                  <p x-show="p.governs.length && commitsOf(p).state === 'loading'" class="text-base text-base-content/40">Loading…</p>
                  <p x-show="commitsOf(p).state === 'error'" class="text-sm text-error font-mono break-all" x-text="commitsOf(p).err"></p>
                  <p x-show="commitsOf(p).state === 'ok' && !commitsOf(p).rows.length" class="text-base text-base-content/50">None found.</p>
                  <ul class="flex flex-col gap-3">
                    <template x-for="c in commitsOf(p).rows" :key="c.sha">
                      <li class="min-w-0" data-program-commit :data-sha="c.sha">
                        <p class="text-base break-words" x-text="c.subject"></p>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-base-content/50">
                          <a :href="c.url" target="_blank" rel="noopener" class="font-mono hover:text-primary" x-text="c.short"></a>
                          <span class="tabular-nums" x-text="c.day"></span>
                          <template x-for="f in c.paths.slice(0, 2)" :key="f">
                            <a x-blob="peek(p, f)" class="font-mono break-all hover:text-primary" x-text="f"></a>
                          </template>
                          <span x-show="c.paths.length > 2" class="tabular-nums" x-text="'+' + (c.paths.length - 2)"></span>
                        </div>
                      </li>
                    </template>
                  </ul>
                </section>
                <section x-show="tabOf(p) === 'tasks'" role="tabpanel" class="flex flex-col gap-2 min-w-0" data-program-tasks>
                  <p x-show="tasksOf(p) === 0" class="text-base text-base-content/50">None open.</p>
                  <ul class="flex flex-col gap-1.5">
                    <template x-for="t in taskRows(p)" :key="t.id">
                      <li class="flex items-start gap-2 min-w-0" data-program-task :data-status="t.status">
                        <i class="ph text-sm mt-1.5 shrink-0" :class="taskMark(t).cls" :data-title-tip="taskMark(t).label"></i>
                        <a x-blob="peek(p, t.path)" class="text-base break-words hover:text-primary" x-text="t.title"></a>
                      </li>
                    </template>
                  </ul>
                  <a :href="trackerUrl(p)" class="self-start inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary">
                    <i class="ph ph-kanban"></i><span>The board</span></a>
                </section>
                <section x-show="tabOf(p) === 'notes' && hasToken() && p.charter" role="tabpanel" class="flex flex-col gap-2 min-w-0" data-program-notes>
                  <p x-show="notesOf(p).state === 'loading'" class="text-base text-base-content/40">Loading…</p>
                  <p x-show="notesOf(p).state === 'error'" class="text-sm text-error font-mono break-all" x-text="notesOf(p).err"></p>
                  <p x-show="notesOf(p).state === 'ok' && !notesOf(p).rows.length" class="text-base text-base-content/50">None yet.</p>
                  <ul class="flex flex-col gap-3">
                    <template x-for="n in notesOf(p).rows" :key="n.id">
                      <li class="min-w-0" data-program-note>
                        <p class="text-base whitespace-pre-line break-words" x-text="n.text"></p>
                        <div class="flex flex-wrap items-center gap-x-3 text-xs text-base-content/50">
                          <span x-text="n.author"></span>
                          <span class="tabular-nums" x-text="n.day"></span>
                          <span x-show="n.replies" class="tabular-nums" x-text="n.replies + (n.replies === 1 ? ' reply' : ' replies')"></span>
                        </div>
                      </li>
                    </template>
                  </ul>
                </section>
              </div>
            </div>
          </template>

          <!-- The chart panel-tip: one panel for a measure's marks. Hover opens
               it where the pointer is fine, a click or tap pins it, and
               kits/panel-tip.js closes it on the close button, Escape and a
               press outside. At the root, since a fixed panel inside a hidden
               tab hides with it. -->
          <div x-ref="chartTip" x-show="chartTip" x-cloak role="dialog" :aria-label="chartTip?.body?.title || 'Detail'"
               @mouseenter="clearTimeout(_chartTipT)" @mouseleave="leaveChartTip()" data-program-chart-tip
               class="fixed z-[60] rounded-xl border border-base-300 bg-base-100 shadow-lg px-4 py-3 text-sm leading-6 max-h-[min(70vh,32rem)] overflow-y-auto"
               :style="chartTip ? 'left:' + chartTip.x + 'px;top:' + chartTip.y + 'px;width:' + chartTip.w + 'px' : ''">
            <div x-html="chartTipClose"></div>
            <template x-if="chartTip">
              <div class="flex flex-col gap-2" :class="chartTipClose && 'pr-6'">
                <div class="min-w-0">
                  <p class="text-base font-semibold break-words" x-text="chartTip.body.title"></p>
                  <p x-show="chartTip.body.sub" class="text-base-content/60 tabular-nums" x-text="chartTip.body.sub"></p>
                </div>
                <div x-show="chartTip.body.rows?.length" class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3">
                  <template x-for="r in (chartTip.body.rows || [])" :key="r.label">
                    <div class="contents" :class="r.on ? 'text-primary font-medium' : ''">
                      <span class="truncate" x-text="r.label"></span>
                      <span class="tabular-nums text-right" x-text="r.n"></span>
                      <span class="tabular-nums text-right" :class="r.on ? '' : 'text-base-content/50'" x-text="r.share || ''"></span>
                    </div>
                  </template>
                </div>
                <template x-for="t in (chartTip.body.notes || [])" :key="t">
                  <p class="text-base-content/80" x-text="t"></p>
                </template>
              </div>
            </template>
          </div>
        </div>
      `,

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        if (!window.TitleTip && window.gh?.load) window.gh.load('kits/title-tip.js');
        this.loadSources();
        // A sign-in or a sign-out reads the declarations again, and each tab's
        // loader reads again for the reader it now has.
        this.$watch(() => window.__shell && window.__shell._authState, () => this.loadSources());
        // The estate's other repositories arrive with the config cache; one a
        // selection names at another ref is read there.
        this.$watch(() => Object.keys(window.__shell?.estateConfigs || {}).join(), () => this.loadPicked());
        this._configs = () => this.loadSources(true);
        document.addEventListener('web-tools:configs-refreshed', this._configs);
      },
      destroy(){
        this._run++;
        this.closeChartTip();
        document.removeEventListener('web-tools:configs-refreshed', this._configs);
      },

      hub(){ return HUB; },
      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },
      plural(n, noun){ return n + ' ' + noun + (n === 1 ? '' : 's'); },
      agoOf(iso){ return window.GH?.ago?.(iso) || ''; },

      // ── The declarations ─────────────────────────────────────────────────
      // The hub's at the selected revision, read here; every other estate
      // repository's from the config cache the shell already holds, signed
      // in, except one the selection reads at another ref.
      async loadSources(force = false){
        const run = ++this._run;
        this.loading = true;
        this.error = '';
        try {
          const ref = useRef();
          const config = await this.readManifest(HUB, ref);
          if (run !== this._run) return;
          this.hubSource = { repo: HUB, ref, config };
          if (force) { this.charters = {}; this.commits = {}; this.notes = {}; this.measureData = {}; }
        } catch (e) {
          if (run === this._run) { this.hubSource = null; this.error = 'Web Tools declarations unavailable: ' + (e?.message || e); }
        } finally { if (run === this._run) this.loading = false; }
        this.loadPicked();
      },
      async readManifest(repo, ref){
        const config = JSON.parse((await new window.GH({ token: window.TOKEN, repo, ref })
          .get('.web-tools.json', window.GH.FRESH)).text);
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid repository manifest');
        return config;
      },
      async loadPicked(){
        const picked = {};
        await Promise.all(this.estateRepos().map(async repo => {
          const ref = selRef(repo, '.web-tools.json');
          if (ref === 'main') return;
          try { picked[repo] = { repo, ref, config: await this.readManifest(repo, ref) }; } catch { /* the cache's copy stands */ }
        }));
        this.picked = picked;
      },
      // The estate's members the sidebar lists: estate: true, and not on the
      // registry's hidden list.
      estateRepos(){
        const shell = window.__shell, hidden = shell?.estateHidden || [];
        if (!shell?.hasToken?.()) return [];
        return Object.entries(shell.estateConfigs || {})
          .filter(([repo, c]) => repo !== HUB && c?.estate === true && !hidden.includes(repo)).map(([repo]) => repo);
      },
      get sources(){
        const configs = window.__shell?.estateConfigs || {};
        return [this.hubSource, ...this.estateRepos().map(repo => this.picked[repo] || { repo, ref: 'main', config: configs[repo] })]
          .filter(s => s && s.config);
      },
      get rows(){ return window.Programs.rows(this.sources); },
      // The program the address names, the hub's first where two repositories
      // declare one name.
      get name(){ return window.__shell?.programName || ''; },
      get page(){ return this.name ? this.rows.find(p => p.name === this.name) || null : null; },

      // ── The tabs ─────────────────────────────────────────────────────────
      // The charter's areas first, then the measures, what moved, the open
      // tasks and, signed in, the notes. A tab the program has nothing for is
      // left out, and the asked one falls back to the first.
      tabs(p){
        return [
          p.charter && { k: 'areas', n: 'Areas', i: 'ph-squares-four' },
          p.measures.length && { k: 'measures', n: 'Measures', i: 'ph-chart-bar' },
          { k: 'changes', n: 'Changes', i: 'ph-git-commit' },
          this.tasksOf(p) !== null && { k: 'tasks', n: 'Tasks', i: 'ph-list-checks' },
          this.hasToken() && p.charter && { k: 'notes', n: 'Notes', i: 'ph-note' },
        ].filter(Boolean);
      },
      tabOf(p){
        const tabs = this.tabs(p), asked = window.__shell?.programTab || '';
        return tabs.some(t => t.k === asked) ? asked : tabs[0].k;
      },
      setTab(k){ window.__shell?.goProgramTab?.(k); },

      // ── The masthead ─────────────────────────────────────────────────────
      iconSrc(p){ return window.Programs.iconSrc(p); },
      toggleSwitcher(p, el){ window.__shell?.toggleRepoMenu?.(p.repo, el, 'programs', { align: 'left' }); },
      switcherOpen(){ const s = window.__shell; return !!(s?.repoMenuAt && s.menuKind === 'programs'); },
      openRepo(p){ window.__shell?.openPinned?.(p.repo); },
      openList(){ window.__shell?.goMap?.('programs'); },
      refresh(p){
        this.loadSources(true).then(() => { BOARDS.clear(); this.boards = {}; if (this.page) this.loadPage(this.page, true); });
      },
      // A file's peek address: the hub at the revision its declaration was read
      // at, another repository at its own.
      peek(p, file){ return file ? (window.SourcePeek?.addr(p.repo, p.ref || 'main', file) || null) : null; },
      peekHref(p, file){ return window.RepoAddress?.github.blob(p.repo, p.ref || 'main', file) || ''; },

      // ── The views that display it ────────────────────────────────────────
      viewLabel(v){ return window.Programs.viewLabel(v); },
      viewIcon(v){ return window.Programs.viewIcon(v); },
      viewHref(v){
        const u = new URL(window.location.href); u.hash = ''; u.search = String(v);
        if (useRef() !== 'main') u.searchParams.set('use', useRef());
        return u.href;
      },
      // A Map tab opens in place; any other view by its address.
      openView(v){
        const q = new URLSearchParams(String(v).replace(/^\?/, ''));
        if (q.get('view') === 'map' && window.__shell?.goMap) return window.__shell.goMap(q.get('tab') || undefined);
        window.location.href = this.viewHref(v);
      },

      loadPage(p, force = false){
        this.loadCharter(p, force);
        this.loadCommits(p, force);
        this.loadNotes(p, force);
        this.loadMeasures(p, force);
      },

      // ── The charter ──────────────────────────────────────────────────────
      // Its Areas table, read once a program: each row's area and what it
      // covers as inline Markdown, its links resolved from the charter's folder
      // to the file on GitHub. A charter without the table gives its first
      // paragraph instead.
      charterMd(p, s){
        return inlineMd(s, h => {
          const u = new URL(h, 'https://repo/' + p.charter);
          return window.RepoAddress.github.blob(p.repo, p.ref || 'main', decodeURIComponent(u.pathname.slice(1))) + u.hash;
        });
      },
      charterKey(p){ return p.repo + '@' + (p.ref || 'main') + ':' + p.charter; },
      charterOf(p){ return this.charters[p.key] || { state: p.charter ? 'loading' : 'none', head: [], areas: [], lead: '' }; },
      async loadCharter(p, force = false){
        if (!p.charter) return;
        // Read once a program, a failure included: the page's effect re-runs
        // on every write here, so a retry on error would read without end.
        // Refresh (force) reads again.
        if (!force && this.charters[p.key]) return;
        const key = this.charterKey(p);
        if (force) CHARTERS.delete(key);
        this.charters[p.key] = { state: 'loading', head: [], areas: [], lead: '' };
        try {
          if (!CHARTERS.has(key))
            CHARTERS.set(key, (await new window.GH({ token: window.TOKEN, repo: p.repo, ref: p.ref || 'main' }).get(p.charter)).text);
          const text = CHARTERS.get(key);
          await loadMarked().catch(() => {});
          const t = mdSectionTable(text, 'Areas');
          const areas = (t?.rows || []).filter(r => r[0]).map(([area, covers = '']) =>
            ({ key: area, area: this.charterMd(p, area), covers: this.charterMd(p, covers) }));
          this.charters[p.key] = { state: 'ok', head: (t?.head || []).slice(0, 2), areas,
            lead: areas.length ? '' : this.charterMd(p, mdLead(text)) };
        } catch (e) {
          this.charters[p.key] = { state: 'error', head: [], areas: [], lead: '', err: String(e?.message || e) };
        }
      },
      // The charter in the house deck, read by the shared reader (viewer.js)
      // as the Files view's deck reads a file, its header linking the file on
      // GitHub. Without the deck kit, the file on GitHub.
      async openCharter(p){
        if (!p?.charter) return;
        const href = window.RepoAddress.github.blob(p.repo, p.ref || 'main', p.charter);
        if (!window.swipeDeck && window.gh?.load) { try { await window.gh.load('kits/swipe-deck.js'); } catch { /* fall through */ } }
        if (!window.swipeDeck) { window.open(href, '_blank', 'noopener'); return; }
        this._deck?.close?.();
        const parent = window.swipeDeck.top?.() || null;
        const opts = {
          count: 1, start: 0, title: p.label, subtitle: [p.repo.split('/').pop(), p.charter].join(' · '),
          icon: 'ph-file-text', link: { href, icon: 'ph-github-logo', title: 'Open ' + p.charter + ' on GitHub' },
          index: () => ({ title: p.label, subtitle: p.charter, icon: 'ph-file-text' }),
          render: (i, slide) => this.mountCharter(p, slide),
          release: (i, slide) => { slide.replaceChildren(); },
          slideScroll: false, innerClass: 'h-full w-full min-w-0', immersive: true,
          onClose: () => { this._deck = null; },
        };
        this._deck = parent ? window.swipeDeck.drill(parent, opts) : window.swipeDeck.open(opts);
      },
      mountCharter(p, slide){
        const el = document.createElement('div');
        el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden';
        el.setAttribute('x-data', "viewer({ bindStore: false, fill: true, identify: false, defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })");
        el.dataset.programCharter = p.charter;
        slide.append(el);
        window.Alpine.initTree(el);
        const key = this.charterKey(p), repo = p.repo, ref = p.ref || 'main';
        (async () => {
          try {
            if (!CHARTERS.has(key)) CHARTERS.set(key, (await new window.GH({ token: window.TOKEN, repo, ref }).get(p.charter)).text);
            if (el.isConnected) await el.__viewer?.show(p.charter, CHARTERS.get(key), { repo, ref });
          } catch (e) {
            if (!el.isConnected) return;
            el.remove();
            const note = document.createElement('p');
            note.className = 'text-base text-base-content/60 text-center py-16';
            note.textContent = 'Could not load it: ' + (e?.message || e);
            slide.append(note);
          }
        })();
      },

      // ── The tasks ────────────────────────────────────────────────────────
      // The declaring repository's tracker rows whose project: is the
      // program's name, read from its board.csv once per board and stored
      // outside the render that asked. null while unread or unreadable, so a
      // missing board reads as no tab rather than as an empty one.
      boardOf(p){
        const tracker = p.root?.tracker;
        if (!tracker || !/\.md$/.test(tracker)) return null;
        const file = tracker.replace(/\.md$/, '.csv'), key = p.repo + '@' + (p.ref || 'main') + ':' + file;
        if (!(key in this.boards)) {
          if (!BOARDS.has(key)) BOARDS.set(key, window.Programs.readBoard(p.repo, p.ref, file, this.hasToken() ? window.TOKEN : ''));
          queueMicrotask(async () => {
            const counts = await BOARDS.get(key);
            if (!(key in this.boards)) this.boards[key] = counts;
          });
        }
        return this.boards[key] || null;
      },
      tasksOf(p){
        const b = this.boardOf(p);
        return b ? (b.byProject?.[p.name] || 0) : null;
      },
      taskRows(p){
        const b = this.boardOf(p), order = { 'in-progress': 0, blocked: 1, backlog: 2 };
        return [...(b?.openByProject?.[p.name] || [])].sort((x, y) => order[x.status] - order[y.status]);
      },
      taskMark(t){
        return { 'in-progress': { cls: 'ph-circle-half text-primary', label: 'In progress' },
                 blocked: { cls: 'ph-prohibit text-warning', label: 'Blocked' } }[t.status]
          || { cls: 'ph-circle text-base-content/30', label: 'On deck' };
      },
      // The declaring repository's board, on GitHub.
      trackerUrl(p){
        const t = p.root?.tracker;
        return t ? window.RepoAddress.github.blob(p.repo, p.ref || 'main', t) : '';
      },

      // ── The changes ──────────────────────────────────────────────────────
      // The latest commits to touch each governed path, five a path, joined by
      // sha, newest first. Signed out, the first PROGRAM_PUBLIC_PATHS paths
      // only: an unauthenticated reader has 60 API calls an hour, and Sessions
      // governs nearly thirty paths.
      commitsOf(p){ return this.commits[p.key] || { state: 'loading', rows: [], read: p.governs.length }; },
      recent(p){
        const since = Date.now() - PROGRAM_RECENT_DAYS * 864e5;
        return this.commitsOf(p).rows.filter(c => Date.parse(c.date) >= since).length;
      },
      async loadCommits(p, force = false){
        const authed = this.hasToken(), prior = this.commits[p.key];
        if (!p.governs.length) return;
        if (!force && prior && prior.authed === authed) return;
        const paths = authed ? p.governs : p.governs.slice(0, PROGRAM_PUBLIC_PATHS);
        this.commits[p.key] = { state: 'loading', authed, rows: [], read: paths.length };
        const gh = new window.GH({ token: authed ? window.TOKEN : '', repo: p.repo, ref: p.ref || 'main' });
        const bySha = new Map();
        let failed = 0, err = '';
        await Promise.all(paths.map(async f => {
          try {
            const list = await gh.req('commits?sha=' + encodeURIComponent(p.ref || 'main') + '&path='
              + encodeURIComponent(f.replace(/\/+$/, '')) + '&per_page=5');
            for (const c of Array.isArray(list) ? list : []) {
              if (!c?.sha) continue;
              const row = bySha.get(c.sha);
              if (row) { row.paths.push(f); continue; }
              const date = String(c.commit?.committer?.date || c.commit?.author?.date || '');
              bySha.set(c.sha, { sha: c.sha, short: c.sha.slice(0, 7), date, day: date.slice(0, 10), paths: [f],
                subject: String(c.commit?.message || '').split('\n')[0],
                url: c.html_url || window.RepoAddress.github.commit(p.repo, c.sha) });
            }
          } catch (e) { failed++; err ||= String(e?.message || e); }
        }));
        if (this.commits[p.key]?.authed !== authed) return;
        const rows = [...bySha.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, PROGRAM_COMMITS);
        this.commits[p.key] = failed === paths.length
          ? { state: 'error', authed, rows: [], read: paths.length, err }
          : { state: 'ok', authed, rows, read: paths.length };
      },

      // ── The notes ────────────────────────────────────────────────────────
      // The notes whose subject is the charter, or a section of it, newest
      // first, each with how many replies it has. Signed in only: the store is
      // the private registry's.
      notesOf(p){ return this.notes[p.key] || { state: 'loading', rows: [] }; },
      async loadNotes(p, force = false){
        if (!this.hasToken() || !p.charter) return;
        if (!force && this.notes[p.key]) return;
        this.notes[p.key] = { state: 'loading', rows: [] };
        try {
          let text = '';
          try { text = (await new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' }).get('notes/notes.jsonl')).text; }
          catch (e) { if (e?.status !== 404) throw e; }
          const all = String(text || '').split('\n').flatMap(l => { try { return l.trim() ? [JSON.parse(l)] : []; } catch { return []; } });
          const about = p.repo + ':' + p.charter;
          const replies = id => all.filter(n => n?.about === 'note:' + id).length;
          const rows = all.filter(n => n && typeof n.about === 'string' && (n.about === about || n.about.startsWith(about + '#')))
            .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
            .map(n => ({ id: n.id || n.at, author: String(n.author || ''), text: String(n.text || ''),
                         day: String(n.at || '').slice(0, 10), replies: replies(n.id) }));
          this.notes[p.key] = { state: 'ok', rows };
        } catch (e) {
          this.notes[p.key] = { state: 'error', rows: [], err: String(e?.message || e) };
        }
      },

      // ── The measures, drawn ──────────────────────────────────────────────
      // A measure is declared as an owner/repo@ref:path address. A file whose
      // shape is a category table (`states` or `outcomes`, key to label) and
      // per-day counts (`days`, each carrying `closings` or `turns`) draws as
      // one column per week, each column the whole of that week's turns, so a
      // share compares across weeks however busy each was. The marked category
      // sits on the baseline, where its height reads directly; it starts as the
      // one the file's own summary leads with and the reader can mark another.
      // Any other shape keeps its name and nothing more.
      measureName(m){ return window.Programs.measureName(m); },
      async loadMeasures(p, force = false){
        const authed = this.hasToken();
        await Promise.all(p.measures.map(async m => {
          const prior = this.measureData[m];
          if (!force && prior && prior.authed === authed) return;
          const at = window.RepoAddress?.parse(m);
          if (!at) { this.measureData[m] = { state: 'error', authed, err: 'Not an owner/repo@ref:path address' }; return; }
          if (!authed && at.repo !== HUB) { this.measureData[m] = { state: 'locked', authed }; return; }
          this.measureData[m] = { state: 'loading', authed };
          try {
            const gh = new window.GH({ token: authed ? window.TOKEN : '', repo: at.repo, ref: at.ref });
            this.measureData[m] = { state: 'ok', authed, data: JSON.parse((await gh.get(at.path, window.GH.FRESH)).text) };
          } catch (e) {
            this.measureData[m] = e?.status === 404 ? { state: 'missing', authed }
              : { state: 'error', authed, err: String(e?.message || e) };
          }
        }));
      },
      measureState(m){ return this.measureData[m]?.state || 'loading'; },
      measureView(m){
        const d = this.measureData[m]?.data;
        if (!d) return null;
        const raw = window.Alpine?.raw ? window.Alpine.raw(d) : d;
        if (MEASURE_VIEWS.has(raw)) return MEASURE_VIEWS.get(raw);
        const table = d.states || d.outcomes;
        let view = null;
        if (table && typeof table === 'object' && Array.isArray(d.days)) {
          const ascii = k => /^[\x20-\x7e]+$/.test(k);
          const cats = Object.entries(table).map(([key, name]) => ({ key, name: String(name), glyph: ascii(key) ? '' : key, label: ascii(key) ? String(name) : key + ' ' + name }));
          const known = new Set(cats.map(c => c.key)), retired = d.retired || {}, byWeek = new Map();
          let firstDay = '', lastDay = '';
          for (const r of d.days) {
            if (!r?.day) continue;
            const wk = this.weekOf(r.day), w = byWeek.get(wk) || { week: wk, counts: {}, n: 0 };
            for (let [k, v] of Object.entries(r.closings || r.turns || {})) {
              k = retired[k] || k;
              if (!known.has(k)) { known.add(k); cats.push({ key: k, name: k, glyph: '', label: k }); }
              w.counts[k] = (w.counts[k] || 0) + (+v || 0);
              w.n += +v || 0;
            }
            byWeek.set(wk, w);
            if (!firstDay || r.day < firstDay) firstDay = r.day;
            if (r.day > lastDay) lastDay = r.day;
          }
          if (byWeek.size) {
            const keys = [...byWeek.keys()].sort(), lastWeek = keys[keys.length - 1];
            const sunday = wk => { const s = new Date(wk + 'T00:00:00Z'); s.setUTCDate(s.getUTCDate() + 6); return s.toISOString().slice(0, 10); };
            const weeks = this.weekRange(keys[0], lastWeek).map(wk => ({
              ...(byWeek.get(wk) || { week: wk, counts: {}, n: 0 }),
              // A week the file covers only part of: the one it starts in and
              // the one still running.
              partial: (wk === keys[0] && firstDay > wk) || (wk === lastWeek && lastDay < sunday(wk)),
            }));
            const cols = Array.isArray(d.summary?.columns) ? d.summary.columns.map(String) : [];
            const lead = cols.slice(3).map(c => cats.find(x => c === x.name || (!ascii(x.key) && c.includes(x.key)))).find(Boolean);
            view = { cats, weeks, unit: (cols[2] || 'turns').toLowerCase(), lead: (lead || cats[0])?.key || '',
                     generated: String(d.generated || ''), caveats: Array.isArray(d.caveats) ? d.caveats.map(String) : [] };
          }
        }
        MEASURE_VIEWS.set(raw, view);
        return view;
      },
      measureMarkOf(m){ return this.measureMark[m] || this.measureView(m)?.lead || ''; },
      // One column per week: the marked share on the baseline, then every
      // other category in the file's order, each keeping one of two greys
      // across all the weeks so a band can be followed sideways. Every recorded
      // week is drawn; the chart scrolls and opens at the newest.
      measureWeeks(m){
        const v = this.measureView(m), mark = this.measureMarkOf(m);
        if (!v) return [];
        const weeks = v.weeks, tone = {};
        v.cats.filter(c => c.key !== mark).forEach((c, i) => { tone[c.key] = i % 2 ? 'bg-base-content/25' : 'bg-base-content/10'; });
        return weeks.map((w, i) => {
          const marked = w.counts[mark] || 0, segs = [];
          if (w.n) {
            if (marked) segs.push({ key: mark, pct: 100 * marked / w.n, cls: 'bg-primary' });
            for (const c of v.cats) if (c.key !== mark && w.counts[c.key])
              segs.push({ key: c.key, pct: 100 * w.counts[c.key] / w.n, cls: tone[c.key] + ' border-t border-base-100' });
          }
          return { ...w, segs, parts: this.weekParts(w.week, weeks[i - 1]?.week), share: w.n ? Math.round(100 * marked / w.n) + '%' : '' };
        });
      },
      // The categories the weeks use, each with its share of the last column
      // drawn, so the marked chip and the figure over that column agree.
      measureCats(m){
        const v = this.measureView(m);
        if (!v) return [];
        const weeks = v.weeks, end = [...weeks].reverse().find(w => w.n) || weeks[weeks.length - 1];
        return v.cats.filter(c => weeks.some(w => w.counts[c.key])).map(c => ({
          ...c, last: end?.n ? Math.round(100 * (end.counts[c.key] || 0) / end.n) + '%' : '',
          tip: (c.glyph ? c.name + ': ' : '') + (end?.n ? 'share of ' + v.unit + ' in the week of ' + this.weekLabel(end.week) : '') }));
      },
      measurePeek(m){
        const a = window.RepoAddress?.parse(m);
        return a ? (window.SourcePeek?.addr(a.repo, a.ref || 'main', a.path) || null) : null;
      },
      measureTip(m, w){
        const v = this.measureView(m), mark = this.measureMarkOf(m);
        return {
          title: 'Week of ' + this.weekLabel(w.week) + (w.partial ? ', partly covered' : ''),
          sub: w.n.toLocaleString() + ' ' + (v?.unit || 'turns'),
          rows: (v?.cats || []).filter(c => w.counts[c.key]).sort((a, b) => w.counts[b.key] - w.counts[a.key])
            .map(c => ({ label: c.label, n: w.counts[c.key].toLocaleString(), share: Math.round(100 * w.counts[c.key] / w.n) + '%', on: c.key === mark })),
        };
      },
      measureNotes(m){
        const v = this.measureView(m);
        return { title: this.measureName(m), sub: v?.generated ? 'Written ' + this.agoOf(v.generated) : '', notes: v?.caveats || [] };
      },
      // Weeks start on Monday, as the measure files' own "Week of" does. The
      // Map keeps the same four for its own charts.
      weekOf(day){
        const d = new Date(String(day).slice(0, 10) + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
        return d.toISOString().slice(0, 10);
      },
      // Every week from the first to the last, so a week with nothing in it
      // stands as a gap rather than closing up.
      weekRange(first, last){
        const out = [];
        for (let d = new Date(first + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= last; d.setUTCDate(d.getUTCDate() + 7))
          out.push(d.toISOString().slice(0, 10));
        return out;
      },
      weekLabel(week, prev){
        const d = new Date(week + 'T00:00:00Z');
        const day = d.getUTCDate(), mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        return !prev || prev.slice(5, 7) !== week.slice(5, 7) ? mon + ' ' + day : String(day);
      },
      // As two lines for a column head: the month where it changes, over the
      // day, so narrow columns never print into each other.
      weekParts(week, prev){
        const d = new Date(week + 'T00:00:00Z');
        return { mon: !prev || prev.slice(5, 7) !== week.slice(5, 7) ? d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) : '',
                 day: String(d.getUTCDate()) };
      },

      // ── The chart panel-tip ──────────────────────────────────────────────
      chartTipIs(key){ return !!(this.chartTip && this.chartTip.key === key); },
      async wireChartTip(){
        if (this._chartTipWired) return;
        this._chartTipWired = true;
        await window.gh?.load?.('kits/panel-tip.js').catch(() => {});
        if (!window.PanelTip || !this.$refs.chartTip) return;
        // A mark scrolls with the page, so a scroll closes even a pinned
        // panel, and leaving the mark does not close one the reader pinned.
        window.PanelTip.wire(this.$refs.chartTip, { onClose: () => this.closeChartTip(), except: ['[data-chart-tip]'], stale: 'geometry' });
      },
      showChartTip(key, el, body, pinned){
        const r = el.getBoundingClientRect();
        const w = Math.min(innerWidth >= 768 ? 360 : 320, innerWidth - 16);
        this.chartTipClose = window.PanelTip ? window.PanelTip.closeHTML(pinned) : '';
        this.chartTip = { key, body, pinned, w, x: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)), y: r.bottom + 6 };
        this.$nextTick(() => {
          const t = this.$refs.chartTip;
          if (!t || !this.chartTip) return;
          const h = t.offsetHeight;
          if (r.bottom + 6 + h > innerHeight - 8) this.chartTip.y = Math.max(8, r.top - 6 - h >= 8 ? r.top - 6 - h : innerHeight - 8 - h);
        });
      },
      async toggleChartTip(key, el, body){
        clearTimeout(this._chartTipT);
        await this.wireChartTip();
        if (this.chartTipIs(key) && this.chartTip.pinned) return this.closeChartTip();
        this.showChartTip(key, el, body, true);
      },
      hoverChartTip(key, el, body){
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (this.chartTip?.pinned) return;
        clearTimeout(this._chartTipT);
        this._chartTipT = setTimeout(async () => { await this.wireChartTip(); this.showChartTip(key, el, body, false); }, 160);
      },
      leaveChartTip(){
        clearTimeout(this._chartTipT);
        if (!this.chartTip || this.chartTip.pinned) return;
        this._chartTipT = setTimeout(() => this.closeChartTip(), 240);
      },
      closeChartTip(){ clearTimeout(this._chartTipT); this.chartTip = null; },

      // What the app drawer's About tab shows for the program in view
      // (fab.js, pageAbout): its name, its scope, the declaration and the
      // charter it reads, and the charter as the subject a note addresses.
      get about(){
        const p = this.page;
        if (!p) return null;
        const src = (path, role) => ({ path, role, note: '', repo: p.repo, ref: p.ref || 'main',
          addr: p.repo + '@' + (p.ref || 'main') + ':' + path, href: this.peekHref(p, path),
          open: path === p.charter ? () => this.openCharter(p) : () => window.open(this.peekHref(p, path), '_blank', 'noopener') });
        return {
          title: p.label,
          subject: p.charter ? { about: p.repo + ':' + p.charter, label: p.label } : null,
          lede: p.scope ? [{ t: p.scope }] : [],
          sources: [src('.web-tools.json', 'Declaration'), p.charter && src(p.charter, 'Charter')].filter(Boolean),
          notes: [], sections: [], links: [{ label: 'Every program', run: () => this.openList() }],
        };
      },
    };
  });
});
