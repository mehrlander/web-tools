// PowerShell outpost state: what the repository holds for the work computer's
// PowerShell suite, which has no Git checkout, where each file is meant to go,
// what has been observed about the copy over there, and whether GitHub has
// moved since. The general outpost pattern is docs/outposts.md; this kit is
// its PowerShell instance (Profile, Modules, Forms and Scripts areas). Nothing
// here places a file: see the PowerShell outpost protocol in docs/outposts.csv.
// Pure derivation over three inputs the PowerShell outpost view fetches (a
// project's outpost.json, the repo tree at the browsed ref, and the observations
// CSV), plus the one write: appending a row to that CSV on a confirmed
// gesture. Nothing here claims a file is installed on its own; a row of kind
// `installed` is built only by an explicit call and committed only by
// append(), which the pane reaches after a confirm that shows the row.
//
// Browser-local checks (lib/kits/file-correspondence.js) are evidence the pane
// shows and can promote to a row; they are not read here, so the derivation
// depends on the repository alone and a later session sees the same states.
(() => {
  const HEADER = ['date', 'path', 'kind', 'revision', 'blob_sha', 'local_sha256', 'match', 'method', 'note'];
  const KINDS = ['installed', 'verified', 'differs'];
  const COMPARABLE = /\.(?:ps1|psm1|psd1|ps1xml|xaml)$/i;
  // One label per state, and the wording is the contract: qualified, never a
  // bare "synced". `changed` is what a stale reported install or verification
  // becomes once the repository file's blob moves.
  const LABELS = {
    unknown: 'local state unknown',
    reported: 'reported installed',
    verified: 'verified from supplied copy',
    changed: 'GitHub changed since',
    differs: 'local copy differs',
    'differs-changed': 'local copy differed; GitHub changed since',
    'repo-only': 'repository only',
    'pending-new': 'new file awaiting adoption',
    'pending-changed': 'update awaiting adoption',
    partial: 'selected changes reported installed',
  };
  const STATES = Object.keys(LABELS);

  // The manifest carries mappings and statuses, never explanation: the
  // document it names in `doc` owns that, and holding the two apart is what
  // keeps one set of facts from being written down twice. So nothing here
  // reads a prose field, and the pane links to the document instead.
  const manifest = json => {
    const m = typeof json === 'string' ? JSON.parse(json) : (json || {});
    const correspondence = (Array.isArray(m.correspondence) ? m.correspondence : [])
      .filter(c => c && typeof c.repo === 'string' && c.repo)
      .map(c => ({ repo: c.repo, area: c.area || c.repo,
        installs: c.installs === null || c.installs === undefined ? (c.installs === null ? null : '') : String(c.installs) }));
    const localAreas = (Array.isArray(m.local_areas) ? m.local_areas : [])
      .filter(a => a && a.name)
      .map(a => ({ name: a.name, status: a.status === 'local-only' ? 'local-only' : 'unresolved',
        shape: a.shape || '' }));
    // `requires` names files an entry must be placed with that its code does
    // not show it loading; it is carried only when it lists something.
    const pendingAdoption = (Array.isArray(m.pending_adoption) ? m.pending_adoption : [])
      .filter(e => e && typeof e.path === 'string' && e.path && ['new', 'changed'].includes(e.transfer))
      .map(e => {
        const requires = (Array.isArray(e.requires) ? e.requires : []).filter(r => typeof r === 'string' && r);
        return { path: e.path, since: e.since || '', transfer: e.transfer, limit: e.limit || '', ...(requires.length ? { requires } : {}) };
      });
    return { asOf: m.as_of || '', root: m.root || '', doc: m.doc || '',
      observations: m.observations || '', unitObservations: m.unit_observations || '', loads: m.loads || '', applications: m.applications || '',
      correspondence, localAreas, pendingAdoption };
  };

  // Where a project-relative path is meant to go. `installs` null means no
  // destination (repository-only material); '' means the destination folder
  // is known but the filename is not (the profile), reported as the root.
  const place = (rel, m) => {
    for (const c of m.correspondence) {
      const hit = c.repo.endsWith('/') ? rel.startsWith(c.repo) : rel === c.repo;
      if (!hit) continue;
      if (c.installs === null) return { area: c.area, installs: null };
      if (c.installs === '') return { area: c.area, installs: '' };
      return { area: c.area, installs: c.installs + (c.repo.endsWith('/') ? rel.slice(c.repo.length) : '') };
    }
    return null;
  };

  const kindOf = (area, rel) => {
    const ext = (rel.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (area === 'Profile') return 'profile';
    if (area === 'Forms') return ext === '.xaml' ? 'xaml' : ext === '.ps1' ? 'controller' : 'resource';
    if (area === 'Modules') return ext === '.psm1' ? 'module' : ext === '.ps1' ? 'companion' : 'resource';
    if (area === 'Scripts') return 'script';
    return 'other';
  };

  // The tree's blobs under the project's app/, each placed by the manifest.
  // `unit` is the module or form folder, the axis the pane groups on; a form's
  // controller and XAML are paired by stem within one folder and carry each
  // other's path so the pane can show them together and act on them apart.
  const inventory = ({ tree, manifest: m, projectPath }) => {
    const prefix = projectPath.replace(/\/+$/, '') + '/';
    const items = [];
    for (const n of tree || []) {
      if (n.type !== 'blob' || !n.path.startsWith(prefix)) continue;
      const rel = n.path.slice(prefix.length);
      const p = place(rel, m);
      if (!p) continue;
      const parts = rel.split('/');
      const name = parts[parts.length - 1];
      const unit = p.area === 'Modules' || p.area === 'Forms' ? (parts[2] || '') : parts.slice(2, -1).join('/') || p.area;
      items.push({ path: n.path, rel, name, area: p.area, unit, installs: p.installs,
        kind: kindOf(p.area, rel), comparable: COMPARABLE.test(name),
        blobSha: n.sha || '', size: n.size || 0, companion: '',
        pendingAdoption: (m.pendingAdoption || []).find(e => e.path === rel) || null });
    }
    const byDir = new Map();
    for (const it of items) {
      const dir = it.rel.slice(0, it.rel.length - it.name.length);
      const stem = it.name.replace(/\.[^.]+$/, '').toLowerCase();
      const key = dir + stem;
      if (!byDir.has(key)) byDir.set(key, []);
      byDir.get(key).push(it);
    }
    for (const group of byDir.values()) {
      const ctl = group.find(i => i.kind === 'controller'), xaml = group.find(i => i.kind === 'xaml');
      if (ctl && xaml) { ctl.companion = xaml.path; xaml.companion = ctl.path; }
    }
    return items.sort((a, b) => a.path.localeCompare(b.path));
  };

  // Area order follows the manifest; units and files sort by name, and a
  // form's XAML follows its controller.
  const groups = (items, m) => {
    const order = m.correspondence.map(c => c.area);
    const areas = new Map();
    for (const it of items) {
      if (!areas.has(it.area)) areas.set(it.area, new Map());
      const units = areas.get(it.area);
      if (!units.has(it.unit)) units.set(it.unit, []);
      units.get(it.unit).push(it);
    }
    const rank = it => it.kind === 'xaml' ? 1 : it.kind === 'resource' ? 2 : 0;
    return [...areas.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([area, units]) => {
        const c = m.correspondence.find(x => x.area === area) || {};
        return { area, installs: c.installs,
          units: [...units.entries()].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, files]) => ({ name, files: files.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)) })) };
      });
  };

  // The two derived tables a workspace may declare beside its manifest, both
  // written by the workspace's own tools from its source. Their paths are
  // project-relative there and repository-relative here, like an item's.
  const inProject = (projectPath, rel) => projectPath.replace(/\/+$/, '') + '/' + rel;
  const edges = (text, projectPath) => {
    if (!window.Csv) throw new Error('kits/csv.js is required to read load edges');
    return window.Csv.rows(text || '').filter(r => r.path && r.loads)
      .map(r => ({ from: inProject(projectPath, r.path), to: inProject(projectPath, r.loads), how: r.how || '', evidence: r.evidence || '' }));
  };
  const uses = (text, projectPath) => {
    if (!window.Csv) throw new Error('kits/csv.js is required to read application uses');
    return window.Csv.rows(text || '').filter(r => r.path && r.app)
      .map(r => ({ path: inProject(projectPath, r.path), app: r.app, how: r.how || '', evidence: r.evidence || '' }));
  };

  // The files each application reaches, in the order the table first names
  // the applications, for the view's application pills. A file reaching two
  // applications belongs to both, and an application no file in the
  // inventory reaches is left out.
  const applicationFiles = (items, appUses) => {
    const inTree = new Set(items.map(it => it.path)), apps = new Map();
    for (const u of appUses || []) {
      if (!inTree.has(u.path)) continue;
      if (!apps.has(u.app)) apps.set(u.app, new Set());
      apps.get(u.app).add(u.path);
    }
    return [...apps].map(([app, paths]) => ({ app, paths }));
  };

  // What must be placed with a file, dependencies first and the file last.
  // A dependency is strict when the file loads a file whose pending entry
  // says `new`, absent on the work computer, or when its own entry
  // `requires` it; a load of a `changed` file is not, since the older copy
  // there may serve. Only files still pending count, and the walk follows
  // each strict dependency's own. The workspace's check holds the same rule.
  const installSet = (path, items, loadEdges) => {
    const byPath = new Map(items.map(it => [it.path, it]));
    const prefix = path.slice(0, path.length - (byPath.get(path)?.rel || '').length);
    const strict = from => {
      const it = byPath.get(from), out = [];
      for (const e of loadEdges || []) if (e.from === from && byPath.get(e.to)?.pendingAdoption?.transfer === 'new') out.push(e.to);
      for (const r of it?.pendingAdoption?.requires || []) if (byPath.get(prefix + r)?.pendingAdoption) out.push(prefix + r);
      return out;
    };
    const seen = new Set(), order = [];
    const walk = from => {
      if (seen.has(from)) return;
      seen.add(from);
      for (const to of strict(from)) walk(to);
      order.push(byPath.get(from));
    };
    if (byPath.has(path)) walk(path);
    return order.filter(Boolean);
  };

  // ── Resources ─────────────────────────────────────────────────────────
  // A resource is a module or a form: the folder the work computer's
  // Resources.psm1 treats as one named thing, and the unit the list groups
  // files under. The profile is one file, scripts are kept by policy rather
  // than installed, and an Html or Formats folder holds a single file whose
  // own view says what there is, so only Modules and Forms make resources.
  // `path` is the folder in the repository, `installs` the folder it lands
  // in on the work computer.
  const RESOURCE_AREAS = ['Modules', 'Forms'];
  const resourceKey = it => it && RESOURCE_AREAS.includes(it.area) && it.unit ? it.area + '/' + it.unit : '';
  const resources = items => {
    const out = new Map();
    for (const it of items) {
      const key = resourceKey(it);
      if (!key) continue;
      if (!out.has(key)) {
        const inner = it.rel.split('/').slice(3).join('/');
        out.set(key, { key, area: it.area, name: it.unit, path: it.path.slice(0, it.path.length - inner.length),
          installs: typeof it.installs === 'string' ? it.installs.slice(0, it.installs.length - inner.length) : it.installs, files: [] });
      }
      out.get(key).files.push(it);
    }
    return out;
  };

  // What loads a resource and what it loads, from the workspace's load
  // table: one entry per neighbour, another resource or a file outside any
  // (the profile, a script), with the kinds of load and the files on that
  // side. Edges inside the resource are its composition, not neighbours. A
  // target missing from the tree is kept, as the table keeps it.
  const neighbours = (res, items, loadEdges) => {
    const own = new Set(res.files.map(it => it.path)), byPath = new Map(items.map(it => [it.path, it]));
    const side = (near, far) => {
      const out = new Map();
      for (const e of loadEdges || []) {
        if (!own.has(e[near]) || own.has(e[far])) continue;
        const it = byPath.get(e[far]), key = resourceKey(it) || e[far];
        if (!out.has(key)) out.set(key, { key, resource: !!resourceKey(it), area: it?.area || '', missing: !it,
          label: resourceKey(it) ? it.unit : it?.name || e[far].split('/').pop(), how: new Set(), files: new Set() });
        out.get(key).how.add(e.how); out.get(key).files.add(e[far]);
      }
      return [...out.values()].map(n => ({ ...n, how: [...n.how], files: [...n.files] }))
        .sort((a, b) => b.resource - a.resource || a.label.localeCompare(b.label));
    };
    return { loadedBy: side('to', 'from'), loads: side('from', 'to') };
  };

  // How a resource's files come together. A module's entry is the .psm1
  // named for its folder; what it dot-sources, and what those load in turn,
  // load with it. A code file in the folder that only something outside
  // loads (a tool the profile adds) is set apart, and one that nothing loads
  // apart again. Other files (XAML, XML, JSON) are listed without a claim,
  // since the load table reads only code; `known` is false when there is no
  // table at all, and nothing is claimed. A form is its XAML and controller,
  // paired by stem, the form named for its folder first.
  const composition = (res, loadEdges) => {
    const own = new Map(res.files.map(it => [it.path, it])), edges = loadEdges || [];
    const code = it => /\.(ps1|psm1)$/i.test(it.name);
    if (res.area === 'Forms') {
      const seen = new Set(), pairs = [];
      for (const it of res.files) if (it.kind === 'xaml') {
        const controller = (it.companion && own.get(it.companion)) || null;
        pairs.push({ name: it.name.replace(/\.xaml$/i, ''), xaml: it, controller });
        seen.add(it.path); if (controller) seen.add(controller.path);
      }
      pairs.sort((a, b) => (b.name.toLowerCase() === res.name.toLowerCase()) - (a.name.toLowerCase() === res.name.toLowerCase()) || a.name.localeCompare(b.name));
      return { pairs, other: res.files.filter(it => !seen.has(it.path)), known: edges.length > 0 };
    }
    const entry = res.files.find(it => it.name.toLowerCase() === res.name.toLowerCase() + '.psm1') || res.files.find(it => it.kind === 'module') || null;
    const loaded = [], reached = new Set(entry ? [entry.path] : []), queue = entry ? [entry.path] : [];
    while (queue.length) {
      const from = queue.shift();
      for (const e of edges) if (e.from === from && own.has(e.to) && !reached.has(e.to)) {
        reached.add(e.to); loaded.push({ item: own.get(e.to), by: own.get(from), how: e.how }); queue.push(e.to);
      }
    }
    const rest = res.files.filter(it => !reached.has(it.path));
    const outside = path => [...new Set(edges.filter(e => e.to === path && !own.has(e.from)).map(e => e.from))];
    return { entry, loaded, known: edges.length > 0,
      elsewhere: rest.filter(it => code(it) && outside(it.path).length).map(it => ({ item: it, by: outside(it.path) })),
      unloaded: rest.filter(it => code(it) && !outside(it.path).length), other: rest.filter(it => !code(it)) };
  };

  // Each function a resource defines, by how far its callers reach: called
  // from code outside the resource (`outside`), only from inside it
  // (`inside`), or from no code at all (`none`), which for a module of
  // console commands is most of it and says nothing about use by hand.
  // `facts` maps each read file's path to { functions, calls } from
  // kits/powershell-language.js. A call is the file's when it sits in no
  // function; a function calling itself is not its own caller. A name two
  // places define is credited to both, as the load table credits it, since
  // which one runs depends on load order; `also` names the other files. The
  // exception is a caller whose own resource, or own file outside any,
  // defines the name: its call resolves there, as a module's own function
  // shadows an imported one.
  const reach = (res, items, facts) => {
    const own = new Set(res.files.map(it => it.path)), byPath = new Map(items.map(it => [it.path, it]));
    const home = path => resourceKey(byPath.get(path)) || path;
    const defs = new Map();
    for (const [path, f] of facts) for (const fn of f.functions || []) {
      const k = fn.name.toLowerCase();
      if (!defs.has(k)) defs.set(k, []);
      defs.get(k).push({ path, name: fn.name, line: fn.line });
    }
    const innermost = (fns, line) => (fns || []).filter(fn => fn.line <= line && line <= (fn.endLine || fn.line))
      .sort((a, b) => ((a.endLine || a.line) - a.line) - ((b.endLine || b.line) - b.line))[0];
    const callers = new Map();
    for (const [path, f] of facts) for (const c of f.calls || []) {
      const k = c.name.toLowerCase();
      if (!defs.has(k)) continue;
      const fn = innermost(f.functions, c.line);
      if (fn && fn.name.toLowerCase() === k) continue;
      if (!callers.has(k)) callers.set(k, []);
      callers.get(k).push({ path, by: fn ? fn.name : '', line: c.line });
    }
    const out = [];
    for (const it of res.files) for (const fn of facts.get(it.path)?.functions || []) {
      const k = fn.name.toLowerCase(), seen = new Map(), inside = new Set();
      for (const c of callers.get(k) || []) {
        if (own.has(c.path)) { inside.add(c.by || byPath.get(c.path)?.name || c.path.split('/').pop()); continue; }
        if (defs.get(k).some(d => !own.has(d.path) && home(d.path) === home(c.path))) continue;
        const from = byPath.get(c.path), key = resourceKey(from) || c.path;
        if (!seen.has(key)) seen.set(key, { key, resource: !!resourceKey(from), area: from?.area || '', label: resourceKey(from) ? from.unit : from?.name || c.path.split('/').pop(), calls: [] });
        seen.get(key).calls.push({ path: c.path, line: c.line, by: c.by });
      }
      const outside = [...seen.values()].sort((a, b) => b.resource - a.resource || a.label.localeCompare(b.label));
      out.push({ name: fn.name, path: it.path, file: it.name, line: fn.line, outside, inside: [...inside].sort(),
        also: (defs.get(k) || []).filter(d => d.path !== it.path).map(d => d.path),
        reach: outside.length ? 'outside' : inside.size ? 'inside' : 'none' });
    }
    const rank = { outside: 0, inside: 1, none: 2 };
    return out.sort((a, b) => rank[a.reach] - rank[b.reach] || b.outside.length - a.outside.length || a.name.localeCompare(b.name));
  };

  // A resource's pending entries, each distinct limit said once with the
  // files it covers: a form's two files usually share one.
  const pendingOf = res => {
    const out = new Map();
    for (const it of res.files) {
      const p = it.pendingAdoption;
      if (!p) continue;
      if (!out.has(p.limit || '')) out.set(p.limit || '', { limit: p.limit || '', files: [] });
      out.get(p.limit || '').files.push(it);
    }
    return [...out.values()];
  };

  const observations = text => {
    if (!window.Csv) throw new Error('kits/csv.js is required to read observations');
    return window.Csv.rows(text).filter(r => r.path && KINDS.includes(r.kind));
  };

  const historyFor = (path, rows) => (rows || []).filter(r => r.path === path)
    .sort((a, b) => b.date.localeCompare(a.date));

  // The state of one file, read off its newest durable row against the blob
  // the browsed ref holds now. Newest wins: a verification after a reported
  // install reads as verified, a reported install after a differing copy
  // reads as reported. A repository-only file keeps its history but reads as
  // repository only, since it has no place to be installed to.
  const derive = (item, rows, unitRows = []) => {
    const history = historyFor(item.path, rows);
    const latest = history[0] || null;
    let state;
    if (item.installs === null) state = 'repo-only';
    else if (!latest) state = item.pendingAdoption ? 'pending-' + item.pendingAdoption.transfer : 'unknown';
    else {
      const same = latest.blob_sha === item.blobSha;
      if (latest.kind === 'installed') state = same ? 'reported' : 'changed';
      else if (latest.kind === 'verified') state = same ? 'verified' : 'changed';
      else state = same ? 'differs' : 'differs-changed';
    }
    const partial = historyFor(item.path, unitRows).find(r => !latest || r.date > latest.date) || null;
    if (partial && item.installs !== null) state = 'partial';
    let label = LABELS[state];
    if (state === 'changed') label += latest.kind === 'installed' ? ' reported install' : ' verification';
    if (state === 'verified' && latest.match === 'line-endings') label += ' (line endings differ)';
    // A row and a pending entry on one file contradict each other: the row says
    // the file reached the work computer, the entry says it has not. The row
    // wins for the state, and the contradiction is named, since the workspace's
    // own check (outpost-check.py) fails while both exist.
    const conflict = !!(latest && item.pendingAdoption);
    if (conflict) label += '; pending entry still listed';
    return { state, label, latest, history, conflict, partial };
  };

  const summary = derived => {
    const counts = Object.fromEntries(STATES.map(s => [s, 0]));
    for (const d of derived) counts[d.state] = (counts[d.state] || 0) + 1;
    return counts;
  };

  // Whether two texts differ only in whitespace a paste into the ISE can
  // change: line endings, spaces at line ends, a leading byte order mark, and
  // blank lines at either end. Such a copy is a match.
  const plain = t => String(t ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
  const whitespaceOnly = (a, b) => plain(a) === plain(b);
  const matchOf = check => check.exact ? 'exact' : check.lineEndingsOnly ? 'line-endings'
    : check.whitespaceOnly ? 'whitespace' : 'none';

  // A row is built by one of two callers and nowhere else: the pane's
  // "I placed this on the work computer" confirm (kind installed) and the
  // promotion of a browser-local check (kind verified or differs, from the
  // check's own exact, lineEndingsOnly and whitespaceOnly reading). Every field
  // is validated so a half-built row cannot reach the observations file.
  const row = ({ kind, path, revision, blobSha, sha256, match = '', method, note = '', date }) => {
    if (!KINDS.includes(kind)) throw new Error('observation kind must be installed, verified or differs');
    if (!path || !/^[^\\:#?\x00-\x1f]+$/.test(path) || path.startsWith('/')) throw new Error('observation path must be repository-relative');
    if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('observation needs the 40-hex revision it is about');
    if (!/^[0-9a-f]{40}$/.test(blobSha || '')) throw new Error('observation needs the file\'s 40-hex blob sha');
    if (!/^[0-9a-f]{64}$/.test(sha256 || '')) throw new Error('observation needs the SHA-256 of the text observed');
    if (kind === 'installed' ? match !== '' : !['exact', 'line-endings', 'whitespace', 'none'].includes(match))
      throw new Error('match is blank for installed and exact, line-endings, whitespace or none otherwise');
    if (!method) throw new Error('observation needs the method the evidence arrived by');
    return { date: date || new Date().toISOString(), path, kind, revision, blob_sha: blobSha,
      local_sha256: sha256, match, method, note: String(note).replace(/[\r\n]+/g, ' ').trim() };
  };
  const fromCheck = (check, note = '') => row({
    kind: matchOf(check) === 'none' ? 'differs' : 'verified',
    path: check.path, revision: check.revision, blobSha: check.blobSha, sha256: check.incomingSha256,
    match: matchOf(check),
    method: check.source || 'paste', note });
  // A check is recorded when a durable row carries its revision and its text's
  // hash: the pair the check itself is keyed on.
  const isRecorded = (check, rows) => (rows || []).some(r => r.path === check.path
    && r.revision === check.revision && r.local_sha256 === check.incomingSha256);

  const cell = v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const line = r => HEADER.map(h => cell(String(r[h] ?? ''))).join(',');
  const digest = async text => {
    const bytes = new TextEncoder().encode(text);
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  };

  // A separate ledger deliberately cannot close a whole-file pending entry.
  // Hashes describe the reviewed text, not a byte inspection of the machine.
  const validateUnitRecord = r => {
    const hex = (value, size) => new RegExp('^[0-9a-f]{' + size + '}$').test(value || '');
    if (!r || !/^\d{4}-\d\d-\d\dT/.test(r.date || '') || !Number.isFinite(Date.parse(r.date))
        || !r.path || r.path.startsWith('/') || r.path.split('/').some(p => !p || p === '.' || p === '..') || /[\\:#?\x00-\x1f]/.test(r.path)
        || !hex(r.revision, 40) || !hex(r.blob_sha, 40) || !hex(r.before_sha256, 64) || !hex(r.result_sha256, 64)
        || !Array.isArray(r.units) || !r.units.length || typeof r.note !== 'string') throw new Error('Invalid selected-change observation.');
    for (const u of r.units) if (!u.name || !u.kind || !['Add', 'Replace', 'Remove'].includes(u.action)
        || !hex(u.before_sha256, 64) || !hex(u.after_sha256, 64)
        || ![u.start, u.end, u.after_start, u.after_end].every(n => Number.isInteger(n) && n >= 0)
        || u.end < u.start || u.after_end < u.after_start) throw new Error('Invalid unit in selected-change observation.');
    return r;
  };
  const unitObservations = text => {
    if (!text) return [];
    const data = JSON.parse(text);
    if (data?.schema !== 1 || !Array.isArray(data.observations)) throw new Error('Unknown selected-change ledger format.');
    return data.observations.map(validateUnitRecord);
  };
  const unitRecord = async ({ review, ids, selection, resultText, note = '', date = new Date().toISOString() }) => {
    const units = [];
    for (const u of review.units.filter(u => ids.includes(u.id))) units.push({ name: u.name, kind: u.kind, action: u.action,
      start: u.start, end: u.end, after_start: u.afterStart, after_end: u.afterEnd,
      before_sha256: await digest(u.before), after_sha256: await digest(u.after) });
    return validateUnitRecord({ date, path: selection.path, revision: selection.revision, blob_sha: selection.blobSha,
      before_sha256: await digest(review.before), result_sha256: await digest(resultText), units, note: String(note).trim() });
  };
  const unitObservationsText = (cur, record) => {
    validateUnitRecord(record);
    const rows = unitObservations(cur?.text || '');
    if (rows.some(r => r.date > record.date)) throw new Error('A newer selected-change observation exists. Reload and review again.');
    if (rows.some(r => JSON.stringify(r) === JSON.stringify(record))) throw new Error('This selected-change observation is already recorded.');
    return JSON.stringify({ schema: 1, observations: [...rows, record] }, null, 2) + '\n';
  };

  const observationsText = (cur, written, date) => {
    let text = cur ? cur.text : HEADER.join(',') + '\n';
    const head = text.split(/\r?\n/)[0].trim();
    if (head !== HEADER.join(',')) throw new Error('The observations file header is not the one this kit writes: ' + head);
    // A confirmation can remain open while another observer records a newer
    // row. Keep the reviewed timestamp intact and use the observations checker's
    // lexical ISO-date ordering; do not silently restamp it or commit a row
    // that makes the append-only observations file run backwards.
    const latest = observations(text).reduce((last, r) => r.date > last ? r.date : last, '');
    if (date < latest)
      throw new Error('The observations file contains a newer observation. Refresh the outpost and prepare this observation again before recording.');
    if (!text.endsWith('\n')) text += '\n';
    return text + written + '\n';
  };

  const readObservations = async (gh, path, fresh) => {
    try { return await gh.get(path, fresh); }
    catch (e) { if (e?.status === 404) return null; throw e; }
  };

  // manifestPath names the declared manifest, wherever it lives inside the
  // project. A pending path is project-relative; derive its project prefix
  // from the full observed path, then require the manifest inside that same
  // project. Matching a basename or an unscoped suffix could close another
  // project's entry. Keep the raw manifest's other keys and entries intact.
  const closeAdoption = (text, manifestPath, observationsPath, observedPath) => {
    const m = JSON.parse(text);
    if (!m || Array.isArray(m) || typeof m !== 'object' || m.observations !== observationsPath)
      throw new Error('The PowerShell outpost manifest does not name this observations file.');
    if (m.pending_adoption !== undefined && !Array.isArray(m.pending_adoption))
      throw new Error('The PowerShell outpost manifest pending_adoption must be a list.');
    const entries = m.pending_adoption || [];
    const remaining = entries.filter(e => {
      if (!e || typeof e.path !== 'string' || !e.path.startsWith('app/')
          || e.path.split('/').some(p => !p || p === '.' || p === '..')) return true;
      if (!observedPath.endsWith('/' + e.path)) return true;
      const prefix = observedPath.slice(0, -e.path.length);
      return !manifestPath.startsWith(prefix);
    });
    if (remaining.length === entries.length) return null;
    m.pending_adoption = remaining;
    return JSON.stringify(m, null, 2) + '\n';
  };

  // Append on the captured branch. With a declared manifest, both inputs are
  // read at one immutable commit and a pending entry closes in the SAME Git
  // tree as its first observation, of any kind. A differing supplied copy
  // closes the queue entry too; its recorded state still says it differs.
  //
  // The branch is checked again before publication, then moved without force.
  // Never rebuild precomputed observations bytes on a newer tip: that could erase
  // someone else's appended rows (gh.commitFiles retries that way, so it is
  // not suitable here). Errors, including uncertain write outcomes, surface
  // for a fresh review instead of causing a second write. Without manifestPath
  // the existing one-file Contents API remains available, with its sha guard.
  // `rows` records several files in one commit, as a set placed together
  // is: every line lands and every entry closes, or none does.
  const append = async ({ gh, path, row: r, rows, message, manifestPath, unitRecord: partial }) => {
    if (!gh) throw new Error('No repository client to write with.');
    if (!gh.ref || /^[0-9a-f]{40}$/.test(gh.ref)) throw new Error('Recording needs a branch to commit to, not a pinned revision.');
    if (partial && !manifestPath) throw new Error('Selected-change recording needs its outpost manifest.');
    const list = partial ? [validateUnitRecord(partial)] : rows?.length ? rows : [r];
    if (list.some(x => !x?.path)) throw new Error('Every observation needs its row.');
    r = list[0];
    const branch = gh.ref;
    const written = partial ? JSON.stringify(partial) : list.map(line).join('\n');
    const fresh = window.GH?.FRESH || { cache: 'no-store' };
    const commitMessage = message || 'Record PowerShell outpost observation: ' + (partial ? 'selected changes' : r.kind) + ' '
      + (list.length > 1 ? list.length + ' files' : r.path.split('/').pop()) + ' via Web Tools';
    // Repository selection mutates the shared client's repo as well as ref.
    // Capture both so navigation cannot redirect any in-flight read or write.
    const client = Object.create(gh);
    client.repo = gh.repo;
    client.ref = branch;
    const reader = Object.create(client);
    if (!manifestPath) {
      const cur = await readObservations(reader, path, fresh);
      const body = { message: commitMessage, content: window.GH.toBase64(observationsText(cur, written, r.date)), branch };
      if (cur?.sha) body.sha = cur.sha;
      const res = await client.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
      return { line: written, sha: res?.content?.sha || '', commit: res?.commit?.sha || '' };
    }

    if (manifestPath === path) throw new Error('The PowerShell outpost manifest and observations file must be different files.');
    const refPath = 'git/ref/heads/' + branch;
    const tip = await client.req(refPath, fresh);
    const parent = tip?.object?.sha;
    if (!parent) throw new Error('Could not read the tip of ' + branch + '.');
    reader.ref = parent;
    const [cur, mf, head] = await Promise.all([
      readObservations(reader, path, fresh), reader.get(manifestPath, fresh), client.req('git/commits/' + parent, fresh),
    ]);
    const baseTree = head?.tree?.sha;
    if (!baseTree) throw new Error('The branch commit carries no tree.');
    if (partial) {
      const m = JSON.parse(mf.text);
      if (m.unit_observations !== path || m.observations === path) throw new Error('The manifest does not declare this selected-change ledger.');
      const sourceReader = Object.create(reader); sourceReader.ref = partial.revision;
      const source = await sourceReader.get(partial.path, fresh);
      if (source.sha !== partial.blob_sha) throw new Error('The recorded source does not match its pinned blob.');
    }
    const files = [{ path, text: partial ? unitObservationsText(cur, partial) : observationsText(cur, written, r.date) }];
    let adopted = null;
    for (const x of partial ? [] : list) {
      const next = closeAdoption(adopted ?? mf.text, manifestPath, path, x.path);
      if (next !== null) adopted = next;
    }
    if (adopted !== null) files.push({ path: manifestPath, text: adopted });
    const tree = [];
    for (const file of files) {
      const blob = await client.req('git/blobs', { method: 'POST',
        body: JSON.stringify({ content: window.GH.toBase64(file.text), encoding: 'base64' }) });
      if (!blob?.sha) throw new Error('Blob write returned no sha for ' + file.path + '.');
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const built = await client.req('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
    if (!built?.sha) throw new Error('The observation tree write returned no sha.');
    const commit = await client.req('git/commits', { method: 'POST',
      body: JSON.stringify({ message: commitMessage, tree: built.sha, parents: [parent] }) });
    if (!commit?.sha) throw new Error('The observation commit write returned no sha.');
    const current = await client.req(refPath, fresh);
    if (current?.object?.sha !== parent)
      throw new Error('The branch moved while recording. Reload its observations and review before recording again.');
    await client.req('git/refs/heads/' + branch, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    return { line: written, sha: tree[0].sha, commit: commit.sha, adoptionClosed: adopted !== null };
  };

  window.PowerShellOutpost = { HEADER, KINDS, STATES, LABELS, manifest, place, inventory, groups,
    edges, uses, applicationFiles, installSet, resourceKey, resources, neighbours, composition, reach, pendingOf,
    observations, historyFor, derive, summary, row, fromCheck, isRecorded, line, digest, append, whitespaceOnly, matchOf,
    unitObservations, unitRecord, validateUnitRecord };
})();
