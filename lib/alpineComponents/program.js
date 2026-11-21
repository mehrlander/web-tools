// alpineComponents/program.js — one program as a page, at
// ?view=program&program=<name>.
//
// A program organizes work around an ongoing concern (docs/CONSTELLATION.md,
// Projects and research): a repository declares it under `programs` in its
// .web-tools.json, and the program's folder holds its charter as README.md.
// This is the program's own space in the app, shaped as the Project view is: a
// masthead on one line (the program's icon, which brings its own tile and opens the
// shell's anchored menu over every program, then its name, its charter, the
// Map's mark, which opens the app views that display it in that same kind of
// menu, a read again and its repository) beside the program's tab row, each
// tab carrying its count as a badge. The scope is the Map's list's, not
// repeated here. The tabs are the
// charter's areas as a dashboard of tiles, one an area, each showing the
// panels the manifest declares for it (programs[].areas); the measures drawn
// as weekly columns; the latest commits to the files it governs; its open
// tasks and, signed in, the notes on its charter. A tab the program has
// nothing for is left out. Where the pane is wide (a container query, about
// 1000px of pane) the Areas tab stands its tiles beside a side panel of what
// the Changes, Tasks and Notes tabs hold, compactly: the commits by day, each
// marked with its areas' icons, the tasks and the notes; a picked tile
// narrows the commits to its area and rides the address as &area=. The view
// moved here from the Map's Programs tab on 2026-11-18, where it was a page
// inside the Map under two rows of tabs; the Map keeps the list, on which
// every program compares with the others.
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
//                                 governs, measures, reviewers, views, areas
//                                 (its tiles' declarations, each { name, icon,
//                                 panels }), root (the declaring repository's
//                                 tracker)
//   Programs.iconSrc(p)           the program's SVG as a data URL, read at the
//                                 revision its declaration came from; '' until read
//   Programs.color(p)             the first solid fill of that SVG, the program's
//                                 one colour (docs/favicons/README.md, Drawn
//                                 marks); '' until read, or for a glyph or a mark
//                                 filled with currentColor
//   Programs.mdLinks(md)          an inline Markdown cell's links as written:
//                                 [{ text, href }]
//   Programs.repoPath(from, href) a relative link's repository path, resolved
//                                 from the file `from`; a folder keeps its
//                                 trailing slash; '' for a link with a scheme or
//                                 an anchor alone
//   Programs.touches(paths, targets)
//                                 whether a commit found under `paths` touched a
//                                 target: the same path, or one under a target
//                                 that is a folder
//   Programs.areaDays(commits, targets, now, n)
//                                 the commits that touched the targets, by local
//                                 day over the n days ending on now's:
//                                 { days: [{ day, n, commits }], count }
//   Programs.heatStart(now, weeks), heatDays(commits, targets, now, weeks)
//                                 the same as a heat grid read as a calendar: a
//                                 row a week, the newest at the bottom, a column
//                                 a weekday from Monday, as the measures' weeks
//                                 run, so the first cell is the Monday
//                                 `weeks` - 1 weeks before now's and the days
//                                 after now's are blank:
//                                 { days: [{ day, n, commits, future }],
//                                 count, first, last }
//   Programs.commitDays(lists, areas, since)
//                                 commits read under several sets of paths
//                                 joined by sha, each keeping every path it was
//                                 read under (a file before a folder) and the
//                                 keys of the areas whose links it touched,
//                                 newest first by local day, those before
//                                 `since` left out:
//                                 { days: [{ day, commits }], count }
//   Programs.readBoard(repo, ref, file, token)
//                                 a tracker's board.csv as open counts:
//                                 { deck, doing, blocked, byProject, openByProject },
//                                 null when unreadable
//   Programs.measureName(m)       a measure address's file name
//   Programs.viewLabel(v), viewIcon(v)
//                                 a view address's name and icon: a Map tab's own,
//                                 from window.MapTabs, else the view's key
//   Programs.areaIcon(p, name, decl)
//                                 an area's icon: the one its declaration names,
//                                 else that of the program's Map view of the same
//                                 name, else a dashed circle
//   Programs.pick(rows, where)    the rows whose every named column matches its
//                                 pattern
//   Programs.breakdown(rows, pn)  a breakdown panel's groups: { total, of, groups:
//                                 [{ key, label, icon, n, pct }], rest }, pct
//                                 against the largest group
//   Programs.groups(rows, pn)     a groups panel's chips: every group, largest
//                                 first, or those `only` names in its order,
//                                 each with its rows: { total, of, groups:
//                                 [{ key, label, icon, n, rows }] }
//   Programs.rowFile(tpl, row)    the repository file a row opens: `tpl` with
//                                 each {column} replaced by the row's value; ''
//                                 where a value is empty or the path climbs
//   Programs.panelWeight(pn, a), tileWant(panels)
//                                 how many columns a panel, and so its tile, asks
//                                 for where the pane holds more than two:
//                                 thumbnails, the estate's marks and long rows
//                                 two, a folded breakdown, one line, none, and
//                                 anything else one; a tile at most two
//   Programs.tileCols(w)          the tile grid's columns at a width: as many
//                                 13rem tracks as fit, and never fewer than two
//                                 where two half-width tiles can stand, so a phone
//                                 holds two
//   Programs.tileSpans(wants, cols)
//                                 tiles packed into rows of `cols` in their order:
//                                 each row takes the tiles that follow while they
//                                 fit, and the space left goes to the tiles that
//                                 asked for most, a tile that `grows` false (views
//                                 alone) last, each to at most twice what it asked
//                                 for, rather than to a later tile pulled forward;
//                                 what is left after that stays empty, so a last
//                                 tile alone on its row is not stretched across
//                                 it: [{ i, span }]
(() => {
  const HUB = 'mehrlander/web-tools';
  // The tile grid's tracks: 13rem where the pane is wide, and two half-width
  // tiles down to TILE_HALF each, so a 360px phone keeps two columns.
  const TILE_MIN = 208, TILE_HALF = 132, TILE_GAP = 12;
  // A repo-relative path a declaration may name: no scheme, drive, query or
  // climb. The Map's workPath holds research and projects to the same rule.
  const safePath = p => typeof p === 'string' && !/[:\\\r\n?#]/.test(p) &&
    p.split('/').every(s => s && s !== '.' && s !== '..');
  const ICONS_ASKED = new Set();
  let icons = null, colors = null;
  // A drawn mark's colour: its first fill that names one, so a mark filled
  // with currentColor, or none, gives ''.
  const fillOf = svg => (String(svg || '').match(/\bfill\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl|oklch)a?\([^)]*\))/) || [])[1] || '';
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const viewQuery = v => new URLSearchParams(String(v).replace(/^\?/, ''));
  const viewTab = v => { const tab = viewQuery(v).get('tab'); return tab ? window.MapTabs?.find?.(tab) || null : null; };
  // An area's declaration (programs[].areas): the charter area it names, its
  // icon and the panels its tile shows, each one of PANEL_KINDS. A panel the
  // view could not draw (a breakdown with no column, a gallery with no
  // source) is dropped here rather than drawn empty.
  const PANEL_KINDS = ['measure', 'breakdown', 'gallery', 'groups', 'views'];
  // A row's group: its `by` column, or the part of it before `split`.
  const groupKey = (r, pn) => {
    const k = String(r?.[pn.by] ?? '').trim();
    return pn.split && k.includes(pn.split) ? k.slice(0, k.indexOf(pn.split)) : k;
  };
  const strs = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : [];
  const strMap = (v, ok = () => true) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string' && ok(x))) : {};
  const word = v => typeof v === 'string' ? v : '';
  const glyphClass = v => typeof v === 'string' && v.startsWith('ph-') ? v : '';
  const patterns = v => Object.fromEntries(Object.entries(strMap(v)).filter(([, x]) => { try { new RegExp(x); return true; } catch { return false; } }));
  const panelOf = x => {
    if (!x || !PANEL_KINDS.includes(x.kind)) return null;
    const registry = typeof x.registry === 'string' && /\.csv$/.test(x.registry) && safePath(x.registry) ? x.registry : '';
    const source = ['research', 'repos'].includes(x.source) ? x.source : '';
    const pn = { kind: x.kind, registry: ['breakdown', 'gallery', 'groups'].includes(x.kind) ? registry : '',
      source: x.kind === 'gallery' && !registry ? source : '', by: word(x.by), split: word(x.split), only: strs(x.only),
      labels: strMap(x.labels), icons: strMap(x.icons, s => s.startsWith('ph-')), where: patterns(x.where),
      label: word(x.label), icon: word(x.icon), glyph: word(x.glyph), thumb: word(x.thumb), href: word(x.href),
      text: word(x.text), file: word(x.file), fold: x.kind === 'breakdown' && x.fold === true,
      limit: Number.isInteger(x.limit) && x.limit > 0 ? x.limit : 0, views: x.kind === 'views' ? strs(x.views) : [],
      // A research gallery may read another repository's declarations, named owner/repo.
      repo: source === 'research' && typeof x.repo === 'string' && /^[\w-][\w.-]*\/[\w-][\w.-]*$/.test(x.repo) ? x.repo : '' };
    if ((pn.kind === 'breakdown' || pn.kind === 'groups') && !(pn.registry && pn.by)) return null;
    if (pn.kind === 'gallery' && !(pn.source || (pn.registry && pn.label))) return null;
    if (pn.kind === 'groups' && !pn.label) return null;
    pn.sig = JSON.stringify(pn);
    return pn;
  };
  const areasOf = v => (Array.isArray(v) ? v : []).filter(a => a && typeof a.name === 'string' && a.name)
    .map(a => ({ name: a.name, icon: glyphClass(a.icon), panels: (Array.isArray(a.panels) ? a.panels : []).map(panelOf).filter(Boolean) }));
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
            areas: areasOf(p.areas),
            root: { kind: 'repo', repo: s.repo, ref: s.ref || '',
              tracker: typeof s.config.tracker === 'string' && safePath(s.config.tracker) ? s.config.tracker : '' } })));
    },
    // Read at the declaration's revision, so a branch that adds or moves a
    // mark shows it; asked once per file, outside the render that wanted it.
    iconSrc(p){
      if (!p?.iconFile || !window.GH) return '';
      icons ||= window.Alpine?.reactive ? window.Alpine.reactive({}) : {};
      colors ||= window.Alpine?.reactive ? window.Alpine.reactive({}) : {};
      const key = p.repo + '@' + (p.ref || '') + ':' + p.iconFile;
      if (!ICONS_ASKED.has(key)) {
        ICONS_ASKED.add(key);
        queueMicrotask(() => new window.GH({ token: window.TOKEN, repo: p.repo, ref: p.ref || 'main' }).get(p.iconFile)
          .then(j => { icons[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(j.text); colors[key] = fillOf(j.text); })
          .catch(() => {}));
      }
      return icons[key] || '';
    },
    // Read with the icon, from the same bytes.
    color(p){
      if (!p?.iconFile) return '';
      window.Programs.iconSrc(p);
      return colors?.[p.repo + '@' + (p.ref || '') + ':' + p.iconFile] || '';
    },
    mdLinks(md){
      const out = [], re = /\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
      for (let m; (m = re.exec(String(md || '')));) out.push({ text: m[1], href: m[2] });
      return out;
    },
    repoPath(from, href){
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return '';
      try {
        const u = new URL(href, 'https://repo/' + String(from || '').replace(/^\/+/, ''));
        const path = decodeURIComponent(u.pathname.slice(1));
        return path && safePath(path.replace(/\/$/, '')) ? path : '';
      } catch { return ''; }
    },
    touches(paths, targets){
      return (paths || []).some(f => (targets || []).some(t => f === t || (t.endsWith('/') && f.startsWith(t))));
    },
    areaDays(commits, targets, now = Date.now(), n = 14){
      const end = new Date(now), days = [];
      for (let i = n - 1; i >= 0; i--) days.push({ day: dayKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)), n: 0, commits: [] });
      const at = new Map(days.map(d => [d.day, d]));
      let count = 0;
      for (const c of commits || []) {
        const d = c?.date && at.get(dayKey(c.date));
        if (!d || !window.Programs.touches(c.paths, targets)) continue;
        d.n++; d.commits.push(c); count++;
      }
      return { days, count };
    },
    heatStart(now = Date.now(), weeks = 4){
      const t = new Date(now);
      return new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getDay() + 6) % 7 - 7 * (weeks - 1));
    },
    heatDays(commits, targets, now = Date.now(), weeks = 4){
      const t = new Date(now), back = (t.getDay() + 6) % 7;
      const r = window.Programs.areaDays(commits, targets, now, 7 * (weeks - 1) + back + 1);
      for (let i = 1; i < 7 - back; i++)
        r.days.push({ day: dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i)), n: 0, commits: [], future: true });
      return { ...r, first: r.days[0].day, last: dayKey(t) };
    },
    commitDays(lists, areas, since = 0){
      const bySha = new Map();
      for (const list of lists || []) for (const c of list || []) {
        if (!c?.sha || !c.date || Date.parse(c.date) < since) continue;
        const row = bySha.get(c.sha);
        if (row) { for (const f of c.paths || []) if (!row.paths.includes(f)) row.paths.push(f); row.url ||= c.url || ''; continue; }
        bySha.set(c.sha, { sha: c.sha, short: c.short || c.sha.slice(0, 7), date: c.date, subject: c.subject || '', url: c.url || '', paths: [...(c.paths || [])] });
      }
      const days = [], rows = [...bySha.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      for (const r of rows) {
        r.paths.sort((a, b) => a.endsWith('/') - b.endsWith('/'));
        r.areas = (areas || []).filter(a => a?.docs?.length && window.Programs.touches(r.paths, a.docs.map(d => d.path))).map(a => a.key);
        r.day = dayKey(r.date);
        const last = days[days.length - 1];
        if (last?.day === r.day) last.commits.push(r); else days.push({ day: r.day, commits: [r] });
      }
      return { days, count: rows.length };
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
    // The declared icon first, so a declaration can replace a view's icon
    // that reads poorly on a tile; a view other than a Map tab has only the
    // door, which says nothing about an area.
    areaIcon(p, name, decl){
      if (decl?.icon) return decl.icon;
      const v = (p?.views || []).find(v => viewTab(v) && window.Programs.viewLabel(v) === name);
      return v ? window.Programs.viewIcon(v) : 'ph-circle-dashed';
    },
    pick(rows, where){
      const w = Object.entries(where || {}).map(([k, x]) => [k, new RegExp(x)]);
      return (rows || []).filter(r => w.every(([k, re]) => re.test(String(r?.[k] ?? ''))));
    },
    // Grouped by one column, or by the part of it before `split`; the groups
    // `only` names, in its order and kept at nought, else every group,
    // largest first, the seventh on summed as the rest.
    breakdown(rows, pn){
      const kept = window.Programs.pick(rows, pn.where), counts = new Map();
      for (const r of kept) { const k = groupKey(r, pn); counts.set(k, (counts.get(k) || 0) + 1); }
      const group = (key, n) => ({ key, n, label: pn.labels?.[key] || key || 'none', icon: pn.icons?.[key] || '' });
      let groups = pn.only?.length ? pn.only.map(k => group(k, counts.get(k) || 0))
        : [...counts].map(([k, n]) => group(k, n)).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
      const rest = pn.only?.length ? [] : groups.slice(6);
      groups = groups.slice(0, pn.only?.length ? undefined : 6);
      const max = Math.max(1, ...groups.map(g => g.n));
      for (const g of groups) g.pct = Math.round(1000 * g.n / max) / 10;
      return { total: groups.reduce((t, g) => t + g.n, 0) + rest.reduce((t, g) => t + g.n, 0), of: (rows || []).length,
        groups, rest: { groups: rest.length, n: rest.reduce((t, g) => t + g.n, 0) } };
    },
    // Grouped as a breakdown is, every group kept, each with its rows in the
    // registry's order, since a chip is small enough that none need summing.
    groups(rows, pn){
      const at = new Map();
      for (const r of window.Programs.pick(rows, pn.where)) {
        const k = groupKey(r, pn);
        if (!at.has(k)) at.set(k, []);
        at.get(k).push(r);
      }
      const group = (key, rs) => ({ key, n: rs.length, rows: rs, label: pn.labels?.[key] || key || 'none', icon: pn.icons?.[key] || '' });
      const groups = pn.only?.length ? pn.only.map(k => group(k, at.get(k) || []))
        : [...at].map(([k, rs]) => group(k, rs)).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
      return { total: groups.reduce((t, g) => t + g.n, 0), of: (rows || []).length, groups };
    },
    rowFile(tpl, row){
      let whole = true;
      const path = String(tpl || '').replace(/\{([^{}]+)\}/g, (_, c) => { const v = String(row?.[c] ?? '').trim(); if (!v) whole = false; return v; });
      return tpl && whole && safePath(path) ? path : '';
    },
    // `n` is a gallery's item count where it is known before any read, as
    // research's is, from the manifest the program was declared in.
    panelWeight(pn, a, n){
      if (pn.kind === 'gallery') return pn.thumb || pn.source === 'repos' || (pn.source === 'research' && n > 2) ? 2 : 1;
      return pn.kind === 'breakdown' && pn.fold ? 0 : 1;
    },
    tileWant(panels){ return Math.max(1, Math.min(2, (panels || []).reduce((t, pn) => t + (pn.w ?? 1), 0))); },
    tileCols(w){ return w >= 2 * TILE_HALF + TILE_GAP ? Math.max(2, Math.min(8, Math.floor((w + TILE_GAP) / (TILE_MIN + TILE_GAP)))) : 1; },
    tileSpans(wants, cols, grows){
      cols = Math.max(1, cols | 0);
      const tiles = (wants || []).map((w, i) => ({ i, want: Math.max(1, Math.min(cols, w | 0 || 1)), grows: grows?.[i] !== false })), out = [];
      for (let k = 0; k < tiles.length;) {
        const row = [tiles[k++]];
        let left = cols - row[0].want;
        while (k < tiles.length && tiles[k].want <= left) { left -= tiles[k].want; row.push(tiles[k++]); }
        for (const t of row) t.span = t.want;
        const order = [...row].sort((a, b) => (b.grows - a.grows) || (b.want - a.want));
        for (let k = 0; left > 0 && order.some(t => t.span < 2 * t.want); k++) {
          const t = order[k % order.length];
          if (t.span < 2 * t.want) { t.span++; left--; }
        }
        for (const t of row) out.push({ i: t.i, span: t.span });
      }
      return out;
    },
  };
})();

