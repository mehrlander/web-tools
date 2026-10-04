// kits/user-calls.js — what waits on the owner (window.UserCalls).
//
// Two queues, read together because the owner meets them together:
//
//   USER CALLS: one decision a session needs from the owner, one file each in
//   web-tools-private user-calls/ (user-call/1, written by user-call.py). A
//   call is open while its status is open and no answer line has come back in
//   its <id>.answers.jsonl. Calls are filed straight to main
//   (docs/direct-to-main.csv), so main is the ref read.
//
//   PROPOSED EDITS: the Text collection's proposals in mehrlander/home
//   (projects/text/proposals.jsonl), each a passage pair put forward for one
//   file. The collection keeps a proposal after it is applied ("the file
//   either carries the new text or it does not"), so what counts is what
//   Dictate's &proposed would stage on the file as it stands: its own matcher,
//   mdVariants.plan, run over each named file at main, counting the blocks
//   whose picked variant is proposed for that file. Raw rows overcount badly
//   (582 rows, 2026-10-04), and so does any looser match: a passage spanning
//   two blocks, or one found only inside a longer block, is never staged, so a
//   marker promising it would open on nothing. The plan needs the collection's
//   passages (4.5MB), so this is read when a view asks, never at boot.
//
//   UserCalls.list({ token, fresh })          -> every user call, newest first,
//                                                each with `answers` and `open`
//   UserCalls.pendingEdits({ token, fresh })  -> Map 'owner/repo:path' ->
//                                                { file, calls, staged, bases }
//   UserCalls.where(call)                     -> owner/repo[@ref]:path of a call
//   UserCalls.href(call)                      -> where a call is answered
//   UserCalls.sessionHref(call)               -> the session page that filed it
//   UserCalls.dictateHref({ file, call, proposed })
//                                             -> Dictate on a file, the call's
//                                                edits or its proposals staged
//
// Links are built at the version of web-tools the page runs at (the
// selection, GH.refFor), so a view opened from a branch hands the reader the
// branch's Dictate rather than main's. Both reads are cached for the page;
// `fresh` reads again.
(() => {
  const STORE = 'mehrlander/web-tools-private';
  const DIR = 'user-calls';
  const HUB = 'mehrlander/web-tools';
  const PAGES = 'https://mehrlander.github.io/web-tools/pages/';
  const cache = new Map();

  const client = (repo, token) => new window.GH({ token: token ?? window.TOKEN, repo, ref: 'main' });
  const memo = (key, fresh, make) => {
    if (!fresh && cache.has(key)) return cache.get(key);
    const p = make();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  };
  const jsonl = (text) => String(text || '').split('\n').filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  // 'owner/repo@ref:path' and 'owner/repo:path' name the same document here:
  // a proposal names no ref, and a call's ref only says where to read it.
  const fileKey = (f) => { const s = String(f || ''), i = s.indexOf(':'); return i < 0 ? s : s.slice(0, i).replace(/@.*$/, '') + s.slice(i); };

  function list({ token, fresh = false } = {}) {
    return memo('calls', fresh, async () => {
      const g = client(STORE, token);
      let names = [];
      try { names = (await g.ls(DIR, window.GH.FRESH)).filter((f) => f.type === 'file').map((f) => f.name); }
      catch (e) { if (e?.status === 404) return []; throw e; }
      const answered = new Set(names.filter((n) => n.endsWith('.answers.jsonl')).map((n) => n.slice(0, -'.answers.jsonl'.length)));
      const calls = await Promise.all(names.filter((n) => n.endsWith('.json')).map(async (n) => {
        const id = n.slice(0, -'.json'.length);
        try {
          const c = JSON.parse((await g.get(DIR + '/' + n, window.GH.FRESH)).text);
          const answers = answered.has(id)
            ? jsonl(await g.get(DIR + '/' + id + '.answers.jsonl', window.GH.FRESH).then((r) => r.text, () => ''))
            : [];
          return { ...c, id: c.id || id, _repo: STORE, _ref: 'main', _path: DIR + '/' + n, answers,
                   open: c.status !== 'closed' && !answers.length };
        } catch { return null; }   // one unreadable call is not the list failing
      }));
      return calls.filter(Boolean).sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    });
  }

  function pendingEdits({ token, fresh = false } = {}) {
    return memo('pending', fresh, async () => {
      const by = new Map();
      const at = (file) => {
        const k = fileKey(file);
        if (!by.has(k)) by.set(k, { file: k, calls: [], staged: 0, bases: [] });
        return by.get(k);
      };
      if (!window.mdVariants) await window.gh?.load?.('kits/md-variants.js');
      if (!window.mdDiff) await window.gh?.load?.('kits/md-diff.js');
      const V = window.mdVariants;
      const [calls, index] = await Promise.all([
        list({ token, fresh }).catch(() => []),
        V && window.mdDiff ? V.index({ token, fresh }).catch(() => null) : Promise.resolve(null),
      ]);
      for (const c of calls) if (c.open && c.kind === 'documentation' && c.file) at(c.file).calls.push(c);
      const named = new Set((index?.proposals || []).map((p) => p.repo + ':' + p.path));
      await Promise.all([...named].map(async (k) => {
        const i = k.indexOf(':'), repo = k.slice(0, i), path = k.slice(i + 1);
        let text;
        try { text = (await client(repo, token).get(path)).text; } catch { return; }
        const mine = (v) => (v?.proposals || []).filter((p) => p.repo === repo && p.path === path);
        const staged = V.plan(text, index, { file: { repo, path } }).blocks.map((b) => mine(b.variants[b.pick])).filter((ps) => ps.length);
        if (staged.length) Object.assign(at(k), { staged: staged.length, bases: [...new Set(staged.flat().map((p) => p.basis).filter(Boolean))] });
      }));
      return by;
    });
  }

  const where = (c) => c._repo + (c._ref && c._ref !== 'main' ? '@' + c._ref : '') + ':' + c._path;
  // A hub page at the version this page runs at: main's own address, or the
  // toss renderer at the selected ref, which carries the query and fragment
  // through to the page.
  function page(name, tail = '') {
    let ref = 'main';
    try { ref = window.GH?.refFor?.(HUB) || new URLSearchParams(location.search).get('use') || 'main'; } catch {}
    return ref === 'main' ? PAGES + name + tail : PAGES + 'toss-render.html#gh=' + HUB + '@' + ref + ':pages/' + name + tail;
  }
  const dictateHref = ({ file, call, proposed } = {}) =>
    page('dictate.html', '?file=' + fileKey(file || call?.file) + (call ? '&user-call=' + where(call) : '') + (proposed ? '&proposed' : ''));
  const href = (c) => (c.kind === 'documentation' ? dictateHref({ call: c }) : page('user-call.html', '#src=' + where(c)));
  const sessionHref = (c) => (c.session ? page('session.html', '#id=' + c.session) : '');

  window.UserCalls = { STORE, DIR, list, pendingEdits, where, href, dictateHref, sessionHref, fileKey,
                       clear() { cache.clear(); } };
})();
