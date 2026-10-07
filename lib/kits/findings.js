// Findings: what a tending pass concluded, kept as notes that carry a
// `finding` object. docs/views/tending.md states the record, when a finding is
// open, and when a witness has changed.
//
//   {"id":"n…","at":"…","author":"…","about":"<first subject>","text":"<title>",
//    "finding":{"kind":"unreached|answer|overlap|superseded|…",
//               "subjects":["<locator>",…],
//               "why":"…","next":"…",
//               "evidence":["…"],
//               "witnesses":[{"ref":"<locator>","sha":"…"|"contains":"…"|"state":"…","updated":"…","why":"…"}]}}
//
// Pure: callers supply the notes and what they observed for each witness.
// skills/tend/findings.py folds and compares the same way, held to it by
// node/test/findings.test.mjs. Attaches window.Findings, loaded via
// gh.load('kits/findings.js').
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
      : /^user-calls\/[\w.-]+\.json$/.test(path) ? 'call'
      : /(^|\/)SNAGS\.md$/.test(path) && fragment ? 'snag'
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
        // What the owner acknowledged when handling it, by witness ref. A pass
        // that re-pins the witnesses replaces these with its own pins.
        let acks = {};
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
          if (u.witnesses) { assessedAt = r.at; acks = {}; }
          for (const a of Array.isArray(u.ack) ? u.ack : []) if (a && a.ref) acks[a.ref] = a.seen;
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
          witnesses: (Array.isArray(cur.witnesses) ? cur.witnesses : []).map(w => acks[w?.ref] ? { ...w, ack: acks[w.ref] } : w),
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

  // What a witness asks to be observed, read off its ref and its pin.
  //   owner/repo@ref       + sha       the ref's tip is that commit
  //   owner/repo@ref       + contains  the ref contains that commit
  //   owner/repo@ref:path  + sha       the blob or tree at that path is that object
  //   owner/repo#N         + state     the pull request is in that state
  function witnessPlan(w) {
    const p = parse(w && w.ref);
    if (p.type === 'pr') return { type: 'pr', repo: p.repo, number: p.number };
    if (p.type === 'branch') return w.contains ? { type: 'contains', repo: p.repo, ref: p.ref, commit: w.contains }
                                               : { type: 'branch', repo: p.repo, ref: p.ref };
    if (p.repo && p.path) return { type: 'path', repo: p.repo, ref: p.ref || 'main', path: p.path };
    return { type: 'unknown' };
  }

  const same = (a, b) => !!a && !!b && (a.startsWith(b) || b.startsWith(a));

  // A witness against what was observed for it now, mirrored by findings.py
  // compare(). Verdicts: ok, changed, broken, unverifiable. Observations:
  //   branch:   { sha } | { missing }
  //   contains: { contained: bool } | { missing }
  //   path:     { sha, detail? } | { missing }; or, for a witness that pinned
  //             no sha, { commits: [{ sha, message }] } since the assessment
  //   pr:       { state, updated }
  function compare(w, seen) {
    const v = pinned(w, seen);
    return (v.verdict === 'changed' || v.verdict === 'broken') && acknowledged(w, seen)
      ? { verdict: 'ok', detail: 'as it was when handled' } : v;
  }
  function pinned(w, seen) {
    const plan = witnessPlan(w);
    if (!seen || seen.error) return { verdict: 'unverifiable', detail: seen?.error || '' };
    if (plan.type === 'branch') {
      if (seen.missing) return { verdict: 'broken', detail: 'the branch is gone' };
      if (!w.sha || !seen.sha) return { verdict: 'unverifiable', detail: 'no pinned tip' };
      return same(w.sha, seen.sha) ? { verdict: 'ok', detail: '' }
        : { verdict: 'changed', detail: 'tip is now ' + seen.sha.slice(0, 7) };
    }
    if (plan.type === 'contains') {
      if (seen.missing) return { verdict: 'broken', detail: 'the ref or commit is gone' };
      return seen.contained ? { verdict: 'ok', detail: '' }
        : { verdict: 'changed', detail: plan.ref + ' no longer contains ' + String(plan.commit).slice(0, 7) };
    }
    if (plan.type === 'path') {
      if (seen.missing) return { verdict: 'broken', detail: 'the path is gone' };
      if (w.sha) {
        if (!seen.sha) return { verdict: 'unverifiable', detail: 'no current object' };
        return same(w.sha, seen.sha) ? { verdict: 'ok', detail: '' }
          : { verdict: 'changed', detail: 'now ' + seen.sha.slice(0, 7) + (seen.detail ? ', ' + seen.detail : '') };
      }
      const c = (seen.commits || [])[0];
      return c ? { verdict: 'changed', detail: 'changed by ' + String(c.sha).slice(0, 7) + (c.message ? ': ' + c.message : '') }
               : { verdict: 'ok', detail: '' };
    }
    if (plan.type === 'pr') {
      if (!seen.state) return { verdict: 'unverifiable', detail: '' };
      if (w.state && w.state !== seen.state) return { verdict: 'changed', detail: 'now ' + seen.state };
      // Activity matters only while a pull request is open: merged is final,
      // and a closed one that reopens shows up as a change of state.
      if (seen.state === 'open' && w.updated && seen.updated && seen.updated > w.updated) {
        return { verdict: 'changed', detail: 'updated ' + seen.updated.slice(0, 10) };
      }
      return { verdict: 'ok', detail: '' };
    }
    return { verdict: 'unverifiable', detail: 'unreadable ref' };
  }

  // What an observation shows, kept on a resolution so the owner's Handled
  // covers this change and no later one.
  function ackOf(w, seen) {
    const plan = witnessPlan(w);
    const s = seen.missing ? { missing: true }
      : plan.type === 'contains' ? { contained: !!seen.contained }
      : plan.type === 'pr' ? { state: seen.state, updated: seen.updated || '' }
      : { sha: seen.sha || (seen.commits || [])[0]?.sha || '' };
    return { ref: w.ref, seen: s };
  }
  // Does the observation still show what was acknowledged? An open pull
  // request counts as unchanged until it is updated after the acknowledgment.
  function acknowledged(w, seen) {
    const a = w && w.ack;
    if (!a || !seen || seen.error) return false;
    if (a.missing || seen.missing) return !!a.missing && !!seen.missing;
    const plan = witnessPlan(w);
    if (plan.type === 'contains') return a.contained === !!seen.contained;
    if (plan.type === 'pr') return a.state === seen.state
      && (seen.state !== 'open' || !seen.updated || !a.updated || seen.updated <= a.updated);
    return same(a.sha, seen.sha || (seen.commits || [])[0]?.sha);
  }

  // A finding asks for attention when it is open, or when something its
  // conclusion rests on has changed since, settled or not. `verdicts` is the
  // list compare() produced for its witnesses.
  const moved = (verdicts) => (verdicts || []).filter(v => v && (v.verdict === 'changed' || v.verdict === 'broken'));
  const needsAttention = (f, verdicts) => f.open || moved(verdicts).length > 0;

  // The reply the Tending view writes when the owner handles a finding, with
  // ackOf() for each witness that had changed, and the one it writes to
  // reopen. A comment is a plain Notes.make with no `finding`.
  function resolution(id, text, author, ack = []) {
    const n = window.Notes.make({ about: 'note:' + id, text, author });
    n.finding = ack.length ? { status: 'resolved', ack } : { status: 'resolved' };
    return n;
  }
  function reopening(id, text, author) {
    const n = window.Notes.make({ about: 'note:' + id, text, author });
    n.finding = { status: 'open' };
    return n;
  }

  window.Findings = { KINDS, ORDER, kindOf, parse, repoOf, fold, sortOpen, sortClosed,
                      touchesBranch, touchesRepo, witnessPlan, compare, ackOf, moved, needsAttention,
                      resolution, reopening };
})();
