// Findings: what a tending pass concluded, kept as notes that carry a
// `finding` object:
//
//   {"id":"n…","at":"…","author":"…","about":"<first subject>","text":"<title>",
//    "finding":{"kind":"unreached|answer|overlap|superseded|…",
//               "subjects":["<locator>",…],
//               "why":"…","next":"…",
//               "evidence":["…"]}}
//
// A reply that carries `finding` is a reassessment: it replaces the fields it
// names, may set `status` (open, settled, resolved), `title` and `did`, and
// moves `assessedAt`. A reply without one is a comment. Notes written before
// 2026-11-23 may hold `witnesses` or `ack`; the fold ignores both.
//
// Pure: callers supply the notes. skills/tend/findings.py folds the same way.
// Attaches window.Findings, loaded via gh.load('kits/findings.js').
(() => {
  // The kinds the view knows, in the order open findings are read. Anything
  // else sorts after them under its own name.
  const KINDS = {
    answer:     { label: 'Decision in Waiting', icon: 'ph-tray' },
    unreached:  { label: 'Never reached you',   icon: 'ph-tray-arrow-down' },
    overlap:    { label: 'Overlapping efforts', icon: 'ph-intersect' },
    superseded: { label: 'Landed or overtaken', icon: 'ph-git-merge' },
    // The first records used `settled` as a kind; it reads as superseded.
    settled:    { label: 'Landed or overtaken', icon: 'ph-git-merge' },
  };
  const ORDER = ['answer', 'unreached', 'overlap', 'superseded'];
  const CLOSED = new Set(['settled', 'resolved']);
  // Fields an update may replace. `choice` set to '' clears a question that an
  // answer or a later pass has made moot.
  const FIELDS = ['kind', 'subjects', 'why', 'next', 'choice', 'evidence'];

  const kindOf = (k) => KINDS[k] || { label: k || 'Finding', icon: 'ph-lightbulb' };
  const byAt = (a, b) => String(a.at).localeCompare(String(b.at));

  // owner/repo#N | owner/repo@ref | owner/repo[@ref]:path[#fragment] | owner/repo | note:<id>
  function parse(loc) {
    const s = String(loc || '');
    if (s.startsWith('note:')) return { type: 'note', id: s.slice(5) };
    let m = s.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    if (m) return { type: 'pr', repo: m[1], number: +m[2] };
    // The rest is lib/kits/repo-address.js's grammar, with no whitespace
    // anywhere and an optional #fragment after the path.
    const unknown = { type: 'unknown', raw: s };
    if (/\s/.test(s)) return unknown;
    const bare = window.RepoAddress.parseRepo(s);
    if (bare) return bare.ref ? { type: 'branch', repo: bare.repo, ref: bare.ref } : { type: 'repo', repo: bare.repo };
    const a = window.RepoAddress.parse(s);
    const cut = a ? a.path.indexOf('#') : -1;
    const path = a ? (cut < 0 ? a.path : a.path.slice(0, cut)) : '';
    if (!path) return unknown;
    const { repo, ref } = a, fragment = cut < 0 ? '' : a.path.slice(cut + 1);
    const type = /^sessions\/\d{4}\/\d{2}\/[\w-]+\.json$/.test(path) ? 'session'
      : /^user-calls\/[\w.-]+\.json$/.test(path) ? 'call'
      : (path === 'lists/snag.json' || /(^|\/)SNAGS\.md$/.test(path)) && fragment ? 'snag'
      : /(^|\/)tracker\/tasks\/[^/]+\.md$/.test(path) ? 'task'
      : 'file';
    return { type, repo, ref, path, fragment };
  }
  const repoOf = (loc) => parse(loc).repo || '';

  // Open while something is outstanding, unless a reply said otherwise.
  const derived = (cur) => (cur.next || cur.choice) ? 'open' : 'settled';

  // One finding per top-level note that carries `finding`, its thread folded in.
  function fold(notes) {
    const list = (notes || []).filter(n => n && n.id && n.about);
    const kids = new Map();
    for (const n of list) {
      if (!n.about.startsWith('note:')) continue;
      const p = n.about.slice(5);
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p).push(n);
    }
    const flat = (id) => (kids.get(id) || []).flatMap(r => [r, ...flat(r.id)]);
    return list.filter(n => n.finding && typeof n.finding === 'object' && !n.about.startsWith('note:'))
      .map(root => {
        const cur = {};
        for (const k of FIELDS) if (k in root.finding) cur[k] = root.finding[k];
        let explicit = root.finding.status || '';
        let status = explicit || derived(cur);
        let assessedAt = root.at, lastAt = root.at, title = root.text, did = '', closedBy = null;
        const history = [{ type: 'found', at: root.at, author: root.author, text: root.text, id: root.id }];
        for (const r of flat(root.id).sort(byAt)) {
          lastAt = r.at > lastAt ? r.at : lastAt;
          const u = r.finding;
          if (!u || typeof u !== 'object') {
            history.push({ type: 'comment', at: r.at, author: r.author, text: r.text, id: r.id });
            continue;
          }
          const was = status;
          for (const k of FIELDS) if (k in u) cur[k] = u[k];
          if (u.title) title = u.title;
          if (u.status) explicit = u.status;
          assessedAt = r.at;
          if (u.did) did = u.did;
          status = explicit || derived(cur);
          const type = status === 'resolved' && was !== 'resolved' ? 'resolved'
            : status === 'settled' && was !== 'settled' ? 'settled'
            : status === 'open' && CLOSED.has(was) ? 'reopened'
            : 'advanced';
          if (type === 'resolved' || type === 'settled') closedBy = { at: r.at, author: r.author, text: r.text, did: u.did || '' };
          if (type === 'reopened') closedBy = null;
          history.push({ type, at: r.at, author: r.author, text: r.text, did: u.did || '', id: r.id });
        }
        const subjects = [...new Set([root.about, ...(Array.isArray(cur.subjects) ? cur.subjects : [])])];
        const open = !CLOSED.has(status);
        return {
          id: root.id, at: root.at, author: root.author, about: root.about, title,
          kind: cur.kind || '', why: cur.why || '', next: cur.next || '', choice: cur.choice || '',
          evidence: Array.isArray(cur.evidence) ? cur.evidence : [],
          subjects, status, open, assessedAt, lastAt, history, did, closedBy,
          // Outstanding work, as distinct from a finished assessment.
          outstanding: open && !!(cur.next || cur.choice),
        };
      });
  }

  // The reading order for open findings: the known kinds in ORDER, then newest.
  function sortOpen(fs) {
    const rank = (f) => (ORDER.indexOf(f.kind) + 1) || ORDER.length + 1;
    return [...fs].sort((a, b) => (rank(a) - rank(b)) || String(b.at).localeCompare(String(a.at)));
  }
  const sortClosed = (fs) => [...fs].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));

  // Does a finding concern this branch row? By the branch itself, or by a pull
  // request it heads (the open one or the last one in the index).
  function touchesBranch(f, repo, branch, prNumbers = []) {
    const want = new Set([repo + '@' + branch, ...prNumbers.filter(Boolean).map(n => repo + '#' + n)]);
    return f.subjects.some(s => want.has(s));
  }
  const touchesRepo = (f, repo) => f.subjects.some(s => repoOf(s) === repo);

  // The reply the Tending view writes when the owner handles a finding, and
  // the one it writes to reopen. A comment is a plain Notes.make with no
  // `finding`.
  function resolution(id, text, author) {
    const n = window.Notes.make({ about: 'note:' + id, text, author });
    n.finding = { status: 'resolved' };
    return n;
  }
  function reopening(id, text, author) {
    const n = window.Notes.make({ about: 'note:' + id, text, author });
    n.finding = { status: 'open' };
    return n;
  }

  window.Findings = { KINDS, ORDER, kindOf, parse, repoOf, fold, sortOpen, sortClosed,
                      touchesBranch, touchesRepo, resolution, reopening };
})();
