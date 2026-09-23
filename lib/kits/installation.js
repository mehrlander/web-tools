// The installation ledger: what the repository holds for a work installation
// that has no Git checkout, where each file is meant to go, what has been
// observed about the copy over there, and whether GitHub has moved since.
// Pure derivation over three inputs the Installation tab fetches (a project's
// installation.json, the repo tree at the browsed ref, and the observations
// CSV), plus the one write: appending a row to that CSV on a confirmed
// gesture. Nothing here claims a file is installed on its own; a row of kind
// `installed` is built only by an explicit call and committed only by
// append(), which the pane reaches after a confirm that shows the row.
//
// Browser-local checks (lib/kits/file-correspondence.js) are evidence the pane
// shows and can promote to a row; they are not read here, so the derivation
// depends on the repository alone and a later session sees the same states.
//
// The manifest's pending_adoption list is the fourth input, folded into the
// inventory: a file the repository holds that the work computer does not,
// which without it reads as `local state unknown`, the same words as a file
// presumed installed. It carries the one fact the tree cannot (the file is
// ahead) and one line of what has not been exercised. An observation row
// outranks it: the entry's lifecycle ends when the first row lands, and the
// workspace's own check fails while both exist.
(() => {
  const HEADER = ['date', 'path', 'kind', 'revision', 'blob_sha', 'local_sha256', 'match', 'method', 'note'];
  const KINDS = ['installed', 'verified', 'differs'];
  const COMPARABLE = /\.(?:ps1|psm1|psd1|ps1xml|xaml)$/i;
  // One label per state, and the wording is the contract: qualified, never a
  // bare "synced". `changed` is what a stale reported install or verification
  // becomes once the repository file's blob moves.
  const LABELS = {
    unknown: 'local state unknown',
    ahead: 'repository ahead, not yet placed',
    reported: 'reported installed',
    verified: 'verified from supplied copy',
    changed: 'GitHub changed since',
    differs: 'local copy differs',
    'differs-changed': 'local copy differed; GitHub changed since',
    'repo-only': 'repository only',
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
    const pending = (Array.isArray(m.pending_adoption) ? m.pending_adoption : [])
      .filter(e => e && typeof e.path === 'string' && e.path)
      .map(e => ({ path: e.path, since: e.since || '',
        transfer: e.transfer === 'new' ? 'new' : e.transfer === 'changed' ? 'changed' : '', limit: e.limit || '' }));
    return { asOf: m.as_of || '', root: m.root || '', doc: m.doc || '',
      observations: m.observations || '', correspondence, localAreas, pending };
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
        ahead: (m.pending || []).find(e => e.path === rel) || null });
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
  // repository only, since it has no place to be installed to. A file with a
  // pending_adoption entry and no row reads as ahead; the first row wins.
  const derive = (item, rows) => {
    const history = historyFor(item.path, rows);
    const latest = history[0] || null;
    let state;
    if (item.installs === null) state = 'repo-only';
    else if (!latest) state = item.ahead ? 'ahead' : 'unknown';
    else {
      const same = latest.blob_sha === item.blobSha;
      if (latest.kind === 'installed') state = same ? 'reported' : 'changed';
      else if (latest.kind === 'verified') state = same ? 'verified' : 'changed';
      else state = same ? 'differs' : 'differs-changed';
    }
    let label = LABELS[state];
    if (state === 'changed') label += latest.kind === 'installed' ? ' reported install' : ' verification';
    if (state === 'verified' && latest.match === 'line-endings') label += ' (line endings differ)';
    if (state === 'ahead' && item.ahead.transfer) label += item.ahead.transfer === 'new' ? ' (new file)' : ' (changed file)';
    return { state, label, latest, history, ahead: state === 'ahead' ? item.ahead : null };
  };

  const summary = derived => {
    const counts = Object.fromEntries(STATES.map(s => [s, 0]));
    for (const d of derived) counts[d.state] = (counts[d.state] || 0) + 1;
    return counts;
  };

  // A row is built by one of two callers and nowhere else: the pane's
  // "I placed this on the work computer" confirm (kind installed) and the
  // promotion of a browser-local check (kind verified or differs, from the
  // check's own exact/lineEndingsOnly reading). Every field is validated so a
  // half-built row cannot reach the ledger.
  const row = ({ kind, path, revision, blobSha, sha256, match = '', method, note = '', date }) => {
    if (!KINDS.includes(kind)) throw new Error('observation kind must be installed, verified or differs');
    if (!path || !/^[^\\:#?\x00-\x1f]+$/.test(path) || path.startsWith('/')) throw new Error('observation path must be repository-relative');
    if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('observation needs the 40-hex revision it is about');
    if (!/^[0-9a-f]{40}$/.test(blobSha || '')) throw new Error('observation needs the file\'s 40-hex blob sha');
    if (!/^[0-9a-f]{64}$/.test(sha256 || '')) throw new Error('observation needs the SHA-256 of the text observed');
    if (kind === 'installed' ? match !== '' : !['exact', 'line-endings', 'none'].includes(match))
      throw new Error('match is blank for installed and exact, line-endings or none otherwise');
    if (!method) throw new Error('observation needs the method the evidence arrived by');
    return { date: date || new Date().toISOString(), path, kind, revision, blob_sha: blobSha,
      local_sha256: sha256, match, method, note: String(note).replace(/[\r\n]+/g, ' ').trim() };
  };
  const fromCheck = (check, note = '') => row({
    kind: check.exact || check.lineEndingsOnly ? 'verified' : 'differs',
    path: check.path, revision: check.revision, blobSha: check.blobSha, sha256: check.incomingSha256,
    match: check.exact ? 'exact' : check.lineEndingsOnly ? 'line-endings' : 'none',
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

  // Append one row to the ledger on the branch `gh.ref` names. The read is
  // FRESH and the PUT carries that read's sha, so a ledger that moved between
  // the read and the write is rejected rather than overwritten; one re-read
  // and retry covers the ordinary race, and a second conflict surfaces. A
  // missing ledger is created with the header. Returns the line written and
  // the commit that carries it.
  const append = async ({ gh, path, row: r, message }) => {
    if (!gh) throw new Error('No repository client to write with.');
    if (!gh.ref || /^[0-9a-f]{40}$/.test(gh.ref)) throw new Error('Recording needs a branch to commit to, not a pinned revision.');
    const written = line(r);
    const fresh = window.GH?.FRESH || { cache: 'no-store' };
    let attempt = 0;
    for (;;) {
      let cur = null;
      try { cur = await gh.get(path, fresh); }
      catch (e) { if (e?.status !== 404) throw e; }
      let text = cur ? cur.text : HEADER.join(',') + '\n';
      const head = text.split(/\r?\n/)[0].trim();
      if (head !== HEADER.join(',')) throw new Error('The ledger header is not the one this kit writes: ' + head);
      if (!text.endsWith('\n')) text += '\n';
      const body = { message: message || 'Record installation observation: ' + r.kind + ' ' + r.path.split('/').pop() + ' via Web Tools',
        content: window.GH.toBase64(text + written + '\n'), branch: gh.ref };
      if (cur?.sha) body.sha = cur.sha;
      try {
        const res = await gh.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
        return { line: written, sha: res?.content?.sha || '', commit: res?.commit?.sha || '' };
      } catch (e) {
        if ((e?.status !== 409 && e?.status !== 422) || ++attempt > 1) throw e;
      }
    }
  };

  window.Installation = { HEADER, KINDS, STATES, LABELS, manifest, place, inventory, groups,
    observations, historyFor, derive, summary, row, fromCheck, isRecorded, line, digest, append };
})();
