// Errands: one record for everything a session needs a person's browser to do.
//
// A session with limited reach files an errand in the registry repo; the Stage
// lists it, and a person completes it there. Three channels used to do this
// under three names, and they are one thing with three actions:
//
//   tree | branches | fetch   read one of your repos with your token
//                             (the mailbox's kinds; it used to run them on load)
//   courier                   run a script on a web page the session cannot
//                             reach (the courier's errands)
//   hand                      you supply the material, or decline with a reason
//                             (the mailbox's `ask`)
//
// NOTHING RUNS ON ITS OWN. Every errand waits for a tap, reads included, so each
// time a session borrows your token you see it. That is the whole safety story
// and it replaces the mailbox's allowlist-on-load: a record written straight to
// the registry's main, by a session that may be scoped away from the repo it
// names, never acts without a person in between.
//
// EVERY ERRAND IS GRADED before it is closed. A read grades itself (a listing
// that is not truncated, every requested file read). A courier or hand errand
// declares `expect` and is graded against what is staged. The grade is what
// puts one green button on the card: `green` means it got what it came for,
// `amber` says what is missing and still lets you send, `red` has nothing yet.
//
// STORAGE. One file per errand at errands/requests/<id>.json in the registry,
// closed by a same-named record at errands/results/<id>.json: the mailbox's
// rule, kept because concurrent sessions each write their own file and never
// edit a shared list. Two older sources are still read, so nothing filed before
// this kit is stranded: the mailbox's folders, and the courier's public list,
// whose errands close by a private result record like every other.
//
// Pure helpers (normalize, validate, destSpec, verdict, close, pending) are
// unit-tested. Attaches window.Errands, loaded via gh.load('kits/errands.js').
(() => {
  if (window.Errands) return;

  const DIR = { req: 'errands/requests', res: 'errands/results' };
  const MAILBOX = { req: 'mailbox/requests', res: 'mailbox/results' };
  const READS = ['tree', 'branches', 'fetch'];
  const ACTIONS = [...READS, 'courier', 'hand'];

  // Which request files lack a same-named result, so nothing is shown twice.
  const pending = (requestNames, resultNames) => {
    const done = new Set(resultNames);
    return requestNames.filter(n => n.endsWith('.json') && !done.has(n));
  };

  // 'owner/repo[@ref]:dir' from a result object {repo, branch, path|dir}; the
  // file name in `path` is dropped, since the Stage aims at a folder.
  const specOf = (r) => {
    if (!r || typeof r !== 'object' || !r.repo) return '';
    const dir = r.dir != null ? String(r.dir)
      : String(r.path || '').split('/').slice(0, -1).join('/');
    return r.repo + (r.branch ? '@' + r.branch : '') + (dir ? ':' + dir : '');
  };

  // Every shape, old and new, as one errand. `src` says where it was read, so
  // closing writes back to the same place; `name` is its file name there.
  function normalize(raw, src = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = raw.action || raw.kind || (raw.script ? 'courier' : '');
    const action = kind === 'ask' ? 'hand' : kind;
    const dest = typeof raw.dest === 'string' ? raw.dest
      : typeof raw.result === 'string' ? raw.result
      : specOf(raw.result);
    const note = String(raw.note || '');
    return {
      id: String(raw.id || ''),
      action,
      title: String(raw.title || note.split('\n')[0] || raw.id || ''),
      note,
      repo: raw.repo || '',
      ref: raw.ref || '',
      paths: Array.isArray(raw.paths) ? raw.paths : [],
      url: raw.url || '',
      host: raw.host || (raw.url ? (() => { try { return new URL(raw.url).hostname; } catch { return ''; } })() : ''),
      script: raw.script || '',
      dest,
      // The file a courier's result is saved as, when its record names one.
      file: raw.result && typeof raw.result === 'object' && raw.result.path
        ? String(raw.result.path).split('/').pop() : '',
      expect: raw.expect && typeof raw.expect === 'object' ? raw.expect : null,
      for: raw.for || raw.task || '',
      createdAt: raw.createdAt || raw.opened || '',
      status: raw.status || '',
      src,
    };
  }

  function validate(e) {
    if (!e || !e.id) return { ok: false, error: 'an errand needs an id' };
    if (!ACTIONS.includes(e.action)) return { ok: false, error: 'unknown action: ' + (e.action || '(none)') };
    if (READS.includes(e.action)) {
      if (!String(e.repo).includes('/')) return { ok: false, error: 'a read needs repo (owner/name)' };
      if (e.action === 'fetch' && !e.paths.length) return { ok: false, error: 'fetch needs paths' };
      return { ok: true };
    }
    if (!String(e.dest).includes('/')) return { ok: false, error: 'this errand needs a destination (owner/repo[@ref]:dir)' };
    if (e.action === 'courier' && !(e.url && e.script)) return { ok: false, error: 'a courier errand needs url and script' };
    if (e.action === 'hand' && !e.note.trim()) return { ok: false, error: 'a hand errand needs a note saying what is wanted' };
    return { ok: true };
  }

  const g = (text) => ({ level: 'green', text });
  const a = (text) => ({ level: 'amber', text });
  const r = (text) => ({ level: 'red', text });
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : (many || one + 's'));

  // A glob of the only kind worth writing here: '*' is any run of characters.
  const globRe = (p) => new RegExp('^' + String(p).split('*')
    .map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');

  // The grade. For a read, `outcome` is the fulfill result; for courier and
  // hand, it is { files: [{ name, text }] }, the text items staged for it.
  function verdict(e, outcome) {
    if (READS.includes(e.action)) {
      if (!outcome) return r('Not run yet');
      if (!outcome.ok) return r(outcome.error || 'The read failed');
      const d = outcome.data || {};
      if (e.action === 'tree') {
        const k = (d.entries || []).length;
        if (!k) return a('The listing is empty');
        if (d.truncated) return a(n(k, 'entry', 'entries') + ', but GitHub truncated the listing');
        return g(n(k, 'entry', 'entries') + ' listed');
      }
      if (e.action === 'branches') {
        const k = (d.branches || []).length;
        return k ? g(n(k, 'branch', 'branches') + ' listed') : a('No branches returned');
      }
      const files = d.files || [];
      const got = files.filter(f => f.ok).length;
      if (!got) return r('None of the ' + n(files.length, 'file') + ' could be read');
      if (got < files.length) return a(got + ' of ' + files.length + ' read; missing ' + files.filter(f => !f.ok).map(f => f.path).join(', '));
      return g('All ' + n(got, 'file') + ' read');
    }
    const files = (outcome && outcome.files) || [];
    if (!files.length) return r(e.action === 'courier' ? 'Nothing from the page yet' : 'Nothing staged yet');
    const x = e.expect || {};
    const unmet = [];
    const min = Number.isFinite(x.files) ? x.files : 1;
    if (files.length < min) unmet.push('wanted ' + n(min, 'file') + ', have ' + files.length);
    for (const pat of Array.isArray(x.names) ? x.names : []) {
      if (!files.some(f => globRe(pat).test(f.name))) unmet.push('no file matching ' + pat);
    }
    if (x.match) {
      let re = null;
      try { re = new RegExp(x.match, 'gm'); } catch { unmet.push('the expected pattern does not compile'); }
      if (re) {
        const hits = files.reduce((k, f) => k + (String(f.text || '').match(re) || []).length, 0);
        const want = Number.isFinite(x.min) ? x.min : 1;
        if (hits < want) unmet.push(n(hits, 'match', 'matches') + ' for the expected pattern, wanted ' + want);
      }
    }
    if (unmet.length) return a(unmet.join('; '));
    return g('Got what we came for: ' + n(files.length, 'file'));
  }

  // The record that closes an errand, at its own name in the results folder.
  // A decline is served, not failed, and needs its reason: "nothing references
  // that, stop looking" is often worth more to the next session than the file.
  function close(e, { answered, message = '', data, grade, now } = {}) {
    const msg = String(message || '').trim();
    if (!answered && !msg) return { ok: false, error: 'a decline needs a message saying why' };
    const rec = { id: e.id, action: e.action, closedAt: now || new Date().toISOString(),
                  ok: true, answered: !!answered, message: msg };
    if (grade) rec.verdict = grade;
    if (data !== undefined) rec.data = data;
    return rec;
  }

  window.Errands = { DIR, MAILBOX, READS, ACTIONS, pending, normalize, validate, specOf, verdict, close };
})();
