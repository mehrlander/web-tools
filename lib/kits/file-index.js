// kits/file-index.js — the estate's file names, kept in the private registry so
// the sidebar finder can match a name in every repo on the first keystroke.
//
// The finder used to read each repo's file list live: the open repo's on first
// input, the other nine behind a "File names, every repo" tap. One recursive
// trees call per repo per page visit, about 2.5 MB of JSON for the estate, and
// a tap the reader had to know about. This file moves that read to the crawl,
// which already knows when a repo's default branch moved, and stores the
// answer as state/files.json beside the other caches.
//
// WHAT AN ENTRY HOLDS. Per repo: the default-branch commit the list was read
// at (`sha`), and its blob paths GROUPED BY FOLDER, `dirs: { "lib/kits":
// ["file-index.js", …] }`, which is about half the bytes of a flat path list
// because a folder is spelled once. Measured 2026-10-01 over the ten estate
// repos: 2.5 MB flat, 244 KB gzipped grouped.
//
// THE FOLDER CAP. A folder holding more than FOLDER_CAP files DIRECTLY is
// stored as its count, not its names: `dirs: { "bills/texts/2019-20/Htm/House":
// 2997 }`. One repo trips it today, wa-bills, whose 138,706 bill texts are
// named by bill number and would otherwise be two thirds of the file. The
// count stays, so the finder can say the folder exists and how much it holds,
// and the cut is mechanical rather than a list of repos someone has to keep.
//
// TRUNCATION. GitHub cuts a recursive trees response at 100,000 entries and
// says so (`truncated`). readTree then walks: the root without recursion, and
// each subtree recursively, descending again wherever a subtree is itself cut.
// wa-bills costs about twenty calls this way, once per push to its default
// branch. An entry whose walk still could not finish says `truncated: true`.
//
// THE GATE is the default branch's tip. crawlRepo is handed the sha the
// activity crawl already read; when it matches the stored entry's `sha`, the
// entry carries and no call is made. A quiet estate costs this file nothing.
//
// Pure builders plus one network function, like repo-activity-cache.js beside
// activity-crawl.js. Attaches to window.FileIndex, loaded via
// gh.load('kits/file-index.js').
(() => {
  const CACHE_PATH = 'state/files.json';
  const FOLDER_CAP = 2000;   // files directly in one folder before it is stored as a count
  const WALK_MAX = 200;      // subtree calls one truncated repo may spend

  // Blob paths -> { dirs, files, collapsed }. `dirs` keys are folder paths ('' is
  // the root); a value is the sorted file names, or a number for a capped folder.
  function encode(paths, cap = FOLDER_CAP) {
    const by = new Map();
    for (const p of paths) {
      const i = p.lastIndexOf('/');
      const dir = i < 0 ? '' : p.slice(0, i);
      if (!by.has(dir)) by.set(dir, []);
      by.get(dir).push(i < 0 ? p : p.slice(i + 1));
    }
    const dirs = {};
    let files = 0, collapsed = 0;
    for (const dir of [...by.keys()].sort()) {
      const names = by.get(dir);
      if (names.length > cap) { dirs[dir] = names.length; collapsed++; }
      else { dirs[dir] = names.sort(); files += names.length; }
    }
    return { dirs, files, collapsed };
  }

  // The listed paths of an entry, flat. Capped folders contribute nothing here;
  // folders() names them.
  function paths(entry) {
    const out = [];
    for (const [dir, v] of Object.entries(entry?.dirs || {})) {
      if (!Array.isArray(v)) continue;
      for (const name of v) out.push(dir ? dir + '/' + name : name);
    }
    return out;
  }

  // Every blob path of the default branch, walking past truncation.
  async function readTree(gh, ref) {
    const top = await gh.req('git/trees/' + encodeURIComponent(ref) + '?recursive=1');
    if (!top?.truncated) {
      return { paths: (top?.tree || []).filter(e => e.type === 'blob').map(e => e.path), truncated: false, calls: 1 };
    }
    const out = [];
    let calls = 1, truncated = false;
    const walk = async (sha, prefix) => {
      if (calls >= WALK_MAX) { truncated = true; return; }
      calls++;
      const t = await gh.req('git/trees/' + sha);
      for (const e of t?.tree || []) {
        const p = prefix + e.path;
        if (e.type === 'blob') { out.push(p); continue; }
        if (e.type !== 'tree') continue;
        if (calls >= WALK_MAX) { truncated = true; return; }
        calls++;
        const sub = await gh.req('git/trees/' + e.sha + '?recursive=1');
        if (sub?.truncated) { await walk(e.sha, p + '/'); continue; }
        for (const s of sub?.tree || []) if (s.type === 'blob') out.push(p + '/' + s.path);
      }
    };
    await walk(top.sha || ref, '');
    return { paths: out, truncated, calls };
  }

  // One repo's entry, or the stored one when its tip has not moved. `headSha`
  // is the default-branch tip the caller already read; without one the entry
  // carries rather than paying for a read the caller could not gate.
  async function crawlRepo(repo, headSha, { makeGH, prev = null, ref = 'HEAD', cap = FOLDER_CAP } = {}) {
    if (!headSha) return prev ? { ...prev, carried: true } : null;
    if (prev?.sha === headSha) return { ...prev, carried: true };
    const t = await readTree(makeGH(repo), headSha || ref);
    const { dirs, files, collapsed } = encode(t.paths, cap);
    return { sha: headSha, at: new Date().toISOString(), files, collapsed,
             truncated: t.truncated, calls: t.calls, dirs };
  }

  // The next document: fetched entries over the stored ones, scoped to
  // `members` so a repo that left the estate drops out and one this pass could
  // not reach keeps what it had. `carried` and `calls` are run facts, not
  // content, so they are stripped before storing.
  function buildIndex(prev, fetched, members, nowISO) {
    const repos = {};
    for (const repo of members) {
      const e = fetched[repo] || prev?.repos?.[repo];
      if (!e) continue;
      const { carried, calls, ...keep } = e;
      repos[repo] = keep;
    }
    return { generatedAt: nowISO, folderCap: FOLDER_CAP, repos };
  }

  // Repos whose content moved: a different sha, or an entry added or dropped.
  // The material-change gate, so a pass that carried everything commits nothing.
  function changedRepos(prev, next) {
    const a = prev?.repos || {}, b = next?.repos || {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(r => (a[r]?.sha || '') !== (b[r]?.sha || '') || !a[r] !== !b[r]);
  }

  // Ranked name matches across the index. Rank, best first: the file's stem IS
  // the query (`design` finds DESIGN.md), its name starts with it, its name
  // contains it, only a folder above it does. Within a rank the caller's
  // `preferRepo` comes first, then the shorter path. Capped folders answer as
  // folders, with their counts, when the folder path matches.
  function search(doc, q, { preferRepo = '', cap = 50 } = {}) {
    const ql = String(q || '').trim().toLowerCase();
    if (!ql) return { hits: [], total: 0, folders: [] };
    const hits = [], folders = [];
    for (const [repo, e] of Object.entries(doc?.repos || {})) {
      for (const [dir, v] of Object.entries(e.dirs || {})) {
        const dl = dir.toLowerCase();
        if (!Array.isArray(v)) {
          if (dl.includes(ql)) folders.push({ repo, path: dir, count: v });
          continue;
        }
        const dirHit = dl.includes(ql);
        for (const name of v) {
          const nl = name.toLowerCase();
          const inName = nl.includes(ql);
          if (!inName && !dirHit) continue;
          const dot = nl.lastIndexOf('.');
          const stem = dot > 0 ? nl.slice(0, dot) : nl;
          const rank = stem === ql ? 0 : nl.startsWith(ql) ? 1 : inName ? 2 : 3;
          hits.push({ repo, path: dir ? dir + '/' + name : name, rank });
        }
      }
    }
    hits.sort((a, b) => a.rank - b.rank
      || (a.repo === preferRepo ? 0 : 1) - (b.repo === preferRepo ? 0 : 1)
      || a.path.length - b.path.length
      || a.path.localeCompare(b.path));
    return { hits: hits.slice(0, cap), total: hits.length, folders };
  }

  // The committed text: one line per folder, so a push that adds a file shows
  // as one changed line rather than as a reflowed 2-space dump (which ran
  // 40,000 lines for the estate) or a single 900 KB line. JSON either way.
  function serialize(doc) {
    const { repos = {}, ...head } = doc || {};
    const lines = [];
    const names = Object.keys(repos);
    names.forEach((repo, ri) => {
      const { dirs = {}, ...meta } = repos[repo];
      const keys = Object.keys(dirs);
      lines.push('  ' + JSON.stringify(repo) + ': ' + JSON.stringify(meta).slice(0, -1)
        + (Object.keys(meta).length ? ',' : '') + '"dirs":{');
      keys.forEach((k, i) => lines.push('    ' + JSON.stringify(k) + ':' + JSON.stringify(dirs[k]) + (i < keys.length - 1 ? ',' : '')));
      lines.push('  }}' + (ri < names.length - 1 ? ',' : ''));
    });
    const top = JSON.stringify(head).slice(0, -1);
    return top + (Object.keys(head).length ? ',' : '') + '"repos":{\n' + lines.join('\n') + '\n}}\n';
  }

  window.FileIndex = { CACHE_PATH, FOLDER_CAP, encode, paths, readTree, crawlRepo, buildIndex, changedRepos, search, serialize };
})();
