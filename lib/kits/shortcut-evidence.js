// lib/kits/shortcut-evidence.js — the device's return channel read as
// installation evidence. The Shortcuts counterpart of installation.js: that kit
// derives what a work computer holds from an observations ledger a person
// appends to; this one derives what the phone holds from shortcuts/log/ in
// web-tools-private, which the phone appends to itself through Log-Repo.
//
// Pure derivation. The page fetches; nothing here touches the network, so the
// test can walk every row shape the log has held and every baseline a verdict
// can be scored against.
//
// WHICH BUILD A ROW IS ABOUT. Every stamped chain logs `build`, its own content
// hash. For a run that is the answer. For an install it is not: the row is
// written by the INSTALLER (Library-Paste, Library-Fetch), so `build` is the
// installer's stamp and says nothing about the chain it installed. Paste rows
// carry the installed chain's own id as `target`; import and replace rows carry
// none, and theirs is read off plists/builds.json at the ref the row names in
// `from`. Scoring `build` for an install, which the page did until 2026-09-26,
// compared Library-Paste's hash against Dump-Named's and called every paste
// stale.
//
// WHAT A VERDICT IS SCORED AGAINST. Not main, unconditionally. An install from
// a commit on an open pull request is the copy that branch publishes, and main
// has not caught up to it by construction, so against main it reads stale for
// exactly as long as it is new. The baseline is the head of the open PR that
// carries the row's commit, or main when none does. A run inherits the ref of
// the newest install of the same name before it.
//
// UNKNOWN IS NOT CURRENT. A verdict is returned only when both numbers are in
// hand. Any missing lookup yields null, and the page renders nothing for it.
(() => {
  const INSTALLERS = { import: 'Library-Import', replace: 'Library-Replace',
                       fetch: 'Library-Fetch', paste: 'Library-Paste' };
  const VERBS = { import: 'installed', replace: 'replaced', fetch: 'fetched', paste: 'pasted' };
  const FROM = /^https:\/\/raw\.githubusercontent\.com\/mehrlander\/shortcut-tools\/(.+?)\/(plists|packed|signed)\/(.+)$/;
  const SHA = /^[0-9a-f]{40}$/;
  const STEM = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/;

  // A `verb key=value …` first line with a free payload after it. Runs write
  // this form because a result carrying quotes broke the JSON form.
  const header = text => {
    const nl = text.indexOf('\n');
    const first = nl < 0 ? text : text.slice(0, nl);
    if (!/^\w[\w-]*(\s+\w+=\S*)+\s*$/.test(first)) return null;
    const [op, ...pairs] = first.trim().split(/\s+/);
    const fields = {};
    for (const p of pairs) { const i = p.indexOf('='); fields[p.slice(0, i)] = p.slice(i + 1); }
    return { op, fields, payload: nl < 0 ? '' : text.slice(nl + 1).trim() };
  };

  // `from` → the shortcut-tools ref and file it names, or null.
  const source = from => {
    const m = FROM.exec(String(from || ''));
    return m ? { ref: m[1], sha: SHA.test(m[1]), dir: m[2], file: m[3] } : null;
  };

  const dateOf = stem => {
    const m = STEM.exec(stem);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  };

  // One log file → one entry. `build` is the build of the chain the row is
  // ABOUT (see the head of this file), '' when the row does not carry it.
  const parse = (stem, raw) => {
    raw = String(raw ?? '').trim();
    let op = 'text', name = '', fields = {}, payload = '';
    let j; try { j = JSON.parse(raw) } catch {}
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      ({ op = 'json', name = '', ...fields } = j);
    } else if (j !== undefined) {
      payload = typeof j === 'string' ? j : raw;
    } else {
      const h = header(raw);
      if (h) { op = h.op; ({ name = '', ...fields } = h.fields); payload = h.payload; }
      else payload = raw;
    }
    op = String(op); name = typeof name === 'string' ? name : '';
    const install = Object.hasOwn(INSTALLERS, op);
    const src = install ? source(fields.from) : null;
    return {
      stem, when: dateOf(stem), op, name, fields, payload, raw, install, source: src,
      verb: VERBS[op] || op,
      build: String((install ? fields.target : fields.build) || ''),
      installer: install ? { name: INSTALLERS[op], build: String(fields.build || '') } : null,
      via: null,
    };
  };

  // Newest first in, same order out. Each run of a named, stamped chain takes
  // the ref of the newest install of that name older than itself, when the
  // window holds one.
  const link = entries => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.install || !e.name || !e.build) continue;
      const inst = entries.slice(i + 1).find(x => x.install && x.name === e.name && x.source);
      e.via = inst ? inst.source.ref : null;
    }
    return entries;
  };

  // Per shortcut, the newest build the phone reported for it, newest first in.
  // What the Chains view scores against the catalog it is browsing: the same
  // reading of a row as the log's, a different baseline on purpose (the ref
  // being reviewed there, the ref the install came from here), as the
  // PowerShell Overview scores against the ref being browsed. An install that
  // carries no build of its own (import, replace, fetch) says only that the
  // name is present, which `names` keeps.
  const observed = entries => {
    const builds = new Map(), names = new Set();
    for (const e of entries) {
      if (!e.name) continue;
      names.add(e.name);
      if (e.build && !builds.has(e.name)) builds.set(e.name, { build: e.build, stem: e.stem });
    }
    return { builds, names };
  };

  // The refs a set of entries needs resolved: every install's source ref.
  const refs = entries => [...new Set(entries.filter(e => e.source).map(e => e.source.ref))];

  // Which baseline a ref is scored against, from the pull requests GitHub
  // associates with it (commits/<sha>/pulls, or pulls?head= for a branch
  // name). An open PR wins; anything else, including none, is main.
  const baseOf = (ref, pulls) => {
    if (ref === 'main') return { kind: 'main' };
    if (!Array.isArray(pulls)) return null;
    const open = pulls.find(p => p && p.state === 'open' && p.head && p.head.sha);
    return open ? { kind: 'pr', pr: open.number, head: open.head.sha, branch: open.head.ref || '' }
                : { kind: 'main' };
  };

  // The verdict for one entry, or null. `ctx.at` maps a ref (or 'main', or a
  // PR head sha) to its builds.json object; `ctx.base` maps a source ref to
  // baseOf's answer. Both are plain objects, and a missing key in either is an
  // unanswered lookup.
  const verdict = (e, ctx) => {
    if (!e.name) return null;
    const ref = e.source ? e.source.ref : e.via;
    let build = e.build, inferred = false;
    if (!build && e.install && ref) {
      build = ctx.at[ref]?.[e.name] || '';
      inferred = true;
    }
    if (!build) return null;
    const base = ref ? ctx.base[ref] : { kind: 'main' };
    if (!base) return null;
    const target = ctx.at[base.kind === 'pr' ? base.head : 'main']?.[e.name];
    if (!target) return null;
    return {
      state: build === target ? 'current' : 'stale',
      build, target, inferred, ref: ref || 'main',
      against: base.kind === 'pr' ? { kind: 'pr', pr: base.pr, head: base.head, branch: base.branch }
                                  : { kind: 'main' },
    };
  };

  // Long strings keep their head and report their length; nested JSON strings
  // are opened. What a person reads a payload for, with `raw` a tap away.
  const CAP = 96;
  const deepen = v => {
    if (typeof v === 'string' && /^\s*[[{]/.test(v)) { try { return deepen(JSON.parse(v)) } catch { return v } }
    if (Array.isArray(v)) return v.map(deepen);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepen(x)]));
    return v;
  };
  const elide = v => {
    if (typeof v === 'string') return v.length > CAP ? v.slice(0, 48) + `…[${v.length}]` : v;
    if (Array.isArray(v)) return v.map(elide);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, elide(x)]));
    return v;
  };
  const pretty = text => { try { return JSON.stringify(elide(deepen(JSON.parse(text))), null, 2) } catch { return null } };

  window.ShortcutEvidence = { INSTALLERS, VERBS, parse, source, link, refs, observed, baseOf, verdict, pretty, elide };
})();