document.addEventListener('alpine:init', function() {
  const HUB = 'mehrlander/web-tools';
  // A program page's recent changes: at most this many, read from at most this
  // many governed paths when signed out (loadCommits), and the days the count
  // of recent commits looks back (recent).
  const PROGRAM_COMMITS = 15, PROGRAM_PUBLIC_PATHS = 8, PROGRAM_RECENT_DAYS = 14;
  // An area's heat grid: its weeks, a row each, and the pages of a hundred
  // commits read a linked path at most, which a regenerated registry can run
  // past in four weeks.
  const PROGRAM_HEAT_WEEKS = 4, PROGRAM_HEAT_PAGES = 4;
  // The side panel's commits drawn at first, whole days at a time, and how
  // many more each tap on what is left draws.
  const RAIL_STEP = 60, RAIL_NONE = Object.freeze([]);
  // The web-tools ref the hub's declarations are read at: the selection, else
  // ?use=, else main, as the Map reads them, so a preview of a branch shows the
  // branch's programs.
  const useRef = () => {
    try { return window.GH?.refFor?.(HUB) || new URLSearchParams(location.search).get('use') || 'main'; }
    catch { return 'main'; }
  };
  // Another repository's ref: what the selection names for it, else main.
  const selRef = (repo, path) => window.GH?.refFor?.(repo, path) || 'main';
  // The weeks a tile's sparkline draws at most, the newest; the Measures tab
  // draws them all.
  const TILE_WEEKS = 26;
  // A measure file's weekly view, by the parsed file it came from, so drawing a
  // measure never writes reactive state.
  const MEASURE_VIEWS = new WeakMap();
  // A panel's drawing, by the registry rows it came from and the panel's
  // declaration, so drawing a tile never regroups rows it already grouped.
  const PANEL_VIEWS = new WeakMap();
  const memoPanel = (rows, sig, make) => {
    const raw = window.Alpine?.raw ? window.Alpine.raw(rows) : rows;
    let at = PANEL_VIEWS.get(raw);
    if (!at) PANEL_VIEWS.set(raw, at = new Map());
    if (!at.has(sig)) at.set(sig, make(raw));
    return at.get(sig);
  };
  // A file's bytes on raw.githubusercontent, which is not rate-limited, and a
  // page on the repository's Pages site.
  const rawUrl = (p, path) => 'https://raw.githubusercontent.com/' + p.repo + '/' + (p.ref || 'main') + '/' + path;
  const pagesUrl = (p, path) => { const [owner, name] = p.repo.split('/'); return 'https://' + owner + '.github.io/' + name + '/' + path; };
  // An area's heat grid, by the commits it was counted from, kept outside the
  // component so drawing a tile never writes reactive state.
  const HEATS = new WeakMap();
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
  // `tag` sees each link with its href as written.
  const inlineMd = (s, resolve, tag, plain) => {
    if (!s) return '';
    const d = document.createElement('div');
    d.innerHTML = window.marked?.parseInline ? window.marked.parseInline(s) : window.esc(s);
    for (const a of d.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href');
      tag?.(a, h);
      if (!/^(https?:|#)/.test(h) && resolve) a.setAttribute('href', resolve(h) || h);
      a.setAttribute('target', '_blank');
      a.className = plain ? '' : 'link link-primary';
    }
    for (const c of d.querySelectorAll('code')) plain && c.closest('a') ? c.replaceWith(c.textContent) : (c.className = 'font-mono');
    return d.innerHTML;
  };
  const textOf = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.trim(); };
  // A document an area links: its icon by kind, and its name: a folder's
  // whole path, a file's last segment, with its folder where the name is a
  // folder's index (README.md, SKILL.md), which says nothing alone.
  const DOC_ICONS = { md: 'ph-file-text', csv: 'ph-file-csv', json: 'ph-file-code', html: 'ph-file-html', js: 'ph-file-js', mjs: 'ph-file-js', py: 'ph-file-py' };
  const docIcon = path => path.endsWith('/') ? 'ph-folder' : DOC_ICONS[path.split('.').pop().toLowerCase()] || 'ph-file';
  const docName = path => {
    if (path.endsWith('/')) return path;
    const s = path.split('/'), base = s.pop();
    return (/^(README|SKILL|index)\.\w+$/i.test(base) && s.length ? s.pop() + '/' : '') + base;
  };
  // Whether a Measures cell names a file: the path whole, not inside a longer one.
  const namesPath = (cell, path) => new RegExp('(^|[^\\w.-])' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w./-])').test(String(cell || ''));

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
                                            :class="[w.partial ? 'opacity-50' : '', chartTipIs('m:' + m + ':' + w.week) ? 'ring-2 ring-[var(--color-primary)]/40' : '']">
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

  // The Areas tab, the program at a glance, with `p` in scope and the
  // program's colour as --program. A tile an area, every one at once and
  // each at word size, so a phone holds them side by side: a top line (the
  // area's icon in the program's colour, which opens its Covers sentence in a
  // panel-tip, its name, and its heat grid, the icon's height), the
  // files its Covers cell links that no panel's head names, then the panels
  // its declaration names (programs[].areas), each drawn in one shared style:
  // a measure as a sparkline of its weekly share (the full chart is the
  // Measures tab's), a breakdown a line a group, a gallery as chips, and
  // groups as one row of icon chips, each opening its rows in a panel-tip. On a
  // phone every tile is half the width; where the pane holds more columns a
  // tile is as wide as its panels ask (Programs.panelWeight), the rows in the
  // charter's order (Programs.tileSpans). Either way a tile spans pixel rows
  // by its height (watchTile), so a short one leaves no hole under it.
  const pc = 'var(--program)';
  const wash = n => 'color-mix(in_oklab,' + pc + '_' + n + '%,var(--color-base-100))';
  // A label a narrow tile may cut short: whole in a title-tip, and only
  // where it was cut, measured again when the columns change.
  const fitLabel = (text, extra = '') => `class="min-w-0 truncate${extra}"
                                                x-effect="areaCols; tabOf(p); fitTip($el, ${text})"`;
  // A panel's head, the one line every kind opens with: its kind's icon, its
  // source, what it is grouped by, and its count. What it is grouped by gives
  // way first, and on a tile too narrow for it (a phone's) it is left out:
  // the groups under it say it.
  const panelHead = (icon, src, by, count, byWhole) => `
                                  <div class="flex items-center gap-1.5 min-w-0 text-xs leading-4 text-base-content/50" data-panel-head>
                                    <i class="ph ${icon} shrink-0 text-sm"></i>${src}
                                    ${by ? byWhole ? `<span class="shrink-0 whitespace-nowrap" x-text="${by}"></span>` : `<span ${fitLabel(by, ' shrink-[10] hidden @min-[12rem]:block')} x-text="${by}"></span>` : ''}
                                    ${count ? `<span class="ml-auto shrink-0 tabular-nums whitespace-nowrap" x-text="${count}"></span>` : ''}
                                  </div>`;
  const regLink = expr => `<a x-blob="peek(p, ${expr})" class="min-w-0 truncate font-medium rounded-sm transition-colors hover:text-primary"
                                 :class="fileHover === t.a.key + '|' + ${expr} && 'bg-primary/10 text-primary'" :data-panel-file="${expr}"
                                 @mouseenter="fileHover = t.a.key + '|' + ${expr}" @mouseleave="fileHover = ''" x-text="regName(${expr})"></a>`;
  // A read that has not landed, said once for every kind.
  const panelState = expr => `
                                  <p x-show="${expr} === 'loading'" class="text-sm text-base-content/40">Loading…</p>
                                  <p x-show="${expr} === 'locked'" class="text-sm text-base-content/50">Sign in to read it.</p>
                                  <p x-show="${expr} === 'missing'" class="text-sm text-base-content/50">Not there at this revision.</p>
                                  <p x-show="${expr} === 'error'" class="text-sm text-error">Could not read it.</p>`;
  // What a gallery leaves out, as the last item of its row.
  const galleryMore = `<span x-show="galleryShown(galleryOf(p, pn), pn, t.span).more" class="shrink-0 px-1 text-xs tabular-nums text-base-content/50" data-gallery-more
                                            x-text="'+' + galleryShown(galleryOf(p, pn), pn, t.span).more"></span>`;
  const areasPanel = `
                  <div class="flex flex-col gap-2 min-w-0" data-pattern="card-grid">
                    <!-- Signed out past the read limit, how many linked paths
                         were read, said once for every tile's grid. -->
                    <span x-show="activityOf(p).total && activityOf(p).read.length < activityOf(p).total"
                          class="self-end px-1 text-xs tabular-nums text-base-content/45" data-title-tip="Signed in, every linked path is read" data-program-areas-read
                          x-text="'From ' + activityOf(p).read.length + ' of ' + activityOf(p).total + ' paths'"></span>
                    <!-- Tiles in the charter's order, each as tall as its
                         content, on rows a pixel tall that each tile spans by
                         its height (watchTile), so a short tile leaves no hole
                         under it and the next one rises into the space; the
                         grid places them in order and never back up. -->
                    <div class="grid gap-x-2 sm:gap-x-3 gap-y-2 sm:gap-y-3 items-start" :style="'grid-template-columns:repeat(' + areaCols + ',minmax(0,1fr))' + (packs() ? ';grid-auto-rows:1px;row-gap:0' : '')"
                         data-part="list" data-program-tiles :data-cols="areaCols" x-init="watchTiles($el)">
                      <!-- Beside the side panel a tap on a tile, off its
                           controls, picks its area, and a tile and its
                           commits mark each other under the pointer. -->
                      <template x-for="t in tilesOf(p)" :key="t.a.key">
                        <article class="@container flex flex-col gap-2 min-w-0 p-2 sm:p-3 rounded-xl border border-base-300 bg-base-100 shadow-sm transition-[box-shadow,border-color] @min-[60rem]:cursor-pointer @min-[60rem]:hover:border-[${wash(45)}]"
                                 :class="isPicked(t.a) ? '@min-[60rem]:ring-2 @min-[60rem]:ring-[${pc}]' : tileHot(t.a) ? 'ring-2 ring-[${pc}]/40' : ''"
                                 :style="{ gridColumn: 'span ' + t.span }" :data-span="t.span" :data-want="t.want" x-init="watchTile($el)"
                                 @click="tileClick(t.a, $event)" @mouseenter="hoverArea = t.a.key" @mouseleave="hoverArea = ''"
                                 :data-picked="isPicked(t.a) ? '' : null" :data-hot="tileHot(t.a) ? '' : null"
                                 data-part="item" data-program-area :data-area="t.a.key">
                          <header class="flex flex-col gap-1.5 min-w-0">
                            <!-- The icon, which opens what the area covers in
                                 the charter's words and wears the info mark as
                                 the program's mark wears its caret, so the name
                                 keeps the line's width; the name, cut short
                                 before the grid gives way; the heat grid. -->
                            <div class="flex items-start gap-1 sm:gap-1.5 min-w-0" data-part="title">
                              <button type="button" :disabled="!t.a.covers" data-chart-tip data-area-covers data-area-icon :data-icon="t.icon"
                                      @click="toggleChartTip('c:' + t.a.key, $el, coversTip(t.a))"
                                      @mouseenter="hoverChartTip('c:' + t.a.key, $el, coversTip(t.a))" @mouseleave="leaveChartTip()"
                                      class="relative shrink-0 size-7 rounded-lg grid place-items-center bg-[${wash(12)}] text-[${pc}] transition-shadow hover:ring-2 hover:ring-[${pc}]/30"
                                      :class="chartTipIs('c:' + t.a.key) && 'ring-2 ring-[${pc}]/40'" :aria-label="'What ' + t.a.label + ' covers'">
                                <i class="text-lg" :class="[t.icon.startsWith('ph-') ? 'ph-duotone' : '', t.icon]"></i>
                                <i x-show="t.a.covers" class="ph-bold ph-info absolute -bottom-1 -right-1 text-[10px] leading-none rounded-full bg-base-100 p-px text-base-content/50"></i></button>
                              <h3 ${fitLabel('t.a.label', ' flex-1 py-1 text-sm font-bold leading-5 tracking-tight rounded-sm')} x-html="t.a.area"
                                  :tabindex="railOn ? 0 : null" :role="railOn ? 'button' : null" :aria-pressed="railOn ? String(isPicked(t.a)) : null"
                                  @keydown="tileKey(t.a, $event)"></h3>
                              <!-- The heat grid, read as a calendar: a row a
                                   week, the newest at the bottom, a column a
                                   weekday from Monday, each day shaded by its
                                   commits to what the area links; as tall as
                                   the icon, so a little wider, and padded only
                                   to that height, the name's pixel kept. Its
                                   span in a title-tip; a day with commits
                                   opens them. -->
                              <template x-if="t.a.docs.length">
                                <div class="shrink-0 h-7 grid grid-cols-[repeat(7,6px)] grid-rows-[repeat(4,6px)] gap-px py-[0.5px] rounded-[3px] overflow-hidden"
                                     :class="heatOf(p, t.a).state === 'unread' ? 'outline-1 outline-dashed -outline-offset-1 outline-[color-mix(in_oklab,var(--color-base-content)_25%,transparent)]' : heatOf(p, t.a).state === 'loading' ? 'motion-safe:animate-pulse' : ''"
                                     role="group" :aria-label="heatOf(p, t.a).tip"
                                     :data-title-tip="dayOpenIn(t.a) ? null : heatOf(p, t.a).tip"
                                     data-area-heat :data-area-state="heatOf(p, t.a).state" :data-count="heatOf(p, t.a).count">
                                  <template x-for="d in heatOf(p, t.a).days" :key="d.day">
                                    <button type="button" :disabled="d.n < 1" data-chart-tip :data-day="d.day" :data-n="d.n" :data-future="d.future ? '' : null"
                                            class="block rounded-[1px]" :class="(chartTipIs('d:' + t.a.key + ':' + d.day) || dayHot(t.a, d)) && 'outline-1 outline-[var(--color-base-content)]'"
                                            :data-hot="dayHot(t.a, d) ? '' : null"
                                            :style="'background:' + heatFill(d, heatOf(p, t.a).state)"
                                            @click="d.n > 0 && openDay(t.a, d, $el)"
                                            :aria-label="d.n > 0 ? dayTip(d).title + ': ' + dayTip(d).sub : null"></button>
                                  </template>
                                </div>
                              </template>
                            </div>
                            <!-- The files it links, less any a panel's head
                                 names, cut short where the tile is narrow. -->
                            <div x-show="t.chips.length" class="flex flex-wrap gap-1 min-w-0" data-part="links" data-area-docs>
                              <template x-for="d in t.chips" :key="d.path">
                                <a :href="d.dir ? treeHref(p, d.path) : peekHref(p, d.path)" target="_blank" rel="noopener" :data-peek="d.dir ? null : peek(p, d.path)"
                                   @click="if (!d.dir && !$event.metaKey && !$event.ctrlKey && !$event.shiftKey) { $event.preventDefault(); openFile(p, d.path); }"
                                   @mouseenter="fileHover = t.a.key + '|' + d.path" @mouseleave="fileHover = ''"
                                   class="inline-flex items-center gap-1 min-w-0 max-w-full rounded-md px-1.5 text-xs leading-5 font-medium transition-colors"
                                   :class="fileHover === t.a.key + '|' + d.path ? 'bg-primary/10 text-primary' : 'bg-base-200/70 text-base-content/70 hover:text-primary'"
                                   :data-area-doc="d.path">
                                  <i class="ph text-sm shrink-0" :class="d.icon"></i><span ${fitLabel('d.path')} x-text="d.name"></span></a>
                              </template>
                            </div>
                          </header>
                          <!-- The panels, unboxed, since the tile is their box:
                               each opens with its head line, and panels in a
                               line share its height. -->
                          <div x-show="t.panels.length" class="flex flex-wrap items-stretch content-start gap-x-4 gap-y-2 min-w-0" data-part="body">
                            <template x-for="(pn, j) in t.panels" :key="t.a.key + ':' + j">
                              <section class="min-w-0 flex flex-col gap-1.5"
                                       :class="pn.kind === 'measure' && !t.a.measure.addr && 'rounded-lg border border-dashed border-base-300 px-2 py-1.5'"
                                       :style="pn.w ? 'flex:' + pn.w + ' 1 12rem' : 'flex:1 1 100%'" :data-panel="pn.kind">
                                <!-- measure: the marked category and its share of
                                     the last week, with what working means
                                     behind the target beside it; under them a
                                     sparkline the panel's width, a bar a week,
                                     the share on the baseline in the program's
                                     colour. -->
                                <template x-if="pn.kind === 'measure' && t.a.measure.addr">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-measure :data-measure="measureName(t.a.measure.addr)">
                                    ${panelHead('ph-chart-bar', `<a x-blob="measurePeek(t.a.measure.addr)" class="min-w-0 truncate font-mono hover:text-primary" x-text="measureName(t.a.measure.addr).replace(/\\.json$/, '')"></a>`, 'measureRange(t.a.measure.addr)', '', true)}
                                    ${panelState('measureState(t.a.measure.addr)')}
                                    <div x-show="measureView(t.a.measure.addr)" class="flex flex-col gap-1 min-w-0 text-sm" data-area-spark>
                                      <div class="flex items-center gap-1.5 min-w-0">
                                        <span ${fitLabel("measureMarked(t.a.measure.addr)?.label || ''", ' flex-1')} x-text="measureMarked(t.a.measure.addr)?.label"></span>
                                        <span class="shrink-0 font-semibold tabular-nums" x-text="measureMarked(t.a.measure.addr)?.last"></span>
                                        <button type="button" x-show="t.a.measure.means" data-chart-tip data-area-means
                                                @click="toggleChartTip('w:' + t.a.key, $el, meansTip(t.a))"
                                                @mouseenter="hoverChartTip('w:' + t.a.key, $el, meansTip(t.a))" @mouseleave="leaveChartTip()"
                                                class="shrink-0 inline-flex rounded text-base-content/40 hover:text-primary transition-colors" aria-label="What working means"
                                                :class="chartTipIs('w:' + t.a.key) && 'text-primary'">
                                          <i class="ph ph-target text-sm"></i></button>
                                      </div>
                                      <div class="h-6 flex items-stretch justify-end gap-[2px] min-w-0 overflow-hidden">
                                        <template x-for="w in tileWeeks(t.a.measure.addr)" :key="w.week">
                                          <button type="button" data-chart-tip :data-week="w.week"
                                                  @click="toggleChartTip('a:' + t.a.key + ':' + w.week, $el, measureTip(t.a.measure.addr, w))"
                                                  @mouseenter="hoverChartTip('a:' + t.a.key + ':' + w.week, $el, measureTip(t.a.measure.addr, w))" @mouseleave="leaveChartTip()"
                                                  :aria-label="'Week of ' + weekLabel(w.week) + ': ' + (w.share || 'none')"
                                                  class="flex-1 min-w-[3px] max-w-3 flex flex-col-reverse rounded-[2px] overflow-hidden bg-base-content/10"
                                                  :class="[w.partial ? 'opacity-50' : '', chartTipIs('a:' + t.a.key + ':' + w.week) ? 'ring-2 ring-[${pc}]/40' : '']">
                                            <span class="block w-full shrink-0 bg-[${pc}]" :style="'height:' + markedPct(t.a.measure.addr, w) + '%'"></span>
                                          </button>
                                        </template>
                                      </div>
                                    </div>
                                  </div>
                                </template>
                                <!-- A Measures row that names no measure yet: the
                                     charter's own words, muted. -->
                                <template x-if="pn.kind === 'measure' && !t.a.measure.addr">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-measure="none">
                                    <div class="flex items-center gap-1.5 min-w-0 text-xs leading-4 text-base-content/50" data-panel-head>
                                      <i class="ph ph-chart-bar shrink-0 text-sm"></i><span class="min-w-0 truncate">No measure yet</span>
                                      <button type="button" x-show="t.a.measure.means" data-chart-tip data-area-means
                                              @click="toggleChartTip('w:' + t.a.key, $el, meansTip(t.a))"
                                              @mouseenter="hoverChartTip('w:' + t.a.key, $el, meansTip(t.a))" @mouseleave="leaveChartTip()"
                                              class="ml-auto shrink-0 rounded hover:text-primary" aria-label="What working means">
                                        <i class="ph ph-target text-base"></i></button>
                                    </div>
                                    <p x-show="t.a.measure.cell" class="text-sm text-base-content/50 break-words" x-html="t.a.measure.cell"></p>
                                  </div>
                                </template>
                                <!-- breakdown: a registry grouped by one column, a
                                     line a group, a thin bar along its foot
                                     against the largest, inside the line's own
                                     box rather than a line of its own. -->
                                <template x-if="pn.kind === 'breakdown' && !pn.fold">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-breakdown :data-registry="pn.registry" :data-by="pn.by">
                                    ${panelHead('ph-file-csv', regLink('pn.registry'), "'by ' + pn.by", 'countOf(breakdownOf(p, pn))')}
                                    ${panelState('breakdownOf(p, pn).state')}
                                    <ul x-show="breakdownOf(p, pn).state === 'ok'" class="flex flex-col gap-0.5 min-w-0">
                                      <template x-for="g in breakdownOf(p, pn).groups" :key="g.key">
                                        <li class="flex items-start gap-x-1.5 min-w-0 text-sm leading-5" data-breakdown-group :data-group="g.key" :data-n="g.n">
                                          <i x-show="g.icon" class="ph shrink-0 w-4 text-base leading-5 text-base-content/55" :class="g.icon"></i>
                                          <div class="relative flex-1 flex items-center gap-1.5 min-w-0 pb-1">
                                            <span ${fitLabel('g.label', ' flex-1')} x-text="g.label"></span>
                                            <span class="shrink-0 tabular-nums font-medium" :class="g.n ? '' : 'text-base-content/40'" x-text="g.n.toLocaleString()"></span>
                                            <span class="absolute bottom-0 inset-x-0 h-[3px] rounded-full bg-base-content/10 overflow-hidden">
                                              <span class="block h-full rounded-full bg-base-content/40" data-bar :style="'width:' + g.pct + '%'"></span></span>
                                          </div>
                                        </li>
                                      </template>
                                    </ul>
                                    <p x-show="breakdownOf(p, pn).rest.groups" class="text-xs tabular-nums text-base-content/50"
                                       x-text="'and ' + breakdownOf(p, pn).rest.n.toLocaleString() + ' in ' + plural(breakdownOf(p, pn).rest.groups, 'more group')"></p>
                                  </div>
                                </template>
                                <!-- A breakdown declared fold: its head line
                                     alone, which opens every group, its icon,
                                     count and share, in the chart panel-tip, for
                                     a tile with no height to spare. -->
                                <template x-if="pn.kind === 'breakdown' && pn.fold">
                                  <div class="flex flex-col min-w-0" data-area-breakdown data-fold :data-registry="pn.registry" :data-by="pn.by">
                                    <button type="button" :disabled="breakdownOf(p, pn).state !== 'ok'" data-chart-tip data-panel-head
                                            aria-haspopup="dialog" :aria-expanded="String(chartTipIs('f:' + t.a.key + ':' + pn.registry))"
                                            @click="toggleChartTip('f:' + t.a.key + ':' + pn.registry, $el, foldTip(p, pn))"
                                            @mouseenter="hoverChartTip('f:' + t.a.key + ':' + pn.registry, $el, foldTip(p, pn))" @mouseleave="leaveChartTip()"
                                            class="-mx-1 px-1 h-6 flex items-center gap-1.5 min-w-0 rounded-md text-left text-xs leading-4 transition-colors"
                                            :class="chartTipIs('f:' + t.a.key + ':' + pn.registry) ? 'bg-primary/10 text-primary' : 'text-base-content/50 hover:text-primary'">
                                      <i class="ph ph-file-csv shrink-0 text-sm"></i>
                                      <span class="min-w-0 truncate font-medium" x-text="regName(pn.registry)"></span>
                                      <span ${fitLabel("'by ' + pn.by", ' shrink-[10] hidden @min-[12rem]:block')} x-text="'by ' + pn.by"></span>
                                      <span class="ml-auto shrink-0 tabular-nums" x-text="countOf(breakdownOf(p, pn))"></span>
                                      <i class="ph ph-caret-down shrink-0 text-xs text-base-content/40"></i></button>
                                    ${panelState('breakdownOf(p, pn).state')}
                                  </div>
                                </template>
                                <!-- groups: one row of chips for a run of groups
                                     panels, each registry named once in the head
                                     with its count; a chip a group, its icon and
                                     count, which opens the group's rows in the
                                     chart panel-tip, a name each opening its
                                     file. Four chips to a phone's half-width
                                     tile, so its row wraps once. -->
                                <template x-if="pn.kind === 'groups'">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-groups>
                                    <div class="flex items-center gap-1.5 min-w-0 text-xs leading-4 text-base-content/50" data-panel-head>
                                      <i class="ph ph-file-csv shrink-0 text-sm"></i>
                                      <template x-for="(q, k) in pn.parts" :key="q.sig">
                                        <span class="contents">
                                          <template x-if="k"><span class="shrink-0" aria-hidden="true">·</span></template>
                                          ${regLink('q.registry')}
                                          <span class="shrink-0 tabular-nums" x-text="groupsOf(p, q).state === 'ok' ? groupsOf(p, q).total.toLocaleString() : ''"></span>
                                        </span>
                                      </template>
                                    </div>
                                    ${panelState('groupsState(p, pn)')}
                                    <div x-show="groupsState(p, pn) === 'ok'" class="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 min-w-0">
                                      <template x-for="c in chipsOf(p, pn, t.a.key)" :key="c.key">
                                        <button type="button" :disabled="!c.g.n" data-chart-tip data-groups-chip :data-group="c.g.key" :data-n="c.g.n" :data-registry="c.q.registry"
                                                aria-haspopup="dialog" :aria-expanded="String(chartTipIs(c.tip))" :aria-label="c.g.label + ': ' + c.g.n"
                                                @click="toggleChartTip(c.tip, $el, groupTip(p, c.q, c.g))"
                                                @mouseenter="hoverChartTip(c.tip, $el, groupTip(p, c.q, c.g))" @mouseleave="leaveChartTip()"
                                                class="h-6 min-w-0 inline-flex items-center justify-center gap-0.5 rounded-full px-1 text-xs tabular-nums transition-colors"
                                                :class="chartTipIs(c.tip) ? 'bg-primary/10 text-primary' : c.g.n ? 'bg-base-200/70 text-base-content/70 hover:text-primary' : 'bg-base-200/40 text-base-content/30'">
                                          <i class="ph-duotone shrink-0 text-sm" :class="c.g.icon || 'ph-circle'"></i><span x-text="c.g.n"></span></button>
                                      </template>
                                    </div>
                                  </div>
                                </template>
                                <!-- gallery: items as small thumbnails, chips with
                                     their marks, plain chips or dated rows, as
                                     their content asks (galleryOf). -->
                                <template x-if="pn.kind === 'gallery'">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-gallery :data-layout="galleryOf(p, pn).layout">
                                    <div class="flex items-center gap-1.5 min-w-0 text-xs leading-4 text-base-content/50" data-panel-head>
                                      <i class="ph shrink-0 text-sm" :class="galleryOf(p, pn).icon"></i>
                                      <template x-if="pn.registry">${regLink('pn.registry')}</template>
                                      <template x-if="pn.source === 'research'"><a x-blob="peek(pn.repo ? { repo: pn.repo } : p, '.web-tools.json')" class="min-w-0 truncate font-medium hover:text-primary">research</a></template>
                                      <template x-if="pn.source === 'repos'"><button type="button" @click="openRepos()" class="min-w-0 truncate font-medium hover:text-primary">Estate</button></template>
                                      <span class="ml-auto shrink-0 tabular-nums" x-text="countOf(galleryOf(p, pn))"></span>
                                    </div>
                                    ${panelState('galleryOf(p, pn).state')}
                                    <div x-show="galleryOf(p, pn).layout === 'thumbs'" class="flex items-center gap-1.5 min-w-0">
                                      <div class="flex-1 grid gap-1.5 min-w-0" :style="'grid-template-columns:repeat(' + (galleryShown(galleryOf(p, pn), pn, t.span).cols || 1) + ',minmax(0,1fr))'">
                                        <template x-for="it in (galleryOf(p, pn).layout === 'thumbs' ? galleryShown(galleryOf(p, pn), pn, t.span).items : [])" :key="it.key">
                                          <a :href="it.href || null" target="_blank" rel="noopener" class="group flex flex-col gap-0.5 min-w-0" data-gallery-item>
                                            <img :src="it.thumb" alt="" loading="lazy" class="block w-full aspect-[4/3] object-cover object-top rounded-md border border-base-300 bg-base-100 transition-colors group-hover:border-[${pc}]">
                                            <span class="truncate text-sm leading-5 text-base-content/70 group-hover:text-primary" x-text="it.label"></span></a>
                                        </template>
                                      </div>
                                      ${galleryMore}
                                    </div>
                                    <div x-show="galleryOf(p, pn).layout === 'icons'" class="flex flex-wrap items-center gap-1 min-w-0">
                                      <template x-for="it in (galleryOf(p, pn).layout === 'icons' ? galleryShown(galleryOf(p, pn), pn, t.span).items : [])" :key="it.key">
                                        <div class="relative inline-flex items-center gap-1 min-w-0 max-w-full rounded-full bg-base-200/70 px-1.5 text-sm leading-5 transition-colors has-[button:hover]:text-primary" data-gallery-item>
                                          <button type="button" x-show="!!it.repo" @click="openRepoOf(it.repo)" :aria-label="'Open ' + it.repo" x-html="it.markHtml"
                                                  class="shrink-0 inline-flex text-sm leading-none text-base-content/70 after:absolute after:inset-0 after:rounded-full"></button>
                                          <span x-show="!it.repo" x-html="it.markHtml" class="shrink-0 inline-flex text-sm leading-none text-base-content/70"></span>
                                          <span ${fitLabel('it.label')} x-text="it.label"></span>
                                        </div>
                                      </template>
                                      ${galleryMore}
                                    </div>
                                    <div x-show="galleryOf(p, pn).layout === 'chips'" class="flex flex-wrap items-center gap-1 min-w-0">
                                      <template x-for="it in (galleryOf(p, pn).layout === 'chips' ? galleryShown(galleryOf(p, pn), pn, t.span).items : [])" :key="it.key">
                                        <a x-blob="it.peek || ''" class="inline-flex min-w-0 max-w-full rounded-full bg-base-200/70 px-1.5 text-sm leading-5 hover:text-primary" data-gallery-item
                                           ><span ${fitLabel('it.label')} x-text="it.label"></span></a>
                                      </template>
                                      ${galleryMore}
                                    </div>
                                    <ul x-show="galleryOf(p, pn).layout === 'rows'" class="flex flex-col gap-0.5 min-w-0">
                                      <template x-for="it in (galleryOf(p, pn).layout === 'rows' ? galleryShown(galleryOf(p, pn), pn, t.span).items : [])" :key="it.key">
                                        <li class="flex items-baseline gap-2 min-w-0" data-gallery-item>
                                          <span x-show="galleryOf(p, pn).items.some(x => x.day)" class="shrink-0 w-12 text-xs tabular-nums text-base-content/50" x-text="it.day"></span>
                                          <a x-blob="it.peek || ''" class="min-w-0 truncate text-sm leading-5 hover:text-primary" x-text="it.label"></a></li>
                                      </template>
                                      <li x-show="galleryShown(galleryOf(p, pn), pn, t.span).more" class="text-xs tabular-nums text-base-content/50" data-gallery-more
                                          x-text="'+' + galleryShown(galleryOf(p, pn), pn, t.span).more"></li>
                                    </ul>
                                  </div>
                                </template>
                                <!-- views: the area's app views, as the masthead's
                                     menu lists the program's. -->
                                <template x-if="pn.kind === 'views'">
                                  <div class="flex flex-col gap-1.5 min-w-0" data-area-views>
                                    ${panelHead('ph-app-window', '<span>Views</span>', '', '')}
                                    <div class="flex flex-wrap gap-x-3 gap-y-1">
                                      <template x-for="v in viewsOf(p, t.a, pn)" :key="v">
                                        <a :href="viewHref(v)" @click="if (!$event.metaKey && !$event.ctrlKey && !$event.shiftKey) { $event.preventDefault(); openView(v); }"
                                           class="inline-flex items-center gap-1.5 text-sm leading-6 text-base-content/80 hover:text-primary" data-area-view>
                                          <i class="ph text-base text-base-content/50" :class="viewIcon(v)"></i><span x-text="viewLabel(v)"></span></a>
                                      </template>
                                    </div>
                                  </div>
                                </template>
                              </section>
                            </template>
                          </div>
                        </article>
                      </template>
                    </div>
                  </div>`;

  // The room the app's floating button takes over a column's foot, as
  // estate.js leaves it, at the end of the panel's last scrolling section.
  const FAB_ROOM = 'pb-[calc(var(--fab-bottom,1.5rem)+2.5rem)]';

  // The Areas tab's side panel where the pane is wide (the rail): what the
  // Changes, Tasks and Notes tabs hold, compactly, in one column beside the
  // tiles, each section scrolling on its own. The commits are those the
  // Changes tab and the tiles' heat grids read, over the grids' four weeks
  // (Programs.commitDays): a day a heading, each commit under it marked with
  // the icons of the areas whose links it touched. A picked tile narrows them
  // to its area, as its heat grid counts them, under a chip that clears it;
  // the tasks and notes name no file, so they stay whole. Shown by the pane's
  // container query alone, with `p` in scope. A section's name opens its tab.
  const railHead = (icon, label, tab, count, rest = '', countTip = '') => `
                    <div class="shrink-0 flex items-center gap-1.5 min-w-0 h-9 px-3 text-xs leading-4 text-base-content/50" data-rail-head>
                      <button type="button" @click="setTab('${tab}')" class="shrink-0 inline-flex items-center gap-1 font-medium rounded-sm transition-colors hover:text-primary"
                              aria-label="Open the ${label} tab" data-rail-tab="${tab}">
                        <i class="ph ${icon} text-sm"></i><span>${label}</span><i class="ph-bold ph-caret-right text-[10px] text-base-content/30"></i></button>
                      ${rest}
                      <span class="ml-auto shrink-0 tabular-nums" ${countTip ? `:data-title-tip="${countTip}"` : ''} x-text="${count}"></span>
                    </div>`;
  const railChip = `
                      <template x-if="pickedArea(p)">
                        <span class="min-w-0 inline-flex items-center gap-1 h-6 rounded-full pl-1.5 pr-0.5 bg-[${wash(14)}] text-[${pc}] text-sm font-medium" data-rail-chip :data-area="pickedArea(p).key">
                          <i class="shrink-0 text-base" :class="duotone(areaIconOf(p, pickedArea(p)))"></i>
                          <span class="min-w-0 truncate" x-text="pickedArea(p).label"></span>
                          <button type="button" @click="pickArea(null)" class="shrink-0 size-5 grid place-items-center rounded-full transition-colors hover:bg-[${wash(30)}]"
                                  aria-label="Every area" data-rail-clear><i class="ph-bold ph-x text-xs"></i></button>
                        </span>
                      </template>`;
  const railPanel = `
                <aside class="hidden @min-[60rem]:flex flex-col min-h-0 min-w-0 my-1 rounded-xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
                       aria-label="Changes, tasks and notes" data-program-rail>
                  <section class="flex-1 min-h-0 flex flex-col" data-rail-changes>
                    ${railHead('ph-git-commit', 'Changes', 'changes', 'railCount(p)', railChip, 'railTip(p)')}
                    <div class="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] pl-3 pr-1" :class="railLast(p) === 'changes' ? '${FAB_ROOM}' : 'pb-2'" data-pattern="list" data-part="list" data-rail-commits>
                      <p x-show="railState(p) === 'loading'" class="text-sm text-base-content/40">Loading…</p>
                      <p x-show="railState(p) === 'error'" class="text-sm text-error">Could not read them.</p>
                      <p x-show="railState(p) === 'ok' && !railOf(p).count" class="text-sm text-base-content/50" data-rail-none>None in four weeks.</p>
                      <template x-for="d in railShown(p).days" :key="d.day">
                        <section data-rail-day :data-day="d.day">
                          <h4 class="sticky top-0 z-[1] flex items-center gap-2 pt-2 pb-1 bg-base-100 text-xs leading-4 text-base-content/50">
                            <span x-text="dayLabel(d.day)"></span><span class="ml-auto tabular-nums" x-text="d.commits.length"></span></h4>
                          <ul class="flex flex-col gap-0.5">
                            <template x-for="c in d.commits" :key="c.sha">
                              <!-- The area marks in a gutter of their own, so the
                                   subjects line up; a mark picks its area. -->
                              <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 -mx-1 px-1 py-1 rounded-md transition-colors"
                                  :class="railHot(c) ? 'bg-[${wash(12)}]' : 'hover:bg-base-200/60'" @mouseenter="hoverCommit = c" @mouseleave="hoverCommit = null"
                                  data-rail-commit :data-sha="c.sha" :data-areas="c.areas.join('|')" :data-hot="railHot(c) ? '' : null">
                                <span class="flex flex-col items-center gap-0.5" data-rail-marks>
                                  <template x-for="m in c.marks" :key="m.key">
                                    <button type="button" @click="pickArea(m.a)" :aria-label="'Only ' + m.label" :data-title-tip="m.label"
                                            class="size-5 grid place-items-center rounded-md bg-[${wash(12)}] text-[${pc}] transition-shadow hover:ring-2 hover:ring-[${pc}]/30"
                                            data-rail-mark :data-area="m.key"><i class="text-sm" :class="duotone(m.icon)"></i></button>
                                  </template>
                                </span>
                                <div class="min-w-0">
                                  <p class="text-sm leading-5 break-words" x-text="c.subject"></p>
                                  <div class="flex items-center gap-2 min-w-0 text-xs leading-4 text-base-content/50">
                                    <a :href="c.url" target="_blank" rel="noopener" class="shrink-0 font-mono hover:text-primary" x-text="c.short"></a>
                                    <a x-blob="peek(p, c.paths[0])" class="min-w-0 truncate font-mono hover:text-primary" :data-title-tip="c.paths[0]"
                                       data-rail-file x-text="pathName(c.paths[0])"></a>
                                    <span x-show="c.paths.length > 1" class="shrink-0 tabular-nums" x-text="'+' + (c.paths.length - 1)"></span>
                                  </div>
                                </div>
                              </li>
                            </template>
                          </ul>
                        </section>
                      </template>
                      <button type="button" x-show="railShown(p).more" @click="railLimit += ${RAIL_STEP}" data-rail-more
                              class="mt-1 text-xs tabular-nums text-base-content/50 hover:text-primary" x-text="'+' + railShown(p).more + ' older'"></button>
                    </div>
                  </section>
                  <section x-show="tasksOf(p) !== null" class="shrink-0 max-h-[32%] min-h-0 flex flex-col border-t border-base-200" data-rail-tasks>
                    ${railHead('ph-list-checks', 'Tasks', 'tasks', "tasksOf(p) || ''")}
                    <div class="min-h-0 overflow-y-auto [scrollbar-gutter:stable] pl-3 pr-1" :class="railLast(p) === 'tasks' ? '${FAB_ROOM}' : 'pb-2'">
                      <p x-show="tasksOf(p) === 0" class="text-sm text-base-content/50">None open.</p>
                      <ul class="flex flex-col gap-1">
                        <template x-for="t in taskRows(p)" :key="t.id">
                          <li class="flex items-start gap-2 min-w-0" data-rail-task :data-status="t.status">
                            <i class="ph shrink-0 text-sm leading-5" :class="taskMark(t).cls" :data-title-tip="taskMark(t).label"></i>
                            <a x-blob="peek(p, t.path)" class="min-w-0 text-sm leading-5 break-words hover:text-primary" x-text="t.title"></a>
                          </li>
                        </template>
                      </ul>
                    </div>
                  </section>
                  <section x-show="hasToken() && p.charter" class="shrink-0 max-h-[32%] min-h-0 flex flex-col border-t border-base-200" data-rail-notes>
                    ${railHead('ph-note', 'Notes', 'notes', "notesOf(p).state === 'ok' ? notesOf(p).rows.length || '' : ''")}
                    <div class="min-h-0 overflow-y-auto [scrollbar-gutter:stable] pl-3 pr-1 ${FAB_ROOM}">
                      <p x-show="notesOf(p).state === 'loading'" class="text-sm text-base-content/40">Loading…</p>
                      <p x-show="notesOf(p).state === 'error'" class="text-sm text-error">Could not read them.</p>
                      <p x-show="notesOf(p).state === 'ok' && !notesOf(p).rows.length" class="text-sm text-base-content/50">None yet.</p>
                      <ul class="flex flex-col gap-2">
                        <template x-for="n in notesOf(p).rows" :key="n.id">
                          <li class="min-w-0" data-rail-note>
                            <p class="text-sm leading-5 whitespace-pre-line break-words line-clamp-2" x-text="n.text"></p>
                            <div class="flex flex-wrap items-center gap-x-2 text-xs leading-4 text-base-content/50">
                              <span x-text="n.author"></span><span class="tabular-nums" x-text="n.day"></span>
                              <span x-show="n.replies" class="tabular-nums" x-text="n.replies + (n.replies === 1 ? ' reply' : ' replies')"></span>
                            </div>
                          </li>
                        </template>
                      </ul>
                    </div>
                  </section>
                </aside>`;

  Alpine.data('program', function() {
    // The tile grid's observer, which counts the columns the pane holds; kept
    // out of the component's reactive state, as a DOM object must be.
    let tilesRO = null, heightsRO = null, railRO = null;
    // The side panel's commits as last drawn, kept by the reads they came
    // from, so a render (a hover's included) never joins them again.
    let railMemo = null;
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
      activity: {},      // p.key -> the commits read for the files its areas link
      registries: {},    // repo@ref:path -> a panel's registry: { state, authed, rows }
      areaCols: 1,       // the columns the tile grid holds at the pane's width
      fileHover: '',     // area|path: a file a tile names, under the pointer
      railOn: false,     // whether the side panel shows beside the tiles (the pane's container query)
      railLimit: RAIL_STEP, // the side panel's commits drawn, whole days at a time
      hoverArea: '',     // a tile under the pointer, by its area's key
      hoverCommit: null, // a side panel commit under the pointer
      // The chart panel-tip, the Map's contract for a measure's marks: a mark
      // passes its key and the body to show: { title, sub, source, rows:
      // [{ label, icon, n, share, on }], items: [{ key, name, text, file, img,
      // glyph }], html, notes: [text] }; an item's file opens in the deck.
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
                     whole, since a program's mark brings its own tile
                     (docs/favicons/README.md); a stock glyph sits on a neutral
                     tile. The mark opens the switcher: every program in the
                     shell's anchored menu, and nothing else. Then the name, its
                     charter (opened in the deck), its views, a read again and
                     its repository. -->
                <!-- The title block wraps by a basis and grows back to its own
                     width, so where the line is tight the repository's name
                     truncates first; the refresh rides in it, so no line holds
                     only that. -->
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div class="flex items-center gap-2.5 min-w-[7rem] basis-56 grow shrink max-w-fit" data-part="title">
                    <button type="button" @click="toggleSwitcher(p, $event.currentTarget)"
                            class="relative shrink-0 size-9 rounded-xl flex items-center justify-center transition"
                            :class="iconSrc(p) ? 'hover:brightness-95' : 'bg-base-200 hover:bg-base-300'"
                            :aria-expanded="switcherOpen()" aria-haspopup="menu"
                            data-title-tip="Programs" aria-label="Programs" data-program-switch>
                      <img x-show="iconSrc(p)" :src="iconSrc(p)" alt="" class="block size-9">
                      <i x-show="!iconSrc(p)" class="ph-duotone text-xl text-base-content/60" :class="p.icon"></i>
                      <i class="ph-bold ph-caret-down absolute -bottom-0.5 -right-0.5 text-[10px] leading-none rounded-full bg-base-100 p-0.5 text-base-content/60"></i></button>
                    <h1 class="text-xl font-bold tracking-tight truncate" x-text="p.label"></h1>
                    <span x-show="p.proposed" class="badge badge-sm badge-ghost shrink-0">proposed</span>
                    <button type="button" x-show="p.charter" @click="openCharter(p)" data-program-charter-open
                            :data-title-tip="'Read the charter, ' + p.charter" :aria-label="'Read the charter, ' + p.charter"
                            class="shrink-0 rounded p-0.5 transition-colors hover:bg-base-200">
                      <i class="ph ph-file-text text-base text-primary"></i></button>
                    <!-- The app views that display it, in the shell's
                         anchored menu under the Map's mark, so they cost the
                         page no line of their own; then a read again. -->
                    <button type="button" x-show="p.views.length" @click="toggleViews(p, $event.currentTarget)"
                            class="shrink-0 rounded p-0.5 transition-colors hover:bg-base-200" :class="viewsOpen() ? 'text-primary' : 'text-base-content/60'"
                            :aria-expanded="viewsOpen()" aria-haspopup="menu" data-title-tip="Views" aria-label="Views" data-program-views-open>
                      <i class="ph ph-compass text-lg"></i></button>
                    <button type="button" @click="refresh(p)" :disabled="loading" data-title-tip="Read again" aria-label="Read again"
                            class="shrink-0 rounded p-0.5 text-base-content/40 hover:text-primary transition-colors" data-program-refresh>
                      <i class="ph ph-arrow-clockwise text-base"></i></button>
                    <button type="button" @click="openRepo(p)" data-program-repo
                            class="hidden sm:block min-w-0 basis-0 grow truncate text-left font-mono text-xs text-base-content/40 hover:text-primary transition-colors"
                            :data-title-tip="p.repo" x-text="p.repo"></button>
                  </div>
                  <!-- The tab row, every tab named, and a tab with a count
                       carries it as a badge, as the header's Waiting does.
                       Below sm a tab is its label alone; the icons return
                       from sm up. -->
                  <div class="shrink-0 inline-flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5"
                       role="tablist" aria-label="Program" data-slot="frame:tabs" data-program-tabs>
                    <template x-for="t in tabs(p)" :key="t.k">
                      <button type="button" role="tab" @click="setTab(t.k)" :aria-selected="tabOf(p) === t.k" :data-program-tab="t.k"
                              class="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors"
                              :class="tabOf(p) === t.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                        <i class="ph text-base hidden sm:inline" :class="t.i"></i><span x-text="t.n"></span>
                        <span x-show="tabCount(p, t.k)" class="badge badge-xs border-0 bg-base-content/10 text-inherit tabular-nums"
                              :data-program-badge="t.k" :data-title-tip="tabCountTip(p, t.k)" x-text="tabCount(p, t.k)"></span></button>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Each tab ends on its own padding, so a tab that fills the
                   pane can leave its foot to its own scrolling columns. -->
              <div class="grow min-h-0 overflow-y-auto px-4 sm:px-6 mt-3 @container" data-program-body>
                <!-- Areas: the program at a glance (areasPanel), in the program's
                     own colour; without an Areas table, the charter's first
                     paragraph. Where the pane is wide (its container query,
                     60rem inside its padding) the tiles take two thirds and the
                     side panel (railPanel) the rest, each column the pane's
                     height and scrolling on its own, so the page stays still. -->
                <div x-show="tabOf(p) === 'areas'" role="tabpanel" x-init="watchRail($el)" data-program-areas :style="{ '--program': programColor(p) }"
                     class="min-w-0 pb-8 @min-[60rem]:pb-3 @min-[60rem]:h-full @min-[60rem]:grid @min-[60rem]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @min-[60rem]:grid-rows-[minmax(0,1fr)] @min-[60rem]:gap-x-3">
                  <div class="min-w-0 @min-[60rem]:min-h-0 @min-[60rem]:overflow-y-auto @min-[60rem]:[scrollbar-gutter:stable] @min-[60rem]:-mx-1 @min-[60rem]:p-1" data-program-tiles-col>
                    <p x-show="charterOf(p).state === 'loading'" class="text-base text-base-content/40">Loading…</p>
                    <p x-show="charterOf(p).state === 'error'" class="text-sm text-error font-mono break-all" x-text="charterOf(p).err"></p>
                    <template x-if="charterOf(p).areas.length">${areasPanel}</template>
                    <div x-show="charterOf(p).state === 'ok' && !charterOf(p).areas.length" class="flex flex-col items-start gap-2" data-program-lead>
                      <p x-show="charterOf(p).lead" class="text-base text-base-content/80 break-words" x-html="charterOf(p).lead"></p>
                      <button type="button" @click="openCharter(p)" class="inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary">
                        <i class="ph ph-file-text"></i><span>Read the charter</span></button>
                    </div>
                  </div>${railPanel}
                </div>
                <!-- Measures mount with their tab, so a chart scrolls to its
                     newest week at a width it can measure. -->
                <template x-if="tabOf(p) === 'measures'">
                  <div role="tabpanel" class="min-w-0 pb-8" data-program-measures>${measures}</div>
                </template>
                <section x-show="tabOf(p) === 'changes'" role="tabpanel" class="flex flex-col gap-2 min-w-0 pb-8" data-program-commits>
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
                <section x-show="tabOf(p) === 'tasks'" role="tabpanel" class="flex flex-col gap-2 min-w-0 pb-8" data-program-tasks>
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
                <section x-show="tabOf(p) === 'notes' && hasToken() && p.charter" role="tabpanel" class="flex flex-col gap-2 min-w-0 pb-8" data-program-notes>
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
               :style="chartTip ? 'left:' + chartTip.x + 'px;top:' + chartTip.y + 'px;width:' + chartTip.w + 'px' + (chartTip.maxH ? ';max-height:' + chartTip.maxH + 'px' : '') : ''">
            <div x-html="chartTipClose"></div>
            <template x-if="chartTip">
              <div class="flex flex-col gap-2" :class="chartTipClose && 'pr-6'">
                <div class="min-w-0">
                  <p class="text-base break-words"><span class="font-semibold" x-text="chartTip.body.title"></span><template x-if="chartTip.body.source"><a x-blob="chartTip.body.source"
                     :data-title-tip="chartTip.body.sourceTip || 'Open on GitHub'" :aria-label="chartTip.body.sourceTip || 'Open on GitHub'"
                     class="ml-1.5 text-base-content/30 hover:text-primary" data-chart-tip-source><i class="ph ph-github-logo"></i></a></template></p>
                  <p x-show="chartTip.body.sub" class="text-base-content/60 tabular-nums" x-text="chartTip.body.sub"></p>
                </div>
                <!-- A group's rows (groupTip): its icon where the row has one,
                     its name in bold, which opens its file, and its text, two
                     lines at most, since the file holds it whole. -->
                <ul x-show="chartTip.body.items?.length" class="flex flex-col gap-2" data-chart-tip-items>
                  <template x-for="it in (chartTip.body.items || [])" :key="it.key">
                    <li class="min-w-0" data-chart-tip-item :data-file="it.file || null">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <img x-show="!!it.img" :src="it.img || ''" alt="" class="size-4 shrink-0" @error="$el.style.display = 'none'">
                        <i x-show="!!it.glyph" class="ph shrink-0 text-base text-base-content/50" :class="it.glyph"></i>
                        <button type="button" x-show="!!it.file" @click="openTipItem(it)" class="min-w-0 text-left font-semibold break-all hover:text-primary" x-text="it.name"></button>
                        <span x-show="!it.file" class="min-w-0 font-semibold break-all" x-text="it.name"></span>
                      </div>
                      <p x-show="!!it.text" class="text-base-content/70 line-clamp-2" x-text="it.text"></p>
                    </li>
                  </template>
                </ul>
                <div x-show="chartTip.body.rows?.length" class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3">
                  <template x-for="r in (chartTip.body.rows || [])" :key="r.label">
                    <div class="contents" :class="r.on ? 'text-primary font-medium' : ''">
                      <span class="truncate"><i x-show="!!r.icon" class="ph mr-1.5 text-base-content/50" :class="r.icon || ''"></i><span x-text="r.label"></span></span>
                      <span class="tabular-nums text-right" x-text="r.n"></span>
                      <span class="tabular-nums text-right" :class="r.on ? '' : 'text-base-content/50'" x-text="r.share || ''"></span>
                    </div>
                  </template>
                </div>
                <p x-show="chartTip.body.html" class="text-base-content/80 break-words [&_a]:text-primary" x-html="chartTip.body.html || ''"></p>
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
        tilesRO?.disconnect(); tilesRO = null;
        heightsRO?.disconnect(); heightsRO = null;
        railRO?.disconnect(); railRO = null;
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
          if (force) { this.charters = {}; this.commits = {}; this.notes = {}; this.measureData = {}; this.activity = {}; this.registries = {}; }
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
      // A tab's count, drawn on it as a badge: the open tasks, the commits of
      // the last PROGRAM_RECENT_DAYS days among those read, the notes on the
      // charter. Nought or unread draws none, as the header's Waiting badge.
      tabCount(p, k){
        if (k === 'tasks') return this.tasksOf(p) || 0;
        if (k === 'changes') return p.governs.length && this.commitsOf(p).state === 'ok' ? this.recent(p) : 0;
        if (k === 'notes') return this.hasToken() && p.charter && this.notesOf(p).state === 'ok' ? this.notesOf(p).rows.length : 0;
        return 0;
      },
      // The one count whose window its tab does not say.
      tabCountTip(p, k){
        return k === 'changes' ? 'Commits in the last ' + PROGRAM_RECENT_DAYS + ' days, among the latest read from ' + this.plural(this.commitsOf(p).read, 'governed path') : null;
      },

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
      // In the shell's anchored menu, as the switcher lists the programs: a
      // row a view under its icon, each opening as openView does.
      toggleViews(p, el){
        window.__shell?.toggleRepoMenu?.(p.repo, el, 'views', { align: 'left',
          extra: p.views.map(v => ({ key: 'view:' + v, label: this.viewLabel(v), icon: this.viewIcon(v), run: () => this.openView(v) })) });
      },
      viewsOpen(){ const s = window.__shell; return !!(s?.repoMenuAt && s.menuKind === 'views'); },
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
        this.loadPanels(p, force);
        // Waits on the charter, whose write re-runs the page's effect.
        this.loadActivity(p, force);
      },

      // ── The charter ──────────────────────────────────────────────────────
      // Its Areas table, read once a program: each row's area and what it
      // covers as inline Markdown, its links resolved from the charter's folder
      // to the file on GitHub. A charter without the table gives its first
      // paragraph instead.
      // A link to a file of the repository carries its path as data-doc, so
      // the card's file line and the sentence can mark each other.
      charterMd(p, s, plain){
        return inlineMd(s, h => {
          const u = new URL(h, 'https://repo/' + p.charter);
          return window.RepoAddress.github.blob(p.repo, p.ref || 'main', decodeURIComponent(u.pathname.slice(1))) + u.hash;
        }, (a, h) => { const path = window.Programs.repoPath(p.charter, h); if (path) a.dataset.doc = path; }, plain);
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
          const t = mdSectionTable(text, 'Areas'), mt = mdSectionTable(text, 'Measures');
          const col = (name, d) => { const i = (mt?.head || []).findIndex(h => h.toLowerCase() === name); return i < 0 ? d : i; };
          const mi = col('measure', 1), wi = col('working means', 2);
          const areas = (t?.rows || []).filter(r => r[0]).map(([area, covers = ''], i) => {
            // A Measures row belongs to the area its first cell names exactly,
            // so a table keyed by process (Organization's) gives none; its
            // measure is the declared one whose file the Measure cell names.
            const row = (mt?.rows || []).find(r => r[0] === area);
            const addr = row ? p.measures.find(m => { const at = window.RepoAddress?.parse(m); return !!at?.path && namesPath(row[mi], at.path); }) || '' : '';
            const docs = [];
            for (const l of window.Programs.mdLinks(covers)) {
              const path = window.Programs.repoPath(p.charter, l.href);
              if (path && !docs.some(d => d.path === path)) docs.push({ path, dir: path.endsWith('/'), name: docName(path), icon: docIcon(path) });
            }
            const html = this.charterMd(p, area);
            return { key: area, n: i + 1, label: textOf(html), area: html, covers: this.charterMd(p, covers, true), docs,
              measure: row ? { addr, cell: addr ? '' : this.charterMd(p, row[mi] || ''), means: this.charterMd(p, row[wi] || '') } : null };
          });
          this.charters[p.key] = { state: 'ok', head: (t?.head || []).slice(0, 2), areas,
            lead: areas.length ? '' : this.charterMd(p, mdLead(text)) };
        } catch (e) {
          this.charters[p.key] = { state: 'error', head: [], areas: [], lead: '', err: String(e?.message || e) };
        }
      },
      // The charter, or a file an area links, in the house deck, read by the
      // shared reader (viewer.js) as the Files view's deck reads a file, its
      // header linking the file on GitHub. Without the deck kit, the file on
      // GitHub.
      openCharter(p){ return p?.charter ? this.openFile(p, p.charter, p.label) : undefined; },
      async openFile(p, path, title){
        if (!p || !path) return;
        const href = window.RepoAddress.github.blob(p.repo, p.ref || 'main', path);
        if (!window.swipeDeck && window.gh?.load) { try { await window.gh.load('kits/swipe-deck.js'); } catch { /* fall through */ } }
        if (!window.swipeDeck) { window.open(href, '_blank', 'noopener'); return; }
        this._deck?.close?.();
        const parent = window.swipeDeck.top?.() || null, name = title || path.split('/').pop();
        const opts = {
          count: 1, start: 0, title: name, subtitle: [p.repo.split('/').pop(), path].join(' · '),
          icon: 'ph-file-text', link: { href, icon: 'ph-github-logo', title: 'Open ' + path + ' on GitHub' },
          index: () => ({ title: name, subtitle: path, icon: 'ph-file-text' }),
          render: (i, slide) => this.mountFile(p, path, slide),
          release: (i, slide) => { slide.replaceChildren(); },
          slideScroll: false, innerClass: 'h-full w-full min-w-0', immersive: true,
          onClose: () => { this._deck = null; },
        };
        this._deck = parent ? window.swipeDeck.drill(parent, opts) : window.swipeDeck.open(opts);
      },
      treeHref(p, path){ return window.RepoAddress?.github.tree(p.repo, p.ref || 'main', path.replace(/\/+$/, '')) || ''; },
      mountFile(p, path, slide){
        const el = document.createElement('div');
        el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden';
        el.setAttribute('x-data', "viewer({ bindStore: false, fill: true, identify: false, defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })");
        el.dataset.programFile = path;
        slide.append(el);
        window.Alpine.initTree(el);
        // The charter's bytes are the Areas tab's; any other file is read here.
        const repo = p.repo, ref = p.ref || 'main', key = path === p.charter ? this.charterKey(p) : '';
        (async () => {
          try {
            let text;
            if (key) { if (!CHARTERS.has(key)) CHARTERS.set(key, (await new window.GH({ token: window.TOKEN, repo, ref }).get(path)).text); text = CHARTERS.get(key); }
            else text = (await new window.GH({ token: window.TOKEN, repo, ref }).get(path)).text;
            if (el.isConnected) await el.__viewer?.show(path, text, { repo, ref });
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
      // Over every commit read, not the PROGRAM_COMMITS the tab lists, which
      // a busy fortnight runs past.
      recent(p){
        const since = Date.now() - PROGRAM_RECENT_DAYS * 864e5, c = this.commitsOf(p);
        return (c.all || c.rows).filter(x => Date.parse(x.date) >= since).length;
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
        const all = [...bySha.values()].sort((a, b) => b.date.localeCompare(a.date));
        this.commits[p.key] = failed === paths.length
          ? { state: 'error', authed, rows: [], read: paths.length, err }
          : { state: 'ok', authed, rows: all.slice(0, PROGRAM_COMMITS), all, read: paths.length };
      },

      // ── The areas ────────────────────────────────────────────────────────
      // What moved in each area: the commits over its heat grid's four weeks
      // to each file or folder an area's Covers cell links, one read a path
      // (a page of a hundred at a time, while a page comes back full), joined
      // by sha. Read for the areas rather than taken from the Changes tab's,
      // which hold five commits a governed path: a busy file runs past five in
      // a day, and an area links files the program does not govern, or one
      // file inside a governed folder. Signed out, the first
      // PROGRAM_PUBLIC_PATHS paths in the charter's order.
      activityOf(p){ return this.activity[p.key] || { state: 'loading', commits: [], read: [], total: 0 }; },
      async loadActivity(p, force = false){
        const c = this.charters[p.key], authed = this.hasToken(), prior = this.activity[p.key];
        if (c?.state !== 'ok') return;
        if (!force && prior && prior.authed === authed) return;
        const all = [...new Set(c.areas.flatMap(a => a.docs.map(d => d.path)))];
        const paths = authed ? all : all.slice(0, PROGRAM_PUBLIC_PATHS);
        this.activity[p.key] = { state: all.length ? 'loading' : 'ok', authed, commits: [], read: paths, total: all.length };
        if (!all.length) return;
        const since = window.Programs.heatStart(Date.now(), PROGRAM_HEAT_WEEKS).toISOString();
        const gh = new window.GH({ token: authed ? window.TOKEN : '', repo: p.repo, ref: p.ref || 'main' });
        const bySha = new Map();
        let failed = 0, err = '';
        await Promise.all(paths.map(async f => {
          try {
            for (let page = 1; page <= PROGRAM_HEAT_PAGES; page++) {
              const list = await gh.req('commits?sha=' + encodeURIComponent(p.ref || 'main') + '&path='
                + encodeURIComponent(f.replace(/\/+$/, '')) + '&since=' + encodeURIComponent(since) + '&per_page=100' + (page > 1 ? '&page=' + page : ''));
              const rows = Array.isArray(list) ? list : [];
              for (const x of rows) {
                if (!x?.sha) continue;
                const row = bySha.get(x.sha);
                if (row) { if (!row.paths.includes(f)) row.paths.push(f); continue; }
                bySha.set(x.sha, { sha: x.sha, short: x.sha.slice(0, 7), paths: [f],
                  date: String(x.commit?.committer?.date || x.commit?.author?.date || ''),
                  subject: String(x.commit?.message || '').split('\n')[0] });
              }
              if (rows.length < 100) break;
            }
          } catch (e) { failed++; err ||= String(e?.message || e); }
        }));
        if (this.activity[p.key]?.authed !== authed) return;
        this.activity[p.key] = failed === paths.length
          ? { state: 'error', authed, commits: [], read: paths, total: all.length, err }
          : { state: 'ok', authed, commits: [...bySha.values()], read: paths, total: all.length };
      },
      // Where an area's activity stands: 'none' where it links no file,
      // 'unread' where a file it links was not read (signed out, past the
      // limit) or the reads failed, so an unread area never reads as a quiet
      // one, else 'loading' or 'ok'.
      areaState(p, a){
        const act = this.activityOf(p);
        if (!a.docs.length) return 'none';
        if (act.state === 'loading') return 'loading';
        return act.state === 'ok' && a.docs.every(d => act.read.includes(d.path)) ? 'ok' : 'unread';
      },
      // Its heat grid's days, null unless they were read; kept by the commits
      // read and the day, so a render draws the grid without counting again.
      areaDays(p, a){
        if (this.areaState(p, a) !== 'ok') return null;
        const raw = window.Alpine?.raw ? window.Alpine.raw(this.activityOf(p).commits) : this.activityOf(p).commits;
        const now = Date.now(), key = a.key + '|' + new Date(now).toDateString();
        let at = HEATS.get(raw);
        if (!at) HEATS.set(raw, at = new Map());
        if (!at.has(key)) at.set(key, window.Programs.heatDays(raw, a.docs.map(d => d.path), now, PROGRAM_HEAT_WEEKS));
        return at.get(key);
      },
      // The grid as a tile draws it: its days, or as many blank ones while
      // they are read or where they were not, and its span and count as the
      // title-tip says them.
      heatOf(p, a){
        const state = this.areaState(p, a), g = this.areaDays(p, a);
        const t = new Date(), first = window.Programs.heatStart(t.getTime(), PROGRAM_HEAT_WEEKS);
        const fmt = (d, mon) => mon ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : String(d.getDate());
        const span = fmt(first, true) + ' → ' + fmt(t, t.getMonth() !== first.getMonth());
        const days = g ? g.days : Array.from({ length: 7 * PROGRAM_HEAT_WEEKS }, (_, i) => ({ day: 'x' + i, n: 0, commits: [] }));
        return { state, days, count: g ? g.count : null,
          tip: span + ' · ' + (g ? this.plural(g.count, 'commit') : state === 'loading' ? 'reading' : 'not read') };
      },
      // A day's shade: the program's colour in four steps by its commits, a
      // faint neutral for none, and nothing for a day still to come.
      heatFill(d, state){
        if (d.future) return 'transparent';
        const n = state === 'ok' ? d.n : 0;
        if (!n) return 'color-mix(in oklab, var(--color-base-content) 9%, var(--color-base-100))';
        const pct = n >= 8 ? 100 : n >= 4 ? 78 : n >= 2 ? 55 : 32;
        return 'color-mix(in oklab, var(--program) ' + pct + '%, var(--color-base-100))';
      },
      dayOpenIn(a){ return !!this.chartTip?.key?.startsWith('d:' + a.key + ':'); },
      openDay(a, d, el){
        window.TitleTip?.close?.();
        this.toggleChartTip('d:' + a.key + ':' + d.day, el, this.dayTip(d));
      },
      dayTip(d){
        const at = new Date(d.day + 'T12:00:00');
        return { title: at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          sub: this.plural(d.n, 'commit'), rows: d.commits.map(c => ({ label: c.subject, n: c.short })) };
      },
      // A label a narrow tile cut short carries itself whole as a title-tip;
      // one that fits carries none. Measured after the frame that draws it.
      fitTip(el, text){
        requestAnimationFrame(() => {
          if (!el.isConnected) return;
          if (text && el.scrollWidth > el.clientWidth + 1) el.setAttribute('data-title-tip', text);
          else el.removeAttribute('data-title-tip');
        });
      },
      // The program's own colour, from its drawn mark, for the marks that
      // say which program this is; the theme's primary for a glyph.
      programColor(p){ return window.Programs.color(p) || 'var(--color-primary)'; },

      // ── The tiles ────────────────────────────────────────────────────────
      // A tile an area of the charter, in the charter's order: its
      // declaration's panels, or, for an area the manifest does not declare,
      // its measure where the charter names one. A measure panel needs a
      // Measures row, and a views panel a view. Its chips are the files the
      // area links less those a panel's head already names (a registry, or a
      // measure file of the program's repository); its commits still count
      // them all.
      tilesOf(p){
        const tiles = this.charterOf(p).areas.map(a => {
          const decl = (p.areas || []).find(d => d.name === a.label) || null;
          // Groups panels that follow one another share one row of chips,
          // drawn as one panel of parts.
          const runs = [];
          for (const pn of (decl ? decl.panels : [{ kind: 'measure', sig: 'measure' }])) {
            const last = runs[runs.length - 1];
            if (pn.kind === 'groups' && last?.kind === 'groups') last.parts.push(pn);
            else runs.push(pn.kind === 'groups' ? { ...pn, parts: [pn] } : pn);
          }
          const panels = runs
            .filter(pn => (pn.kind !== 'measure' || a.measure) && (pn.kind !== 'views' || this.viewsOf(p, a, pn).length))
            .map(pn => ({ ...pn, w: window.Programs.panelWeight(pn, a, pn.source === 'research' ? this.galleryOf(p, pn).total : 0) }));
          const at = a.measure?.addr ? window.RepoAddress?.parse(a.measure.addr) : null;
          const named = new Set(panels.flatMap(pn => pn.kind === 'measure' ? [at?.repo === p.repo ? at.path : ''] : pn.parts ? pn.parts.map(q => q.registry) : [pn.registry]).filter(Boolean));
          return { a, panels, icon: window.Programs.areaIcon(p, a.label, decl), want: window.Programs.tileWant(panels),
            chips: a.docs.filter(d => !named.has(d.path)),
            grows: panels.some(pn => pn.kind !== 'views') };
        });
        // Two columns or fewer, as on a phone, every tile takes one, so
        // they stand side by side however much they asked for.
        if (this.areaCols <= 2) return tiles.map(t => ({ ...t, span: 1 }));
        return window.Programs.tileSpans(tiles.map(t => t.want), this.areaCols, tiles.map(t => t.grows))
          .map(s => ({ ...tiles[s.i], span: s.span }));
      },
      // The columns follow the grid's own width, so a split pane packs as a
      // narrow one does; a hidden tab (width 0) keeps what it had.
      watchTiles(el){
        tilesRO?.disconnect();
        tilesRO = null;
        const fit = () => { const w = el.clientWidth, n = window.Programs.tileCols(w); if (w && n !== this.areaCols) this.areaCols = n; };
        fit();
        if (window.ResizeObserver) { tilesRO = new ResizeObserver(fit); tilesRO.observe(el); }
      },
      // Whether the tiles pack by height: wherever their heights can be
      // watched, so a page without ResizeObserver keeps plain rows.
      packs(){ return !!window.ResizeObserver; },
      // A tile spans as many pixel rows as it is tall, and one gap more, set
      // on the element rather than in state, so a render never writes it.
      watchTile(el){
        if (!window.ResizeObserver) return;
        heightsRO ||= new ResizeObserver(entries => {
          for (const e of entries) {
            const t = e.target;
            if (!t.isConnected) { heightsRO.unobserve(t); continue; }
            const gap = parseFloat(getComputedStyle(t.parentElement).columnGap) || 0;
            const h = e.borderBoxSize?.[0]?.blockSize ?? t.getBoundingClientRect().height;
            t.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil(h + gap));
          }
        });
        heightsRO.observe(el);
      },
      // A views panel's views: those it names, else the program's view of the
      // area's own name.
      viewsOf(p, a, pn){ return pn.views?.length ? pn.views : (p.views || []).filter(v => this.viewLabel(v) === a.label); },
      fileName(path){ return String(path || '').split('/').pop(); },
      // A registry by its file's name, or its folder's where the name says
      // nothing alone, as skills/manifest.csv does.
      regName(path){
        const s = String(path || '').split('/'), base = s.pop().replace(/\.csv$/, '');
        return /^(manifest|index|readme)$/i.test(base) && s.length ? s.pop() : base;
      },
      // A panel's count: its rows, and the registry's where it counts some.
      countOf(x){ return x?.state === 'ok' ? x.total.toLocaleString() + (x.of > x.total ? ' of ' + x.of.toLocaleString() : '') : ''; },
      coversTip(a){ return { title: a.label, html: a.covers }; },
      meansTip(a){ return { title: a.measure?.addr ? 'Working means' : 'No measure yet', notes: [textOf(a.measure?.means || '')].filter(Boolean) }; },
      openRepos(){ window.__shell?.goRepos?.(); },
      // An item holds the repository's name, not a function: Alpine calls a
      // function an expression returns, so x-show on one would open it.
      openRepoOf(repo){ if (repo) window.__shell?.openPinned?.(repo); },

      // A panel's registry: a committed CSV of the program's repository at its
      // revision, read once a reader. Signed in through the API; signed out
      // from raw.githubusercontent, which spends none of the 60 anonymous
      // calls an hour the commit reads need, and where a private file 404s.
      regKey(p, path){ return p.repo + '@' + (p.ref || 'main') + ':' + path; },
      regOf(p, path){ return this.registries[this.regKey(p, path)] || { state: 'loading', rows: [] }; },
      loadPanels(p, force = false){
        for (const path of new Set((p.areas || []).flatMap(d => d.panels.map(pn => pn.registry)).filter(Boolean)))
          this.readRegistry(p, path, force);
      },
      async readRegistry(p, path, force = false){
        const key = this.regKey(p, path), authed = this.hasToken(), prior = this.registries[key];
        if (!force && prior && prior.authed === authed) return;
        this.registries[key] = { state: 'loading', authed, rows: [] };
        let next;
        try {
          let text;
          if (authed) text = (await new window.GH({ token: window.TOKEN, repo: p.repo, ref: p.ref || 'main' }).get(path)).text;
          else {
            if (!window.fetch) throw new Error('No fetch');
            const res = await window.fetch(rawUrl(p, path));
            if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
            text = await res.text();
          }
          next = { state: 'ok', authed, rows: window.Csv.rows(text) };
        } catch (e) {
          next = { state: e?.status === 404 ? (authed || p.repo === HUB ? 'missing' : 'locked') : 'error', authed, rows: [], err: String(e?.message || e) };
        }
        if (this.registries[key]?.authed === authed) this.registries[key] = next;
      },
      // The items a gallery shows in a tile `span` columns wide: thumbnails
      // one row of two a column, so the row is whole; the declaration's
      // limit, else a few, of anything else.
      galleryShown(g, pn, span){
        const cols = g.layout === 'thumbs' ? 2 * Math.max(1, span || 1) : 0;
        const limit = pn.limit || cols || { icons: 12, rows: 4, chips: 16 }[g.layout] || 12;
        return { cols, items: g.items.slice(0, limit), more: Math.max(0, g.items.length - limit) };
      },
      breakdownOf(p, pn){
        const r = this.regOf(p, pn.registry);
        if (r.state !== 'ok') return { state: r.state, total: 0, of: 0, groups: [], rest: { groups: 0, n: 0 } };
        return memoPanel(r.rows, pn.sig, rows => ({ state: 'ok', ...window.Programs.breakdown(rows, pn) }));
      },
      // A groups panel's part, one registry grouped (Programs.groups); the
      // run's state is its first part's that has not landed; and its chips, a
      // group each, keyed for the chart panel-tip by the area as well.
      groupsOf(p, q){
        const r = this.regOf(p, q.registry);
        if (r.state !== 'ok') return { state: r.state, total: 0, of: 0, groups: [] };
        return memoPanel(r.rows, q.sig, rows => ({ state: 'ok', ...window.Programs.groups(rows, q) }));
      },
      groupsState(p, pn){ return pn.parts.map(q => this.groupsOf(p, q).state).find(s => s !== 'ok') || 'ok'; },
      chipsOf(p, pn, area){
        return pn.parts.flatMap(q => this.groupsOf(p, q).groups.map(g => ({ key: q.registry + '|' + g.key, tip: 'g:' + area + ':' + q.registry + '|' + g.key, q, g })));
      },
      // A group's rows in the chart panel-tip: the group, its count against
      // the registry's rows and the registry on GitHub, then a row each, its name
      // in bold (the part after a namespace's colon), which opens the file
      // the declaration's `file` names for it, and its text.
      groupTip(p, q, g){
        const all = this.groupsOf(p, q);
        return { title: g.label.charAt(0).toUpperCase() + g.label.slice(1), program: p,
          sub: g.n.toLocaleString() + ' of ' + all.of.toLocaleString() + ' in ' + this.regName(q.registry),
          source: this.peek(p, q.registry), sourceTip: 'Open ' + q.registry,
          items: g.rows.map((r, i) => {
            const name = String(r[q.label] ?? '').split(':').pop(), mark = q.icon ? String(r[q.icon] ?? '') : '';
            return { key: i + ':' + r[q.label], name, text: q.text ? String(r[q.text] ?? '') : '',
              file: window.Programs.rowFile(q.file, r),
              // An icon column holds a glyph or a mark's repository path.
              img: /^[\w.-]+(\/[\w.-]+)*\.svg$/.test(mark) && !mark.split('/').includes('..') ? rawUrl(p, mark) : '',
              glyph: /^ph-[a-z0-9-]+$/.test(mark) ? mark : '' };
          }).filter(it => it.name) };
      },
      // A folded breakdown's groups in the chart panel-tip: every one, not
      // the six a tile draws, each with its icon, count and share.
      foldTip(p, pn){
        const r = this.regOf(p, pn.registry);
        const all = r.state === 'ok' ? memoPanel(r.rows, pn.sig + '|all', rows => window.Programs.groups(rows, pn)) : { total: 0, of: 0, groups: [] };
        return { title: this.regName(pn.registry), sub: 'by ' + pn.by + ' · ' + this.countOf({ state: 'ok', ...all }),
          source: this.peek(p, pn.registry), sourceTip: 'Open ' + pn.registry,
          rows: all.groups.map(g => ({ label: g.label, icon: g.icon, n: g.n.toLocaleString(),
            share: all.total ? Math.round(100 * g.n / all.total) + '%' : '' })) };
      },
      openTipItem(it){
        const p = this.chartTip?.body?.program;
        this.closeChartTip();
        if (p && it?.file) this.openFile(p, it.file, it.name);
      },
      // A gallery's items and how they are drawn: thumbnails where the panel
      // names an image column, icons where it names an icon or glyph column
      // (or the estate's marks), dated rows for research, chips otherwise.
      // A label that is a file path shows its file's name and peeks the file.
      galleryOf(p, pn){
        const icon = pn.source === 'research' ? 'ph-file-code' : pn.source === 'repos' ? 'ph-github-logo' : 'ph-file-csv';
        const shape = (layout, items, of) => ({ state: 'ok', icon, layout, items, total: items.length, of });
        const none = state => ({ state, icon, layout: '', items: [], total: 0, of: 0 });
        if (pn.source === 'repos') {
          const shell = window.__shell;
          if (!this.hasToken()) return none('locked');
          const repos = shell?.estateRepos || [];
          return shape('icons', repos.map(r => ({ key: r.repo, label: r.repo.split('/').pop(),
            markHtml: shell.repoMarkHtml?.(r, { cls: 'text-base' }) || '<i class="ph-duotone ph-github-logo"></i>', repo: r.repo })), repos.length);
        }
        if (pn.source === 'research') {
          // The program's own declarations, or those of the repository the panel names.
          const repo = pn.repo || p.repo, src = this.sources.find(x => x.repo === repo);
          if (!src) return none(this.hasToken() ? 'loading' : 'locked');
          const at = { repo, ref: src.ref || 'main' }, all = (Array.isArray(src.config?.research) ? src.config.research : [])
            .filter(e => e && typeof e.path === 'string');
          const day = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          const items = window.Programs.pick(all, pn.where).map(e => ({ key: e.path, label: e.label || e.path, peek: this.peek(at, e.path),
            date: (e.path.match(/\d{4}-\d{2}-\d{2}/) || [''])[0] })).sort((a, b) => b.date.localeCompare(a.date))
            .map(e => ({ ...e, day: day(e.date) }));
          return shape('rows', items, all.length);
        }
        const r = this.regOf(p, pn.registry);
        if (r.state !== 'ok') return none(r.state);
        return memoPanel(r.rows, pn.sig + '|' + this.regKey(p, ''), rows => {
          const dir = pn.registry.includes('/') ? pn.registry.slice(0, pn.registry.lastIndexOf('/') + 1) : '';
          const glyphs = window.MapTabs?.glyphs || {};
          const mark = r2 => {
            const g = pn.glyph ? String(r2[pn.glyph] ?? '') : '', t = g in glyphs ? glyphs[g] : g, i = pn.icon ? String(r2[pn.icon] ?? '') : '';
            if (t) return '<span>' + window.esc(t) + '</span>';
            if (/^ph-[a-z0-9-]+$/.test(i)) return '<i class="ph-duotone ' + i + '"></i>';
            return '<i class="ph ph-minus text-base-content/30"></i>';
          };
          const items = window.Programs.pick(rows, pn.where).map((r2, i) => {
            const v = String(r2[pn.label] ?? ''), path = /\/[^/]+\.\w+$/.test(v) ? v : '';
            return { key: i + ':' + v, label: path ? path.split('/').pop().replace(/\.\w+$/, '') : v, peek: path ? this.peek(p, path) : '',
              markHtml: pn.icon || pn.glyph ? mark(r2) : '',
              thumb: pn.thumb && r2[pn.thumb] ? rawUrl(p, dir + r2[pn.thumb]) : '',
              href: pn.href && r2[pn.href] ? pagesUrl(p, dir + r2[pn.href]) : '' };
          }).filter(it => it.label);
          return shape(pn.thumb ? 'thumbs' : pn.icon || pn.glyph ? 'icons' : 'chips', items, rows.length);
        });
      },
      // A week's marked share, as a tile draws it: on the track that is the
      // week's whole, with the other categories left to the Measures tab.
      markedPct(m, w){ const k = this.measureMarkOf(m); return w.n ? 100 * (w.counts[k] || 0) / w.n : 0; },
      // The marked category of a measure, with its share of the last week
      // drawn, as a tile ends its sparkline.
      measureMarked(m){ return this.measureCats(m).find(c => c.key === this.measureMarkOf(m)) || null; },
      // A tile's sparkline: the newest weeks, and the months they run over,
      // said once in place of an axis.
      tileWeeks(m){ return this.measureWeeks(m).slice(-TILE_WEEKS); },
      measureRange(m){
        const w = this.tileWeeks(m);
        if (!w.length) return '';
        const mon = wk => new Date(wk + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const a = mon(w[0].week), b = mon(w[w.length - 1].week);
        return a === b ? a : a + ' → ' + b;
      },

      // ── The side panel ───────────────────────────────────────────────────
      // Whether it shows is the container query's to say; read from the
      // panel's own box whenever the Areas tab's changes, so a tap on a tile
      // picks only where there is a panel to narrow.
      watchRail(el){
        railRO?.disconnect();
        railRO = null;
        const fit = () => { const on = (el.querySelector('[data-program-rail]')?.offsetWidth || 0) > 0; if (on !== this.railOn) this.railOn = on; };
        fit();
        requestAnimationFrame(fit);
        if (window.ResizeObserver) { railRO = new ResizeObserver(fit); railRO.observe(el); }
      },
      // The commits of the heat grids' four weeks, from both reads joined
      // (Programs.commitDays), each with its areas' marks; narrowed to the
      // picked area, as its heat grid counts them.
      railOf(p){
        const raw = x => x?.length ? (window.Alpine?.raw ? window.Alpine.raw(x) : x) : RAIL_NONE;
        const c = this.commitsOf(p), A = raw(c.all || c.rows), B = raw(this.activityOf(p).commits), C = raw(this.charterOf(p).areas);
        const today = new Date().toDateString();
        if (!(railMemo && railMemo.key === p.key && railMemo.A === A && railMemo.B === B && railMemo.C === C && railMemo.today === today)) {
          const since = window.Programs.heatStart(Date.now(), PROGRAM_HEAT_WEEKS).getTime();
          const marks = new Map(C.map(a => [a.key, { key: a.key, label: a.label, icon: this.areaIconOf(p, a), a }]));
          const all = window.Programs.commitDays([A, B], C, since);
          for (const d of all.days) for (const x of d.commits) {
            x.marks = x.areas.map(k => marks.get(k));
            x.url ||= window.RepoAddress?.github.commit(p.repo, x.sha) || '';
          }
          railMemo = { key: p.key, A, B, C, today, all, by: new Map() };
        }
        const pick = this.pickedArea(p);
        if (!pick) return railMemo.all;
        if (!railMemo.by.has(pick.key)) {
          const days = railMemo.all.days.map(d => ({ day: d.day, commits: d.commits.filter(x => x.areas.includes(pick.key)) })).filter(d => d.commits.length);
          railMemo.by.set(pick.key, { days, count: days.reduce((n, d) => n + d.commits.length, 0) });
        }
        return railMemo.by.get(pick.key);
      },
      // Whole days, until RAIL_STEP commits or more are drawn, and how many
      // are left.
      railShown(p){
        const r = this.railOf(p), days = [];
        let n = 0;
        for (const d of r.days) { if (n >= this.railLimit) break; days.push(d); n += d.commits.length; }
        return { days, more: r.count - n };
      },
      // Loading while either read is and nothing is there to draw; an error
      // only where both failed.
      railState(p){
        const ch = this.charterOf(p).state, c = p.governs.length ? this.commitsOf(p).state : 'ok';
        const a = ch === 'ok' ? this.activityOf(p).state : ch === 'loading' ? 'loading' : 'ok';
        if ((c === 'loading' || a === 'loading') && !this.railOf(p).count) return 'loading';
        return c === 'error' && a !== 'ok' ? 'error' : 'ok';
      },
      // The section the panel ends on, whose list ends clear of the app's
      // floating button.
      railLast(p){ return this.hasToken() && p.charter ? 'notes' : this.tasksOf(p) !== null ? 'tasks' : 'changes'; },
      railCount(p){ return this.railState(p) === 'ok' ? this.railOf(p).count.toLocaleString() : ''; },
      // Its window and count, said as a heat grid's are.
      railTip(p){
        const t = new Date(), first = window.Programs.heatStart(t.getTime(), PROGRAM_HEAT_WEEKS);
        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return fmt(first) + ' → ' + fmt(t) + ' · ' + this.plural(this.railOf(p).count, 'commit');
      },
      dayLabel(day){ return new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); },
      pathName(path){ return path ? docName(path) : ''; },
      // An area's icon as its tile draws it: a Phosphor glyph in duotone, and
      // a Map view's own drawn mark as it comes.
      duotone(icon){ return icon?.startsWith('ph-') ? 'ph-duotone ' + icon : icon || ''; },
      areaIconOf(p, a){ return window.Programs.areaIcon(p, a.label, (p.areas || []).find(d => d.name === a.label) || null); },
      // The picked area is the address's (&area=, by its name), so a link
      // reopens it and Back clears it.
      pickedArea(p){
        const name = window.__shell?.programArea || '';
        return name ? this.charterOf(p).areas.find(a => a.label === name) || null : null;
      },
      isPicked(a){ return !!a && !!window.__shell?.programArea && window.__shell.programArea === a.label; },
      pickArea(a){
        this.railLimit = RAIL_STEP;
        window.__shell?.goProgramArea?.(a && !this.isPicked(a) ? a.label : '');
      },
      // A tap on a tile picks it, unless it lands on one of the tile's own
      // controls; the name answers Enter and Space where it is a button.
      tileClick(a, e){
        if (!this.railOn || e.target.closest?.('a, button, input, select, textarea, [data-chart-tip]')) return;
        this.pickArea(a);
      },
      tileKey(a, e){
        if (!this.railOn || e.target !== e.currentTarget || !['Enter', ' '].includes(e.key)) return;
        e.preventDefault();
        this.pickArea(a);
      },
      // A commit and its areas' tiles, under the pointer: the commit marks
      // its tiles and its day in each one's heat grid, and a tile its commits.
      railHot(c){ return !!this.hoverArea && c.areas.includes(this.hoverArea); },
      tileHot(a){ return !!this.hoverCommit?.areas?.includes(a.key); },
      dayHot(a, d){ const c = this.hoverCommit; return !!c && c.day === d.day && c.areas.includes(a.key); },

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
          // Under the mark where it fits, else over it; where neither side
          // holds it whole, as a group's long list may not, the roomier side,
          // scrolling inside, so it never covers the mark that opened it.
          const h = t.offsetHeight, below = innerHeight - 8 - (r.bottom + 6), above = r.top - 6 - 8;
          if (h <= below) return;
          if (h <= above) this.chartTip.y = r.top - 6 - h;
          else if (above > below) Object.assign(this.chartTip, { y: 8, maxH: above });
          else this.chartTip.maxH = Math.max(0, below);
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
