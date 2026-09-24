// Errands: one record for everything a session needs a person's browser to do.
//
// A session with limited reach files an errand in the registry repo; the Stage
// lists it, and a person completes it there. Every errand carries a `note`
// saying what is wanted. Three optional parts say how:
//
//   action   a mechanism the Stage performs itself, reading one of your repos
//            with your token: tree | branches | fetch
//   run      code a person runs somewhere: which script, on what venue, by
//            which method, and how its output comes back (METHODS below)
//   purpose  test-script (the run proves code; its output is evidence) or
//            get-data (its output is source material that lands and is used)
//
// An errand with no action and no run block is the plain case: a note, and the
// person supplies the material or declines with a reason.
//
// NOTHING RUNS ON ITS OWN. Every errand waits for a tap, reads included, so each
// time a session borrows your token you see it. A record written straight to
// the registry's main, by a session that may be scoped away from the repo it
// names, never acts without a person in between.
//
// EVERY ERRAND IS GRADED before it is closed. A read grades itself (a listing
// that is not truncated, every requested file read). Any other errand is graded
// against what is staged, by its `expect` field. The grade is what puts one
// green button on the card: `green` means it got what it came for, `amber` says
// what is missing and still lets you send, `red` has nothing yet.
//
// A SIGNED RESULT routes itself. A run with outputSigned true wraps its output
// in the errand-result/1 envelope, whose `errand` key names the errand, so a
// paste of it anywhere on the Stage lands on that errand's card. The committed
// script stays generic: withErrandId() puts the id in when the card copies it.
//
// STORAGE. One file per errand at errands/requests/<id>.json in the registry,
// closed by a same-named record at errands/results/<id>.json, so concurrent
// sessions each write their own file and never edit a shared list. Results
// written before 2026-09-24 carry fulfilledAt rather than closedAt; only a
// result's presence is read, so both shapes close an errand.
//
// Pure helpers are unit-tested; fulfill takes an injected GH so it is tested
// against a stub. Attaches window.Errands, loaded via gh.load('kits/errands.js').
(() => {
  if (window.Errands) return;

  const DIR = { req: 'errands/requests', res: 'errands/results' };
  const READS = ['tree', 'branches', 'fetch'];
  const PURPOSES = ['test-script', 'get-data'];
  const VENUES = ['personal-laptop', 'work-machine', 'browser'];
  const OUTPUT_TYPES = ['json', 'text', 'csv'];
  const ENVELOPE = 'errand-result/1';

  // How a person runs code, one entry per method. A copy of docs/run-methods.csv,
  // which owns it; tools/test/run-methods.test.mjs fails when the two differ.
  const METHODS = {
    'ise-f5': {
      venues: ['personal-laptop', 'work-machine'],
      outputReturn: 'direct-to-clipboard',
      rules: ['Windows PowerShell 5.1', 'no param block', 'runs unsaved',
              'settings as plain variables at the top', '"# @file <path>" first line',
              'no other comments', 'ends with Set-Clipboard'],
    },
    'console-enter': {
      venues: ['browser'],
      outputReturn: 'direct-to-clipboard',
      rules: ['plain expression or IIFE', 'no imports', 'no comments', 'ends with copy(...)'],
    },
    'courier-bookmark': {
      venues: ['browser'],
      outputReturn: 'courier-message',
      rules: ['the courier contract in courier/README.md: reads and returns, never navigates or writes',
              'no comments'],
    },
  };

  // Which request files lack a same-named result, so nothing is shown twice.
  const pending = (requestNames, resultNames) => {
    const done = new Set(resultNames);
    return requestNames.filter(n => n.endsWith('.json') && !done.has(n));
  };

  // 'owner/repo@ref:path' as its parts, or null when it is not that shape.
  const parseScript = (s) => {
    const m = String(s || '').match(/^([^/@:\s]+\/[^/@:\s]+)@([^:\s]+):(\S+)$/);
    return m ? { repo: m[1], ref: m[2], path: m[3] } : null;
  };

  const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };

  // The run block with its method's defaults filled: a record that omits
  // outputReturn gets the one its method allows, so the card always shows it.
  function normalizeRun(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const m = METHODS[raw.method];
    return {
      script: String(raw.script || ''),
      venue: String(raw.venue || (m && m.venues.length === 1 ? m.venues[0] : '')),
      method: String(raw.method || ''),
      outputReturn: String(raw.outputReturn || (m ? m.outputReturn : '')),
      outputType: String(raw.outputType || ''),
      outputSigned: raw.outputSigned === true,
    };
  }

  // Every shape, old and new, as one errand. `src` says where it was read, so
  // closing writes back to the same place; `name` is its file name there. The
  // older mailbox records name their read in `kind`; an `ask` is the plain case.
  function normalize(raw, src = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = raw.action || raw.kind || '';
    const action = READS.includes(kind) ? kind : (['ask', 'hand'].includes(kind) ? '' : kind);
    const note = String(raw.note || '');
    return {
      id: String(raw.id || ''),
      action,
      purpose: String(raw.purpose || ''),
      title: String(raw.title || note.split('\n')[0] || raw.id || ''),
      note,
      repo: raw.repo || '',
      ref: raw.ref || '',
      paths: Array.isArray(raw.paths) ? raw.paths : [],
      url: raw.url || '',
      host: raw.host || hostOf(raw.url),
      run: normalizeRun(raw.run),
      dest: typeof raw.dest === 'string' ? raw.dest : '',
      // The file the result is saved as, when the record names one.
      file: String(raw.file || ''),
      expect: raw.expect && typeof raw.expect === 'object' ? raw.expect : null,
      for: raw.for || raw.task || '',
      createdAt: raw.createdAt || raw.opened || '',
      src,
    };
  }

  function validateRun(run) {
    const bad = (error) => ({ ok: false, error });
    if (!parseScript(run.script)) return bad('run.script must be owner/repo@ref:path');
    const m = METHODS[run.method];
    if (!m) return bad('unknown run.method: ' + (run.method || '(none)'));
    if (!m.venues.includes(run.venue)) return bad(run.method + ' runs on ' + m.venues.join(' or ') + ', not ' + (run.venue || '(none)'));
    if (run.outputReturn !== m.outputReturn) return bad(run.method + ' returns by ' + m.outputReturn + ', not ' + (run.outputReturn || '(none)'));
    if (run.outputType && !OUTPUT_TYPES.includes(run.outputType)) return bad('unknown run.outputType: ' + run.outputType);
    return { ok: true };
  }

  function validate(e) {
    if (!e || !e.id) return { ok: false, error: 'an errand needs an id' };
    if (!e.note.trim()) return { ok: false, error: 'an errand needs a note saying what is wanted' };
    if (e.action && !READS.includes(e.action)) return { ok: false, error: 'unknown action: ' + e.action };
    if (e.purpose && !PURPOSES.includes(e.purpose)) return { ok: false, error: 'unknown purpose: ' + e.purpose };
    if (e.action) {
      if (!String(e.repo).includes('/')) return { ok: false, error: 'a read needs repo (owner/name)' };
      if (e.action === 'fetch' && !e.paths.length) return { ok: false, error: 'fetch needs paths' };
      return { ok: true };
    }
    if (!String(e.dest).includes('/')) return { ok: false, error: 'this errand needs a destination (owner/repo[@ref]:dir)' };
    if (e.run) {
      const v = validateRun(e.run);
      if (!v.ok) return v;
      if (e.run.method === 'courier-bookmark' && !e.host) return { ok: false, error: 'a courier-bookmark errand needs the url of its page' };
    }
    return { ok: true };
  }

  // The language a method's script is written in, which decides how the id is put in.
  const isPowerShell = (method) => !(METHODS[method]?.venues || []).includes('browser');

  // The script as the card copies it: the committed bytes with the errand's id
  // declared, as the first line after `# @file` in PowerShell and the first line
  // in JavaScript, so a signed envelope can name its errand.
  function withErrandId(text, method, id) {
    const src = String(text || '');
    const safe = String(id).replace(/'/g, '');
    if (!isPowerShell(method)) return "const ErrandId = '" + safe + "';\n" + src;
    const line = "$ErrandId = '" + safe + "'";
    const lines = src.split('\n');
    const at = /^#\s*@file\b/.test(lines[0] || '') ? 1 : 0;
    lines.splice(at, 0, line);
    return lines.join('\n');
  }

  // A pasted errand-result/1 envelope, or null for any other text.
  function envelope(text) {
    const t = String(text || '').trim();
    if (!t.startsWith('{') || !t.includes(ENVELOPE)) return null;
    let o;
    try { o = JSON.parse(t); } catch { return null; }
    if (!o || o.envelope !== ENVELOPE || typeof o.errand !== 'string' || !o.errand || !('body' in o)) return null;
    return o;
  }

  // An envelope's body as the one staged file the errand is graded against.
  function envelopeFile(env, e) {
    const type = env.outputType || e?.run?.outputType || '';
    const ext = { json: 'json', csv: 'csv' }[type] || 'txt';
    const text = typeof env.body === 'string' ? env.body : JSON.stringify(env.body, null, 2);
    return { name: (e && e.file) || env.errand + '.' + ext, text };
  }

  const g = (text) => ({ level: 'green', text });
  const a = (text) => ({ level: 'amber', text });
  const r = (text) => ({ level: 'red', text });
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : (many || one + 's'));

  // A glob of the only kind worth writing here: '*' is any run of characters.
  const globRe = (p) => new RegExp('^' + String(p).split('*')
    .map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');

  // The grade. For a read, `outcome` is the fulfill result; for any other
  // errand, it is { files: [{ name, text }] }, the text items staged for it.
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
    if (!files.length) return r(e.run?.method === 'courier-bookmark' ? 'Nothing from the page yet' : 'Nothing staged yet');
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
    const rec = { id: e.id };
    if (e.action) rec.action = e.action;
    if (e.purpose) rec.purpose = e.purpose;
    Object.assign(rec, { closedAt: now || new Date().toISOString(), ok: true, answered: !!answered, message: msg });
    if (grade) rec.verdict = grade;
    if (data !== undefined) rec.data = data;
    return rec;
  }

  // Perform a read with an injected GH class and token. Returns an outcome and
  // never throws: errors land in it. Read-only, and called only from a tap.
  //
  //   tree     recursive Git-trees listing of a repo (paths, types, sizes)
  //   branches branch names and tip shas
  //   fetch    contents of specific text files (paths)
  async function fulfill(e, { GH, token, now }) {
    const ref = e.ref || 'main';
    const base = { id: e.id, action: e.action, repo: e.repo, ref, ranAt: now || new Date().toISOString() };
    if (!READS.includes(e.action)) return { ...base, ok: false, error: 'not a read: ' + (e.action || '(none)') };
    if (!String(e.repo).includes('/')) return { ...base, ok: false, error: 'bad or missing repo (owner/name)' };
    if (e.action === 'fetch' && !(e.paths || []).length) return { ...base, ok: false, error: 'fetch needs paths' };
    try {
      const gh = new GH({ token, repo: e.repo, ref });
      if (e.action === 'tree') {
        const t = await gh.req(`git/trees/${encodeURIComponent(ref)}?recursive=1`);
        return { ...base, ok: true, data: {
          truncated: !!t.truncated,
          entries: (t.tree || []).map(x => ({ path: x.path, type: x.type, size: x.size, sha: x.sha })),
        } };
      }
      if (e.action === 'branches') {
        const b = await gh.branches();
        return { ...base, ok: true, data: { branches: b.map(x => ({ name: x.name, sha: x.commit?.sha })) } };
      }
      const files = [];
      for (const p of e.paths) {
        try { const f = await gh.get(p); files.push({ path: p, ok: true, size: f.size, text: f.text }); }
        catch (err) { files.push({ path: p, ok: false, error: String(err?.message || err) }); }
      }
      return { ...base, ok: true, data: { files } };
    } catch (err) {
      return { ...base, ok: false, error: String(err?.message || err) };
    }
  }

  window.Errands = { DIR, READS, PURPOSES, VENUES, OUTPUT_TYPES, METHODS, ENVELOPE,
                     pending, normalize, validate, parseScript, withErrandId, envelope,
                     envelopeFile, verdict, close, fulfill };
})();
