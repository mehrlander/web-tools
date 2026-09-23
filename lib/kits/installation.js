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
    const pendingAdoption = (Array.isArray(m.pending_adoption) ? m.pending_adoption : [])
      .filter(e => e && typeof e.path === 'string' && e.path && ['new', 'changed'].includes(e.transfer))
      .map(e => ({ path: e.path, since: e.since || '', transfer: e.transfer, limit: e.limit || '' }));
    return { asOf: m.as_of || '', root: m.root || '', doc: m.doc || '',
      observations: m.observations || '', correspondence, localAreas, pendingAdoption };
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
  const derive = (item, rows) => {
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
    let label = LABELS[state];
    if (state === 'changed') label += latest.kind === 'installed' ? ' reported install' : ' verification';
    if (state === 'verified' && latest.match === 'line-endings') label += ' (line endings differ)';
    return { state, label, latest, history };
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

  // A Windows PowerShell 5.1 script that places one file on the work computer
  // from the bytes GitHub served for it. The bytes ride as Base64 and land
  // through WriteAllBytes, so the placed copy hashes to the same Git blob, and
  // the script reads the file back and says whether it does. Running it
  // records nothing: the Overview's confirm remains the only installation
  // claim. No ternary, ?? or && appears, so the script itself runs on 5.1.
  const transferScript = ({ path, name, installs, root, revision, blobSha, bytes }) => {
    if (installs === null || installs === undefined) throw new Error('This file has no installation destination.');
    if (!(bytes instanceof Uint8Array)) throw new Error('A transfer script needs the source bytes.');
    if (!/^[0-9a-f]{40}$/.test(blobSha || '')) throw new Error('A transfer script needs the Git blob sha the bytes were verified against.');
    const quote = v => "'" + String(v).replace(/'/g, "''") + "'";
    const rel = (installs === '' ? name : installs).replace(/\//g, '\\');
    const base = String(root || '').replace(/[\\/]+$/, '');
    const under = base ? base + '\\' + rel : rel;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return [
      '# Web Tools transfer script for ' + path + ' at ' + String(revision || '').slice(0, 7) + ' (Git blob ' + blobSha.slice(0, 7) + ').',
      '# Writes the bytes GitHub served for this revision; the placed file should hash to the same Git blob.',
      '# Running it records nothing: confirm the placement in the Overview afterwards.',
      ...(installs === '' ? ['# The manifest names the folder but not the filename; adjust $dest if the work computer uses another name.'] : []),
      '$dest = ' + (/^(?:[A-Za-z]:\\|\\\\)/.test(under) ? quote(under) : 'Join-Path $HOME ' + quote(under)),
      '$dir = Split-Path -Parent $dest',
      'if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }',
      '$bytes = [System.Convert]::FromBase64String(' + quote(btoa(binary)) + ')',
      '[System.IO.File]::WriteAllBytes($dest, $bytes)',
      '$placed = [System.IO.File]::ReadAllBytes($dest)',
      "$header = [System.Text.Encoding]::ASCII.GetBytes('blob ' + $placed.Length + [char]0)",
      '$sha1 = [System.Security.Cryptography.SHA1]::Create()',
      "$blob = [System.BitConverter]::ToString($sha1.ComputeHash([byte[]]($header + $placed))).Replace('-', '').ToLower()",
      'if ($blob -eq ' + quote(blobSha) + ") { Write-Host ('Placed ' + $dest + '; Git blob ' + $blob + ' matches GitHub.') }",
      "else { Write-Warning ('Placed ' + $dest + ' but its Git blob ' + $blob + ' does not match " + blobSha + ".') }",
      '',
    ].join('\r\n');
  };

  const ledgerText = (cur, written, date) => {
    let text = cur ? cur.text : HEADER.join(',') + '\n';
    const head = text.split(/\r?\n/)[0].trim();
    if (head !== HEADER.join(',')) throw new Error('The ledger header is not the one this kit writes: ' + head);
    // A confirmation can remain open while another observer records a newer
    // row. Keep the reviewed timestamp intact and use the ledger checker's
    // lexical ISO-date ordering; do not silently restamp it or commit a row
    // that makes the append-only ledger run backwards.
    const latest = observations(text).reduce((last, r) => r.date > last ? r.date : last, '');
    if (date < latest)
      throw new Error('The ledger contains a newer observation. Refresh the installation and prepare this observation again before recording.');
    if (!text.endsWith('\n')) text += '\n';
    return text + written + '\n';
  };

  const readLedger = async (gh, path, fresh) => {
    try { return await gh.get(path, fresh); }
    catch (e) { if (e?.status === 404) return null; throw e; }
  };

  // manifestPath names the declared manifest, wherever it lives inside the
  // project. A pending path is project-relative; derive its project prefix
  // from the full observed path, then require the manifest inside that same
  // project. Matching a basename or an unscoped suffix could close another
  // project's entry. Keep the raw manifest's other keys and entries intact.
  const closeAdoption = (text, manifestPath, ledgerPath, observedPath) => {
    const m = JSON.parse(text);
    if (!m || Array.isArray(m) || typeof m !== 'object' || m.observations !== ledgerPath)
      throw new Error('The installation manifest does not name this observations ledger.');
    if (m.pending_adoption !== undefined && !Array.isArray(m.pending_adoption))
      throw new Error('The installation manifest pending_adoption must be a list.');
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
  // closes the queue entry too; its ledger state still says it differs.
  //
  // The branch is checked again before publication, then moved without force.
  // Never rebuild precomputed ledger bytes on a newer tip: that could erase
  // someone else's appended rows (gh.commitFiles retries that way, so it is
  // not suitable here). Errors, including uncertain write outcomes, surface
  // for a fresh review instead of causing a second write. Without manifestPath
  // the existing one-file Contents API remains available, with its sha guard.
  const append = async ({ gh, path, row: r, message, manifestPath }) => {
    if (!gh) throw new Error('No repository client to write with.');
    if (!gh.ref || /^[0-9a-f]{40}$/.test(gh.ref)) throw new Error('Recording needs a branch to commit to, not a pinned revision.');
    const branch = gh.ref;
    const written = line(r);
    const fresh = window.GH?.FRESH || { cache: 'no-store' };
    const commitMessage = message || 'Record installation observation: ' + r.kind + ' ' + r.path.split('/').pop() + ' via Web Tools';
    // Repository selection mutates the shared client's repo as well as ref.
    // Capture both so navigation cannot redirect any in-flight read or write.
    const client = Object.create(gh);
    client.repo = gh.repo;
    client.ref = branch;
    const reader = Object.create(client);
    if (!manifestPath) {
      const cur = await readLedger(reader, path, fresh);
      const body = { message: commitMessage, content: window.GH.toBase64(ledgerText(cur, written, r.date)), branch };
      if (cur?.sha) body.sha = cur.sha;
      const res = await client.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
      return { line: written, sha: res?.content?.sha || '', commit: res?.commit?.sha || '' };
    }

    if (manifestPath === path) throw new Error('The installation manifest and observations ledger must be different files.');
    const refPath = 'git/ref/heads/' + branch;
    const tip = await client.req(refPath, fresh);
    const parent = tip?.object?.sha;
    if (!parent) throw new Error('Could not read the tip of ' + branch + '.');
    reader.ref = parent;
    const [cur, mf, head] = await Promise.all([
      readLedger(reader, path, fresh), reader.get(manifestPath, fresh), client.req('git/commits/' + parent, fresh),
    ]);
    const baseTree = head?.tree?.sha;
    if (!baseTree) throw new Error('The branch commit carries no tree.');
    const files = [{ path, text: ledgerText(cur, written, r.date) }];
    const adopted = closeAdoption(mf.text, manifestPath, path, r.path);
    if (adopted !== null) files.push({ path: manifestPath, text: adopted });
    const tree = [];
    for (const file of files) {
      const blob = await client.req('git/blobs', { method: 'POST',
        body: JSON.stringify({ content: window.GH.toBase64(file.text), encoding: 'base64' }) });
      if (!blob?.sha) throw new Error('Blob write returned no sha for ' + file.path + '.');
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const built = await client.req('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
    if (!built?.sha) throw new Error('The installation tree write returned no sha.');
    const commit = await client.req('git/commits', { method: 'POST',
      body: JSON.stringify({ message: commitMessage, tree: built.sha, parents: [parent] }) });
    if (!commit?.sha) throw new Error('The installation commit write returned no sha.');
    const current = await client.req(refPath, fresh);
    if (current?.object?.sha !== parent)
      throw new Error('The branch moved while recording. Reload its observations and review before recording again.');
    await client.req('git/refs/heads/' + branch, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    return { line: written, sha: tree[0].sha, commit: commit.sha, adoptionClosed: adopted !== null };
  };

  window.Installation = { HEADER, KINDS, STATES, LABELS, manifest, place, inventory, groups,
    observations, historyFor, derive, summary, row, fromCheck, isRecorded, line, digest, append, transferScript };
})();
