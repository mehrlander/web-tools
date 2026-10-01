// Findings: what a tending pass concluded, kept as notes in the notes store.
//
// A finding is a note (kits/notes.js) that carries a `finding` object:
//
//   {"id":"n…","at":"…","author":"…","about":"<first subject>","text":"<title>",
//    "finding":{"kind":"unreached|answer|overlap|settled|…",
//               "subjects":["<locator>",…],
//               "why":"…","next":"…","choice":"…",
//               "evidence":["…"],
//               "witnesses":[{"ref":"<locator>","sha":"…"|"state":"…","updated":"…","why":"…"}]}}
//
// `kind` is provisional vocabulary, not a closed set: the view labels the kinds
// it knows and shows any other by name. `subjects` are follow references (a
// branch, a pull request, a task file, a snag, a session record); `witnesses`
// are pinned ones in the sense of docs/locators.md: the exact versions the
// conclusion rests on, including things outside the subjects, so a later pass
// can tell the conclusion may no longer hold even when no subject moved.
//
// A finding CHANGES only through a reply that itself carries `finding`: a
// tending pass reassessing (new fields, new witnesses, status "settled") or the
// owner handling it from the Tending view (status "resolved"). A reply without
// `finding` is a comment. It is listed with the finding and never changes its
// status, so an ordinary note cannot clear a finding by being newer.
//
// Pure: no fetching. The Tending view and the Activity panes supply the notes
// and, for witnesses, what they observed. Attaches window.Findings, loaded via
// gh.load('kits/findings.js').
(() => {
  // The kinds the view knows, in the order open findings are read. Anything
  // else sorts after them under its own name.
  const KINDS = {
    answer:    { label: 'Needs your answer',   icon: 'ph-question' },
    unreached: { label: 'Never reached you',   icon: 'ph-tray-arrow-down' },
    overlap:   { label: 'Overlapping efforts', icon: 'ph-intersect' },
    settled:   { label: 'Settled',             icon: 'ph-check-circle' },
  };
  const ORDER = ['answer', 'unreached', 'overlap'];
  const CLOSED = new Set(['settled', 'resolved']);
  // Fields an update may replace. `choice` set to '' clears a question that an
  // answer or a later pass has made moot.
  const FIELDS = ['kind', 'subjects', 'why', 'next', 'choice', 'evidence', 'witnesses'];

  const kindOf = (k) => KINDS[k] || { label: k || 'Finding', icon: 'ph-lightbulb' };
  const byAt = (a, b) => String(a.at).localeCompare(String(b.at));

  // owner/repo#N | owner/repo@ref | owner/repo[@ref]:path[#fragment] | owner/repo | note:<id>
  function parse(loc) {
    const s = String(loc || '');
    if (s.startsWith('note:')) return { type: 'note', id: s.slice(5) };
    let m = s.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    if (m) return { type: 'pr', repo: m[1], number: +m[2] };
    m = s.match(/^([\w.-]+\/[\w.-]+)(?:@([^\s:]+))?(?::([^\s#]+)(?:#(\S+))?)?$/);
    if (!m) return { type: 'unknown', raw: s };
    const [, repo, ref = '', path = '', fragment = ''] = m;
    if (!path) return ref ? { type: 'branch', repo, ref } : { type: 'repo', repo };
    const type = /^sessions\/\d{4}\/\d{2}\/[\w-]+\.json$/.test(path) ? 'session'
      : /(^|\/)SNAGS\.md$/.test(path) && fragment ? 'snag'
      : /(^|\/)tracker\/tasks\/[^/]+\.md$/.test(path) ? 'task'
      : 'file';
    return { type, repo, ref, path, fragment };
  }
  const repoOf = (loc) => parse(loc).repo || '';

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
        let status = root.finding.status || (cur.kind === 'settled' ? 'settled' : 'open');
        let assessedAt = root.at, lastAt = root.at, title = root.text;
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
          if (u.status) status = u.status;
          else if (u.kind === 'settled') status = 'settled';
          if (u.witnesses) assessedAt = r.at;
          const type = status === 'resolved' && was !== 'resolved' ? 'resolved'
            : status === 'settled' && was !== 'settled' ? 'settled'
            : status === 'open' && CLOSED.has(was) ? 'reopened'
            : 'advanced';
          history.push({ type, at: r.at, author: r.author, text: r.text, did: u.did || '', id: r.id });
        }
        const subjects = [...new Set([root.about, ...(Array.isArray(cur.subjects) ? cur.subjects : [])])];
        return {
          id: root.id, at: root.at, author: root.author, about: root.about, title,
          kind: cur.kind || '', why: cur.why || '', next: cur.next || '', choice: cur.choice || '',
          evidence: Array.isArray(cur.evidence) ? cur.evidence : [],
          witnesses: Array.isArray(cur.witnesses) ? cur.witnesses : [],
          subjects, status, open: !CLOSED.has(status), assessedAt, lastAt, history,
        };
      });
  }

  // The reading order for open findings: a question for the owner first, then
  // the known kinds in ORDER, then newest. Provisional, like the kinds.
  function sortOpen(fs) {
    const rank = (f) => (ORDER.indexOf(f.kind) + 1) || ORDER.length + 1;
    return [...fs].sort((a, b) => (!!b.choice - !!a.choice) || (rank(a) - rank(b)) || String(b.at).localeCompare(String(a.at)));
  }
  const sortClosed = (fs) => [...fs].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));

  // Does a finding concern this branch row? By the branch itself, or by a pull
  // request it heads (the open one or the last one in the index).
  function touchesBranch(f, repo, branch, prNumbers = []) {
    const want = new Set([repo + '@' + branch, ...prNumbers.filter(Boolean).map(n => repo + '#' + n)]);
    return f.subjects.some(s => want.has(s));
  }
  const touchesRepo = (f, repo) => f.subjects.some(s => repoOf(s) === repo);

  // What a witness asks to be observed, read off its ref.
  function witnessPlan(w) {
    const p = parse(w && w.ref);
    if (p.type === 'pr') return { type: 'pr', repo: p.repo, number: p.number };
    if (p.type === 'branch') return { type: 'branch', repo: p.repo, ref: p.ref };
    if (p.repo && p.path) return { type: 'path', repo: p.repo, ref: p.ref || '', path: p.path };
    return { type: 'unknown' };
  }

  // A witness against what was observed for it now. Verdicts are the ones
  // docs/locators.md names: ok, changed, broken, unverifiable.
  //   branch: { sha } or { missing: true }
  //   path:   { commits: [{ sha, date, message }] }  commits touching it since the assessment
  //   pr:     { state, updated }
  function compare(w, seen) {
    const plan = witnessPlan(w);
    if (!seen || seen.error) return { verdict: 'unverifiable', detail: seen?.error || '' };
    if (plan.type === 'branch') {
      if (seen.missing) return { verdict: 'broken', detail: 'the branch is gone' };
      if (!w.sha || !seen.sha) return { verdict: 'unverifiable', detail: '' };
      return seen.sha.startsWith(w.sha) || w.sha.startsWith(seen.sha)
        ? { verdict: 'ok', detail: '' }
        : { verdict: 'changed', detail: 'new commits since the assessment (tip ' + seen.sha.slice(0, 7) + ')' };
    }
    if (plan.type === 'path') {
      if (seen.missing) return { verdict: 'broken', detail: 'the path is gone' };
      const c = (seen.commits || [])[0];
      return c ? { verdict: 'changed', detail: 'changed by ' + String(c.sha).slice(0, 7) + (c.message ? ': ' + c.message : ''), sha: c.sha }
               : { verdict: 'ok', detail: '' };
    }
    if (plan.type === 'pr') {
      // Merged is final: a later edit to a merged PR's body changes nothing it witnessed.
      if (w.state === 'merged' && seen.state === 'merged') return { verdict: 'ok', detail: '' };
      if (w.state && seen.state && w.state !== seen.state) return { verdict: 'changed', detail: 'now ' + seen.state };
      if (w.updated && seen.updated && seen.updated > w.updated) return { verdict: 'changed', detail: 'updated ' + seen.updated.slice(0, 10) };
      return { verdict: 'ok', detail: '' };
    }
    return { verdict: 'unverifiable', detail: '' };
  }

  // The reply the Tending view writes when the owner handles a finding, and
  // the one it writes to reopen. A comment is a plain Notes.make with no
  // `finding`, which is the whole difference.
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
                      touchesBranch, touchesRepo, witnessPlan, compare, resolution, reopening };
})();
